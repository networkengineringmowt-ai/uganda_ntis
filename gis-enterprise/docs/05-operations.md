# L5 · Operations — deploy, scale, secure, recover

## 1. Bring the whole stack up
```bash
cd gis-enterprise
cp .env.example .env          # then set strong passwords (see below)
docker compose up -d          # postgis · geoserver · tileserv · featureserv · pgadmin · webadaptor
docker compose ps             # all healthy?
```
First start auto-runs `sql/01–03`. If the init race skips them (volume created
before SQL mounted), run once manually:
```bash
for f in sql/01_roles_db.sql sql/02_schema.sql sql/03_audit_triggers.sql; do
  docker exec -i gis-enterprise-postgis-1 psql -U gis_admin -d ugroads < "$f"; done
```
Then load data: `pip install psycopg2-binary sqlalchemy geoalchemy2 geopandas`
and `python etl/load_geodata.py`.

**Entry points** (host): Portal `http://localhost:8088/` · GeoServer `:8080` ·
tiles `:7800` · features `:9000` · pgAdmin `:5060` · PostGIS `:5434`.
Behind the adaptor everything is also under `:8088/{geoserver,tiles,features,pgadmin}`.

## 2. Passwords & secrets
`.env` is **gitignored** — never commit it. Generate strong values:
```python
python -c "import secrets;print(secrets.token_urlsafe(18))"
```
Keys: `PG_ADMIN_PASSWORD`, `EDITOR/VIEWER/SVC_WEB` passwords, `GEOSERVER_PASSWORD`,
`PGADMIN_PASSWORD`. After changing role passwords, sync them in the DB
(`ALTER ROLE svc_web PASSWORD '…';`) so the SQL seed placeholders match `.env`.

## 3. Backup & restore (3-2-1)
```bash
python tools/gisctl.py backup            # nightly pg_dump -Fc → db_backups/ (docker fallback built in)
python tools/gisctl.py restore <dump>    # --clean --if-exists ; test with --dry-run first
```
- Schedule nightly via Task Scheduler / cron; retain 14 (see `scripts/backup.ps1`).
- Keep one copy off the server (G: Drive / object store). GeoServer config is in
  the `geoserver_data` volume — snapshot it too (`docker run --rm -v ... tar`).
- **Note:** the host has no native `pg_dump`; gisctl auto-runs it inside the
  postgis container. Backups land in `G:\…\db_backups`.

## 4. Maintenance schedule
| Cadence | Action | Command |
|---------|--------|---------|
| Nightly | backup | `gisctl backup` |
| Weekly | vacuum/analyze | `gisctl vacuum` |
| Monthly | reindex | `gisctl reindex` |
| After bulk load | validate geometries | `gisctl repair` |
| As needed | ad-hoc change (audited) | `gisctl sql "UPDATE …"` |
| As needed | inspect / undo a change | `gisctl history core.bridges` · `gisctl undo <id>` |

## 5. Backend access *without* the front end
`gisctl` is the admin CLI — full DB control with no app running:
```
status   layers   sql [--file]   repair   vacuum   reindex
backup   restore  history <schema.table>  undo <history_id>
```
Plus pgAdmin (visual) at `/pgadmin/`. Both authenticate as DB roles; all writes
are audited.

## 6. Scaling
- **Vertical:** raise `shared_buffers`, `work_mem`, pool sizes; give GeoServer
  more heap (`JAVA_OPTS=-Xmx`).
- **Tiles:** pre-seed GeoWebCache hot zooms; the adaptor cache absorbs repeats.
- **Horizontal:** run N GeoServer / pg_*serv replicas behind the adaptor
  `upstream` (add servers + `least_conn`); PostGIS read-replicas (streaming
  replication) for read-heavy service load; keep one primary for writes.
- **Containers are stateless** except postgis + geoserver_data volumes — scale
  the service tier freely.

## 7. Monitoring & health
- Adaptor: `GET /health`; per-service dots on the Portal home.
- DB: `gisctl status` (version, per-table row counts + sizes); `pg_stat_activity`.
- Logs: `docker compose logs -f <service>`; nginx access/error for the edge.
- Add Prometheus `postgres_exporter` + `nginx-exporter` + Grafana for dashboards
  (optional, documented for scale-out).

## 8. Disaster recovery
1. Reprovision host → `docker compose up -d` (schema auto-creates).
2. `gisctl restore <latest>.dump` (data + audit history).
3. Restore `geoserver_data` volume (or re-publish layers — ~10 min, per
   [02-service-layer.md](02-service-layer.md) §1).
4. `python etl/load_geodata.py` if rebuilding from G: masters instead.
RPO = last nightly dump; RTO ≈ minutes (single-node) — both improved with
replication + more frequent dumps.

## 9. Known data-quality items (fix at source)
- Duplicate bridge `B727` in the BMS CSV (loader keeps first, warns).
- Orphan condition link-ids `C360_Link03`, `C844_Link03` (pre-FY25/26; dropped).
