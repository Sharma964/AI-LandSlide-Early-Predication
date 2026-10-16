import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from backend.database.db import get_db_connection, get_npt_now_str
from backend.data_connectors.health_checker import check_system_health
from backend.config import RESEARCH_DISCLAIMER, MODELS_DIR

router = APIRouter(prefix="/api", tags=["System & Settings"])

class SettingsUpdate(BaseModel):
    preferred_model: Optional[str] = None
    auto_refresh_minutes: Optional[int] = None
    low_threshold: Optional[float] = None
    mod_threshold: Optional[float] = None
    high_threshold: Optional[float] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_email: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender_name: Optional[str] = None
    smtp_enabled: Optional[bool] = None

@router.get("/time")
def get_nepal_time():
    utc_now = datetime.now(timezone.utc)
    npt_now = utc_now + timedelta(hours=5, minutes=45)
    return {
        "timezone": "Asia/Kathmandu",
        "utc_offset": "+05:45",
        "iso": npt_now.isoformat(),
        "formatted": npt_now.strftime("%d %b %Y | %I:%M:%S %p NPT"),
        "date": npt_now.strftime("%d %b %Y"),
        "time": npt_now.strftime("%I:%M:%S %p"),
        "npt_clock": npt_now.strftime("%d %b %Y, %I:%M %p NPT")
    }

@router.get("/health")
def get_health():
    return check_system_health()

@router.get("/sources")
def get_data_sources():
    health = check_system_health()
    return {
        "timestamp_npt": get_npt_now_str(),
        "sources": health.get("data_sources", {})
    }

@router.get("/settings")
def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings")
    settings = dict(cursor.fetchall())
    conn.close()
    return settings

@router.post("/settings")
def update_settings(payload: SettingsUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    if payload.preferred_model:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("preferred_model", payload.preferred_model))
    if payload.auto_refresh_minutes is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("auto_refresh_minutes", str(payload.auto_refresh_minutes)))
    if payload.low_threshold is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("low_threshold", str(payload.low_threshold)))
    if payload.mod_threshold is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("mod_threshold", str(payload.mod_threshold)))
    if payload.high_threshold is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("high_threshold", str(payload.high_threshold)))
    if payload.smtp_host is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_host", payload.smtp_host.strip()))
    if payload.smtp_port is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_port", str(payload.smtp_port)))
    if payload.smtp_email is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_email", payload.smtp_email.strip()))
    if payload.smtp_password is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_password", payload.smtp_password.strip()))
    if payload.smtp_sender_name is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_sender_name", payload.smtp_sender_name.strip()))
    if payload.smtp_enabled is not None:
        cursor.execute("INSERT OR REPLACE INTO system_settings VALUES (?, ?)", ("smtp_enabled", "true" if payload.smtp_enabled else "false"))
    
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": "Settings updated"}

@router.get("/dashboard/stats")
def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM provinces")
    total_prov = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM districts")
    total_dist = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM locations")
    total_loc = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM predictions")
    total_preds = cursor.fetchone()[0]

    # Latest prediction
    cursor.execute("""
    SELECT prediction_id, timestamp_npt, location_name, district_name, province_name,
           probability, risk_level, model_name, rainfall_24h, slope, data_status
    FROM predictions ORDER BY id DESC LIMIT 1
    """)
    latest_pred_row = cursor.fetchone()
    latest_pred = None
    if latest_pred_row:
        latest_pred = {
            "id": latest_pred_row["prediction_id"],
            "time": latest_pred_row["timestamp_npt"],
            "location": latest_pred_row["location_name"],
            "district": latest_pred_row["district_name"],
            "province": latest_pred_row["province_name"],
            "probability": f"{round(latest_pred_row['probability'] * 100, 2):.2f}%",
            "risk_level": latest_pred_row["risk_level"],
            "model": latest_pred_row["model_name"],
            "rainfall_24h": latest_pred_row["rainfall_24h"],
            "slope": latest_pred_row["slope"],
            "data_status": latest_pred_row["data_status"]
        }

    # Active alerts count
    cursor.execute("SELECT COUNT(*) FROM alerts WHERE status = 'ACTIVE'")
    active_alerts = cursor.fetchone()[0]

    # Critical & High risk count
    cursor.execute("""
    SELECT 
        SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as crit_count
    FROM (
        SELECT risk_level FROM predictions
        GROUP BY location_name
        HAVING MAX(id)
    )
    """)
    risk_counts = cursor.fetchone()
    high_count = risk_counts["high_count"] or 0
    crit_count = risk_counts["crit_count"] or 0

    conn.close()

    # Model status
    rf_path = MODELS_DIR / "rf_model.joblib"
    xgb_path = MODELS_DIR / "xgb_model.json"
    model_trained = rf_path.exists() and xgb_path.exists()

    return {
        "total_provinces": total_prov,
        "total_districts": total_dist,
        "locations_monitored": total_loc,
        "total_predictions_made": total_preds,
        "high_risk_locations": high_count,
        "critical_risk_locations": crit_count,
        "active_alerts": active_alerts,
        "latest_prediction": latest_pred,
        "model_status": "TRAINED" if model_trained else "NOT TRAINED",
        "data_status": "LIVE",
        "nepal_time": get_npt_now_str(),
        "disclaimer": RESEARCH_DISCLAIMER
    }
