-- =============================================================================
-- DecMeT System - OurAirports CSV Data Import Template
-- This script contains LOAD DATA LOCAL INFILE statements to import OurAirports dataset.
-- =============================================================================

USE decmet_airports;

-- 1. Temporarily disable foreign key constraints to allow safe truncation and bulk loading
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE airports;
TRUNCATE TABLE regions;
TRUNCATE TABLE countries;

-- Re-enable constraints for validation during import
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 2. IMPORT countries.csv
-- =============================================================================
-- Note: Adjust the file path to point to your local copy of countries.csv
LOAD DATA LOCAL INFILE './data/countries.csv'
INTO TABLE countries
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id, code, name, continent, wikipedia_link, keywords);

-- =============================================================================
-- 3. IMPORT regions.csv
-- =============================================================================
-- Note: Adjust the file path to point to your local copy of regions.csv
LOAD DATA LOCAL INFILE './data/regions.csv'
INTO TABLE regions
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id, code, local_code, name, continent, iso_country, wikipedia_link, keywords);

-- =============================================================================
-- 4. IMPORT airports.csv
-- =============================================================================
-- Note: Adjust the file path to point to your local copy of airports.csv
-- For fields that might have empty/blank values in the CSV (like elevation_ft,
-- latitude_deg, longitude_deg, icao_code, iata_code), MySQL's LOAD DATA will
-- automatically set empty strings for VARCHAR/CHAR, and default 0 or NULL for
-- numeric columns depending on SQL Mode. A more robust way to handle empty values 
-- is documented in README_DB.md.
LOAD DATA LOCAL INFILE './data/airports.csv'
INTO TABLE airports
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(
  id,
  ident,
  type,
  name,
  latitude_deg,
  longitude_deg,
  elevation_ft,
  continent,
  iso_country,
  iso_region,
  municipality,
  scheduled_service,
  icao_code,
  iata_code,
  gps_code,
  local_code,
  home_link,
  wikipedia_link,
  keywords
);
