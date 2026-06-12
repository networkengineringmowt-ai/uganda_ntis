-- ════════════════════════════════════════════════════════════════════════════
-- UGROADS GIS Enterprise · 02 — schemas, tables, indexes, grants
-- psql -U gis_admin -d ugroads -f sql/02_schema.sql       (safe to re-run)
-- Mirrors the FY25-26 canonical masters loaded by etl/load_geodata.py.
-- ════════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS core    AUTHORIZATION gis_admin;  -- network + structures
CREATE SCHEMA IF NOT EXISTS traffic AUTHORIZATION gis_admin;  -- ATC / TIS
CREATE SCHEMA IF NOT EXISTS pms     AUTHORIZATION gis_admin;  -- condition / FWD
CREATE SCHEMA IF NOT EXISTS rms     AUTHORIZATION gis_admin;  -- inventory / reserve
CREATE SCHEMA IF NOT EXISTS audit   AUTHORIZATION gis_admin;  -- versioning

-- ── core.network_links — FY25-26 NDPIV master + network2026 geometry ─────────
CREATE TABLE IF NOT EXISTS core.network_links (
  link_id        text PRIMARY KEY,
  road_no        text,
  road_class     text,
  link_name      text,
  chainage_from  numeric,
  chainage_to    numeric,
  length_km      numeric,
  surface_type   text,
  station        text,
  region         text,
  completion_yr  int,
  rehab_yr       int,
  last_interv    int,
  pavement_age   numeric,
  ndpiv_1        text,
  ndpiv_2        text,
  funder         text,
  oprc           text,
  geom           geometry(MultiLineString, 4326)
);
CREATE INDEX IF NOT EXISTS network_links_geom_gix ON core.network_links USING gist (geom);
CREATE INDEX IF NOT EXISTS network_links_name_trgm ON core.network_links USING gin (link_name gin_trgm_ops);

-- ── core.bridges — BMS inventory + element conditions (546) ──────────────────
CREATE TABLE IF NOT EXISTS core.bridges (
  bridge_no       text PRIMARY KEY,
  bridge_name     text,
  link_id         text REFERENCES core.network_links(link_id) ON UPDATE CASCADE,
  link_name       text,
  road_no         text,
  region          text,
  river           text,
  chainage_km     numeric,
  type_crossing   text,
  bridge_type     text,
  deck_material   text,
  spans           int,
  length_m        numeric,
  width_m         numeric,
  lanes           int,
  completion_yr   int,
  last_interv     int,
  scour_risk      text,
  r_approaches    numeric,
  r_roadway       numeric,
  r_substructure  numeric,
  r_superstructure numeric,
  r_waterway      numeric,
  overall_rating  text,
  bms_product     numeric,
  growth_rate     numeric,
  predicted_aadt  numeric,
  inspection_note text,
  geom            geometry(Point, 4326)
);
CREATE INDEX IF NOT EXISTS bridges_geom_gix ON core.bridges USING gist (geom);

-- ── pms.link_condition — measured 2024 survey ────────────────────────────────
CREATE TABLE IF NOT EXISTS pms.link_condition (
  link_id   text PRIMARY KEY REFERENCES core.network_links(link_id),
  iri       numeric, rut_mm numeric, cracking numeric,
  pci       numeric, vci numeric, surface text, survey_year int
);

-- ── pms.fwd_bowls — deflection surveys (3,673 bowls) ─────────────────────────
CREATE TABLE IF NOT EXISTS pms.fwd_bowls (
  id        bigserial PRIMARY KEY,
  road      text, sheet text, chainage_km numeric,
  d0 numeric, d300 numeric, d600 numeric, d900 numeric, load_kn numeric
);
CREATE INDEX IF NOT EXISTS fwd_road_ix ON pms.fwd_bowls(road, chainage_km);

-- ── traffic.atc_sites — post-2025 ATC ADT by class ───────────────────────────
CREATE TABLE IF NOT EXISTS traffic.atc_sites (
  site        text PRIMARY KEY,
  link        text, road_section text, region text,
  survey_days int, adt_total numeric, avg_speed numeric,
  adt_by_class jsonb,
  geom        geometry(Point, 4326)
);
CREATE INDEX IF NOT EXISTS atc_sites_geom_gix ON traffic.atc_sites USING gist (geom);

-- ── rms.inventory_links — 2022-23 measured field inventory per link ──────────
CREATE TABLE IF NOT EXISTS rms.inventory_links (
  link_id        text PRIMARY KEY,
  link_name      text, region text, station text,
  material       text, road_width_m numeric,
  shoulder_pct   numeric, shoulder_width_m numeric,
  reserve_width_m numeric, lanes text, terrain text,
  line_features  jsonb, point_features jsonb,
  line_records   int, point_records int
);

-- ── rms.captures — field submissions (mirrors captures/*.jsonl) ──────────────
CREATE TABLE IF NOT EXISTS rms.captures (
  id          bigserial PRIMARY KEY,
  tbl         text NOT NULL,
  op          text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  payload     jsonb NOT NULL
);

-- ── Grants (least privilege) ──────────────────────────────────────────────────
GRANT USAGE ON SCHEMA core, traffic, pms, rms TO gis_viewer, gis_editor, svc_web;
GRANT SELECT ON ALL TABLES IN SCHEMA core, traffic, pms, rms TO gis_viewer, svc_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, traffic, pms, rms TO gis_editor;
GRANT INSERT ON rms.captures TO svc_web;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pms, rms TO gis_editor, svc_web;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, traffic, pms, rms
  GRANT SELECT ON TABLES TO gis_viewer, svc_web;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, traffic, pms, rms
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gis_editor;
