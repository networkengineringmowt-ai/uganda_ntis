"""
Uganda National Roads Platform — comprehensive ETL → Supabase Unified DB.

Reads the JSON datasets in this folder (public/data) and upserts them into the
41-table Supabase schema. Idempotent: uses Prefer: resolution=ignore-duplicates
so re-running is safe for tables with a PK / UNIQUE constraint.

Each table load is isolated in try/except so one bad table never aborts the run.

Usage:  python etl_all.py
"""
import json, urllib.request, urllib.error, os, time
from pathlib import Path

URL = "https://udionwmqmjcfzbdhoetv.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
       ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkaW9ud21xbWpjZnpiZGhvZXR2Iiwicm9sZSI6Im"
       "Fub24iLCJpYXQiOjE3ODA2NDI3NjcsImV4cCI6MjA5NjIxODc2N30"
       ".EP5bruNS55m2PE1nf0p2KeOxm4Tnae5ESAj6DukqIr0")
HERE = Path(__file__).parent.parent / "public" / "data"   # JSON sources live in public/data
BATCH = 500

def hdr(prefer="return=minimal,resolution=ignore-duplicates"):
    return {"apikey": KEY, "Authorization": "Bearer " + KEY,
            "Content-Type": "application/json", "Prefer": prefer}

def load(name):
    try:
        return json.load(open(HERE / name, encoding="utf-8"))
    except FileNotFoundError:
        print(f"   [skip] {name} not found"); return None

def i(v):
    try:
        return int(round(float(v))) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None

def post(table, rows):
    if not rows:
        print(f"   [skip] {table}: 0 rows"); return
    done = 0
    for k in range(0, len(rows), BATCH):
        chunk = rows[k:k + BATCH]
        body = json.dumps(chunk).encode("utf-8")
        req = urllib.request.Request(f"{URL}/{table}", data=body, headers=hdr(), method="POST")
        for attempt in range(1, 4):
            try:
                with urllib.request.urlopen(req) as r:
                    done += len(chunk); st = r.status; break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 3:
                    time.sleep(5); continue
                raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:280]}")
    print(f"   OK   {table:<28} {done:>6,} rows  (HTTP {st})")

def run(table, fn):
    try:
        post(table, fn())
    except Exception as e:
        print(f"   FAIL {table:<28} {e}")

# ── builders ──────────────────────────────────────────────────────────────────
RL_COLS = ["link_id","road_no","road_class","link_name","chainage_from","chainage_to",
           "length_km","surface_type","maintenance_station","maintenance_region",
           "completion_year","rehab_year","last_intervention","funder",
           "ndpiv_1","ndpiv_2","oprc","ndpiv_oprc","comments"]
def b_road_links():
    d = load("network_links.json") or []
    yrs = {"completion_year","rehab_year","last_intervention"}
    return [{c: (i(r.get(c)) if c in yrs else r.get(c)) for c in RL_COLS} for r in d if r.get("link_id")]

def b_road_link_condition():
    d = load("link_condition_lookup.json") or {}
    out = []
    for lid, v in d.items():
        if not isinstance(v, dict): continue
        out.append({"link_id": lid, "survey_year": i(v.get("year")) or 2024,
                    "iri": v.get("iri"), "rut_mm": v.get("rut_mm"), "cracking": v.get("cracking"),
                    "pci": v.get("pci"), "vci": v.get("vci"), "surface": v.get("surface")})
    return out

def b_stations():
    d = load("tcs_stations.json") or []
    return [{"station_id": f"TCS{r.get('tcs_no')}", "station_name": r.get("tcs_name"),
             "link_id": r.get("link_id"), "link_name": r.get("link_name"),
             "latitude": r.get("lat"), "longitude": r.get("lon"),
             "station_type": r.get("station"), "region": r.get("region"), "tcs_no": i(r.get("tcs_no"))}
            for r in d if r.get("tcs_no") is not None]

def b_maint_stations():
    return load("maintenance_stations.json") or []

def b_regional():
    return load("regional_performance.json") or []

def b_budget_align():
    return load("budget_alignment.json") or []

def b_maint_prog():
    d = load("maintenance_programme.json") or {}
    return d.get("all_links", [])

def b_network_stats():
    n = load("network_stats.json") or {}
    if not n: return []
    return [{"id": 1, "total_links": i(n.get("total_links")), "total_km": n.get("total_km"),
             "official_km": n.get("official_km"), "paved_km": n.get("paved_km"),
             "unpaved_km": n.get("unpaved_km"), "paved_pct": n.get("paved_pct"),
             "total_bridges": i(n.get("bridges_total")),
             "class_km": n.get("by_class"), "class_links": n.get("by_class"),
             "region_km": n.get("by_region"), "region_links": n.get("by_region"),
             "data_vintage": "2024"}]

def b_overloading():
    o = load("overloading_summary.json") or {}
    m = o.get("link_risk_map", {}) or {}
    return [{"link_id": lid, "esal_factor": v.get("esal"), "overload_pct": v.get("hpct"),
             "risk_score": v.get("idx"), "risk_category": v.get("rc")}
            for lid, v in m.items()]

def b_growth():
    g = load("growth_factors_summary.json") or {}
    return [{"region": r.get("region"), "year": i(r.get("year")), "month": i(r.get("month")),
             "vehicle_class": r.get("vehicle_class"), "mef": r.get("mef"),
             "monthly_aadt": r.get("monthly_aadt"), "annual_aadt": r.get("annual_aadt"),
             "sample_days": i(r.get("sample_days"))}
            for r in g.get("monthly_factors", [])]

