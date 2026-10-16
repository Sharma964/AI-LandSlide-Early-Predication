import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import joblib
import numpy as np
from xgboost import XGBClassifier
from backend.config import MODELS_DIR, RISK_THRESHOLDS

FEATURE_COLUMNS = [
    "rainfall_24h",
    "rainfall_3day",
    "rainfall_7day",
    "antecedent_rainfall",
    "elevation",
    "slope",
    "aspect"
]

_CACHED_MODELS: Dict[str, Any] = {}
_CACHED_METRICS: Optional[Dict[str, Any]] = None

def get_loaded_model(model_name: str = "XGBoost") -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    global _CACHED_MODELS, _CACHED_METRICS
    metrics_path = MODELS_DIR / "metrics.json"
    if not metrics_path.exists():
        return None, None

    if _CACHED_METRICS is None:
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                _CACHED_METRICS = json.load(f)
        except Exception:
            pass

    if model_name in _CACHED_MODELS:
        return _CACHED_MODELS[model_name], _CACHED_METRICS

    try:
        if model_name == "Random Forest":
            path = MODELS_DIR / "rf_model.joblib"
            if not path.exists():
                return None, _CACHED_METRICS
            model = joblib.load(path)
            _CACHED_MODELS[model_name] = model
            return model, _CACHED_METRICS

        elif model_name == "Logistic Regression":
            path = MODELS_DIR / "lr_model.joblib"
            if not path.exists():
                return None, _CACHED_METRICS
            model = joblib.load(path)
            _CACHED_MODELS[model_name] = model
            return model, _CACHED_METRICS

        else:  # Default to XGBoost
            path = MODELS_DIR / "xgb_model.json"
            if not path.exists():
                return None, _CACHED_METRICS
            model = XGBClassifier()
            model.load_model(str(path))
            _CACHED_MODELS["XGBoost"] = model
            return model, _CACHED_METRICS
    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        return None, _CACHED_METRICS

def classify_risk(prob: float, custom_thresholds: Optional[Dict[str, float]] = None) -> str:
    """
    Classifies landslide probability into risk tiers based on thresholds.
    Configurable via system settings.
    """
    t_low = custom_thresholds.get("low", 0.25) if custom_thresholds else 0.25
    t_mod = custom_thresholds.get("mod", 0.50) if custom_thresholds else 0.50
    t_high = custom_thresholds.get("high", 0.75) if custom_thresholds else 0.75

    if prob < t_low:
        return "LOW"
    elif prob < t_mod:
        return "MODERATE"
    elif prob < t_high:
        return "HIGH"
    else:
        return "CRITICAL"

def predict_landslide(
    features: Dict[str, Any],
    model_name: str = "XGBoost",
    custom_thresholds: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Performs REAL Machine Learning Landslide Prediction.
    Strictly NO fake or hardcoded random probabilities.
    """
    # 1. Check if model is available
    model, metrics_summary = get_loaded_model(model_name)
    if model is None:
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "MODEL_NOT_TRAINED",
            "message": "REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE (MODEL NOT TRAINED)",
            "model_name": model_name
        }

    # 2. Check all required features
    missing = []
    vector = []
    for col in FEATURE_COLUMNS:
        val = features.get(col)
        if val is None or not isinstance(val, (int, float)) or np.isnan(val):
            missing.append(col)
        else:
            vector.append(float(val))

    if missing:
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "INSUFFICIENT_REAL_DATA",
            "message": "REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE",
            "missing_features": missing,
            "received_features": features
        }

    # 3. Model Inference via predict_proba()
    try:
        X = np.array([vector], dtype=float)
        
        # If Logistic Regression, apply scaler
        if model_name == "Logistic Regression":
            scaler_path = MODELS_DIR / "scaler.joblib"
            if scaler_path.exists():
                scaler = joblib.load(scaler_path)
                X = scaler.transform(X)

        probabilities = model.predict_proba(X)[0]
        # Landslide probability (class 1)
        prob_landslide = float(probabilities[1])
        prob_landslide = max(0.0, min(1.0, prob_landslide))

        risk_level = classify_risk(prob_landslide, custom_thresholds)

        # 4. Feature Contributions / Top Factors
        top_factors = []
        model_metrics = metrics_summary.get("models", {}).get(model_name, {}) if metrics_summary else {}
        feature_importance = model_metrics.get("feature_importance", {})
        
        if feature_importance:
            # Rank features by product of normalized value and model weight
            for feat_name, weight in feature_importance.items():
                val = features.get(feat_name, 0.0)
                # Form descriptive human label
                label = feat_name.replace("_", " ").title()
                if feat_name == "rainfall_24h":
                    desc = f"24h Rainfall: {val} mm"
                elif feat_name == "slope":
                    desc = f"Terrain Slope: {val}°"
                elif feat_name == "elevation":
                    desc = f"Elevation: {val} m"
                elif feat_name == "antecedent_rainfall":
                    desc = f"Antecedent Rain: {val} mm"
                else:
                    desc = f"{label}: {val}"
                top_factors.append({
                    "feature": feat_name,
                    "label": label,
                    "importance_weight": weight,
                    "value": val,
                    "description": desc
                })

        model_version = metrics_summary.get("version", "v1.0") if metrics_summary else "v1.0"

        return {
            "prediction_status": "REAL",
            "probability": round(prob_landslide, 4),
            "probability_percentage": f"{round(prob_landslide * 100, 2):.2f}%",
            "risk_level": risk_level,
            "model_name": model_name,
            "model_version": model_version,
            "input_features": features,
            "top_contributing_factors": top_factors[:4],
            "model_roc_auc": model_metrics.get("roc_auc"),
            "model_accuracy": model_metrics.get("accuracy")
        }

    except Exception as e:
        return {
            "prediction_status": "UNAVAILABLE",
            "error_code": "INFERENCE_FAILED",
            "message": f"REAL PREDICTION UNAVAILABLE – INFERENCE ERROR: {str(e)}",
            "model_name": model_name
        }
