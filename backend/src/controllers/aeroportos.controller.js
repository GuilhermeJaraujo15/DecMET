/**
 * Airport Controller
 * Handles search and suggestions for airport data from MySQL
 */

import pool from "../db.js";

/**
 * Helper function to build display ICAO code
 * Priority: GPS/location indicator > ICAO column > 4-letter ident > null.
 * The API never uses IATA as the primary operational code.
 */
function getDisplayIcao(row) {
  const candidates = [row.gps_code, row.icao_code, row.ident];

  for (const value of candidates) {
    const code = normalizeCode(value);
    if (/^[A-Z]{4}$/.test(code)) return code;
  }

  return null;
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function looksLikeLegacySwappedImport(row, displayIcao) {
  const legacyIataColumn = normalizeCode(row.icao_code);
  const truncatedGpsColumn = normalizeCode(row.iata_code);

  return Boolean(
    displayIcao &&
    /^[A-Z]{3}$/.test(legacyIataColumn) &&
    truncatedGpsColumn === displayIcao.slice(0, 3)
  );
}

function getIataCode(row, displayIcao) {
  const iata = normalizeCode(row.iata_code);
  const legacyIata = normalizeCode(row.icao_code);

  if (looksLikeLegacySwappedImport(row, displayIcao)) return legacyIata;
  if (/^[A-Z0-9]{3}$/.test(iata) && iata !== displayIcao?.slice(0, 3)) return iata;
  if (/^[A-Z0-9]{3}$/.test(legacyIata) && legacyIata !== displayIcao?.slice(0, 3)) return legacyIata;

  return null;
}

function getOperationalTypeLabel(type) {
  const labels = {
    large_airport: "Aeródromo de avião",
    medium_airport: "Aeródromo de avião",
    small_airport: "Aeródromo de avião",
    heliport: "Heliponto",
    seaplane_base: "Hidrobase",
    balloonport: "Área de balonismo",
    closed_airport: "Aeródromo fechado"
  };

  return labels[type] || "Aeródromo";
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAirport(row) {
  const displayIcao = getDisplayIcao(row);

  return {
    ...row,
    icao_code: displayIcao,
    iata_code: getIataCode(row, displayIcao),
    latitude_deg: normalizeNumber(row.latitude_deg),
    longitude_deg: normalizeNumber(row.longitude_deg),
    elevation_ft: normalizeNumber(row.elevation_ft),
    display_icao: displayIcao,
    operation_type_label: getOperationalTypeLabel(row.type)
  };
}

/**
 * Normalize search query for safe database queries
 */
function normalizeQuery(query) {
  if (!query) return null;

  let normalized = query.trim().toUpperCase();

  // Reject if empty or too long
  if (!normalized || normalized.length > 100) return null;

  return normalized;
}

/**
 * GET /api/aeroportos/:id
 * Returns one exact airport by database ID
 */
export async function getAirportById(req, res) {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        error: "Invalid airport ID",
        message: "Airport ID must be numeric"
      });
    }

    const connection = await pool.getConnection();

    try {
      const sqlQuery = `
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
        WHERE a.id = ?
        LIMIT 1
      `;

      const [rows] = await connection.execute(sqlQuery, [id]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Airport not found",
          message: "No airport found for this ID"
        });
      }

      res.json({
        success: true,
        result: normalizeAirport(rows[0])
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Error in getAirportById:", error);
    res.status(500).json({
      success: false,
      error: "Database query failed",
      message: error.message
    });
  }
}

/**
 * GET /api/aeroportos?search=<query>
 * Returns complete airport search results
 */
