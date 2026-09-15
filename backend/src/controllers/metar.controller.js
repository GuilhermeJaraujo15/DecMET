import { AviationWeatherError, getLatestMetarByIcao } from "../services/aviationWeather.service.js";
import { RedemetApiError, getLatestRedemetMetarByIcao } from "../services/redemet.service.js";
import { cachePublicResponse, disableResponseCache } from "../utils/http-cache.js";

const ICAO_PATTERN = /^[A-Z]{4}$/;
const DEFAULT_METAR_CACHE_TTL_SECONDS = 60;
const MAX_CDN_TTL_SECONDS = 30;
// vercel.json allows 15 s: reserve 3 s for runtime/serialization overhead.
const METAR_DEADLINE_MS = 12000;
const NOAA_RESERVED_MS = 3000;
const MIN_PROVIDER_BUDGET_MS = 500;
const MAX_CACHE_ENTRIES = 1000;
const STALE_CACHE_GRACE_MS = 5 * 60 * 1000;
const STALE_CACHE_ERROR_CODES = new Set([
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

export async function getLatestMetar(req, res) {
  const startedAt = Date.now();
  disableResponseCache(res);
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

  if (isCacheFresh(cachedEntry, now)) {
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
    const entry = await fetchAndCacheMetar(icao, ttlSeconds, startedAt + METAR_DEADLINE_MS);
    const metarResult = entry.providerResult;
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
      console.error("METAR provider error:", {
        icao,
        code: error.code,
        status: error.status,
        message: error.message
      });

      if (canUseStaleCache(cachedEntry, error, Date.now())) {
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

      return res.status(error.status).json({
        success: false,
        code: error.code,
        provider: getProviderFromErrorCode(error.code),
        ...(error.fallback ? { fallback: error.fallback } : {}),
        message: error.message
      });
    }

    console.error("Unexpected METAR controller error:", error);
    return res.status(500).json({
      success: false,
      code: "METAR_INTERNAL_ERROR",
      message: "Não foi possível consultar o METAR no momento."
    });
  }
}

function fetchAndCacheMetar(icao, ttlSeconds, deadline) {
  if (inFlightRequests.has(icao)) return inFlightRequests.get(icao);

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
  const shared = pending.finally(() => {
    inFlightRequests.delete(icao);
  });
  inFlightRequests.set(icao, shared);
  return shared;
}

function cacheMetarResponse(res, entry) {
  const remainingSeconds = Math.floor((entry.expiresAt - Date.now()) / 1000);
  cachePublicResponse(res, Math.min(MAX_CDN_TTL_SECONDS, remainingSeconds));
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
    const data = await getLatestRedemetMetarByIcao(icao, { deadline: deadline - NOAA_RESERVED_MS });
    return {
      data,
      source: "REDEMET",
      provider: "REDEMET"
    };
  } catch (redemetError) {
    console.error("REDEMET METAR error. Falling back to NOAA:", {
      icao,
      code: redemetError.code,
      status: redemetError.status,
      message: redemetError.message
    });

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
  return getLatestMetarByIcao(icao, { deadline });
}

function normalizeIcao(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isBrazilianIcao(icao) {
  return icao.startsWith("S");
}

function getProviderFromErrorCode(code) {
  return String(code || "").startsWith("REDEMET") ? "REDEMET" : "NOAA";
}

function getMetarCacheTtlSeconds() {
  const parsed = Number(process.env.METAR_CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
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
    now > entry.expiresAt &&
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
