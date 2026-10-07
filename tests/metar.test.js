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
  const capped = await fixture({ env: { METAR_CACHE_TTL_SECONDS: "3600" } });
  assert.equal((await capped.get()).body.cache.ttlSeconds, 60);
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
  assert.equal(g.calls.length, 2); // Cooldown suppresses new calls without retaining the rejected flight.
  g.clock.advance(15001);
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

test("provider infrastructure errors remain no-store and respect cooldown", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) {
    const f = await fixture({ noaa: () => { throw new AviationWeatherError("NOAA_TEST_FAILURE", "test failure", status); } });
    for (let request = 0; request < 2; request++) {
      const res = await f.get("KJFK");
      assert.equal(res.statusCode, status); assert.equal(res.body.success, false); noStore(res);
    }
    assert.equal(f.calls.length, 1);
    f.clock.advance(15001); await f.get("KJFK");
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
  noData = true; f.clock.advance(15001);
  const missing = await f.get(); assert.equal(missing.statusCode, 404); assert.equal(cdnTtl(missing), 20);
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

test("100 simultaneous requests share exactly one provider call per instance", async () => {
  const pending = deferred();
  const f = await fixture({ noaa: () => pending.promise });
  const requests = Array.from({ length: 100 }, (_, i) => f.get(i % 2 ? "kjfk" : "KJFK"));
  assert.equal(f.calls.length, 1);
  pending.resolve(report("KJFK"));
  const results = await Promise.all(requests);
  assert.ok(results.every(r => r.statusCode === 200 && r.body.data.icao === "KJFK"));
  assert.equal(f.calls.length, 1);
});

test("stale revalidation shares one failing call, suppresses sequential retries and recovers", async () => {
  let failure = null;
  const f = await fixture({ noaa: icao => failure ? failure.promise : report(icao) });
  await f.get("KJFK"); f.clock.advance(60000);
  failure = deferred();
  const burst = Array.from({ length: 100 }, () => f.get("KJFK"));
  assert.equal(f.calls.length, 2);
  failure.reject(new AviationWeatherError());
  for (const res of await Promise.all(burst)) { assert.equal(res.body.cache.stale, true); noStore(res); }
  for (let i = 0; i < 20; i++) assert.equal((await f.get("KJFK")).body.cache.stale, true);
  assert.equal(f.calls.length, 2);
  failure = null; f.clock.advance(15001);
  const recovered = await f.get("KJFK");
  assert.equal(recovered.body.cache.stale, undefined); assert.equal(f.calls.length, 3);
});

test("only confirmed NO_METAR_FOUND is negative-cached; misses expire and recover", async () => {
  let missing = true;
  const f = await fixture({ noaa: icao => {
    if (missing) throw new AviationWeatherError("NO_METAR_FOUND", "No recent METAR", 404);
    return report(icao);
  } });
  const burst = await Promise.all(Array.from({ length: 20 }, () => f.get("KZZZ")));
  assert.equal(f.calls.length, 1);
  for (const res of burst) { assert.equal(res.statusCode, 404); assert.equal(cdnTtl(res), 20); }
  f.clock.advance(10000);
  assert.equal(cdnTtl(await f.get("KZZZ")), 10);
  missing = false; f.clock.advance(10001);
  assert.equal((await f.get("KZZZ")).statusCode, 200); assert.equal(f.calls.length, 2);
  for (const [code, status] of [["NOAA_RATE_LIMIT", 429], ["NOAA_TIMEOUT", 504], ["NOAA_UNAVAILABLE", 503], ["NOAA_ENDPOINT_NOT_FOUND", 502]]) {
    const g = await fixture({ noaa: () => { throw new AviationWeatherError(code, "failure", status); } });
    for (let i = 0; i < 5; i++) { const r = await g.get("KJFK"); assert.equal(r.statusCode, status); noStore(r); }
    assert.equal(g.calls.length, 1);
  }
});

test("Brazilian prefixes use REDEMET; SCEL, SAEZ, SPJC, SUMU and KJFK use NOAA", async () => {
  const f = await fixture();
  for (const code of ["SBGR", "SDAA", "SIAA", "SJAA", "SNAA", "SSAA", "SWAA"]) {
    await f.get(code); assert.equal(f.calls.at(-1).provider, "REDEMET");
  }
  for (const code of ["SCEL", "SAEZ", "SPJC", "SUMU", "KJFK"]) {
    await f.get(code); assert.equal(f.calls.at(-1).provider, "NOAA");
  }
});

test("provider circuit limits distinct ICAOs during outage and allows one recovery probe", async () => {
  let fail = true, probe;
  const f = await fixture({ noaa: icao => {
    if (probe) return probe.promise;
    if (fail) throw new AviationWeatherError();
    return report(icao);
  } });
  for (const code of ["KAAA", "KAAB", "KAAC", "KAAD", "KAAE"]) noStore(await f.get(code));
  assert.equal(f.calls.length, 3);
  f.clock.advance(30001); probe = deferred();
  const first = f.get("KAAF");
  const blocked = await f.get("KAAG");
  assert.equal(blocked.body.code, "NOAA_CIRCUIT_OPEN"); assert.equal(f.calls.length, 4);
  probe.resolve(report("KAAF")); await first; probe = null; fail = false;
  assert.equal((await f.get("KAAH")).statusCode, 200); assert.equal(f.calls.length, 5);
});

test("failed half-open probe reopens the circuit without a retry storm", async () => {
  const f = await fixture({ noaa: () => { throw new AviationWeatherError(); } });
  for (const code of ["KAAA", "KAAB", "KAAC"]) await f.get(code);
  f.clock.advance(30001);
  await f.get("KAAD"); await f.get("KAAE");
  assert.equal(f.calls.length, 4);
});

test("100 distinct in-flight keys are bounded and capacity is released on completion", async () => {
  const pending = deferred();
  const f = await fixture({ noaa: async icao => { await pending.promise; return report(icao); } });
  const code = i => "KA" + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26);
  const running = Array.from({ length: 100 }, (_, i) => f.get(code(i)));
  const overloaded = await f.get("KZZZ");
  assert.equal(overloaded.statusCode, 503); noStore(overloaded); assert.equal(f.calls.length, 100);
  pending.resolve(); await Promise.all(running);
  assert.equal((await f.get("KZZZ")).statusCode, 200); assert.equal(f.calls.length, 101);
});

test("negative cache map is bounded and expired misses are fetched again", async () => {
  const f = await fixture({ noaa: () => { throw new AviationWeatherError("NO_METAR_FOUND", "missing", 404); } });
  const code = i => "K" + [676, 26, 1].map(n => String.fromCharCode(65 + Math.floor(i / n) % 26)).join("");
  for (let i = 0; i < 1001; i++) await f.get(code(i));
  await f.get(code(1000)); assert.equal(f.calls.length, 1001);
  await f.get(code(0)); assert.equal(f.calls.length, 1002);
  f.clock.advance(20001); await f.get(code(1000)); assert.equal(f.calls.length, 1003);
});
