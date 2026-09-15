import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, response, deferred, fakeClock } from "./helpers/modules.js";

class RedemetApiError extends Error {
  constructor(code = "REDEMET_UNAVAILABLE", message = "unavailable", status = 503) {
    super(message); Object.assign(this, { code, status });
  }
}
class AviationWeatherError extends Error {
  constructor(code = "NOAA_UNAVAILABLE", message = "unavailable", status = 503) {
    super(message); Object.assign(this, { code, status });
  }
}
const report = icao => ({ icao, rawMetar: `${icao} 121200Z 00000KT CAVOK 20/10 Q1013`, reportTime: "2026-09-12T12:00:00Z" });
async function fixture({ redemet, noaa, env = {} } = {}) {
  const clock = fakeClock();
  const calls = [];
  const api = await loadModule("backend/src/controllers/metar.controller.js", {
    globals: { Date: clock.Date, process: { env } },
    mocks: {
      "backend/src/services/redemet.service.js": {
        RedemetApiError,
        getLatestRedemetMetarByIcao: async (icao, options) => {
          calls.push({ provider: "REDEMET", icao, ...options });
          return redemet ? redemet(icao, options, clock) : report(icao);
        }
      },
      "backend/src/services/aviationWeather.service.js": {
        AviationWeatherError,
        getLatestMetarByIcao: async (icao, options) => {
          calls.push({ provider: "NOAA", icao, ...options });
          return noaa ? noaa(icao, options, clock) : report(icao);
        }
      }
    }
  });
  return { clock, calls, async get(icao = "SBGR") {
    const res = response();
    await api.getLatestMetar({ params: { icao } }, res);
    return res;
  } };
}
const cdnTtl = res => Number(res.headers["vercel-cdn-cache-control"].match(/s-maxage=(\d+)/)?.[1]);
const noStore = res => {
  for (const name of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.equal(res.headers[name], "no-store");
};

test("METAR miss/hit preserves JSON, defaults and remaining CDN freshness", async () => {
  const f = await fixture();
  const first = await f.get(" sbgr ");
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, { success: true, source: "REDEMET", provider: "REDEMET", data: report("SBGR"), cache: { hit: false, ttlSeconds: 60 } });
  assert.equal(cdnTtl(first), 30);
  assert.equal(first.headers["cache-control"], "public, max-age=0, must-revalidate");
  f.clock.advance(45000);
  const second = await f.get();
  assert.equal(second.body.cache.hit, true);
  assert.equal(cdnTtl(second), 15);
  f.clock.advance(14500);
  noStore(await f.get()); // Fractional remaining second must not be rounded up.
  assert.equal(f.calls.length, 1);
});

test("METAR environment TTL still works; invalid ICAO never calls providers", async () => {
  const f = await fixture({ env: { METAR_CACHE_TTL_SECONDS: "12" } });
  assert.equal(cdnTtl(await f.get()), 12);
  for (const icao of ["1234", "SBGRX", "", "SB"]) {
    const res = await f.get(icao); assert.equal(res.statusCode, 400); noStore(res);
  }
  assert.equal(f.calls.length, 1);
});

test("REDEMET failure has exactly one NOAA fallback; international goes straight to NOAA", async () => {
  const f = await fixture({ redemet: () => { throw new RedemetApiError(); } });
  const res = await f.get();
  assert.deepEqual(f.calls.map(x => x.provider), ["REDEMET", "NOAA"]);
  assert.equal(res.body.fallback.from, "REDEMET");
  assert.equal(res.body.provider, "NOAA");
  assert.equal(cdnTtl(res), 30);
  await f.get(); assert.equal(f.calls.length, 2);
  await f.get("KJFK"); assert.equal(f.calls.at(-1).provider, "NOAA");
});

test("single-flight shares one upstream chain and removes rejected promises", async () => {
  const pending = deferred();
  const f = await fixture({ redemet: () => pending.promise });
  const a = f.get(), b = f.get();
  assert.equal(f.calls.length, 1);
  pending.resolve(report("SBGR"));
  assert.deepEqual((await a).body, (await b).body);
  const failure = deferred();
  const g = await fixture({ redemet: () => failure.promise, noaa: () => { throw new AviationWeatherError(); } });
  const x = g.get(), y = g.get();
  failure.reject(new RedemetApiError());
  noStore(await x); noStore(await y);
  assert.equal(g.calls.length, 2);
  await g.get();
  assert.equal(g.calls.length, 4); // A rejected chain does not poison later requests.
});