export async function searchAirports(req, res) {
  try {
    const search = req.query.search ?? req.query.q;
    const query = normalizeQuery(search);

    if (!query) {
      return res.status(400).json({
        error: "Invalid search query",
        message: "Search term must be 1-100 characters"
      });
    }

    const connection = await pool.getConnection();

    try {
      // Prepare LIKE pattern
      const likePattern = `%${query}%`;

      // SQL query with computed display_icao
      const sqlQuery = `
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
          a.ident = ?
          OR a.gps_code = ?
          OR a.icao_code = ?
          OR a.iata_code = ?
          OR a.name LIKE ?
          OR a.municipality LIKE ?
          OR a.keywords LIKE ?
        ORDER BY
          CASE
            WHEN a.ident = ? THEN 1
            WHEN a.gps_code = ? THEN 2
            WHEN a.icao_code = ? THEN 3
            WHEN a.iata_code = ? THEN 4
            WHEN a.name LIKE ? THEN 5
            WHEN a.municipality LIKE ? THEN 6
            ELSE 7
          END,
          a.type = 'large_airport' DESC,
          a.type = 'medium_airport' DESC,
          a.name ASC
        LIMIT 25
      `;

      const [rows] = await connection.execute(sqlQuery, [
        query, query, query, query,
        likePattern, likePattern, likePattern,
        query, query, query, query,
        likePattern, likePattern
      ]);

      const results = rows.map(normalizeAirport);

      if (results.length === 0) {
        return res.json({
          success: true,
          count: 0,
          results: [],
          message: "No airports found for this search"
        });
      }

      res.json({
        success: true,
        count: results.length,
        results
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Error in searchAirports:", error);
    res.status(500).json({
      error: "Database query failed",
      message: error.message
    });
  }
}

/**
 * GET /api/aeroportos/sugestoes?search=<query>
 * Returns lightweight autocomplete suggestions
 */
export async function getAirportSuggestions(req, res) {
  try {
    const search = req.query.search ?? req.query.q;
    const query = normalizeQuery(search);

    if (!query) {
      return res.status(400).json({
        error: "Invalid search query",
        message: "Search term must be 1-100 characters"
      });
    }

    // For short queries, only suggest if looks like a code
    if (query.length < 2) {
      return res.json({
        success: true,
        suggestions: [],
        message: "Query too short"
      });
    }

    if (query.length < 3 && !/^[A-Z]{2,4}$/.test(query)) {
      return res.json({
        success: true,
        suggestions: [],
        message: "Type at least 3 characters for text search, or 2+ for airport codes"
      });
    }

    const connection = await pool.getConnection();

    try {
      const likePattern = `%${query}%`;

      // Lightweight SQL for suggestions
      const sqlQuery = `
        SELECT
          a.id,
          a.ident,
          a.icao_code,
          a.gps_code,
          a.iata_code,
          a.name,
          a.municipality,
          a.iso_country,
          a.type
        FROM airports a
        WHERE
          a.ident LIKE ?
          OR a.gps_code LIKE ?
          OR a.icao_code LIKE ?
          OR a.iata_code LIKE ?
          OR a.name LIKE ?
          OR a.municipality LIKE ?
        ORDER BY
          CASE
            WHEN a.ident = ? THEN 1
            WHEN a.gps_code = ? THEN 2
            WHEN a.icao_code = ? THEN 3
            WHEN a.iata_code = ? THEN 4
            WHEN a.ident LIKE ? THEN 5
            WHEN a.gps_code LIKE ? THEN 6
            WHEN a.name LIKE ? THEN 7
            ELSE 8
          END,
          a.type = 'large_airport' DESC,
          a.type = 'medium_airport' DESC,
          a.name ASC
        LIMIT 10
      `;

      const [rows] = await connection.execute(sqlQuery, [
        likePattern, likePattern, likePattern, likePattern,
        likePattern, likePattern,
        query, query, query, query,
        likePattern, likePattern, likePattern
      ]);

      const suggestions = rows.map(normalizeAirport);

      res.json({
        success: true,
        count: suggestions.length,
        suggestions
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Error in getAirportSuggestions:", error);
    res.status(500).json({
      error: "Database query failed",
      message: error.message
    });
  }
}
