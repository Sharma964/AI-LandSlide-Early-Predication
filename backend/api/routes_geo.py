import json
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from backend.database.db import get_db_connection

router = APIRouter(prefix="/api", tags=["Geography"])

@router.get("/provinces")
def get_provinces():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, title_en, title_ne, code, centroid_lat, centroid_lon, bbox_json FROM provinces ORDER BY id")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "title": r["title_en"] or r["title"],
            "title_en": r["title_en"],
            "title_ne": r["title_ne"],
            "code": r["code"],
            "centroid": [r["centroid_lon"], r["centroid_lat"]],
            "bbox": json.loads(r["bbox_json"]) if r["bbox_json"] else []
        })
    return result

@router.get("/districts")
def get_districts(province_id: Optional[int] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    if province_id:
        cursor.execute("""
        SELECT id, province_id, title, title_en, title_ne, code, centroid_lat, centroid_lon, bbox_json
        FROM districts WHERE province_id = ? ORDER BY title_en
        """, (province_id,))
    else:
        cursor.execute("""
        SELECT id, province_id, title, title_en, title_ne, code, centroid_lat, centroid_lon, bbox_json
        FROM districts ORDER BY province_id, title_en
        """)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "province_id": r["province_id"],
            "title": r["title_en"] or r["title"],
            "title_en": r["title_en"],
            "title_ne": r["title_ne"],
            "code": r["code"],
            "centroid": [r["centroid_lon"], r["centroid_lat"]],
            "bbox": json.loads(r["bbox_json"]) if r["bbox_json"] else []
        })
    return result

@router.get("/locations")
def get_locations(district_id: Optional[int] = Query(None), province_id: Optional[int] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, district_id, province_id, title, location_type, lat, lon, elevation FROM locations WHERE 1=1"
    params = []
    if district_id:
        query += " AND district_id = ?"
        params.append(district_id)
    if province_id:
        query += " AND province_id = ?"
        params.append(province_id)
    query += " ORDER BY location_type DESC, title ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "district_id": r["district_id"],
            "province_id": r["province_id"],
            "title": r["title"],
            "location_type": r["location_type"],
            "lat": r["lat"],
            "lon": r["lon"],
            "elevation": r["elevation"]
        })
    return result
