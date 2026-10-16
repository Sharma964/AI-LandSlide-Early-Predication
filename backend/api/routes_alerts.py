from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from backend.database.db import get_db_connection, get_npt_now_str

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

class AlertStatusUpdate(BaseModel):
    status: str  # ACTIVE, MONITORING, RESOLVED

@router.get("")
def get_alerts(status: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT a.id, a.alert_id, a.prediction_id, a.province_name, a.district_name,
           a.location_name, a.risk_level, a.probability, a.rainfall_24h,
           a.status, a.created_at_npt, a.resolved_at_npt, a.advisory_notes,
           p.lat, p.lon, p.slope, p.elevation, p.model_name
    FROM alerts a
    LEFT JOIN predictions p ON a.prediction_id = p.prediction_id
    """
    params = []
    if status:
        query += " WHERE a.status = ?"
        params.append(status)
    query += " ORDER BY a.id DESC LIMIT 100"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "alert_id": r["alert_id"],
            "prediction_id": r["prediction_id"],
            "province": r["province_name"],
            "district": r["district_name"],
            "location": r["location_name"],
            "risk_level": r["risk_level"],
            "probability": r["probability"],
            "probability_percentage": f"{round(r['probability'] * 100, 2):.2f}%",
            "rainfall_24h": r["rainfall_24h"],
            "status": r["status"],
            "created_at_npt": r["created_at_npt"],
            "resolved_at_npt": r["resolved_at_npt"],
            "advisory_notes": r["advisory_notes"],
            "coordinates": [r["lon"], r["lat"]] if r["lat"] else None,
            "slope": r["slope"],
            "elevation": r["elevation"],
            "model": r["model_name"]
        })
    return result

@router.get("/notifications")
def get_alert_notifications(limit: int = Query(50, ge=1, le=200)):
    """Retrieve history of dispatched email notifications."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, alert_id, recipient_email, recipient_name, province, district,
           subject, status, details, sent_at_npt
    FROM alert_notifications
    ORDER BY id DESC
    LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r["id"],
            "alert_id": r["alert_id"],
            "recipient_email": r["recipient_email"],
            "recipient_name": r["recipient_name"],
            "province": r["province"],
            "district": r["district"],
            "subject": r["subject"],
            "status": r["status"],
            "details": r["details"],
            "sent_at_npt": r["sent_at_npt"]
        }
        for r in rows
    ]

class TestEmailRequest(BaseModel):
    recipient_email: str

@router.post("/test-email")
def send_test_email(payload: TestEmailRequest):
    """Send a diagnostic test email to verify Gmail SMTP configuration."""
    from backend.email_service import test_email_connection
    res = test_email_connection(payload.recipient_email.strip())
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to dispatch test email"))
    return res

@router.post("/{alert_id}/broadcast-email")
def broadcast_alert_email(alert_id: str):
    """Manually dispatch or re-send Gmail alert to all users in the affected province/district."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT alert_id, province_name, district_name, location_name, risk_level,
           probability, rainfall_24h, advisory_notes
    FROM alerts
    WHERE alert_id = ?
    """, (alert_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Alert record not found")

    from backend.email_service import send_landslide_alerts_for_location
    prob_pct = f"{round(row['probability'] * 100, 2):.2f}%"
    
    result = send_landslide_alerts_for_location(
        province_name=row["province_name"],
        district_name=row["district_name"],
        alert_data={
            "alert_id": row["alert_id"],
            "location_name": row["location_name"],
            "province_name": row["province_name"],
            "district_name": row["district_name"],
            "risk_level": row["risk_level"],
            "probability_percentage": prob_pct,
            "rainfall_24h": row["rainfall_24h"],
            "advisory_notes": row["advisory_notes"]
        }
    )
    return {
        "status": "SUCCESS",
        "message": f"Broadcast complete. Dispatched to {result['dispatched_count']} recipient(s).",
        "details": result
    }

@router.post("/{alert_id}/status")
def update_alert_status(alert_id: str, payload: AlertStatusUpdate):
    if payload.status not in ["ACTIVE", "MONITORING", "RESOLVED"]:
        raise HTTPException(status_code=400, detail="Invalid alert status")

    conn = get_db_connection()
    cursor = conn.cursor()
    npt_now = get_npt_now_str()
    resolved_time = npt_now if payload.status == "RESOLVED" else None

    cursor.execute("""
    UPDATE alerts
    SET status = ?, resolved_at_npt = COALESCE(?, resolved_at_npt)
    WHERE alert_id = ?
    """, (payload.status, resolved_time, alert_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")

    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "alert_id": alert_id, "new_status": payload.status}
