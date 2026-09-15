import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, deferred } from "./helpers/modules.js";

const flush = () => new Promise(resolve => setImmediate(resolve));
const success = body => ({ ok: true, status: 200, json: async () => body });
const airport = { id: 1, display_icao: "SBGR", icao: "SBGR", name: "Guarulhos", type: "large_airport" };

async function browser(page, fetchImpl, saved = {}) {
  const elements = new Map(), timers = new Map(), requests = [], storage = new Map(Object.entries(saved));
  let now = 0, timerId = 0;
  function element(id) {
    const classes = new Set(), handlers = new Map();
    let html = "", elementId = id;
    const el = {
      handlers, value: "", textContent: "", dataset: {}, children: [], hidden: false, disabled: false,
      attributes: {},
      classList: { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle: (x, force) => force ? classes.add(x) : classes.delete(x) },
      get className() { return [...classes].join(" "); },
      set className(value) { classes.clear(); value.split(/\s+/).forEach(x => classes.add(x)); },
      get id() { return elementId; }, set id(value) { elementId = value; elements.set(value, el); },
      get innerHTML() { return html; }, set innerHTML(value) { html = value; el.children = []; },
      addEventListener(type, fn) { handlers.set(type, fn); },
      setAttribute(name, value) { el.attributes[name] = value; },
      appendChild(child) { el.children.push(child); child.parentElement = el; return child; },
      append(...children) { children.forEach(child => el.appendChild(child)); },
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[role='option']" ? el.children.filter(x => x.attributes.role === "option") : []; },
      contains(child) { return el === child || el.children.includes(child); },
      focus() {}, remove() {}, select() {},
      fire(type, props = {}) { return handlers.get(type)?.({ target: el, preventDefault() {}, ...props }); }
    };
    if (id) elements.set(id, el);
    return el;
  }
  const ids = page === "airports" ? ["airportSearchForm", "airportQuery", "resultsContainer", "statusMessage", "loadingState", "emptyState", "noResultsState", "errorState"]
    : page === "metar" ? ["metarQueryForm", "icaoInput", "metarSubmitButton", "errorMessage", "rawMetarPlaceholder", "stationIdValue", "obsTimeValue", "sourceValue", "flightCategoryValue", "copyMetarButton", "emptyState", "loadingState", "errorState", "resultState"] : [];
  ids.forEach(id => element(id));
  if (page === "airports") elements.get("airportQuery").parentElement = element();
  const windowHandlers = new Map();
  const document = {
    readyState: "complete", title: "DecMET", body: element(),
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector.startsWith("#") ? elements.get(selector.slice(1)) || null : null,
    querySelectorAll: () => [], createElement: () => element(), addEventListener() {}
  };
  const entry = page === "airports" ? "public/js/aerodromo.js" : page === "metar" ? "public/js/apiMet.js" : "public/js/app.js";
  await loadModule(entry, {
    mocks: { "public/js/analytics.js": { enviarEventoGA() {} } },
    globals: {
      document, AbortController, structuredClone,
      window: { location: { origin: "https://decmet.test" }, addEventListener: (type, fn) => windowHandlers.set(type, fn), DecMETI18n: { t: key => key } },
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      setTimeout: (fn, delay) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
      clearTimeout: id => timers.delete(id),
      fetch: (url, options = {}) => { requests.push({ url, options }); return fetchImpl?.(url, options) ?? success({ success: true, suggestions: [], results: [] }); }
    }
  });
  return { elements, requests, timers,
    async type(value) { const input = elements.get(page === "metar" ? "icaoInput" : "airportQuery"); input.value = value; await input.fire("input"); },
    async tick(ms = 300) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } await flush(); },
    language() { return windowHandlers.get("decmet:languagechange")?.(); },
    submit() { return elements.get(page === "metar" ? "metarQueryForm" : "airportSearchForm").fire("submit"); },
    enter() { return elements.get("airportQuery").fire("keydown", { key: "Enter" }); }
  };
}

test("home, METAR and airports initialize without API requests", async () => {
  for (const page of ["home", "metar", "airports"]) {
    const b = await browser(page); await b.tick(3600000); b.language();
    assert.equal(b.requests.length, 0);
  }
});

