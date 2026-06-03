export function decodeMetar(input) {
  const raw = normalizeMetar(input);
  const tokens = splitMetarIntoParts(raw);

  let stationAlreadyDetected = false;
  let remarkMode = false;

  const decodedParts = tokens.map(function (token, index) {
    const context = {
      index,
      stationAlreadyDetected,
      remarkMode,
      previousToken: tokens[index - 1] || null,
      nextToken: tokens[index + 1] || null
    };

    const decodedToken = decodeToken(token, context);

    if (decodedToken.category === "station") {
      stationAlreadyDetected = true;
    }

    if (decodedToken.category === "remarks_start") {
      remarkMode = true;
    }

    return decodedToken;
  });

  return {
    raw,
    tokens,
    decodedParts
  };
}

function normalizeMetar(input) {
  if (typeof input !== "string") {
    throw new Error("O METAR precisa ser enviado em formato de texto.");
  }

  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/=/g, "")
    .replace(/\s+/g, " ");

  if (normalized.length === 0) {
    throw new Error("Digite um METAR antes de decodificar.");
  }

  return normalized;
}

function splitMetarIntoParts(metar) {
  const rawParts = metar.split(" ");
  const mergedParts = [];

  for (let index = 0; index < rawParts.length; index++) {
    const current = rawParts[index];
    const next = rawParts[index + 1];
    const nextAfterNext = rawParts[index + 2];

    // Exemplo: 1 1/2SM
    if (/^\d+$/.test(current) && /^M?\d+\/\d+SM$/.test(next || "")) {
      mergedParts.push(`${current} ${next}`);
      index++;
      continue;
    }

    // Exemplo: WS R15, WS R09L, WS R27C
    if (current === "WS" && /^R\d{2}[LCR]?$/.test(next || "")) {
      mergedParts.push(`${current} ${next}`);
      index++;
      continue;
    }

    // Exemplo: WS RWY15, WS RWY09L
    if (current === "WS" && /^RWY\d{2}[LCR]?$/.test(next || "")) {
      mergedParts.push(`${current} ${next}`);
      index++;
      continue;
    }

    // Exemplo: WS ALL RWY
    if (current === "WS" && next === "ALL" && nextAfterNext === "RWY") {
      mergedParts.push("WS ALL RWY");
      index += 2;
      continue;
    }

    mergedParts.push(current);
  }

  return mergedParts;
}

function decodeToken(token, context) {
  if (context.remarkMode && token !== "RMK") {
    return decodeRemarkToken(token, context);
  }

  if (token === "METAR" || token === "SPECI") {
    return decodeReportType(token);
  }

  if (token === "AUTO") {
    return {
      code: token,
      category: "modifier",
      type: "Modificador",
      description: "Relatório gerado automaticamente por uma estação meteorológica."
    };
  }

  if (token === "COR") {
    return {
      code: token,
      category: "modifier",
      type: "Correção",
      description: "Relatório corrigido."
    };
  }

  if (token === "NIL") {
    return {
      code: token,
      category: "missing_report",
      type: "Relatório indisponível",
      description: "METAR não disponível para esta estação no momento informado."
    };
  }

  if (isStationIdentifier(token, context)) {
    return decodeStationIdentifier(token);
  }

  if (/^\d{6}Z$/.test(token)) {
    return decodeDateTime(token);
  }

  if (isWind(token)) {
    return decodeWind(token);
  }

  if (/^\d{3}V\d{3}$/.test(token)) {
    return decodeVariableWindDirection(token);
  }

  if (isWindShear(token)) {
    return decodeWindShear(token);
  }

  if (token === "CAVOK") {
    return decodeCavok(token);
  }

  if (isDirectionalVisibility(token)) {
    return decodeDirectionalVisibility(token);
  }

  if (isMetricVisibility(token)) {
    return decodeMetricVisibility(token);
  }

  if (isStatuteMileVisibility(token)) {
    return decodeStatuteMileVisibility(token);
  }

  if (isRunwayVisualRange(token)) {
    return decodeRunwayVisualRange(token);
  }

  if (isCloudLayer(token)) {
    return decodeCloudLayer(token);
  }

  if (isSkyCondition(token)) {
    return decodeSkyCondition(token);
  }

  if (isVerticalVisibility(token)) {
    return decodeVerticalVisibility(token);
  }

  if (isPossibleVerticalVisibilityTypo(token)) {
    return decodePossibleVerticalVisibilityTypo(token);
  }

  if (isTemperatureAndDewPoint(token)) {
    return decodeTemperatureAndDewPoint(token);
  }

  if (isPressure(token)) {
    return decodePressure(token);
  }

  if (isWeatherPhenomenon(token)) {
    return decodeWeatherPhenomenon(token);
  }

  if (isTrendToken(token)) {
    return decodeTrendToken(token);
  }

  if (token === "RMK") {
    return {
      code: token,
      category: "remarks_start",
      type: "Início das observações",
      description: "A partir deste ponto, o METAR apresenta observações complementares. Esses grupos podem variar bastante conforme o país e o órgão meteorológico."
    };
  }

  return decodeUnknownToken(token);
}

