"""
traffic_engine.py — NTIS Traffic Prediction & Data API
═══════════════════════════════════════════════════════════
FastAPI application serving:
  • POST /api/v1/traffic/predict-volume    — ML prediction via Mother/Daughter station models
  • GET  /api/v1/traffic/od-matrix         — Link-level Origin-Destination matrix
  • GET  /api/v1/traffic/classifications   — Vehicle class definitions & axle load regulations
  • GET  /api/v1/traffic/stations          — Station metadata (mother + daughter)

Models: GradientBoostingRegressor (scikit-learn 1.9) trained on TIS data 2016–2025.
Features reverse-engineered from .pkl files:
  total_volume:  21 features (Hour…LON)
  class_volume:  22 features (adds vehicle_class_encoded)

Run:
  cd server && uvicorn traffic_engine:app --host 0.0.0.0 --port 8001 --reload
"""
import os
import json
import math
import pickle
import warnings
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore", category=UserWarning)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR  = os.path.join(BASE_DIR, "models", "traffic")
DATA_DIR   = os.path.join(os.path.dirname(BASE_DIR), "data")

MOTHER_DIR   = os.path.join(MODEL_DIR, "mother_stations")
DAUGHTER_DIR = os.path.join(MODEL_DIR, "daughter_stations")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Uganda NTIS Traffic Engine",
    description="Traffic volume prediction, OD matrix, and vehicle classification API for the National Traffic Information System.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lazy model cache ─────────────────────────────────────────────────────────
_cache: Dict[str, Any] = {}

def _load_pkl(path: str):
    with open(path, "rb") as f:
        return pickle.load(f)

def get_models(station_type: str) -> dict:
    """Load and cache models + encoders for a station type."""
    if station_type in _cache:
        return _cache[station_type]
    
    model_dir = MOTHER_DIR if station_type == "mother" else DAUGHTER_DIR
    saved     = os.path.join(model_dir, "saved_models") if os.path.isdir(os.path.join(model_dir, "saved_models")) else model_dir
    
    try:
        data = {
            "total_model":    _load_pkl(os.path.join(saved, "total_volume_model.pkl")),
            "total_encoders": _load_pkl(os.path.join(saved, "total_volume_encoders.pkl")),
            "total_features": _load_pkl(os.path.join(saved, "total_volume_features.pkl")),
            "class_model":    _load_pkl(os.path.join(saved, "class_volume_model.pkl")),
            "class_encoders": _load_pkl(os.path.join(saved, "class_volume_encoders.pkl")),
            "class_features": _load_pkl(os.path.join(saved, "class_volume_features.pkl")),
        }
        # Load road metadata
        meta_path = os.path.join(model_dir, "road_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                data["road_metadata"] = json.load(f)
        else:
            data["road_metadata"] = {}
        
        _cache[station_type] = data
        return data
    except Exception as e:
        raise RuntimeError(f"Failed to load {station_type} models: {e}")


def _encode_value(encoders: dict, key: str, value: str) -> float:
    """Safely encode a categorical value using the stored LabelEncoder."""
    if key not in encoders:
        raise ValueError(f"No encoder for '{key}'")
    enc = encoders[key]
    if value not in enc.classes_:
        raise ValueError(f"Unknown {key} value '{value}'. Known: {list(enc.classes_[:10])}...")
    return float(enc.transform([value])[0])


def _time_features(hour: int, dow: int) -> dict:
    """Compute cyclical and peak-hour features."""
    return {
        "hour_sin": math.sin(2 * math.pi * hour / 24),
        "hour_cos": math.cos(2 * math.pi * hour / 24),
        "dow_sin":  math.sin(2 * math.pi * dow / 7),
        "dow_cos":  math.cos(2 * math.pi * dow / 7),
        "is_morning_peak": int(7 <= hour <= 9),
        "is_evening_peak": int(16 <= hour <= 19),
        "is_peak":         int(7 <= hour <= 9 or 16 <= hour <= 19),
    }

def _time_period(hour: int) -> str:
    """Map hour to time period label matching the encoder."""
    if 7 <= hour <= 9:
        return "Morning_Peak"
    elif 10 <= hour <= 15:
        return "Midday"
    elif 16 <= hour <= 19:
        return "Evening_Peak"
    elif 20 <= hour <= 22:
        return "Late_Evening"
    else:
        return "Night"

# ── Request / Response Models ─────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    station_type: str = Field(..., description="'mother' or 'daughter'")
    road: str = Field(..., description="Road link ID (e.g. 'A00109', 'Kampala-Mukono')")
    region: str = Field(..., description="Region name (e.g. 'Central', 'North')")
    station: str = Field(..., description="Maintenance station (e.g. 'Kampala', 'Gulu')")
    hour: int = Field(12, ge=0, le=23, description="Hour of day (0–23)")
    direction: int = Field(0, ge=0, le=2, description="0=combined, 1=direction1, 2=direction2")
    year: int = Field(2026, description="Prediction year")
    month: int = Field(7, ge=1, le=12)
    day_of_month: int = Field(17, ge=1, le=31)
    lat: float = Field(0.0, description="Latitude of the station/link")
    lon: float = Field(32.0, description="Longitude of the station/link")
    vehicle_class: Optional[str] = Field(
        None,
        description="Vehicle class for per-class prediction (e.g. 'Saloon_Cars_Taxis'). Omit for total volume."
    )

class PredictionResponse(BaseModel):
    station_type: str
    road: str
    prediction_type: str
    predicted_volume: float
    vehicle_class: Optional[str] = None
    hour: int
    direction: int
    year: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "online", "service": "NTIS Traffic Engine", "version": "1.0.0"}