test("METAR typing SBGR makes no request, submit makes exactly one", async () => {
  const b = await browser("metar", () => success({ success: true, provider: "REDEMET", data: { icao: "SBGR", rawMetar: "SBGR 121200Z CAVOK", reportTime: "2026-09-12T12:00:00Z" } }));
  for (const value of ["S", "SB", "SBG", "SBGR"]) await b.type(value);
  assert.equal(b.requests.length, 0);
  await b.submit();
  assert.equal(b.requests.length, 1); assert.equal(b.requests[0].url, "/api/metar/SBGR");
  b.language(); await b.tick(3600000); assert.equal(b.requests.length, 1);
});

test("autocomplete skips S and sends one request for fast Santos", async () => {
  const b = await browser("airports");
  await b.type("S"); await b.tick(); assert.equal(b.requests.length, 0);
  for (const value of ["S", "Sa", "San", "Sant", "Santo", "Santos"]) await b.type(value);
  await b.tick(299); assert.equal(b.requests.length, 0);
  await b.tick(1); assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].url, "/api/aeroportos/sugestoes?q=SANTOS");
});

test("slow autocomplete sends at most one request per eligible pause", async () => {
  const b = await browser("airports");
  for (const value of ["S", "Sa", "San", "Sant", "Santo", "Santos"]) { await b.type(value); await b.tick(); }
  assert.equal(b.requests.length, 5);
  await b.type("12"); await b.tick(); assert.equal(b.requests.length, 5);
  await b.type("a".repeat(101)); await b.tick(); assert.equal(b.requests.length, 5);
});

test("Enter cancels debounce and concurrent Enter events share one UI operation", async () => {
  const pending = deferred(); const b = await browser("airports", () => pending.promise);
  await b.type(" Santos "); b.enter(); b.enter(); b.enter();
  await b.tick(); assert.equal(b.requests.length, 1); assert.equal(b.timers.size, 0);
  assert.equal(b.requests[0].url, "/api/aeroportos/search?q=SANTOS");
  pending.resolve(success({ success: true, results: [] })); await flush();
  await b.submit(); assert.equal(b.requests.length, 2);
});

test("airport error releases guard without a fake provider fallback", async () => {
  const b = await browser("airports", async () => ({ ok: false, status: 503 }));
  await b.type("SBGR"); await b.submit(); await b.tick();
  assert.equal(b.requests.length, 1); assert.ok(!b.requests[0].url.includes("provider="));
  assert.equal(b.elements.get("errorState").classList.contains("hidden"), false);
  await b.submit(); assert.equal(b.requests.length, 2);
});

test("selecting a suggestion cancels a newer pending timer", async () => {
  const b = await browser("airports", url => success(url.includes("sugestoes") ? { success: true, suggestions: [airport] } : { success: true, result: airport }));
  await b.type("SB"); await b.tick();
  const option = b.elements.get("airportSuggestionsList").children[0];
  await b.type("SBG");
  await option.fire("click"); await b.tick();
  assert.deepEqual(b.requests.map(x => x.url), ["/api/aeroportos/sugestoes?q=SB", "/api/aeroportos/1"]);
});

test("a superseded suggestion response cannot overwrite current results even if fetch ignores abort", async () => {
  const pending = deferred();
  const b = await browser("airports", url => url.includes("sugestoes") ? pending.promise : success({ success: true, results: [] }));
  await b.type("SB"); await b.tick();
  await b.type("SBGR"); await b.submit();
  assert.equal(b.requests[0].options.signal.aborted, true);
  pending.resolve(success({ success: true, suggestions: [airport] })); await flush();
  assert.equal(b.elements.has("airportSuggestionsList"), false);
});

test("input changes invalidate an older full-search response", async () => {
  const pending = deferred(); const b = await browser("airports", () => pending.promise);
  await b.type("SBGR"); const search = b.submit(); await b.type("KJFK");
  pending.resolve(success({ success: true, results: [airport] })); await search;
  assert.equal(b.elements.get("resultsContainer").children.length, 0);
  assert.equal(b.elements.get("resultsContainer").innerHTML, "");
});

test("restoring local METAR and airport state does not fetch", async () => {
  const now = Date.now();
  const metar = await browser("metar", null, { "decmet.metarQuery.lastResult": JSON.stringify({ icao: "SBGR", savedAt: now, response: { success: true, data: { icao: "SBGR", rawMetar: "SBGR 121200Z CAVOK" } } }) });
  const airports = await browser("airports", null, { "decmet.airportSearch.lastQuery": JSON.stringify({ query: "SBGR", savedAt: now, results: [airport] }) });
  assert.equal(metar.requests.length + airports.requests.length, 0);
});
