export const defaultLang = "pt-BR";
export const supportedLangs = ["pt-BR", "en-US"];

const translations = {
  "pt-BR": {
    "common.home": "Início",
    "common.airports": "Aeródromos",
    "common.decoder": "Decodificador",
    "station.eyebrow": "Estação meteorológica aeronáutica",
    "station.metar.heading": "METAR em tempo real",
    "station.metar.raw": "METAR bruto",
    "station.metar.decoded": "METAR decodificado",
    "station.metar.unavailable": "METAR recente indisponível no momento.",
    "station.airport.heading": "Dados do aeródromo",
    "station.airport.location": "Localização",
    "station.airport.coordinates": "Coordenadas",
    "station.airport.elevation": "Elevação",
    "station.airport.type": "Tipo",
    "station.cache.label": "Cache",
    "station.footer.note": "Dados meteorológicos fornecidos pela NOAA AviationWeather e decodificados pelo DecMET.",
    "error.notFound.title": "Estação não encontrada",
    "error.notFound.body": "Não encontramos um aeródromo válido para este código ICAO na base DecMET."
  },
  "en-US": {
    "common.home": "Home",
    "common.airports": "Aerodromes",
    "common.decoder": "Decoder",
    "station.eyebrow": "Aeronautical weather station",
    "station.metar.heading": "Real-time METAR",
    "station.metar.raw": "Raw METAR",
    "station.metar.decoded": "Decoded METAR",
    "station.metar.unavailable": "Recent METAR unavailable right now.",
    "station.airport.heading": "Aerodrome data",
    "station.airport.location": "Location",
    "station.airport.coordinates": "Coordinates",
    "station.airport.elevation": "Elevation",
    "station.airport.type": "Type",
    "station.cache.label": "Cache",
    "station.footer.note": "Weather data provided by NOAA AviationWeather and decoded by DecMET.",
    "error.notFound.title": "Station not found",
    "error.notFound.body": "We could not find a valid aerodrome for this ICAO code in the DecMET database."
  }
};

export function normalizeLang(lang) {
  return supportedLangs.includes(lang) ? lang : defaultLang;
}

export function isSupportedLang(lang) {
  return supportedLangs.includes(lang);
}

export function t(lang, key) {
  return translations[normalizeLang(lang)]?.[key] || translations[defaultLang][key] || key;
}