test("single-flight isolates different ICAOs and normalizes equivalent keys", async () => {
  const sbgr = deferred(), sbrj = deferred();
  const f = await fixture({ redemet: icao => icao === "SBGR" ? sbgr.promise : sbrj.promise });
  const a = f.get("sbgr"), b = f.get(" SBGR "), c = f.get("SBRJ");
  assert.deepEqual(f.calls.map(call => call.icao), ["SBGR", "SBRJ"]);
  sbrj.resolve(report("SBRJ"));
  assert.equal((await c).body.data.icao, "SBRJ");
  sbgr.resolve(report("SBGR"));
  assert.equal((await a).body.data.icao, "SBGR");
  assert.deepEqual((await b).body.data, report("SBGR"));
});

test("all provider error statuses and unexpected failures remain no-store and retry only on a new request", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) {
    const f = await fixture({ noaa: () => { throw new AviationWeatherError("NOAA_TEST_FAILURE", "test failure", status); } });
    for (let request = 0; request < 2; request++) {
      const res = await f.get("KJFK");
      assert.equal(res.statusCode, status); assert.equal(res.body.success, false); noStore(res);
    }
    assert.equal(f.calls.length, 2);
  }
  const f = await fixture({ noaa: () => { throw new Error("unexpected test failure"); } });
  const res = await f.get("KJFK");
  assert.equal(res.statusCode, 500); assert.equal(res.body.code, "METAR_INTERNAL_ERROR"); noStore(res);
});

test("stale is retained for grace, never CDN-cached, and no-data errors do not use stale", async () => {
  let fail = false, noData = false;
  const f = await fixture({
    redemet: icao => { if (fail) throw new RedemetApiError(); return report(icao); },
    noaa: () => { throw new AviationWeatherError(noData ? "NO_METAR_FOUND" : "NOAA_UNAVAILABLE", "failure", noData ? 404 : 503); }
  });
  await f.get(); fail = true; f.clock.advance(61000);
  const stale = await f.get();
  assert.equal(stale.statusCode, 200); assert.equal(stale.body.cache.stale, true); noStore(stale);
  assert.equal(f.calls.length, 3);
  noData = true;
  const missing = await f.get(); assert.equal(missing.statusCode, 404); noStore(missing);
  noData = false; f.clock.advance(300000);
  const expired = await f.get(); assert.equal(expired.statusCode, 503); noStore(expired);
});

test("global 12 s budget reserves 3 s for NOAA and does not reset during fallback", async () => {
  const f = await fixture({ redemet: (icao, options, clock) => {
    assert.equal(options.deadline - clock.now(), 9000);
    clock.advance(9000); throw new RedemetApiError("REDEMET_TIMEOUT", "timeout", 504);
  }, noaa: (icao, options, clock) => {
    assert.equal(options.deadline - clock.now(), 3000);
    return report(icao);
  } });
  assert.equal((await f.get()).statusCode, 200);
  assert.equal(f.calls.length, 2);
});

test("no NOAA starts with less than 500 ms; controlled timeout or eligible stale", async () => {
  let slow = false;
  const f = await fixture({ redemet: (icao, options, clock) => {
    if (!slow) return report(icao);
    clock.advance(11700); throw new RedemetApiError("REDEMET_TIMEOUT", "timeout", 504);
  } });
  await f.get(); slow = true; f.clock.advance(61000);
  const stale = await f.get();
  assert.equal(stale.body.cache.stale, true); noStore(stale);
  const error = await f.get("SBRJ");
  assert.equal(error.statusCode, 504); assert.equal(error.body.code, "NOAA_TIMEOUT"); noStore(error);
  assert.ok(f.calls.every(x => x.provider === "REDEMET"));
});

test("late provider completion is not published as fresh", async () => {
  const f = await fixture({ noaa: (icao, options, clock) => { clock.advance(12001); return report(icao); } });
  const res = await f.get("KJFK"); assert.equal(res.statusCode, 504); noStore(res);
});

test("Map evicts beyond 1000 entries and cleans entries past stale grace", async () => {
  const f = await fixture();
  const code = i => "K" + [676, 26, 1].map(n => String.fromCharCode(65 + Math.floor(i / n) % 26)).join("");
  for (let i = 0; i < 1001; i++) await f.get(code(i));
  await f.get(code(1000)); assert.equal(f.calls.length, 1001);
  await f.get(code(0)); assert.equal(f.calls.length, 1002);
  f.clock.advance(361000);
  await f.get(code(1000)); assert.equal(f.calls.length, 1003);
});
