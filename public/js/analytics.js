// js/analytics.js

/**
 * Função genérica para disparar eventos no Google Analytics 4.
 * @param {string} eventName - Nome do evento (ex: 'busca_icao').
 * @param {Object} params - Parâmetros adicionais.
 */
export function enviarEventoGA(eventName, params = {}) {
  if (typeof gtag !== 'function') {
    console.warn('[GA4] gtag não definido. Evento não enviado:', eventName, params);
    return;
  }

  try {
    gtag('event', eventName, params);
  } catch (error) {
    console.error('[GA4] Erro ao disparar evento:', error, { eventName, params });
  }
}