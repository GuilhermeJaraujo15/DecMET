import pool from "../db.js";

const ICAO_PATTERN = /^[A-Z]{4}$/;
const NON_INDEXABLE_ICAO_CODES = new Set([
  "AAXX",
  "XXXX",
  "ZZZZ",
  "TEST",
  "NULL",
  "NONE"
]);

export function normalizeIcao(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isValidIcao(value) {
  return ICAO_PATTERN.test(normalizeIcao(value));
}

export function isSeoIndexableIcao(value) {
  const normalizedIcao = normalizeIcao(value);

  return isValidIcao(normalizedIcao) && !NON_INDEXABLE_ICAO_CODES.has(normalizedIcao);
}

export async function getAirportByIcao(icao) {
  const normalizedIcao = normalizeIcao(icao);

  if (!isValidIcao(normalizedIcao)) {
    return null;
  }

  const [rows] = await pool.execute(`
    SELECT
      a.id,
      a.ident,
      a.icao_code,
      a.gps_code,
      a.iata_code,
      a.name,
      a.municipality,
      a.iso_region,
      a.iso_country,
      a.type,
      a.latitude_deg,
      a.longitude_deg,
      a.elevation_ft
    FROM airports a
    WHERE
      UPPER(TRIM(a.gps_code)) = ?
      OR UPPER(TRIM(a.icao_code)) = ?
      OR UPPER(TRIM(a.ident)) = ?
    LIMIT 1
  `, [normalizedIcao, normalizedIcao, normalizedIcao]);

  return rows.length > 0 ? normalizeAirport(rows[0]) : null;
}

export async function getSeoAirportByIcao(icao) {
  const normalizedIcao = normalizeIcao(icao);

  if (!isSeoIndexableIcao(normalizedIcao)) {
    return null;
  }

  const [rows] = await pool.execute(`
    SELECT
      a.id,
      a.ident,
      a.icao_code,
      a.gps_code,
      a.iata_code,
      a.name,
      a.municipality,
      a.iso_region,
      a.iso_country,
      a.type,
      a.latitude_deg,
      a.longitude_deg,
      a.elevation_ft
    FROM airports a
    WHERE
      a.type IS NOT NULL
      AND a.type <> 'closed'
      AND a.name IS NOT NULL
      AND TRIM(a.name) <> ''
      AND (
        UPPER(TRIM(a.icao_code)) = ?
        OR UPPER(TRIM(a.gps_code)) = ?
      )
    ORDER BY
      CASE
        WHEN UPPER(TRIM(a.icao_code)) = ? THEN 0
        WHEN UPPER(TRIM(a.gps_code)) = ? THEN 1
        ELSE 2
      END,
      a.id ASC
    LIMIT 1
  `, [normalizedIcao, normalizedIcao, normalizedIcao, normalizedIcao]);

  return rows.length > 0 ? normalizeAirport(rows[0]) : null;
}

export async function getAllSeoIcaos() {
  const [rows] = await pool.execute(`
    SELECT DISTINCT
      CASE
        WHEN UPPER(TRIM(a.icao_code)) REGEXP '^[A-Z]{4}$' THEN UPPER(TRIM(a.icao_code))
        WHEN UPPER(TRIM(a.gps_code)) REGEXP '^[A-Z]{4}$' THEN UPPER(TRIM(a.gps_code))
        ELSE NULL
      END AS icao
    FROM airports a
    WHERE
      a.type IS NOT NULL
      AND a.type <> 'closed'
      AND a.name IS NOT NULL
      AND TRIM(a.name) <> ''
      AND (
        UPPER(TRIM(a.icao_code)) REGEXP '^[A-Z]{4}$'
        OR UPPER(TRIM(a.gps_code)) REGEXP '^[A-Z]{4}$'
      )
    HAVING icao IS NOT NULL
    ORDER BY icao ASC
  `);

  return [...new Set(rows
    .map(row => normalizeIcao(row.icao))
    .filter(isSeoIndexableIcao))];
}

function normalizeAirport(row) {
  const displayIcao = getDisplayIcao(row);

  return {
    ...row,
    display_icao: displayIcao,
    icao_code: displayIcao,
    iata_code: normalizeOptionalCode(row.iata_code),
    latitude_deg: normalizeNumber(row.latitude_deg),
    longitude_deg: normalizeNumber(row.longitude_deg),
    elevation_ft: normalizeNumber(row.elevation_ft)
  };
}

function getDisplayIcao(row) {
  const candidates = [row.icao_code, row.gps_code, row.ident];

  for (const value of candidates) {
    const code = normalizeIcao(value);
    if (ICAO_PATTERN.test(code)) return code;
  }

  return null;
}

function normalizeOptionalCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
