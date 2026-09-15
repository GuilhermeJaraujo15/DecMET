import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, response } from "./helpers/modules.js";

const row = { id: 1, icao: "SBGR", ident: "SBGR", gps_code: "SBGR", iata_code: "GRU", name: "Guarulhos", municipality: "Guarulhos", iso_country: "BR", type: "large_airport", latitude_deg: "-23.43", longitude_deg: "-46.47", elevation_ft: "2459" };
const normalized = { ...row, icao_code: "SBGR", latitude_deg: -23.43, longitude_deg: -46.47, elevation_ft: 2459, display_icao: "SBGR", operation_type_label: "Aeródromo de avião" };
async function fixture({ rows = [row], fail = false } = {}) {
  let acquired = 0, released = 0;
  const queries = [];
  const api = await loadModule("backend/src/controllers/aeroportos.controller.js", { mocks: {
    "backend/src/db.js": {
      getDatabaseConnection: async () => { acquired++; return {
        execute: async (sql, params) => { queries.push({ sql, params: [...params] }); if (fail) throw new Error("test DB failure"); return [rows]; },
        release: () => { released++; }
      }; },
      getPublicDatabaseError: () => ({ status: 503, error: "SERVICE_UNAVAILABLE", message: "Serviço temporariamente indisponível." }),
      logDatabaseError() {}
    }
  } });
  return { queries, stats: () => ({ acquired, released }), async call(name, req = { query: { q: "Santos" }, params: {} }) {
    const res = response(); await api[name](req, res); return res;
  } };
}

test("all airport successes preserve JSON and use endpoint-specific CDN TTLs", async () => {
  const f = await fixture();
  for (const [name, req, body, ttl] of [
    ["searchAirports", { query: { q: "Santos" } }, { success: true, count: 1, results: [normalized] }, 300],
    ["getAirportSuggestions", { query: { q: "SB" } }, { success: true, count: 1, suggestions: [normalized] }, 300],
    ["getAirportByIcao", { params: { icao: "sbgr" } }, { success: true, result: normalized }, 3600],
    ["getAirportById", { params: { id: "1" } }, { success: true, result: normalized }, 3600]
  ]) {
    const res = await f.call(name, req);
    assert.equal(res.statusCode, 200); assert.deepEqual(res.body, body);
    assert.equal(res.headers["vercel-cdn-cache-control"], `public, s-maxage=${ttl}, must-revalidate`);
  }
  assert.deepEqual(f.stats(), { acquired: 4, released: 4 });
});

test("invalid query shapes, lengths, IDs and ICAOs never acquire MySQL", async () => {
  const f = await fixture();
  for (const q of [undefined, "", " ", ["SBGR"], { value: "SBGR" }, 42, "X".repeat(101)]) {
    for (const name of ["searchAirports", "getAirportSuggestions"]) {
      const res = await f.call(name, { query: { q } });
      assert.equal(res.statusCode, 400); assert.equal(res.headers["vercel-cdn-cache-control"], "no-store");
    }
  }
  for (const id of ["-1", "abc", "1.2", "2147483648", "9".repeat(100)]) {
    const res = await f.call("getAirportById", { params: { id } });
    assert.equal(res.statusCode, 400); assert.equal(res.headers["cache-control"], "no-store");
  }
  const invalidIcao = await f.call("getAirportByIcao", { params: { icao: "1234" } });
  assert.equal(invalidIcao.statusCode, 400);
  assert.deepEqual(f.stats(), { acquired: 0, released: 0 });
});

test("short suggestions and empty successful searches keep existing contracts", async () => {
  const f = await fixture({ rows: [] });
  const short = await f.call("getAirportSuggestions", { query: { q: "S" } });
  assert.deepEqual(short.body, { success: true, suggestions: [], message: "Query too short" });
  const numeric = await f.call("getAirportSuggestions", { query: { q: "12" } });
  assert.equal(numeric.body.suggestions.length, 0); assert.equal(f.queries.length, 0);
  const empty = await f.call("searchAirports");
  assert.deepEqual(empty.body, { success: true, count: 0, results: [], message: "No airports found for this search" });
  for (const name of ["getAirportById", "getAirportByIcao"]) {
    const res = await f.call(name, { params: { id: "1", icao: "SBGR" } });
    assert.equal(res.statusCode, 404); assert.equal(res.headers["vercel-cdn-cache-control"], "no-store");
  }
});

test("SQL errors release connections and cannot be cached", async () => {
  const f = await fixture({ fail: true });
  for (const name of ["searchAirports", "getAirportSuggestions", "getAirportById", "getAirportByIcao"]) {
    const res = await f.call(name, { query: { q: "SBGR" }, params: { id: "1", icao: "SBGR" } });
    assert.equal(res.statusCode, 503);
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.equal(res.headers[header], "no-store");
  }
  assert.deepEqual(f.stats(), { acquired: 4, released: 4 });
});

test("LIKE wildcards are literal, SQL remains parameterized with unchanged limits and ordering", async () => {
  const f = await fixture();
  for (const name of ["searchAirports", "getAirportSuggestions"]) {
    await f.call(name, { query: { q: "A%_!B" } });
    const query = f.queries.at(-1);
    assert.ok(query.params.includes("%A!%!_!!B%"));
    assert.ok(query.params.includes("A%_!B")); // Exact-code comparisons stay literal.
    assert.ok(!query.sql.includes("A%_!B"));
    assert.equal((query.sql.match(/LIKE \?/g) || []).length, (query.sql.match(/LIKE \? ESCAPE '!'/g) || []).length);
    assert.match(query.sql, /ORDER BY\s+CASE/);
    assert.match(query.sql, name === "searchAirports" ? /LIMIT 25/ : /LIMIT 10/);
  }
  await f.call("searchAirports", { query: { search: " santos " } });
  assert.equal(f.queries.at(-1).params[0], "SANTOS");
});
