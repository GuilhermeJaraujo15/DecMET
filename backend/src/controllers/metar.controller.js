import { AviationWeatherError, getLatestMetarByIcao } from "../services/aviationWeather.service.js";
import { RedemetApiError, getLatestRedemetMetarByIcao } from "../services/redemet.service.js";
import { cachePublicResponse, disableResponseCache } from "../utils/http-cache.js";

import { POLICY } from "../config/policy.js";
import { isBrazilianIcao } from "../../../public/js/shared/api-contract.js";
import { guardedProvider } from "../utils/provider-guard.js";
import { validateQuery } from "../utils/query-contract.js";

const ICAO_PATTERN = /^[A-Z]{4}$/;
const DEFAULT_METAR_CACHE_TTL_SECONDS = POLICY.metarTtl;
const MAX_CDN_TTL_SECONDS = POLICY.metarCdnTtl;
// vercel.json allows 15 s: reserve 3 s for runtime/serialization overhead.
const METAR_DEADLINE_MS = POLICY.deadlineMs;
const NOAA_RESERVED_MS = POLICY.noaaReserveMs;
const MIN_PROVIDER_BUDGET_MS = POLICY.minProviderBudgetMs;
const MAX_CACHE_ENTRIES = POLICY.maxCacheEntries;
const STALE_CACHE_GRACE_MS = POLICY.staleGraceMs;
const STALE_CACHE_ERROR_CODES = new Set([
  "NOAA_CIRCUIT_OPEN",
  "REDEMET_CIRCUIT_OPEN",
  "NOAA_RATE_LIMIT",
  "NOAA_SERVER_ERROR",
  "NOAA_BAD_GATEWAY",
  "NOAA_UNAVAILABLE",
  "NOAA_GATEWAY_TIMEOUT",
  "NOAA_TIMEOUT",
  "NOAA_NETWORK_ERROR",
  "NOAA_UNEXPECTED_RESPONSE",
  "NOAA_INVALID_RESPONSE",
  "REDEMET_RATE_LIMIT",
  "REDEMET_SERVER_ERROR",
  "REDEMET_BAD_GATEWAY",
  "REDEMET_UNAVAILABLE",
  "REDEMET_GATEWAY_TIMEOUT",
  "REDEMET_TIMEOUT",
  "REDEMET_NETWORK_ERROR",
  "REDEMET_UNEXPECTED_STATUS",
  "REDEMET_INVALID_RESPONSE",
  "REDEMET_UNEXPECTED_RESPONSE"
]);
const metarCache = new Map();
// Per instance only: reduces upstream work, not Function Invocations.
const inFlightRequests = new Map();
const failures = new Map();

