"""Core CRUD routers: auth, universe, controls, risks, observations, remediation, audits, evidence, policies, admin."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional, List
from datetime import datetime, date, timezone, timedelta
from pydantic import BaseModel
import os
import base64

from db import db, find_many, find_one, insert_one, update_one, delete_one, count, now_iso, new_id
from auth import (
    UserContext, get_current_user, require_role, require_permission,
    create_access_token, hash_password, verify_password
)
from mfa import generate_secret, qr_data_url, verify_totp, role_requires_mfa
from connectors import test_connection as test_integration_connection, run_sync as run_integration_sync
from crypto import encrypt_dict, mask_dict, decrypt_dict
from cache import get as cache_get, setex as cache_setex, delete as cache_delete
from settings_store import get_settings, update_settings, mfa_enforcement_enabled
from models import (
    LoginRequest, ChangePasswordRequest, TokenResponse, UserCreate, UserUpdate,
    EntityCreate, ApplicationCreate, VendorCreate, ControlCreate,
    RiskCreate, ObservationCreate, ObservationUpdate, RemediationCreate, RemediationUpdate,
    AuditCreate, PolicyCreate, StateTransition,
)
from services import can_transition, auto_due_date, calculate_sla_status, get_risk_band, create_notification
from drill import related_observations_for_risk

router = APIRouter()

# MFA challenge cache key prefix
_MFA_KEY = "mfa_challenge:"

# ============================ AUTH ============================
@router.post("/auth/login")
async def login(req: LoginRequest):
    user = await find_one("users", {"email": req.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("locked_until"):
        try:
            lu = datetime.fromisoformat(user["locked_until"])
            if lu > datetime.now(timezone.utc):
                raise HTTPException(status_code=423, detail="Account locked")
        except HTTPException:
            raise
        except Exception:
            pass
    if not verify_password(req.password, user["password_hash"]):
        attempts = user.get("failed_login_attempts", 0) + 1
        updates = {"failed_login_attempts": attempts}
        if attempts >= 5:
            updates["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await update_one("users", {"user_id": user["user_id"]}, updates)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    role = await find_one("roles", {"role_id": user["role_id"]})
    perms = role.get("permissions", {}) if role else {}
    role_name = user["role_name"]

    mfa_globally_on = await mfa_enforcement_enabled()
    needs_mfa = mfa_globally_on and role_requires_mfa(role_name)
    has_secret = bool(user.get("mfa_secret"))
    mfa_enabled = bool(user.get("mfa_enabled"))

    if needs_mfa:
        challenge = new_id()
        await cache_setex(_MFA_KEY + challenge, {"user_id": user["user_id"]}, ttl_seconds=600)
        return {
            "mfa_required": True,
            "mfa_challenge": challenge,
            "mfa_setup_required": not (has_secret and mfa_enabled),
            "user_email": user["email"],
            "role": role_name,
        }

    await update_one("users", {"user_id": user["user_id"]}, {
        "last_login": now_iso(), "failed_login_attempts": 0, "locked_until": None,
    })
    token = create_access_token(user["user_id"], role_name, perms, user["email"], user["name"])
    return {
        "access_token": token, "token_type": "bearer",
        "mfa_required": False,
        "user": {
            "id": user["user_id"], "name": user["name"], "email": user["email"],
            "role": role_name, "permissions": perms,
            "designation": user.get("designation"), "mfa_enabled": mfa_enabled,
        },
    }


@router.post("/auth/mfa/setup")
async def mfa_setup(body: dict):
    challenge = body.get("mfa_challenge")
    ch = await cache_get(_MFA_KEY + (challenge or ""))
    if not ch:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge")
    user = await find_one("users", {"user_id": ch["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    secret = generate_secret()
    await update_one("users", {"user_id": user["user_id"]}, {
        "mfa_secret_provisional": secret,
        "mfa_secret": None,
        "mfa_enabled": False,
    })
    return {"qr": qr_data_url(secret, user["email"]), "secret": secret}


@router.post("/auth/mfa/verify")
async def mfa_verify(body: dict):
    challenge = body.get("mfa_challenge")
    code = body.get("code")
    ch = await cache_get(_MFA_KEY + (challenge or ""))
    if not ch:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge")
    user = await find_one("users", {"user_id": ch["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    secret = user.get("mfa_secret_provisional") or user.get("mfa_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="No MFA secret available; run /auth/mfa/setup first")
    if not verify_totp(secret, code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")
    updates = {
        "mfa_secret": secret, "mfa_enabled": True, "mfa_secret_provisional": None,
        "last_login": now_iso(), "failed_login_attempts": 0, "locked_until": None,
    }
    await update_one("users", {"user_id": user["user_id"]}, updates)
    role = await find_one("roles", {"role_id": user["role_id"]})
    perms = role.get("permissions", {}) if role else {}
    token = create_access_token(user["user_id"], user["role_name"], perms, user["email"], user["name"])
    await cache_delete(_MFA_KEY + challenge)
    return {
        "access_token": token, "token_type": "bearer",
        "user": {
            "id": user["user_id"], "name": user["name"], "email": user["email"],
            "role": user["role_name"], "permissions": perms,
            "designation": user.get("designation"), "mfa_enabled": True,
        },
    }


@router.get("/auth/me")
async def get_me(user: UserContext = Depends(get_current_user)):
    u = await find_one("users", {"user_id": user.user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    role = await find_one("roles", {"role_id": u["role_id"]})
    return {
        "id": u["user_id"], "name": u["name"], "email": u["email"],
        "role": u["role_name"],
        "permissions": role.get("permissions", {}) if role else {},
        "designation": u.get("designation"),
        "mfa_enabled": u.get("mfa_enabled", False),
        "last_login": u.get("last_login"),
    }


@router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, user: UserContext = Depends(get_current_user)):
    u = await find_one("users", {"user_id": user.user_id})
    if not verify_password(req.current_password, u["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    await update_one("users", {"user_id": user.user_id}, {"password_hash": hash_password(req.new_password)})
    return {"ok": True}


@router.post("/auth/logout")
async def logout(user: UserContext = Depends(get_current_user)):
    return {"ok": True}


# ============================ UNIVERSE ============================
@router.get("/universe/entities")
async def list_entities(_user: UserContext = Depends(get_current_user)):
    return await find_many("audit_entities", limit=500)


@router.post("/universe/entities")
async def create_entity(data: EntityCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["entity_id"] = new_id()
    doc["status"] = "Active"
    doc["is_shadow_it"] = False
    doc["created_at"] = now_iso()
    return await insert_one("audit_entities", doc)


@router.get("/universe/applications")
async def list_apps(_user: UserContext = Depends(get_current_user)):
    return await find_many("applications", limit=500)


@router.get("/universe/applications/{app_id}")
async def get_application(app_id: str, _user: UserContext = Depends(get_current_user)):
    app = await find_one("applications", {"app_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Not found")
    name = (app.get("app_name") or "").lower()
    if name:
        all_obs = await find_many("observations", {}, limit=400, sort=[("created_at", -1)])
        app["related_observations"] = [o for o in all_obs if name in (o.get("title") or "").lower()][:25]
    else:
        app["related_observations"] = []
    return app


@router.post("/universe/applications")
async def create_app(data: ApplicationCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["app_id"] = new_id()
    doc["audit_score"] = 75.0
    doc["risk_score"] = 25.0
    doc["vulnerability_count_critical"] = 0
    doc["vulnerability_count_high"] = 0
    doc["vulnerability_count_medium"] = 0
    doc["dr_readiness"] = False
    doc["api_auth_enabled"] = True
    doc["logging_enabled"] = True
    doc["change_failure_rate"] = 0
    doc["created_at"] = now_iso()
    return await insert_one("applications", doc)


@router.get("/universe/assets")
async def list_assets(_user: UserContext = Depends(get_current_user)):
    return await find_many("assets", limit=500)


@router.get("/universe/vendors")
async def list_vendors(_user: UserContext = Depends(get_current_user)):
    return await find_many("vendors", limit=500)


@router.get("/universe/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, _user: UserContext = Depends(get_current_user)):
    v = await find_one("vendors", {"vendor_id": vendor_id})
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    name = (v.get("vendor_name") or "").lower()
    risks = await find_many("risks", {"status": "Open"}, limit=200)
    v["related_risks"] = [r for r in risks if name and name.split()[0] in (r.get("title") or "").lower()][:15]
    return v


@router.post("/universe/vendors")
async def create_vendor(data: VendorCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["vendor_id"] = new_id()
    doc["sla_score"] = 80.0
    doc["risk_score"] = 30.0
    doc["status"] = "Active"
    doc["dpa_signed"] = False
    doc["exit_plan"] = False
    doc["incident_count"] = 0
    doc["created_at"] = now_iso()
    return await insert_one("vendors", doc)


# ============================ CONTROLS ============================
@router.get("/controls")
async def list_controls(
    category: Optional[str] = None,
    framework: Optional[str] = None,
    control_code: Optional[str] = None,
    _user: UserContext = Depends(get_current_user),
):
    q = {}
    if category:
        q["category"] = category
    if control_code:
        q["control_code"] = control_code
    controls = await find_many("controls", q, limit=500)
    if framework:
        mapped_ids = [m["control_id"] for m in await find_many("control_framework_mapping", {"framework": framework}, limit=1000)]
        controls = [c for c in controls if c["control_id"] in mapped_ids]
    # Attach framework mappings
    all_maps = await find_many("control_framework_mapping", {}, limit=2000)
    by_ctrl = {}
    for m in all_maps:
        by_ctrl.setdefault(m["control_id"], []).append({"framework": m["framework"], "clause": m["framework_clause"]})
    for c in controls:
        c["frameworks"] = by_ctrl.get(c["control_id"], [])
    return controls


@router.get("/controls/{control_id}")
async def get_control(control_id: str, _user: UserContext = Depends(get_current_user)):
    c = await find_one("controls", {"control_id": control_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    maps = await find_many("control_framework_mapping", {"control_id": control_id}, limit=200)
    c["frameworks"] = [{"framework": m["framework"], "clause": m.get("framework_clause")} for m in maps]
    obs = await find_many("observations", {"control_id": control_id}, limit=100, sort=[("created_at", -1)])
    today = date.today()
    for o in obs:
        days_rem, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        o["days_remaining"] = days_rem
        o["sla_status"] = sla
    c["observations"] = obs
    c["observations_open_count"] = sum(1 for o in obs if o.get("status") != "Closed")
    return c


@router.post("/controls")
async def create_control(data: ControlCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    fw_mappings = doc.pop("framework_mappings", [])
    doc["control_id"] = new_id()
    doc["is_active"] = True
    doc["owner_id"] = user.user_id
    doc["created_at"] = now_iso()
    res = await insert_one("controls", doc)
    for m in fw_mappings:
        await insert_one("control_framework_mapping", {
            "mapping_id": new_id(), "control_id": doc["control_id"],
            "framework": m.get("framework"), "framework_clause": m.get("clause"),
            "requirement_description": doc["description"], "is_mandatory": True,
        })
    return res


# ============================ RISKS ============================
@router.get("/risks")
async def list_risks(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    likelihood: Optional[int] = None,
    impact: Optional[int] = None,
    heatmap_likelihood: Optional[int] = None,
    heatmap_impact: Optional[int] = None,
    _user: UserContext = Depends(get_current_user),
):
    q = {}
    if severity:
        q["severity"] = severity
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    hl = heatmap_likelihood if heatmap_likelihood is not None else likelihood
    hi = heatmap_impact if heatmap_impact is not None else impact
    if hl is not None:
        q["likelihood"] = hl
    if hi is not None:
        q["impact"] = hi
    risks = await find_many("risks", q, limit=500, sort=[("risk_score", -1)])
    for r in risks:
        r["risk_band"] = get_risk_band(r.get("risk_score", 0))
    return risks


@router.get("/risks/{risk_id}")
async def get_risk(risk_id: str, _user: UserContext = Depends(get_current_user)):
    r = await find_one("risks", {"risk_id": risk_id})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    r["risk_band"] = get_risk_band(r.get("risk_score", 0))
    related = await related_observations_for_risk(r, limit=40)
    for o in related:
        days_rem, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        o["days_remaining"] = days_rem
        o["sla_status"] = sla
    oids = [o["observation_id"] for o in related if o.get("observation_id")]
    remediations = await find_many("remediation", {"observation_id": {"$in": oids}}, limit=100) if oids else []
    r["related_observations"] = related
    r["related_remediations"] = remediations
    r["related_observations_note"] = (
        "Related observations are inferred from risk category → control categories (no direct risk_id on observations)."
    )
    return r


@router.post("/risks")
async def create_risk(data: RiskCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["risk_id"] = new_id()
    doc["risk_score"] = round(doc["likelihood"] * doc["impact"] * doc["control_weakness_factor"], 2)
    doc["status"] = "Open"
    doc["financial_impact_currency"] = "INR"
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    return await insert_one("risks", doc)


# ============================ OBSERVATIONS ============================
@router.get("/observations")
async def list_observations(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    owner_id: Optional[str] = None,
    control_id: Optional[str] = None,
    control_code: Optional[str] = None,
    sla_status: Optional[str] = None,
    user: UserContext = Depends(get_current_user),
):
    q = {}
    if status:
        q["status"] = status
    if severity:
        q["severity"] = severity
    if owner_id:
        q["owner_id"] = owner_id
    if control_id:
        q["control_id"] = control_id
    if control_code:
        q["control_code"] = control_code
    obs = await find_many("observations", q, limit=500, sort=[("created_at", -1)])
    for o in obs:
        days_rem, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        o["days_remaining"] = days_rem
        o["sla_status"] = sla
    if sla_status:
        obs = [o for o in obs if o.get("sla_status") == sla_status]
    return obs


@router.get("/observations/my-actions")
async def my_actions(user: UserContext = Depends(get_current_user)):
    obs = await find_many("observations", {"owner_id": user.user_id, "status": {"$nin": ["Closed"]}}, limit=200)
    return obs


@router.get("/observations/{obs_id}")
async def get_observation(obs_id: str, _user: UserContext = Depends(get_current_user)):
    o = await find_one("observations", {"observation_id": obs_id})
    if not o:
        raise HTTPException(status_code=404, detail="Not found")
    o["evidences"] = await find_many("evidence", {"observation_id": obs_id})
    o["remediations"] = await find_many("remediation", {"observation_id": obs_id})
    return o


@router.post("/observations")
async def create_observation(data: ObservationCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["observation_id"] = new_id()
    doc["status"] = "Submitted"
    doc["due_date"] = auto_due_date(doc["severity"])
    doc["sla_days"] = {"Critical": 7, "High": 15, "Medium": 30, "Low": 60}.get(doc["severity"], 30)
    doc["is_repeated_finding"] = False
    doc["ai_generated"] = False
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    res = await insert_one("observations", doc)
    if doc.get("owner_id"):
        await create_notification(doc["owner_id"], "Observation_Assigned",
            f"Observation: {doc['title']}",
            f"Severity {doc['severity']} due {doc['due_date']}",
            f"/observations/{doc['observation_id']}", "High", doc["observation_id"])
    return res


@router.patch("/observations/{obs_id}")
async def update_observation(obs_id: str, data: ObservationUpdate, user: UserContext = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await update_one("observations", {"observation_id": obs_id}, updates)
    return await find_one("observations", {"observation_id": obs_id})


@router.post("/observations/{obs_id}/transition")
async def transition_observation(obs_id: str, body: StateTransition, user: UserContext = Depends(get_current_user)):
    o = await find_one("observations", {"observation_id": obs_id})
    if not o:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_transition(o["status"], body.new_status):
        raise HTTPException(status_code=400, detail=f"Cannot transition {o['status']} → {body.new_status}")
    await update_one("observations", {"observation_id": obs_id}, {
        "status": body.new_status, "updated_at": now_iso()
    })
    return await find_one("observations", {"observation_id": obs_id})


# ============================ REMEDIATION ============================
@router.get("/remediation")
async def list_remediation(
    priority: Optional[str] = None,
    owner_id: Optional[str] = None,
    closure_status: Optional[str] = None,
    sla_status: Optional[str] = None,
    observation_id: Optional[str] = None,
    _user: UserContext = Depends(get_current_user),
):
    q = {}
    if priority:
        q["priority"] = priority
    if owner_id:
        q["owner_id"] = owner_id
    if closure_status:
        q["closure_status"] = closure_status
    if sla_status:
        q["sla_status"] = sla_status
    if observation_id:
        q["observation_id"] = observation_id
    return await find_many("remediation", q, limit=500, sort=[("created_at", -1)])


@router.get("/remediation/{rid}")
async def get_remediation(rid: str, _user: UserContext = Depends(get_current_user)):
    r = await find_one("remediation", {"remediation_id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    oid = r.get("observation_id")
    obs = await find_one("observations", {"observation_id": oid}) if oid else None
    r["observation"] = obs
    cid = (obs or {}).get("control_id")
    r["control"] = await find_one("controls", {"control_id": cid}) if cid else None
    return r


@router.post("/remediation")
async def create_remediation(data: RemediationCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["remediation_id"] = new_id()
    doc["progress"] = 0
    doc["closure_status"] = "Pending"
    doc["sla_status"] = "On_Time"
    doc["ai_suggested"] = False
    doc["created_at"] = now_iso()
    return await insert_one("remediation", doc)


@router.patch("/remediation/{rid}")
async def update_remediation(rid: str, data: RemediationUpdate, user: UserContext = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates.get("progress") == 100:
        updates["closure_status"] = "Closed"
        updates["closure_date"] = date.today().isoformat()
    await update_one("remediation", {"remediation_id": rid}, updates)
    return await find_one("remediation", {"remediation_id": rid})


# ============================ AUDITS ============================
@router.get("/audits")
async def list_audits(_user: UserContext = Depends(get_current_user)):
    return await find_many("audits", limit=200, sort=[("created_at", -1)])


@router.post("/audits")
async def create_audit(data: AuditCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["audit_id"] = new_id()
    doc["status"] = "Draft"
    doc["created_by"] = user.user_id
    doc["is_continuous"] = False
    doc["risk_focus_areas"] = []
    doc["created_at"] = now_iso()
    return await insert_one("audits", doc)


@router.get("/audits/{aid}/progress")
async def audit_progress(aid: str, _user: UserContext = Depends(get_current_user)):
    obs = await find_many("observations", {"audit_id": aid})
    total = len(obs) or 1
    closed = sum(1 for o in obs if o.get("status") == "Closed")
    evidence = await count("evidence", {"audit_id": aid})
    return {
        "tasks_pct": 50,
        "evidence_pct": min(100, evidence * 5),
        "controls_tested_pct": 65,
        "observations_pct": round((closed / total) * 100, 1),
        "overall_pct": round((closed / total) * 80 + 20, 1),
    }


# ============================ EVIDENCE ============================
@router.get("/evidence")
async def list_evidence(audit_id: Optional[str] = None, control_id: Optional[str] = None, _user: UserContext = Depends(get_current_user)):
    q = {}
    if audit_id: q["audit_id"] = audit_id
    if control_id: q["control_id"] = control_id
    return await find_many("evidence", q, limit=300, sort=[("created_at", -1)])


@router.post("/evidence/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    control_id: Optional[str] = Form(None),
    audit_id: Optional[str] = Form(None),
    observation_id: Optional[str] = Form(None),
    user: UserContext = Depends(get_current_user)
):
    import hashlib
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    h = hashlib.sha256(contents).hexdigest()
    eid = new_id()
    # Store under /app/backend/uploads
    storage_dir = "/app/backend/uploads"
    os.makedirs(storage_dir, exist_ok=True)
    path = os.path.join(storage_dir, f"{eid}_{file.filename}")
    with open(path, "wb") as f:
        f.write(contents)
    doc = {
        "evidence_id": eid,
        "audit_id": audit_id, "control_id": control_id,
        "observation_id": observation_id,
        "uploaded_by": user.user_id,
        "uploader_name": user.name,
        "source_type": "Manual_Upload",
        "file_name": file.filename,
        "file_url": f"/api/evidence/{eid}/download",
        "file_size_bytes": len(contents),
        "mime_type": file.content_type or "application/octet-stream",
        "evidence_date": date.today().isoformat(),
        "ai_validation_status": "Pending",
        "ai_validation_score": None,
        "hash_value": h,
        "version": 1,
        "is_superseded": False,
        "tags": [],
        "created_at": now_iso(),
    }
    return await insert_one("evidence", doc)


@router.get("/evidence/{eid}/validate-hash")
async def validate_hash(eid: str, _user: UserContext = Depends(get_current_user)):
    import hashlib
    e = await find_one("evidence", {"evidence_id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    path = f"/app/backend/uploads/{eid}_{e['file_name']}"
    if not os.path.exists(path):
        return {"match": False, "reason": "File missing"}
    with open(path, "rb") as f:
        h = hashlib.sha256(f.read()).hexdigest()
    return {"match": h == e["hash_value"], "stored_hash": e["hash_value"], "current_hash": h}


# ============================ POLICIES ============================
@router.get("/policies")
async def list_policies(_user: UserContext = Depends(get_current_user)):
    return await find_many("policies", limit=200, sort=[("created_at", -1)])


@router.get("/policies/{pid}")
async def get_policy(pid: str, _user: UserContext = Depends(get_current_user)):
    p = await find_one("policies", {"policy_id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    return p


@router.post("/policies")
async def create_policy(data: PolicyCreate, user: UserContext = Depends(get_current_user)):
    doc = data.model_dump()
    doc["policy_id"] = new_id()
    doc["status"] = "Active"
    doc["review_date"] = now_iso()
    doc["linked_control_ids"] = []
    doc["linked_framework_clauses"] = []
    doc["exception_count"] = 0
    doc["created_at"] = now_iso()
    return await insert_one("policies", doc)


# ============================ ADMIN ============================
@router.get("/admin/users")
async def list_users(user: UserContext = Depends(require_role("Admin", "CIO"))):
    users = await find_many("users", limit=500)
    for u in users:
        u.pop("password_hash", None)
    return users


@router.post("/admin/users")
async def create_user(data: UserCreate, _user: UserContext = Depends(require_role("Admin"))):
    existing = await find_one("users", {"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email exists")
    role = await find_one("roles", {"role_name": data.role_name})
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    uid = new_id()
    await insert_one("users", {
        "user_id": uid, "name": data.name, "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "department_id": data.department_id,
        "designation": data.designation,
        "role_id": role["role_id"], "role_name": data.role_name,
        "status": "active", "last_login": None, "mfa_enabled": False,
        "failed_login_attempts": 0, "locked_until": None,
        "avatar_url": None, "created_at": now_iso(),
    })
    return {"ok": True, "user_id": uid}


@router.patch("/admin/users/{uid}")
async def update_user(uid: str, data: UserUpdate, _user: UserContext = Depends(require_role("Admin"))):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "role_name" in updates:
        role = await find_one("roles", {"role_name": updates["role_name"]})
        if role:
            updates["role_id"] = role["role_id"]
    await update_one("users", {"user_id": uid}, updates)
    return {"ok": True}


@router.get("/admin/roles")
async def list_roles(_user: UserContext = Depends(get_current_user)):
    return await find_many("roles", limit=20)


@router.get("/admin/settings")
async def admin_get_settings(_user: UserContext = Depends(require_role("Admin"))):
    return await get_settings()


@router.patch("/admin/settings")
async def admin_update_settings(body: dict, _user: UserContext = Depends(require_role("Admin"))):
    return await update_settings(body or {})


@router.get("/admin/departments")
async def list_departments(_user: UserContext = Depends(get_current_user)):
    return await find_many("departments", limit=50)


@router.get("/admin/integrations")
async def list_integrations(_user: UserContext = Depends(get_current_user)):
    items = await find_many("integrations", limit=50)
    # NEVER return raw auth_config to client; always mask
    for it in items:
        it["auth_config"] = mask_dict(it.get("auth_config"))
    return items


@router.post("/admin/integrations/{iid}/test")
async def test_integration(iid: str, _user: UserContext = Depends(get_current_user)):
    res = await test_integration_connection(iid)
    return res.to_dict()


@router.post("/admin/integrations/{iid}/sync")
async def sync_integration(iid: str, _user: UserContext = Depends(require_role("Admin", "CIO", "CISO"))):
    res = await run_integration_sync(iid)
    return res.to_dict()


@router.patch("/admin/integrations/{iid}")
async def update_integration(iid: str, body: dict, _user: UserContext = Depends(require_role("Admin"))):
    allowed = {"auth_config", "is_active", "sync_frequency", "api_endpoint"}
    updates = {k: v for k, v in body.items() if k in allowed}
    # Encrypt auth_config field-level. Merge with existing so user can patch only some keys.
    if "auth_config" in updates:
        existing = await find_one("integrations", {"integration_id": iid})
        prior = existing.get("auth_config", {}) if existing else {}
        merged = dict(prior)
        for k, v in (updates["auth_config"] or {}).items():
            # Skip masked placeholder values from UI
            if v == "••• set" or v == "":
                continue
            merged[k] = v
        updates["auth_config"] = encrypt_dict(merged)
    await update_one("integrations", {"integration_id": iid}, updates)
    return {"ok": True}


@router.get("/admin/integrations/{iid}/logs")
async def integration_logs(iid: str, _user: UserContext = Depends(get_current_user)):
    return await find_many("integration_logs", {"integration_id": iid}, limit=20, sort=[("sync_started_at", -1)])
