/**
 * DecMeT - Localizador de Aeródromos (aerodromo.js)
 * Script de controle e visualização para busca de aeródromos e códigos ICAO.
 * Integração com backend API para consulta de dados em tempo real.
 */

const API_ENDPOINTS = {
  search: "/api/aeroportos/search",
  suggestions: "/api/aeroportos/sugestoes",
  airportById: "/api/aeroportos"
};

const AUTOCOMPLETE_DEBOUNCE_MS = 300;
const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_MIN_CHARS_TEXT = 3;
const AIRPORT_SEARCH_STORAGE_KEY = "decmet.airportSearch.lastQuery";
const AIRPORT_SEARCH_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

const OPERATIONAL_TYPE_LABELS = {
  "large_airport": "airports.type.airplane",
  "medium_airport": "airports.type.airplane",
  "small_airport": "airports.type.airplane",
  "heliport": "airports.type.heliport",
  "seaplane_base": "airports.type.seaplane",
  "balloonport": "airports.type.balloonport",
  "closed_airport": "airports.type.closed"
};

function t(key) {
  return window.DecMETI18n?.t(key) || key;
}

function buildApiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTextValue(value, fallback = t("airports.value.notInformed")) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getAirportSearchLabel(airport) {
  return getTextValue(airport.display_icao || airport.ident || airport.name, "");
}

function getOperationalTypeLabel(airport) {
  const labelKey = OPERATIONAL_TYPE_LABELS[airport.type];
  return labelKey ? t(labelKey) : airport.operation_type_label || t("airports.type.airport");
}

function formatCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return t("airports.value.notInformed");
  }
  return number.toFixed(6);
}

function formatElevation(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return t("airports.value.notInformed");
  }
  return `${Math.round(number)} ft`;
}

// DOM Elements
const searchForm = document.getElementById("airportSearchForm");
const searchQueryInput = document.getElementById("airportQuery");
const resultsContainer = document.getElementById("resultsContainer");

const statusMessage = document.getElementById("statusMessage");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const noResultsState = document.getElementById("noResultsState");
const errorState = document.getElementById("errorState");

// State management
let debounceTimer = null;
let currentAbortController = null;
let lastSelectedIndex = -1;
let currentRenderedResults = null;
let currentErrorKey = null;

// Initialize
initAirportSearch();

/**
 * Initialize airport search functionality
 */
function initAirportSearch() {
  if (!searchForm || !searchQueryInput || !resultsContainer) {
    console.error("Missing required DOM elements for airport search");
    return;
  }

  searchForm.addEventListener("submit", handleAirportSearch);
  searchQueryInput.addEventListener("input", handleAirportInput);
  searchQueryInput.addEventListener("keydown", handleSuggestionsKeyboard);
  document.addEventListener("click", handleClickOutside);
  window.addEventListener("decmet:languagechange", handleLanguageChange);

  restoreAirportSearchState();
}

function handleLanguageChange() {
  if (currentRenderedResults) {
    renderAirportResults(currentRenderedResults.results, {
      query: currentRenderedResults.query,
      persist: false
    });
  }
  if (currentErrorKey) {
    errorState.textContent = t(currentErrorKey);
  }
}

/**
 * Handle input changes for autocomplete suggestions
 */
function handleAirportInput(event) {
  const query = event.target.value.trim();

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (!query) {
    closeSuggestions();
    clearAirportSearchState();
    safeResetStaticMeta();
    return;
  }

  debounceTimer = setTimeout(() => {
    fetchAirportSuggestions(query);
  }, AUTOCOMPLETE_DEBOUNCE_MS);
}

/**
 * Handle keyboard navigation in suggestions list
 */
function handleSuggestionsKeyboard(event) {
  const suggestionsList = document.getElementById("airportSuggestionsList");
  if (!suggestionsList || suggestionsList.classList.contains("hidden")) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAirportSearch(event);
    }
    return;
  }

  const suggestions = suggestionsList.querySelectorAll("[role='option']");

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      lastSelectedIndex = Math.min(lastSelectedIndex + 1, suggestions.length - 1);
      highlightSuggestion(lastSelectedIndex, suggestions);
      break;
    case "ArrowUp":
      event.preventDefault();
      lastSelectedIndex = Math.max(lastSelectedIndex - 1, -1);
      highlightSuggestion(lastSelectedIndex, suggestions);
      break;
    case "Enter":
      event.preventDefault();
      if (lastSelectedIndex >= 0 && suggestions[lastSelectedIndex]) {
        selectAirportSuggestion(suggestions[lastSelectedIndex]);
      } else {
        handleAirportSearch(event);
      }
      break;
    case "Escape":
      event.preventDefault();
      closeSuggestions();
      break;
  }
}

