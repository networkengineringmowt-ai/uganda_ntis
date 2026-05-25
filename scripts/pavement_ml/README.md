# ROMDAS PMS ML Pipeline — Uganda National Roads

Backend pavement management pipeline for UNRA. Ingests ROMDAS road condition
survey data and applies machine learning to predict IRI deterioration, classify
pavement condition, and recommend maintenance interventions.

## Scripts

| Script | Purpose |
|--------|---------|
| `romdas_ingest.py` | Parse generic ROMDAS/dTIMS files → `traffic_platform.db` |
| `ingest_roughness_batch.py` | Batch-ingest ROMDAS 2020 `Roughness_Processed_*.xlsx` files |
| `ingest_mdb_batch.py` | Batch-ingest ROMDAS 2021-22 `.mdb` files via pyodbc + GPS snap |
| `romdas_ml_model.py` | Train ML models + generate network predictions JSON |
| `export_survey_geojson.py` | Export `romdas_sections` joined to road geometry as GeoJSON |
| `deterioration_model.py` | HDM-4 calibrated deterioration model (base layer) |
| `image_defect_classifier.py` | CNN classifier for distress photographs |

## Quick Start

```bash
# From the worktree root:

# 1. Create DB tables (one-time setup)
python scripts/pavement_ml/romdas_ingest.py --setup

# 2. Ingest ROMDAS 2020 xlsx files
python scripts/pavement_ml/ingest_roughness_batch.py

# 3. Ingest ROMDAS 2021-22 .mdb files (requires pyodbc + MS Access ODBC driver)
python scripts/pavement_ml/ingest_mdb_batch.py

# 4. Train models and generate predictions
python scripts/pavement_ml/romdas_ml_model.py

# 5. Export survey sections as GeoJSON for frontend
python scripts/pavement_ml/export_survey_geojson.py
```

Output: `public/data/romdas_predictions.json` (1,017 links with IRI forecasts).

---

## Adding Real ROMDAS Data

Drop ROMDAS export files into:
```
scripts/pavement_ml/data/romdas/
```

Then ingest and retrain:
```bash
python scripts/pavement_ml/romdas_ingest.py
python scripts/pavement_ml/romdas_ml_model.py
```

### Supported file formats

| Format | Detection |
|--------|-----------|
| Standard ROMDAS CSV | columns: chainage, IRI_L, IRI_R, Rut_L, Rut_R, GPS_lat, GPS_lon |
| ROMDAS Summary Excel | section-level: mean_iri, max_rut, section_length |
| dTIMS roughness CSV | columns: RoadID, StartDist, EndDist, IRI, Date |
| Generic tabular | any file containing IRI / roughness + chainage columns |

Column names are matched case-insensitively with a broad alias table (see `COL_ALIASES`
in `romdas_ingest.py`). Mixed IRI units are auto-detected: values > 100 are treated as
mm/m and converted to m/km.

### Edge-case handling

| Issue | Handling |
|-------|---------|
| IRI in mm/m units | Auto-detected (max > 100) and divided by 1000 |
| Duplicate chainages | Averaged across all numeric columns |
| Speed < 20 or > 90 km/h | `data_quality = 'suspect'` |
| IRI > 25 m/km | `data_quality = 'suspect'` (likely sensor artefact) |
| Missing GPS | Link left blank; matched manually via road_name + chainage |

### Ingestion options

```bash
# Single file
python scripts/pavement_ml/romdas_ingest.py --file survey_kampala_2024.csv

# Custom directory
python scripts/pavement_ml/romdas_ingest.py --dir /path/to/surveys/

# With road network GeoJSON for GPS snapping
python scripts/pavement_ml/romdas_ingest.py \
    --geojson public/bundle.json
```

---

## ML Models

### Model 1 — IRI Deterioration Predictor

| | |
|--|--|
| **Algorithm** | `MultiOutputRegressor(GradientBoostingRegressor)` |
| **Features** | current_iri, rut_max_mm, AADT_log, HGV_pct, ESALs, structural_number, deterioration_rate, surface_type, road_class, region, climate_factor, pct_above_9 |
| **Targets** | IRI at +1yr, +3yr, +5yr (three simultaneous outputs) |
| **CV R²** | **0.9788** (5-fold, mean across 3 outputs) |
| **Train RMSE** | 0.521 m/km |
| **Saved to** | `models/iri_deterioration_gbr.joblib` |

### Model 2 — Condition Classifier

