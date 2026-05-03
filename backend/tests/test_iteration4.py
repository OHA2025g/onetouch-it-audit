"""Iteration 4: CIO Insights endpoint + MFA enforcement toggle admin settings."""
import os
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


@pytest.fixture(scope="module")
def reset_settings_default():
    """Ensure mfa_enforcement_enabled starts at False; reset to False on teardown."""
    # Log in admin (should be direct since default is False)
    r = _login("admin@auditai.com", "Admin@123")
    assert r.status_code == 200, r.text
    j = r.json()
    if j.get("mfa_required"):
        pytest.skip("Admin login unexpectedly required MFA - initial state broken")
    token = j["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    # Force default OFF
    requests.patch(f"{BASE}/admin/settings", json={"mfa_enforcement_enabled": False}, headers=h, timeout=15)
    yield token
    # Teardown: reset to False
    r2 = _login("admin@auditai.com", "Admin@123")
    if r2.status_code == 200 and not r2.json().get("mfa_required"):
        tk = r2.json()["access_token"]
        requests.patch(f"{BASE}/admin/settings",
                       json={"mfa_enforcement_enabled": False},
                       headers={"Authorization": f"Bearer {tk}"}, timeout=15)


# -------------------- Admin login direct (MFA disabled default) --------------------
def test_admin_login_direct_no_mfa(reset_settings_default):
    r = _login("admin@auditai.com", "Admin@123")
    assert r.status_code == 200
    j = r.json()
    assert j.get("mfa_required") is False
    assert "access_token" in j
    assert j["user"]["role"] == "Admin"


# -------------------- CIO insights endpoint --------------------
def test_cio_insights_shape(reset_settings_default):
    h = {"Authorization": f"Bearer {reset_settings_default}"}
    r = requests.get(f"{BASE}/dashboard/cio-insights", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ["mode", "generated_at", "insights", "recommendations", "action_items"]:
        assert k in j, f"missing key {k}"
    assert isinstance(j["insights"], list)
    assert isinstance(j["recommendations"], list)
    assert isinstance(j["action_items"], list)
    # spot-check item shape
    for it in j["insights"]:
        assert "id" in it and "title" in it and "severity" in it
    for a in j["action_items"]:
        assert "id" in a and "title" in a and "priority" in a and "assignee" in a


def test_cio_insights_requires_auth():
    r = requests.get(f"{BASE}/dashboard/cio-insights", timeout=15)
    assert r.status_code in (401, 403)


# -------------------- Admin settings GET/PATCH --------------------
def test_admin_settings_get(reset_settings_default):
    h = {"Authorization": f"Bearer {reset_settings_default}"}
    r = requests.get(f"{BASE}/admin/settings", headers=h, timeout=15)
    assert r.status_code == 200
    assert r.json().get("mfa_enforcement_enabled") is False


def test_admin_settings_non_admin_forbidden():
    r = _login("karan.malhotra@auditai.com", "Welcome@123")
    assert r.status_code == 200
    j = r.json()
    # Auditor: no MFA required
    assert j.get("mfa_required") is False
    tk = j["access_token"]
    h = {"Authorization": f"Bearer {tk}"}
    r2 = requests.get(f"{BASE}/admin/settings", headers=h, timeout=15)
    assert r2.status_code == 403
    r3 = requests.patch(f"{BASE}/admin/settings", json={"mfa_enforcement_enabled": True}, headers=h, timeout=15)
    assert r3.status_code == 403


def test_mfa_toggle_roundtrip(reset_settings_default):
    h = {"Authorization": f"Bearer {reset_settings_default}"}
    # Flip ON
    r = requests.patch(f"{BASE}/admin/settings", json={"mfa_enforcement_enabled": True}, headers=h, timeout=15)
    assert r.status_code == 200
    assert r.json().get("mfa_enforcement_enabled") is True

    # Admin login now should demand MFA
    r2 = _login("admin@auditai.com", "Admin@123")
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2.get("mfa_required") is True
    assert "mfa_challenge" in j2

    # Non-privileged role should STILL log in directly
    r3 = _login("ananya.reddy@auditai.com", "Welcome@123")
    assert r3.status_code == 200
    assert r3.json().get("mfa_required") is False

    # Flip OFF using existing admin token
    r4 = requests.patch(f"{BASE}/admin/settings", json={"mfa_enforcement_enabled": False}, headers=h, timeout=15)
    assert r4.status_code == 200
    assert r4.json().get("mfa_enforcement_enabled") is False

    # Admin direct login restored
    r5 = _login("admin@auditai.com", "Admin@123")
    assert r5.json().get("mfa_required") is False


# -------------------- Regression: existing dashboards still load --------------------
@pytest.mark.parametrize("path", [
    "/dashboard/enterprise-score",
    "/dashboard/risk-heatmap",
    "/ai/anomalies",
    "/dashboard/cio-summary",
])
def test_regression_dashboards(reset_settings_default, path):
    h = {"Authorization": f"Bearer {reset_settings_default}"}
    r = requests.get(f"{BASE}{path}", headers=h, timeout=30)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
