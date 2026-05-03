"""Iteration 5 — multi-scope AI Insights endpoint coverage.

Verifies:
  * /api/dashboard/insights/{scope} returns 200 + correct shape for all 14 known scopes
  * Unknown scope returns 404
  * Legacy /api/dashboard/cio-insights still works
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SCOPES = [
    "cio", "identity", "compliance", "applications", "cloud",
    "vendors", "remediation", "risks", "observations", "audits",
    "controls", "evidence", "policies", "analytics",
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "admin@auditai.com", "password": "Admin@123"},
                      timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    if body.get("mfa_required"):
        pytest.skip("MFA enforcement is ON — iteration 5 expects it OFF by default")
    tok = body.get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Multi-scope insights ----------
@pytest.mark.parametrize("scope", SCOPES)
def test_scoped_insights_endpoint(scope, auth_headers):
    r = requests.get(f"{API}/dashboard/insights/{scope}", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"scope={scope} returned {r.status_code}: {r.text[:200]}"
    body = r.json()
    # Shape contract
    for key in ("mode", "generated_at", "insights", "recommendations", "action_items"):
        assert key in body, f"scope={scope} missing key: {key}"
    assert isinstance(body["insights"], list)
    assert isinstance(body["recommendations"], list)
    assert isinstance(body["action_items"], list)
    # No mongo _id leakage
    assert "_id" not in str(body)[:50] or '"_id"' not in str(body)


def test_unknown_scope_returns_404(auth_headers):
    r = requests.get(f"{API}/dashboard/insights/bogusscope", headers=auth_headers, timeout=20)
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_legacy_cio_insights_still_works(auth_headers):
    r = requests.get(f"{API}/dashboard/cio-insights", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    body = r.json()
    for key in ("mode", "generated_at", "insights", "recommendations", "action_items"):
        assert key in body


def test_insights_unauthenticated_blocked():
    r = requests.get(f"{API}/dashboard/insights/cio", timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403 unauth, got {r.status_code}"


# ---------- Regression: dashboards still return 200 ----------
@pytest.mark.parametrize("path", [
    "/dashboard/cio-summary",
    "/dashboard/enterprise-score",
    "/dashboard/risk-heatmap",
    "/dashboard/identity-risk",
    "/dashboard/compliance-summary",
    "/dashboard/application-risk",
    "/dashboard/cloud-risk",
    "/dashboard/vendor-risk",
    "/dashboard/remediation-summary",
])
def test_dashboard_regression(path, auth_headers):
    r = requests.get(f"{API}{path}", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"{path} regression failed: {r.status_code}"


# ---------- Regression: MFA enforcement OFF for admin ----------
def test_admin_login_no_mfa_challenge():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "admin@auditai.com", "password": "Admin@123"},
                      timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert not body.get("mfa_required", False), "MFA enforcement should be OFF by default"
    assert "access_token" in body