| | |
|--|--|
| **Algorithm** | `RandomForestClassifier` |
| **Features** | mean_iri, rut_max_mm, sd_iri, pct_above_9, AADT_log, surface_type, road_class |
| **Target** | condition_class  (Good / Fair / Poor / Very Poor) |
| **CV Accuracy** | **100.0%** (5-fold) |
| **Saved to** | `models/condition_classifier_rf.joblib` |

### Model 3 — Intervention Trigger Predictor

| | |
|--|--|
| **Algorithm** | `GradientBoostingRegressor` |
| **Features** | current_iri, deterioration_rate, AADT_log, structural_number, road_class, surface_type, region |
| **Target** | years_until_intervention (0–11) |
| **CV R²** | **0.9632** (5-fold) |
| **Train RMSE** | 0.70 years |
| **Saved to** | `models/intervention_predictor_gbr.joblib` |

### Intervention thresholds (Uganda HDM-4 calibration)

| IRI (m/km) | Paved treatment |
|------------|----------------|
| > 3.5 | Routine Maintenance |
| > 5.0 | Reseal |
| > 6.5 | Overlay |
| > 9.0 | Rehabilitation |
| > 12.0 | Reconstruction |

---

## Training Data Strategy

Models are trained on:

1. **Primary (1,017 links)**: Pivoted from `deterioration_curves` table — HDM-4
   calibrated projections 2024–2030 for every national road link.
2. **Real sections (136 rows)**: From `romdas_sections` — actual measured IRI
   from 2020 and 2021 ROMDAS surveys, projected via HDM-4 to generate targets.
3. **Augmented (5,000 samples)**: Synthetic data via Uganda HDM-4 equations with
   varied road class, region, AADT, age, and noise seeds.

**Real ROMDAS data ingested into `romdas_measurements`:**

| Source | Rows | Links | Avg IRI | GPS |
|--------|------|-------|---------|-----|
| `IRI 2020.xlsx` — ROMDAS 2020 (aggregate) | 28,174 | 105 | 3.21 m/km | No |
| `Roughness_Processed_*.xlsx` — ROMDAS 2020 (per-link) | 27,091 | 100 | 3.15 m/km | No |
| ROMDAS 2021-22 `.mdb` files (42 links) | 10,395 | 29 | 2.63 m/km | Yes |
| `IRI data_dtims.xlsx` — dTIMS 2017 | 30,224 | chainage-based | — | No |
| **Total** | **95,625** | **130 unique links** | — | — |

DB totals: 89,708 good measurements; 136 section-level aggregates (109 from 2020, 27 from 2021).

---

## Output: `public/data/romdas_predictions.json`

```json
{
  "model_versions": { "iri_predictor": "...", ... },
  "network_summary": {
    "links_analysed": 1021,
    "current_mean_iri": 8.4,
    "predicted_mean_iri_2027": 9.1,
    "condition_2024": {"Good": 171, "Fair": 115, "Poor": 28, "Very Poor": 707},
    "condition_2027": { ... }
  },
  "link_predictions": [
    {
      "link_id": "C983_Link01",
      "road_name": "Kapelimoru-Kotein",
      "current_iri": 16.0,
      "predicted_iri_1yr": 16.8,
      "predicted_iri_3yr": 18.1,
      "predicted_iri_5yr": 19.2,
      "condition_now": "Very Poor",
      "predicted_condition_1yr": "Very Poor",
      "deterioration_rate": 0.8,
      "intervention_year": 2024,
      "intervention_type": "Reconstruction",
      "confidence_score": 0.91
    }
  ]
}
```

---

## Output Files

| File | Contents |
|------|----------|
| `public/data/romdas_predictions.json` | ML predictions for 1,017 links (IRI +1/+3/+5yr, condition, intervention) |
| `public/data/romdas_sections_summary.json` | Aggregate statistics by survey year |
| `public/data/romdas_survey_sections.geojson` | 126 real survey sections with road geometry for map overlay |

## DB Tables

| Table | Purpose |
|-------|---------|
| `romdas_measurements` | Raw 100 m interval ROMDAS data (GPS, IRI, rut); 95,625 rows |
| `romdas_sections` | Section-level aggregated condition (link_id + year); 136 rows |
| `romdas_ml_predictions` | ML predictions for all 1,017 road links |

---

## Re-training

```bash
# Full pipeline from scratch
python scripts/pavement_ml/romdas_ingest.py --setup       # re-create tables
python scripts/pavement_ml/ingest_roughness_batch.py       # ingest 2020 xlsx
python scripts/pavement_ml/ingest_mdb_batch.py             # ingest 2021-22 mdb
python scripts/pavement_ml/romdas_ml_model.py              # retrain + re-predict
python scripts/pavement_ml/export_survey_geojson.py        # rebuild survey GeoJSON
```
