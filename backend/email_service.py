import smtplib
import ssl
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional
from backend.database.db import get_db_connection, get_npt_now_str

def get_smtp_config() -> Dict[str, Any]:
    """Retrieve SMTP configuration from system_settings or environment variables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'")
    rows = cursor.fetchall()
    conn.close()

    settings = {r["key"]: r["value"] for r in rows}

    host = settings.get("smtp_host") or os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port_str = settings.get("smtp_port") or os.environ.get("SMTP_PORT", "587")
    try:
        port = int(port_str)
    except ValueError:
        port = 587

    user = settings.get("smtp_email") or os.environ.get("GMAIL_USER") or os.environ.get("SMTP_EMAIL", "")
    password = settings.get("smtp_password") or os.environ.get("GMAIL_APP_PASSWORD") or os.environ.get("SMTP_PASSWORD", "")
    sender_name = settings.get("smtp_sender_name") or "Nepal AI Landslide Early Warning System"
    enabled_str = settings.get("smtp_enabled", "true").lower()
    enabled = enabled_str in ["true", "1", "yes"]

    # Clean password from spaces (Google app passwords often copied with spaces)
    if password:
        password = password.replace(" ", "").strip()

    return {
        "host": host.strip(),
        "port": port,
        "email": user.strip(),
        "password": password,
        "sender_name": sender_name.strip(),
        "enabled": enabled
    }

def build_alert_html(
    recipient_name: str,
    province_name: str,
    district_name: str,
    location_name: str,
    risk_level: str,
    probability_pct: str,
    rainfall_24h: float,
    slope: Optional[float],
    advisory: str,
    alert_id: str,
    timestamp_npt: str
) -> str:
    """Generate high-contrast, professional HTML email for disaster warnings."""
    is_critical = risk_level.upper() == "CRITICAL"
    badge_bg = "#dc2626" if is_critical else "#ea580c"
    header_color = "#991b1b" if is_critical else "#c2410c"
    urgency_text = "IMMEDIATE EVACUATION & HIGH ALERT" if is_critical else "HEIGHTENED SURVEILLANCE & CAUTION"

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nepal Landslide Early Warning</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }}
    .container {{ max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, {header_color}, #0f172a); padding: 24px; text-align: center; border-bottom: 2px solid {badge_bg}; }}
    .pill {{ display: inline-block; background-color: {badge_bg}; color: #ffffff; font-weight: 800; font-size: 13px; padding: 6px 14px; border-radius: 9999px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }}
    .title {{ color: #ffffff; font-size: 20px; font-weight: 700; margin: 8px 0 4px 0; }}
    .subtitle {{ color: #94a3b8; font-size: 13px; margin: 0; }}
    .body {{ padding: 24px; }}
    .greeting {{ font-size: 14px; color: #cbd5e1; margin-bottom: 16px; line-height: 1.5; }}
    .location-box {{ background-color: #0f172a; border-left: 4px solid {badge_bg}; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; }}
    .location-title {{ font-size: 16px; font-weight: 700; color: #38bdf8; margin: 0 0 4px 0; }}
    .location-jurisdiction {{ font-size: 12px; color: #94a3b8; margin: 0; }}
    .grid {{ display: table; width: 100%; margin-bottom: 20px; }}
    .grid-cell {{ display: table-cell; width: 50%; padding: 10px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155; vertical-align: top; }}
    .grid-spacer {{ display: table-cell; width: 10px; }}
    .stat-label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }}
    .stat-val {{ font-size: 18px; font-weight: 700; color: #ffffff; }}
    .stat-val-danger {{ color: {badge_bg}; }}
    .stat-val-rain {{ color: #38bdf8; }}
    .advisory-box {{ background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px; }}
    .advisory-title {{ color: #f87171; font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px 0; }}
    .advisory-desc {{ color: #f1f5f9; font-size: 13px; margin: 0; line-height: 1.5; }}
    .instructions {{ background-color: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 12px; color: #cbd5e1; }}
    .instructions ol {{ margin: 8px 0 0 0; padding-left: 18px; }}
    .instructions li {{ margin-bottom: 6px; }}
    .footer {{ background-color: #0f172a; border-top: 1px solid #334155; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }}
    .footer strong {{ color: #94a3b8; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="pill">{risk_level} LANDSLIDE ADVISORY</div>
      <h1 class="title">{urgency_text}</h1>
      <p class="subtitle">Nepal National Early Warning Alert • {timestamp_npt}</p>
    </div>
    <div class="body">
      <p class="greeting">
        Namaste <strong>{recipient_name}</strong>,<br>
        This urgent automated early warning notification is targeted to your registered jurisdiction in <strong>{district_name} District, {province_name} Province</strong>. AI precipitation telemetry and terrain slope models have detected heightened landslide hazard conditions.
      </p>

      <div class="location-box">
        <div class="location-title">📍 {location_name}</div>
        <div class="location-jurisdiction">District: <strong>{district_name}</strong> | Province: <strong>{province_name}</strong></div>
      </div>

      <div class="grid">
        <div class="grid-cell">
          <div class="stat-label">Landslide Probability</div>
          <div class="stat-val stat-val-danger">{probability_pct}</div>
        </div>
        <div class="grid-spacer"></div>
        <div class="grid-cell">
          <div class="stat-label">24-Hour Precipitation</div>
          <div class="stat-val stat-val-rain">{rainfall_24h} mm</div>
        </div>
      </div>

      <div class="advisory-box">
        <div class="advisory-title">⚠️ Scientific Risk Advisory</div>
        <p class="advisory-desc">{advisory}</p>
      </div>

      <div class="instructions">
        <strong style="color: #ffffff;">Recommended Citizen Emergency Actions:</strong>
        <ol>
          <li>Avoid staying near steep hill slopes, active gullies, or swollen mountain riverbanks.</li>
          <li>Listen to local sirens, radio, and DHM flood/weather bulletins (DHM toll-free: 1155).</li>
          <li>Prepare emergency grab bags with identity documents, flashlights, medicines, and drinking water.</li>
          <li>In case of emergency, contact the Nepal Police at <strong>100</strong> or Armed Police Force at <strong>1114</strong>.</li>
        </ol>
      </div>

      <p style="font-size: 11px; color: #64748b; margin: 0;">
        Alert Identifier: <code>{alert_id}</code> | Time: {timestamp_npt}
      </p>
    </div>
    <div class="footer">
      <strong>Nepal AI Landslide Prediction & Early Warning System</strong><br>
      Department of Hydrology and Meteorology (DHM) / BIPAD Telemetry Research Integration.<br>
      You are receiving this alert because your account is registered for alerts in <strong>{province_name} Province, {district_name} District</strong>.
    </div>
  </div>
</body>
</html>"""