/**
 * Handle clicks outside suggestions to close them
 */
function handleClickOutside(event) {
  const suggestionsList = document.getElementById("airportSuggestionsList");
  if (suggestionsList && !suggestionsList.contains(event.target) &&
    event.target !== searchQueryInput) {
    closeSuggestions();
  }
}

/**
 * Fetch autocomplete suggestions from backend
 */
async function fetchAirportSuggestions(query) {
  try {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    const response = await fetch(buildApiUrl(API_ENDPOINTS.suggestions, { q: query }), {
      signal: currentAbortController.signal
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.suggestions && data.suggestions.length > 0) {
      renderAirportSuggestions(data.suggestions);
    } else {
      closeSuggestions();
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error fetching suggestions:", error);
      closeSuggestions();
    }
  }
}

/**
 * Render autocomplete suggestions dropdown
 */
function renderAirportSuggestions(suggestions) {
  let suggestionsList = document.getElementById("airportSuggestionsList");

  if (!suggestionsList) {
    suggestionsList = document.createElement("div");
    suggestionsList.id = "airportSuggestionsList";
    suggestionsList.setAttribute("role", "listbox");
    suggestionsList.className = "airport-suggestions-list";
    searchQueryInput.parentElement.appendChild(suggestionsList);
  }

  suggestionsList.innerHTML = "";
  lastSelectedIndex = -1;

  suggestions.forEach((airport, index) => {
    const suggestion = createSuggestionElement(airport, index);
    suggestionsList.appendChild(suggestion);
  });

  suggestionsList.classList.remove("hidden");
}

/**
 * Create a single suggestion element
 */
function createSuggestionElement(airport, index) {
  const div = document.createElement("div");
  div.setAttribute("role", "option");
  div.className = "airport-suggestion-item";
  div.dataset.index = index;
  div.dataset.airportId = airport.id;
  div.dataset.searchValue = getAirportSearchLabel(airport);

  const displayCode = getTextValue(airport.display_icao, t("airports.label.icaoUnavailable"));
  const iataCode = getTextValue(airport.iata_code, "");
  const operationTypeLabel = getOperationalTypeLabel(airport);
  const airportName = getTextValue(airport.name);
  const municipality = getTextValue(airport.municipality);
  const country = getTextValue(airport.iso_country);
  const notInformed = t("airports.value.notInformed");
  const locationParts = [municipality, country, operationTypeLabel].filter(part => part !== notInformed);
  const locationText = locationParts.length > 0 ? locationParts.join(" · ") : notInformed;

  div.innerHTML = `
    <div class="suggestion-header">
      <span class="suggestion-code">${escapeHtml(displayCode)}${iataCode ? ` · ${escapeHtml(iataCode)}` : ""}</span>
      <span class="suggestion-type">${escapeHtml(operationTypeLabel)}</span>
    </div>
    <div class="suggestion-details">
      <span class="suggestion-name">${escapeHtml(airportName)}</span>
      <span class="suggestion-location">${escapeHtml(locationText)}</span>
    </div>
  `;

  div.addEventListener("click", () => selectAirportSuggestion(div));
  div.addEventListener("mouseenter", () => {
    document.querySelectorAll(".airport-suggestion-item.highlighted")
      .forEach(el => el.classList.remove("highlighted"));
    div.classList.add("highlighted");
    lastSelectedIndex = index;
  });

  return div;
}

/**
 * Highlight a suggestion in the list
 */
function highlightSuggestion(index, suggestions) {
  suggestions.forEach(el => el.classList.remove("highlighted"));
  if (index >= 0 && suggestions[index]) {
    suggestions[index].classList.add("highlighted");
  }
}

/**
 * Select a suggestion and fetch the exact airport record
 */
async function selectAirportSuggestion(suggestionElement) {
  const airportId = suggestionElement.dataset.airportId;
  const searchValue = suggestionElement.dataset.searchValue ||
    suggestionElement.querySelector(".suggestion-name")?.textContent ||
    "";

  searchQueryInput.value = searchValue;
  closeSuggestions();
  resultsContainer.innerHTML = "";

  if (!airportId) {
    renderAirportError("airports.error.identifySelected");
    return;
  }

  setAirportLoadingState(true);

  try {
    const selectedAirport = await fetchAirportById(airportId);
    setAirportLoadingState(false);
    renderAirportResults([selectedAirport], { query: searchValue });
    // SEO: Título dinâmico para o aeródromo selecionado
    updateDynamicTitleForAirport(selectedAirport);
  } catch (error) {
    console.error("Error loading selected airport:", error);
    setAirportLoadingState(false);
    renderAirportError("airports.error.loadSelected");
  }
}

/**
 * SEO: Atualiza título e descrição da página com base nos dados do aeródromo
 */
function updateDynamicTitleForAirport(airport) {
  if (!airport) return;
  const icao = airport.display_icao || airport.ident || "ICAO";
  const name = airport.name || "Aeródromo";
  safeSetDynamicMeta(
    "airport.dynamic.title",
    "airport.dynamic.description",
    { icao, name },
    `${icao} - ${name} | DecMET`
  );
}

/**
 * Close suggestions dropdown
 */
function closeSuggestions() {
  const suggestionsList = document.getElementById("airportSuggestionsList");
  if (suggestionsList) {
    suggestionsList.classList.add("hidden");
  }
  lastSelectedIndex = -1;
}

/**
 * Handle airport search form submission
 */
async function handleAirportSearch(event) {
  if (event) event.preventDefault();

  const query = searchQueryInput.value.trim();

  if (!query) {
    renderAirportEmptyState();
    return;
  }

  setAirportLoadingState(true);
  closeSuggestions();
  resultsContainer.innerHTML = "";

  try {
    const results = await fetchAirportResults(query);
    setAirportLoadingState(false);

    if (results && results.length > 0) {
      renderAirportResults(results, { query });
      // SEO: Se houver exatamente um resultado, atualiza título
      if (results.length === 1) {
        updateDynamicTitleForAirport(results[0]);
      } else {
        safeResetStaticMeta();
      }
    } else {
      renderAirportNoResults({ query });
    }
  } catch (error) {
    console.error("Error searching airports:", error);
    setAirportLoadingState(false);
    renderAirportError("airports.state.error");
  }
}

/**
 * Fetch full search results from backend
 */
async function fetchAirportResults(query) {
  const response = await fetch(buildApiUrl(API_ENDPOINTS.search, { q: query }));

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Unknown error");
  }

  return data.results || [];
}

