# L4 · Data Layer — the geodatabase

PostgreSQL 16 + PostGIS 3.4 is the **system of record**. It is the OSS
equivalent of an Esri enterprise geodatabase (ArcSDE): typed spatial columns,
spatial indexes, referential integrity, least-privilege roles, and row-level
versioning/archiving via triggers.

Defined by three idempotent SQL files (auto-run on first container start, safe
to re-run): [`../sql/01_roles_db.sql`](../sql/01_roles_db.sql),
[`02_schema.sql`](../sql/02_schema.sql), [`03_audit_triggers.sql`](../sql/03_audit_triggers.sql).

## 1. Schemas (subject areas)
| Schema | Purpose | Key tables |
|--------|---------|-----------|
| `core` | network + structures | `network_links` (PK link_id, MultiLineString), `bridges` (PK bridge_no, Point, FK→links) |
| `traffic` | ATC / TIS | `atc_sites` (Point, `adt_by_class` jsonb) |
| `pms` | condition / FWD | `link_condition` (FK→links), `fwd_bowls` |
| `rms` | inventory / reserve / capture | `inventory_links` (jsonb features), `captures` |
| `audit` | versioning | `history` (+ `log_change()`, `restore_row()`) |

Loaded volumes (validated): network_links 1,017 · bridges 545 (546 − 1 dup) ·
link_condition 1,015 · fwd_bowls 3,673 · atc_sites 10 · inventory_links 191.

## 2. Roles (least privilege) — `01_roles_db.sql`
| Role | Rights | Used by |
|------|--------|---------|
| `gis_admin` | owner — DDL, publish, maintenance | gisctl, pgAdmin, ETL |
| `gis_editor` | SELECT/INSERT/UPDATE/DELETE on data schemas | GeoServer WFS-T, QGIS edit |
| `gis_viewer` | SELECT | GeoServer read, QGIS view |
| `svc_web` | SELECT (+ INSERT on `rms.captures`) | pg_tileserv, pg_featureserv |

The public web origin only ever reaches `svc_web`. Editing requires
authenticated `gis_editor`. `gis_admin` is never exposed to a service.

## 3. Indexing & geometry
- GiST spatial indexes on every geometry column (e.g. `network_links_geom_gix`).
- `pg_trgm` GIN index on `link_name` for fast fuzzy search.
- All geometry stored EPSG:4326; services reproject (3857 for web tiles).
- Z-dimension shapefiles are flattened on load (`shapely.force_2d`) and
  LineString→MultiLineString coerced for a clean typed column.

## 4. Versioning / archiving — `03_audit_triggers.sql`
The OSS answer to geodatabase archiving. A trigger on **every** data-schema
table writes old/new row JSON to `audit.history` with the PK, DB user and the
app user (`current_setting('ugroads.app_user')`).

```sql
-- who changed B204, when, and to what
SELECT id, happened_at, db_user, app_user, op, pk
FROM audit.history WHERE schema_name='core' AND table_name='bridges'
ORDER BY id DESC LIMIT 20;

-- time-travel / undo a specific change or deletion
SELECT audit.restore_row('core.bridges', 84217);
```
This makes every edit traceable and reversible — exactly like Esri archiving,
but in plain SQL you fully own.

## 5. ETL — loading & syncing
- **Load G: masters → PostGIS:** [`../etl/load_geodata.py`](../etl/load_geodata.py)
  (GeoPandas/GDAL). TRUNCATE…CASCADE + `to_postgis(if_exists='append')` preserves
  schema, FKs and triggers; coerces types; dedupes the known duplicate bridge
  `B727`; drops 2 orphan condition link-ids (pre-FY25/26).
- **PostGIS → public bundle:** [`../etl/sync_bundle.py`](../etl/sync_bundle.py)
  regenerates `public/data/*.json|geojson` so the static SPAs stay fed after DB
  edits.

**Data-quality findings to fix at source:** duplicate bridge `B727` in
`uganda_bridges_bms_inventory_elements_conditions.csv`; orphan condition link-ids
`C360_Link03`, `C844_Link03`.

## 6. Backup / restore / repair
Via `gisctl` (works even with no host pg client — falls back to docker exec):
```
python tools/gisctl.py backup                 # pg_dump -Fc → db_backups/
python tools/gisctl.py restore <dump> --dry-run
python tools/gisctl.py repair                 # ST_MakeValid all geometries
python tools/gisctl.py vacuum | reindex
```
See [`05-operations.md`](05-operations.md) for schedules and DR.
