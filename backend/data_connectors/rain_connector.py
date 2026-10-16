import math
import logging
import urllib.request
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Cache for rainfall measurements: (round(lat, 3), round(lon, 3)) -> {data, timestamp}
_RAIN_CACHE: Dict[str, Dict[str, Any]] = {}
_STATIONS_CACHE: Optional[List[Dict[str, Any]]] = None

def _load_stations() -> List[Dict[str, Any]]:
    global _STATIONS_CACHE
    if _STATIONS_CACHE is not None:
        return _STATIONS_CACHE
    
    path = Path(__file__).resolve().parent.parent / "seed_data" / "rain_stations.json"
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                _STATIONS_CACHE = json.load(f)
                return _STATIONS_CACHE
        except Exception as e:
            logger.error(f"Failed to load rain stations: {e}")
    _STATIONS_CACHE = []
    return _STATIONS_CACHE

def find_nearest_station(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    stations = _load_stations()
    if not stations:
        return None
    
    closest = None
    min_dist = float("inf")
    for st in stations:
        pt = st.get("point", {}).get("coordinates")
        if pt and len(pt) >= 2:
            st_lon, st_lat = pt[0], pt[1]
            dist = math.sqrt((lat - st_lat)**2 + (lon - st_lon)**2)
            if dist < min_dist:
                min_dist = dist
                closest = st
    return closest

def get_rainfall_features(lat: float, lon: float) -> Dict[str, Any]:
    """
    Retrieves real rainfall observations:
    - 24-hour rainfall (mm)
    - 3-day cumulative rainfall (mm)
    - 7-day cumulative rainfall (mm)
    - Antecedent cumulative precipitation (mm)
    Also cross-references the nearest DHM rain station.
    """
    key = f"{round(lat, 3)}_{round(lon, 3)}"
    now = datetime.now(timezone.utc)

    # Check cache (valid for 15 minutes)
    if key in _RAIN_CACHE:
        cached = _RAIN_CACHE[key]
        cache_age = (now - cached["fetched_at"]).total_seconds()
        if cache_age < 900:  # 15 mins
            res = dict(cached["data"])
            res["data_status"] = "CACHED"
            return res

    nearest_st = find_nearest_station(lat, lon)
    station_info = None
    dhm_24h = None

    if nearest_st:
        station_info = {
            "id": nearest_st.get("id"),
            "name": nearest_st.get("title"),
            "basin": nearest_st.get("basin"),
            "elevation": nearest_st.get("elevation"),
            "status": nearest_st.get("status"),
            "measured_on": nearest_st.get("measuredOn")
        }
        for avg in nearest_st.get("averages", []):
            if avg.get("interval") == 24:
                dhm_24h = avg.get("value")

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat:.4f}&longitude={lon:.4f}&"
        f"hourly=precipitation,rain&past_days=7&forecast_days=1"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NepalLandslideResearch/1.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode())
        
        hourly = data.get("hourly", {})
        precip = hourly.get("precipitation", [])
        times = hourly.get("time", [])

        if not precip or len(precip) < 24:
            raise ValueError("Insufficient hourly precipitation data returned.")

        # Real cumulative calculations
        # Last 24 hours of available history
        rain_24h = round(sum(precip[-24:]), 2)
        # Last 3 days (72 hours)
        rain_3d = round(sum(precip[-72:]), 2) if len(precip) >= 72 else round(sum(precip), 2)
        # Last 7 days (168 hours)
        rain_7d = round(sum(precip[:168]), 2) if len(precip) >= 168 else round(sum(precip), 2)
        
        # Antecedent index (weighted sum prioritizing recent days)
        antecedent = round(rain_24h * 1.0 + (rain_3d - rain_24h) * 0.7 + (rain_7d - rain_3d) * 0.4, 2)

        # If DHM has a live 24h reading that is higher or recent, note it
        if dhm_24h is not None and isinstance(dhm_24h, (int, float)):
            # Retain DHM direct station reading if physically plausible
            effective_24h = max(rain_24h, float(dhm_24h))
        else:
            effective_24h = rain_24h

        result = {
            "rainfall_24h": effective_24h,
            "rainfall_3day": rain_3d,
            "rainfall_7day": rain_7d,
            "antecedent_rainfall": antecedent,
            "nearest_dhm_station": station_info,
            "dhm_station_24h_mm": dhm_24h,
            "data_status": "LIVE",
            "observation_timestamp": now.isoformat(),
            "source": "DHM / Open-Meteo High-Resolution Ingestion"
        }

        _RAIN_CACHE[key] = {
            "data": result,
            "fetched_at": now
        }
        return result

    except Exception as e:
        logger.error(f"Failed to fetch rainfall for ({lat}, {lon}): {e}")
        # If cache exists even if expired, return it as CACHED
        if key in _RAIN_CACHE:
            res = dict(_RAIN_CACHE[key]["data"])
            res["data_status"] = "CACHED"
            res["cache_notice"] = "Live API error, using last known cached observation."
            return res

        return {
            "rainfall_24h": None,
            "rainfall_3day": None,
            "rainfall_7day": None,
            "antecedent_rainfall": None,
            "nearest_dhm_station": station_info,
            "data_status": "UNAVAILABLE",
            "error": str(e)
        }
