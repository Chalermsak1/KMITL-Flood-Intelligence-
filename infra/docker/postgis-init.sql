-- Enable PostGIS spatial database extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify PostGIS installation
DO $$
BEGIN
    RAISE NOTICE 'PostGIS Version: %', postgis_version();
END $$;
