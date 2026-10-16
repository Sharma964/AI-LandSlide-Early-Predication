import json
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks
from backend.config import MODELS_DIR, DATA_DIR
from backend.ml.train import train_and_evaluate_models
from backend.database.db import get_db_connection

router = APIRouter(prefix="/api/model", tags=["Machine Learning"])

@router.get("/status")
def get_model_status():
    rf_path = MODELS_DIR / "rf_model.joblib"
    xgb_path = MODELS_DIR / "xgb_model.json"
    metrics_path = MODELS_DIR / "metrics.json"

    is_trained = rf_path.exists() and xgb_path.exists() and metrics_path.exists()

    if not is_trained:
        return {
            "status": "NOT TRAINED",
            "message": "No trained machine learning model found.",
            "available_models": [],
            "last_training": None
        }

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM system_settings WHERE key = 'preferred_model'")
    row = cursor.fetchone()
    preferred = row["value"] if row else "XGBoost"
    conn.close()

    return {
        "status": "TRAINED",
        "active_model": preferred,
        "best_model": metrics.get("best_model"),
        "version": metrics.get("version"),
        "trained_at_utc": metrics.get("trained_at_utc"),
        "features": metrics.get("features", []),
        "features_count": len(metrics.get("features", [])),
        "available_models": list(metrics.get("models", {}).keys())
    }

@router.get("/metrics")
def get_model_metrics():
    metrics_path = MODELS_DIR / "metrics.json"
    if not metrics_path.exists():
        return {
            "status": "NOT TRAINED",
            "metrics": {}
        }

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    return {
        "status": "TRAINED",
        "version": metrics.get("version"),
        "trained_at_utc": metrics.get("trained_at_utc"),
        "models": metrics.get("models", {}),
        "features": metrics.get("features", [])
    }

@router.post("/train")
def trigger_retrain():
    """
    Retrains Random Forest and XGBoost on real Nepal dataset.
    Strictly NO fake training or fabricated numbers.
    """
    summary = train_and_evaluate_models()
    return {
        "status": "SUCCESS",
        "message": "Models successfully retrained with real cross-validation and evaluation metrics.",
        "summary": summary
    }
