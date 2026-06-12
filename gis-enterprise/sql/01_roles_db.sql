-- ════════════════════════════════════════════════════════════════════════════
-- UGROADS GIS Enterprise · 01 — database + roles (run as postgres superuser)
-- psql -U postgres -f sql/01_roles_db.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Roles (change these passwords, then keep them ONLY in gis-enterprise/.env)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gis_admin') THEN
    CREATE ROLE gis_admin LOGIN PASSWORD 'CHANGE_ME_admin' CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gis_editor') THEN
    CREATE ROLE gis_editor LOGIN PASSWORD 'CHANGE_ME_editor';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gis_viewer') THEN
    CREATE ROLE gis_viewer LOGIN PASSWORD 'CHANGE_ME_viewer';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='svc_web') THEN
    CREATE ROLE svc_web LOGIN PASSWORD 'CHANGE_ME_service';
  END IF;
END $$;

-- Database
SELECT 'CREATE DATABASE ugroads OWNER gis_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='ugroads') \gexec

\connect ugroads

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search on names
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- uuid/digests for audit

COMMENT ON DATABASE ugroads IS
  'UGROADS enterprise geodatabase — Uganda national road network (DNR/MoWT)';
