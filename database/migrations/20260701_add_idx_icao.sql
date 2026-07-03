-- Adds the canonical ICAO lookup index used by DecMET airport searches.
-- Run this in the DecMET database/schema that contains the airports table.

SET @idx_icao_exists = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'airports'
    AND index_name = 'idx_icao'
);

SET @idx_icao_sql = IF(
  @idx_icao_exists = 0,
  'CREATE INDEX idx_icao ON airports (icao)',
  'SELECT ''idx_icao already exists'' AS message'
);

PREPARE idx_icao_stmt FROM @idx_icao_sql;
EXECUTE idx_icao_stmt;
DEALLOCATE PREPARE idx_icao_stmt;
