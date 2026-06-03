import http from "http";
import https from "https";

const DEFAULT_BASE_URL = "https://aviationweather.gov/api/data";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_USER_AGENT = "DecMET/1.0";

const STATUS_ERROR_MAP = {
  400: {
    code: "NOAA_BAD_REQUEST",
    status: 502,
    message: "A consulta ao serviço meteorológico foi recusada pelo provedor externo."
  },
  404: {
    code: "NOAA_ENDPOINT_NOT_FOUND",
    status: 502,
    message: "O endpoint do serviço meteorológico não foi encontrado."
  },
  429: {
    code: "NOAA_RATE_LIMIT",
    status: 429,
    message: "NOAA AviationWeather rate limit reached. Please try again shortly."
  },
  500: {
    code: "NOAA_SERVER_ERROR",
    status: 502,
    message: "O serviço meteorológico retornou um erro temporário. Tente novamente mais tarde."
  },
  502: {
    code: "NOAA_BAD_GATEWAY",
    status: 502,
    message: "O serviço meteorológico retornou uma resposta temporariamente inválida."
  },
  503: {
    code: "NOAA_UNAVAILABLE",
    status: 503,
    message: "METAR service is temporarily unavailable. Please try again later."
  },
  504: {
    code: "NOAA_GATEWAY_TIMEOUT",
    status: 504,
    message: "O serviço meteorológico excedeu o tempo limite. Tente novamente em instantes."
  }
};

export class AviationWeatherError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "AviationWeatherError";
    this.code = code;
    this.status = status;
  }
}

export async function getLatestMetarByIcao(icao) {
  const requestUrl = buildMetarUrl(icao);
  const response = await requestJson(requestUrl);

  if (response.statusCode === 204) {
    throw new AviationWeatherError(
      "NO_METAR_FOUND",
      "Nenhum METAR recente foi encontrado para este código ICAO.",
      404
    );
  }

  if (!isSuccessStatus(response.statusCode)) {
    throw mapStatusToError(response.statusCode);
  }

  const payload = parseJsonPayload(response.body);

  if (!Array.isArray(payload)) {
    throw new AviationWeatherError(
      "NOAA_UNEXPECTED_RESPONSE",
      "O serviço meteorológico retornou um formato inesperado.",
      502
    );
  }

  if (payload.length === 0) {
    throw new AviationWeatherError(
      "NO_METAR_FOUND",
      "Nenhum METAR recente foi encontrado para este código ICAO.",
      404
    );
  }

  return normalizeMetar(payload[0], icao);
}

function buildMetarUrl(icao) {
  const baseUrl = process.env.AVIATION_WEATHER_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL("metar", ensureTrailingSlash(baseUrl));

  url.search = new URLSearchParams({
    ids: icao,
    format: "json"
  }).toString();

  return url;
}

function ensureTrailingSlash(value) {
  return String(value).endsWith("/") ? String(value) : `${value}/`;
}

function requestJson(url) {
  const timeoutMs = getTimeoutMs();
  const client = url.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": getUserAgent()
      },
      timeout: timeoutMs
    }, response => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode,
          body
        });
      });
    });

    request.on("timeout", () => {
      request.destroy(new AviationWeatherError(
        "NOAA_TIMEOUT",
        "A consulta ao serviço meteorológico excedeu o tempo limite. Tente novamente em instantes.",
        504
      ));
    });

    request.on("error", error => {
      if (error instanceof AviationWeatherError) {
        reject(error);
        return;
      }

      reject(new AviationWeatherError(
        "NOAA_NETWORK_ERROR",
        "METAR service is temporarily unavailable. Please try again later.",
        502
      ));
    });

    request.end();
  });
}

function getUserAgent() {
  const configuredUserAgent = process.env.AVIATION_WEATHER_USER_AGENT || process.env.NOAA_USER_AGENT;
  const normalizedUserAgent = String(configuredUserAgent ?? "").trim();

  return normalizedUserAgent || DEFAULT_USER_AGENT;
}

function getTimeoutMs() {
  const parsed = Number(process.env.NOAA_REQUEST_TIMEOUT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isSuccessStatus(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

function mapStatusToError(statusCode) {
  const mapped = STATUS_ERROR_MAP[statusCode] || {
    code: "NOAA_UNEXPECTED_RESPONSE",
    status: 502,
    message: "O serviço meteorológico retornou uma resposta inesperada."
  };

  return new AviationWeatherError(mapped.code, mapped.message, mapped.status);
}

function parseJsonPayload(body) {
  try {
    return JSON.parse(body || "[]");
  } catch (error) {
    throw new AviationWeatherError(
      "NOAA_INVALID_RESPONSE",
      "O serviço meteorológico retornou dados inválidos.",
      502
    );
  }
}

function normalizeMetar(report, fallbackIcao) {
  const rawMetar = getFirstTextValue(report, ["rawOb", "raw_ob", "rawMetar", "metar"]);

  if (!rawMetar) {
    throw new AviationWeatherError(
      "NOAA_UNEXPECTED_RESPONSE",
      "O serviço meteorológico não retornou o METAR bruto.",
      502
    );
  }

  return {
    icao: getFirstTextValue(report, ["icaoId", "stationId", "id"]) || fallbackIcao,
    rawMetar,
    reportTime: getFirstTextValue(report, ["reportTime", "obsTime", "observationTime"]),
    stationName: getFirstTextValue(report, ["name", "stationName"]),
    flightCategory: getFirstTextValue(report, ["flightCategory", "fltCat"])
  };
}

function getFirstTextValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}
