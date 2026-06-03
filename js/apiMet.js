const ICAO_PATTERN = /^[A-Z]{4}$/;
const METAR_QUERY_STORAGE_KEY = "decmet.metarQuery.lastResult";
const METAR_QUERY_STORAGE_TTL_MS = 60 * 60 * 1000;

function t(key) {
  return window.DecMETI18n?.t(key) || key;
}

function safeSetDynamicMeta(titleKey, descriptionKey, variables = {}, fallbackTitle = "") {
  try {
    const seo = window.DecMETI18n;
    if (seo && typeof seo.setDynamicTitleAndDescription === "function") {
      seo.setDynamicTitleAndDescription(titleKey, descriptionKey, variables);
      return;
    }

    if (fallbackTitle) {
      document.title = fallbackTitle;
    }
  } catch (error) {
    console.warn("[DecMET SEO] Dynamic SEO update skipped:", error);
  }
}

function safeResetStaticMeta() {
  try {
    const seo = window.DecMETI18n;
    if (seo && typeof seo.resetToStaticMeta === "function") {
      seo.resetToStaticMeta();
    }
  } catch (error) {
    console.warn("[DecMET SEO] Static SEO reset skipped:", error);
  }
}

let form;
let icaoInput;
let submitButton;
let errorMessage;
let rawMetarPlaceholder;
let stationIdValue;
let obsTimeValue;
let sourceValue;
let flightCategoryValue;
let copyMetarButton;
let statePanels = {};

let currentRawMetar = "";
let currentErrorKey = null;

onDomReady(initMetarQueryPage);

function onDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }

  callback();
}

function initMetarQueryPage() {
  form = document.querySelector("#metarQueryForm");
  icaoInput = document.querySelector("#icaoInput");
  submitButton = document.querySelector("#metarSubmitButton");
  errorMessage = document.querySelector("#errorMessage");
  rawMetarPlaceholder = document.querySelector("#rawMetarPlaceholder");
  stationIdValue = document.querySelector("#stationIdValue");
  obsTimeValue = document.querySelector("#obsTimeValue");
  sourceValue = document.querySelector("#sourceValue");
  flightCategoryValue = document.querySelector("#flightCategoryValue");
  copyMetarButton = document.querySelector("#copyMetarButton");
  statePanels = {
    empty: document.querySelector("#emptyState"),
    loading: document.querySelector("#loadingState"),
    error: document.querySelector("#errorState"),
    result: document.querySelector("#resultState")
  };

  if (!hasRequiredDom()) {
    console.warn("[DecMET METAR] Required DOM elements were not found. Query UI was not initialized.");
    return;
  }

  form.addEventListener("submit", handleMetarSubmit);
  icaoInput.addEventListener("input", handleIcaoInput);
  copyMetarButton.addEventListener("click", handleCopyMetar);
  window.addEventListener("decmet:languagechange", handleLanguageChange);

  if (!restoreMetarQueryState()) {
    resetResult();
    errorMessage.textContent = t("metar.error.invalidIcao");
  }
}

function handleLanguageChange() {
  if (!currentRawMetar) {
    rawMetarPlaceholder.textContent = t("metar.result.empty");
  }

  if (currentErrorKey) {
    errorMessage.textContent = t(currentErrorKey);
  }

  if (!copyMetarButton.disabled) {
    copyMetarButton.textContent = t("metar.result.copy");
  }

  if (!submitButton.disabled) {
    submitButton.textContent = t("metar.query.button");
  }

  if (sourceValue.textContent === "Backend DecMET" || sourceValue.textContent === t("metar.result.defaultSource")) {
    sourceValue.textContent = t("metar.result.defaultSource");
  }
}

function hasRequiredDom() {
  return Boolean(
    form &&
    icaoInput &&
    submitButton &&
    errorMessage &&
    rawMetarPlaceholder &&
    stationIdValue &&
    obsTimeValue &&
    sourceValue &&
    flightCategoryValue &&
    copyMetarButton &&
    Object.values(statePanels).every(Boolean)
  );
}

function handleIcaoInput(event) {
  const normalizedValue = normalizeIcao(event.target.value);
  event.target.value = normalizedValue;

  if (!normalizedValue) {
    resetResult();
    showState("empty");
    clearMetarQueryState();
    safeResetStaticMeta();
  }
}

async function handleMetarSubmit(event) {
  event.preventDefault();

  const icao = normalizeIcao(icaoInput.value);
  icaoInput.value = icao;

  if (!isValidIcao(icao)) {
    showError("metar.error.invalidIcao");
    icaoInput.focus();
    return;
  }

  setLoading(true);

  try {
    showState("loading");
    resetResult();

    const response = await fetchMetarByIcao(icao);

    if (!response.success) {
      showError(getBackendErrorMessage(response));
      return;
    }

    renderMetarResult(response, { persist: true, icao });
    showState("result");
  } catch (error) {
    showError("metar.error.connection");
  } finally {
    setLoading(false);
  }
}

function normalizeIcao(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
}

function isValidIcao(icao) {
  return ICAO_PATTERN.test(icao);
}

function showError(messageKey) {
  currentErrorKey = messageKey;
  errorMessage.textContent = t(messageKey);
  showState("error");
  safeResetStaticMeta();
}

function showState(activeState) {
  Object.entries(statePanels).forEach(([state, panel]) => {
    panel.hidden = state !== activeState;
  });
}

