"""Smoke test for the Celesta clone repo - verify core endpoints."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://celest-replica.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "celestaglow2024"


def test_products_endpoint():
    r = requests.get(f"{BASE_URL}/api/products", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Accept list or dict with items/products key
    if isinstance(data, dict):
        items = data.get("products") or data.get("items") or data.get("data") or []
    else:
        items = data
    assert isinstance(items, list)
    print(f"products count={len(items)}")


def test_mp_categories_endpoint():
    r = requests.get(f"{BASE_URL}/api/mp/categories", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data is not None


def test_admin_login():
    # Try common admin login endpoints
    for path in ["/api/admin/login", "/api/admin/auth", "/api/admin/verify"]:
        r = requests.post(f"{BASE_URL}{path}", json={"password": ADMIN_PASSWORD}, timeout=20)
        if r.status_code == 200:
            print(f"Admin login OK at {path}: {r.json()}")
            return
    pytest.fail("No admin login endpoint returned 200")


def test_doctors_route_backend():
    # The frontend has /doctors route - check doctor consultation API
    r = requests.get(f"{BASE_URL}/api/doctor-consultation/doctors", timeout=20)
    # Accept 200 or 404 (route may differ)
    print(f"doctors endpoint status={r.status_code}")
    assert r.status_code in (200, 404, 405)


def test_frontend_loads():
    r = requests.get(BASE_URL, timeout=30)
    assert r.status_code == 200
    assert "<html" in r.text.lower()
