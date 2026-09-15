/**
 * Airport Controller
 * Handles search and suggestions for airport data from MySQL
 */

import { getDatabaseConnection, getPublicDatabaseError, logDatabaseError } from "../db.js";
import { cachePublicResponse, disableResponseCache } from "../utils/http-cache.js";

/**
 * Helper function to read the canonical ICAO code.
 * The airports.icao column is populated during import cleanup and is the only
 * source of truth for operational ICAO identifiers.
 * The API never uses IATA as the primary operational code.
 */
function getDisplayIcao(row) {
  const code = normalizeCode(row.icao);

  return /^[A-Z]{4}$/.test(code) ? code : null;
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function getIataCode(row) {
  const iata = normalizeCode(row.iata_code);

  return /^[A-Z0-9]{3}$/.test(iata) ? iata : null;
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
    icao: displayIcao,
    icao_code: displayIcao,
    iata_code: getIataCode(row),
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
  if (typeof query !== "string" || query.length > 100) return null;

  let normalized = query.trim().toUpperCase();

  // Reject if empty or too long
  if (!normalized || normalized.length > 100) return null;

  return normalized;
}

function escapeLike(value) {
  // Explicit escape character works with or without NO_BACKSLASH_ESCAPES.
  return value.replace(/[!%_]/g, "!$&");
}

/**
 * GET /api/aeroportos/:id
 * Returns one exact airport by database ID
 */
export async function getAirportById(req, res) {
  disableResponseCache(res);
  try {
    const { id } = req.params;

    if (!/^\d{1,10}$/.test(String(id)) || Number(id) > 2147483647) {
      return res.status(400).json({
        success: false,
        error: "Invalid airport ID",
        message: "Airport ID must be numeric"
      });
    }

    const connection = await getDatabaseConnection();

    try {
      const sqlQuery = `
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

      cachePublicResponse(res, 3600);
      res.json({
        success: true,
        result: normalizeAirport(rows[0])
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    return sendDatabaseError(res, "getAirportById", error);
  }
}

/**
 * GET /api/aeroportos/icao/:icao
 * Returns one exact airport by canonical ICAO code
 */
export async function getAirportByIcao(req, res) {
  disableResponseCache(res);
  try {
    const icao = normalizeCode(req.params.icao);

    if (!/^[A-Z]{4}$/.test(icao)) {
      return res.status(400).json({
        success: false,
        error: "Invalid ICAO code",
        message: "ICAO code must contain exactly 4 letters"
      });
    }

    const connection = await getDatabaseConnection();

    try {
      const sqlQuery = `
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
      `;

      const [rows] = await connection.execute(sqlQuery, [icao]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Airport not found",
          message: "No airport found for this ICAO code"
        });
      }

      cachePublicResponse(res, 3600);
      res.json({
        success: true,
        result: normalizeAirport(rows[0])
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    return sendDatabaseError(res, "getAirportByIcao", error);
  }
}

/**
 * GET /api/aeroportos?search=<query>
 * Returns complete airport search results
 */
export async function searchAirports(req, res) {
  disableResponseCache(res);
  try {
    const search = req.query.search ?? req.query.q;
    const query = normalizeQuery(search);

    if (!query) {
      return res.status(400).json({
        error: "Invalid search query",
        message: "Search term must be 1-100 characters"
      });
    }

    const connection = await getDatabaseConnection();

    try {
      // Prepare LIKE pattern
      const likePattern = `%${escapeLike(query)}%`;

      // SQL query using airports.icao as the canonical ICAO source.
      const sqlQuery = `
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
          a.icao = ?
          OR a.iata_code = ?
          OR a.name LIKE ? ESCAPE '!'
          OR a.municipality LIKE ? ESCAPE '!'
          OR a.keywords LIKE ? ESCAPE '!'
        ORDER BY
          CASE
            WHEN a.icao = ? THEN 1
            WHEN a.iata_code = ? THEN 2
            WHEN a.name LIKE ? ESCAPE '!' THEN 3
            WHEN a.municipality LIKE ? ESCAPE '!' THEN 4
            WHEN a.keywords LIKE ? ESCAPE '!' THEN 5
            ELSE 7
          END,
          a.type = 'large_airport' DESC,
          a.type = 'medium_airport' DESC,
          a.name ASC
        LIMIT 25
      `;

      const [rows] = await connection.execute(sqlQuery, [
        query, query,
        likePattern, likePattern, likePattern,
        query, query,
        likePattern, likePattern, likePattern
      ]);

      const results = rows.map(normalizeAirport);
      cachePublicResponse(res, 300);

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
    return sendDatabaseError(res, "searchAirports", error);
  }
}

/**
 * GET /api/aeroportos/sugestoes?search=<query>
 * Returns lightweight autocomplete suggestions
 */
export async function getAirportSuggestions(req, res) {
  disableResponseCache(res);
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
      cachePublicResponse(res, 300);
      return res.json({
        success: true,
        suggestions: [],
        message: "Query too short"
      });
    }

    if (query.length < 3 && !/^[A-Z]{2,4}$/.test(query)) {
      cachePublicResponse(res, 300);
      return res.json({
        success: true,
        suggestions: [],
        message: "Type at least 3 characters for text search, or 2+ for airport codes"
      });
    }

    const connection = await getDatabaseConnection();

    try {
      const codePrefixPattern = `${escapeLike(query)}%`;
      const likePattern = `%${escapeLike(query)}%`;

      // Lightweight SQL for suggestions using airports.icao as the display code.
      const sqlQuery = `
        SELECT
          a.id,
          a.icao,
          a.ident,
          a.gps_code,
          a.iata_code,
          a.name,
          a.municipality,
          a.iso_country,
          a.type
        FROM airports a
        WHERE
          a.icao LIKE ? ESCAPE '!'
          OR a.iata_code LIKE ? ESCAPE '!'
          OR a.name LIKE ? ESCAPE '!'
          OR a.municipality LIKE ? ESCAPE '!'
        ORDER BY
          CASE
            WHEN a.icao = ? THEN 1
            WHEN a.iata_code = ? THEN 2
            WHEN a.icao LIKE ? ESCAPE '!' THEN 3
            WHEN a.iata_code LIKE ? ESCAPE '!' THEN 4
            WHEN a.name LIKE ? ESCAPE '!' THEN 5
            WHEN a.municipality LIKE ? ESCAPE '!' THEN 6
            ELSE 8
          END,
          a.type = 'large_airport' DESC,
          a.type = 'medium_airport' DESC,
          a.name ASC
        LIMIT 10
      `;

      const [rows] = await connection.execute(sqlQuery, [
        codePrefixPattern, codePrefixPattern,
        likePattern, likePattern,
        query, query,
        codePrefixPattern, codePrefixPattern, likePattern, likePattern
      ]);

      const suggestions = rows.map(normalizeAirport);
      cachePublicResponse(res, 300);

      res.json({
        success: true,
        count: suggestions.length,
        suggestions
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    return sendDatabaseError(res, "getAirportSuggestions", error);
  }
}

function sendDatabaseError(res, context, error) {
  disableResponseCache(res);
  logDatabaseError(context, error);
  const publicError = getPublicDatabaseError(error);

  return res.status(publicError.status).json({
    success: false,
    error: publicError.error,
    message: publicError.message
  });
}
