import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { requestText } from "../backend/src/utils/request-text.js";
import { withServer } from "./helpers/server.js";
import { loadModule } from "./helpers/modules.js";

const options = extra => ({ headers: { Accept: "application/json" }, timeoutMs: 1000,
  timeoutError: () => Object.assign(new Error("timeout"), { code: "TEST_TIMEOUT" }),
  networkError: () => Object.assign(new Error("network"), { code: "TEST_NETWORK" }), ...extra });

test("HTTP helper reads success and HTTP errors without following redirects or retrying", async () => {
  let requests = 0;
  await withServer((req, res) => { requests++; res.writeHead(req.url === "/redirect" ? 302 : 200, { Location: "/ok" }); res.end('{"ok":true}'); }, async base => {
    const result = await requestText(http, new URL(base + "/ok"), options());
    assert.equal(result.body, '{"ok":true}'); assert.equal(result.statusCode, 200);
    assert.equal((await requestText(http, new URL(base + "/redirect"), options())).statusCode, 302);
  });
  assert.equal(requests, 2);
});

test("absolute deadline aborts a streaming response even while chunks keep arriving", async () => {
  let closed;
  const closePromise = new Promise(resolve => { closed = resolve; });
  await withServer((req, res) => {
    res.writeHead(200); res.write("a");
    const interval = setInterval(() => res.write("a"), 5);
    res.on("close", () => { clearInterval(interval); closed(); });
  }, async base => {
    const started = Date.now();
    await assert.rejects(requestText(http, new URL(base), options({ deadline: started + 100 })), { code: "TEST_TIMEOUT" });
    assert.ok(Date.now() - started < 1500);
    await closePromise;
  });
});

test("truncated/aborted upstream body rejects and does not leave a pending promise", async () => {
  await withServer((req, res) => {
    res.writeHead(200, { "Content-Length": 1000 }); res.write("short");
    setTimeout(() => res.destroy(), 15);
  }, async base => {
    await assert.rejects(requestText(http, new URL(base), options()), { code: "TEST_NETWORK" });
  });
});

test("deadline covers time before a socket exists and skips already-expired requests", async () => {
  let started = 0, destroyed = 0;
  const client = { request() { started++; const req = new EventEmitter(); req.end = () => {}; req.destroy = () => { destroyed++; }; return req; } };
  // A referenced test timer keeps this simulated socket-less operation alive.
  await Promise.all([
    assert.rejects(requestText(client, new URL("https://unused.invalid"), options({ deadline: Date.now() + 25 })), { code: "TEST_TIMEOUT" }),
    delay(50)
  ]);
  assert.equal(destroyed, 1);
  await assert.rejects(requestText(client, new URL("https://unused.invalid"), options({ deadline: Date.now() - 1 })), { code: "TEST_TIMEOUT" });
  assert.equal(started, 1);
});

test("provider wrappers preserve timeout defaults, env overrides, deadlines and public errors", async () => {
  for (const [service, method, envKey, body, prefix] of [
    ["redemet", "getLatestRedemetMetarByIcao", "REDEMET_REQUEST_TIMEOUT", { data: { data: [{ id_localidade: "SBGR", mens: "SBGR 121200Z CAVOK=" }] } }, "REDEMET"],
    ["aviationWeather", "getLatestMetarByIcao", "NOAA_REQUEST_TIMEOUT", [{ icaoId: "KJFK", rawOb: "KJFK 121200Z CAVOK" }], "NOAA"]
  ]) {
    for (const [value, expected] of [[undefined, 10000], ["0", 10000], ["invalid", 10000], ["2500", 2500]]) {
      let received;
      const mod = await loadModule(`backend/src/services/${service}.service.js`, { globals: { process: { env: { REDEMET_API_KEY: "test-only", [envKey]: value } } }, mocks: {
        "backend/src/utils/request-text.js": { requestText: async (client, url, opts) => { received = opts; return { statusCode: 200, body: JSON.stringify(body) }; } }
      } });
      await mod[method]("SBGR", { deadline: 123456 });
      assert.equal(received.timeoutMs, expected); assert.equal(received.deadline, 123456);
      assert.equal(received.timeoutError().code, prefix + "_TIMEOUT");
      assert.equal(received.timeoutError().status, 504);
      assert.equal(received.networkError().code, prefix + "_NETWORK_ERROR");
    }
  }
});