function decodeReportType(token) {
  const descriptions = {
    METAR: "Relatório meteorológico regular de aeródromo.",
    SPECI: "Relatório meteorológico especial, emitido fora do horário regular."
  };

  return {
    code: token,
    category: "report_type",
    type: "Tipo de relatório",
    description: descriptions[token]
  };
}

function isStationIdentifier(token, context) {
  return /^[A-Z]{4}$/.test(token) && context.stationAlreadyDetected === false;
}

function decodeStationIdentifier(token) {
  return {
    code: token,
    category: "station",
    type: "Identificador da estação",
    description: `Código ICAO da estação meteorológica ou aeródromo: ${token}.`
  };
}

function decodeDateTime(token) {
  const day = token.slice(0, 2);
  const hour = token.slice(2, 4);
  const minute = token.slice(4, 6);

  return {
    code: token,
    category: "date_time",
    type: "Data e hora do reporte",
    description: `Reporte emitido no dia ${day}, às ${hour}:${minute} UTC.`
  };
}

function isWind(token) {
  return /^(VRB|\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS|KMH)$/.test(token);
}

function decodeWind(token) {
  const regex = /^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS|KMH)$/;
  const match = token.match(regex);

  const direction = match[1];
  const speed = Number(match[2]);
  const gust = match[4] ? Number(match[4]) : null;
  const unit = match[5];

  const unitDescriptions = {
    KT: "nós",
    MPS: "metros por segundo",
    KMH: "quilômetros por hora"
  };

  if (/^00000(KT|MPS|KMH)$/.test(token)) {
    return {
      code: token,
      category: "wind",
      type: "Vento",
      description: "Vento calmo."
    };
  }

  const directionText = direction === "VRB"
    ? "direção variável"
    : `direção ${Number(direction)}°`;

  let description = `Vento de ${directionText}, com velocidade de ${speed} ${unitDescriptions[unit]}.`;

  if (gust !== null) {
    description += ` Rajadas de até ${gust} ${unitDescriptions[unit]}.`;
  }

  return {
    code: token,
    category: "wind",
    type: "Vento",
    description
  };
}

function decodeVariableWindDirection(token) {
  const [from, to] = token.split("V");

  return {
    code: token,
    category: "wind_variation",
    type: "Variação da direção do vento",
    description: `Direção do vento variando entre ${Number(from)}° e ${Number(to)}°.`
  };
}

function isWindShear(token) {
  return /^WS\s(R\d{2}[LCR]?|RWY\d{2}[LCR]?|ALL RWY)$/.test(token);
}

