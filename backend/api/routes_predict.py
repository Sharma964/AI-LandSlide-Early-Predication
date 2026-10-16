import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from backend.database.db import get_db_connection, get_npt_now_str
from backend.data_connectors.rain_connector import get_rainfall_features
from backend.data_connectors.terrain_connector import get_terrain_features
from backend.ml.predict import predict_landslide, classify_risk
from backend.config import RESEARCH_DISCLAIMER
from backend.geo_utils import is_coordinate_in_nepal

router = APIRouter(prefix="/api", tags=["Prediction"])

class PredictRequest(BaseModel):
    province_id: Optional[int] = None
    district_id: Optional[int] = None
    location_id: Optional[int] = None
    province_name: Optional[str] = None
    district_name: Optional[str] = None
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    model_name: Optional[str] = "XGBoost"

@router.post("/predict")
def run_prediction(req: PredictRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Resolve Location and Names
    lat = req.lat
    lon = req.lon
    prov_name = req.province_name or "Unknown Province"
    dist_name = req.district_name or "Unknown District"
    loc_name = req.location_name or "Custom GPS Point"

    # Reverse-lookup nearest Nepal district if coordinates provided without district/province
    if lat is not None and lon is not None and (dist_name == "Unknown District" or prov_name == "Unknown Province"):
        cursor.execute("""
        SELECT d.id, d.title_en as dist_name, p.title_en as prov_name,
               ((d.centroid_lat - ?)*(d.centroid_lat - ?) + (d.centroid_lon - ?)*(d.centroid_lon - ?)) as dist_sq
        FROM districts d
        JOIN provinces p ON d.province_id = p.id
        ORDER BY dist_sq ASC LIMIT 1
        """, (lat, lat, lon, lon))
        nearest_dist = cursor.fetchone()
        if nearest_dist:
            if dist_name == "Unknown District":
                dist_name = nearest_dist["dist_name"]
            if prov_name == "Unknown Province":
                prov_name = nearest_dist["prov_name"]
            if loc_name in ["Custom GPS Point", None, ""]:
                loc_name = f"{nearest_dist['dist_name']} Area ({round(lat, 3)}°N, {round(lon, 3)}°E)"

    if req.location_id:
        cursor.execute("""
        SELECT l.title, l.lat, l.lon, l.elevation, d.title_en as dist_name, p.title_en as prov_name
        FROM locations l
        JOIN districts d ON l.district_id = d.id
        JOIN provinces p ON l.province_id = p.id
        WHERE l.id = ?
        """, (req.location_id,))
        loc_row = cursor.fetchone()
        if loc_row:
            loc_name = loc_row["title"]
            lat = loc_row["lat"]
            lon = loc_row["lon"]
            dist_name = loc_row["dist_name"]
            prov_name = loc_row["prov_name"]

    elif req.district_id and (lat is None or lon is None):
        cursor.execute("""
        SELECT d.title_en as dist_name, d.centroid_lat, d.centroid_lon, p.title_en as prov_name
        FROM districts d
        JOIN provinces p ON d.province_id = p.id
        WHERE d.id = ?
        """, (req.district_id,))
        dist_row = cursor.fetchone()
        if dist_row:
            dist_name = dist_row["dist_name"]
            prov_name = dist_row["prov_name"]
            lat = dist_row["centroid_lat"]
            lon = dist_row["centroid_lon"]
            loc_name = f"{dist_name} District Center"

    if lat is None or lon is None:
        conn.close()
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "LOCATION_RESOLUTION_FAILED",
            "message": "REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE (COORDINATES COULD NOT BE RESOLVED)",
            "disclaimer": RESEARCH_DISCLAIMER
        }

    # Verify coordinates are strictly inside the sovereign boundary of Nepal
    if not is_coordinate_in_nepal(lat, lon):
        conn.close()
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "LOCATION_OUTSIDE_NEPAL",
            "message": f"REAL PREDICTION UNAVAILABLE – COORDINATES ({round(lat, 4)}°N, {round(lon, 4)}°E) ARE OUTSIDE NEPAL'S NATIONAL TERRITORY",
            "disclaimer": RESEARCH_DISCLAIMER
        }

    # 2. Ingest REAL current Environmental Features
    rain_data = get_rainfall_features(lat, lon)
    terrain_data = get_terrain_features(lat, lon)

    # Check data availability
    if rain_data.get("rainfall_24h") is None or terrain_data.get("slope") is None:
        conn.close()
        missing = []
        if rain_data.get("rainfall_24h") is None:
            missing.append("Live/Recent Precipitation Telemetry")
        if terrain_data.get("slope") is None:
            missing.append("DEM Elevation/Slope Gradients")
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "INSUFFICIENT_REAL_DATA",
            "message": "REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE",
            "missing_inputs": missing,
            "data_status": "DATA UNAVAILABLE",
            "coordinates": {"lat": lat, "lon": lon},
            "disclaimer": RESEARCH_DISCLAIMER
        }

    features = {
        "rainfall_24h": rain_data["rainfall_24h"],
        "rainfall_3day": rain_data["rainfall_3day"],
        "rainfall_7day": rain_data["rainfall_7day"],
        "antecedent_rainfall": rain_data["antecedent_rainfall"],
        "elevation": terrain_data["elevation"],
        "slope": terrain_data["slope"],
        "aspect": terrain_data["aspect"]
    }

    # 3. Retrieve Custom Thresholds from settings
    cursor.execute("SELECT key, value FROM system_settings")
    settings = dict(cursor.fetchall())
    thresholds = {
        "low": float(settings.get("low_threshold", 0.25)),
        "mod": float(settings.get("mod_threshold", 0.50)),
        "high": float(settings.get("high_threshold", 0.75))
    }

    # 4. Perform REAL ML Inference
    model_choice = req.model_name or settings.get("preferred_model", "XGBoost")
    pred_result = predict_landslide(features, model_name=model_choice, custom_thresholds=thresholds)

    if pred_result.get("prediction_status") != "REAL":
        conn.close()
        pred_result["disclaimer"] = RESEARCH_DISCLAIMER
        return pred_result

    # 5. Persist Prediction in SQLite
    pred_id = f"PRED_{uuid.uuid4().hex[:10].upper()}"
    now_utc = datetime.now(timezone.utc).isoformat()
    now_npt = get_npt_now_str()

    cursor.execute("""
    INSERT INTO predictions (
        prediction_id, timestamp_utc, timestamp_npt, province_name, district_name,
        location_name, lat, lon, rainfall_24h, rainfall_3day, rainfall_7day,
        antecedent_rainfall, elevation, slope, aspect, model_name, model_version,
        probability, risk_level, data_status, top_factors_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pred_id, now_utc, now_npt, prov_name, dist_name, loc_name,
        lat, lon, features["rainfall_24h"], features["rainfall_3day"],
        features["rainfall_7day"], features["antecedent_rainfall"],
        features["elevation"], features["slope"], features["aspect"],
        pred_result["model_name"], pred_result["model_version"],
        pred_result["probability"], pred_result["risk_level"],
        rain_data["data_status"], json.dumps(pred_result.get("top_contributing_factors", []))
    ))

    # 6. Auto-generate Early Warning Alert if HIGH or CRITICAL
    alert_created = False
    if pred_result["risk_level"] in ["HIGH", "CRITICAL"]:
        alert_id = f"ALERT_{uuid.uuid4().hex[:8].upper()}"
        advisory_msg = (
            f"EARLY WARNING for {loc_name}, {dist_name} ({prov_name}): "
            f"AI model indicates elevated landslide risk ({pred_result['probability_percentage']}) "
            f"due to heavy precipitation ({features['rainfall_24h']} mm in 24h) on steep slope ({features['slope']}°)."
        )
        cursor.execute("""
        INSERT INTO alerts (
            alert_id, prediction_id, province_name, district_name, location_name,
            risk_level, probability, rainfall_24h, status, created_at_npt, advisory_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert_id, pred_id, prov_name, dist_name, loc_name,
            pred_result["risk_level"], pred_result["probability"],
            features["rainfall_24h"], "ACTIVE", now_npt,
            advisory_msg
        ))
        alert_created = True

    conn.commit()

    if alert_created:
        # Dispatch Province & District targeted Gmail alerts to registered users
        try:
            from backend.email_service import send_landslide_alerts_for_location
            send_landslide_alerts_for_location(
                province_name=prov_name,
                district_name=dist_name,
                alert_data={
                    "alert_id": alert_id,
                    "location_name": loc_name,
                    "province_name": prov_name,
                    "district_name": dist_name,
                    "risk_level": pred_result["risk_level"],
                    "probability_percentage": pred_result["probability_percentage"],
                    "rainfall_24h": features["rainfall_24h"],
                    "slope": features.get("slope"),
                    "advisory_notes": advisory_msg
                }
            )
        except Exception as email_err:
            print(f"[Email Dispatch Error] Failed to send email alert: {email_err}")

    # 7. Check Previous Prediction for this location to compute Trend
    cursor.execute("""
    SELECT probability, timestamp_npt, risk_level FROM predictions
    WHERE location_name = ? AND prediction_id != ?
    ORDER BY id DESC LIMIT 1
    """, (loc_name, pred_id))
    prev_row = cursor.fetchone()
    conn.close()

    prev_pred = None
    if prev_row:
        prev_prob = prev_row["probability"]
        diff_pts = round((pred_result["probability"] - prev_prob) * 100, 2)
        prev_pred = {
            "previous_probability": prev_prob,
            "previous_percentage": f"{round(prev_prob * 100, 2):.2f}%",
            "previous_time": prev_row["timestamp_npt"],
            "previous_risk": prev_row["risk_level"],
            "change_percentage_points": f"{'+' if diff_pts >= 0 else ''}{diff_pts} pp"
        }

    # Return Full Standardized Response
    return {
        "prediction_id": pred_id,
        "prediction_status": "REAL",
        "location": loc_name,
        "district": dist_name,
        "province": prov_name,
        "coordinates": {"lat": lat, "lon": lon},
        "probability": pred_result["probability"],
        "probability_percentage": pred_result["probability_percentage"],
        "risk_level": pred_result["risk_level"],
        "model": pred_result["model_name"],
        "model_version": pred_result["model_version"],
        "data_status": rain_data["data_status"],
        "prediction_time_npt": now_npt,
        "features": features,
        "top_contributing_factors": pred_result.get("top_contributing_factors", []),
        "previous_comparison": prev_pred,
        "alert_triggered": alert_created,
        "dhm_station": rain_data.get("nearest_dhm_station"),
        "disclaimer": RESEARCH_DISCLAIMER
    }

