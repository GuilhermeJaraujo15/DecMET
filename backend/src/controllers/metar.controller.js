import { AviationWeatherError, getLatestMetarByIcao } from "../services/aviationWeather.service.js";

const ICAO_PATTERN = /^[A-Z]{4}$/;
const DEFAULT_METAR_CACHE_TTL_SECONDS = 60;
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
  "NOAA_INVALID_RESPONSE"
]);
const metarCache = new Map();

export async function getLatestMetar(req, res) {
  const icao = normalizeIcao(req.params.icao);

  if (!ICAO_PATTERN.test(icao)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ICAO",
      message: "Código ICAO inválido."
    });
  }

  const ttlSeconds = getMetarCacheTtlSeconds();
  const ttlMs = ttlSeconds * 1000;
  const cachedEntry = metarCache.get(icao);
  const now = Date.now();

  if (isCacheFresh(cachedEntry, now)) {
    return res.json(buildSuccessResponse(cachedEntry.data, {
      hit: true,
      ttlSeconds
    }));
  }

  try {
    const data = await getLatestMetarByIcao(icao);
    const fetchedAt = Date.now();
    metarCache.set(icao, {
      data,
      fetchedAt,
      expiresAt: fetchedAt + ttlMs
    });

    return res.json(buildSuccessResponse(data, {
      hit: false,
      ttlSeconds
    }));
  } catch (error) {
    if (error instanceof AviationWeatherError) {
      console.error("NOAA AviationWeather METAR error:", {
        icao,
        code: error.code,
        status: error.status,
        message: error.message
      });

      if (canUseStaleCache(cachedEntry, error, Date.now())) {
        return res.json(buildSuccessResponse(cachedEntry.data, {
          hit: true,
          ttlSeconds,
          stale: true,
          warning: getStaleWarning(error)
        }));
      }

      return res.status(error.status).json({
        success: false,
        code: error.code,
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

function normalizeIcao(value) {
  return String(value ?? "").trim().toUpperCase();
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

function buildSuccessResponse(data, cache) {
  return {
    success: true,
    source: "NOAA AviationWeather",
    data,
    cache
  };
}

function getStaleWarning(error) {
  if (error.code === "NOAA_RATE_LIMIT") {
    return "NOAA AviationWeather rate limit reached. Returning recently cached METAR data.";
  }

  return "METAR service is temporarily unavailable. Returning recently cached METAR data.";
}