function decodeWindShear(token) {
  if (token === "WS ALL RWY") {
    return {
      code: token,
      category: "wind_shear",
      type: "Windshear",
      description: "Windshear reportado em todas as pistas."
    };
  }

  const runway = token
    .replace("WS R", "")
    .replace("WS RWY", "");

  return {
    code: token,
    category: "wind_shear",
    type: "Windshear",
    description: `Windshear reportado na pista ${runway}.`
  };
}

function decodeCavok(token) {
  return {
    code: token,
    category: "cavok",
    type: "CAVOK",
    description: "Condição meteorológica favorável: visibilidade igual ou superior a 10 km, sem nuvens significativas e sem tempo significativo."
  };
}

function isDirectionalVisibility(token) {
  return /^\d{4}(NE|SE|SW|NW|N|E|S|W)$/.test(token);
}

function decodeDirectionalVisibility(token) {
  const match = token.match(/^(\d{4})(NE|SE|SW|NW|N|E|S|W)$/);
  const visibility = Number(match[1]);
  const directionCode = match[2];

  const directionDescriptions = {
    N: "norte",
    NE: "nordeste",
    E: "leste",
    SE: "sudeste",
    S: "sul",
    SW: "sudoeste",
    W: "oeste",
    NW: "noroeste"
  };

  return {
    code: token,
    category: "directional_visibility",
    type: "Visibilidade direcional",
    description: `Visibilidade horizontal de ${visibility} metros na direção ${directionDescriptions[directionCode]}.`
  };
}

function isMetricVisibility(token) {
  return /^\d{4}(NDV)?$/.test(token) || token === "////";
}

function decodeMetricVisibility(token) {
  if (token === "////") {
    return {
      code: token,
      category: "visibility",
      type: "Visibilidade",
      description: "Visibilidade não informada ou indisponível."
    };
  }

  const hasNoDirectionalVariation = token.endsWith("NDV");
  const visibility = Number(token.replace("NDV", ""));

  let description;

  if (visibility === 9999) {
    description = "Visibilidade horizontal de 10 km ou mais.";
  } else {
    description = `Visibilidade horizontal de ${visibility} metros.`;
  }

  if (hasNoDirectionalVariation) {
    description += " NDV indica ausência de variação direcional reportada.";
  }

  return {
    code: token,
    category: "visibility",
    type: "Visibilidade",
    description
  };
}

function isStatuteMileVisibility(token) {
  return /^(P|M)?(\d+\s)?(\d+\/\d+|\d+)SM$/.test(token);
}

function decodeStatuteMileVisibility(token) {
  const prefix = token.startsWith("P") ? "mais de " : token.startsWith("M") ? "menos de " : "";
  const cleanToken = token.replace(/^P|^M/, "").replace("SM", "");
  const miles = parseMixedFraction(cleanToken);
  const kilometers = miles === null ? null : miles * 1.609344;

  const description = kilometers === null
    ? `Visibilidade em milhas estatutárias: ${token}.`
    : `Visibilidade horizontal de ${prefix}${cleanToken} milha(s) estatutária(s), aproximadamente ${kilometers.toFixed(2)} km.`;

  return {
    code: token,
    category: "visibility",
    type: "Visibilidade em milhas estatutárias",
    description
  };
}

function parseMixedFraction(value) {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [numerator, denominator] = trimmed.split("/").map(Number);
    return numerator / denominator;
  }

  if (/^\d+\s\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(" ");
    const [numerator, denominator] = fraction.split("/").map(Number);
    return Number(whole) + numerator / denominator;
  }

  return null;
}

function isRunwayVisualRange(token) {
  return /^R\d{2}[LCR]?\/(P|M)?\d{4}(V(P|M)?\d{4})?(FT)?[UDN]?$/.test(token);
}

