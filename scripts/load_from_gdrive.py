#!/usr/bin/env python3
"""
ETL: Load Google Drive traffic data into traffic_platform.db
Reads pre-parsed JSON files from this script's directory and
populates a normalised SQLite database.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR.parent / "data" / "traffic_platform.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS road_links (
    link_id    TEXT PRIMARY KEY,
    link_name  TEXT,
    road_class TEXT,
    region     TEXT
);
CREATE TABLE IF NOT EXISTS traffic_counts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id      TEXT,
    section_id   TEXT,
    count_date   TEXT,
    survey_year  INTEGER,
    direction    INTEGER,
    total_count  INTEGER,
    motorcycles  INTEGER,
    cars_taxis   INTEGER,
    buses        INTEGER,
    trucks       INTEGER,
    nmt          INTEGER
);
CREATE TABLE IF NOT EXISTS atc_stations (
    station_id   TEXT PRIMARY KEY,
    station_name TEXT,
    link_id      TEXT,
    link_name    TEXT,
    latitude     REAL,
    longitude    REAL,
    region       TEXT
);
CREATE TABLE IF NOT EXISTS atc_readings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT,
    year       INTEGER,
    month      INTEGER,
    aadt       INTEGER
);
CREATE TABLE IF NOT EXISTS aadt_projections (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id   TEXT,
    link_name TEXT,
    year      INTEGER,
    aadt      INTEGER
);
CREATE TABLE IF NOT EXISTS etl_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time         TEXT,
    source           TEXT,
    records_inserted INTEGER,
    status           TEXT
);
"""


def log(con, source, records, status):
    con.execute(
        "INSERT INTO etl_log(run_time,source,records_inserted,status) VALUES(?,?,?,?)",
        (datetime.utcnow().isoformat(), source, records, status),
    )