@router.get("/predictions/history")
def get_prediction_history(
    province: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT prediction_id, timestamp_npt, province_name, district_name, location_name,
           lat, lon, rainfall_24h, rainfall_3day, rainfall_7day, elevation, slope,
           model_name, probability, risk_level, data_status, top_factors_json
    FROM predictions WHERE 1=1
    """
    params = []
    if province:
        query += " AND province_name LIKE ?"
        params.append(f"%{province}%")
    if district:
        query += " AND district_name LIKE ?"
        params.append(f"%{district}%")
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    if model:
        query += " AND model_name = ?"
        params.append(model)
    
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "prediction_id": r["prediction_id"],
            "timestamp_npt": r["timestamp_npt"],
            "province": r["province_name"],
            "district": r["district_name"],
            "location": r["location_name"],
            "coordinates": [r["lon"], r["lat"]],
            "rainfall_24h": r["rainfall_24h"],
            "elevation": r["elevation"],
            "slope": r["slope"],
            "model": r["model_name"],
            "probability": r["probability"],
            "probability_percentage": f"{round(r['probability'] * 100, 2):.2f}%",
            "risk_level": r["risk_level"],
            "data_status": r["data_status"],
            "top_factors": json.loads(r["top_factors_json"]) if r["top_factors_json"] else []
        })
    return result

@router.get("/predictions/trends")
def get_prediction_trends(location_name: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT timestamp_npt, location_name, probability, rainfall_24h, risk_level
    FROM predictions
    """
    params = []
    if location_name:
        query += " WHERE location_name = ?"
        params.append(location_name)
    query += " ORDER BY id ASC LIMIT 100"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "timestamp": r["timestamp_npt"],
            "location": r["location_name"],
            "probability": round(r["probability"] * 100, 2),
            "rainfall_24h": r["rainfall_24h"],
            "risk_level": r["risk_level"]
        })
    return result

