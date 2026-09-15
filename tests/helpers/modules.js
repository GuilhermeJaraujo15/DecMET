import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const quietConsole = { log() {}, warn() {}, error() {} };

// Real source, isolated module state. Never load .env or contact a real database.
export async function loadModule(entry, { mocks = {}, globals = {} } = {}) {
  const context = vm.createContext({
    console: quietConsole, process: { env: {} }, URL, URLSearchParams,
    Buffer, setTimeout, clearTimeout, ...globals
  });
  const modules = new Map();
  const replacements = { "backend/src/config/env.js": {}, ...mocks };
  async function getModule(name) {
    if (modules.has(name)) return modules.get(name);
    let mod;
    if (Object.hasOwn(replacements, name)) {
      const exports = replacements[name];
      mod = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context, identifier: name });
    } else if (name === "backend/src/db.js" && !Object.hasOwn(replacements, "mysql2/promise")) {
      throw new Error("Database must be explicitly mocked in tests");
    } else if (!name.endsWith(".js") || name.startsWith("node:")) {
      const exports = await import(name);
      mod = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context, identifier: name });
    } else {
      mod = new vm.SourceTextModule(await fs.readFile(path.join(root, name), "utf8"), {
        context, identifier: name
      });
    }
    modules.set(name, mod);
    return mod;
  }
  const mod = await getModule(entry);
  await mod.link((specifier, parent) => getModule(specifier.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), specifier))
    : specifier));
  await mod.evaluate();
  return mod.namespace;
}

export function response() {
  return {
    statusCode: 200, headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = JSON.parse(JSON.stringify(data)); return this; }
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function fakeClock(start = 1000000) {
  let now = start;
  return {
    Date: class extends Date { static now() { return now; } },
    now: () => now,
    advance: ms => { now += ms; }
  };
}