function decodeRunwayVisualRange(token) {
  const regex = /^R(\d{2}[LCR]?)\/(P|M)?(\d{4})(V(P|M)?(\d{4}))?(FT)?([UDN])?$/;
  const match = token.match(regex);

  const runway = match[1];
  const firstPrefix = decodeRangePrefix(match[2]);
  const firstValue = Number(match[3]);
  const secondPrefix = decodeRangePrefix(match[5]);
  const secondValue = match[6] ? Number(match[6]) : null;
  const unit = match[7] === "FT" ? "pés" : "metros";
  const tendency = decodeRvrTendency(match[8]);

  let description = `Alcance visual da pista ${runway}: ${firstPrefix}${firstValue} ${unit}`;

  if (secondValue !== null) {
    description += ` variando até ${secondPrefix}${secondValue} ${unit}`;
  }

  if (tendency) {
    description += `. Tendência: ${tendency}.`;
  } else {
    description += ".";
  }

  return {
    code: token,
    category: "runway_visual_range",
    type: "Alcance visual de pista",
    description
  };
}

function decodeRangePrefix(prefix) {
  if (prefix === "P") return "mais de ";
  if (prefix === "M") return "menos de ";
  return "";
}

function decodeRvrTendency(code) {
  const tendencies = {
    U: "aumentando",
    D: "diminuindo",
    N: "sem mudança significativa"
  };

  return tendencies[code] || "";
}

function isCloudLayer(token) {
  return /^(FEW|SCT|BKN|OVC)(\d{3}|\/{3})(CB|TCU)?$/.test(token);
}

function decodeCloudLayer(token) {
  const regex = /^(FEW|SCT|BKN|OVC)(\d{3}|\/{3})(CB|TCU)?$/;
  const match = token.match(regex);

  const amountCode = match[1];
  const heightCode = match[2];
  const cloudType = match[3] || null;

  const amountDescriptions = {
    FEW: "Poucas nuvens (1 a 2 oitavos do céu)",
    SCT: "Nuvens esparsas (3 a 4 oitavos do céu)",
    BKN: "Céu muito nublado (5 a 7 oitavos do céu)",
    OVC: "Céu encoberto (8 oitavos do céu)"
  };

  let description = `${amountDescriptions[amountCode]}`;

  if (heightCode === "///") {
    description += " com altura não informada.";
  } else {
    const heightInFeet = Number(heightCode) * 100;
    description += ` a ${heightInFeet} pés.`;
  }

  if (cloudType === "CB") {
    description += " Presença de Cumulonimbus.";
  }

  if (cloudType === "TCU") {
    description += " Presença de Towering Cumulus (Cumulus Congestus).";
  }

  return {
    code: token,
    category: "clouds",
    type: "Nuvens",
    description
  };
}

function isSkyCondition(token) {
  return ["SKC", "CLR", "NSC", "NCD"].includes(token);
}

function decodeSkyCondition(token) {
  const descriptions = {
    SKC: "Céu claro, sem nuvens reportadas.",
    CLR: "Céu claro abaixo do limite de detecção da estação automática.",
    NSC: "Sem nuvens significativas.",
    NCD: "Nenhuma nuvem detectada por estação automática."
  };

  return {
    code: token,
    category: "sky_condition",
    type: "Condição do céu",
    description: descriptions[token]
  };
}

function isVerticalVisibility(token) {
  return /^VV(\d{3}|\/{3})$/.test(token);
}

function decodeVerticalVisibility(token) {
  const heightCode = token.slice(2);

  const description = heightCode === "///"
    ? "Visibilidade vertical não informada."
    : `Visibilidade vertical de ${Number(heightCode) * 100} pés.`;

  return {
    code: token,
    category: "vertical_visibility",
    type: "Visibilidade vertical",
    description
  };
}

function isPossibleVerticalVisibilityTypo(token) {
  return /^WVE(\d{3}|\/{3})$/.test(token);
}

