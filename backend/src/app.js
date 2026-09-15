import "./config/env.js";
import express from "express";
import cors from "cors";
import aeroportosRoutes from "./routes/aeroportos.routes.js";
import metarRoutes from "./routes/metar.routes.js";
import { disableResponseCache } from "./utils/http-cache.js";

const LOCAL_PORTS = new Set(["3000", "3001", "5173", "5500"]);
const PRODUCTION_ORIGINS = ["https://decmet.com.br"];

export function createApiApp() {
  const app = express();

  configureApiApp(app);
  installApiFinalHandlers(app);

  return app;
}

export function configureApiApp(app) {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    disableResponseCache(res);
    next();
  });
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/aeroportos", aeroportosRoutes);
  app.use("/api/metar", metarRoutes);

  return app;
}

export function installApiFinalHandlers(app, options = {}) {
  app.use((req, res) => {
    if (options.html404Path && req.accepts("html") && !req.path.startsWith("/api/")) {
      return res.status(404).sendFile(options.html404Path);
    }

    return res.status(404).json({
      success: false,
      error: "NOT_FOUND",
      message: "Endpoint não encontrado."
    });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    disableResponseCache(res);

    const status = getHttpStatus(err);
    const error = getPublicErrorCode(err, status);

    console.error("API error:", {
      path: req.originalUrl,
      method: req.method,
      status,
      error,
      code: err.code,
      name: err.name
    });

    return res.status(status).json({
      success: false,
      error,
      message: getPublicErrorMessage(err, status)
    });
  });

  return app;
}

function createCorsMiddleware() {
  return function corsForRequest(req, res, next) {
    return cors({
      origin: createOriginValidator(req),
      credentials: true,
      methods: ["GET", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      optionsSuccessStatus: 204
    })(req, res, next);
  };
}

function createOriginValidator(req) {
  return function validateOrigin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin) {
      return callback(createCorsError());
    }

    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.has(normalizedOrigin) || isSameOriginRequest(req, normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn("[CORS] Origin not allowed:", {
      origin: normalizedOrigin,
      host: getRequestHost(req),
      vercelEnv: process.env.VERCEL_ENV || null
    });

    return callback(createCorsError());
  };
}

function getAllowedOrigins() {
  const origins = new Set(getConfiguredOrigins());
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    PRODUCTION_ORIGINS.forEach(origin => origins.add(origin));
    return origins;
  }

  for (const port of LOCAL_PORTS) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  PRODUCTION_ORIGINS.forEach(origin => origins.add(origin));
  return origins;
}

function getConfiguredOrigins() {
  return String(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map(origin => normalizeOrigin(origin))
    .filter(Boolean);
}

function normalizeOrigin(origin) {
  try {
    const url = new URL(String(origin).trim());
    return url.origin;
  } catch (error) {
    return null;
  }
}

function isSameOriginRequest(req, origin) {
  const host = getRequestHost(req);
  if (!host) return false;

  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim()
    || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return origin === `${proto}://${host}`;
}

function getRequestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
}

function createCorsError() {
  const error = new Error("CORS origin not allowed");
  error.status = 403;
  error.publicCode = "CORS_ORIGIN_DENIED";
  error.publicMessage = "Origem não permitida.";
  return error;
}

function getHttpStatus(err) {
  const status = Number(err.status || err.statusCode);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function getPublicErrorCode(err, status) {
  if (err.publicCode) return err.publicCode;
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status === 403) return "FORBIDDEN";
  return "INTERNAL_SERVER_ERROR";
}

function getPublicErrorMessage(err, status) {
  if (err.publicMessage) return err.publicMessage;
  if (status === 503) return "Serviço temporariamente indisponível.";
  if (status === 403) return "Acesso não permitido.";
  return "Erro interno do servidor.";
}

export default createApiApp();
