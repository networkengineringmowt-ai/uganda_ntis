-- =============================================================================
-- Uganda National Roads Authority (UNRA) — Asset Management SQL Query Library
-- Database: traffic_platform.db (SQLite)
-- Generated: 2026-05-20
-- Manual references: UNRA Asset Management System Manuals (2017)
--                    DOMAIN_KNOWLEDGE.md §A–§I
-- =============================================================================
--
-- SCHEMA REFERENCE
-- ─────────────────────────────────────────────────────────────────────────────
--   road_links      (link_id PK, link_name, road_class[NULL], region[NULL])
--   traffic_counts  (id, link_id, section_id, count_date, survey_year,
--                    direction, total_count, motorcycles, cars_taxis,
--                    buses, trucks, nmt, source_file)
--   aadt_projections(id, link_id, link_name, year, aadt)
--   atc_stations    (station_id PK, station_name, link_id, link_name,
--                    latitude, longitude, region)
--   atc_readings    (id, station_id[=link_name], year, month, aadt, source_file)
--   etl_log         (id, run_time, source, records_inserted, status, notes)
--
-- DATA QUALITY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
--   • road_links.road_class and .region are NULL for all rows; class is
--     derived from the link_id prefix (A/B/C/M) throughout these queries.
--   • road_links row 1 is an import header artefact ('Link_ID','Length');
--     excluded via WHERE link_id != 'Link_ID'.
--   • traffic_counts survey_year=2024 and 2025 hold identical records (same
--     data imported twice); queries use MAX(survey_year) to get latest.
--   • traffic_counts survey_year=0 rows are ETL artefacts; excluded.
--   • atc_readings.station_id stores the road corridor name (link_name),
--     not the station code; 15 unique mother-station corridors (§C.5).
--   • aadt_projections contains mixed/corrupted ETL data; these queries
--     avoid it except where explicitly noted.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: TRAFFIC & AADT ANALYSIS
-- Manual reference: §C — Traffic Information System (TIS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Q01: Top 20 Busiest Road Links by AADT (Latest Survey Year)
-- §C.1: AADT derived from combined directional counts at count stations.
-- Direction 1 + Direction 2 = bidirectional daily total; Direction 0 = combined.
-- Uses MAX survey_year to pick the most recent data cycle.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    tc.latest_year                          AS survey_year,
    ROUND(tc.avg_aadt, 0)                   AS aadt_vpd,
    tc.record_count                         AS count_records
FROM (
    SELECT
        link_id,
        MAX(survey_year)                    AS latest_year,
        AVG(total_count)                    AS avg_aadt,
        COUNT(*)                            AS record_count
    FROM traffic_counts
    WHERE survey_year = (
              SELECT MAX(survey_year)
              FROM traffic_counts
              WHERE survey_year > 2000
          )
      AND total_count > 0
    GROUP BY link_id
) tc
LEFT JOIN road_links rl
    ON tc.link_id = rl.link_id
ORDER BY tc.avg_aadt DESC
LIMIT 20;


-- Q02: Roads with Highest AADT Growth Rate (Year-on-Year %)
-- §C.4: Multi-year growth rate estimated via linear regression;
--       minimum 3 data points recommended. Here we use earliest vs latest year
--       for links with ≥2 survey years as a simple CAGR estimate.
-- Formula: CAGR = ((AADT_latest / AADT_earliest)^(1/n_years) - 1) × 100
-- ─────────────────────────────────────────────────────────────────────────────
WITH link_years AS (
    SELECT
        link_id,
        survey_year,
        AVG(total_count) AS avg_aadt
    FROM traffic_counts
    WHERE survey_year > 2000
      AND total_count > 0
    GROUP BY link_id, survey_year
),
link_range AS (
    SELECT
        link_id,
        MIN(survey_year)                    AS first_year,
        MAX(survey_year)                    AS last_year,
        COUNT(DISTINCT survey_year)         AS num_years
    FROM link_years
    GROUP BY link_id
    HAVING COUNT(DISTINCT survey_year) >= 2
)
SELECT
    lr.link_id,
    rl.link_name,
    lr.first_year,
    lr.last_year,
    ROUND(ly_first.avg_aadt, 0)             AS aadt_first_year,
    ROUND(ly_last.avg_aadt, 0)              AS aadt_latest_year,
    ROUND(
        (POWER(
            CAST(ly_last.avg_aadt AS REAL) / NULLIF(ly_first.avg_aadt, 0),
            1.0 / NULLIF(lr.last_year - lr.first_year, 0)
        ) - 1) * 100
    , 1)                                    AS cagr_pct
FROM link_range lr
JOIN link_years ly_first
    ON lr.link_id = ly_first.link_id AND ly_first.survey_year = lr.first_year
JOIN link_years ly_last
    ON lr.link_id = ly_last.link_id  AND ly_last.survey_year  = lr.last_year
LEFT JOIN road_links rl
    ON lr.link_id = rl.link_id
WHERE ly_first.avg_aadt > 0
ORDER BY cagr_pct DESC
LIMIT 20;


-- Q03: AADT by Road Class and Region
-- §A.2: Classes A (primary), B (secondary), C (tertiary); M = expressway.
-- §C.8: Network weighted-average AADT 2025 = 2,562 vpd.
-- NOTE: road_links.road_class and .region are NULL; class derived from link_id
--       prefix. Region sourced from atc_stations where link_id matches.
-- ─────────────────────────────────────────────────────────────────────────────
WITH classified AS (
    SELECT
        tc.link_id,
        CASE
            WHEN tc.link_id LIKE 'A%' THEN 'A - Primary / National'
            WHEN tc.link_id LIKE 'B%' THEN 'B - Secondary / District'
            WHEN tc.link_id LIKE 'C%' THEN 'C - Tertiary / Local'
            WHEN tc.link_id LIKE 'M%' THEN 'M - Expressway'
            ELSE 'Unknown / Named'
        END                                 AS road_class,
        COALESCE(ats.region, 'Unknown')     AS region,
        tc.total_count,
        tc.survey_year
    FROM traffic_counts tc
    LEFT JOIN atc_stations ats
        ON tc.link_id = ats.link_id
    WHERE tc.survey_year = (
              SELECT MAX(survey_year)
              FROM traffic_counts
              WHERE survey_year > 2000
          )
      AND tc.total_count > 0
)
SELECT
    road_class,
    region,
    COUNT(DISTINCT link_id)                 AS link_count,
    ROUND(AVG(total_count), 0)              AS avg_aadt_vpd,
    ROUND(MIN(total_count), 0)              AS min_aadt_vpd,
    ROUND(MAX(total_count), 0)              AS max_aadt_vpd
FROM classified
GROUP BY road_class, region
ORDER BY road_class, avg_aadt_vpd DESC;


-- Q04: Vehicle Class Breakdown by Road Link (%)
-- §C.2: 11 vehicle classes; veh_type_01=Motorcycle, 02=Cars/Taxis,
--       03=LGV, 04=Minibus, 05=Med Bus, 06=Large Bus, 07=Light Truck,
--       08=Med/Heavy Truck, 09=Articulated; 10=Bicycle, 11=Cart (NMT).
-- NOTE: traffic_counts consolidates to: motorcycles, cars_taxis, buses,
--       trucks, nmt. Buses = small+medium+large bus. Trucks = light+med+heavy.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    tc.survey_year,
    ROUND(AVG(tc.total_count), 0)           AS avg_daily_total,
    ROUND(100.0 * AVG(tc.motorcycles)  / NULLIF(AVG(tc.total_count), 0), 1) AS pct_motorcycles,
    ROUND(100.0 * AVG(tc.cars_taxis)   / NULLIF(AVG(tc.total_count), 0), 1) AS pct_cars_taxis,
    ROUND(100.0 * AVG(tc.buses)        / NULLIF(AVG(tc.total_count), 0), 1) AS pct_buses,
    ROUND(100.0 * AVG(tc.trucks)       / NULLIF(AVG(tc.total_count), 0), 1) AS pct_trucks,
    ROUND(100.0 * AVG(tc.nmt)          / NULLIF(AVG(tc.total_count), 0), 1) AS pct_nmt
FROM traffic_counts tc
LEFT JOIN road_links rl
    ON tc.link_id = rl.link_id
WHERE tc.survey_year = (
          SELECT MAX(survey_year)
          FROM traffic_counts
          WHERE survey_year > 2000
      )
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name, tc.survey_year
ORDER BY avg_daily_total DESC
LIMIT 30;


-- Q05: Traffic Counts by Survey Year (Annual Coverage Summary)
-- §C.8: TIS coverage trend 2017–2025.
-- §D.12: Daughter-station counts every 3 years; ATC continuous.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    survey_year,
    COUNT(*)                                AS total_records,
    COUNT(DISTINCT link_id)                 AS unique_links,
    ROUND(AVG(total_count), 0)              AS avg_daily_count,
    SUM(total_count)                        AS total_vehicle_observations,
    SUM(CASE WHEN total_count > 0 THEN 1 ELSE 0 END) AS records_with_data
FROM traffic_counts
WHERE survey_year > 2000
GROUP BY survey_year
ORDER BY survey_year;


-- Q06: Stations (Links) with Most Survey Data — Coverage Ranking
-- §C.1: 286 manual daughter stations; spot-checked ≥10% per cycle (§C.7).
-- Ranks links by total survey records across all years — highest = best coverage.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    COUNT(*)                                AS total_records,
    COUNT(DISTINCT tc.survey_year)          AS years_covered,
    MIN(tc.survey_year)                     AS first_survey_year,
    MAX(tc.survey_year)                     AS last_survey_year,
    ROUND(AVG(tc.total_count), 0)           AS avg_daily_count
FROM traffic_counts tc
LEFT JOIN road_links rl
    ON tc.link_id = rl.link_id
WHERE tc.survey_year > 2000
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name
ORDER BY total_records DESC
LIMIT 30;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: NETWORK OVERVIEW
-- Manual reference: §A — Location Referencing; §B — Road Link Attributes;
--                   §G — Current Network Statistics
-- ─────────────────────────────────────────────────────────────────────────────

-- Q07: Road Network Summary by Surface Type (Paved / Unpaved)
-- §B.2: Surface types — Bituminous/DBSD/SBSD/Concrete = Paved (SurfType F);
--       Gravel/Earth = Unpaved (SurfType U).
-- §G.1: Total network ~21,020 km; Paved ~6,199 km (29.5%); Unpaved ~14,821 km.
-- NOTE: road_links does not contain surface_type or length_km columns.
--       Count of links by class shown as proxy. Actual km from dTIMS/CSV.
--       Query uses road_links to count links; class proxy for paved/unpaved
--       (A-class roads are predominantly paved; C-class predominantly unpaved).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    CASE
        WHEN link_id LIKE 'A%' THEN 'A - Primary'
        WHEN link_id LIKE 'B%' THEN 'B - Secondary'
        WHEN link_id LIKE 'C%' THEN 'C - Tertiary'
        WHEN link_id LIKE 'M%' THEN 'M - Expressway'
        ELSE 'Other'
    END                                     AS road_class,
    CASE
        WHEN link_id LIKE 'A%' OR link_id LIKE 'M%' THEN 'Predominantly Paved'
        WHEN link_id LIKE 'B%' THEN 'Mixed (Paved & Unpaved)'
        WHEN link_id LIKE 'C%' THEN 'Predominantly Unpaved'
        ELSE 'Unknown'
    END                                     AS surface_category,
    COUNT(*)                                AS link_count
FROM road_links
WHERE link_id != 'Link_ID'   -- exclude header artefact row
GROUP BY road_class, surface_category
ORDER BY road_class;


-- Q08: Road Network by Region (Link Count Breakdown)
-- §A.2 / §B.1: Six maintenance regions — Central, Eastern, Northern,
--              Western, Southern, North Eastern.
-- NOTE: road_links.region is NULL; region sourced from atc_stations lookup.
--       Links not matched to any ATC station are classified as 'Unknown Region'.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    COALESCE(ats.region, 'Unknown')         AS region,
    CASE
        WHEN rl.link_id LIKE 'A%' THEN 'A'
        WHEN rl.link_id LIKE 'B%' THEN 'B'
        WHEN rl.link_id LIKE 'C%' THEN 'C'
        WHEN rl.link_id LIKE 'M%' THEN 'M'
        ELSE 'Other'
    END                                     AS road_class,
    COUNT(rl.link_id)                       AS link_count
FROM road_links rl
LEFT JOIN atc_stations ats
    ON rl.link_id = ats.link_id
WHERE rl.link_id != 'Link_ID'
GROUP BY COALESCE(ats.region, 'Unknown'), road_class
ORDER BY region, road_class;


-- Q09: Road Network by Class (A, B, C, M — Link Count Each)
-- §A.2: Class A = national primary (A001–A999); B = secondary;
--       C = tertiary; M = expressway (Northern Bypass, Entebbe Expressway).
-- §G.1: ~21,020 km total; 1,757 road links in database.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    CASE
        WHEN link_id LIKE 'A%_Link%' THEN 'A - National Primary'
        WHEN link_id LIKE 'B%_Link%' THEN 'B - District Secondary'
        WHEN link_id LIKE 'C%_Link%' THEN 'C - Tertiary / Local'
        WHEN link_id LIKE 'M%'       THEN 'M - Expressway'
        WHEN link_id = 'Link_ID'     THEN '-- HEADER ROW (data quality) --'
        ELSE 'Other / Unnumbered'
    END                                     AS road_class_desc,
    COUNT(*)                                AS link_count,
    COUNT(DISTINCT SUBSTR(link_id, 1, 4))   AS unique_roads
FROM road_links
GROUP BY road_class_desc
ORDER BY link_count DESC;


-- Q10: Low-AADT Roads (Likely Unpaved / Upgrade Candidates)
-- §D.8.7: Unpaved roads with AADT > 200 vpd are candidates for upgrade to
--         paved surface (subject to positive NPV from HDM-4/RED analysis).
-- §C.8: Network average AADT = 2,562 vpd (2025). Threshold 500 vpd used here.
-- NOTE: surface_type not in database; C-class roads are used as proxy for
--       unpaved links. HDM-4 threshold 200 vpd also shown for reference.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    tc.survey_year,
    ROUND(AVG(tc.total_count), 0)           AS avg_aadt_vpd,
    CASE
        WHEN AVG(tc.total_count) > 500  THEN 'HIGH: Upgrade candidate (>500 vpd)'
        WHEN AVG(tc.total_count) > 200  THEN 'MED: Meets HDM-4 economic threshold (>200 vpd)'
        ELSE 'LOW: Below economic upgrade threshold'
    END                                     AS upgrade_eligibility
FROM traffic_counts tc
LEFT JOIN road_links rl ON tc.link_id = rl.link_id
WHERE tc.link_id LIKE 'C%'        -- C-class roads (predominantly unpaved §B.2)
  AND tc.survey_year = (
          SELECT MAX(survey_year)
          FROM traffic_counts
          WHERE survey_year > 2000
      )
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name, tc.survey_year
ORDER BY avg_aadt_vpd DESC
LIMIT 30;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: ATC STATION ANALYSIS
-- Manual reference: §C.1, §C.5 — ATC Mother Stations (15 total)
-- ─────────────────────────────────────────────────────────────────────────────

-- Q11: ATC Stations by Region with Monthly Reading Count
-- §C.5: 15 mother stations providing continuous hourly classified counts;
--       basis for seasonal correction factors (SCF) and night expansion factors.
-- NOTE: atc_readings.station_id stores the road corridor name (not station code).
--       Joined to atc_stations via link_name. Stations with no readings may be
--       newly installed or have data gaps (§C.7 QC protocol).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    ar.station_id                           AS corridor_name,
    COALESCE(ats.region, 'Unknown')         AS region,
    COUNT(*)                                AS total_monthly_readings,
    MIN(ar.year)                            AS first_year,
    MAX(ar.year)                            AS last_year,
    COUNT(DISTINCT ar.year)                 AS years_active,
    ROUND(AVG(ar.aadt), 0)                  AS avg_monthly_aadt,
    ROUND(MIN(ar.aadt), 0)                  AS min_monthly_aadt,
    ROUND(MAX(ar.aadt), 0)                  AS max_monthly_aadt
FROM atc_readings ar
LEFT JOIN atc_stations ats
    ON ar.station_id = ats.link_name
GROUP BY ar.station_id, region
ORDER BY region, total_monthly_readings DESC;


-- Q12: Seasonal Traffic Profile — Monthly AADT Index by Corridor
-- §C.4 SCF derivation: monthly index = road-month ADT / observed average ADT.
-- §C.4: Two rainy seasons — Mar–May and Sep–Nov affect Uganda traffic patterns.
-- NOTE: atc_readings provides monthly AADT by station (2016–2022).
--       Hourly ATC profiles are not stored in this database (collected in raw
--       ATC DATA SUMMARY files; see §C.5 for expansion factor methodology).
-- ─────────────────────────────────────────────────────────────────────────────
WITH annual_avg AS (
    SELECT
        station_id,
        year,
        AVG(aadt)                           AS annual_mean_aadt
    FROM atc_readings
    GROUP BY station_id, year
)
SELECT
    ar.station_id                           AS corridor_name,
    ar.year,
    ar.month,
    CASE ar.month
        WHEN 1  THEN 'Jan' WHEN 2  THEN 'Feb' WHEN 3  THEN 'Mar'
        WHEN 4  THEN 'Apr' WHEN 5  THEN 'May' WHEN 6  THEN 'Jun'
        WHEN 7  THEN 'Jul' WHEN 8  THEN 'Aug' WHEN 9  THEN 'Sep'
        WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dec'
    END                                     AS month_name,
    ar.aadt                                 AS monthly_aadt,
    ROUND(aa.annual_mean_aadt, 0)           AS annual_avg_aadt,
    ROUND(
        CAST(ar.aadt AS REAL) / NULLIF(aa.annual_mean_aadt, 0)
    , 3)                                    AS seasonal_index
FROM atc_readings ar
JOIN annual_avg aa
    ON ar.station_id = aa.station_id AND ar.year = aa.year
ORDER BY ar.station_id, ar.year, ar.month;


-- Q13: Heavy Vehicle Percentage by Road Link (from Traffic Counts)
-- §C.2: Heavy goods vehicles = veh_type_07+08+09 (Light Truck, Med/Large Truck,
--       Articulated). ESALF: Light Truck 0.10; Med Truck 2.73; Artic 5.12 (§D.11.6).
-- NOTE: atc_readings stores total monthly AADT only; vehicle breakdown is in
--       traffic_counts. HV% = (buses + trucks) / total_count × 100.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    tc.survey_year,
    ROUND(AVG(tc.total_count), 0)           AS avg_daily_total,
    ROUND(AVG(tc.trucks), 0)                AS avg_daily_trucks,
    ROUND(AVG(tc.buses), 0)                 AS avg_daily_buses,
    ROUND(
        100.0 * AVG(tc.trucks + tc.buses)
        / NULLIF(AVG(tc.total_count), 0)
    , 1)                                    AS pct_heavy_vehicles,
    ROUND(
        100.0 * AVG(tc.trucks)
        / NULLIF(AVG(tc.total_count), 0)
    , 1)                                    AS pct_trucks_only
FROM traffic_counts tc
LEFT JOIN road_links rl ON tc.link_id = rl.link_id
WHERE tc.survey_year = (
          SELECT MAX(survey_year)
          FROM traffic_counts
          WHERE survey_year > 2000
      )
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name, tc.survey_year
ORDER BY pct_heavy_vehicles DESC
LIMIT 30;


-- Q14: ATC Stations with No Readings (Inactive / Data-Gap Stations)
-- §C.5: 15 mother stations expected; all should have continuous data.
-- §C.7: Missing ATC data replaced with same-day-of-week average from nearest
--       mother station — so gap detection here flags potential QC issues.
-- NOTE: atc_stations has 441 rows (all station locations incl. daughter stations).
--       atc_readings has 15 corridor-level entries (mother stations only).
--       This query finds station locations with NO corresponding monthly reading.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    ats.station_id,
    ats.station_name,
    ats.link_id,
    ats.link_name,
    ats.region,
    ats.latitude,
    ats.longitude,
    'NO READINGS IN atc_readings'           AS status
FROM atc_stations ats
WHERE NOT EXISTS (
    SELECT 1
    FROM atc_readings ar
    WHERE ar.station_id = ats.link_name
)
  AND ats.region IN ('Central','North','South','East','West','North East')
ORDER BY ats.region, ats.station_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: OPRC / MAINTENANCE ANALYSIS
-- Manual reference: §D.8 — Treatment Decision Rules; §D.7 — IRI Thresholds
-- ─────────────────────────────────────────────────────────────────────────────

-- Q15: Roads Eligible for OPRC (Output Performance-Based Road Contracts)
-- OPRC criteria (UNRA practice): continuous unpaved road corridor, typically
-- ≥50 km, with AADT low enough to justify routine maintenance contract vs
-- rehabilitation. Low AADT (<500 vpd) C-class links are typical OPRC candidates.
-- §D.8.8 ROUT: routine maintenance applied to all roads annually.
-- NOTE: Road length not stored in road_links; link count used as proxy.
--       Surface type not stored; C-class used as unpaved proxy (§B.2, §A.2).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    COALESCE(ats.region, 'Unknown')         AS region,
    tc.survey_year,
    ROUND(AVG(tc.total_count), 0)           AS avg_aadt_vpd,
    CASE
        WHEN AVG(tc.total_count) < 100 THEN 'Very Low (<100 vpd) — Strong OPRC candidate'
        WHEN AVG(tc.total_count) < 500 THEN 'Low (<500 vpd) — OPRC candidate'
        ELSE 'Moderate AADT — OPRC less typical'
    END                                     AS oprc_suitability
FROM traffic_counts tc
LEFT JOIN road_links rl  ON tc.link_id = rl.link_id
LEFT JOIN atc_stations ats ON tc.link_id = ats.link_id
WHERE tc.link_id LIKE 'C%'         -- C-class (unpaved proxy; §A.2)
  AND tc.survey_year = (
          SELECT MAX(survey_year)
          FROM traffic_counts
          WHERE survey_year > 2000
      )
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name, COALESCE(ats.region, 'Unknown'), tc.survey_year
ORDER BY avg_aadt_vpd ASC
LIMIT 40;


-- Q16: Estimated Maintenance Category by Road (IRI-Based Thresholds)
-- §D.7 IRI roughness thresholds:
--   IRI < 5.5 m/km = Routine Maintenance (ROUT §D.8.8)
--   IRI 5.5–6.6 m/km = Scheduled Maintenance (reseal/overlay trigger §D.8.2/3)
--   IRI > 6.6 m/km = Urgent — Reconstruction required (§D.8.1)
-- §D.5.1 Unpaved IRI anchors: Grade 3 (IRI 7–9) = noticeable; Grade 4 (9–16).
-- NOTE: IRI values are NOT stored in this SQLite database. They are in dTIMS
--       (Roughness table) and ROMDAS CSV exports. This query uses AADT as a
--       proxy for maintenance demand: high AADT → faster deterioration.
--       Replace the AADT_vpd bins with actual IRI data when available.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tc.link_id,
    rl.link_name,
    COALESCE(ats.region, 'Unknown')         AS region,
    ROUND(AVG(tc.total_count), 0)           AS avg_aadt_vpd,
    -- IRI-based cost tiers from §D.7 and UNRA unit costs (USD/km/year, dTIMS)
    -- Until IRI data is loaded: AADT proxy for urgency classification
    CASE
        WHEN AVG(tc.total_count) >= 9000 THEN
            'IRI_CHECK: High-traffic (>9000 vpd) — trigger IRI ≤2.0 (§D.7 Class A High)'
        WHEN AVG(tc.total_count) >= 3300 THEN
            'IRI_CHECK: Med-traffic (3300–9000 vpd) — trigger IRI ≤2.5 (§D.7 Class A Med)'
        WHEN AVG(tc.total_count) >= 1000 THEN
            'SCHEDULED: Mod-traffic (1000–3300 vpd) — IRI trigger ≤3.0'
        WHEN AVG(tc.total_count) >= 200 THEN
            'ROUTINE: Low-traffic (200–1000 vpd) — IRI trigger ≤4.0 (§D.7 Class C)'
        ELSE
            'ROUTINE/OPRC: Very low (<200 vpd) — RED analysis required (§D.1)'
    END                                     AS maintenance_category,
    CASE
        WHEN AVG(tc.total_count) >= 9000 THEN 15000   -- USD/km/yr: reconstruction
        WHEN AVG(tc.total_count) >= 3300 THEN 8000    -- overlay / reseal
        WHEN AVG(tc.total_count) >= 1000 THEN 3000    -- scheduled maintenance
        WHEN AVG(tc.total_count) >= 200  THEN 1500    -- routine maintenance
        ELSE 800                                       -- OPRC / grading
    END                                     AS indicative_cost_usd_per_km_yr
FROM traffic_counts tc
LEFT JOIN road_links rl  ON tc.link_id = rl.link_id
LEFT JOIN atc_stations ats ON tc.link_id = ats.link_id
WHERE tc.survey_year = (
          SELECT MAX(survey_year)
          FROM traffic_counts
          WHERE survey_year > 2000
      )
  AND tc.total_count > 0
GROUP BY tc.link_id, rl.link_name, COALESCE(ats.region, 'Unknown')
ORDER BY avg_aadt_vpd DESC
LIMIT 50;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: DATA QUALITY
-- Manual reference: §H — Data Quality Management (QMP)
-- ─────────────────────────────────────────────────────────────────────────────

-- Q17: ETL Log Summary — Files Processed per Run / Status Overview
-- §H.6: All QMP documentation filed on RMS Server; ETL log tracks data ingestion.
-- §H.5: QC audit sample 7–10% of counting time; failed ETL = data gap risk.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    SUBSTR(run_time, 1, 10)                 AS run_date,
    status,
    COUNT(*)                                AS file_count,
    SUM(records_inserted)                   AS total_records_inserted,
    SUM(CASE WHEN status = 'OK'    THEN 1 ELSE 0 END) AS ok_count,
    SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
    SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped_count
FROM etl_log
GROUP BY run_date, status
ORDER BY run_date DESC, status;

-- Q17b: ETL Error Sources — Most Frequently Failing Files
-- Helps identify systematic data ingestion problems needing correction.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    source,
    COUNT(*)                                AS error_count,
    MAX(run_time)                           AS last_attempt,
    GROUP_CONCAT(DISTINCT notes)            AS error_notes
FROM etl_log
WHERE status = 'ERROR'
GROUP BY source
ORDER BY error_count DESC
LIMIT 20;


-- Q18: Road Links with No Traffic Data (Data Gaps)
-- §C.1: 286 manual daughter stations; ideally all links surveyed ≥ once
--       per 3-year cycle (§D.12). Links with no counts are data gaps.
-- §H.5: Traffic survey QC checks 7–10% of counting time.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    rl.link_id,
    rl.link_name,
    'NO TRAFFIC COUNT DATA'                 AS data_status
FROM road_links rl
WHERE rl.link_id != 'Link_ID'
  AND NOT EXISTS (
      SELECT 1
      FROM traffic_counts tc
      WHERE tc.link_id = rl.link_id
        AND tc.survey_year > 2000
        AND tc.total_count > 0
  )
ORDER BY rl.link_id;


-- Q19: Duplicate Road Entries Check
-- §A.6 LRS Change Control: road IDs permanently assigned; never reused.
-- Duplicate link_ids in road_links indicate import errors or LRS violations.
-- Also checks for duplicate rows in traffic_counts with same link/date/direction.
-- ─────────────────────────────────────────────────────────────────────────────
-- 19a: Duplicate link_id in road_links
SELECT
    link_id,
    COUNT(*)                                AS occurrence_count,
    GROUP_CONCAT(link_name, ' | ')          AS link_names_found
FROM road_links
GROUP BY link_id
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;

-- 19b: Duplicate count records in traffic_counts (same link + date + direction)
SELECT
    link_id,
    count_date,
    survey_year,
    direction,
    COUNT(*)                                AS duplicate_count,
    MIN(total_count)                        AS count_min,
    MAX(total_count)                        AS count_max
FROM traffic_counts
WHERE survey_year > 2000
GROUP BY link_id, count_date, survey_year, direction
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- 19c: Check if survey_year=2024 and 2025 are genuinely duplicate imports
SELECT
    '2024' AS yr, COUNT(*) AS records,
    SUM(total_count) AS sum_counts
FROM traffic_counts WHERE survey_year = 2024
UNION ALL
SELECT
    '2025', COUNT(*), SUM(total_count)
FROM traffic_counts WHERE survey_year = 2025;


-- Q20: Roads with Suspiciously High AADT — Outlier Detection
-- §C.7: ATC automatic flag when count > 3× moving average (equipment fault).
-- Statistical method: outliers defined as AADT > mean + 3 × std deviation
-- per vehicle class, across all links in the latest survey year.
-- §H.3: Substantial differences (≥ 2 grade gap) trigger QC investigation;
--       for traffic, implausible counts should be cross-checked against
--       nearest ATC mother station data.
-- ─────────────────────────────────────────────────────────────────────────────
WITH stats AS (
    SELECT
        AVG(total_count)                    AS global_mean,
        -- SQLite has no STDDEV; approximate with population variance formula
        SQRT(
            AVG(total_count * total_count) - AVG(total_count) * AVG(total_count)
        )                                   AS global_stddev
    FROM traffic_counts
    WHERE survey_year = (
              SELECT MAX(survey_year)
              FROM traffic_counts
              WHERE survey_year > 2000
          )
      AND total_count > 0
),
link_avg AS (
    SELECT
        link_id,
        AVG(total_count)                    AS avg_aadt
    FROM traffic_counts
    WHERE survey_year = (
              SELECT MAX(survey_year)
              FROM traffic_counts
              WHERE survey_year > 2000
          )
      AND total_count > 0
    GROUP BY link_id
)
SELECT
    la.link_id,
    rl.link_name,
    ROUND(la.avg_aadt, 0)                   AS link_avg_aadt,
    ROUND(s.global_mean, 0)                 AS network_mean_aadt,
    ROUND(s.global_stddev, 0)               AS network_stddev,
    ROUND(s.global_mean + 3 * s.global_stddev, 0) AS outlier_threshold,
    ROUND((la.avg_aadt - s.global_mean) / NULLIF(s.global_stddev, 0), 1) AS z_score,
    'SUSPECTED OUTLIER: verify against nearest ATC station (§C.7)' AS action_required
FROM link_avg la
CROSS JOIN stats s
LEFT JOIN road_links rl ON la.link_id = rl.link_id
WHERE la.avg_aadt > (s.global_mean + 3 * s.global_stddev)
ORDER BY la.avg_aadt DESC;


-- =============================================================================
-- END OF ASSET MANAGEMENT QUERY LIBRARY
-- =============================================================================
-- To run all queries against the database:
--   sqlite3 data/traffic_platform.db < scripts/asset_management_queries.sql
--
-- For IRI/roughness queries (Q16): load dTIMS Roughness CSV exports into
--   a `roughness` table with columns: link_id, chainage_km, iri_m_km,
--   survey_date, and re-run Q16 replacing the AADT proxy with actual IRI bands:
--   IRI > 6.6 → Urgent (RECON), 5.5–6.6 → Scheduled (OVERL), < 5.5 → Routine
--
-- For surface_type queries (Q07, Q10, Q15): load
--   1.Road Network/Fetched Data/uganda_national_road_network_links_latest.csv
--   with Surface_Type column into road_links or a separate surface_types table.
-- =============================================================================