def b_ml_metrics():
    m = load("ml_model_metrics.json")
    if not m: return []
    m = m if isinstance(m, list) else [m]
    keep = ["model_name","model_type","r2_score","rmse","mae","baseline_rmse",
            "improvement_pct","training_samples","test_samples","features","training_date","status"]
    return [{k: x.get(k) for k in keep} for x in m]

def b_surveyed():
    b = load("bot_results.json") or {}
    out, seen = [], set()
    for q, recs in b.items():
        if not isinstance(recs, list): continue
        for r in recs:
            if isinstance(r, dict) and r.get("link_id"):
                key = (q, r.get("link_id"))
                if key in seen: continue       # dedupe intra-file (query_code,link_id)
                seen.add(key)
                out.append({"query_code": q, "link_id": r.get("link_id"),
                            "road_name": r.get("road_name"), "region": r.get("region"),
                            "surface": r.get("surface"), "length_km": r.get("length_km"),
                            "iri": r.get("iri"), "pci": r.get("pci")})
    return out

def b_img_summary():
    d = load("image_defects_summary.json") or {}
    if not d: return []
    return [{"model": d.get("model"), "images_processed": i(d.get("images_processed")),
             "defect_distribution": d.get("defect_distribution"),
             "severity_distribution": d.get("severity_distribution"),
             "generated_at": d.get("generated_at")}]

def b_img_detections():
    d = load("image_defects_summary.json") or {}
    return [{"link_id": r.get("link_id"), "dominant_defect": r.get("dominant_defect"),
             "image_count": i(r.get("image_count")), "avg_severity": r.get("avg_severity")}
            for r in d.get("top_damaged_links", []) if r.get("link_id")]

def b_romdas_calib():
    d = load("romdas_calibration.json") or {}
    if not d: return []
    c = d.get("calibration", {}) or {}
    return [{"generated_at": d.get("generated_at"), "links_analysed": i(d.get("links_analysed")),
             "maintenance_detected": i(d.get("maintenance_detected")),
             "naturally_deteriorating": i(d.get("naturally_deteriorating")),
             "hdm4_factor_current": c.get("hdm4_factor_current"),
             "observed_calib_factor": c.get("observed_calib_factor"),
             "prediction_rmse_m_km_yr": c.get("prediction_rmse_m_km_yr"),
             "mean_error_m_km_yr": c.get("mean_error_m_km_yr"), "note": c.get("note")}]

def b_romdas_events():
    d = load("romdas_calibration.json") or {}
    return [{"link_id": r.get("link_id"), "road_name": r.get("road_name"),
             "iri_2020": r.get("iri_2020"), "iri_2021": r.get("iri_2021"),
             "delta_iri": r.get("delta_iri"), "likely_treatment": r.get("likely_treatment")}
            for r in d.get("maintenance_events", []) if r.get("link_id")]

def b_iri_pred():
    d = load("romdas_predictions.json") or {}
    return [{"link_id": r.get("link_id"), "predicted_iri_1yr": r.get("predicted_iri_1yr"),
             "predicted_iri_3yr": r.get("predicted_iri_3yr"), "predicted_iri_5yr": r.get("predicted_iri_5yr"),
             "predicted_condition_1yr": r.get("predicted_condition_1yr"),
             "predicted_condition_3yr": r.get("predicted_condition_3yr"),
             "deterioration_rate": r.get("deterioration_rate"),
             "intervention_year": i(r.get("intervention_year"))}
            for r in d.get("link_predictions", []) if r.get("link_id")]

def b_structures():
    d = load("bridges_summary.json") or {}
    return [{"id": str(r.get("id")), "name": r.get("name"), "structure_type": r.get("type"),
             "road": r.get("road"), "latitude": r.get("lat"), "longitude": r.get("lon"),
             "span_length_m": r.get("span_m")}
            for r in d.get("critical_structures", []) if r.get("id")]

def b_bridge_works():
    return load("bridge_works_2026.json") or []

# ── run ───────────────────────────────────────────────────────────────────────
# NOTE: tables whose natural key is a secondary UNIQUE (not the IDENTITY PK) are
# NOT protected by Prefer: resolution=ignore-duplicates (PostgREST resolves on PK
# only). Re-running this script will 409 on those (data already loaded) and would
# duplicate the few summary tables that have no secondary unique key. It is a
# first-load script; for re-loads, TRUNCATE the target tables first (service_role).
def main():
    print("\nUganda National Roads — full ETL → Supabase\n" + "=" * 52)
    run("road_links",                b_road_links)
    run("road_link_condition",       b_road_link_condition)
    run("traffic_count_stations",    b_stations)
    run("maintenance_stations",      b_maint_stations)
    run("regional_pms_performance",  b_regional)
    run("budget_alignment",          b_budget_align)
    run("maintenance_programme",     b_maint_prog)
    run("network_stats",             b_network_stats)
    run("overloading_by_link",       b_overloading)
    run("traffic_growth_factors",    b_growth)
    run("ml_model_metrics",          b_ml_metrics)
    run("surveyed_link_condition",   b_surveyed)
    run("image_defect_summary",      b_img_summary)
    run("image_defect_detections",   b_img_detections)
    run("romdas_calibration_summary",b_romdas_calib)
    run("romdas_maintenance_events", b_romdas_events)
    run("link_iri_predictions",      b_iri_pred)
    run("structures",                b_structures)
    run("bridge_works",              b_bridge_works)
    print("=" * 52 + "\nDone.\n")

if __name__ == "__main__":
    main()