export async function getLatestMetar(req, res) {
  const startedAt = Date.now();
  disableResponseCache(res);
  if (!validateQuery(req, res)) return;
  const icao = normalizeIcao(req.params.icao);

  if (!ICAO_PATTERN.test(icao)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ICAO",
      message: "Código ICAO inválido."
    });
  }

  const ttlSeconds = getMetarCacheTtlSeconds();
  const cachedEntry = metarCache.get(icao);
  const now = Date.now();

  res.locals ||= {};
  if (isCacheFresh(cachedEntry, now)) {
    Object.assign(res.locals, { cache: "HIT", provider: cachedEntry.providerResult.provider, fallback: Boolean(cachedEntry.providerResult.fallback) });
    cacheMetarResponse(res, cachedEntry);
    return res.json(buildSuccessResponse(
      cachedEntry.data,
      {
        hit: true,
        ttlSeconds
      },
      cachedEntry.providerResult
    ));
  }

  try {
    const failure = failures.get(icao);
    if (failure?.expiresAt > now) {
      res.locals.cache = failure.error.code === "NO_METAR_FOUND" ? "NEGATIVE_HIT" : "COOLDOWN";
      throw failure.error;
    }
    failures.delete(icao);
    res.locals.cache = inFlightRequests.has(icao) ? "SHARED" : "MISS";
    const entry = await fetchAndCacheMetar(icao, ttlSeconds, startedAt + METAR_DEADLINE_MS);
    const metarResult = entry.providerResult;
    Object.assign(res.locals, { provider: metarResult.provider, fallback: Boolean(metarResult.fallback) });
    cacheMetarResponse(res, entry);

    return res.json(buildSuccessResponse(
      metarResult.data,
      {
        hit: false,
        ttlSeconds
      },
      metarResult
    ));
  } catch (error) {
    disableResponseCache(res);
    if (error instanceof AviationWeatherError || error instanceof RedemetApiError) {
      Object.assign(res.locals, { code: error.code, provider: getProviderFromErrorCode(error.code), fallback: Boolean(error.fallback) });

      if (canUseStaleCache(cachedEntry, error, Date.now())) {
        res.locals.cache = "STALE";
        return res.json(buildSuccessResponse(
          cachedEntry.data,
          {
            hit: true,
            ttlSeconds,
            stale: true,
            warning: getStaleWarning(error)
          },
          cachedEntry.providerResult
        ));
      }

      res.status(error.status);
      if (error.code === "NO_METAR_FOUND") {
        const remaining = Math.floor(((failures.get(icao)?.expiresAt || 0) - Date.now()) / 1000);
        cachePublicResponse(res, remaining, { negative: true });
      }
      return res.json({
        success: false,
        code: error.code,
        provider: getProviderFromErrorCode(error.code),
        ...(error.fallback ? { fallback: error.fallback } : {}),
        message: error.message
      });
    }

    res.locals.code = "METAR_INTERNAL_ERROR";
    return res.status(500).json({
      success: false,
      code: "METAR_INTERNAL_ERROR",
      message: "Não foi possível consultar o METAR no momento."
    });
  }
}

function fetchAndCacheMetar(icao, ttlSeconds, deadline) {
  if (inFlightRequests.has(icao)) return inFlightRequests.get(icao);

  if (inFlightRequests.size >= POLICY.maxInFlight) {
    throw new AviationWeatherError("NOAA_UNAVAILABLE", "Serviço temporariamente ocupado.", 503);
  }
  const pending = (async () => {
    const result = await getLatestMetarWithProviderRouting(icao, deadline);
    if (Date.now() >= deadline) {
      const timeout = result.provider === "REDEMET"
        ? new RedemetApiError("REDEMET_TIMEOUT", "A consulta à REDEMET excedeu o tempo limite.", 504)
        : createNoaaDeadlineError();
      if (result.fallback) timeout.fallback = result.fallback;
      throw timeout;
    }
    const fetchedAt = Date.now();
    const entry = {
      data: result.data,
      providerResult: result,
      fetchedAt,
      expiresAt: fetchedAt + ttlSeconds * 1000
    };
    // Keep expired entries through the existing stale grace window.
    for (const [key, cached] of metarCache) {
      if (cached.expiresAt + STALE_CACHE_GRACE_MS < fetchedAt) metarCache.delete(key);
    }
    metarCache.delete(icao);
    while (metarCache.size >= MAX_CACHE_ENTRIES) {
      metarCache.delete(metarCache.keys().next().value);
    }
    metarCache.set(icao, entry);
    return entry;
  })();
  const shared = pending.catch(error => {
    if (error instanceof AviationWeatherError || error instanceof RedemetApiError) {
      const negative = error.code === "NO_METAR_FOUND" && error.status === 404;
      // Transient failure cooldown is NOT a negative result and never enters CDN cache.
      failures.delete(icao);
      for (const [key, entry] of failures) if (entry.expiresAt <= Date.now()) failures.delete(key);
      while (failures.size >= MAX_CACHE_ENTRIES) failures.delete(failures.keys().next().value);
      failures.set(icao, { error, expiresAt: Date.now() + (negative ? POLICY.negativeTtl * 1000 : POLICY.failureCooldownMs) });
      if (negative) metarCache.delete(icao);
    }
    throw error;
  }).finally(() => {
    inFlightRequests.delete(icao);
  });
  inFlightRequests.set(icao, shared);
  return shared;
}