function decodePossibleVerticalVisibilityTypo(token) {
  const heightCode = token.slice(3);

  let possibleMeaning;

  if (heightCode === "///") {
    possibleMeaning = "Se o código correto fosse VV///, indicaria visibilidade vertical não informada.";
  } else {
    possibleMeaning = `Se o código correto fosse VV${heightCode}, indicaria visibilidade vertical de ${Number(heightCode) * 100} pés.`;
  }

  return {
    code: token,
    category: "possible_typo",
    type: "Possível erro de codificação",
    description: `O grupo ${token} não corresponde ao padrão METAR comum para visibilidade vertical. Talvez o código esperado fosse VV${heightCode}. ${possibleMeaning}`
  };
}

function isTemperatureAndDewPoint(token) {
  return /^(M?\d{2}|\/\/)(\/(M?\d{2}|\/\/))$/.test(token);
}

function decodeTemperatureAndDewPoint(token) {
  const [temperatureRaw, dewPointRaw] = token.split("/");

  const temperature = parseMetarTemperature(temperatureRaw);
  const dewPoint = parseMetarTemperature(dewPointRaw);

  const temperatureText = temperature === null ? "não informada" : `${temperature}°C`;
  const dewPointText = dewPoint === null ? "não informado" : `${dewPoint}°C`;

  return {
    code: token,
    category: "temperature",
    type: "Temperatura / Ponto de orvalho",
    description: `Temperatura de ${temperatureText} e ponto de orvalho de ${dewPointText}.`
  };
}

function parseMetarTemperature(value) {
  if (value === "//") {
    return null;
  }

  if (value.startsWith("M")) {
    return -Number(value.slice(1));
  }

  return Number(value);
}

function isPressure(token) {
  return /^Q\d{4}$/.test(token) || /^A\d{4}$/.test(token);
}

function decodePressure(token) {
  if (token.startsWith("Q")) {
    const pressure = Number(token.slice(1));

    return {
      code: token,
      category: "pressure",
      type: "Pressão atmosférica",
      description: `QNH de ${pressure} hPa.`
    };
  }

  const inches = Number(`${token.slice(1, 3)}.${token.slice(3, 5)}`);
  const hpa = inches * 33.8639;

  return {
    code: token,
    category: "pressure",
    type: "Altímetro / pressão atmosférica",
    description: `Ajuste altimétrico de ${inches.toFixed(2)} inHg, aproximadamente ${Math.round(hpa)} hPa.`
  };
}

function isWeatherPhenomenon(token) {
  return parseWeatherPhenomenon(token).isValid;
}

function decodeWeatherPhenomenon(token) {
  const parsed = parseWeatherPhenomenon(token);

  return {
    code: token,
    category: "weather",
    type: "Tempo presente",
    description: parsed.description
  };
}

