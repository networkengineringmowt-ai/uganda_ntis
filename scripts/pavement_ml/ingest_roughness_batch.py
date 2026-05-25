#!/usr/bin/env python3
"""
Batch ingest of per-link Roughness_Processed_*.xlsx files (ROMDAS 2020 survey).

Each file covers one road link; the link_id is in the filename:
  Roughness_Processed_A001_LINK01.xlsx  ->  A001_Link01
  Roughness_Processed_A001_LINK08R.xlsx ->  A001_Link08R  (R = reverse run)

After ingestion, aggregates romdas_sections from all good measurements,
then writes a summary JSON for reporting.

Usage:
  python ingest_roughness_batch.py [--dry-run]
"""

import re, os, sys, json, math, sqlite3, argparse, logging, warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('batch_ingest')

BASE      = Path(__file__).resolve().parents[2]
DB_PATH   = str(BASE / 'traffic_platform.db')
OUT_JSON  = str(BASE / 'public' / 'data' / 'romdas_sections_summary.json')

ROMDAS_2020_DIR = Path(
    'D:/OneDrive/Annual National Road Network Performance Monitoring'
    '/2019-20/ROMDAS 2020'
)

SURVEY_YEAR  = 2020
SURVEY_DATE  = '2020-11-01'   # approximate; exact dates not in individual files

IRI_SUSPECT_HIGH = 25.0
SPEED_MIN_KMH    = 20.0
SPEED_MAX_KMH    = 90.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def link_id_from_filename(stem: str) -> str:
    """
    'Roughness_Processed_A001_LINK01'  ->  'A001_Link01'
    'Roughness_Processed_B204_LINK01'  ->  'B204_Link01'
    'Roughness_Processed_A001_LINK08R' ->  'A001_Link08R'
    """
    # strip leading prefix
    stem = re.sub(r'^Roughness_Processed_', '', stem, flags=re.IGNORECASE)
    # normalise LINK -> Link
    stem = re.sub(r'_[Ll][Ii][Nn][Kk]', '_Link', stem)
    return stem


def quality_flag(iri_mean, speed, qual_num) -> str:
    try:
        q = float(qual_num)
        if q == 0:
            return 'excluded'
        if q < 100:
            return 'suspect'
    except (TypeError, ValueError):
        pass
    if speed is not None and (speed < SPEED_MIN_KMH or speed > SPEED_MAX_KMH):
        return 'suspect'
    if iri_mean is not None and iri_mean > IRI_SUSPECT_HIGH:
        return 'suspect'
    return 'good'


def parse_roughness_file(xlsx_path: Path) -> list:
    """Parse one Roughness_Processed_*.xlsx -> list of row dicts."""
    link_id = link_id_from_filename(xlsx_path.stem)
    try:
        df = pd.read_excel(xlsx_path)
    except Exception as exc:
        log.warning('Cannot read %s: %s', xlsx_path.name, exc)
        return []

    # Normalise column names
    df.columns = [str(c).strip().upper() for c in df.columns]

    required = {'CHAINAGE', 'CALIB_RGH', 'QUALITY'}
    missing  = required - set(df.columns)
    if missing:
        log.warning('%s missing columns %s — skipping', xlsx_path.name, missing)
        return []

    # Drop chainage=0 sentinel rows and quality=0 rows
    df = df[df['CHAINAGE'] > 0].copy()

    # Fix IRI units: if max > 100 assume mm/m -> /1000
    for col in ['C_ROUGH_1', 'C_ROUGH_2', 'CALIB_RGH']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            vals = df[col].dropna()
            if len(vals) > 0 and vals.max() > 100:
                df[col] = df[col] / 1000.0

    # Zero C_ROUGH_2 = single sensor, treat as missing
    if 'C_ROUGH_2' in df.columns:
        df['C_ROUGH_2'] = df['C_ROUGH_2'].replace(0.0, float('nan'))

    rows = []
    for _, row in df.iterrows():
        chainage = float(row.get('CHAINAGE', 0) or 0)
        iri_l    = float(row['C_ROUGH_1']) if 'C_ROUGH_1' in df.columns and pd.notna(row.get('C_ROUGH_1')) else None
        iri_r    = float(row['C_ROUGH_2']) if 'C_ROUGH_2' in df.columns and pd.notna(row.get('C_ROUGH_2')) else None
        iri_m    = float(row['CALIB_RGH'])  if pd.notna(row.get('CALIB_RGH'))  else None
        speed    = float(row['SPEED'])       if 'SPEED' in df.columns and pd.notna(row.get('SPEED')) else None
        qual_num = row.get('QUALITY')

        if iri_m is None:
            parts = [v for v in [iri_l, iri_r] if v is not None]
            iri_m = sum(parts) / len(parts) if parts else None

        rows.append({
            'survey_id':    f'Roughness2020_{link_id}',
            'link_id':      link_id,
            'road_name':    '',
            'chainage_m':   round(chainage, 1),
            'lat':          None,
            'lon':          None,
            'iri_left':     round(iri_l, 3) if iri_l is not None else None,
            'iri_right':    round(iri_r, 3) if iri_r is not None else None,
            'iri_mean':     round(iri_m, 3) if iri_m is not None else None,
            'rut_left_mm':  None,
            'rut_right_mm': None,
            'rut_max_mm':   None,
            'texture_mpd':  None,
            'survey_date':  SURVEY_DATE,
            'survey_year':  SURVEY_YEAR,
            'speed_kmh':    round(speed, 1) if speed is not None else None,
            'data_quality': quality_flag(iri_m, speed, qual_num),
        })
    return rows


