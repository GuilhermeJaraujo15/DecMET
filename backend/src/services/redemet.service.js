import https from "https";
import { getFlightCategoryFromMetar } from "../utils/flight-category.js";

const DEFAULT_BASE_URL = "https://api-redemet.decea.mil.br";
const DEFAULT_TIMEOUT_MS = 10000;

const STATUS_ERROR_MAP = {
  401: {
    code: "REDEMET_UNAUTHORIZED",
    status: 502,
    message: "A autenticação com a REDEMET foi recusada."
  },
  403: {
    code: "REDEMET_FORBIDDEN",
    status: 502,
    message: "A chave da REDEMET não tem permissão para esta consulta."
  },
  404: {
    code: "REDEMET_NOT_FOUND",
    status: 404,
    message: "Nenhum METAR foi encontrado na REDEMET para este ICAO."
  },
  429: {
    code: "REDEMET_RATE_LIMIT",
    status: 429,
    message: "Limite de uso da REDEMET atingido. Tente novamente em instantes."
  },
  500: {
    code: "REDEMET_SERVER_ERROR",
    status: 502,
    message: "A REDEMET retornou erro temporário."
  },
  502: {
    code: "REDEMET_BAD_GATEWAY",
    status: 502,
    message: "A REDEMET retornou uma resposta temporariamente inválida."
  },
  503: {
    code: "REDEMET_UNAVAILABLE",
    status: 503,
    message: "A REDEMET está temporariamente indisponível."
  },
  504: {
    code: "REDEMET_GATEWAY_TIMEOUT",
    status: 504,
    message: "A consulta à REDEMET excedeu o tempo limite."
  }
};

export class RedemetApiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "RedemetApiError";
    this.code = code;
    this.status = status;
  }
}

export async function getLatestRedemetMetarByIcao(icao) {
  const apiKey = String(process.env.REDEMET_API_KEY ?? "").trim();

  if (!apiKey) {
    throw new RedemetApiError(
      "REDEMET_API_KEY_MISSING",
      "A chave da API REDEMET não foi configurada no servidor.",
      500
    );
  }

  const requestUrl = buildRedemetMetarUrl(icao);
  const response = await requestJson(requestUrl, apiKey);

  if (!isSuccessStatus(response.statusCode)) {
    throw mapStatusToError(response.statusCode);
  }

  const payload = parseJsonPayload(response.body);

  if (payload?.status === false) {
    throw new RedemetApiError(
      normalizeProviderCode(payload.message, "REDEMET_PROVIDER_ERROR"),
      "A REDEMET recusou ou não conseguiu processar a consulta.",
      502
    );
  }

  const reports = payload?.data?.data;

  if (!Array.isArray(reports) || reports.length === 0) {
    throw new RedemetApiError(
      "NO_METAR_FOUND",
      "Nenhum METAR recente foi encontrado na REDEMET para este ICAO.",
      404
    );
  }

  return normalizeRedemetMetar(findLatestReport(reports), icao);
}

function buildRedemetMetarUrl(icao) {
  const baseUrl = process.env.REDEMET_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(`mensagens/metar/${encodeURIComponent(icao)}`, ensureTrailingSlash(baseUrl));
  const { dataIni, dataFim } = getUtcQueryWindow();

  url.search = new URLSearchParams({
    data_ini: dataIni,
    data_fim: dataFim,
    page_tam: "10"
  }).toString();

  return url;
}

function getUtcQueryWindow() {
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    dataIni: formatRedemetDateHour(start),
    dataFim: formatRedemetDateHour(end)
  };
}

function formatRedemetDateHour(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");

  return `${year}${month}${day}${hour}`;
}

function ensureTrailingSlash(value) {
  return String(value).endsWith("/") ? String(value) : `${value}/`;
}

function requestJson(url, apiKey) {
  const timeoutMs = getTimeoutMs();

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey
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
      request.destroy(new RedemetApiError(
        "REDEMET_TIMEOUT",
        "A consulta à REDEMET excedeu o tempo limite.",
        504
      ));
    });

    request.on("error", error => {
      if (error instanceof RedemetApiError) {
        reject(error);
        return;
      }

      reject(new RedemetApiError(
        "REDEMET_NETWORK_ERROR",
        "Não foi possível conectar à REDEMET.",
        502
      ));
    });

    request.end();
  });
}

function getTimeoutMs() {
  const parsed = Number(process.env.REDEMET_REQUEST_TIMEOUT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isSuccessStatus(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

function mapStatusToError(statusCode) {
  const mapped = STATUS_ERROR_MAP[statusCode] || {
    code: "REDEMET_UNEXPECTED_STATUS",
    status: 502,
    message: "A REDEMET retornou uma resposta inesperada."
  };

  return new RedemetApiError(mapped.code, mapped.message, mapped.status);
}

function parseJsonPayload(body) {
  try {
    return JSON.parse(body || "{}");
  } catch (error) {
    throw new RedemetApiError(
      "REDEMET_INVALID_RESPONSE",
      "A REDEMET retornou dados inválidos.",
      502
    );
  }
}

function normalizeProviderCode(value, fallback) {
  const text = String(value ?? "").trim();
  return text ? `REDEMET_${text}` : fallback;
}

function findLatestReport(reports) {
  return [...reports].sort((a, b) => {
    const dateA = Date.parse(a?.validade_inicial || a?.recebimento || "");
    const dateB = Date.parse(b?.validade_inicial || b?.recebimento || "");
    return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA);
  })[0];
}

function normalizeRedemetMetar(report, fallbackIcao) {
  const rawMetar = String(report?.mens ?? "").trim().replace(/=$/, "");

  if (!rawMetar) {
    throw new RedemetApiError(
      "REDEMET_UNEXPECTED_RESPONSE",
      "A REDEMET não retornou o METAR bruto.",
      502
    );
  }

  return {
    icao: String(report?.id_localidade || fallbackIcao).trim().toUpperCase(),
    rawMetar,
    reportTime: report?.validade_inicial || report?.recebimento || null,
    stationName: null,
    flightCategory: getFlightCategoryFromMetar(rawMetar)
  };
}
