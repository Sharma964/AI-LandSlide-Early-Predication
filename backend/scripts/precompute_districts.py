import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import sqlite3
import time
from backend.api.routes_predict import run_prediction, PredictRequest

from backend.config import DB_PATH

def update_districts(force_refresh_all: bool = True):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if force_refresh_all:
        cursor.execute("""
        SELECT d.id, d.title_en as dist_name, d.centroid_lat, d.centroid_lon, p.title_en as prov_name
        FROM districts d
        JOIN provinces p ON d.province_id = p.id
        ORDER BY d.id ASC
        """)
    else:
        cursor.execute("""
        SELECT d.id, d.title_en as dist_name, d.centroid_lat, d.centroid_lon, p.title_en as prov_name
        FROM districts d
        JOIN provinces p ON d.province_id = p.id
        WHERE d.title_en NOT IN (SELECT district_name FROM predictions)
        ORDER BY d.id ASC
        """)
    districts = cursor.fetchall()
    conn.close()

    total = len(districts)
    print(f"[{'Full Update' if force_refresh_all else 'Missing Only'}] Updating {total} districts with live telemetry...")
    updated = 0
    for idx, d in enumerate(districts, start=1):
        try:
            req = PredictRequest(
                district_id=d['id'],
                district_name=d['dist_name'],
                province_name=d['prov_name'],
                lat=d['centroid_lat'],
                lon=d['centroid_lon'],
                location_name=f"{d['dist_name']} District Center"
            )
            res = run_prediction(req)
            updated += 1
            status = res.get('risk_level', 'UNKNOWN')
            prob = res.get('probability_percentage', 'N/A')
            print(f"[{idx}/{total}] {d['dist_name']:20} -> {prob:>7} ({status})")
            time.sleep(0.2)
        except Exception as e:
            print(f"[{idx}/{total}] Failed for {d['dist_name']}: {e}")

    print(f"Done! Successfully updated {updated}/{total} districts.")
    return updated

if __name__ == "__main__":
    force = True if "--missing-only" not in sys.argv else False
    update_districts(force_refresh_all=force)

