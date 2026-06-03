-- =============================================================================
-- DecMeT System - Airport Database Schema
-- Database structure based on the OurAirports open data dataset.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS decmet_airports
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE decmet_airports;

-- -----------------------------------------------------------------------------
-- Table: countries
-- Stores country data with ISO code as key relationship.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  id INT PRIMARY KEY,
  code CHAR(2) NOT NULL,
  name VARCHAR(150) NOT NULL,
  continent CHAR(2),
  wikipedia_link TEXT,
  keywords TEXT,

  UNIQUE KEY uk_countries_code (code),
  KEY idx_countries_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: regions
-- Stores sub-national region data linked to countries.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id INT PRIMARY KEY,
  code VARCHAR(16) NOT NULL,
  local_code VARCHAR(16),
  name VARCHAR(150) NOT NULL,
  continent CHAR(2),
  iso_country CHAR(2),
  wikipedia_link TEXT,
  keywords TEXT,

  UNIQUE KEY uk_regions_code (code),
  KEY idx_regions_country (iso_country),
  KEY idx_regions_name (name),
  CONSTRAINT fk_regions_country
    FOREIGN KEY (iso_country)
    REFERENCES countries(code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: airports
-- Main table containing aerodromes, airports, and heliports.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS airports (
  id INT PRIMARY KEY,
  ident VARCHAR(16) NOT NULL,
  type ENUM(
    'balloonport',
    'closed_airport',
    'heliport',
    'large_airport',
    'medium_airport',
    'seaplane_base',
    'small_airport'
  ) NOT NULL,
  name VARCHAR(255) NOT NULL,
  latitude_deg DECIMAL(10,7),
  longitude_deg DECIMAL(10,7),
  elevation_ft INT,
  continent CHAR(2),
  iso_country CHAR(2),
  iso_region VARCHAR(16),
  municipality VARCHAR(150),
  scheduled_service ENUM('yes', 'no') DEFAULT 'no',
  gps_code VARCHAR(16),
  icao_code CHAR(4),
  iata_code CHAR(3),
  local_code VARCHAR(16),
  home_link TEXT,
  wikipedia_link TEXT,
  keywords TEXT,

  UNIQUE KEY uk_airports_ident (ident),
  KEY idx_airports_icao (icao_code),
  KEY idx_airports_iata (iata_code),
  KEY idx_airports_name (name),
  KEY idx_airports_municipality (municipality),
  KEY idx_airports_country (iso_country),
  KEY idx_airports_region (iso_region),
  KEY idx_airports_type (type),
  KEY idx_airports_scheduled (scheduled_service),

  -- FULLTEXT key for advanced search on textual and identifier fields
  FULLTEXT KEY ft_airports_search (
    ident,
    name,
    municipality,
    gps_code,
    icao_code,
    iata_code,
    local_code,
    keywords
  ),

  -- Foreign Key constraints for integrity with countries and regions tables
  CONSTRAINT fk_airports_country
    FOREIGN KEY (iso_country)
    REFERENCES countries(code)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_airports_region
    FOREIGN KEY (iso_region)
    REFERENCES regions(code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
