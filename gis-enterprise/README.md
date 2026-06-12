# UGROADS GIS Enterprise — Open-Source Spatial Backend
### A zero-cost, zero-licence equivalent of ArcGIS Enterprise for the Department of National Roads

> Companion to the UGROADS platform (React frontend · G: Drive canonical store).
> Everything here is free and open source: PostgreSQL/PostGIS, GeoServer,
> pg_tileserv/pg_featureserv, QGIS, GDAL, Python. No licence fees, ever.

---

## 1 · The ESRI-to-Open-Source mapping

| ESRI component (paid)            | Open-source equivalent (this stack)         | Role |
|----------------------------------|---------------------------------------------|------|
| Enterprise Geodatabase (ArcSDE)  | **PostgreSQL 16 + PostGIS 3.4**             | Authoritative spatial database |
| ArcGIS Server (map/feature svc)  | **GeoServer** (WMS/WFS/WMTS/WCS/OGC API)    | Full OGC web services |
| Hosted feature/tile layers       | **pg_featureserv + pg_tileserv**            | Instant REST GeoJSON + MVT vector tiles straight from PostGIS |
| ArcGIS Pro                       | **QGIS Desktop**                            | Editing, cartography, direct DB repair |
| ModelBuilder / FME               | **Python + GeoPandas + GDAL/ogr2ogr**       | ETL (extends the existing scripts/) |
| Portal / catalog                 | **GeoNetwork** *(optional)*                 | Metadata catalogue |
| Web AppBuilder apps              | **UGROADS React + Leaflet app** (existing)  | Dashboards & field capture |
| Geodatabase archiving/versioning | **audit-trigger history tables** (sql/03)   | Every edit recorded, point-in-time restore |
| ArcGIS tile cache                | **GeoWebCache** (inside GeoServer) / MVT    | Cached basemaps & overlays |

## 2 · Layered architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ L6 · PRESENTATION                                                              │
│   UGROADS React SPA (GitHub Pages) · QGIS Desktop · pgAdmin · any OGC client   │
└───────────────▲───────────────────────▲───────────────────────▲───────────────┘
                │ JSON bundle           │ WMS/WFS/MVT/REST      │ SQL (5432)
┌───────────────┴───────────────────────┴───────────────────────┴───────────────┐
│ L5 · APPLICATIONS & PLUGINS                                                    │
│   Express data-entry server (writes→G: captures + audit)                       │
│   Fable 5 bot proxy · Activity-Log API                                         │
│   QGIS plugins: DB Manager · QuickMapServices · qgis2web (all free)            │
└───────────────▲────────────────────────────────────────────────────────────────┘
                │
┌───────────────┴────────────────────────────────────────────────────────────────┐
│ L4 · WEB SERVICES (the "ArcGIS Server" tier)                                    │
│   GeoServer  :8080  → WMS · WFS(-T) · WMTS · WCS · OGC API · GeoWebCache        │
│   pg_featureserv :9000 → REST/GeoJSON features  (zero-config, reads PostGIS)    │
│   pg_tileserv    :7800 → MVT vector tiles       (zero-config, reads PostGIS)    │
└───────────────▲────────────────────────────────────────────────────────────────┘
                │ SQL / ST_AsMVT / ST_AsGeoJSON
┌───────────────┴────────────────────────────────────────────────────────────────┐
│ L3 · GEODATABASE (the "ArcSDE" tier)                                            │
│   PostgreSQL 16 + PostGIS 3.4  :5432    database: ugroads                       │
│   Schemas: core (network, bridges) · traffic · pms · rms · audit                │
│   Roles:  gis_admin / gis_editor / gis_viewer / svc_web (least privilege)       │
│   Versioning: audit.* history tables via triggers (geodatabase archiving)       │
└───────────────▲────────────────────────────────────────────────────────────────┘
                │ ETL (Python/GDAL)
┌───────────────┴────────────────────────────────────────────────────────────────┐
│ L2 · ETL & AUTOMATION                                                           │
│   etl/load_geodata.py      masters (G:) → PostGIS                               │
│   etl/sync_bundle.py       PostGIS → public/data JSON (feeds the static SPA)    │
│   scripts/refresh_2026.py · build_fwd_inventory.py · build_workplans.py (exist) │
│   tools/gisctl.py          backend management CLI (no frontend needed)          │
│   scripts/backup.ps1       nightly pg_dump → G: Drive                           │
└───────────────▲────────────────────────────────────────────────────────────────┘
                │