def load_traffic_counts(con):
    """Load all tis_*.json files into road_links + traffic_counts."""
    tis_files = sorted(SCRIPT_DIR.glob("tis_*.json"))
    if not tis_files:
        print("  [WARN] No tis_*.json files found — skipping traffic_counts")
        log(con, "tis_*.json", 0, "SKIPPED — no files")
        return 0

    total = 0
    for path in tis_files:
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  [ERR] {path.name}: {e}")
            log(con, path.name, 0, f"ERROR: {e}")
            continue

        inserted = 0
        for r in records:
            link_id = r.get("link_id", "").strip()
            if not link_id:
                continue
            # Upsert road link
            con.execute(
                """INSERT INTO road_links(link_id, link_name)
                   VALUES(?, ?)
                   ON CONFLICT(link_id) DO UPDATE SET
                   link_name = COALESCE(excluded.link_name, link_name)""",
                (link_id, r.get("link_name")),
            )
            # Insert count row
            con.execute(
                """INSERT INTO traffic_counts
                   (link_id, section_id, count_date, survey_year, direction,
                    total_count, motorcycles, cars_taxis, buses, trucks, nmt)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    link_id,
                    r.get("section_id"),
                    r.get("count_date"),
                    r.get("survey_year"),
                    r.get("direction", 0),
                    r.get("total_count", 0),
                    r.get("motorcycles", 0),
                    r.get("cars_taxis", 0),
                    r.get("buses", 0),
                    r.get("trucks", 0),
                    r.get("nmt", 0),
                ),
            )
            inserted += 1

        con.commit()
        total += inserted
        log(con, path.name, inserted, "OK")
        print(f"  {path.name}: {inserted} records")

    return total


def load_atc_stations(con):
    """Load stations_full.json into atc_stations."""
    path = SCRIPT_DIR / "stations_full.json"
    if not path.exists():
        print("  [WARN] stations_full.json not found — skipping atc_stations")
        log(con, "stations_full.json", 0, "SKIPPED — file missing")
        return 0

    records = json.loads(path.read_text(encoding="utf-8"))
    inserted = 0
    for r in records:
        sid = str(r.get("station_id", "")).strip()
        if not sid:
            continue
        try:
            con.execute(
                """INSERT INTO atc_stations
                   (station_id, station_name, link_id, link_name, latitude, longitude, region)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(station_id) DO UPDATE SET
                   station_name = COALESCE(excluded.station_name, station_name),
                   link_id      = COALESCE(excluded.link_id, link_id),
                   link_name    = COALESCE(excluded.link_name, link_name),
                   latitude     = COALESCE(excluded.latitude, latitude),
                   longitude    = COALESCE(excluded.longitude, longitude),
                   region       = COALESCE(excluded.region, region)""",
                (
                    sid,
                    r.get("station_name"),
                    r.get("link_id"),
                    r.get("link_name"),
                    r.get("latitude") or r.get("lat"),
                    r.get("longitude") or r.get("lon"),
                    r.get("region"),
                ),
            )
            inserted += 1
        except Exception as e:
            print(f"  [ERR] station {sid}: {e}")

    con.commit()
    log(con, "stations_full.json", inserted, "OK")
    print(f"  stations_full.json: {inserted} stations")
    return inserted


def load_atc_readings(con):
    """Load atc_summary_full.json into atc_readings."""
    path = SCRIPT_DIR / "atc_summary_full.json"
    if not path.exists():
        print("  [WARN] atc_summary_full.json not found — skipping atc_readings")
        log(con, "atc_summary_full.json", 0, "SKIPPED — file missing")
        return 0

    records = json.loads(path.read_text(encoding="utf-8"))
    inserted = 0
    for r in records:
        sid = str(r.get("station_id", "")).strip()
        if not sid:
            continue
        try:
            con.execute(
                """INSERT INTO atc_readings(station_id, year, month, aadt)
                   VALUES(?,?,?,?)""",
                (
                    sid,
                    int(r.get("year", 0)),
                    int(r.get("month", 0)),
                    int(r.get("aadt", 0)),
                ),
            )
            inserted += 1
        except Exception as e:
            print(f"  [ERR] atc reading {sid}: {e}")

    con.commit()
    log(con, "atc_summary_full.json", inserted, "OK")
    print(f"  atc_summary_full.json: {inserted} readings")
    return inserted


def load_aadt_projections(con):
    """Load aadt_summary.json into aadt_projections."""
    path = SCRIPT_DIR / "aadt_summary.json"
    if not path.exists():
        print("  [WARN] aadt_summary.json not found — skipping aadt_projections")
        log(con, "aadt_summary.json", 0, "SKIPPED — file missing")
        return 0

    records = json.loads(path.read_text(encoding="utf-8"))
    inserted = 0
    for r in records:
        link_id = str(r.get("link_id", "")).strip()
        if not link_id:
            continue
        try:
            con.execute(
                """INSERT INTO aadt_projections(link_id, link_name, year, aadt)
                   VALUES(?,?,?,?)""",
                (
                    link_id,
                    r.get("link_name"),
                    int(r.get("year", 0)),
                    int(r.get("aadt", 0)),
                ),
            )
            inserted += 1
        except Exception as e:
            print(f"  [ERR] projection {link_id}: {e}")

    con.commit()
    log(con, "aadt_summary.json", inserted, "OK")
    print(f"  aadt_summary.json: {inserted} projections")
    return inserted


def print_summary(con):
    tables = [
        "road_links",
        "traffic_counts",
        "atc_stations",
        "atc_readings",
        "aadt_projections",
        "etl_log",
    ]
    print("\n=== DATABASE SUMMARY ===")
    for t in tables:
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:<22}: {n:>6} rows")
    print(f"\nDB: {DB_PATH}")


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    con.commit()

    print("=== Google Drive ETL — traffic_platform.db ===\n")

    tc = load_traffic_counts(con)
    st = load_atc_stations(con)
    ar = load_atc_readings(con)
    ap = load_aadt_projections(con)

    print_summary(con)
    con.close()

    total = tc + st + ar + ap
    print(f"\nTotal records inserted: {total}")


if __name__ == "__main__":
    main()