function cacheMetarResponse(res, entry) {
  const remainingSeconds = Math.floor((entry.expiresAt - Date.now()) / 1000);
  const ttl = Math.min(MAX_CDN_TTL_SECONDS, remainingSeconds);
  cachePublicResponse(res, ttl, { swr: Math.min(POLICY.metarSwr, Math.max(0, remainingSeconds - ttl)) });
}

async function getLatestMetarWithProviderRouting(icao, deadline) {
  if (!isBrazilianIcao(icao)) {
    const data = await getNoaaWithinDeadline(icao, deadline);
    return {
      data,
      source: "NOAA AviationWeather",
      provider: "NOAA"
    };
  }

  try {
    const data = await guardedProvider("REDEMET", icao,
      () => getLatestRedemetMetarByIcao(icao, { deadline: deadline - NOAA_RESERVED_MS }),
      () => new RedemetApiError("REDEMET_CIRCUIT_OPEN", "REDEMET temporariamente indisponível.", 503));
    return {
      data,
      source: "REDEMET",
      provider: "REDEMET"
    };
  } catch (redemetError) {
    let data;

    try {
      data = await getNoaaWithinDeadline(icao, deadline);
    } catch (noaaError) {
      noaaError.fallback = {
        from: "REDEMET",
        to: "NOAA",
        code: redemetError.code || "REDEMET_UNKNOWN_ERROR",
        status: redemetError.status || 502
      };
      throw noaaError;
    }

    return {
      data,
      source: "NOAA AviationWeather",
      provider: "NOAA",
      fallback: {
        from: "REDEMET",
        to: "NOAA",
        code: redemetError.code || "REDEMET_UNKNOWN_ERROR",
        status: redemetError.status || 502
      }
    };
  }
}

function createNoaaDeadlineError() {
  return new AviationWeatherError(
    "NOAA_TIMEOUT",
    "A consulta ao serviço meteorológico excedeu o tempo limite. Tente novamente em instantes.",
    504
  );
}

function getNoaaWithinDeadline(icao, deadline) {
  if (deadline - Date.now() < MIN_PROVIDER_BUDGET_MS) throw createNoaaDeadlineError();
  return guardedProvider("NOAA", icao, () => getLatestMetarByIcao(icao, { deadline }),
    () => new AviationWeatherError("NOAA_CIRCUIT_OPEN", "Serviço temporariamente indisponível.", 503));
}

function normalizeIcao(value) {
  return String(value ?? "").trim().toUpperCase();
}

function getProviderFromErrorCode(code) {
  return String(code || "").startsWith("REDEMET") ? "REDEMET" : "NOAA";
}

function getMetarCacheTtlSeconds() {
  const parsed = Number(process.env.METAR_CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, DEFAULT_METAR_CACHE_TTL_SECONDS)
    : DEFAULT_METAR_CACHE_TTL_SECONDS;
}

function isCacheFresh(entry, now) {
  return Boolean(entry && entry.expiresAt > now);
}

function canUseStaleCache(entry, error, now) {
  if (!entry || !entry.expiresAt || !entry.data) {
    return false;
  }

  return STALE_CACHE_ERROR_CODES.has(error.code) &&
    now >= entry.expiresAt &&
    now <= entry.expiresAt + STALE_CACHE_GRACE_MS;
}

function buildSuccessResponse(data, cache, providerResult = {}) {
  return {
    success: true,
    source: providerResult.source || "NOAA AviationWeather",
    provider: providerResult.provider || "NOAA",
    data,
    cache,
    ...(providerResult.fallback ? { fallback: providerResult.fallback } : {})
  };
}

function getStaleWarning(error) {
  if (error.code === "NOAA_RATE_LIMIT") {
    return "NOAA AviationWeather rate limit reached. Returning recently cached METAR data.";
  }

  return "METAR service is temporarily unavailable. Returning recently cached METAR data.";
}
