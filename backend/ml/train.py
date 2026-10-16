import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from backend.config import BASE_DIR, DATA_DIR, MODELS_DIR, DB_PATH
from backend.ml.dataset_builder import build_nepal_dataset

FEATURE_COLUMNS = [
    "rainfall_24h",
    "rainfall_3day",
    "rainfall_7day",
    "antecedent_rainfall",
    "elevation",
    "slope",
    "aspect"
]

def train_and_evaluate_models():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = DATA_DIR / "nepal_landslide_dataset.csv"
    
    if not csv_path.exists():
        print("Dataset not found. Building dataset from Nepal landslide incidents...")
        build_nepal_dataset(120)

    df = pd.read_csv(csv_path)
    print(f"Loaded training dataset with {len(df)} samples.")
    print("Class distribution:", df["landslide_occurrence"].value_counts().to_dict())

    X = df[FEATURE_COLUMNS].values
    y = df["landslide_occurrence"].values

    # Stratified Train-Test Split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # Standard Scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")

    # Define Candidate Models
    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=120, max_depth=7, min_samples_split=4, random_state=42
        ),
        "XGBoost": XGBClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.08,
            eval_metric="logloss", random_state=42
        ),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42)
    }

    metrics_report = {}
    best_model_name = "XGBoost"
    best_auc = 0.0

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    for name, model in models.items():
        print(f"\n--- Training and Evaluating: {name} ---")
        use_scaled = (name == "Logistic Regression")
        X_tr = X_train_scaled if use_scaled else X_train
        X_te = X_test_scaled if use_scaled else X_test

        # 5-Fold Cross Validation
        cv_aucs, cv_accs, cv_f1s = [], [], []
        for train_idx, val_idx in cv.split(X_tr, y_train):
            m_clone = model.__class__(**model.get_params())
            m_clone.fit(X_tr[train_idx], y_train[train_idx])
            y_val_prob = m_clone.predict_proba(X_tr[val_idx])[:, 1]
            y_val_pred = (y_val_prob >= 0.5).astype(int)
            cv_aucs.append(roc_auc_score(y_train[val_idx], y_val_prob))
            cv_accs.append(accuracy_score(y_train[val_idx], y_val_pred))
            cv_f1s.append(f1_score(y_train[val_idx], y_val_pred, zero_division=0))

        # Final fit on complete train set
        model.fit(X_tr, y_train)
        y_test_prob = model.predict_proba(X_te)[:, 1]
        y_test_pred = (y_test_prob >= 0.5).astype(int)

        # Real test set evaluation metrics
        acc = float(accuracy_score(y_test, y_test_pred))
        prec = float(precision_score(y_test, y_test_pred, zero_division=0))
        rec = float(recall_score(y_test, y_test_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_test_pred, zero_division=0))
        auc = float(roc_auc_score(y_test, y_test_prob))
        cm = confusion_matrix(y_test, y_test_pred).tolist()

        # Feature importance if tree-based
        feat_imp = {}
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            feat_imp = {feat: round(float(imp), 4) for feat, imp in zip(FEATURE_COLUMNS, importances)}
            # Sort descending
            feat_imp = dict(sorted(feat_imp.items(), key=lambda item: item[1], reverse=True))

        metrics_report[name] = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
            "cv_mean_roc_auc": round(float(np.mean(cv_aucs)), 4),
            "cv_mean_accuracy": round(float(np.mean(cv_accs)), 4),
            "cv_mean_f1": round(float(np.mean(cv_f1s)), 4),
            "confusion_matrix": cm,
            "feature_importance": feat_imp,
            "trained_samples": len(df),
            "test_samples": len(y_test)
        }

        print(f"Test ROC-AUC: {auc:.4f} | Accuracy: {acc:.4f} | F1: {f1:.4f}")

        if auc > best_auc:
            best_auc = auc
            best_model_name = name

    # Save Models
    joblib.dump(models["Random Forest"], MODELS_DIR / "rf_model.joblib")
    models["XGBoost"].save_model(str(MODELS_DIR / "xgb_model.json"))
    joblib.dump(models["Logistic Regression"], MODELS_DIR / "lr_model.joblib")

    # Save Metrics File
    version_str = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    summary = {
        "version": version_str,
        "best_model": best_model_name,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "features": FEATURE_COLUMNS,
        "models": metrics_report
    }

    with open(MODELS_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Save to SQLite model_versions table
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("UPDATE model_versions SET is_active = 0")
        
        npt_time = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=45)).strftime("%d %b %Y | %I:%M %p NPT")
        for m_name, m_data in metrics_report.items():
            cursor.execute("""
            INSERT INTO model_versions (
                version, model_type, trained_at_npt, num_samples, roc_auc,
                accuracy, precision, recall, f1, metrics_json, features_list, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"{version_str}_{m_name.replace(' ', '_')}",
                m_name,
                npt_time,
                len(df),
                m_data["roc_auc"],
                m_data["accuracy"],
                m_data["precision"],
                m_data["recall"],
                m_data["f1_score"],
                json.dumps(m_data),
                json.dumps(FEATURE_COLUMNS),
                1 if m_name == best_model_name else 0
            ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Notice: Failed to insert model version to database: {e}")

    print(f"\nAll models successfully trained and serialized to {MODELS_DIR}.")
    print(f"Active Selected Model: {best_model_name} (ROC-AUC: {best_auc:.4f})")
    return summary

if __name__ == "__main__":
    train_and_evaluate_models()
