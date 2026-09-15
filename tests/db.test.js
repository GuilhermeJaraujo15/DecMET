import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, deferred } from "./helpers/modules.js";

test("a failed acquisition from an old pool cannot close its replacement", async () => {
  const first = deferred(), second = deferred();
  let acquired = 0, created = 0, oldClosed = 0, newClosed = 0;
  const configurations = [];
  const connection = { release() {} };
  const oldPool = {
    getConnection: () => (++acquired === 1 ? first.promise : second.promise),
    end: async () => { oldClosed++; }
  };
  const newPool = { getConnection: async () => connection, end: async () => { newClosed++; } };
  const db = await loadModule("backend/src/db.js", { mocks: {
    "mysql2/promise": { default: { createPool(config) {
      configurations.push(config); return ++created === 1 ? oldPool : newPool;
    } } }
  } });
  const a = db.getDatabaseConnection(), b = db.getDatabaseConnection();
  const aRejected = assert.rejects(a, error => error instanceof db.DatabaseUnavailableError);
  first.reject(new Error("old acquisition failed"));
  await aRejected;
  assert.equal(oldClosed, 1);
  assert.equal(await db.getDatabaseConnection(), connection);
  const bRejected = assert.rejects(b, error => error instanceof db.DatabaseUnavailableError);
  second.reject(new Error("second old acquisition failed later"));
  await bRejected;
  assert.equal(db.getDatabasePool(), newPool);
  assert.equal(oldClosed, 1); assert.equal(newClosed, 0); assert.equal(created, 2);
  assert.equal(configurations[0].connectionLimit, 2);
  assert.equal(configurations[0].maxIdle, 1);
  assert.equal(configurations[0].idleTimeout, 5000);
  assert.equal(configurations[0].queueLimit, 0);
  assert.equal(configurations[0].connectTimeout, 10000);
  await db.closeDatabasePool(); assert.equal(newClosed, 1);
});