async function fetchMetarByIcao(icao) {
  const response = await fetch(`/api/metar/${encodeURIComponent(icao)}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok && payload.success !== false) {
    throw new Error(`Backend error: ${response.status}`);
  }

  return payload;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error("Invalid backend response");
  }
}

function renderMetarResult(response, options = {}) {
  const data = response.data || {};
  const rawMetar = String(data.rawMetar || "").trim();

  if (!rawMetar) {
    showError("metar.error.noRaw");
    return;
  }

  currentErrorKey = null;
  currentRawMetar = rawMetar;
  rawMetarPlaceholder.textContent = rawMetar;
  stationIdValue.textContent = formatStationLabel(data);
  obsTimeValue.textContent = formatReportTime(data.reportTime);
  sourceValue.textContent = response.source || t("metar.result.defaultSource");
  flightCategoryValue.textContent = data.flightCategory || "--";
  copyMetarButton.disabled = false;

  // ========== SEO: TÍTULO E DESCRIÇÃO DINÂMICOS ==========
  const icao = (options.icao || data.icao || icaoInput.value).toUpperCase();
  const stationName = data.stationName || icao;

  // Extrair informações do METAR bruto para enriquecer a meta description
  let wind = 'não informado';
  let visibility = 'não informada';
  let temp = '--°C';

  // Tentar extrair vento (ex: 09003KT, 09003G15KT, 09003P50KT)
  const windMatch = rawMetar.match(/\b(\d{3}P?(\d{2,3})G?\d{0,2}KT)\b/);
  if (windMatch) wind = windMatch[1];

  // Tentar extrair visibilidade (ex: 5000, 9999)
  const visMatch = rawMetar.match(/\b(\d{4})\b/);
  if (visMatch) visibility = visMatch[1] + 'm';

  // Tentar extrair temperatura (ex: 12/12, M05/01)
  const tempMatch = rawMetar.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  if (tempMatch) temp = tempMatch[1] + '°C';

  safeSetDynamicMeta(
    "metar.dynamic.title",
    "metar.dynamic.description",
    { icao, stationName, wind, visibility, temp },
    `METAR ${icao} - ${stationName} | DecMET`
  );
  // =====================================================

  if (options.persist) {
    saveMetarQueryState({
      icao: options.icao || data.icao || icaoInput.value,
      response
    });
  }
}

function resetResult() {
  currentRawMetar = "";
  currentErrorKey = null;
  rawMetarPlaceholder.textContent = t("metar.result.empty");
  stationIdValue.textContent = "----";
  obsTimeValue.textContent = t("metar.result.defaultTime");
  sourceValue.textContent = t("metar.result.defaultSource");
  flightCategoryValue.textContent = "--";
  copyMetarButton.disabled = true;
  copyMetarButton.textContent = t("metar.result.copy");
  
  safeResetStaticMeta();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? t("metar.loading") : t("metar.query.button");
}

function getBackendErrorMessage(response) {
  if (response.code === "NO_METAR_FOUND") {
    return "metar.error.noRecent";
  }
  return response.message ? "metar.error.generic" : "metar.error.generic";
}

function formatReportTime(value) {
  if (!value) {
    return t("metar.result.defaultTime");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().replace(".000Z", "Z");
}

function formatStationLabel(data) {
  const icao = data.icao || "----";
  if (!data.stationName) {
    return icao;
  }
  return `${icao} - ${data.stationName}`;
}

async function handleCopyMetar() {
  if (!currentRawMetar) {
    return;
  }
  try {
    await navigator.clipboard.writeText(currentRawMetar);
    copyMetarButton.textContent = t("metar.copy.copied");
  } catch (error) {
    copyMetarButton.textContent = t("metar.copy.select");
  }
  window.setTimeout(() => {
    copyMetarButton.textContent = t("metar.result.copy");
  }, 1800);
}

function saveMetarQueryState(state) {
  const icao = normalizeIcao(state.icao);
  if (!isValidIcao(icao) || !state.response?.data?.rawMetar) {
    clearMetarQueryState();
    return;
  }
  const payload = {
    icao,
    response: state.response,
    savedAt: Date.now()
  };
  try {
    localStorage.setItem(METAR_QUERY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not persist METAR query state:", error);
  }
}

function restoreMetarQueryState() {
  const state = readMetarQueryState();
  if (!state) {
    return false;
  }
  icaoInput.value = state.icao;
  renderMetarResult(state.response);
  showState("result");
  return true;
}

function readMetarQueryState() {
  try {
    const rawState = localStorage.getItem(METAR_QUERY_STORAGE_KEY);
    if (!rawState) {
      return null;
    }
    const state = JSON.parse(rawState);
    const isExpired = !state.savedAt || Date.now() - state.savedAt > METAR_QUERY_STORAGE_TTL_MS;
    if (isExpired || !isValidIcao(normalizeIcao(state.icao)) || !state.response?.data?.rawMetar) {
      clearMetarQueryState();
      return null;
    }
    return {
      ...state,
      icao: normalizeIcao(state.icao)
    };
  } catch (error) {
    clearMetarQueryState();
    return null;
  }
}

function clearMetarQueryState() {
  try {
    localStorage.removeItem(METAR_QUERY_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear METAR query state:", error);
  }
}
