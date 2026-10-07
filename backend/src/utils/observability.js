const fields = new Set(["event", "route", "method", "status", "cache", "provider", "fallback", "timeout", "durationMs", "code", "icao"]);
export function logEvent(event) {
  // Allowlist only: never serialize URLs, headers, upstream messages or Error objects.
  const safe = {};
  for (const [key, value] of Object.entries(event)) {
    if (fields.has(key) && ["string", "number", "boolean"].includes(typeof value)) {
      safe[key] = typeof value === "string" ? value.slice(0, 100) : value;
    }
  }
  console.log(JSON.stringify(safe));
}
export function observeApi(req, res, next) {
  const start = Date.now();
  res.on("finish", () => logEvent({
    event: "api_response", route: req.route ? `${req.baseUrl || ""}${req.route.path}` : "unmatched",
    method: req.method, status: res.statusCode, durationMs: Date.now() - start,
    cache: res.locals?.cache || "NONE", provider: res.locals?.provider,
    fallback: res.locals?.fallback, code: res.locals?.code
  }));
  next();
}
