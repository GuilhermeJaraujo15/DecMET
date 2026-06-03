import { decodeMetar } from "./core/metar-decoder.js";
import { initMetarKnowledgeTree } from "./ui/metar-knowledge-tree.js";
import { translateMetarPart } from "./services/metar-translator.js";

function onDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }

  callback();
}

let metarForm;
let metarInput;
let clearButton;
let rawPanel;
let rawMetar;
let tokensPanel;
let tokensList;
let decodedPanel;
let decodedTableBody;
let currentDecodedParts = [];

function t(key) {
  return window.DecMETI18n?.t(key) || key;
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

onDomReady(initPageInteractions);

function initPageInteractions() {
  initMetarKnowledgeTree();

  metarForm = document.querySelector("#metarForm");
  metarInput = document.querySelector("#metarInput");
  clearButton = document.querySelector("#clearButton");
  rawPanel = document.querySelector("#rawPanel");
  rawMetar = document.querySelector("#rawMetar");
  tokensPanel = document.querySelector("#tokensPanel");
  tokensList = document.querySelector("#tokensList");
  decodedPanel = document.querySelector("#decodedPanel");
  decodedTableBody = document.querySelector("#decodedTableBody");

  const hasDecoderDom = metarForm &&
    metarInput &&
    clearButton &&
    rawPanel &&
    rawMetar &&
    tokensPanel &&
    tokensList &&
    decodedPanel &&
    decodedTableBody;

  if (!hasDecoderDom) {
    return;
  }

  metarForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const metarText = metarInput.value;

    try {
      const result = decodeMetar(metarText);

      renderRawMetar(result.raw);
      renderTokens(result.decodedParts);
      renderDecodedParts(result.decodedParts);
      currentDecodedParts = result.decodedParts;
    } catch (error) {
      alert(error.message);
    }
  });

  clearButton.addEventListener("click", clearDecoder);
  window.addEventListener("decmet:languagechange", function () {
    if (currentDecodedParts.length) {
      renderTokens(currentDecodedParts);
      renderDecodedParts(currentDecodedParts);
    }
  });
}

function clearDecoder() {
  metarInput.value = "";
  rawPanel.hidden = true;
  tokensPanel.hidden = true;
  decodedPanel.hidden = true;
  rawMetar.textContent = "";
  tokensList.innerHTML = "";
  decodedTableBody.innerHTML = "";
  currentDecodedParts = [];
  metarInput.focus();
  
  safeResetStaticMeta();
}

function renderRawMetar(raw) {
  rawPanel.hidden = false;
  rawMetar.textContent = raw;
}

function renderTokens(decodedParts) {
  tokensPanel.hidden = false;
  tokensList.innerHTML = "";
  const language = window.DecMETI18n?.getCurrentLanguage?.() || 'pt-BR';

  decodedParts.forEach(function (part, index) {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    const label = document.createElement("span");

    const translatedPart = structuredClone(part);
    if (language !== 'pt-BR') {
      translateMetarPart(translatedPart, language);
    }

    li.className = "flex flex-wrap items-center gap-2";
    badge.className = `token-pill token-${part.category} rounded-lg px-3 py-2 font-mono text-sm font-bold`;
    badge.textContent = part.code;
    label.className = "text-sm text-slate-600";
    label.textContent = `${t("decoder.part")} ${index + 1} - ${translatedPart.type}`;

    li.appendChild(badge);
    li.appendChild(label);
    tokensList.appendChild(li);
  });
}

function renderDecodedParts(decodedParts) {
  decodedPanel.hidden = false;
  decodedTableBody.innerHTML = "";
  const language = window.DecMETI18n?.getCurrentLanguage?.() || 'pt-BR';

  decodedParts.forEach(function (part) {
    const translatedPart = structuredClone(part);
    if (language !== 'pt-BR') {
      translateMetarPart(translatedPart, language);
    }

    const tr = document.createElement("tr");
    tr.className = "decoded-row align-top";
    tr.dataset.category = part.category;

    const codeTd = document.createElement("td");
    codeTd.className = "whitespace-nowrap px-4 py-3 font-mono text-sm font-bold text-slate-800";
    codeTd.textContent = part.code;

    const typeTd = document.createElement("td");
    typeTd.className = "px-4 py-3 text-sm font-semibold text-sky-800";
    typeTd.textContent = translatedPart.type;

    const descriptionTd = document.createElement("td");
    descriptionTd.className = "px-4 py-3 text-sm leading-relaxed text-slate-700";
    descriptionTd.textContent = translatedPart.description;

    tr.appendChild(codeTd);
    tr.appendChild(typeTd);
    tr.appendChild(descriptionTd);

    decodedTableBody.appendChild(tr);
  });
}