import threading

_REFRESH_STATE = {
    "is_running": False,
    "progress": 0,
    "total": 77,
    "current_district": None,
    "last_completed_at": None,
    "updated_count": 0,
    "error": None
}

def _run_batch_district_refresh():
    global _REFRESH_STATE
    try:
        from backend.scripts.precompute_districts import update_districts
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.id, d.title_en as dist_name, d.centroid_lat, d.centroid_lon, p.title_en as prov_name
        FROM districts d
        JOIN provinces p ON d.province_id = p.id
        ORDER BY d.id ASC
        """)
        districts = cursor.fetchall()
        conn.close()

        _REFRESH_STATE["total"] = len(districts)
        _REFRESH_STATE["updated_count"] = 0
        _REFRESH_STATE["is_running"] = True
        _REFRESH_STATE["error"] = None

        for idx, d in enumerate(districts, start=1):
            _REFRESH_STATE["progress"] = idx
            _REFRESH_STATE["current_district"] = d["dist_name"]
            try:
                req = PredictRequest(
                    district_id=d["id"],
                    district_name=d["dist_name"],
                    province_name=d["prov_name"],
                    lat=d["centroid_lat"],
                    lon=d["centroid_lon"],
                    location_name=f"{d['dist_name']} District Center"
                )
                run_prediction(req)
                _REFRESH_STATE["updated_count"] += 1
            except Exception as e:
                print(f"Error refreshing {d['dist_name']}: {e}")

        _REFRESH_STATE["last_completed_at"] = get_npt_now_str()
    except Exception as exc:
        _REFRESH_STATE["error"] = str(exc)
    finally:
        _REFRESH_STATE["is_running"] = False
        _REFRESH_STATE["current_district"] = None

@router.post("/predict/refresh-all")
def trigger_refresh_all_districts():
    global _REFRESH_STATE
    if _REFRESH_STATE["is_running"]:
        return {
            "status": "ALREADY_RUNNING",
            "message": "District live telemetry refresh is currently in progress.",
            "state": _REFRESH_STATE
        }

    thread = threading.Thread(target=_run_batch_district_refresh, daemon=True)
    thread.start()

    return {
        "status": "STARTED",
        "message": "Started batch live telemetry refresh for all 77 districts.",
        "state": _REFRESH_STATE
    }

@router.get("/predict/refresh-status")
def get_refresh_status():
    global _REFRESH_STATE
    return _REFRESH_STATE

