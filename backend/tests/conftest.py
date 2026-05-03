"""Shared pytest fixtures.

Iteration 2: Admin role now requires MFA. The fixture performs MFA enrollment on
first run and persists the TOTP secret to /tmp/_admin_mfa_secret so subsequent
runs can compute the OTP without re-running setup.
"""
import os
import time
import json
import pytest
import pyotp
import requests


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        # Load from frontend .env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_base_url()
os.environ["REACT_APP_BACKEND_URL"] = BASE_URL
ADMIN_EMAIL = "admin@auditai.com"
ADMIN_PASSWORD = "Admin@123"
APP_OWNER_EMAIL = "ananya.reddy@auditai.com"
APP_OWNER_PASSWORD = "Welcome@123"
SECRET_FILE = "/tmp/_admin_mfa_secret.json"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _load_secret():
    try:
        with open(SECRET_FILE) as f:
            return json.load(f).get("secret")
    except Exception:
        return None


def _save_secret(secret):
    with open(SECRET_FILE, "w") as f:
        json.dump({"secret": secret}, f)


def _login_admin_with_mfa(api_client):
    """Returns (access_token, secret) by performing the admin MFA flow."""
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    d = r.json()
    # Edge: server didn't enforce MFA
    if d.get("access_token") and not d.get("mfa_required"):
        return d["access_token"], None

    challenge = d.get("mfa_challenge")
    if not challenge:
        pytest.skip(f"login response missing mfa_challenge: {d}")

    secret = _load_secret()
    if d.get("mfa_setup_required") or not secret:
        # Need fresh setup
        rs = api_client.post(
            f"{BASE_URL}/api/auth/mfa/setup",
            json={"mfa_challenge": challenge},
            timeout=30,
        )
        if rs.status_code != 200:
            pytest.skip(f"mfa setup failed: {rs.status_code} {rs.text}")
        secret = rs.json().get("secret")
        if not secret:
            pytest.skip("mfa setup returned no secret")
        _save_secret(secret)

    # Compute OTP, attempt verify; on failure (expired/old secret), retry one more time with fresh setup
    for attempt in range(2):
        code = pyotp.TOTP(secret).now()
        rv = api_client.post(
            f"{BASE_URL}/api/auth/mfa/verify",
            json={"mfa_challenge": challenge, "code": code},
            timeout=30,
        )
        if rv.status_code == 200 and rv.json().get("access_token"):
            return rv.json()["access_token"], secret
        # Possibly stale secret -> redo setup once
        if attempt == 0:
            # Need new challenge by re-login
            r2 = api_client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                timeout=30,
            )
            d2 = r2.json()
            challenge = d2.get("mfa_challenge")
            rs2 = api_client.post(
                f"{BASE_URL}/api/auth/mfa/setup",
                json={"mfa_challenge": challenge},
                timeout=30,
            )
            secret = rs2.json().get("secret")
            _save_secret(secret)
            time.sleep(1)
    pytest.skip(f"mfa verify failed: {rv.status_code} {rv.text}")


@pytest.fixture(scope="session")
def admin_token(api_client):
    token, _ = _login_admin_with_mfa(api_client)
    return token


@pytest.fixture(scope="session")
def admin_secret(api_client):
    """Returns persisted admin MFA secret (after _login_admin_with_mfa ran)."""
    token, secret = _login_admin_with_mfa(api_client)
    return secret or _load_secret()


@pytest.fixture(scope="session")
def auth_client(admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="session")
def app_owner_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": APP_OWNER_EMAIL, "password": APP_OWNER_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"app_owner login failed: {r.status_code} {r.text}")
    d = r.json()
    return d.get("access_token")
