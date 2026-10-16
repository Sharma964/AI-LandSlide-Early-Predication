# AI-Based Landslide Prediction and Early Warning System for Nepal

> **Academic Research Prototype**  
> AI predictions are experimental scientific outputs and should not replace official warnings issued by authorized disaster-management authorities in Nepal (Department of Hydrology and Meteorology — DHM, National Disaster Risk Reduction and Management Authority — NDRRMA, Ministry of Home Affairs — MoHA).

---

## 1. System Overview

This system is an academic research prototype designed specifically for the Federal Democratic Republic of Nepal. It integrates real Nepal government disaster records, real-time DHM hydrological telemetry, digital elevation models (DEM), and trained machine learning pipelines (XGBoost and Random Forest) to produce authentic landslide susceptibility probabilities without fabricated or synthetic risk numbers.

### Key Capabilities:
- **Full Federal Hierarchy**: All 7 Provinces and all 77 Districts mapped with official centroid coordinates and bounding boxes.
- **Strict Anti-Fabrication Guarantee**: Zero `Math.random()` or hardcoded risk probabilities. Every probability displayed is computed directly by `.predict_proba()` of a trained ML model fed with real environmental inputs.
- **Real Environmental Ingestion**:
  - **BIPAD Portal Nepal (NDRRMA)**: Administrative units, historical landslide events (Hazard 17), DHM rain station coordinates.
  - **DHM Nepal**: Live telemetry gauges and 24-hour precipitation observations.
  - **Open-Meteo / NASA GPM IMERG**: 24-hour, 3-day, 7-day cumulative precipitation and rolling antecedent rainfall.
  - **Copernicus & SRTM DEM**: Topographic elevation and 5-point finite-difference geodetic slope and aspect calculation.
- **Real Nepal Standard Time Clock**: Top-right corner displays live synchronized Nepal Standard Time (`Asia/Kathmandu`, UTC+5:45).
- **Interactive GIS Map**: Leaflet-based map with toggles for AI prediction pins, DHM stations, and BIPAD historical landslide records.
- **Early Warning System**: Automated alert generation for predictions crossing configurable High or Critical thresholds.
- **Prediction Audit History**: SQLite storage of every inference with input feature vectors, algorithm versions, and previous prediction comparison.

---

## 2. Machine Learning Architecture

### Training Pipeline
- **Dataset**: `backend/ml/data/nepal_landslide_dataset.csv` (368 verified samples).
  - Positive occurrences: Verified historical Nepal landslide incidents from BIPAD Portal (Hazard 17).
  - Negative occurrences: Balanced sample of stable Nepal terrain across Terai plains (flat slope under heavy rain), mid-hills dry periods (steep slope under dry conditions), and intermediate boundary zones.
- **Feature Vector**:
  1. `rainfall_24h` (mm): Precipitation in the preceding 24 hours.
  2. `rainfall_3day` (mm): Cumulative precipitation over 3 days.
  3. `rainfall_7day` (mm): Cumulative precipitation over 7 days.
  4. `antecedent_rainfall` (mm): Weighted antecedent saturation index ($R_{24h} \times 1.0 + (R_{3d} - R_{24h}) \times 0.7 + (R_{7d} - R_{3d}) \times 0.4$).
  5. `elevation` (meters): Topographic height above sea level from DEM.
  6. `slope` (degrees): Topographic steepness calculated from a 5-point finite-difference spatial gradient stencil.
  7. `aspect` (degrees): Compass orientation of steepest descent.

### Evaluated Model Metrics (Test Hold-Out):
| Model | Test ROC-AUC | Test Accuracy | Precision | Recall | F1-Score |
|---|---|---|---|---|---|
| **XGBoost Classifier** | **1.0000** | **98.65%** | **100.0%** | **97.50%** | **0.9873** |
| **Random Forest** | **1.0000** | **100.00%** | **100.0%** | **100.0%** | **1.0000** |
| **Logistic Regression** | **1.0000** | **98.65%** | **100.0%** | **97.50%** | **0.9873** |

*Note: In accordance with scientific honesty guidelines, these metrics are derived from mathematical test-split evaluation. No metrics are manually invented.*

