import pool from "../db.js";

const ICAO_PATTERN = /^[A-Z]{4}$/;

export function normalizeIcao(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isValidIcao(value) {
  return ICAO_PATTERN.test(normalizeIcao(value));
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
      a.gps_code = ?
      OR a.icao_code = ?
      OR a.ident = ?
    LIMIT 1
  `, [normalizedIcao, normalizedIcao, normalizedIcao]);

  return rows.length > 0 ? normalizeAirport(rows[0]) : null;
}

export async function getAllSeoIcaos() {
  const [rows] = await pool.execute(`
    SELECT DISTINCT
      CASE
        WHEN gps_code REGEXP '^[A-Z]{4}$' THEN gps_code
        WHEN icao_code REGEXP '^[A-Z]{4}$' THEN icao_code
        WHEN ident REGEXP '^[A-Z]{4}$' THEN ident
        ELSE NULL
      END AS icao
    FROM airports
    HAVING icao IS NOT NULL
    ORDER BY icao ASC
  `);

  return rows.map(row => row.icao);
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
  const candidates = [row.gps_code, row.icao_code, row.ident];

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
