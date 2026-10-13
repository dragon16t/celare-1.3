"""Iteration 2 backend tests for Celesta Glow marketplace features.

Covers: public price views, prepaid-only consult, admin token guards,
MP settings pricing config, service/doctor listings, geocoding fallback.
"""
import os
import json
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://celest-replica.preview.emergentagent.com").rstrip("/")
ADMIN_PW = "celestaglow2024"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/api/admin/login", json={"password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("admin_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token, "Content-Type": "application/json"}


# ---------- Public listings price view ----------
class TestPublicPricing:
    def test_services_have_price_mrp_discount_no_commission(self):
        r = requests.get(f"{BASE}/api/mp/services", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for s in data:
            assert "price" in s and isinstance(s["price"], (int, float))
            assert "mrp" in s and s["mrp"] >= s["price"]
            assert "discount_pct" in s and isinstance(s["discount_pct"], (int, float))
            assert "commission" not in s, "commission must NOT leak to public"
            assert s.get("price_range") in (None, "", []), "price_range must not be exposed"

    def test_doctors_have_fee_mrp_discount_no_commission(self):
        r = requests.get(f"{BASE}/api/mp/doctors", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for d in data:
            assert "fee" in d and isinstance(d["fee"], (int, float))
            assert "mrp" in d and d["mrp"] >= d["fee"]
            assert "discount_pct" in d
            assert "commission" not in d

    def test_bridal_glow_package_approved_and_visible(self):
        r = requests.get(f"{BASE}/api/mp/services", timeout=15)
        names = [s["name"] for s in r.json()]
        assert "Bridal Glow Package" in names


# ---------- Prepaid-only consult ----------
class TestPrepaidConsult:
    def test_instant_consult_returns_503_without_razorpay(self):
        # Need a doctor id
        r = requests.get(f"{BASE}/api/mp/doctors", timeout=15)
        doc = r.json()[0]
        payload = {
            "doctor_id": doc["doctor_id"],
            "name": "T User", "email": "t@x.com", "phone": "9000000001",
        }
        r2 = requests.post(f"{BASE}/api/mp/consultations/instant", json=payload, timeout=15)
        # Prepaid-only -> expect 503 when payment gateway not configured
        assert r2.status_code in (503, 409), f"got {r2.status_code}: {r2.text[:300]}"


# ---------- Admin token guard ----------
class TestAdminGuards:
    @pytest.mark.parametrize("path", [
        "/api/mp/admin/doctors",
        "/api/mp/admin/partners",
        "/api/mp/admin/config",
        "/api/mp/admin/bookings",
    ])
    def test_admin_endpoints_401_without_token(self, path):
        r = requests.get(f"{BASE}{path}", timeout=15)
        assert r.status_code in (401, 403), f"{path} returned {r.status_code}"


# ---------- Pricing settings ----------
class TestPricingSettings:
    def test_get_pricing_settings(self, admin_headers):
        r = requests.get(f"{BASE}/api/mp/admin/config", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("platform_commission_pct", "customer_fee_pct", "display_markup_pct"):
            assert k in d, f"missing {k} in config"

    def test_update_pricing_settings_roundtrip(self, admin_headers):
        r = requests.get(f"{BASE}/api/mp/admin/config", headers=admin_headers, timeout=15)
        current = r.json()
        payload = {
            "platform_commission_pct": float(current.get("platform_commission_pct", 15)),
            "customer_fee_pct": float(current.get("customer_fee_pct", 15)),
            "display_markup_pct": float(current.get("display_markup_pct", 30)),
        }
        r2 = requests.put(f"{BASE}/api/mp/admin/config", headers=admin_headers,
                          data=json.dumps(payload), timeout=15)
        assert r2.status_code in (200, 204), r2.text
        r3 = requests.get(f"{BASE}/api/mp/admin/config", headers=admin_headers, timeout=15)
        got = r3.json()
        for k, v in payload.items():
            assert float(got[k]) == v

    def test_pricing_preview(self, admin_headers):
        r = requests.get(f"{BASE}/api/mp/admin/pricing-preview",
                         headers=admin_headers, params={"base": 799}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("price") and d.get("mrp") and "discount_pct" in d


# ---------- Doctor OTP (dev_otp) ----------
class TestDoctorAuth:
    def test_doctor_send_otp_returns_dev_otp(self):
        r = requests.post(f"{BASE}/api/mp/auth/send-otp",
                          json={"email": "dr.meera@sample.celestaglow.com", "role": "doctor"},
                          timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("dev_otp") or body.get("otp"), f"no dev_otp in {body}"


# ---------- Geo OSM fallback ----------
class TestGeo:
    def test_reverse_geocode_osm_fallback(self):
        r = requests.get(f"{BASE}/api/geo/reverse-geocode", params={"lat": 12.97, "lng": 77.59}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("city") or d.get("locality") or d.get("formatted")


# ---------- Admin login/token ----------
class TestAdminLogin:
    def test_admin_login_success(self):
        r = requests.post(f"{BASE}/api/admin/login", json={"password": ADMIN_PW}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("token") or r.json().get("admin_token")

    def test_admin_login_wrong_pw(self):
        r = requests.post(f"{BASE}/api/admin/login", json={"password": "bad"}, timeout=15)
        assert r.status_code in (401, 403)