function parseWeatherPhenomenon(token) {
  let remaining = token;
  const parts = [];

  const intensityDescriptions = {
    "-": "intensidade fraca",
    "+": "intensidade forte"
  };

  if (remaining.startsWith("-") || remaining.startsWith("+")) {
    parts.push(intensityDescriptions[remaining[0]]);
    remaining = remaining.slice(1);
  }

  if (remaining.startsWith("VC")) {
    parts.push("nas proximidades do aeródromo");
    remaining = remaining.slice(2);
  } else if (remaining.startsWith("RE")) {
    parts.push("fenômeno recente");
    remaining = remaining.slice(2);
  }

  const descriptorDescriptions = {
    MI: "baixo",
    PR: "parcial",
    BC: "bancos",
    DR: "levantado baixo pelo vento",
    BL: "soprado pelo vento",
    SH: "pancadas",
    TS: "trovoada",
    FZ: "congelante"
  };

  let descriptorFound = true;

  while (descriptorFound) {
    descriptorFound = false;

    for (const descriptor of Object.keys(descriptorDescriptions)) {
      if (remaining.startsWith(descriptor)) {
        parts.push(descriptorDescriptions[descriptor]);
        remaining = remaining.slice(descriptor.length);
        descriptorFound = true;
        break;
      }
    }
  }

  const phenomenonDescriptions = {
    DZ: "garoa",
    RA: "chuva",
    SN: "neve",
    SG: "grãos de neve",
    IC: "cristais de gelo",
    PL: "pelotas de gelo",
    GR: "granizo",
    GS: "granizo pequeno ou neve granulada",
    UP: "precipitação desconhecida",
    BR: "névoa úmida",
    FG: "nevoeiro",
    FU: "fumaça",
    VA: "cinzas vulcânicas",
    DU: "poeira espalhada",
    SA: "areia",
    HZ: "névoa seca",
    PY: "spray",
    PO: "redemoinhos de poeira ou areia",
    SQ: "linha de instabilidade",
    FC: "funil, tornado ou tromba d'água",
    SS: "tempestade de areia",
    DS: "tempestade de poeira"
  };

  const phenomena = [];

  while (remaining.length > 0) {
    const code = Object.keys(phenomenonDescriptions).find(function (phenomenon) {
      return remaining.startsWith(phenomenon);
    });

    if (!code) {
      return {
        isValid: false,
        description: ""
      };
    }

    phenomena.push(phenomenonDescriptions[code]);
    remaining = remaining.slice(code.length);
  }

  if (phenomena.length === 0 && parts.length === 0) {
    return {
      isValid: false,
      description: ""
    };
  }

  const descriptionParts = [];

  if (parts.length > 0) {
    descriptionParts.push(parts.join(", "));
  }

  if (phenomena.length > 0) {
    descriptionParts.push(phenomena.join(" e "));
  }

  return {
    isValid: true,
    description: `${capitalizeFirstLetter(descriptionParts.join(": "))}.`
  };
}

function isTrendToken(token) {
  return ["NOSIG", "TEMPO", "BECMG", "NSW"].includes(token) ||
    /^PROB\d{2}$/.test(token) ||
    /^FM\d{6}$/.test(token) ||
    /^TL\d{4}$/.test(token) ||
    /^AT\d{4}$/.test(token);
}

function decodeTrendToken(token) {
  if (token === "NOSIG") {
    return {
      code: token,
      category: "trend",
      type: "Tendência",
      description: "Sem mudança significativa prevista."
    };
  }

  if (token === "TEMPO") {
    return {
      code: token,
      category: "trend",
      type: "Tendência temporária",
      description: "Indica condições temporárias previstas no período de tendência."
    };
  }

  if (token === "BECMG") {
    return {
      code: token,
      category: "trend",
      type: "Tendência de mudança gradual",
      description: "Indica mudança gradual prevista nas condições meteorológicas."
    };
  }

  if (token === "NSW") {
    return {
      code: token,
      category: "trend",
      type: "Tendência - sem tempo significativo",
      description: "Indica ausência de tempo significativo previsto."
    };
  }

  if (/^PROB\d{2}$/.test(token)) {
    return {
      code: token,
      category: "trend_probability",
      type: "Probabilidade de tendência",
      description: `Probabilidade de ${token.slice(4)}% para as condições previstas na tendência.`
    };
  }

  if (/^FM\d{6}$/.test(token)) {
    return {
      code: token,
      category: "trend_time",
      type: "Tendência - a partir de",
      description: `Condição prevista a partir do dia ${token.slice(2, 4)}, às ${token.slice(4, 6)}:${token.slice(6, 8)} UTC.`
    };
  }

  if (/^TL\d{4}$/.test(token)) {
    return {
      code: token,
      category: "trend_time",
      type: "Tendência - até",
      description: `Condição prevista até ${token.slice(2, 4)}:${token.slice(4, 6)} UTC.`
    };
  }

  return {
    code: token,
    category: "trend_time",
    type: "Tendência - horário",
    description: `Condição prevista em torno de ${token.slice(2, 4)}:${token.slice(4, 6)} UTC.`
  };
}