def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: str) -> Dict[str, Any]:
    """Dispatch email through Gmail SMTP with STARTTLS."""
    config = get_smtp_config()

    if not config["enabled"]:
        return {
            "success": False,
            "error": "Email notifications are disabled in system configuration."
        }

    if not config["email"] or not config["password"]:
        return {
            "success": False,
            "error": "Gmail SMTP credentials (email or app password) are not configured. Please enter them in System Settings."
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{config['sender_name']} <{config['email']}>"
    msg["To"] = to_email

    # Attach text fallback and HTML body
    part1 = MIMEText(text_content, "plain", "utf-8")
    part2 = MIMEText(html_content, "html", "utf-8")
    msg.attach(part1)
    msg.attach(part2)

    def _dispatch_attempt(host: str, port: int, email: str, password: str) -> Dict[str, Any]:
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=8, context=context) as server:
                server.login(email, password)
                server.sendmail(email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=8) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(email, password)
                server.sendmail(email, [to_email], msg.as_string())
        return {"success": True, "message": f"Alert email delivered successfully to {to_email}"}

    primary_port = config["port"]
    alternate_port = 465 if primary_port == 587 else 587

    # Attempt 1: primary configured port
    try:
        return _dispatch_attempt(config["host"], primary_port, config["email"], config["password"])
    except smtplib.SMTPAuthenticationError as auth_err:
        return {
            "success": False,
            "error": f"Gmail Authentication Failed. Please verify your Google App Password (16 characters) in Settings. Details: {str(auth_err)}"
        }
    except Exception as first_err:
        # Attempt 2: fallback to alternate port (465 <-> 587)
        try:
            return _dispatch_attempt(config["host"], alternate_port, config["email"], config["password"])
        except Exception:
            err_str = str(first_err)
            if "timed out" in err_str.lower() or "timeout" in err_str.lower():
                return {
                    "success": False,
                    "error": (
                        f"SMTP Connection Timed Out on ports {primary_port} and {alternate_port}. "
                        "Campus/College Wi-Fi Firewall Detected: Outbound SMTP ports (587 & 465) are blocked by your local network. "
                        "Please switch your computer to a Mobile Hotspot (Jio, Airtel, Vi) to send emails."
                    )
                }
            return {
                "success": False,
                "error": f"SMTP Dispatch Error ({config['host']}:{primary_port}): {err_str}"
            }

