import sqlite3
import json
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.config import DB_PATH, SEED_DIR, RISK_THRESHOLDS

NPT_OFFSET = timedelta(hours=5, minutes=45)

def get_npt_now_str() -> str:
    utc_now = datetime.now(timezone.utc)
    npt_now = utc_now + NPT_OFFSET
    return npt_now.strftime("%d %b %Y | %I:%M %p NPT")

def hash_password(password: str, salt: str = "nepal_landslide_salt_2026") -> str:
    import hashlib
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def get_db_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Provinces
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS provinces (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        title_en TEXT,
        title_ne TEXT,
        code TEXT,
        centroid_lat REAL,
        centroid_lon REAL,
        bbox_json TEXT
    );
    """)

    # 2. Districts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY,
        province_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        title_en TEXT,
        title_ne TEXT,
        code TEXT,
        centroid_lat REAL,
        centroid_lon REAL,
        bbox_json TEXT,
        FOREIGN KEY (province_id) REFERENCES provinces(id)
    );
    """)

    # 3. Locations (DHM stations + major locations)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        district_id INTEGER NOT NULL,
        province_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        location_type TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        elevation REAL,
        FOREIGN KEY (district_id) REFERENCES districts(id)
    );
    """)

    # 4. Predictions Audit Log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prediction_id TEXT UNIQUE NOT NULL,
        timestamp_utc TEXT NOT NULL,
        timestamp_npt TEXT NOT NULL,
        province_name TEXT NOT NULL,
        district_name TEXT NOT NULL,
        location_name TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        rainfall_24h REAL,
        rainfall_3day REAL,
        rainfall_7day REAL,
        antecedent_rainfall REAL,
        elevation REAL,
        slope REAL,
        aspect REAL,
        model_name TEXT NOT NULL,
        model_version TEXT NOT NULL,
        probability REAL NOT NULL,
        risk_level TEXT NOT NULL,
        data_status TEXT NOT NULL,
        top_factors_json TEXT
    );
    """)

    # 5. Early Warning Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id TEXT UNIQUE NOT NULL,
        prediction_id TEXT NOT NULL,
        province_name TEXT NOT NULL,
        district_name TEXT NOT NULL,
        location_name TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        probability REAL NOT NULL,
        rainfall_24h REAL,
        status TEXT NOT NULL, -- ACTIVE, MONITORING, RESOLVED
        created_at_npt TEXT NOT NULL,
        resolved_at_npt TEXT,
        advisory_notes TEXT,
        FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
    );
    """)

    # 6. Model Versions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        model_type TEXT NOT NULL,
        trained_at_npt TEXT NOT NULL,
        num_samples INTEGER NOT NULL,
        roc_auc REAL NOT NULL,
        accuracy REAL NOT NULL,
        precision REAL NOT NULL,
        recall REAL NOT NULL,
        f1 REAL NOT NULL,
        metrics_json TEXT NOT NULL,
        features_list TEXT NOT NULL,
        is_active INTEGER DEFAULT 0
    );
    """)

    # 7. System Settings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    conn.commit()

    # Seed provinces and districts if empty
    cursor.execute("SELECT COUNT(*) FROM provinces")
    if cursor.fetchone()[0] == 0:
        seed_provinces_and_districts(conn)

    # 8. Users Table (with province & district for targeted alerts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        province TEXT,
        district TEXT,
        role TEXT NOT NULL,
        organization TEXT,
        created_at_npt TEXT NOT NULL
    );
    """)

    # Auto-migration for existing users table
    cursor.execute("PRAGMA table_info(users)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if "province" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN province TEXT")
    if "district" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN district TEXT")

    # 9. Alert Notifications Log (for tracking Gmail dispatches)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alert_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id TEXT,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        province TEXT,
        district TEXT,
        subject TEXT,
        status TEXT NOT NULL,
        details TEXT,
        sent_at_npt TEXT NOT NULL
    );
    """)

    # Seed default settings if empty
    cursor.execute("SELECT COUNT(*) FROM system_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO system_settings VALUES (?, ?)", ("preferred_model", "XGBoost"))
        cursor.execute("INSERT INTO system_settings VALUES (?, ?)", ("auto_refresh_minutes", "10"))
        cursor.execute("INSERT INTO system_settings VALUES (?, ?)", ("low_threshold", "0.25"))
        cursor.execute("INSERT INTO system_settings VALUES (?, ?)", ("mod_threshold", "0.50"))
        cursor.execute("INSERT INTO system_settings VALUES (?, ?)", ("high_threshold", "0.75"))

    # Ensure SMTP settings exist
    smtp_defaults = [
        ("smtp_host", "smtp.gmail.com"),
        ("smtp_port", "587"),
        ("smtp_email", ""),
        ("smtp_password", ""),
        ("smtp_sender_name", "Nepal Landslide Early Warning System"),
        ("smtp_enabled", "true")
    ]
    for key, val in smtp_defaults:
        cursor.execute("SELECT COUNT(*) FROM system_settings WHERE key = ?", (key,))
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO system_settings VALUES (?, ?)", (key, val))

    conn.commit()

    # Seed administrator account (Sonu) with pre-computed cryptographic hash if not present
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'sonu'")
    if cursor.fetchone()[0] == 0:
        now_npt = get_npt_now_str()
        cursor.execute("""
        INSERT INTO users (username, email, password_hash, full_name, province, district, role, organization, created_at_npt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "sonu",
            "sonu@landslide.gov.np",
            "51bceea19ddd83bc385f70d84fe7134302355668d5c05e0407d4dc762d0285b2",
            "Sonu",
            "Bagmati",
            "Kathmandu",
            "Lead Disaster & Early Warning Analyst",
            "Nepal National Landslide Early Warning Center",
            now_npt
        ))
        conn.commit()

    conn.close()

def seed_provinces_and_districts(conn: sqlite3.Connection):
    cursor = conn.cursor()
    prov_file = SEED_DIR / "provinces.json"
    dist_file = SEED_DIR / "districts.json"
    stations_file = SEED_DIR / "rain_stations.json"

    if prov_file.exists():
        with open(prov_file, "r", encoding="utf-8") as f:
            provinces = json.load(f)
        for p in provinces:
            c = p.get("centroid", {}).get("coordinates", [0, 0])
            cursor.execute("""
            INSERT OR REPLACE INTO provinces (id, title, title_en, title_ne, code, centroid_lat, centroid_lon, bbox_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"], p.get("title", ""), p.get("title_en", p.get("title", "")),
                p.get("title_ne", ""), p.get("code", ""), c[1], c[0], json.dumps(p.get("bbox", []))
            ))

    if dist_file.exists():
        with open(dist_file, "r", encoding="utf-8") as f:
            districts = json.load(f)
        for d in districts:
            c = d.get("centroid", {}).get("coordinates", [0, 0])
            cursor.execute("""
            INSERT OR REPLACE INTO districts (id, province_id, title, title_en, title_ne, code, centroid_lat, centroid_lon, bbox_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                d["id"], d.get("province", 1), d.get("title", ""), d.get("title_en", d.get("title", "")),
                d.get("title_ne", ""), d.get("code", ""), c[1], c[0], json.dumps(d.get("bbox", []))
            ))
            # Also add district centroid as a default location
            cursor.execute("""
            INSERT INTO locations (district_id, province_id, title, location_type, lat, lon, elevation)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                d["id"], d.get("province", 1), f"{d.get('title_en', d.get('title'))} District Center",
                "DISTRICT_HQ", c[1], c[0], None
            ))

    if stations_file.exists():
        with open(stations_file, "r", encoding="utf-8") as f:
            stations = json.load(f)
        for s in stations:
            pt = s.get("point", {}).get("coordinates")
            if pt and len(pt) >= 2 and s.get("district"):
                cursor.execute("""
                INSERT INTO locations (district_id, province_id, title, location_type, lat, lon, elevation)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    s.get("district"), s.get("province", 1), f"{s.get('title')} Rain Station (DHM)",
                    "DHM_STATION", pt[1], pt[0], s.get("elevation")
                ))

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
