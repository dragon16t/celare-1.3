"""Shared helpers for the Celesta Glow marketplace modules
(Dermatologist Consultation + Home Beauty & Wellness Services)."""
import hashlib
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

_db = None
_verify_admin = None
_razorpay = None

ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / "uploads" / "mp"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

COMMISSION_DEFAULT = 20.0


def setup(db, verify_admin_token, razorpay_client=None):
    global _db, _verify_admin, _razorpay
    _db, _verify_admin, _razorpay = db, verify_admin_token, razorpay_client


def db():
    return _db


def razorpay():
    return _razorpay


def verify_admin_dep():
    return _verify_admin


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def otp_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def is_online(doc) -> bool:
    """Online = toggle on AND heartbeat seen in the last 15 minutes."""
    if not doc.get("online"):
        return False
    last = doc.get("last_seen") or ""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        return last > cutoff
    except Exception:
        return False


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    import math
    r = 6371.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lng2) - float(lng1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def emergent_key() -> Optional[str]:
    try:
        from dotenv import dotenv_values
        vals = dotenv_values(ROOT / ".env")
        if vals.get("EMERGENT_LLM_KEY"):
            return vals["EMERGENT_LLM_KEY"]
    except Exception:
        pass
    return os.environ.get("EMERGENT_LLM_KEY")


# ---------------------------------------------------------------- config
DEFAULT_CONFIG = {
    "_id": "main",
    "dermatologist_enabled": True,
    "home_services_enabled": True,
    "platform_commission_pct": COMMISSION_DEFAULT,
    "customer_fee_pct": 15.0,
    "doctor_contact_policy": "hidden",  # hidden | after_booking | public
    "support_email": "support@celestaglow.com",
    "offer_expiry_minutes": 5,
}


async def cfg() -> Dict[str, Any]:
    doc = await _db.mp_config.find_one({"_id": "main"})
    if not doc:
        doc = dict(DEFAULT_CONFIG)
        await _db.mp_config.insert_one(doc)
    return {**DEFAULT_CONFIG, **doc}


# ---------------------------------------------------------------- storage
async def store_image(data: bytes, slug: str, ext: str = "jpg") -> str:
    """Persist image bytes; Cloudinary when configured, else local disk."""
    try:
        from services import cloudinary_service as cs
        if await cs.ensure_configured(_db):
            res = await cs.upload_image(_db, data, folder="celesta-glow/marketplace", public_id=f"mp-{slug}")
            if res.get("url"):
                return res["url"]
    except Exception as exc:
        logger.warning(f"[mp] cloudinary upload failed ({slug}): {exc}")
    name = f"{slug}.{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/api/mp/media/{name}"


# ---------------------------------------------------------------- auth
def _bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    return parts[1] if len(parts) == 2 and parts[0].lower() == "bearer" else None


async def require_account(authorization: Optional[str], role: str) -> Dict[str, Any]:
    token = _bearer(authorization)
    if not token:
        raise HTTPException(401, "Login required")
    sess = await _db.mp_sessions.find_one({"token": token, "role": role})
    if not sess or sess.get("expires_at", "") < now():
        raise HTTPException(401, "Session expired — please log in again")
    acc = await _db.mp_accounts.find_one({"account_id": sess["account_id"]}, {"_id": 0})
    if not acc:
        acc = await _db.mp_accounts.find_one({"_id": sess["account_id"]}, {"_id": 0})
    if not acc:
        raise HTTPException(401, "Account not found")
    return acc


async def current_customer(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    token = _bearer(authorization)
    if not token:
        return None
    sess = await _db.customer_sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        return None
    cust = await _db.customers.find_one({"email": sess.get("email")}, {"_id": 0}) or {}
    return {"email": sess.get("email"), "name": cust.get("name") or sess.get("name"), "phone": cust.get("phone") or sess.get("phone")}


# ---------------------------------------------------------------- comms
async def send_mail(to: str, subject: str, text: str, html: Optional[str] = None) -> bool:
    try:
        from services import email_service
        res = await email_service.send_email(to, subject, text, html or f"<p>{text}</p>")
        return bool(res.get("success"))
    except Exception as exc:
        logger.warning(f"[mp] email to {to} failed: {exc}")
        return False


async def notify(audience_type: str, audience_ref: str, title: str, body: str, link: str = ""):
    await _db.mp_notifications.insert_one({
        "notif_id": uid("ntf"), "audience_type": audience_type, "audience_ref": audience_ref,
        "title": title, "body": body, "link": link, "read": False, "at": now(),
    })


async def audit(actor: str, action: str, entity: str, entity_id: str, prev: Any = None, new: Any = None, reason: str = ""):
    await _db.mp_audit.insert_one({
        "actor": actor, "action": action, "entity": entity, "entity_id": entity_id,
        "prev": prev, "new": new, "reason": reason, "at": now(),
    })


# ---------------------------------------------------------------- wallet
async def wallet_balance(owner_type: str, owner_id: str) -> float:
    w = await _db.mp_wallets.find_one({"owner_type": owner_type, "owner_id": owner_id})
    return float(w.get("balance", 0)) if w else 0.0


async def wallet_move(owner_type: str, owner_id: str, amount: float, kind: str, ref: str, booking_id: str = "") -> Dict[str, Any]:
    """Atomic ledger move. kind: credit|debit. Raises 400 on insufficient funds."""
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if kind == "debit":
        w = await _db.mp_wallets.find_one_and_update(
            {"owner_type": owner_type, "owner_id": owner_id, "balance": {"$gte": amount}},
            {"$inc": {"balance": -amount}}, upsert=False, return_document=True)
        if not w:
            raise HTTPException(400, "Insufficient wallet balance")
    else:
        w = await _db.mp_wallets.find_one_and_update(
            {"owner_type": owner_type, "owner_id": owner_id},
            {"$inc": {"balance": amount}}, upsert=True, return_document=True)
    entry = {
        "entry_id": uid("led"), "owner_type": owner_type, "owner_id": owner_id,
        "type": kind, "amount": amount, "balance_after": float(w.get("balance", 0)),
        "ref": ref, "booking_id": booking_id, "at": now(),
    }
    await _db.mp_wallet_ledger.insert_one(entry)
    return entry


async def ensure_indexes():
    await _db.mp_sessions.create_index("expires_at", expireAfterSeconds=0)
    await _db.mp_slot_locks.create_index("key", unique=True)
    await _db.mp_wallets.create_index([("owner_type", 1), ("owner_id", 1)], unique=True)
    await _db.mp_booking_offers.create_index([("booking_id", 1), ("partner_id", 1)], unique=True)
    await _db.mp_accounts.create_index([("role", 1), ("email", 1)], unique=True)
    await _db.mp_home_bookings.create_index("booking_id", unique=True)
    await _db.mp_consultations.create_index("booking_id", unique=True)
    await _db.mp_services.create_index("service_id", unique=True)
