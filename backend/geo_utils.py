import json
from pathlib import Path
from typing import List, Tuple
from backend.config import SEED_DIR, NEPAL_BBOX

# Cache polygons in memory
_NEPAL_POLYGONS: List[List[Tuple[float, float]]] = []

def _load_nepal_boundary_polygons():
    global _NEPAL_POLYGONS
    if _NEPAL_POLYGONS:
        return _NEPAL_POLYGONS

    boundary_file = SEED_DIR / "nepal_boundary.geojson"
    if not boundary_file.exists():
        return []

    try:
        with open(boundary_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        polys = []
        for feat in data.get("features", []):
            geom = feat.get("geometry", {})
            gtype = geom.get("type")
            coords = geom.get("coordinates", [])
            if gtype == "Polygon":
                # Outer ring: [[lon, lat], ...]
                polys.append([(float(pt[0]), float(pt[1])) for pt in coords[0]])
            elif gtype == "MultiPolygon":
                for poly in coords:
                    polys.append([(float(pt[0]), float(pt[1])) for pt in poly[0]])
        _NEPAL_POLYGONS = polys
    except Exception as e:
        print(f"Warning: Could not parse nepal_boundary.geojson: {e}")
        _NEPAL_POLYGONS = []

    return _NEPAL_POLYGONS

def is_coordinate_in_nepal(lat: float, lon: float) -> bool:
    """
    Validates whether a coordinate (lat, lon) strictly falls within
    the sovereign territory of Nepal using geodetic bbox + ray casting point-in-polygon.
    """
    # 1. Fast bounding box check
    if not (NEPAL_BBOX["min_lat"] <= lat <= NEPAL_BBOX["max_lat"]):
        return False
    if not (NEPAL_BBOX["min_lon"] <= lon <= NEPAL_BBOX["max_lon"]):
        return False

    # 2. Exact polygon ring ray-casting
    rings = _load_nepal_boundary_polygons()
    if not rings:
        # Fallback to geodetic bounds if polygon is missing
        return True

    point_x, point_y = float(lon), float(lat)
    for ring in rings:
        n = len(ring)
        inside = False
        p1x, p1y = ring[0]
        for i in range(1, n + 1):
            p2x, p2y = ring[i % n]
            if min(p1y, p2y) < point_y <= max(p1y, p2y):
                if point_x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (point_y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or point_x <= xinters:
                        inside = not inside
            p1x, p1y = p2x, p2y
        if inside:
            return True

    return False
