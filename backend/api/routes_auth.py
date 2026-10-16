import base64
import json
import time
import hmac
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from backend.database.db import get_db_connection, hash_password, get_npt_now_str

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

SECRET_KEY = b"nepal_ai_landslide_system_secret_key_2026"

def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + (86400 * 7) # 7 days
    }
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    sig = hmac.new(SECRET_KEY, payload_bytes, hashlib.sha256).hexdigest()
    token_str = f"{base64.urlsafe_b64encode(payload_bytes).decode('utf-8')}.{sig}"
    return token_str

def decode_token(token: str) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        b64_payload, sig = parts
        payload_bytes = base64.urlsafe_b64decode(b64_payload.encode('utf-8'))
        expected_sig = hmac.new(SECRET_KEY, payload_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(payload_bytes.decode('utf-8'))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

# Pydantic Schemas
class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    province: Optional[str] = None
    district: Optional[str] = None
    role: Optional[str] = "Citizen / Public"
    organization: Optional[str] = "General Public"

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

@router.post("/signup")
def signup(req: SignupRequest):
    username = req.username.strip().lower()
    email = req.email.strip().lower()
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if not req.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required.")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check for existing username or email
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email is already registered.")

    hashed_pwd = hash_password(req.password)
    now_npt = get_npt_now_str()

    prov = req.province.strip() if req.province else None
    dist = req.district.strip() if req.district else None

    cursor.execute("""
    INSERT INTO users (username, email, password_hash, full_name, province, district, role, organization, created_at_npt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        username,
        email,
        hashed_pwd,
        req.full_name.strip(),
        prov,
        dist,
        req.role or "Citizen / Public",
        req.organization.strip() if req.organization else "General Public",
        now_npt
    ))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    user_data = {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": req.full_name.strip(),
        "province": prov,
        "district": dist,
        "role": req.role or "Citizen / Public",
        "organization": req.organization or "General Public",
        "created_at_npt": now_npt
    }

    token = create_token(user_id, username, req.role or "Citizen / Public")

    return {
        "status": "success",
        "message": f"Account successfully created for {req.full_name}.",
        "user": user_data,
        "token": token
    }

@router.post("/login")
def login(req: LoginRequest):
    credential = req.username_or_email.strip().lower()
    hashed_pwd = hash_password(req.password)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, username, email, password_hash, full_name, province, district, role, organization, created_at_npt
    FROM users
    WHERE username = ? OR email = ?
    """, (credential, credential))
    row = cursor.fetchone()
    conn.close()

    if not row or row["password_hash"] != hashed_pwd:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    user_data = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "province": row["province"],
        "district": row["district"],
        "role": row["role"],
        "organization": row["organization"],
        "created_at_npt": row["created_at_npt"]
    }

    token = create_token(row["id"], row["username"], row["role"])

    return {
        "status": "success",
        "message": f"Welcome back, {row['full_name']}!",
        "user": user_data,
        "token": token
    }

@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header provided.")

    token = authorization.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, email, full_name, province, district, role, organization, created_at_npt
    FROM users WHERE id = ?
    """, (payload["user_id"],))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User account not found.")

    return {
        "status": "success",
        "user": {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "full_name": row["full_name"],
            "province": row["province"],
            "district": row["district"],
            "role": row["role"],
            "organization": row["organization"],
            "created_at_npt": row["created_at_npt"]
        }
    }

@router.get("/users")
def list_registered_users():
    """Return count and list of all registered users enrolled for alerts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, email, full_name, province, district, role, organization, created_at_npt
    FROM users
    ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    users = [
        {
            "id": r["id"],
            "username": r["username"],
            "email": r["email"],
            "full_name": r["full_name"],
            "province": r["province"] or "All / Unspecified",
            "district": r["district"] or "All Districts",
            "role": r["role"],
            "organization": r["organization"],
            "created_at_npt": r["created_at_npt"]
        }
        for r in rows
    ]

    return {
        "total_users": len(users),
        "users": users
    }
