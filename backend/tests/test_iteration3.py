"""Iteration 3 backend tests: Fernet encryption, cache mode, sync endpoint, MFA via cache."""
import os
import time
import pytest
import pyotp
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# -------- Health --------
def test_health_deep_cache_and_fernet(api_client):
    r = api_client.get(f"{BASE_URL}/api/health/deep", timeout=15)
    assert r.status_code == 200
    services = r.json().get("services", {})
    assert services.get("cache") in ("memory+mongo", "redis"), f"unexpected cache mode: {services}"
    assert services.get("fernet") == "configured", f"fernet status: {services}"


# -------- App_Owner: GET integrations should mask --------
def test_integrations_get_masked(app_owner_token, api_client):
    h = {"Authorization": f"Bearer {app_owner_token}"}
    r = api_client.get(f"{BASE_URL}/api/admin/integrations", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    integrations = r.json()
    assert isinstance(integrations, list) and len(integrations) > 0
    for integ in integrations:
        ac = integ.get("auth_config", {})
        for k, v in ac.items():
            # Either empty or masked - never plaintext or fernet-prefixed
            assert v in ("", "••• set"), f"unmasked value: {k}={v!r} in {integ.get('system_name')}"
            assert not (isinstance(v, str) and v.startswith("fernet:v1:"))


# -------- App_Owner role guard on /sync --------
def test_sync_forbidden_for_app_owner(app_owner_token, api_client):
    h = {"Authorization": f"Bearer {app_owner_token}"}
    r = api_client.get(f"{BASE_URL}/api/admin/integrations", headers=h, timeout=15)
    integrations = r.json()
    aws = next((i for i in integrations if "aws" in i.get("system_name", "").lower()), integrations[0])
    iid = aws["integration_id"]
    rr = api_client.post(f"{BASE_URL}/api/admin/integrations/{iid}/sync", headers=h, timeout=20)
    assert rr.status_code == 403, f"expected 403, got {rr.status_code}: {rr.text}"


# -------- Admin: PATCH encrypts auth_config (verify in Mongo) --------
def _aws_integration_id(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/admin/integrations", timeout=15)
    integrations = r.json()
    aws = next((i for i in integrations if "aws" in i.get("system_name", "").lower()), None)
    assert aws, "no AWS integration seeded"
    return aws["integration_id"]


def test_patch_integration_encrypts_at_rest(auth_client):
    iid = _aws_integration_id(auth_client)
    payload = {"auth_config": {
        "access_key_id": "AKIA-TEST",
        "secret_access_key": "SECRET-TEST",
        "region": "ap-south-1",
    }}
    r = auth_client.patch(f"{BASE_URL}/api/admin/integrations/{iid}", json=payload, timeout=15)
    assert r.status_code == 200, r.text

    # Verify Mongo doc - values must be fernet-encrypted
    cli = MongoClient(MONGO_URL)
    doc = cli[DB_NAME].integrations.find_one({"integration_id": iid})
    assert doc, "integration not found in mongo"
    ac = doc.get("auth_config", {})
    for key in ("access_key_id", "secret_access_key", "region"):
        v = ac.get(key, "")
        assert isinstance(v, str) and v.startswith("fernet:v1:"), f"{key} not encrypted: {v!r}"


def test_patch_integration_merges_partial(auth_client):
    iid = _aws_integration_id(auth_client)
    # Capture current encrypted secret_access_key
    cli = MongoClient(MONGO_URL)
    before = cli[DB_NAME].integrations.find_one({"integration_id": iid})["auth_config"]
    prior_sk = before.get("secret_access_key")
    assert prior_sk and prior_sk.startswith("fernet:v1:"), "test prerequisite: prior encrypted secret"

    # Patch only access_key_id
    r = auth_client.patch(f"{BASE_URL}/api/admin/integrations/{iid}",
                          json={"auth_config": {"access_key_id": "AKIA-NEW"}}, timeout=15)
    assert r.status_code == 200

    after = cli[DB_NAME].integrations.find_one({"integration_id": iid})["auth_config"]
    assert after["secret_access_key"] == prior_sk, "secret_access_key was not preserved"
    assert after["access_key_id"] != before.get("access_key_id"), "access_key_id was not updated"
    assert after["access_key_id"].startswith("fernet:v1:")


def test_patch_ignores_mask_placeholder(auth_client):
    iid = _aws_integration_id(auth_client)
    cli = MongoClient(MONGO_URL)
    before = cli[DB_NAME].integrations.find_one({"integration_id": iid})["auth_config"]

    # Send '••• set' - should be ignored
    r = auth_client.patch(f"{BASE_URL}/api/admin/integrations/{iid}",
                          json={"auth_config": {"secret_access_key": "••• set"}}, timeout=15)
    assert r.status_code == 200

    after = cli[DB_NAME].integrations.find_one({"integration_id": iid})["auth_config"]
    assert after["secret_access_key"] == before["secret_access_key"], "mask placeholder overwrote real value"


# -------- AWS test endpoint actually hits AWS --------
def test_aws_test_endpoint_hits_aws(auth_client):
    iid = _aws_integration_id(auth_client)
    # Ensure bogus creds set
    auth_client.patch(f"{BASE_URL}/api/admin/integrations/{iid}",
                      json={"auth_config": {"access_key_id": "AKIA-FAKE12345", "secret_access_key": "fakesecret", "region": "ap-south-1"}}, timeout=15)
    r = auth_client.post(f"{BASE_URL}/api/admin/integrations/{iid}/test", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is False
    msg = body.get("message", "").lower()
    # Real AWS error indicators
    assert any(t in msg for t in ["invalidaccesskeyid", "signature", "aws", "invalid"]), f"unexpected: {msg}"


# -------- Sync as Admin --------
def test_sync_aws_as_admin_returns_response(auth_client):
    iid = _aws_integration_id(auth_client)
    r = auth_client.post(f"{BASE_URL}/api/admin/integrations/{iid}/sync", timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "success" in body and "message" in body
    # With fake creds it should be False with AWS-side error
    if body["success"] is False:
        assert any(t in body["message"].lower() for t in ["aws", "invalid", "credential"])


def test_sync_unsupported_connector(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/admin/integrations", timeout=15)
    integrations = r.json()
    splunk = next((i for i in integrations if "splunk" in i.get("system_name", "").lower()), None)
    if not splunk:
        pytest.skip("no Splunk integration")
    iid = splunk["integration_id"]
    rr = auth_client.post(f"{BASE_URL}/api/admin/integrations/{iid}/sync", timeout=20)
    assert rr.status_code == 200
    body = rr.json()
    assert body["success"] is False
    assert "sync not supported" in body["message"].lower() or "no connector" in body["message"].lower()


# -------- Integration logs --------
def test_integration_logs_have_operation_field(auth_client):
    iid = _aws_integration_id(auth_client)
    r = auth_client.get(f"{BASE_URL}/api/admin/integrations/{iid}/logs", timeout=15)
    assert r.status_code == 200, r.text
    logs = r.json()
    assert isinstance(logs, list) and len(logs) > 0, "no logs returned"
    ops = {l.get("operation") for l in logs}
    assert ops & {"test", "sync"}, f"no test/sync operations in logs: {ops}"


# -------- MFA via cache (end-to-end after restart simulated by reading cache) --------
def test_mfa_login_flow_via_cache(api_client, admin_secret):
    if not admin_secret:
        pytest.skip("no admin mfa secret available")
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": "admin@auditai.com", "password": "Admin@123"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    challenge = d.get("mfa_challenge")
    assert challenge, f"missing mfa_challenge: {d}"

    # Verify cache key is present in Mongo kv_cache
    cli = MongoClient(MONGO_URL)
    cache_doc = cli[DB_NAME].kv_cache.find_one({"_id": f"mfa_challenge:{challenge}"})
    assert cache_doc, "MFA challenge not persisted in kv_cache"

    code = pyotp.TOTP(admin_secret).now()
    rv = api_client.post(f"{BASE_URL}/api/auth/mfa/verify",
                         json={"mfa_challenge": challenge, "code": code}, timeout=30)
    assert rv.status_code == 200, rv.text
    assert rv.json().get("access_token")


# -------- Copilot semantic search --------
def test_copilot_semantic_search_source(auth_client):
    r = auth_client.post(f"{BASE_URL}/api/copilot/chat",
                         json={"question": "What controls cover access reviews?"}, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    sources = body.get("sources", [])
    if isinstance(sources, list):
        flat = " ".join(str(s) for s in sources).lower()
    else:
        flat = str(sources).lower()
    assert "semantic_search" in flat, f"semantic_search missing: {sources}"


# -------- Regression: existing endpoints --------
@pytest.mark.parametrize("endpoint", [
    "/api/dashboard/cio-summary",
    "/api/risks",
    "/api/observations",
    "/api/controls",
    "/api/metrics",
])
def test_regression_endpoints(auth_client, endpoint):
    r = auth_client.get(f"{BASE_URL}{endpoint}", timeout=20)
    assert r.status_code == 200, f"{endpoint} -> {r.status_code}: {r.text[:200]}"


def test_app_owner_direct_login(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": "ananya.reddy@auditai.com", "password": "Welcome@123"}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("access_token")
