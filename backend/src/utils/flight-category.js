const METERS_PER_STATUTE_MILE = 1609.344;

export function getFlightCategoryFromMetar(rawMetar) {
  const metar = normalizeMetar(rawMetar);

  if (!metar) {
    return null;
  }

  const tokens = mergeFractionalVisibilityTokens(metar.split(" "));
  const visibilitySm = getVisibilityInStatuteMiles(tokens);
  const ceilingFt = getCeilingInFeet(tokens);
  const hasUnknownCeiling = hasUnknownCeilingToken(tokens);

  if (visibilitySm === null && ceilingFt === null) {
    return null;
  }

  if (isLifr(visibilitySm, ceilingFt)) {
    return "LIFR";
  }

  if (isIfr(visibilitySm, ceilingFt)) {
    return "IFR";
  }

  if (isMvfr(visibilitySm, ceilingFt)) {
    return "MVFR";
  }

  if (hasUnknownCeiling) {
    return null;
  }

  return "VFR";
}

function normalizeMetar(rawMetar) {
  return String(rawMetar ?? "")
    .trim()
    .toUpperCase()
    .replace(/=/g, "")
    .replace(/\s+/g, " ");
}

function mergeFractionalVisibilityTokens(tokens) {
  const mergedTokens = [];

  for (let index = 0; index < tokens.length; index++) {
    const current = tokens[index];
    const next = tokens[index + 1];

    if (/^\d+$/.test(current) && /^M?\d+\/\d+SM$/.test(next || "")) {
      mergedTokens.push(`${current} ${next}`);
      index++;
      continue;
    }

    mergedTokens.push(current);
  }

  return mergedTokens;
}

function getVisibilityInStatuteMiles(tokens) {
  if (tokens.includes("CAVOK")) {
    return 9999 / METERS_PER_STATUTE_MILE;
  }

  const directionalVisibilityIndex = tokens.findIndex(token => /^[NSWE]{1,2}$/.test(token));

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (index > 0 && index === directionalVisibilityIndex - 1) {
      continue;
    }

    const statuteMiles = parseStatuteMileVisibility(token);
    if (statuteMiles !== null) {
      return statuteMiles;
    }

    const metricVisibility = parseMetricVisibility(token);
    if (metricVisibility !== null) {
      return metricVisibility / METERS_PER_STATUTE_MILE;
    }
  }

  return null;
}

function parseMetricVisibility(token) {
  if (/^\d{4}$/.test(token)) {
    return Number(token);
  }

  const noDirectionalVariationMatch = token.match(/^(\d{4})NDV$/);
  if (noDirectionalVariationMatch) {
    return Number(noDirectionalVariationMatch[1]);
  }

  return null;
}

function parseStatuteMileVisibility(token) {
  const normalized = String(token).replace(/^P/, "").replace(/^M/, "");

  if (/^\d+SM$/.test(normalized)) {
    return Number(normalized.replace("SM", ""));
  }

  if (/^\d+\/\d+SM$/.test(normalized)) {
    return parseFraction(normalized.replace("SM", ""));
  }

  if (/^\d+ \d+\/\d+SM$/.test(normalized)) {
    const [whole, fraction] = normalized.replace("SM", "").split(" ");
    return Number(whole) + parseFraction(fraction);
  }

  return null;
}

function parseFraction(value) {
  const [numerator, denominator] = value.split("/").map(Number);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function getCeilingInFeet(tokens) {
  if (tokens.includes("CAVOK")) {
    return 5000;
  }

  const ceilings = tokens
    .map(getCeilingFromToken)
    .filter(value => value !== null);

  return ceilings.length ? Math.min(...ceilings) : null;
}

function getCeilingFromToken(token) {
  const cloudMatch = token.match(/^(BKN|OVC)(\d{3})(CB|TCU)?$/);
  if (cloudMatch) {
    return Number(cloudMatch[2]) * 100;
  }

  const verticalVisibilityMatch = token.match(/^VV(\d{3})$/);
  if (verticalVisibilityMatch) {
    return Number(verticalVisibilityMatch[1]) * 100;
  }

  return null;
}

function hasUnknownCeilingToken(tokens) {
  return tokens.some(token => /^(BKN|OVC|VV)\/{3}/.test(token));
}

function isLifr(visibilitySm, ceilingFt) {
  return isBelow(visibilitySm, 1) || isBelow(ceilingFt, 500);
}

function isIfr(visibilitySm, ceilingFt) {
  return isBelow(visibilitySm, 3) || isBelow(ceilingFt, 1000);
}

function isMvfr(visibilitySm, ceilingFt) {
  return isBelowOrEqual(visibilitySm, 5) || isBelowOrEqual(ceilingFt, 3000);
}

function isBelow(value, threshold) {
  return value !== null && value < threshold;
}

function isBelowOrEqual(value, threshold) {
  return value !== null && value <= threshold;
}
