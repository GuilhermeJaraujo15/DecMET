export const POLICY = Object.freeze({
  metarTtl: 60, metarCdnTtl: 30, metarSwr: 15,
  staleGraceMs: 300000, negativeTtl: 20, failureCooldownMs: 15000,
  providerFailureThreshold: 3, providerCooldownMs: 30000,
  maxCacheEntries: 1000, maxInFlight: 100,
  deadlineMs: 12000, noaaReserveMs: 3000, minProviderBudgetMs: 500,
  airportSearchTtl: 300, airportDetailTtl: 3600, healthTtl: 15,
  maxResponseBytes: 1024 * 1024
});
