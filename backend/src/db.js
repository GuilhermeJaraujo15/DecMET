import mysql from "mysql2/promise";
import "./config/env.js";

const DEFAULT_CONNECTION_LIMIT = 2;
const DEFAULT_MAX_IDLE = 1;
const DEFAULT_IDLE_TIMEOUT_MS = 5000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DB_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "HANDSHAKE_SSL_ERROR"
]);

let pool;

export class DatabaseUnavailableError extends Error {
  constructor(cause) {
    super("Database service is unavailable");
    this.name = "DatabaseUnavailableError";
    this.status = 503;
    this.publicCode = "SERVICE_UNAVAILABLE";
    this.publicMessage = "Serviço temporariamente indisponível.";
    this.cause = cause;
  }
}

export function getDatabasePool() {
  if (!pool) {
    pool = mysql.createPool(buildPoolConfig());
  }

  return pool;
}

export async function closeDatabasePool() {
  const activePool = pool;
  pool = undefined;

  if (activePool) {
    try {
      await activePool.end();
    } catch {
      // Ignore close failures; the original connection error is more useful.
    }
  }
}

export async function getDatabaseConnection() {
  try {
    return await getDatabasePool().getConnection();
  } catch (error) {
    await closeDatabasePool();
    throw new DatabaseUnavailableError(error);
  }
}

export function getPublicDatabaseError(error) {
  if (isDatabaseUnavailableError(error) || isTransientDatabaseError(error)) {
    return {
      status: 503,
      error: "SERVICE_UNAVAILABLE",
      message: "Serviço temporariamente indisponível."
    };
  }

  return {
    status: 500,
    error: "DATABASE_ERROR",
    message: "Não foi possível consultar os dados no momento."
  };
}

export function isDatabaseUnavailableError(error) {
  return error instanceof DatabaseUnavailableError;
}

export function isTransientDatabaseError(error) {
  return DB_UNAVAILABLE_CODES.has(error?.code);
}

export function logDatabaseError(context, error) {
  const cause = error?.cause || error;

  console.error("Database error:", {
    context,
    code: cause?.code,
    errno: cause?.errno,
    sqlState: cause?.sqlState,
    name: cause?.name
  });
}

function buildPoolConfig() {
  const useSsl = process.env.DB_SSL === "true";

  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: getIntegerEnv("DB_PORT", 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: getIntegerEnv("DB_CONNECTION_LIMIT", DEFAULT_CONNECTION_LIMIT),
    maxIdle: getIntegerEnv("DB_MAX_IDLE", DEFAULT_MAX_IDLE),
    idleTimeout: getIntegerEnv("DB_IDLE_TIMEOUT", DEFAULT_IDLE_TIMEOUT_MS),
    queueLimit: getIntegerEnv("DB_QUEUE_LIMIT", 0),
    connectTimeout: getIntegerEnv("DB_CONNECT_TIMEOUT", DEFAULT_CONNECT_TIMEOUT_MS),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: useSsl
      ? {
          rejectUnauthorized: false
        }
      : undefined
  };
}

function getIntegerEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export default getDatabasePool;
