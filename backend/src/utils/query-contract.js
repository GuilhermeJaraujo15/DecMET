export function validateQuery(req, res, allowed = []) {
  const query = req.query || {};
  const keys = Object.keys(query);
  // Rewrites use unnamed captures so Vercel does not inject path parameters here.
  const valid = keys.every(key => typeof query[key] === "string" &&
    allowed.includes(key));
  if (valid && !(keys.includes("q") && keys.includes("search"))) return true;
  res.locals ||= {};
  res.locals.code = "INVALID_QUERY";
  res.status(400).json({ success: false, error: "INVALID_QUERY", message: "Parâmetros de consulta inválidos." });
  return false;
}