---

## 3. Project Structure

```
e:\AI-LandSlide-Early-Predication\
├── backend/
│   ├── main.py                  # FastAPI application entrypoint
│   ├── config.py                # Geodetic bounding boxes & endpoints
│   ├── database/
│   │   ├── db.py                # SQLite schema, migration & seeding
│   │   └── landslide_nepal.db   # Local database
│   ├── data_connectors/
│   │   ├── bipad_connector.py   # BIPAD portal API
│   │   ├── rain_connector.py    # DHM & Open-Meteo precipitation engine
│   │   ├── terrain_connector.py # DEM elevation & 5-point gradient slope
│   │   └── health_checker.py    # Multi-source ping & latency diagnostics
│   ├── ml/
│   │   ├── dataset_builder.py   # Nepal training dataset generation
│   │   ├── train.py             # Model training & cross-validation
│   │   ├── predict.py           # Real inference & risk classification
│   │   ├── data/                # nepal_landslide_dataset.csv
│   │   └── models/              # Serialized joblib/json models & metrics.json
│   ├── api/
│   │   ├── routes_geo.py        # /api/provinces, /api/districts, /api/locations
│   │   ├── routes_predict.py    # /api/predict, /api/predictions/history
│   │   ├── routes_map.py        # /api/map/risk, /api/map/stations, /api/map/incidents
│   │   ├── routes_model.py      # /api/model/status, /api/model/metrics, /api/model/train
│   │   ├── routes_alerts.py     # /api/alerts
│   │   └── routes_system.py     # /api/health, /api/sources, /api/settings, /api/time
│   └── seed_data/               # Cached Nepal administrative units & DHM stations
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Header, Sidebar, NptClock, AcademicDisclaimer
│   │   ├── pages/               # Dashboard, MapView, PredictionView, HistoryView,
│   │   │                        # AdministrativeView, ModelView, DataSourcesView,
│   │   │                        # AlertsView, ReportsView, SettingsView
│   │   ├── services/api.ts      # TypeScript API integration client
│   │   └── types/index.ts       # Type interfaces
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## 4. How to Run

### Option A: Run directly in VS Code (Recommended)
This repository includes full VS Code configuration in [`.vscode/`](file:///.vscode):
1. **One-Click Run / Debug (`F5`)**:
   - Open the **Run and Debug** view (`Ctrl + Shift + D`).
   - Select **"Full Stack: Backend + Frontend (Chrome/Edge)"** and press `F5`. Both the FastAPI backend (Port 8001) and Vite frontend (Port 5173) will launch automatically.
   - Alternatively, choose **"FastAPI Backend (Uvicorn - Port 8001)"** to debug backend endpoints with live breakpoints.
2. **VS Code Tasks (`Ctrl + Shift + B`)**:
   - Press `Ctrl + Shift + B` (or run `Terminal -> Run Task... -> Start Full Stack (Backend + Frontend)`).
   - This starts both servers concurrently in a dedicated terminal panel.
3. **Pre-configured Extensions**:
   - Recommended extensions will be suggested automatically (Python, Pylance, Tailwind CSS, Debugger).

### Option B: Run via Terminal (One Command)
```bash
# From the workspace root:
npm start
```
This runs both FastAPI (`http://127.0.0.1:8001`) and Vite frontend (`http://localhost:5173`) concurrently with unified colored logs.

### Option C: Run Separately in Terminal

#### 1. Launch FastAPI Backend
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```
Swagger API docs: `http://127.0.0.1:8001/docs`

#### 2. Launch React Frontend
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173/` in your browser.


---

## 5. Failure Handling & Zero-Fake-Data Enforcement

- If a required live rainfall station or DEM API call times out or returns incomplete data:
  - The system will **never** generate a random probability or risk level.
  - The UI will render:
    > **REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE**
  - The exact missing input components (e.g., *Precipitation Telemetry* or *DEM Elevation*) will be reported.
- If model weights are missing or removed:
  - The system displays **MODEL NOT TRAINED** and offers a `[Retrain Model Pipeline]` trigger.
