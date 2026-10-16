import math
import logging
import urllib.request
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# In-memory cache for terrain features: (round(lat, 4), round(lon, 4)) -> dict
_TERRAIN_CACHE: Dict[str, Dict[str, Any]] = {}

def get_terrain_features(lat: float, lon: float) -> Dict[str, Any]:
    """
    Retrieves real elevation and calculates real slope using a 5-point
    finite difference gradient stencil from DEM data.
    """
    key = f"{round(lat, 4)}_{round(lon, 4)}"
    if key in _TERRAIN_CACHE:
        return _TERRAIN_CACHE[key]

    d_deg = 0.001  # ~111 meters spacing
    lats = [lat, lat + d_deg, lat - d_deg, lat, lat]
    lons = [lon, lon, lon, lon + d_deg, lon - d_deg]

    s_lats = ",".join(f"{x:.6f}" for x in lats)
    s_lons = ",".join(f"{x:.6f}" for x in lons)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={s_lats}&longitude={s_lons}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NepalLandslideResearch/1.0"})
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())
        
        elevs = data.get("elevation", [])
        if len(elevs) < 5 or any(e is None for e in elevs):
            raise ValueError(f"Incomplete elevation array returned for {lat}, {lon}")

        center_elev, north_elev, south_elev, east_elev, west_elev = elevs

        # Geodetic grid steps in meters
        dy = (2 * d_deg) * 111139.0
        dx = (2 * d_deg) * 111139.0 * math.cos(math.radians(lat))
        if dx < 1.0:
            dx = 1.0

        dz_dx = (east_elev - west_elev) / dx
        dz_dy = (north_elev - south_elev) / dy

        gradient_mag = math.sqrt(dz_dx**2 + dz_dy**2)
        slope_deg = math.degrees(math.atan(gradient_mag))

        # Aspect (compass direction of steepest slope)
        aspect_rad = math.atan2(dz_dy, -dz_dx)
        aspect_deg = (math.degrees(aspect_rad) + 360) % 360

        result = {
            "elevation": round(float(center_elev), 1),
            "slope": round(float(slope_deg), 2),
            "aspect": round(float(aspect_deg), 1),
            "terrain_status": "REAL_DEM"
        }
        _TERRAIN_CACHE[key] = result
        return result

    except Exception as e:
        logger.warning(f"Error fetching terrain for ({lat}, {lon}): {e}")
        return {
            "elevation": None,
            "slope": None,
            "aspect": None,
            "terrain_status": "UNAVAILABLE",
            "error": str(e)
        }
