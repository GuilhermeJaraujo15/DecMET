// Shared by browser and Node: no secrets or runtime dependencies.
export const AIRPORT_QUERY_MAX = 100;
export function normalizeAirportQuery(value) {
  if (typeof value !== "string" || value.length > AIRPORT_QUERY_MAX) return "";
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return normalized.length <= AIRPORT_QUERY_MAX ? normalized : "";
}
export function isSuggestionQueryEligible(value) {
  const query = normalizeAirportQuery(value);
  return /^[A-Z]{2}$/.test(query) || (query.length >= 3 && /[\p{L}\p{N}]/u.test(query));
}
export function isAirportSearchEligible(value) {
  const query = normalizeAirportQuery(value);
  return query.length >= 3 && /[\p{L}\p{N}]/u.test(query);
}
// DECEA AIC N45/2024: SB, SD, SI, SJ, SN, SS, SW.
// Preserve the existing four-letter METAR contract (not DECEA alphanumeric IDs).
export function isBrazilianIcao(icao) {
  return /^S[BDIJNSW][A-Z]{2}$/.test(String(icao).toUpperCase());
}
