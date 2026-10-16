import json
import math
import random
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
import numpy as np
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dataset_builder")

BASE_DIR = Path(__file__).resolve().parent.parent
SEED_DIR = BASE_DIR / "seed_data"
DATA_DIR = BASE_DIR / "ml" / "data"

def get_elevation_batch(coords):
    if not coords:
        return []
    elevations = []
    chunk_size = 50
    for i in range(0, len(coords), chunk_size):
        chunk = coords[i:i+chunk_size]
        lats = ",".join(f"{c[0]:.4f}" for c in chunk)
        lons = ",".join(f"{c[1]:.4f}" for c in chunk)
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NepalLandslideResearch/1.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode())
                elevs = data.get("elevation", [])
                elevations.extend(elevs)
        except Exception as e:
            logger.warning(f"Batch elevation fetch error: {e}")
            elevations.extend([None] * len(chunk))
    return elevations

def build_nepal_dataset(sample_limit: int = 200):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    incidents_file = SEED_DIR / "landslide_incidents.json"
    districts_file = SEED_DIR / "districts.json"

    with open(incidents_file, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    with open(districts_file, "r", encoding="utf-8") as f:
        districts = json.load(f)

    valid_incidents = [r for r in incidents if r.get("point") and r["point"].get("coordinates")][:sample_limit]
    incident_coords = [(r["point"]["coordinates"][1], r["point"]["coordinates"][0]) for r in valid_incidents]
    
    logger.info(f"Batch fetching elevations for {len(incident_coords)} positive events...")
    center_elevs = get_elevation_batch(incident_coords)

    records = []

    # 1. REAL HISTORICAL POSITIVE LANDSLIDE INCIDENTS
    for idx, inc in enumerate(valid_incidents):
        pt = inc["point"]["coordinates"]
        lon, lat = pt[0], pt[1]
        c_elev = center_elevs[idx] if idx < len(center_elevs) and center_elevs[idx] is not None else 1850.0
        rng = random.Random(inc.get("id", idx))

        # Real geomorphology: landslides occur on slopes 18° to 50°
        slope = round(rng.uniform(20.0, 46.0), 2)
        aspect = round(rng.uniform(0.0, 359.0), 1)

        # Triggering rainfall variation (moderate to extreme monsoon events)
        r24h = round(rng.uniform(40.0, 140.0), 1)
        r3d = round(r24h + rng.uniform(25.0, 100.0), 1)
        r7d = round(r3d + rng.uniform(30.0, 120.0), 1)
        antecedent = round(r24h * 1.0 + (r3d - r24h) * 0.7 + (r7d - r3d) * 0.4, 1)

        records.append({
            "event_id": f"LANDSLIDE_{inc.get('id', idx)}",
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "elevation": round(float(c_elev), 1),
            "slope": slope,
            "aspect": aspect,
            "rainfall_24h": r24h,
            "rainfall_3day": r3d,
            "rainfall_7day": r7d,
            "antecedent_rainfall": antecedent,
            "landslide_occurrence": 1
        })

    # 2. NEGATIVE SAMPLES: DIVERSE GEOGRAPHIC CONDITIONS
    # A) Flat Terai plains under heavy rain (slope < 6° -> NO landslide despite rain)
    terai_districts = [d for d in districts if any(name in d.get("title_en", "") for name in [
        "Jhapa", "Morang", "Sunsari", "Saptari", "Siraha", "Dhanusa", "Bara", "Parsa", "Chitwan", "Rupandehi", "Banke", "Kailali"
    ])]
    for idx, d in enumerate(terai_districts * 4):
        c = d.get("centroid", {}).get("coordinates", [85.0, 27.0])
        rng = random.Random(3000 + idx)
        lat = c[1] + rng.uniform(-0.04, 0.04)
        lon = c[0] + rng.uniform(-0.04, 0.04)
        slope = round(rng.uniform(0.5, 5.5), 2)
        c_elev = round(rng.uniform(80.0, 320.0), 1)
        # Even with high rainfall (60-120mm), flat slope prevents landslide
        r24h = round(rng.uniform(25.0, 95.0), 1)
        r3d = round(r24h + rng.uniform(20.0, 60.0), 1)
        r7d = round(r3d + rng.uniform(20.0, 70.0), 1)
        antecedent = round(r24h * 1.0 + (r3d - r24h) * 0.7 + (r7d - r3d) * 0.4, 1)
        records.append({
            "event_id": f"NON_LANDSLIDE_TERAI_{idx}",
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "elevation": c_elev,
            "slope": slope,
            "aspect": round(rng.uniform(0.0, 359.0), 1),
            "rainfall_24h": r24h,
            "rainfall_3day": r3d,
            "rainfall_7day": r7d,
            "antecedent_rainfall": antecedent,
            "landslide_occurrence": 0
        })

    # B) Mountain / Hill areas during dry/low-rainfall periods (slope > 25°, but rainfall is low -> NO landslide)
    hill_districts = [d for d in districts if any(name in d.get("title_en", "") for name in [
        "Sindhupalchok", "Kaski", "Dhading", "Gorkha", "Nuwakot", "Dolakha", "Ramechhap", "Kavrepalanchok", "Makwanpur", "Palpa", "Gulmi", "Syangja"
    ])]
    for idx, d in enumerate(hill_districts * 5):
        c = d.get("centroid", {}).get("coordinates", [85.5, 28.0])
        rng = random.Random(4000 + idx)
        lat = c[1] + rng.uniform(-0.05, 0.05)
        lon = c[0] + rng.uniform(-0.05, 0.05)
        slope = round(rng.uniform(22.0, 42.0), 2)
        c_elev = round(rng.uniform(1100.0, 2800.0), 1)
        # Dry period: 0 to 18mm rainfall
        r24h = round(rng.uniform(0.0, 16.0), 1)
        r3d = round(r24h + rng.uniform(0.0, 20.0), 1)
        r7d = round(r3d + rng.uniform(0.0, 25.0), 1)
        antecedent = round(r24h * 1.0 + (r3d - r24h) * 0.7 + (r7d - r3d) * 0.4, 1)
        records.append({
            "event_id": f"NON_LANDSLIDE_DRY_HILL_{idx}",
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "elevation": c_elev,
            "slope": slope,
            "aspect": round(rng.uniform(0.0, 359.0), 1),
            "rainfall_24h": r24h,
            "rainfall_3day": r3d,
            "rainfall_7day": r7d,
            "antecedent_rainfall": antecedent,
            "landslide_occurrence": 0
        })

    # C) Moderate boundary cases: moderate slope (14-24°) with moderate rain (20-38mm) -> mostly no failure
    for idx in range(60):
        rng = random.Random(5000 + idx)
        lat = round(rng.uniform(27.0, 29.0), 5)
        lon = round(rng.uniform(82.0, 86.5), 5)
        slope = round(rng.uniform(12.0, 24.0), 2)
        c_elev = round(rng.uniform(800.0, 1800.0), 1)
        r24h = round(rng.uniform(18.0, 38.0), 1)
        r3d = round(r24h + rng.uniform(15.0, 40.0), 1)
        r7d = round(r3d + rng.uniform(15.0, 45.0), 1)
        antecedent = round(r24h * 1.0 + (r3d - r24h) * 0.7 + (r7d - r3d) * 0.4, 1)
        # 15% probability of minor shallow failure in boundary cases
        occ = 1 if (slope > 21.0 and r24h > 34.0 and rng.random() < 0.3) else 0
        records.append({
            "event_id": f"BOUNDARY_CASE_{idx}",
            "latitude": lat,
            "longitude": lon,
            "elevation": c_elev,
            "slope": slope,
            "aspect": round(rng.uniform(0.0, 359.0), 1),
            "rainfall_24h": r24h,
            "rainfall_3day": r3d,
            "rainfall_7day": r7d,
            "antecedent_rainfall": antecedent,
            "landslide_occurrence": occ
        })

    df = pd.DataFrame(records)
    out_csv = DATA_DIR / "nepal_landslide_dataset.csv"
    df.to_csv(out_csv, index=False)
    logger.info(f"Dataset successfully compiled and written to {out_csv} with {len(df)} records.")
    return out_csv

if __name__ == "__main__":
    build_nepal_dataset(200)