function decodeRemarkToken(token, context) {
  if (token === "AO1" || token === "AO2") {
    return {
      code: token,
      category: "remark",
      type: "Observação - estação automática",
      description: token === "AO1"
        ? "Estação automática sem discriminador de precipitação."
        : "Estação automática com discriminador de precipitação."
    };
  }

  if (/^SLP\d{3}$/.test(token)) {
    return decodeSeaLevelPressureRemark(token);
  }

  if (/^T[01]\d{3}[01]\d{3}$/.test(token)) {
    return decodePreciseTemperatureRemark(token);
  }

  if (/^P\d{4}$/.test(token)) {
    return {
      code: token,
      category: "remark",
      type: "Observação - precipitação horária",
      description: `Precipitação acumulada na última hora: ${(Number(token.slice(1)) / 100).toFixed(2)} polegada(s).`
    };
  }

  if (/^6\d{4}$/.test(token)) {
    return {
      code: token,
      category: "remark",
      type: "Observação - precipitação 3/6h",
      description: `Precipitação acumulada no período de 3 ou 6 horas: ${(Number(token.slice(1)) / 100).toFixed(2)} polegada(s).`
    };
  }

  if (/^7\d{4}$/.test(token)) {
    return {
      code: token,
      category: "remark",
      type: "Observação - precipitação 24h",
      description: `Precipitação acumulada em 24 horas: ${(Number(token.slice(1)) / 100).toFixed(2)} polegada(s).`
    };
  }

  if (token === "PRESFR" || token === "PRESRR") {
    return {
      code: token,
      category: "remark",
      type: "Observação - tendência da pressão",
      description: token === "PRESFR"
        ? "Pressão atmosférica caindo rapidamente."
        : "Pressão atmosférica subindo rapidamente."
    };
  }

  if (token === "$") {
    return {
      code: token,
      category: "remark",
      type: "Observação - manutenção",
      description: "Indicador de necessidade de manutenção na estação automática."
    };
  }

  if (/^[A-Z]{2,}(B|E)\d{2,4}([A-Z]{0,2}\d{0,4})?$/.test(token)) {
    return {
      code: token,
      category: "remark",
      type: "Observação - início/fim de fenômeno",
      description: "Grupo de observação indicando início e/ou fim de fenômeno meteorológico no período recente."
    };
  }

  if (/^[A-Z0-9/]+$/.test(token)) {
    return {
      code: token,
      category: "remark",
      type: "Observação complementar",
      description: "Grupo de observação complementar. Pode possuir significado regional ou operacional específico."
    };
  }

  return decodeUnknownToken(token);
}

function decodeSeaLevelPressureRemark(token) {
  const value = Number(token.slice(3));
  const pressure = value >= 500 ? 900 + value / 10 : 1000 + value / 10;

  return {
    code: token,
    category: "remark",
    type: "Observação - pressão ao nível do mar",
    description: `Pressão ao nível do mar de ${pressure.toFixed(1)} hPa.`
  };
}

function decodePreciseTemperatureRemark(token) {
  const temperatureSign = token[1] === "1" ? -1 : 1;
  const temperature = temperatureSign * (Number(token.slice(2, 5)) / 10);

  const dewPointSign = token[5] === "1" ? -1 : 1;
  const dewPoint = dewPointSign * (Number(token.slice(6, 9)) / 10);

  return {
    code: token,
    category: "remark",
    type: "Observação - temperatura precisa",
    description: `Temperatura precisa de ${temperature.toFixed(1)}°C e ponto de orvalho preciso de ${dewPoint.toFixed(1)}°C.`
  };
}

function decodeUnknownToken(token) {
  return {
    code: token,
    category: "unknown",
    type: "Não identificado",
    description: "Esta parte ainda não foi reconhecida pelo decodificador."
  };
}

function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}