import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAirportQuery, isSuggestionQueryEligible, isAirportSearchEligible, isBrazilianIcao } from "../public/js/shared/api-contract.js";
import { loadModule, response } from "./helpers/modules.js";
import { cachePublicResponse } from "../backend/src/utils/http-cache.js";

test("shared query policy handles malformed input, whitespace and literal punctuation", () => {
  for (const input of [null, undefined, [], {}, 42, "a".repeat(101)]) {
    assert.equal(normalizeAirportQuery(input), ""); assert.equal(isSuggestionQueryEligible(input), false);
  }
  assert.equal(normalizeAirportQuery("  Sao   Paulo  "), "SAO PAULO");
  for (const input of ["S", "12", "%%", "___", "   "]) assert.equal(isSuggestionQueryEligible(input), false);
  for (const input of ["SB", "Sao", "A%_B"]) assert.equal(isSuggestionQueryEligible(input), true);
  assert.equal(isAirportSearchEligible("SB"), false);
  assert.equal(isBrazilianIcao("SCEL"), false);
});

test("cache helper never permits 5xx caching even when negative flag is set", () => {
  for (const status of [400, 401, 403, 429, 500, 502, 503, 504]) {
    const res = response().status(status); cachePublicResponse(res, 300, { negative: true, swr: 15 });
    assert.equal(res.headers["vercel-cdn-cache-control"], "no-store");
  }
});

test("structured logging is allowlisted and never serializes headers, URLs or messages", async () => {
  const lines = [];
  const mod = await loadModule("backend/src/utils/observability.js", { globals: { console: { log: line => lines.push(line) } } });
  mod.logEvent({ event: "provider_call", provider: "NOAA", status: 503, durationMs: 7,
    url: "https://example.invalid/?key=secret", headers: { "X-Api-Key": "secret" }, message: "secret", password: "secret" });
  assert.deepEqual(JSON.parse(lines[0]), { event: "provider_call", provider: "NOAA", status: 503, durationMs: 7 });
  assert.ok(!lines[0].includes("secret"));
});