def send_landslide_alerts_for_location(
    province_name: str,
    district_name: str,
    alert_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Find all registered users in matching province/district and dispatch Gmail alert."""
    conn = get_db_connection()
    cursor = conn.cursor()

    prov_norm = (province_name or "").strip()
    dist_norm = (district_name or "").strip()

    # Find users whose province or district matches the affected zone
    cursor.execute("""
    SELECT id, username, email, full_name, province, district, role
    FROM users
    WHERE email IS NOT NULL AND email != ''
      AND (
        (district IS NOT NULL AND LOWER(TRIM(district)) = LOWER(TRIM(?)))
        OR (province IS NOT NULL AND LOWER(TRIM(province)) = LOWER(TRIM(?)))
      )
    """, (dist_norm, prov_norm))

    recipients = cursor.fetchall()
    now_npt = get_npt_now_str()

    alert_id = alert_data.get("alert_id", "ALERT_LIVE")
    risk_level = alert_data.get("risk_level", "HIGH")
    prob_pct = alert_data.get("probability_percentage", "75.0%")
    rainfall_24h = float(alert_data.get("rainfall_24h") or 0.0)
    location_name = alert_data.get("location") or alert_data.get("location_name") or f"{dist_norm} Center"
    advisory = alert_data.get("advisory_notes") or f"Heavy precipitation and slope instability detected in {dist_norm}."
    slope = alert_data.get("slope")

    results = []

    if not recipients:
        # If no users specifically registered in that district, notify admin or emergency response accounts
        cursor.execute("""
        SELECT id, username, email, full_name, province, district, role
        FROM users
        WHERE email IS NOT NULL AND email != ''
          AND (role LIKE '%Disaster%' OR role LIKE '%Officer%' OR role LIKE '%Analyst%' OR username = 'sonu')
        """)
        recipients = cursor.fetchall()

    for u in recipients:
        user_email = u["email"]
        user_name = u["full_name"] or u["username"]
        user_prov = u["province"] or prov_norm
        user_dist = u["district"] or dist_norm

        subject = f"[URGENT {risk_level} ALERT] Landslide Warning: {location_name} ({dist_norm}, {prov_norm})"
        text_content = f"""URGENT LANDSLIDE ADVISORY ({risk_level})
Location: {location_name} ({dist_norm}, {prov_norm})
Probability: {prob_pct} | 24h Rainfall: {rainfall_24h} mm
Time: {now_npt}

Advisory: {advisory}

Dear {user_name}, this warning is sent for your registered jurisdiction ({user_dist}, {user_prov}).
Stay away from steep hill slopes and follow official DHM/NDRRMA announcements.
"""
        html_content = build_alert_html(
            recipient_name=user_name,
            province_name=prov_norm,
            district_name=dist_norm,
            location_name=location_name,
            risk_level=risk_level,
            probability_pct=prob_pct,
            rainfall_24h=rainfall_24h,
            slope=slope,
            advisory=advisory,
            alert_id=alert_id,
            timestamp_npt=now_npt
        )

        dispatch_res = send_smtp_email(user_email, subject, html_content, text_content)
        status = "SENT" if dispatch_res["success"] else "FAILED"
        details = dispatch_res.get("message") if dispatch_res["success"] else dispatch_res.get("error")

        # Record in alert_notifications log
        cursor.execute("""
        INSERT INTO alert_notifications (
            alert_id, recipient_email, recipient_name, province, district, subject, status, details, sent_at_npt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert_id, user_email, user_name, user_prov, user_dist, subject, status, details, now_npt
        ))

        results.append({
            "email": user_email,
            "name": user_name,
            "district": user_dist,
            "province": user_prov,
            "status": status,
            "details": details
        })

    conn.commit()
    conn.close()

    return {
        "dispatched_count": len(results),
        "alert_id": alert_id,
        "location": location_name,
        "recipients": results,
        "timestamp_npt": now_npt
    }

def test_email_connection(recipient_email: str) -> Dict[str, Any]:
    """Send a verification test email to validate Gmail SMTP credentials."""
    now_npt = get_npt_now_str()
    subject = "[TEST] Nepal AI Landslide Warning - Gmail Verification"
    text_content = f"Test email from Nepal AI Landslide Early Warning System sent at {now_npt}."

    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 24px;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #1e293b; padding: 24px; border-radius: 10px; border: 1px solid #334155;">
    <h2 style="color: #10b981; margin-top: 0;">✅ Gmail SMTP Configured Successfully!</h2>
    <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      Your Gmail SMTP connection to the <strong>Nepal AI Landslide Early Warning System</strong> is active and functional.
    </p>
    <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; font-size: 12px; color: #94a3b8; font-family: monospace;">
      Target Recipient: {recipient_email}<br>
      System Time: {now_npt}<br>
      Status: TLS Channel Verified
    </div>
    <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
      Early warning alert messages will be automatically dispatched to citizens and response officers on a Province- and District-wise basis whenever risk reaches High or Critical.
    </p>
  </div>
</body>
</html>"""

    res = send_smtp_email(recipient_email, subject, html_content, text_content)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO alert_notifications (
        alert_id, recipient_email, recipient_name, province, district, subject, status, details, sent_at_npt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "TEST_PROBE", recipient_email, "System Administrator", "National", "All Districts",
        subject, "SENT" if res["success"] else "FAILED", res.get("message") or res.get("error"), now_npt
    ))
    conn.commit()
    conn.close()

    return res