@app.post("/api/v1/traffic/predict-volume", response_model=PredictionResponse)
async def predict_volume(req: PredictionRequest):
    """Predict traffic volume for a specific road link, time, and direction."""
    if req.station_type not in ("mother", "daughter"):
        raise HTTPException(400, "station_type must be 'mother' or 'daughter'")

    try:
        models = get_models(req.station_type)
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    # Determine day_of_week and week_of_year from the date
    try:
        dt = datetime(req.year, req.month, req.day_of_month, req.hour)
    except ValueError:
        dt = datetime(req.year, req.month, min(req.day_of_month, 28), req.hour)
    
    dow = dt.weekday()
    woy = dt.isocalendar()[1]
    is_weekend = int(dow >= 5)
    
    tf = _time_features(req.hour, dow)
    tp = _time_period(req.hour)

    use_class_model = req.vehicle_class is not None
    encoders = models["class_encoders"] if use_class_model else models["total_encoders"]
    model    = models["class_model"]    if use_class_model else models["total_model"]

    try:
        road_enc    = _encode_value(encoders, "Road", req.road)
        region_enc  = _encode_value(encoders, "REGION", req.region)
        station_enc = _encode_value(encoders, "STATION", req.station)
        tp_enc      = _encode_value(encoders, "time_period", tp)
    except ValueError as e:
        raise HTTPException(400, str(e))

    features = [
        req.hour, req.direction, dow, req.month, req.day_of_month,
        woy, is_weekend, req.year,
        tf["hour_sin"], tf["hour_cos"], tf["dow_sin"], tf["dow_cos"],
        tf["is_morning_peak"], tf["is_evening_peak"], tf["is_peak"],
        road_enc, region_enc, station_enc, tp_enc,
        req.lat, req.lon,
    ]

    if use_class_model:
        try:
            vc_enc = _encode_value(encoders, "vehicle_class", req.vehicle_class)
        except ValueError as e:
            raise HTTPException(400, str(e))
        features.append(vc_enc)

    prediction = model.predict([features])[0]

    return PredictionResponse(
        station_type=req.station_type,
        road=req.road,
        prediction_type="class_volume" if use_class_model else "total_volume",
        predicted_volume=max(0.0, round(float(prediction), 1)),
        vehicle_class=req.vehicle_class,
        hour=req.hour,
        direction=req.direction,
        year=req.year,
    )


@app.get("/api/v1/traffic/od-matrix")
async def get_od_matrix(
    vehicle_class: Optional[str] = Query(None, description="Filter by vehicle class"),
    year: int = Query(2026, description="Projection year"),
):
    """Return the link-level Origin-Destination matrix."""
    od_path = os.path.join(DATA_DIR, "od_matrix.json")
    if not os.path.exists(od_path):
        raise HTTPException(404, "OD matrix not yet generated. Run scripts/generate_od_matrix.py first.")
    
    with open(od_path) as f:
        od_data = json.load(f)
    
    # Optional filtering
    if vehicle_class and "flows" in od_data:
        filtered = []
        for flow in od_data["flows"]:
            if "vehicle_classes" in flow and vehicle_class in flow["vehicle_classes"]:
                filtered.append({
                    "from": flow["from"],
                    "to": flow["to"],
                    "volume": flow["vehicle_classes"][vehicle_class],
                })
            elif vehicle_class is None:
                filtered.append(flow)
        od_data["flows"] = filtered
    
    return od_data


@app.get("/api/v1/traffic/classifications")
async def get_classifications():
    """Return vehicle classifications, axle load limits, and dimension regulations."""
    cls_path = os.path.join(DATA_DIR, "vehicle_classifications.json")
    if not os.path.exists(cls_path):
        raise HTTPException(404, "Vehicle classifications data not found.")
    with open(cls_path) as f:
        return json.load(f)


@app.get("/api/v1/traffic/stations")
async def get_stations(station_type: str = Query("daughter", description="'mother' or 'daughter'")):
    """Return station/road metadata with coordinates."""
    if station_type not in ("mother", "daughter"):
        raise HTTPException(400, "station_type must be 'mother' or 'daughter'")
    try:
        models = get_models(station_type)
        return {
            "station_type": station_type,
            "count": len(models["road_metadata"]),
            "stations": models["road_metadata"],
        }
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@app.get("/api/v1/traffic/encoder-values")
async def get_encoder_values(station_type: str = Query("daughter")):
    """Return all valid values for each encoder (for UI dropdowns)."""
    if station_type not in ("mother", "daughter"):
        raise HTTPException(400, "station_type must be 'mother' or 'daughter'")
    try:
        models = get_models(station_type)
        encoders = models["class_encoders"]
        return {
            key: list(enc.classes_)
            for key, enc in encoders.items()
        }
    except RuntimeError as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
