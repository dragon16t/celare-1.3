"""Marketplace core: module config, categories, service catalogue,
doctor/partner applications + admin review, provider auth, public discovery."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services import mp_common as mp

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mp", tags=["marketplace-core"])

Db = None


def setup(db, verify_admin_token, razorpay_client=None):
    global Db
    Db = db
    mp.setup(db, verify_admin_token, razorpay_client)


CAT_IMAGES = {
    "Acne & Pimples": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584204/celesta-glow/live-import/e79771ce3094ac47.png",
    "Pigmentation": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584202/celesta-glow/live-import/d7ac756b1b8d2d47.jpg",
    "Anti-Aging": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584205/celesta-glow/live-import/4e7c13e62ce815d1.png",
    "Hair & Scalp": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584206/celesta-glow/live-import/f357226754bd94ff.jpg",
    "Sensitive Skin": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584203/celesta-glow/live-import/98dc57dd4992a552.jpg",
    "Skin Concerns": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584351/celesta-glow/live-import/ef09d168d290e156.jpg",
    "General Dermatology": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584242/celesta-glow/live-import/aee18ad731c92205.jpg",
    "View All": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584210/celesta-glow/live-import/d43fd484b8902506.jpg",
    "Facials": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584241/celesta-glow/live-import/afc492aef3a0a01f.jpg",
    "Hair Colouring": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584209/celesta-glow/live-import/4f79b3bec7799cb3.jpg",
    "Hair Spa": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584265/celesta-glow/live-import/e3c8947ff2032de8.jpg",
    "Hair & Scalp Care": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584251/celesta-glow/live-import/d0fa1cf0ac42dac1.jpg",
    "Skin Cleansing": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584286/celesta-glow/live-import/b031fd68d734d659.png",
    "Beauty & Grooming": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584250/celesta-glow/live-import/87c04c5f3aa7abfd.jpg",
    "Wellness Treatments": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584251/celesta-glow/live-import/6a6512ea684c1068.jpg",
    "View All Services": "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584354/celesta-glow/live-import/b0f9b4140fb8f849.jpg",
}


async def seed_defaults(db):
    """Idempotent seed of module categories + sample services (admin-editable)."""
    if await db.mp_categories.count_documents({}) == 0:
        doctor_cats = ["Acne & Pimples", "Pigmentation", "Anti-Aging", "Hair & Scalp",
                       "Sensitive Skin", "Skin Concerns", "General Dermatology", "View All"]
        service_cats = ["Facials", "Hair Colouring", "Hair Spa", "Hair & Scalp Care",
                        "Skin Cleansing", "Beauty & Grooming", "Wellness Treatments", "View All Services"]
        docs = []
        for i, t in enumerate(doctor_cats):
            docs.append({"cat_id": mp.uid("cat"), "module": "doctor", "title": t, "image": "",
                         "order": i, "active": True, "created_at": mp.now()})
        for i, t in enumerate(service_cats):
            docs.append({"cat_id": mp.uid("cat"), "module": "service", "title": t, "image": "",
                         "order": i, "active": True, "created_at": mp.now()})
        await db.mp_categories.insert_many(docs)
        logger.info("[mp] seeded module categories")
    if await db.mp_services.count_documents({}) == 0:
        svc_cats = await db.mp_categories.find({"module": "service"}, {"_id": 0}).to_list(50)
        cat_map = {c["title"]: c["cat_id"] for c in svc_cats}
        img = "https://res.cloudinary.com/dcvuqcqjn/image/upload/f_auto,q_100/v1791584205/celesta-glow/live-import/4e7c13e62ce815d1.png"
        samples = [
            ("Facials", "Signature Glow Facial", "A deep-cleansing facial tailored to your skin type.", 60, 1499),
            ("Hair Spa", "Repair Hair Spa Ritual", "Nourishing hair spa with scalp massage and steam.", 75, 1199),
            ("Hair Colouring", "Global Hair Colour", "Ammonia-free global colour with post-care serum.", 120, 2499),
            ("Skin Cleansing", "Deep Cleansing & De-tan", "Gentle de-tan cleanse for face and neck.", 45, 899),
        ]
        for cat, name, desc, dur, price in samples:
            await db.mp_services.insert_one({
                "service_id": mp.uid("svc"), "name": name, "category_id": cat_map.get(cat, ""),
                "category_title": cat, "short_desc": desc, "full_desc": desc,
                "includes": ["Professional products", "Sanitised equipment"], "excludes": [],
                "duration_min": dur, "mode": "home", "price": price,
                "price_range": {"min": int(price * 0.8), "max": int(price * 1.3)},
                "commission_pct": 20.0, "tax_pct": 18.0, "offer_eligible": True,
                "cancellation_policy": "Free cancellation up to 4 hours before the slot.",
                "qualifications": [], "equipment": "", "prep": "", "aftercare": "",
                "warnings": "", "patch_test": cat == "Hair Colouring", "materials_included": True,
                "locations": [], "age_restriction": "", "images": [img], "thumbnail": img,
                "status": "active", "created_at": mp.now(), "updated_at": mp.now(),
            })
        logger.info("[mp] seeded sample services")
    async for c in db.mp_categories.find({"$or": [{"image": ""}, {"image": {"$exists": False}}]}):
        url = CAT_IMAGES.get(c.get("title", ""))
        if url:
            await db.mp_categories.update_one({"_id": c["_id"]}, {"$set": {"image": url}})
    if await db.mp_doctors.count_documents({"personal.email": {"$regex": "sample.celestaglow.com"}}) == 0:
        samples = [
            ("dr.meera@sample.celestaglow.com", "Meera Krishnan", "MBBS, MD (Dermatology)", "Anti-Aging", 12, 799, 12.9716, 77.5946),
            ("dr.arjun@sample.celestaglow.com", "Arjun Rao", "MBBS, DVD", "Acne & Hair", 9, 699, 12.9352, 77.6245),
            ("dr.sana@sample.celestaglow.com", "Sana Sheikh", "MBBS, MD (Dermatology)", "Sensitive Skin", 7, 899, 12.9698, 77.7500),
        ]
        for email, name, qual, spec, yrs, fee, slat, slng in samples:
            did = mp.uid("doc")
            await db.mp_doctors.insert_one({
                "doctor_id": did, "application_status": "approved", "active": True,
                "personal": {"name": name, "mobile": "9800000000", "email": email,
                             "address": "", "city": "Bengaluru", "state": "KA", "pincode": "560001",
                             "lat": slat, "lng": slng},
                "professional": {"qualification": qual, "institution": "Sample Medical College",
                                 "graduation_year": "2012", "postgrad": "", "specialisation": spec,
                                 "experience_years": yrs, "bio": f"{yrs}+ years of clinical dermatology practice.",
                                 "registration_number": f"SAMPLE-{did[-5:]}", "issuing_authority": "KMC"},
                "consultation": {"fee": fee, "duration_min": 20,
                                 "weekly_slots": {d: ["10:00", "11:00", "12:00", "16:00", "17:00"]
                                                  for d in ["mon", "tue", "wed", "thu", "fri", "sat"]},
                                 "languages": ["English", "Hindi"], "video_enabled": True,
                                 "followup_policy": "One free follow-up within 7 days"},
                "documents": [], "photo": {}, "decisions": [{"by": "system", "action": "seed", "at": mp.now()}],
                "created_at": mp.now()})
            await db.mp_accounts.insert_one({"account_id": mp.uid("acc"), "role": "doctor", "email": email,
                                             "name": name, "ref_id": did, "email_verified": True,
                                             "created_at": mp.now()})
        logger.info("[mp] seeded 3 sample doctors")
    if await db.mp_services.count_documents({}) <= 4:
        svc_cats = await db.mp_categories.find({"module": "service"}, {"_id": 0}).to_list(50)
        cat_map = {c["title"]: c["cat_id"] for c in svc_cats}
        extras = [
            ("Beauty & Grooming", "Head-to-Toe Grooming", "Complete grooming session: trim, threading and clean-up.", 90, 999),
            ("Wellness Treatments", "Relaxation Body Massage", "Full-body relaxation massage with aromatic oils.", 60, 1599),
            ("Hair & Scalp Care", "Scalp Detox Treatment", "Deep scalp cleanse with anti-dandruff care.", 45, 799),
            ("Facials", "Classic Clean-Up", "Quick express clean-up for instant freshness.", 30, 499),
        ]
        for cat, name, desc, dur, price in extras:
            await db.mp_services.insert_one({
                "service_id": mp.uid("svc"), "name": name, "category_id": cat_map.get(cat, ""),
                "category_title": cat, "short_desc": desc, "full_desc": desc,
                "includes": ["Professional products", "Sanitised equipment"], "excludes": [],
                "duration_min": dur, "mode": "home", "price": price,
                "price_range": {"min": int(price * 0.8), "max": int(price * 1.3)},
                "commission_pct": 20.0, "tax_pct": 18.0, "offer_eligible": True,
                "cancellation_policy": "Free cancellation up to 4 hours before the slot.",
                "qualifications": [], "equipment": "", "prep": "", "aftercare": "",
                "warnings": "", "patch_test": False, "materials_included": True,
                "locations": [], "age_restriction": "", "images": [], "thumbnail": "",
                "status": "active", "created_at": mp.now(), "updated_at": mp.now()})
        logger.info("[mp] seeded 4 extra sample services")


# ================================================================ public config
@router.get("/config")
async def public_config():
    c = await mp.cfg()
    online_docs = sum(1 for d in await Db.mp_doctors.find(
        {"application_status": "approved", "active": True}, {"online": 1, "last_seen": 1}).to_list(500) if mp.is_online(d))
    online_prts = sum(1 for p in await Db.mp_partners.find(
        {"application_status": "approved", "active": True}, {"online": 1, "last_seen": 1}).to_list(500) if mp.is_online(p))
    return {
        "dermatologist_enabled": c["dermatologist_enabled"],
        "home_services_enabled": c["home_services_enabled"],
        "payments_configured": mp.razorpay() is not None,
        "ai_photo_configured": mp.emergent_key() is not None,
        "support_email": c["support_email"],
        "online_doctors": online_docs,
        "online_partners": online_prts,
    }


@router.get("/categories")
async def list_categories(module: str = "service"):
    docs = await Db.mp_categories.find(
        {"module": module, "active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return docs


@router.get("/services")
async def list_services(category_id: str = "", q: str = ""):
    query: Dict[str, Any] = {"status": "active"}
    if category_id:
        query["category_id"] = category_id
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    svcs = await Db.mp_services.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for s in svcs:
        partners = await Db.mp_partners.find(
            {"application_status": "approved", "active": True, "paused": {"$ne": True},
             "services": {"$elemMatch": {"service_id": s["service_id"], "approval_status": "approved"}}},
            {"services.$": 1}).to_list(100)
        s["partner_count"] = len(partners)
        prices = [p["services"][0].get("price") for p in partners if p.get("services") and p["services"][0].get("price")]
        s["from_price"] = min(prices) if prices else s.get("price")
    return svcs


@router.get("/services/{service_id}")
async def get_service(service_id: str):
    s = await Db.mp_services.find_one({"service_id": service_id}, {"_id": 0})
    if not s or s.get("status") != "active":
        raise HTTPException(404, "Service not available")
    partners = await Db.mp_partners.find(
        {"application_status": "approved", "active": True, "paused": {"$ne": True},
         "services": {"$elemMatch": {"service_id": service_id, "approval_status": "approved"}}},
        {"_id": 0, "partner_id": 1, "applicant.business_name": 1, "applicant.name": 1, "services.$": 1}).to_list(100)
    s["partners"] = [{
        "partner_id": p["partner_id"],
        "name": (p.get("applicant") or {}).get("business_name") or (p.get("applicant") or {}).get("name"),
        "price": (p.get("services") or [{}])[0].get("price", s.get("price")),
    } for p in partners]
    return s


@router.get("/doctors")
async def list_doctors(category: str = "", lat: float = 0, lng: float = 0, radius_km: float = 50):
    query: Dict[str, Any] = {"application_status": "approved", "active": True}
    if category and category.lower() not in ("view all", ""):
        query["professional.specialisation"] = {"$regex": category, "$options": "i"}
    docs = await Db.mp_doctors.find(query, {"_id": 0}).to_list(200)
    out = []
    for d in docs:
        pub = _public_doctor(d)
        pub["online"] = mp.is_online(d)
        loc = d.get("personal") or {}
        dlat, dlng = loc.get("lat"), loc.get("lng")
        if lat and lng:
            if dlat and dlng:
                dist = mp.haversine_km(lat, lng, dlat, dlng)
                pub["distance_km"] = round(dist, 1)
                if dist > radius_km:
                    continue
            else:
                pub["distance_km"] = None
        out.append(pub)
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    return out


def _public_doctor(d: Dict[str, Any]) -> Dict[str, Any]:
    photo = (d.get("photo") or {})
    return {
        "doctor_id": d["doctor_id"],
        "name": (d.get("personal") or {}).get("name"),
        "qualification": (d.get("professional") or {}).get("qualification"),
        "specialisation": (d.get("professional") or {}).get("specialisation"),
        "experience_years": (d.get("professional") or {}).get("experience_years"),
        "bio": (d.get("professional") or {}).get("bio"),
        "languages": (d.get("consultation") or {}).get("languages", []),
        "fee": (d.get("consultation") or {}).get("fee"),
        "duration_min": (d.get("consultation") or {}).get("duration_min", 20),
        "verified": True,
        "photo": photo.get("chosen") or photo.get("processed") or photo.get("original_url") or "",
        "weekly_slots": (d.get("consultation") or {}).get("weekly_slots", {}),
    }


@router.get("/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    d = await Db.mp_doctors.find_one({"doctor_id": doctor_id, "application_status": "approved", "active": True}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Doctor not found")
    out = _public_doctor(d)
    out["online"] = mp.is_online(d)
    out["engaged"] = bool(await Db.mp_consultations.find_one(
        {"doctor_id": doctor_id, "status": {"$in": ["in_progress", "completion_pending"]}}))
    booked = await Db.mp_consultations.find(
        {"doctor_id": doctor_id, "status": {"$in": ["confirmed", "pending_payment"]}},
        {"_id": 0, "date": 1, "slot": 1}).to_list(500)
    out["booked_slots"] = booked
    return out


# ================================================================ provider auth
class SendOtp(BaseModel):
    email: str
    role: str


class VerifyOtp(BaseModel):
    email: str
    role: str
    otp: str


@router.post("/auth/send-otp")
async def provider_send_otp(body: SendOtp):
    if body.role not in ("doctor", "partner"):
        raise HTTPException(400, "Invalid role")
    acc = await Db.mp_accounts.find_one({"role": body.role, "email": body.email.lower()})
    if not acc:
        raise HTTPException(404, "No approved account for this email. Apply first or wait for approval.")
    code = mp.otp_code()
    import datetime as _dt
    await Db.mp_otps.update_one(
        {"email": body.email.lower(), "role": body.role},
        {"$set": {"otp_hash": mp.hash_otp(code), "attempts": 0,
                  "expires_at": (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(minutes=10)).isoformat()}},
        upsert=True)
    sent = await mp.send_mail(body.email, "Celesta Glow partner login code",
                              f"Your login code is {code}. It expires in 10 minutes.",
                              f"<h2 style='font-family:sans-serif'>Your login code: <b>{code}</b></h2><p>Expires in 10 minutes.</p>")
    return {"success": True, "email_sent": sent, "dev_otp": None if sent else code}


@router.post("/auth/verify-otp")
async def provider_verify_otp(body: VerifyOtp):
    rec = await Db.mp_otps.find_one({"email": body.email.lower(), "role": body.role})
    if not rec or rec.get("expires_at", "") < mp.now():
        raise HTTPException(400, "Code expired — request a new one")
    if (rec.get("attempts") or 0) >= 5:
        raise HTTPException(429, "Too many attempts — request a new code")
    if rec.get("otp_hash") != mp.hash_otp(body.otp):
        await Db.mp_otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect code")
    acc = await Db.mp_accounts.find_one({"role": body.role, "email": body.email.lower()})
    if not acc:
        raise HTTPException(404, "Account not found")
    import secrets as _s
    import datetime as _dt
    token = _s.token_hex(24)
    await Db.mp_sessions.insert_one({
        "token": token, "account_id": acc.get("account_id"),
        "role": body.role,
        "expires_at": (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=14)).isoformat()})
    await Db.mp_otps.delete_one({"_id": rec["_id"]})
    return {"success": True, "token": token, "role": body.role, "ref_id": acc.get("ref_id"), "name": acc.get("name")}


@router.get("/auth/me")
async def provider_me(authorization: str = Header(None)):
    token = (authorization or "").split()[-1] if authorization else ""
    sess = await Db.mp_sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Not logged in")
    acc = await Db.mp_accounts.find_one({"account_id": sess["account_id"]}, {"_id": 0})
    if not acc:
        acc = await Db.mp_accounts.find_one({"_id": sess["account_id"]}, {"_id": 0})
    if not acc:
        raise HTTPException(401, "Account not found")
    coll = Db.mp_doctors if acc["role"] == "doctor" else Db.mp_partners
    prof = await coll.find_one({"doctor_id" if acc["role"] == "doctor" else "partner_id": acc["ref_id"]}, {"_id": 0})
    return {"role": acc["role"], "email": acc["email"], "name": acc.get("name"), "ref_id": acc["ref_id"], "profile": prof}


# ================================================================ applications
class DoctorApplication(BaseModel):
    name: str
    mobile: str
    email: str
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    languages: List[str] = []
    qualification: str = ""
    institution: str = ""
    graduation_year: str = ""
    postgrad: str = ""
    specialisation: str = ""
    experience_years: int = 0
    bio: str = ""
    registration_number: str = ""
    issuing_authority: str = ""
    fee: float = 999
    duration_min: int = 20
    weekly_slots: Dict[str, List[str]] = {}
    video_enabled: bool = True
    followup_policy: str = ""


@router.post("/doctors/apply")
async def doctor_apply(app: DoctorApplication):
    cfg = await mp.cfg()
    if not cfg["dermatologist_enabled"]:
        raise HTTPException(403, "Dermatologist onboarding is currently closed")
    if not app.registration_number:
        raise HTTPException(400, "Medical registration number is required")
    existing = await Db.mp_doctors.find_one({"personal.email": app.email.lower(),
                                             "application_status": {"$in": ["pending", "approved", "info_requested"]}})
    if existing:
        raise HTTPException(409, "An application already exists for this email")
    doc = {
        "doctor_id": mp.uid("doc"),
        "application_status": "pending", "active": False,
        "personal": {"name": app.name, "mobile": app.mobile, "email": app.email.lower(),
                     "address": app.address, "city": app.city, "state": app.state, "pincode": app.pincode,
                         "lat": getattr(app, "lat", None), "lng": getattr(app, "lng", None)},
        "professional": {"qualification": app.qualification, "institution": app.institution,
                         "graduation_year": app.graduation_year, "postgrad": app.postgrad,
                         "specialisation": app.specialisation, "experience_years": app.experience_years,
                         "bio": app.bio, "registration_number": app.registration_number,
                         "issuing_authority": app.issuing_authority},
        "consultation": {"fee": app.fee, "duration_min": app.duration_min, "weekly_slots": app.weekly_slots,
                         "languages": app.languages, "video_enabled": app.video_enabled,
                         "followup_policy": app.followup_policy},
        "documents": [], "photo": {}, "decisions": [], "created_at": mp.now(),
    }
    await Db.mp_doctors.insert_one(doc)
    await mp.notify("admin", "all", "New dermatologist application", f"{app.name} applied", "/admin/doctors-crm")
    await mp.send_mail(app.email, "Celesta Glow — application received",
                       f"Hi {app.name}, your dermatologist application {doc['doctor_id']} was received and is under review.")
    return {"success": True, "application_id": doc["doctor_id"], "status": "pending"}


class PartnerServiceSelection(BaseModel):
    service_id: str
    mode: str = "home"
    price: Optional[float] = None
    coverage: str = ""
    qualifications: str = ""


class PartnerApplication(BaseModel):
    name: str
    mobile: str
    email: str
    business_name: str = ""
    applicant_type: str = "individual"
    address: str
    city: str
    state: str
    pincode: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    coverage_area: str = ""
    id_proof: str = ""
    qualifications: str = ""
    account_holder: str = ""
    bank_account: str = ""
    ifsc: str = ""
    upi: str = ""
    services: List[PartnerServiceSelection] = []


@router.post("/partners/apply")
async def partner_apply(app: PartnerApplication):
    cfg = await mp.cfg()
    if not cfg["home_services_enabled"]:
        raise HTTPException(403, "Partner onboarding is currently closed")
    if not app.services:
        raise HTTPException(400, "Select at least one service from the catalogue")
    valid = []
    for sel in app.services:
        svc = await Db.mp_services.find_one({"service_id": sel.service_id, "status": "active"}, {"_id": 0})
        if not svc:
            raise HTTPException(400, f"Service {sel.service_id} is not an active catalogue service")
        price = sel.price if sel.price is not None else svc.get("price")
        pr = svc.get("price_range") or {}
        if pr and price is not None and not (pr.get("min", 0) <= price <= pr.get("max", 10**9)):
            raise HTTPException(400, f"Price for {svc['name']} must be within ₹{pr.get('min')}–₹{pr.get('max')}")
        valid.append({"service_id": sel.service_id, "service_name": svc["name"], "mode": sel.mode,
                      "price": price, "coverage": sel.coverage, "qualifications": sel.qualifications,
                      "approval_status": "pending"})
    existing = await Db.mp_partners.find_one({"applicant.email": app.email.lower(),
                                              "application_status": {"$in": ["pending", "approved", "info_requested"]}})
    if existing:
        raise HTTPException(409, "An application already exists for this email")
    doc = {
        "partner_id": mp.uid("prt"), "application_status": "pending", "active": False, "paused": False,
        "applicant": {"name": app.name, "mobile": app.mobile, "email": app.email.lower(),
                      "business_name": app.business_name, "applicant_type": app.applicant_type,
                      "id_proof": app.id_proof, "qualifications": app.qualifications},
        "location": {"address": app.address, "city": app.city, "state": app.state, "pincode": app.pincode,
                     "lat": app.lat, "lng": app.lng, "coverage_area": app.coverage_area},
        "payout": {"account_holder": app.account_holder, "bank_account": app.bank_account,
                   "ifsc": app.ifsc, "upi": app.upi},
        "services": valid, "documents": [], "decisions": [], "created_at": mp.now(),
    }
    await Db.mp_partners.insert_one(doc)
    await mp.notify("admin", "all", "New service partner application", f"{app.name} applied", "/admin/partners-crm")
    await mp.send_mail(app.email, "Celesta Glow — partner application received",
                       f"Hi {app.name}, your partner application {doc['partner_id']} was received and is under review.")
    return {"success": True, "application_id": doc["partner_id"], "status": "pending"}


# ================================================================ media
@router.get("/media/{name}")
async def serve_media(name: str):
    safe = name.replace("/", "").replace("..", "")
    path = mp.UPLOAD_DIR / safe
    if not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(str(path))


# ================================================================ admin
@router.get("/admin/config")
async def admin_get_config(x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    c = await mp.cfg()
    c.pop("_id", None)
    c["payments_configured"] = mp.razorpay() is not None
    c["ai_photo_configured"] = mp.emergent_key() is not None
    return c


async def _check_admin(x_admin_token: Optional[str]):
    verifier = mp.verify_admin_dep()
    try:
        res = verifier(x_admin_token=x_admin_token, admin_session=None)
        if hasattr(res, "__await__"):
            await res
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(401, f"Admin auth failed: {exc}")


class ConfigUpdate(BaseModel):
    dermatologist_enabled: Optional[bool] = None
    home_services_enabled: Optional[bool] = None
    platform_commission_pct: Optional[float] = None
    customer_fee_pct: Optional[float] = None
    doctor_contact_policy: Optional[str] = None
    support_email: Optional[str] = None


@router.put("/admin/config")
async def admin_update_config(body: ConfigUpdate, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await Db.mp_config.update_one({"_id": "main"}, {"$set": updates}, upsert=True)
        await mp.audit("admin", "config_update", "mp_config", "main", new=updates)
    return {"success": True, **updates}


class CategoryIn(BaseModel):
    module: str
    title: str
    image: str = ""
    order: int = 0
    active: bool = True


@router.get("/admin/categories")
async def admin_list_categories(module: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"module": module} if module else {}
    return await Db.mp_categories.find(q, {"_id": 0}).sort([("module", 1), ("order", 1)]).to_list(300)


@router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    doc = {"cat_id": mp.uid("cat"), **body.dict(), "created_at": mp.now()}
    await Db.mp_categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, body: CategoryIn, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    await Db.mp_categories.update_one({"cat_id": cat_id}, {"$set": body.dict()})
    return {"success": True}


@router.delete("/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    await Db.mp_categories.delete_one({"cat_id": cat_id})
    return {"success": True}


@router.post("/admin/categories/{cat_id}/image")
async def admin_upload_category_image(cat_id: str, file: UploadFile = File(...), x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    cat = await Db.mp_categories.find_one({"cat_id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8MB")
    if (file.content_type or "") not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Only JPG, PNG or WebP images are allowed")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    url = await mp.store_image(data, f"cat-{cat_id}-{len(cat.get('title',''))}", ext)
    await Db.mp_categories.update_one({"cat_id": cat_id}, {"$set": {"image": url}})
    return {"success": True, "url": url}


@router.post("/admin/doctors/{doctor_id}/photo")
async def admin_doctor_photo(doctor_id: str, file: UploadFile = File(...), x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    d = await Db.mp_doctors.find_one({"doctor_id": doctor_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Doctor not found")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Photo must be under 8MB")
    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    url = await mp.store_image(data, f"doc-{doctor_id}-admin-{__import__('secrets').token_hex(3)}", ext)
    photo = d.get("photo") or {}
    photo.update({"original_url": url, "chosen": url, "status": "approved", "uploaded_at": mp.now()})
    await Db.mp_doctors.update_one({"doctor_id": doctor_id}, {"$set": {"photo": photo}})
    return {"success": True, "url": url}


@router.post("/admin/partners/{partner_id}/photo")
async def admin_partner_photo(partner_id: str, file: UploadFile = File(...), x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    p = await Db.mp_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Partner not found")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Photo must be under 8MB")
    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    url = await mp.store_image(data, f"prt-{partner_id}-admin-{__import__('secrets').token_hex(3)}", ext)
    await Db.mp_partners.update_one({"partner_id": partner_id}, {"$set": {
        "photo": {"original_url": url, "chosen": url, "status": "approved", "uploaded_at": mp.now()}}})
    return {"success": True, "url": url}


@router.get("/admin/reviews")
async def admin_reviews(module: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"module": module} if module else {}
    return await Db.mp_reviews.find(q, {"_id": 0}).sort("at", -1).to_list(300)


class ServiceIn(BaseModel):
    name: str
    category_id: str = ""
    category_title: str = ""
    short_desc: str = ""
    full_desc: str = ""
    includes: List[str] = []
    excludes: List[str] = []
    duration_min: int = 60
    mode: str = "home"
    price: float = 0
    price_range: Dict[str, float] = {"min": 0, "max": 0}
    commission_pct: float = 20.0
    tax_pct: float = 18.0
    offer_eligible: bool = True
    cancellation_policy: str = ""
    qualifications: List[str] = []
    equipment: str = ""
    prep: str = ""
    aftercare: str = ""
    warnings: str = ""
    patch_test: bool = False
    materials_included: bool = True
    locations: List[str] = []
    age_restriction: str = ""
    status: str = "draft"


@router.get("/admin/services")
async def admin_list_services(status: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"status": status} if status else {}
    return await Db.mp_services.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/services")
async def admin_create_service(body: ServiceIn, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    doc = {"service_id": mp.uid("svc"), **body.dict(), "images": [], "thumbnail": "",
           "created_at": mp.now(), "updated_at": mp.now()}
    await Db.mp_services.insert_one(doc)
    await mp.audit("admin", "create", "service", doc["service_id"], new=doc["name"])
    doc.pop("_id", None)
    return doc


@router.put("/admin/services/{service_id}")
async def admin_update_service(service_id: str, body: ServiceIn, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    data = body.dict()
    data["updated_at"] = mp.now()
    res = await Db.mp_services.update_one({"service_id": service_id}, {"$set": data})
    if not res.matched_count:
        raise HTTPException(404, "Service not found")
    await mp.audit("admin", "update", "service", service_id, new=data.get("name"))
    return {"success": True}


@router.post("/admin/services/{service_id}/status")
async def admin_service_status(service_id: str, body: Dict[str, str], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    status = body.get("status")
    if status not in ("draft", "active", "inactive", "pending", "archived"):
        raise HTTPException(400, "Invalid status")
    svc = await Db.mp_services.find_one({"service_id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    if status == "active" and not svc.get("thumbnail") and not svc.get("images"):
        raise HTTPException(400, "Add at least one service image before publishing")
    await Db.mp_services.update_one({"service_id": service_id}, {"$set": {"status": status, "updated_at": mp.now()}})
    await mp.audit("admin", f"status:{status}", "service", service_id, prev=svc.get("status"), new=status)
    return {"success": True, "status": status}


@router.post("/admin/services/{service_id}/images")
async def admin_upload_service_image(service_id: str, file: UploadFile = File(...), x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    svc = await Db.mp_services.find_one({"service_id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8MB")
    if (file.content_type or "") not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Only JPG, PNG or WebP images are allowed")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    url = await mp.store_image(data, f"svc-{service_id}-{len(svc.get('images', []))}", ext)
    images = svc.get("images", []) + [url]
    await Db.mp_services.update_one({"service_id": service_id},
                                    {"$set": {"images": images, "thumbnail": svc.get("thumbnail") or url,
                                              "updated_at": mp.now()}})
    return {"success": True, "url": url, "images": images}


@router.delete("/admin/services/{service_id}/images")
async def admin_delete_service_image(service_id: str, url: str, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    svc = await Db.mp_services.find_one({"service_id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    images = [i for i in svc.get("images", []) if i != url]
    thumb = svc.get("thumbnail") if svc.get("thumbnail") in images else (images[0] if images else "")
    await Db.mp_services.update_one({"service_id": service_id}, {"$set": {"images": images, "thumbnail": thumb}})
    return {"success": True, "images": images}


@router.post("/admin/services/{service_id}/thumbnail")
async def admin_set_thumbnail(service_id: str, body: Dict[str, str], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    await Db.mp_services.update_one({"service_id": service_id}, {"$set": {"thumbnail": body.get("url", "")}})
    return {"success": True}


# ------------------------------------------------------- admin: CRM review
class ReviewDecision(BaseModel):
    action: str  # approve | reject | request_info | suspend | reactivate
    reason: str = ""


@router.get("/admin/doctors")
async def admin_list_doctors(status: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"application_status": status} if status else {}
    return await Db.mp_doctors.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/doctors/{doctor_id}/review")
async def admin_review_doctor(doctor_id: str, body: ReviewDecision, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    d = await Db.mp_doctors.find_one({"doctor_id": doctor_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Doctor not found")
    mapping = {"approve": "approved", "reject": "rejected", "request_info": "info_requested",
               "suspend": "suspended", "reactivate": "approved"}
    if body.action not in mapping:
        raise HTTPException(400, "Invalid action")
    new_status = mapping[body.action]
    prev = d["application_status"]
    decision = {"by": "admin", "action": body.action, "reason": body.reason,
                "prev": prev, "new": new_status, "at": mp.now()}
    await Db.mp_doctors.update_one({"doctor_id": doctor_id}, {
        "$set": {"application_status": new_status,
                 "active": new_status == "approved"},
        "$push": {"decisions": decision}})
    await mp.audit("admin", f"doctor:{body.action}", "doctor", doctor_id, prev=prev, new=new_status, reason=body.reason)
    if body.action == "approve":
        await Db.mp_accounts.update_one(
            {"role": "doctor", "email": d["personal"]["email"]},
            {"$set": {"role": "doctor", "email": d["personal"]["email"],
                      "name": d["personal"]["name"], "ref_id": doctor_id},
             "$setOnInsert": {"account_id": mp.uid("acc"), "created_at": mp.now(), "email_verified": True}},
            upsert=True)
        await mp.send_mail(d["personal"]["email"], "Celesta Glow — application approved",
                           f"Congratulations Dr. {d['personal']['name']}! Your profile is approved. "
                           f"Log in to your doctor dashboard with this email to set availability and receive bookings.")
    elif body.action in ("reject", "request_info"):
        await mp.send_mail(d["personal"]["email"], f"Celesta Glow — application {new_status.replace('_', ' ')}",
                           f"Your application status is now: {new_status.replace('_',' ')}. Reason: {body.reason or '—'}")
    return {"success": True, "status": new_status}


@router.get("/admin/partners")
async def admin_list_partners(status: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"application_status": status} if status else {}
    return await Db.mp_partners.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/partners/{partner_id}/review")
async def admin_review_partner(partner_id: str, body: ReviewDecision, x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    p = await Db.mp_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Partner not found")
    mapping = {"approve": "approved", "reject": "rejected", "request_info": "info_requested",
               "suspend": "suspended", "reactivate": "approved"}
    if body.action not in mapping:
        raise HTTPException(400, "Invalid action")
    new_status = mapping[body.action]
    prev = p["application_status"]
    decision = {"by": "admin", "action": body.action, "reason": body.reason,
                "prev": prev, "new": new_status, "at": mp.now()}
    svc_updates = {}
    if body.action == "approve":
        svc_updates["services"] = [{**s, "approval_status": "approved"} for s in p.get("services", [])]
    await Db.mp_partners.update_one({"partner_id": partner_id}, {
        "$set": {"application_status": new_status, "active": new_status == "approved", **svc_updates},
        "$push": {"decisions": decision}})
    await mp.audit("admin", f"partner:{body.action}", "partner", partner_id, prev=prev, new=new_status, reason=body.reason)
    if body.action == "approve":
        await Db.mp_accounts.update_one(
            {"role": "partner", "email": p["applicant"]["email"]},
            {"$set": {"role": "partner", "email": p["applicant"]["email"],
                      "name": p["applicant"]["name"], "ref_id": partner_id},
             "$setOnInsert": {"account_id": mp.uid("acc"), "created_at": mp.now(), "email_verified": True}},
            upsert=True)
        await mp.send_mail(p["applicant"]["email"], "Celesta Glow — partner application approved",
                           f"Congratulations {p['applicant']['name']}! You can now log in to your partner dashboard and start receiving bookings.")
    return {"success": True, "status": new_status}


@router.post("/admin/partners/{partner_id}/services/{service_id}/decision")
async def admin_partner_service_decision(partner_id: str, service_id: str, body: Dict[str, str],
                                         x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be approved|rejected")
    res = await Db.mp_partners.update_one(
        {"partner_id": partner_id, "services.service_id": service_id},
        {"$set": {"services.$.approval_status": decision}})
    if not res.matched_count:
        raise HTTPException(404, "Partner service mapping not found")
    await mp.audit("admin", f"partner_service:{decision}", "partner", partner_id, new=service_id)
    return {"success": True, "decision": decision}


# ------------------------------------------------------- admin: withdrawals
@router.get("/admin/withdrawals")
async def admin_withdrawals(status: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q = {"status": status} if status else {}
    return await Db.mp_withdrawals.find(q, {"_id": 0}).sort("at", -1).to_list(300)


@router.post("/admin/withdrawals/{withdrawal_id}/process")
async def admin_process_withdrawal(withdrawal_id: str, body: Dict[str, str], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    w = await Db.mp_withdrawals.find_one({"withdrawal_id": withdrawal_id}, {"_id": 0})
    if not w or w["status"] != "pending":
        raise HTTPException(404, "Pending withdrawal not found")
    action = body.get("action")
    if action == "paid":
        await Db.mp_withdrawals.update_one({"withdrawal_id": withdrawal_id}, {"$set": {
            "status": "paid", "reference": body.get("reference", ""), "processed_by": "admin", "processed_at": mp.now()}})
    elif action == "rejected":
        await mp.wallet_move(w["owner_type"], w["owner_id"], w["amount"], "credit",
                             f"withdrawal {withdrawal_id} rejected — refund")
        await Db.mp_withdrawals.update_one({"withdrawal_id": withdrawal_id}, {"$set": {
            "status": "rejected", "reason": body.get("reason", ""), "processed_by": "admin", "processed_at": mp.now()}})
    else:
        raise HTTPException(400, "action must be paid|rejected")
    await mp.audit("admin", f"withdrawal:{action}", "withdrawal", withdrawal_id)
    await mp.notify(w["owner_type"], w["owner_id"], f"Withdrawal {action}",
                    f"Your withdrawal of ₹{w['amount']} was {action}.", "")
    return {"success": True, "status": action}


# ------------------------------------------------------- admin: support
@router.get("/admin/support")
async def admin_support(status: str = "", category: str = "", user_type: str = "", x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    if user_type:
        q["user_type"] = user_type
    return await Db.mp_support.find(q, {"_id": 0}).sort("updated_at", -1).to_list(500)


@router.patch("/admin/support/{ticket_id}")
async def admin_support_patch(ticket_id: str, body: Dict[str, Any], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    updates = {k: body[k] for k in ("status", "assigned", "priority", "resolution_notes") if k in body}
    updates["updated_at"] = mp.now()
    res = await Db.mp_support.update_one({"ticket_id": ticket_id}, {"$set": updates})
    if not res.matched_count:
        raise HTTPException(404, "Ticket not found")
    return {"success": True}


@router.post("/admin/support/{ticket_id}/reply")
async def admin_support_reply(ticket_id: str, body: Dict[str, str], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    reply = {"by": "support", "message": body.get("message", ""), "at": mp.now()}
    res = await Db.mp_support.update_one({"ticket_id": ticket_id},
                                         {"$push": {"responses": reply},
                                          "$set": {"updated_at": mp.now(), "status": body.get("status", "in_progress")}})
    if not res.matched_count:
        raise HTTPException(404, "Ticket not found")
    t = await Db.mp_support.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if t and t.get("user_ref"):
        await mp.send_mail(t["user_ref"], f"Re: {t['subject']} [{ticket_id}]",
                           f"Support replied: {reply['message']}")
    return {"success": True}


# ------------------------------------------------------- admin: bookings
@router.get("/admin/bookings")
async def admin_bookings(module: str = "consultation", page: int = 1, per_page: int = 20,
                         status: str = "", booking_id: str = "", customer: str = "",
                         provider: str = "", date_from: str = "", date_to: str = "",
                         x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    coll = Db.mp_consultations if module == "consultation" else Db.mp_home_bookings
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if booking_id:
        q["booking_id"] = {"$regex": booking_id, "$options": "i"}
    if customer:
        q["customer.email"] = {"$regex": customer, "$options": "i"}
    if provider:
        key = "doctor_id" if module == "consultation" else "partner_id"
        q[key] = {"$regex": provider, "$options": "i"}
    if date_from:
        q.setdefault("date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("date", {})["$lte"] = date_to
    total = await coll.count_documents(q)
    items = await coll.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("/admin/bookings/{module}/{booking_id}/action")
async def admin_booking_action(module: str, booking_id: str, body: Dict[str, Any], x_admin_token: str = Header(None)):
    await _check_admin(x_admin_token)
    coll = Db.mp_consultations if module == "consultation" else Db.mp_home_bookings
    b = await coll.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    action = body.get("action")
    if action == "mark_paid":
        await coll.update_one({"booking_id": booking_id}, {"$set": {"payment_status": "paid", "status": "confirmed",
                                                                    "paid_by": "admin_manual", "updated_at": mp.now()}})
        await mp.notify("customer", b["customer"]["email"], "Booking confirmed",
                        f"Your booking {booking_id} is confirmed.", "/my/bookings")
    elif action == "cancel":
        await coll.update_one({"booking_id": booking_id}, {"$set": {"status": "cancelled", "updated_at": mp.now(),
                                                                    "cancel_reason": body.get("reason", "")}})
        await mp.notify("customer", b["customer"]["email"], "Booking cancelled",
                        f"Your booking {booking_id} was cancelled. {body.get('reason','')}", "/my/bookings")
    elif action == "rebroadcast" and module == "home":
        from routes.mp_ops import broadcast_offers
        await coll.update_one({"booking_id": booking_id}, {"$set": {"status": "pending_assignment", "partner_id": None}})
        await broadcast_offers({**b, "status": "pending_assignment", "partner_id": None})
    else:
        raise HTTPException(400, "Unsupported action")
    await mp.audit("admin", f"booking:{action}", module, booking_id, reason=body.get("reason", ""))
    return {"success": True}


# ================================================================ provider onboarding (/pro)
class ProviderRegisterIn(BaseModel):
    role: str
    name: str
    email: str
    mobile: str = ""


@router.post("/provider/register")
async def provider_register(body: ProviderRegisterIn):
    if body.role not in ("doctor", "partner"):
        raise HTTPException(400, "role must be doctor|partner")
    email = body.email.lower()
    coll = Db.mp_doctors if body.role == "doctor" else Db.mp_partners
    email_key = "personal.email" if body.role == "doctor" else "applicant.email"
    existing = await coll.find_one({email_key: email,
                                    "application_status": {"$in": ["pending", "approved", "info_requested"]}})
    if existing:
        raise HTTPException(409, "An application already exists for this email — log in instead.")
    await Db.mp_accounts.update_one(
        {"role": body.role, "email": email},
        {"$set": {"name": body.name, "mobile": body.mobile},
         "$setOnInsert": {"account_id": mp.uid("acc"), "role": body.role, "email": email,
                          "created_at": mp.now(), "ref_id": None, "email_verified": False}},
        upsert=True)
    code = mp.otp_code()
    import datetime as _dt
    await Db.mp_otps.update_one(
        {"email": email, "role": body.role},
        {"$set": {"otp_hash": mp.hash_otp(code), "attempts": 0,
                  "expires_at": (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(minutes=10)).isoformat()}},
        upsert=True)
    sent = await mp.send_mail(email, "Celesta Glow — verify your email",
                              f"Your verification code is {code}. It expires in 10 minutes.",
                              f"<h2 style='font-family:sans-serif'>Verification code: <b>{code}</b></h2><p>Valid 10 minutes.</p>")
    return {"success": True, "email_sent": sent, "dev_otp": None if sent else code}


class ProviderVerifyIn(BaseModel):
    role: str
    email: str
    otp: str


@router.post("/provider/verify-email")
async def provider_verify_email(body: ProviderVerifyIn):
    email = body.email.lower()
    rec = await Db.mp_otps.find_one({"email": email, "role": body.role})
    if not rec or rec.get("expires_at", "") < mp.now():
        raise HTTPException(400, "Code expired — request a new one")
    if (rec.get("attempts") or 0) >= 5:
        raise HTTPException(429, "Too many attempts — request a new code")
    if rec.get("otp_hash") != mp.hash_otp(body.otp):
        await Db.mp_otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect code")
    acc = await Db.mp_accounts.find_one({"role": body.role, "email": email})
    if not acc:
        raise HTTPException(404, "Register first")
    await Db.mp_accounts.update_one({"_id": acc["_id"]}, {"$set": {"email_verified": True}})
    import secrets as _s
    import datetime as _dt
    token = _s.token_hex(24)
    await Db.mp_sessions.insert_one({"token": token, "account_id": acc.get("account_id"), "role": body.role,
                                     "expires_at": (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=14)).isoformat()})
    await Db.mp_otps.delete_one({"_id": rec["_id"]})
    return {"success": True, "token": token, "role": body.role}


async def _account_from_token(authorization: Optional[str]) -> Dict[str, Any]:
    token = (authorization or "").split()[-1] if authorization else ""
    sess = await Db.mp_sessions.find_one({"token": token})
    if not sess or sess.get("expires_at", "") < mp.now():
        raise HTTPException(401, "Session expired — log in again")
    acc = await Db.mp_accounts.find_one({"account_id": sess["account_id"]}, {"_id": 0})
    if not acc:
        raise HTTPException(401, "Account not found")
    return acc


@router.get("/provider/status")
async def provider_status(authorization: str = Header(None)):
    acc = await _account_from_token(authorization)
    coll = Db.mp_doctors if acc["role"] == "doctor" else Db.mp_partners
    email_key = "personal.email" if acc["role"] == "doctor" else "applicant.email"
    app = await coll.find_one({email_key: acc["email"]}, {"_id": 0})
    application = None
    if app:
        application = {
            "id": app.get("doctor_id") or app.get("partner_id"),
            "status": app["application_status"],
            "submitted_at": app.get("created_at"),
            "decisions": (app.get("decisions") or [])[-3:],
        }
    return {"role": acc["role"], "email": acc["email"], "name": acc.get("name"),
            "email_verified": bool(acc.get("email_verified")),
            "application": application,
            "approved": bool(app and app["application_status"] == "approved"),
            "dashboard": f"/{acc['role']}"}


@router.post("/provider/apply")
async def provider_apply_authed(body: Dict[str, Any], authorization: str = Header(None)):
    acc = await _account_from_token(authorization)
    if not acc.get("email_verified"):
        raise HTTPException(403, "Verify your email first")
    cfg = await mp.cfg()
    if acc["role"] == "doctor":
        if not cfg["dermatologist_enabled"]:
            raise HTTPException(403, "Dermatologist onboarding is currently closed")
        app = DoctorApplication(**{**body, "email": acc["email"], "name": body.get("name") or acc.get("name") or "",
                                   "mobile": body.get("mobile") or acc.get("mobile") or ""})
        existing = await Db.mp_doctors.find_one({"personal.email": acc["email"],
                                                 "application_status": {"$in": ["pending", "approved", "info_requested"]}})
        if existing:
            raise HTTPException(409, "Application already submitted")
        if not app.registration_number:
            raise HTTPException(400, "Medical registration number is required")
        doc = {
            "doctor_id": mp.uid("doc"), "application_status": "pending", "active": False,
            "personal": {"name": app.name, "mobile": app.mobile, "email": acc["email"],
                         "address": app.address, "city": app.city, "state": app.state, "pincode": app.pincode,
                         "lat": getattr(app, "lat", None), "lng": getattr(app, "lng", None)},
            "professional": {"qualification": app.qualification, "institution": app.institution,
                             "graduation_year": app.graduation_year, "postgrad": app.postgrad,
                             "specialisation": app.specialisation, "experience_years": app.experience_years,
                             "bio": app.bio, "registration_number": app.registration_number,
                             "issuing_authority": app.issuing_authority},
            "consultation": {"fee": app.fee, "duration_min": app.duration_min, "weekly_slots": app.weekly_slots,
                             "languages": app.languages, "video_enabled": app.video_enabled,
                             "followup_policy": app.followup_policy},
            "documents": [], "photo": {}, "decisions": [], "created_at": mp.now(),
        }
        await Db.mp_doctors.insert_one(doc)
        await Db.mp_accounts.update_one({"account_id": acc["account_id"]}, {"$set": {"ref_id": doc["doctor_id"]}})
        await mp.notify("admin", "all", "New dermatologist application", f"{app.name} applied", "/admin/doctors-crm")
        return {"success": True, "application_id": doc["doctor_id"], "status": "pending"}
    if not cfg["home_services_enabled"]:
        raise HTTPException(403, "Partner onboarding is currently closed")
    app = PartnerApplication(**{**body, "email": acc["email"], "name": body.get("name") or acc.get("name") or "",
                                "mobile": body.get("mobile") or acc.get("mobile") or ""})
    if not app.services:
        raise HTTPException(400, "Select at least one service from the catalogue")
    existing = await Db.mp_partners.find_one({"applicant.email": acc["email"],
                                              "application_status": {"$in": ["pending", "approved", "info_requested"]}})
    if existing:
        raise HTTPException(409, "Application already submitted")
    valid = []
    for sel in app.services:
        svc = await Db.mp_services.find_one({"service_id": sel.service_id, "status": "active"}, {"_id": 0})
        if not svc:
            raise HTTPException(400, f"Service {sel.service_id} is not an active catalogue service")
        price = sel.price if sel.price is not None else svc.get("price")
        pr = svc.get("price_range") or {}
        if pr and price is not None and not (pr.get("min", 0) <= price <= pr.get("max", 10**9)):
            raise HTTPException(400, f"Price for {svc['name']} must be within ₹{pr.get('min')}–₹{pr.get('max')}")
        valid.append({"service_id": sel.service_id, "service_name": svc["name"], "mode": sel.mode,
                      "price": price, "coverage": sel.coverage, "qualifications": sel.qualifications,
                      "approval_status": "pending"})
    doc = {
        "partner_id": mp.uid("prt"), "application_status": "pending", "active": False, "paused": False,
        "applicant": {"name": app.name, "mobile": app.mobile, "email": acc["email"],
                      "business_name": app.business_name, "applicant_type": app.applicant_type,
                      "id_proof": app.id_proof, "qualifications": app.qualifications},
        "location": {"address": app.address, "city": app.city, "state": app.state, "pincode": app.pincode,
                     "lat": app.lat, "lng": app.lng, "coverage_area": app.coverage_area},
        "payout": {"account_holder": app.account_holder, "bank_account": app.bank_account,
                   "ifsc": app.ifsc, "upi": app.upi},
        "services": valid, "documents": [], "decisions": [], "created_at": mp.now(),
    }
    await Db.mp_partners.insert_one(doc)
    await Db.mp_accounts.update_one({"account_id": acc["account_id"]}, {"$set": {"ref_id": doc["partner_id"]}})
    await mp.notify("admin", "all", "New service partner application", f"{app.name} applied", "/admin/partners-crm")
    return {"success": True, "application_id": doc["partner_id"], "status": "pending"}