/**
 * Fetch one exact airport by database ID
 */
async function fetchAirportById(id) {
  const response = await fetch(`${API_ENDPOINTS.airportById}/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.result) {
    throw new Error(data.error || "Airport not found");
  }

  return data.result;
}

/**
 * Render airport search results
 */
function renderAirportResults(results, options = {}) {
  statusMessage.classList.add("hidden");
  hideAllStatusStates();
  resultsContainer.innerHTML = "";
  currentErrorKey = null;
  currentRenderedResults = {
    query: options.query ?? searchQueryInput.value.trim(),
    results
  };

  results.forEach(airport => {
    const card = createAirportCard(airport);
    resultsContainer.appendChild(card);
  });

  if (options.persist !== false) {
    saveAirportSearchState(currentRenderedResults);
  }
}

/**
 * Create a single airport result card
 */
function createAirportCard(airport) {
  const operationTypeLabel = getOperationalTypeLabel(airport);
  const displayCode = getTextValue(airport.display_icao, t("airports.label.icaoUnavailable"));
  const airportName = getTextValue(airport.name);
  const municipality = getTextValue(airport.municipality);
  const region = getTextValue(airport.iso_region);
  const country = getTextValue(airport.iso_country);
  const notInformed = t("airports.value.notInformed");
  const locationText = [municipality, region].filter(part => part !== notInformed).join(", ");
  const fullLocationText = [
    locationText || notInformed,
    country
  ].filter(Boolean).join(" — ");

  const iataBadge = airport.iata_code
    ? `<span class="rounded bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold text-sky-800">IATA: ${escapeHtml(airport.iata_code)}</span>`
    : "";

  const elevationText = formatElevation(airport.elevation_ft);
  const latitudeText = formatCoordinate(airport.latitude_deg);
  const longitudeText = formatCoordinate(airport.longitude_deg);
  const coordsText = latitudeText === notInformed || longitudeText === notInformed
    ? notInformed
    : `${latitudeText}, ${longitudeText}`;

  const card = document.createElement("article");
  card.className = "classic-widget rounded-xl p-5 border-l-4 border-l-sky-500 shadow-sm";
  card.innerHTML = `
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      <div class="flex min-w-0 flex-col">
        <span class="font-mono text-2xl font-bold text-sky-800 tracking-wider">${escapeHtml(displayCode)}</span>
        <span class="text-[10px] font-bold uppercase tracking-wide text-slate-500">${escapeHtml(t("airports.label.icao"))}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${iataBadge}
      </div>
      <span class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase tracking-wide ml-auto">
        ${escapeHtml(operationTypeLabel)}
      </span>
    </div>
    <div class="mt-3">
      <h3 class="text-base font-bold text-slate-800">${escapeHtml(airportName)}</h3>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">${escapeHtml(t("airports.label.location"))}</p>
          <p class="mt-0.5 text-slate-700 font-medium">${escapeHtml(fullLocationText)}</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">${escapeHtml(t("airports.label.coordinatesAltitude"))}</p>
          <p class="mt-0.5 text-slate-700 font-mono">${escapeHtml(coordsText)} / ${escapeHtml(elevationText)}</p>
        </div>
      </div>
    </div>
  `;

  return card;
}

/**
 * Show empty state when no search term entered
 */
function renderAirportEmptyState() {
  resultsContainer.innerHTML = "";
  statusMessage.classList.remove("hidden");
  hideAllStatusStates();
  emptyState.classList.remove("hidden");
  currentRenderedResults = null;
  currentErrorKey = null;
  clearAirportSearchState();
  safeResetStaticMeta();
}

/**
 * Show no results state
 */
function renderAirportNoResults(options = {}) {
  resultsContainer.innerHTML = "";
  statusMessage.classList.remove("hidden");
  hideAllStatusStates();
  noResultsState.classList.remove("hidden");
  currentRenderedResults = null;
  currentErrorKey = null;
  saveAirportSearchState({
    query: options.query ?? searchQueryInput.value.trim(),
    results: []
  });
  safeResetStaticMeta();
}

/**
 * Show error state
 */
function renderAirportError(messageKey) {
  resultsContainer.innerHTML = "";
  statusMessage.classList.remove("hidden");
  hideAllStatusStates();
  currentRenderedResults = null;
  currentErrorKey = messageKey;
  errorState.textContent = t(messageKey);
  errorState.classList.remove("hidden");
  safeResetStaticMeta();
}

/**
 * Show or hide loading state
 */
function setAirportLoadingState(isLoading) {
  if (isLoading) {
    statusMessage.classList.remove("hidden");
    hideAllStatusStates();
    loadingState.classList.remove("hidden");
  } else {
    statusMessage.classList.add("hidden");
    loadingState.classList.add("hidden");
  }
}

/**
 * Hide all status messages
 */
function hideAllStatusStates() {
  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  noResultsState.classList.add("hidden");
  errorState.classList.add("hidden");
}

function saveAirportSearchState(state) {
  const query = String(state.query ?? "").trim();

  if (!query) {
    clearAirportSearchState();
    return;
  }

  const payload = {
    query,
    results: Array.isArray(state.results) ? state.results : [],
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(AIRPORT_SEARCH_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not persist airport search state:", error);
  }
}

function restoreAirportSearchState() {
  const state = readAirportSearchState();

  if (!state) {
    return;
  }

  searchQueryInput.value = state.query;

  if (state.results.length > 0) {
    renderAirportResults(state.results, { query: state.query });
    // SEO: Se houver apenas um resultado ao restaurar, atualiza título
    if (state.results.length === 1) {
      updateDynamicTitleForAirport(state.results[0]);
    }
  } else {
    renderAirportNoResults({ query: state.query });
  }
}

function readAirportSearchState() {
  try {
    const rawState = localStorage.getItem(AIRPORT_SEARCH_STORAGE_KEY);

    if (!rawState) {
      return null;
    }

    const state = JSON.parse(rawState);
    const isExpired = !state.savedAt || Date.now() - state.savedAt > AIRPORT_SEARCH_STORAGE_TTL_MS;

    if (isExpired || typeof state.query !== "string" || !Array.isArray(state.results)) {
      clearAirportSearchState();
      return null;
    }

    return state;
  } catch (error) {
    clearAirportSearchState();
    return null;
  }
}

function clearAirportSearchState() {
  try {
    localStorage.removeItem(AIRPORT_SEARCH_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear airport search state:", error);
  }
}