┌───────────────┴────────────────────────────────────────────────────────────────┐
│ L1 · CANONICAL SOURCES (already in place)                                       │
│   G:\My Drive\MOWT\Uganda National Road Network Repository                      │
│   NDPIV FY25-26 xlsx · network2026 shapefile · BMS bridges CSV · ATC workbook   │
│   Annual WPs xlsx · S:\PHOTOS (13 GB) · captures/*.jsonl · logs/audit_*.jsonl   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data-flow diagram

```
 G: masters ──load_geodata.py──▶ PostGIS ──┬─▶ GeoServer ─▶ WMS/WFS clients (QGIS, web)
   ▲                                       ├─▶ pg_tileserv ─▶ MVT tiles ─▶ Leaflet/MapLibre
   │ drive_sync.py                         ├─▶ pg_featureserv ─▶ REST GeoJSON
 captures/*.jsonl ◀── Express server ◀──── │
   ▲                                       └─▶ sync_bundle.py ─▶ public/data/*.json
 Field forms (React SPA / RMS shell)                              └─▶ GitHub Pages SPA
```

## 3 · Install (Windows, all free)

**Option A — one command (Docker Desktop, free for this use):**
```powershell
cd gis-enterprise
docker compose up -d        # postgis + geoserver + pg_tileserv + pg_featureserv + pgadmin
```

**Option B — native installs (no Docker):**
1. PostgreSQL 16 + PostGIS: https://www.postgresql.org/download/windows/ (StackBuilder → PostGIS)
2. GeoServer: https://geoserver.org (Platform-independent binary, run `bin\startup.bat`)
3. pg_tileserv / pg_featureserv: single .exe downloads — https://github.com/CrunchyData
4. QGIS: https://qgis.org · pgAdmin ships with PostgreSQL
5. Python deps: `pip install psycopg2-binary sqlalchemy geoalchemy2 geopandas`

**Then initialise the geodatabase:**
```powershell
psql -U postgres -f sql\01_roles_db.sql
psql -U gis_admin -d ugroads -f sql\02_schema.sql
psql -U gis_admin -d ugroads -f sql\03_audit_triggers.sql
python etl\load_geodata.py           # loads every G: master layer into PostGIS
```

## 4 · Database management plan (no front end required)

### 4.1 Access paths
| Tool | Use | How |
|---|---|---|
| **psql** | scripted admin, repairs | `psql -U gis_admin -d ugroads` |
| **pgAdmin 4** | visual admin, query tool | http://localhost:5050 (Docker) / desktop app |
| **QGIS DB Manager** | spatial edits, geometry fixes, table preview | Layer ▸ Add PostGIS Layer |
| **tools/gisctl.py** | one-line ops: status/backup/repair/vacuum | `python tools\gisctl.py status` |
| **DBeaver CE** | cross-DB SQL IDE | free download |

### 4.2 Roles & least privilege
- `gis_admin` — owner; DDL, restore, role management
- `gis_editor` — INSERT/UPDATE/DELETE on data schemas (field supervisors via QGIS)
- `gis_viewer` — SELECT only (analysts, the services if read-only)
- `svc_web` — SELECT + INSERT on capture tables only (used by GeoServer/pg_*serv/Express)
Passwords live in `gis-enterprise/.env` (gitignored) — never in code.

### 4.3 Maintenance schedule
| Cadence | Task | Command |
|---|---|---|
| Nightly | Backup to G: | `scripts\backup.ps1` (Task Scheduler) |
| Weekly | Vacuum/analyze | `python tools\gisctl.py vacuum` |
| Monthly | Reindex spatial indexes | `python tools\gisctl.py reindex` |
| After bulk loads | Geometry validity repair | `python tools\gisctl.py repair` |
| Quarterly | Restore-test the latest dump | `python tools\gisctl.py restore --dry-run <dump>` |

### 4.4 Repairs without the front end
- **Bad geometry**: `gisctl repair` runs `ST_MakeValid` across all geometry columns and reports fixes.
- **Wrong attribute**: `psql` or pgAdmin `UPDATE core.bridges SET overall_rating='Fair' WHERE bridge_no='B373';` — the audit trigger records who/when/old/new automatically.
- **Accidental delete**: every row change is archived in `audit.history`; recover with
  `SELECT audit.restore_row('core.bridges', <history_id>);`
- **Point-in-time**: nightly dumps + `audit.history` give both coarse and row-level recovery.

### 4.5 Versioning (geodatabase archiving equivalent)
`sql/03_audit_triggers.sql` attaches a generic trigger to every data table:
each INSERT/UPDATE/DELETE writes a JSONB snapshot (old + new) into `audit.history`
with user, timestamp and statement. This mirrors ESRI archiving and feeds the
platform's track-and-trace philosophy at database level.

## 5 · Publishing services

**pg_tileserv / pg_featureserv** need zero config: every PostGIS table with a
geometry column is instantly served at
`http://localhost:7800/core.network_links/{z}/{x}/{y}.pbf` and
`http://localhost:9000/collections/core.bridges/items?limit=100`.

**GeoServer** (full OGC incl. transactional WFS-T editing):
1. http://localhost:8080/geoserver (admin/geoserver — change immediately)
2. New Store ▸ PostGIS ▸ host `postgis`, db `ugroads`, user `svc_web`
3. Publish `core.network_links`, `core.bridges`, `rms.inventory_features` …
4. Styles: import the SLDs in `geoserver/styles/` (class-coloured network, VCI bands)
5. Tile caching: GeoWebCache is built in — enable per layer for basemap-speed serving.

The React app keeps reading the static bundle (works offline / on Pages);
when you want LIVE layers, point Leaflet at the MVT or WMS endpoints —
both render in the existing map components without licence keys.

## 6 · File map of this folder
```
gis-enterprise/
├─ README.md                ← this document
├─ docker-compose.yml       ← whole stack, one command
├─ .env.example             ← copy to .env, set passwords
├─ sql/
│  ├─ 01_roles_db.sql       ← database + roles
│  ├─ 02_schema.sql         ← schemas, tables, spatial indexes
│  └─ 03_audit_triggers.sql ← row-level versioning/archiving
├─ etl/
│  ├─ load_geodata.py       ← G: masters → PostGIS (all layers)
│  └─ sync_bundle.py        ← PostGIS → public/data JSON for the SPA
├─ tools/
│  └─ gisctl.py             ← backend management CLI
├─ scripts/
│  └─ backup.ps1            ← nightly pg_dump to G:
└─ geoserver/
   └─ styles/network_class.sld
```