# ── Section aggregation ───────────────────────────────────────────────────────

def iri_to_condition(iri: float) -> str:
    if iri < 3.5:  return 'Good'
    if iri < 6.5:  return 'Fair'
    if iri < 9.0:  return 'Poor'
    return 'Very Poor'

def iri_to_vci(iri: float) -> float:
    return round(max(0.0, min(100.0, (16.0 - iri) / 0.14)), 1)

def pct_above_9(vals) -> float:
    if len(vals) == 0: return 0.0
    return round(100.0 * sum(1 for v in vals if v > 9.0) / len(vals), 1)


def build_romdas_sections(conn: sqlite3.Connection):
    """
    Aggregate romdas_measurements (good rows only) into romdas_sections.
    One row per (link_id, survey_year).
    """
    log.info('Building romdas_sections from measurements...')

    sql = """
    SELECT link_id, survey_year,
           AVG(iri_mean)     AS mean_iri,
           MIN(iri_mean)     AS min_iri,
           MAX(iri_mean)     AS max_iri,
           COUNT(*)          AS n_intervals,
           MIN(chainage_m)   AS section_start_m,
           MAX(chainage_m)   AS section_end_m,
           AVG(rut_max_mm)   AS mean_rut_mm,
           MAX(rut_max_mm)   AS max_rut_mm,
           AVG(speed_kmh)    AS avg_speed
    FROM   romdas_measurements
    WHERE  data_quality = 'good'
      AND  iri_mean IS NOT NULL
      AND  link_id  != ''
    GROUP  BY link_id, survey_year
    HAVING n_intervals >= 3
    """
    df = pd.read_sql(sql, conn)

    # Compute sd_iri and pct_above_9 per link — need raw values
    sd_map   = {}
    pct9_map = {}
    cur = conn.cursor()
    cur.execute("""
        SELECT link_id, survey_year, iri_mean
        FROM   romdas_measurements
        WHERE  data_quality='good' AND iri_mean IS NOT NULL AND link_id != ''
    """)
    from collections import defaultdict
    raw: dict = defaultdict(list)
    for link_id, yr, iri in cur.fetchall():
        raw[(link_id, yr)].append(iri)
    for key, vals in raw.items():
        sd_map[key]   = round(float(np.std(vals)), 3) if len(vals) > 1 else 0.0
        pct9_map[key] = pct_above_9(vals)

    # Lookup road_name and region from deterioration_curves
    name_sql = """SELECT DISTINCT link_id, road_name, region
                  FROM deterioration_curves WHERE link_id != ''"""
    name_df = pd.read_sql(name_sql, conn)
    name_map   = dict(zip(name_df['link_id'], name_df['road_name']))
    region_map = dict(zip(name_df['link_id'], name_df['region']))

    # Lookup surface_type from pavement_condition
    surf_sql = "SELECT link_id, surface_type FROM pavement_condition WHERE survey_year=2024"
    surf_df  = pd.read_sql(surf_sql, conn)
    surf_map = dict(zip(surf_df['link_id'], surf_df['surface_type']))

    conn.execute('DELETE FROM romdas_sections')

    section_rows = []
    for _, r in df.iterrows():
        lid  = str(r['link_id'])
        yr   = int(r['survey_year'])
        key  = (lid, yr)
        mean = float(r['mean_iri'])
        slen = max(0.0, (float(r['section_end_m']) - float(r['section_start_m']))) / 1000.0

        section_rows.append((
            lid,
            name_map.get(lid, ''),
            region_map.get(lid, ''),
            float(r['section_start_m']),
            float(r['section_end_m']),
            round(slen, 3),
            yr,
            round(mean, 3),
            sd_map.get(key, 0.0),
            pct9_map.get(key, 0.0),
            float(r['max_rut_mm']) if r['max_rut_mm'] else None,
            float(r['mean_rut_mm']) if r['mean_rut_mm'] else None,
            iri_to_condition(mean),
            iri_to_vci(mean),
            None,  # AADT_at_survey — not available in ROMDAS files
            surf_map.get(lid, ''),
        ))

    conn.executemany("""
        INSERT INTO romdas_sections
        (link_id, road_name, region, section_start_m, section_end_m,
         section_length_km, survey_year, mean_iri, sd_iri, pct_above_9,
         max_rut_mm, mean_rut_mm, condition_class, vci, AADT_at_survey, surface_type)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, section_rows)
    conn.commit()
    log.info('romdas_sections: %d section rows written', len(section_rows))
    return len(section_rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    # 1. Discover all Roughness_Processed_*.xlsx files
    files = sorted(ROMDAS_2020_DIR.rglob('Roughness_Processed_*.xlsx'))
    log.info('Found %d Roughness_Processed files', len(files))

    # 2. Skip files already ingested (survey_id prefix match)
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    cur.execute("SELECT DISTINCT survey_id FROM romdas_measurements WHERE survey_id LIKE 'Roughness2020_%'")
    already = {r[0] for r in cur.fetchall()}
    log.info('Already ingested: %d files', len(already))

    new_files = [f for f in files
                 if f'Roughness2020_{link_id_from_filename(f.stem)}' not in already]
    log.info('New files to ingest: %d', len(new_files))

    if args.dry_run:
        for f in new_files[:5]:
            print(f'  Would ingest: {f.name} -> {link_id_from_filename(f.stem)}')
        conn.close()
        return

    # 3. Batch-parse and insert
    total_rows = 0
    total_files = 0
    batch = []
    BATCH_SIZE = 500

    for i, fp in enumerate(new_files, 1):
        rows = parse_roughness_file(fp)
        batch.extend(rows)
        total_rows  += len(rows)
        total_files += 1

        if len(batch) >= BATCH_SIZE or i == len(new_files):
            if batch:
                conn.executemany("""
                    INSERT INTO romdas_measurements
                    (survey_id,link_id,road_name,chainage_m,lat,lon,
                     iri_left,iri_right,iri_mean,rut_left_mm,rut_right_mm,
                     rut_max_mm,texture_mpd,survey_date,survey_year,speed_kmh,data_quality)
                    VALUES
                    (:survey_id,:link_id,:road_name,:chainage_m,:lat,:lon,
                     :iri_left,:iri_right,:iri_mean,:rut_left_mm,:rut_right_mm,
                     :rut_max_mm,:texture_mpd,:survey_date,:survey_year,
                     :speed_kmh,:data_quality)
                """, batch)
                conn.commit()
                batch = []
            if i % 20 == 0 or i == len(new_files):
                log.info('  %d/%d files  |  %d rows so far', i, len(new_files), total_rows)

    log.info('Ingested %d rows from %d new files', total_rows, total_files)

    # 4. Build/refresh romdas_sections
    n_sections = build_romdas_sections(conn)

    # 5. Summary stats
    cur.execute("SELECT COUNT(*) FROM romdas_measurements")
    total_meas = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM romdas_measurements WHERE data_quality='good'")
    good_meas  = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT link_id) FROM romdas_measurements WHERE data_quality='good' AND link_id != ''")
    n_links    = cur.fetchone()[0]
    cur.execute("SELECT AVG(mean_iri), MIN(mean_iri), MAX(mean_iri) FROM romdas_sections WHERE survey_year=2020")
    avg_iri, min_iri, max_iri = cur.fetchone()
    cur.execute("""SELECT condition_class, COUNT(*) FROM romdas_sections
                   WHERE survey_year=2020 GROUP BY condition_class ORDER BY condition_class""")
    cond_dist = dict(cur.fetchall())
    conn.close()

    summary = {
        'generated_at':        datetime.now().isoformat()[:19],
        'total_measurements':  total_meas,
        'good_measurements':   good_meas,
        'unique_links':        n_links,
        'section_rows':        n_sections,
        'survey_year_2020': {
            'mean_iri':        round(avg_iri, 2) if avg_iri else None,
            'min_iri':         round(min_iri, 2) if min_iri else None,
            'max_iri':         round(max_iri, 2) if max_iri else None,
            'condition_distribution': cond_dist,
        },
    }

    Path(OUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(summary, f, indent=2)
    log.info('Summary -> %s', OUT_JSON)

    print('\n=== Batch Ingest Complete ===')
    print(f'  New rows ingested : {total_rows:,}')
    print(f'  Total measurements: {total_meas:,}  ({good_meas:,} good)')
    print(f'  Unique links      : {n_links}')
    print(f'  romdas_sections   : {n_sections} rows')
    if avg_iri:
        print(f'  Mean IRI (2020)   : {avg_iri:.2f} m/km  (range {min_iri:.1f} - {max_iri:.1f})')
    print(f'  Condition dist    : {cond_dist}')


if __name__ == '__main__':
    main()
