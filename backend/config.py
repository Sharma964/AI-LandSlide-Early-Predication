import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "database" / "landslide_nepal.db"
SEED_DIR = BASE_DIR / "seed_data"
ML_DIR = BASE_DIR / "ml"
MODELS_DIR = ML_DIR / "models"
DATA_DIR = ML_DIR / "data"

# Nepal Geodetic Bounds
NEPAL_BBOX = {
    "min_lat": 26.347,
    "max_lat": 30.447,
    "min_lon": 80.058,
    "max_lon": 88.201,
}

# Real Data APIs
BIPAD_API_BASE = "https://bipadportal.gov.np/api/v1"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_ELEVATION = "https://api.open-meteo.com/v1/elevation"

# Risk Thresholds (Configurable)
RISK_THRESHOLDS = {
    "LOW": (0.0, 0.25),
    "MODERATE": (0.25, 0.50),
    "HIGH": (0.50, 0.75),
    "CRITICAL": (0.75, 1.00),
}

# Scientific Limitation Disclaimer
RESEARCH_DISCLAIMER = (
    "This is an academic research prototype. AI predictions are experimental "
    "and should not replace official warnings issued by authorized "
    "disaster-management authorities in Nepal (DHM, NDRRMA, MoHA)."
)
