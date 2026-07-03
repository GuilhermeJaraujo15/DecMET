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
      a.icao,
      a.ident,
      a.gps_code,
      a.iata_code,
      a.name,
      a.municipality,
      a.iso_country,
      a.type,
      a.latitude_deg,
      a.longitude_deg,
      a.elevation_ft
    FROM airports a
    WHERE a.icao = ?
    LIMIT 1
  `, [normalizedIcao]);

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
      a.icao,
      a.ident,
      a.gps_code,
      a.iata_code,
      a.name,
      a.municipality,
      a.iso_country,
      a.type,
      a.latitude_deg,
      a.longitude_deg,
      a.elevation_ft
    FROM airports a
    WHERE
      a.type IS NOT NULL
      AND a.type <> 'closed_airport'
      AND a.name IS NOT NULL
      AND TRIM(a.name) <> ''
      AND a.icao = ?
    ORDER BY
      a.id ASC
    LIMIT 1
  `, [normalizedIcao]);

  return rows.length > 0 ? normalizeAirport(rows[0]) : null;
}

export async function getAllSeoIcaos() {
  const [rows] = await pool.execute(`
    SELECT DISTINCT
      a.icao
    FROM airports a
    WHERE
      a.type IS NOT NULL
      AND a.type <> 'closed_airport'
      AND a.name IS NOT NULL
      AND TRIM(a.name) <> ''
      AND a.icao REGEXP '^[A-Z]{4}$'
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
    icao: displayIcao,
    display_icao: displayIcao,
    icao_code: displayIcao,
    iata_code: normalizeOptionalCode(row.iata_code),
    latitude_deg: normalizeNumber(row.latitude_deg),
    longitude_deg: normalizeNumber(row.longitude_deg),
    elevation_ft: normalizeNumber(row.elevation_ft)
  };
}

function getDisplayIcao(row) {
  const code = normalizeIcao(row.icao);

  return ICAO_PATTERN.test(code) ? code : null;
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
