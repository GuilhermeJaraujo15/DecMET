import NodeCache from "node-cache";
import { AviationWeatherError, getLatestMetarByIcao } from "./aviationWeather.service.js";

const DEFAULT_FRESH_TTL_SECONDS = 15 * 60;
const DEFAULT_STALE_TTL_SECONDS = 45 * 60;
const cache = new NodeCache({ stdTTL: 0, checkperiod: 120, useClones: false });

export async function getMetarSwr(icao) {
  const key = `metar:${icao}`;
  const now = Date.now();
  const cached = cache.get(key);

  if (cached?.freshUntil > now) {
    return {
      data: cached.data,
      cache: {
        status: "fresh",
        fetchedAt: cached.fetchedAt,
        ttlSeconds: getFreshTtlSeconds()
      }
    };
  }

  if (cached?.staleUntil > now) {
    revalidateInBackground(key, icao, cached);

    return {
      data: cached.data,
      cache: {
        status: "stale",
        fetchedAt: cached.fetchedAt,
        ttlSeconds: getFreshTtlSeconds()
      }
    };
  }

  try {
    const data = await getLatestMetarByIcao(icao);
    const entry = setCache(key, data);

    return {
      data,
      cache: {
        status: "miss",
        fetchedAt: entry.fetchedAt,
        ttlSeconds: getFreshTtlSeconds()
      }
    };
  } catch (error) {
    if (cached?.data) {
      return {
        data: cached.data,
        cache: {
          status: "stale-error",
          fetchedAt: cached.fetchedAt,
          ttlSeconds: getFreshTtlSeconds()
        },
        error
      };
    }

    throw error;
  }
}

function setCache(key, data) {
  const now = Date.now();
  const entry = {
    data,
    fetchedAt: now,
    freshUntil: now + getFreshTtlSeconds() * 1000,
    staleUntil: now + getStaleTtlSeconds() * 1000,
    refreshing: false
  };

  cache.set(key, entry);
  return entry;
}

async function revalidateInBackground(key, icao, cached) {
  if (cached.refreshing) return;

  cache.set(key, { ...cached, refreshing: true });

  try {
    const data = await getLatestMetarByIcao(icao);
    setCache(key, data);
  } catch (error) {
    cache.set(key, { ...cached, refreshing: false });

    if (error instanceof AviationWeatherError) {
      console.warn("[METAR SWR] Background refresh failed:", {
        icao,
        code: error.code,
        status: error.status
      });
      return;
    }

    console.warn("[METAR SWR] Unexpected background refresh failure:", error);
  }
}

function getFreshTtlSeconds() {
  const parsed = Number(process.env.METAR_SSR_CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FRESH_TTL_SECONDS;
}

function getStaleTtlSeconds() {
  const parsed = Number(process.env.METAR_SSR_STALE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_TTL_SECONDS;
}
