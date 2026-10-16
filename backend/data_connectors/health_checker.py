import time
import urllib.request
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
from backend.config import DB_PATH, MODELS_DIR

def ping_url(url: str, timeout: int = 5) -> Dict[str, Any]:
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NepalLandslideResearch/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            latency_ms = round((time.time() - start) * 1000, 1)
            return {
                "status": "CONNECTED" if res.status == 200 else "DEGRADED",
                "status_code": res.status,
                "latency_ms": latency_ms,
                "error": None
            }
    except Exception as e:
        return {
            "status": "UNAVAILABLE",
            "status_code": None,
            "latency_ms": None,
            "error": str(e)
        }

def check_system_health() -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # 1. Database
    db_status = "ONLINE" if DB_PATH.exists() else "INITIALIZING"

    # 2. ML Models
    rf_path = MODELS_DIR / "rf_model.joblib"
    xgb_path = MODELS_DIR / "xgb_model.json"
    metrics_path = MODELS_DIR / "metrics.json"
    models_trained = rf_path.exists() and metrics_path.exists()
    
    model_info = {
        "status": "TRAINED" if models_trained else "NOT TRAINED",
        "random_forest_available": rf_path.exists(),
        "xgboost_available": xgb_path.exists()
    }
    if metrics_path.exists():
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                model_info["metrics_summary"] = json.load(f)
        except Exception:
            pass

    # 3. External Connectors
    bipad_health = ping_url("https://bipadportal.gov.np/api/v1/province/")
    dhm_health = ping_url("https://bipadportal.gov.np/api/v1/rain-stations/?limit=1")
    rain_health = ping_url("https://api.open-meteo.com/v1/forecast?latitude=27.7&longitude=85.3&hourly=precipitation&past_days=1")
    dem_health = ping_url("https://api.open-meteo.com/v1/elevation?latitude=27.7&longitude=85.3")

    return {
        "timestamp_utc": now_iso,
        "backend": "ONLINE",
        "database": db_status,
        "ml_model": model_info,
        "data_sources": {
            "bipad_portal": {
                "name": "BIPAD Portal Nepal (NDRRMA)",
                "purpose": "Administrative Boundaries, DHM Rain Stations, Landslide Incidents",
                **bipad_health
            },
            "dhm_nepal": {
                "name": "Department of Hydrology and Meteorology (DHM)",
                "purpose": "Real-time Telemetry & Precipitation Gauges",
                **dhm_health
            },
            "open_meteo_rain": {
                "name": "Open-Meteo High-Res Precipitation & Archive",
                "purpose": "24h, 3-day, 7-day Cumulative Rainfall & Antecedent Index",
                **rain_health
            },
            "copernicus_dem": {
                "name": "Copernicus & SRTM Digital Elevation Model",
                "purpose": "Elevation, Finite-Difference Slope & Aspect",
                **dem_health
            }
        }
    }
