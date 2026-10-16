import json
from pathlib import Path
from fastapi import APIRouter
from backend.database.db import get_db_connection
from backend.config import SEED_DIR
from backend.geo_utils import is_coordinate_in_nepal

router = APIRouter(prefix="/api/map", tags=["GIS Map"])

@router.get("/risk")
def get_map_risk_layers():
    """
    Returns only REAL predictions stored in the database.
    DO NOT invent risk colors where predictions have not been made.
    Strictly filters out any coordinates outside Nepal's national boundary.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get the latest prediction for each unique location
    cursor.execute("""
    SELECT p.prediction_id, p.timestamp_npt, p.province_name, p.district_name, p.location_name,
           p.lat, p.lon, p.rainfall_24h, p.elevation, p.slope, p.model_name,
           p.probability, p.risk_level, p.data_status
    FROM predictions p
    INNER JOIN (
        SELECT location_name, MAX(id) as max_id
        FROM predictions
        GROUP BY location_name
    ) latest ON p.id = latest.max_id
    ORDER BY p.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    features = []
    # Pre-fetch districts for fallback reverse-lookup
    conn_dist = get_db_connection()
    c_dist = conn_dist.cursor()
    c_dist.execute("""
    SELECT d.id, d.title_en as dist_name, d.centroid_lat, d.centroid_lon, p.title_en as prov_name
    FROM districts d
    JOIN provinces p ON d.province_id = p.id
    """)
    nepal_districts = c_dist.fetchall()
    conn_dist.close()

    def resolve_nearest_district(target_lat: float, target_lon: float):
        best_dist = None
        min_sq = 1e9
        for d in nepal_districts:
            sq = (target_lat - d["centroid_lat"])**2 + (target_lon - d["centroid_lon"])**2
            if sq < min_sq:
                min_sq = sq
                best_dist = (d["dist_name"], d["prov_name"])
        return best_dist or ("Nepal Region", "Nepal")

    for r in rows:
        lat, lon = float(r["lat"]), float(r["lon"])
        if not is_coordinate_in_nepal(lat, lon):
            continue

        loc_name = r["location_name"]
        dist_name = r["district_name"]
        prov_name = r["province_name"]

        if not dist_name or dist_name in ["Unknown District", "Unknown"] or not prov_name or prov_name in ["Unknown Province", "Unknown"]:
            resolved_dist, resolved_prov = resolve_nearest_district(lat, lon)
            dist_name = resolved_dist
            prov_name = resolved_prov

        if not loc_name or loc_name in ["Custom GPS Point", "Unknown", None]:
            loc_name = f"{dist_name} Sector ({lat:.2f}°N, {lon:.2f}°E)"

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [r["lon"], r["lat"]]
            },
            "properties": {
                "prediction_id": r["prediction_id"],
                "location": loc_name,
                "district": dist_name,
                "province": prov_name,
                "probability": r["probability"],
                "probability_percentage": f"{round(r['probability'] * 100, 2):.2f}%",
                "risk_level": r["risk_level"],
                "model": r["model_name"],
                "rainfall_24h": r["rainfall_24h"],
                "slope": r["slope"],
                "elevation": r["elevation"],
                "data_status": r["data_status"],
                "timestamp_npt": r["timestamp_npt"]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features)
    }

@router.get("/stations")
def get_rain_stations():
    stations_file = SEED_DIR / "rain_stations.json"
    if not stations_file.exists():
        return {"type": "FeatureCollection", "features": []}

    with open(stations_file, "r", encoding="utf-8") as f:
        stations = json.load(f)

    features = []
    for s in stations:
        pt = s.get("point", {}).get("coordinates")
        if pt and len(pt) >= 2:
            r24h = 0.0
            for avg in s.get("averages", []):
                if avg.get("interval") == 24:
                    r24h = avg.get("value", 0.0)
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [pt[0], pt[1]]
                },
                "properties": {
                    "id": s.get("id"),
                    "title": s.get("title"),
                    "basin": s.get("basin"),
                    "elevation": s.get("elevation"),
                    "status": s.get("status"),
                    "rainfall_24h": r24h,
                    "measured_on": s.get("measuredOn"),
                    "source": "DHM / hydrology.gov.np"
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features)
    }

@router.get("/incidents")
def get_historical_incidents():
    inc_file = SEED_DIR / "landslide_incidents.json"
    if not inc_file.exists():
        return {"type": "FeatureCollection", "features": []}

    with open(inc_file, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    features = []
    for inc in incidents:
        pt = inc.get("point", {}).get("coordinates")
        if pt and len(pt) >= 2:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [pt[0], pt[1]]
                },
                "properties": {
                    "id": inc.get("id"),
                    "title": inc.get("title"),
                    "incident_on": inc.get("incidentOn"),
                    "verified": inc.get("verified"),
                    "loss": inc.get("loss"),
                    "source": "BIPAD Portal (Hazard 17: Landslide)"
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features)
    }

@router.get("/nepal-boundary")
def get_nepal_boundary():
    boundary_file = SEED_DIR / "nepal_boundary.geojson"
    if not boundary_file.exists():
        return {"type": "FeatureCollection", "features": []}
    with open(boundary_file, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/provinces-geojson")
def get_provinces_geojson():
    prov_file = SEED_DIR / "nepal_provinces.geojson"
    if not prov_file.exists():
        return {"type": "FeatureCollection", "features": []}
    with open(prov_file, "r", encoding="utf-8") as f:
        return json.load(f)
