import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { loadModule, root } from "./helpers/modules.js";
import { withServer } from "./helpers/server.js";

async function fixture() {
  let sql = 0, providers = 0;
  const { default: app } = await loadModule("api/index.js", { mocks: {
    "backend/src/db.js": {
      getDatabaseConnection: async () => ({ execute: async () => { sql++; return [[{ id: 1, icao: "SBGR", name: "Guarulhos" }]]; }, release() {} }),
      getPublicDatabaseError: () => ({ status: 503, error: "SERVICE_UNAVAILABLE", message: "Serviço temporariamente indisponível." }),
      logDatabaseError() {}
    },
    "backend/src/services/redemet.service.js": {
      RedemetApiError: class extends Error {},
      getLatestRedemetMetarByIcao: async () => { providers++; return { icao: "SBGR", rawMetar: "SBGR TEST" }; }
    },
    "backend/src/services/aviationWeather.service.js": {
      AviationWeatherError: class extends Error {},
      getLatestMetarByIcao: async () => { providers++; return { icao: "KJFK", rawMetar: "KJFK TEST" }; }
    }
  } });
  return { app, stats: () => ({ sql, providers }) };
}

function noStore(res) {
  for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.equal(res.headers.get(header), "no-store");
}

test("health, invalid namespaces, validation and CORS errors stay cheap and no-store over HTTP", async () => {
  const f = await fixture();
  await withServer(f.app, async base => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: "ok" }); noStore(health);
    for (const route of ["/api/foo", "/api/random", "/api/.env", "/api/wp-admin", "/css/global.css"]) {
      const res = await fetch(`${base}${route}`); assert.equal(res.status, 404); noStore(res);
      assert.equal((await res.json()).error, "NOT_FOUND");
    }
    for (const query of ["q=SB&q=GR", "q[x]=SBGR", "q=", `q=${"A".repeat(101)}`]) {
      const res = await fetch(`${base}/api/aeroportos/search?${query}`);
      assert.equal(res.status, 400); noStore(res);
    }
    const invalidIcao = await fetch(`${base}/api/metar/1234`);
    assert.equal(invalidIcao.status, 400); noStore(invalidIcao);
    const denied = await fetch(`${base}/api/metar/SBGR`, { headers: { Origin: "https://invalid.example" } });
    assert.equal(denied.status, 403); noStore(denied);
    assert.equal((await denied.json()).error, "CORS_ORIGIN_DENIED");
    const malformed = await fetch(`${base}/api/health`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400); noStore(malformed);
    const options = await fetch(`${base}/api/metar/SBGR`, { method: "OPTIONS", headers: { Origin: base, "Access-Control-Request-Method": "GET" } });
    assert.equal(options.status, 204); noStore(options);
    assert.equal(options.headers.get("access-control-allow-origin"), base);
    assert.deepEqual(f.stats(), { sql: 0, providers: 0 });
  });
});

test("real Express responses preserve CORS Vary, ETag, HEAD semantics and cache TTLs", async () => {
  const f = await fixture();
  await withServer(f.app, async base => {
    for (const [route, ttl] of [
      ["/api/aeroportos?q=SBGR", 300], ["/api/aeroportos/search?q=SBGR", 300],
      ["/api/aeroportos/sugestoes?q=SB", 300], ["/api/aeroportos/icao/sbgr", 3600], ["/api/aeroportos/1", 3600],
      ["/api/metar/SBGR", 30]
    ]) {
      const res = await fetch(`${base}${route}`, { headers: { Origin: base } });
      assert.equal(res.status, 200); assert.equal((await res.json()).success, true);
      assert.equal(res.headers.get("vercel-cdn-cache-control"), `public, s-maxage=${ttl}, must-revalidate`);
      assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
      assert.match(res.headers.get("vary"), /Origin/);
      assert.equal(res.headers.get("access-control-allow-origin"), base);
      assert.ok(res.headers.get("etag")); assert.equal(res.headers.get("set-cookie"), null);
    }
    const head = await fetch(`${base}/api/aeroportos/1`, { method: "HEAD" });
    assert.equal(head.status, 200); assert.equal(await head.text(), "");
    assert.equal(head.headers.get("vercel-cdn-cache-control"), "public, s-maxage=3600, must-revalidate");
    const metarHead = await fetch(`${base}/api/metar/KJFK`, { method: "HEAD" });
    assert.equal(metarHead.status, 200); assert.equal(await metarHead.text(), "");
    assert.deepEqual(f.stats(), { sql: 6, providers: 2 }); // HEAD still uses GET handlers on misses.
  });
});

test("Vercel config sends only API paths to the Function and has no METAR self-redirect", async () => {
  const config = JSON.parse(await fs.readFile(path.join(root, "vercel.json"), "utf8"));
  assert.equal(config.outputDirectory, "public");
  assert.equal(config.functions["api/index.js"].maxDuration, 15);
  assert.deepEqual(config.rewrites, [{ source: "/api/:path*", destination: "/api/index.js" }]);
  assert.ok(config.redirects.every(rule => rule.source !== rule.destination && !rule.destination.startsWith("/api/")));
  assert.ok(!config.redirects.some(rule => rule.source === "/metar.html"));
  assert.equal(config.redirects.find(rule => rule.source === "/pages/apiMet.html").destination, "/metar.html");
  const entry = await fs.readFile(path.join(root, "api/index.js"), "utf8");
  assert.doesNotMatch(entry, /server\.js|local-static|express\.static/);
});

test("local static routes serve METAR with query intact and legacy URL redirects once", async () => {
  const { registerLocalStaticFrontend } = await loadModule("backend/src/local-static.js");
  const app = registerLocalStaticFrontend(express(), path.join(root, "public"));
  await withServer(app, async base => {
    for (const route of ["/", "/metar.html", "/metar.html?icao=SBGR", "/airports.html", "/css/global.css", "/js/aerodromo.js", "/assets/icons/DecMET.svg", "/robots.txt", "/sitemap.xml"]) {
      const res = await fetch(`${base}${route}`, { redirect: "manual" });
      assert.equal(res.status, 200, route); assert.equal(res.headers.get("location"), null);
      await res.arrayBuffer();
    }
    const legacy = await fetch(`${base}/pages/apiMet.html`, { redirect: "manual" });
    assert.equal(legacy.status, 301); assert.equal(legacy.headers.get("location"), "/metar.html");
    const destination = await fetch(new URL(legacy.headers.get("location"), base), { redirect: "manual" });
    assert.equal(destination.status, 200); assert.equal(destination.headers.get("location"), null);
  });
});
