"""Dashboard, analytics, notifications, ccm routers."""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from db import db, find_many, find_one, count, update_one, now_iso, new_id, insert_one
from auth import UserContext, get_current_user
from services import calculate_enterprise_score, calculate_all_sub_scores, get_risk_band, calculate_sla_status
from insights import build_insights

router = APIRouter()


# ============================ ENTERPRISE / CIO ============================
@router.get("/dashboard/enterprise-score")
async def enterprise_score(_user: UserContext = Depends(get_current_user)):
    res = await calculate_enterprise_score()
    res["ai_explanation"] = (
        f"Overall score is {res['overall_score']} ({res['score_band']}). "
        f"Strongest area: {max(res['sub_scores'], key=res['sub_scores'].get)} "
        f"({max(res['sub_scores'].values())}). Weakest: "
        f"{min(res['sub_scores'], key=res['sub_scores'].get)} "
        f"({min(res['sub_scores'].values())})."
    )
    return res


@router.get("/dashboard/cio-summary")
async def cio_summary(_user: UserContext = Depends(get_current_user)):
    score = await calculate_enterprise_score()
    risks = await find_many("risks", {"status": "Open"}, limit=200, sort=[("risk_score", -1)])
    obs = await find_many("observations", limit=500)
    overdue = 0
    for o in obs:
        _, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        if sla == "Overdue":
            overdue += 1

    crit_risks = sum(1 for r in risks if r.get("severity") == "Critical")
    open_obs = sum(1 for o in obs if o.get("status") not in ("Closed",))
    fin_exp = sum(r.get("financial_impact", 0) for r in risks if r.get("status") == "Open")

    vendors = await find_many("vendors")
    vendor_avg_risk = sum(v.get("risk_score", 30) for v in vendors) / max(len(vendors), 1)

    comp_snaps = await find_many("compliance_snapshots")
    comp_avg = sum(s.get("readiness_pct", 0) for s in comp_snaps) / max(len(comp_snaps), 1)

    # readiness: weighted toward observations + evidence
    readiness = round(min(100, score["overall_score"] * 0.7 + (100 - overdue) * 0.3), 1)

    return {
        "kpis": {
            "enterprise_score": score["overall_score"],
            "score_band": score["score_band"],
            "audit_readiness_pct": readiness,
            "critical_risks": crit_risks,
            "open_observations": open_obs,
            "overdue_remediations": overdue,
            "financial_exposure_inr": fin_exp,
            "compliance_score": round(comp_avg, 1),
            "vendor_risk_score": round(vendor_avg_risk, 1),
        },
        "sub_scores": score["sub_scores"],
        "trend_7d": score["trend_7d"],
        "trend_30d": score["trend_30d"],
        "top_risks": risks[:10],
        "compliance_frameworks": [
            {
                "name": s["framework"],
                "readiness": s["readiness_pct"],
                "trend": s.get("trend_delta", 0),
                "controls_passed": s.get("controls_passed", 0),
                "controls_failed": s.get("controls_failed", 0),
            } for s in comp_snaps
        ],
        "business_impact": {
            "revenue": "High" if fin_exp > 50000000 else "Medium",
            "customer": "High" if any(r.get("category") == "Data" for r in risks[:5]) else "Medium",
            "legal": "Critical" if any("DPDP" in str(r.get("title", "")) for r in risks) else "High",
            "operational": "High",
            "exposure_inr": fin_exp,
        },
    }


@router.get("/dashboard/cio-insights")
async def cio_insights(llm: bool = False, _user: UserContext = Depends(get_current_user)):
    return await build_insights(llm_enabled=llm, scope="cio")


@router.get("/dashboard/insights/{scope}")
async def scoped_insights(scope: str, llm: bool = False, _user: UserContext = Depends(get_current_user)):
    from insights import SCOPE_BUILDERS
    if scope not in SCOPE_BUILDERS:
        raise HTTPException(status_code=404, detail=f"Unknown scope: {scope}")
    return await build_insights(llm_enabled=llm, scope=scope)


@router.get("/dashboard/risk-heatmap")
async def risk_heatmap(_user: UserContext = Depends(get_current_user)):
    risks = await find_many("risks", {"status": "Open"}, limit=500)
    grid = {}
    for l in range(1, 6):
        for i in range(1, 6):
            grid[(l, i)] = {"likelihood": l, "impact": i, "count": 0, "risks": []}
    for r in risks:
        l = r.get("likelihood", 3)
        i = r.get("impact", 3)
        if (l, i) in grid:
            grid[(l, i)]["count"] += 1
            if len(grid[(l, i)]["risks"]) < 3:
                grid[(l, i)]["risks"].append({"id": r["risk_id"], "title": r["title"]})
    return list(grid.values())


@router.get("/dashboard/risk-heatmap/cell")
async def risk_heatmap_cell(
    likelihood: int = Query(..., ge=1, le=5),
    impact: int = Query(..., ge=1, le=5),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _user: UserContext = Depends(get_current_user),
):
    """Paginated risk IDs for a heatmap cell (full list; main heatmap still caps stubs at 3)."""
    risks = await find_many(
        "risks",
        {"status": "Open", "likelihood": likelihood, "impact": impact},
        limit=500,
        sort=[("risk_score", -1)],
    )
    total = len(risks)
    page = risks[skip: skip + limit]
    return {
        "likelihood": likelihood,
        "impact": impact,
        "total": total,
        "skip": skip,
        "limit": limit,
        "risks": [
            {
                "risk_id": r["risk_id"],
                "title": r.get("title"),
                "severity": r.get("severity"),
                "risk_score": r.get("risk_score"),
            }
            for r in page
        ],
    }


@router.get("/dashboard/iam/user-access-risk/{user_risk_id}")
async def get_user_access_risk(user_risk_id: str, _user: UserContext = Depends(get_current_user)):
    doc = await find_one("user_access_risks", {"risk_id": user_risk_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.get("/dashboard/iam/sod-conflict/{conflict_id}")
async def get_sod_conflict(conflict_id: str, _user: UserContext = Depends(get_current_user)):
    doc = await find_one("sod_conflicts", {"conflict_id": conflict_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.get("/dashboard/regulatory-deadline/{deadline_id}")
async def get_regulatory_deadline(deadline_id: str, _user: UserContext = Depends(get_current_user)):
    doc = await find_one("regulatory_deadlines", {"deadline_id": deadline_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.get("/dashboard/cloud-audit-result/{result_id}")
async def get_cloud_audit_result(result_id: str, _user: UserContext = Depends(get_current_user)):
    doc = await find_one("cloud_audit_results", {"result_id": result_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.get("/dashboard/identity-risk")
async def identity_risk(_user: UserContext = Depends(get_current_user)):
    snap = await db.iam_snapshots.find_one({}, sort=[("snapshot_date", -1)], projection={"_id": 0})
    if not snap:
        return {"summary": {}, "top_risky_users": [], "sod_conflicts": []}
    risky = await find_many("user_access_risks", {"snapshot_id": snap["snapshot_id"]}, limit=50)
    sod = await find_many("sod_conflicts", {"snapshot_id": snap["snapshot_id"]}, limit=50)
    snaps30 = await find_many("iam_snapshots", limit=30, sort=[("snapshot_date", -1)])
    mfa_cov = round(((snap["total_users"] - snap["users_without_mfa"]) / snap["total_users"]) * 100, 1)
    return {
        "summary": {
            "total_users": snap["total_users"],
            "active_users": snap["active_users"],
            "dormant_users": snap["dormant_users"],
            "orphan_users": snap["orphan_users"],
            "privileged_users": snap["privileged_users"],
            "users_without_mfa": snap["users_without_mfa"],
            "sod_violations": snap["sod_violations"],
            "mfa_coverage_pct": mfa_cov,
            "avg_access_review_age_days": snap["avg_access_review_age_days"],
        },
        "top_risky_users": risky,
        "sod_conflicts": sod,
        "trend_30d": [{"date": s["snapshot_date"], "dormant": s["dormant_users"], "orphan": s["orphan_users"], "no_mfa": s["users_without_mfa"]} for s in snaps30],
    }


@router.get("/dashboard/compliance-summary")
async def compliance_summary(_user: UserContext = Depends(get_current_user)):
    snaps = await find_many("compliance_snapshots")
    deadlines = await find_many("regulatory_deadlines", limit=30, sort=[("days_remaining", 1)])
    overall = sum(s["readiness_pct"] for s in snaps) / max(len(snaps), 1) if snaps else 0
    if snaps:
        weakest = min(snaps, key=lambda s: s["readiness_pct"])["framework"]
        strongest = max(snaps, key=lambda s: s["readiness_pct"])["framework"]
    else:
        weakest = strongest = "N/A"
    cross_map = []
    fw_maps = await find_many("control_framework_mapping", limit=2000)
    by_ctrl = {}
    for m in fw_maps:
        by_ctrl.setdefault(m["control_id"], set()).add(m["framework"])
    for ctrl_id, fws in by_ctrl.items():
        if len(fws) >= 3:
            ctrl = await find_one("controls", {"control_id": ctrl_id})
            if ctrl:
                cross_map.append({
                    "control_name": ctrl["control_name"],
                    "control_code": ctrl["control_code"],
                    "frameworks_satisfied": list(fws),
                    "evidence_reuse_opportunity": True,
                })
    return {
        "frameworks": snaps,
        "deadlines": deadlines,
        "overall_compliance_score": round(overall, 1),
        "weakest_framework": weakest,
        "strongest_framework": strongest,
        "control_cross_mapping": cross_map[:15],
    }


@router.get("/dashboard/application-risk")
async def application_risk(_user: UserContext = Depends(get_current_user)):
    apps = await find_many("applications", limit=200)
    crit_count = sum(1 for a in apps if a.get("criticality") == "Critical")
    vuln_crit = sum(a.get("vulnerability_count_critical", 0) for a in apps)
    vuln_high = sum(a.get("vulnerability_count_high", 0) for a in apps)
    dr_ready = sum(1 for a in apps if a.get("dr_readiness"))
    return {
        "summary": {
            "total_apps": len(apps),
            "critical_apps": crit_count,
            "vuln_critical": vuln_crit,
            "vuln_high": vuln_high,
            "dr_ready_pct": round((dr_ready / max(len(apps), 1)) * 100, 1),
        },
        "apps": apps,
    }


@router.get("/dashboard/cloud-risk")
async def cloud_risk(_user: UserContext = Depends(get_current_user)):
    results = await find_many("cloud_audit_results")
    by_provider = {r["cloud_provider"]: r for r in results}
    total_leakage = sum(r.get("cost_leakage_inr", 0) for r in results)
    total_idle = sum(r.get("idle_compute_cost_inr", 0) for r in results)
    monthly = sum(r.get("monthly_spend_inr", 0) for r in results)
    misconfigs_total = sum(
        r.get("public_buckets", 0) + r.get("unencrypted_resources", 0) +
        r.get("public_ips", 0) + r.get("weak_iam_policies", 0) +
        r.get("security_group_misconfigs", 0)
        for r in results
    )
    return {
        "summary": {
            "monthly_spend_inr": monthly,
            "cost_leakage_inr": total_leakage,
            "idle_compute_inr": total_idle,
            "total_misconfigs": misconfigs_total,
        },
        "by_provider": by_provider,
        "results": results,
    }


@router.get("/dashboard/vendor-risk")
async def vendor_risk(_user: UserContext = Depends(get_current_user)):
    vendors = await find_many("vendors", limit=200, sort=[("risk_score", -1)])
    today = date.today()
    expiring_soon = 0
    sla_breaches = sum(1 for v in vendors if v.get("sla_score", 100) < 80)
    expired_soc = 0
    for v in vendors:
        try:
            ce = datetime.fromisoformat(v["contract_end"].split("T")[0]).date()
            if 0 <= (ce - today).days <= 30:
                expiring_soon += 1
        except Exception:
            pass
        try:
            se = datetime.fromisoformat(v["soc2_expiry"].split("T")[0]).date()
            if se < today:
                expired_soc += 1
        except Exception:
            pass
    return {
        "summary": {
            "total": len(vendors),
            "critical": sum(1 for v in vendors if v.get("criticality") == "Critical"),
            "sla_breaches": sla_breaches,
            "expiring_contracts_30d": expiring_soon,
            "expired_soc2": expired_soc,
        },
        "vendors": vendors,
    }


@router.get("/dashboard/remediation-summary")
async def remediation_summary(_user: UserContext = Depends(get_current_user)):
    rems = await find_many("remediation", limit=500)
    obs = await find_many("observations", limit=500)
    by_sev = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for r in rems:
        if r.get("closure_status") not in ("Closed",):
            by_sev[r.get("priority", "Medium")] = by_sev.get(r.get("priority", "Medium"), 0) + 1

    overdue = sum(1 for r in rems if r.get("sla_status") == "Overdue")
    closed_on_time = sum(1 for r in rems if r.get("closure_status") == "Closed" and r.get("sla_status") == "On_Time")
    closed_count = sum(1 for r in rems if r.get("closure_status") == "Closed")
    on_time_rate = round((closed_on_time / max(closed_count, 1)) * 100, 1) if closed_count else 0

    # owner perf
    owners = {}
    for r in rems:
        oid = r.get("owner_id") or "unassigned"
        owners.setdefault(oid, {"assigned": 0, "closed": 0, "overdue": 0})
        owners[oid]["assigned"] += 1
        if r.get("closure_status") == "Closed":
            owners[oid]["closed"] += 1
        if r.get("sla_status") == "Overdue":
            owners[oid]["overdue"] += 1
    perf = []
    for oid, stats in owners.items():
        u = await find_one("users", {"user_id": oid})
        perf.append({
            "owner_id": None if oid == "unassigned" else oid,
            "owner_name": u.get("name") if u else "Unassigned",
            **stats,
            "on_time_pct": round((stats["closed"] / max(stats["assigned"], 1)) * 100, 1)
        })

    overdue_obs = []
    for o in obs:
        _, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        if sla == "Overdue":
            o["sla_status"] = sla
            overdue_obs.append(o)

    return {
        "open_by_severity": by_sev,
        "overdue_count": overdue,
        "on_time_closure_rate": on_time_rate,
        "sla_breaches": overdue,
        "reopened_count": sum(1 for o in obs if o.get("status") == "Reopened"),
        "top_overdue": overdue_obs[:10],
        "owner_performance": perf,
    }


@router.get("/dashboard/business-impact")
async def business_impact(_user: UserContext = Depends(get_current_user)):
    risks = await find_many("risks", {"status": "Open"})
    by_cat = {}
    for r in risks:
        cat = r.get("category", "Other")
        by_cat.setdefault(cat, {"category": cat, "estimated_loss_inr": 0, "count": 0, "expected_loss_inr": 0})
        loss = r.get("financial_impact", 0)
        prob = (r.get("likelihood", 3) * r.get("impact", 3)) / 25.0
        by_cat[cat]["estimated_loss_inr"] += loss
        by_cat[cat]["count"] += 1
        by_cat[cat]["expected_loss_inr"] += loss * prob
    total = sum(c["estimated_loss_inr"] for c in by_cat.values())
    return {
        "financial_exposure_total_inr": total,
        "exposure_by_category": list(by_cat.values()),
        "revenue_critical_systems_at_risk": sum(1 for r in risks if r.get("category") in ("Application", "Cloud", "Cybersecurity")),
        "customer_impact_estimate": int(total / 1000),
    }


# ============================ ANALYTICS ============================
@router.get("/analytics/score-trend")
async def score_trend(days: int = 90, _user: UserContext = Depends(get_current_user)):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    hist = await find_many("score_history", {"entity_type": "Enterprise", "score_date": {"$gte": cutoff}}, limit=500, sort=[("score_date", 1)])
    return hist


@router.get("/analytics/audit-readiness-prediction")
async def readiness_prediction(_user: UserContext = Depends(get_current_user)):
    score = await calculate_enterprise_score()
    current = score["overall_score"]
    obs = await find_many("observations")
    closure_rate = (sum(1 for o in obs if o.get("status") == "Closed") / max(len(obs), 1)) * 100
    predicted_30d = round(min(100, current + (closure_rate / 100) * 5), 1)
    return {
        "current_readiness": current,
        "predicted_30d": predicted_30d,
        "required_closures_to_reach_80pct": max(0, int((80 - current) * 3)),
        "current_closure_rate_pct": round(closure_rate, 1),
    }


@router.get("/analytics/control-failure-patterns")
async def control_failure_patterns(_user: UserContext = Depends(get_current_user)):
    obs = await find_many("observations", limit=500)
    by_code = {}
    for o in obs:
        code = o.get("control_code", "UNKNOWN")
        by_code.setdefault(code, {"control_code": code, "failure_count": 0})
        by_code[code]["failure_count"] += 1
    return sorted(by_code.values(), key=lambda x: -x["failure_count"])[:20]


@router.get("/analytics/department-risk-ranking")
async def dept_risk_ranking(_user: UserContext = Depends(get_current_user)):
    depts = await find_many("departments")
    entities = await find_many("audit_entities")
    by_dept = {d["department_id"]: {"department_name": d["department_name"], "total_risk": 0, "entity_count": 0} for d in depts}
    by_dept["unassigned"] = {"department_name": "Unassigned", "total_risk": 0, "entity_count": 0}
    for e in entities:
        # crude: assign based on owner's department
        oid = e.get("business_owner_id")
        if oid:
            u = await find_one("users", {"user_id": oid})
            did = u.get("department_id") if u else None
            target = by_dept.get(did, by_dept["unassigned"])
        else:
            target = by_dept["unassigned"]
        target["total_risk"] += e.get("risk_score", 0)
        target["entity_count"] += 1
    out = sorted(by_dept.values(), key=lambda x: -x["total_risk"])
    return out


# ============================ NOTIFICATIONS ============================
@router.get("/notifications")
async def list_notifications(unread_only: bool = False, user: UserContext = Depends(get_current_user)):
    q = {"recipient_id": user.user_id}
    if unread_only:
        q["is_read"] = False
    return await find_many("notifications", q, limit=100, sort=[("created_at", -1)])


@router.get("/notifications/unread-count")
async def unread_count(user: UserContext = Depends(get_current_user)):
    c = await count("notifications", {"recipient_id": user.user_id, "is_read": False})
    return {"count": c}


@router.post("/notifications/{nid}/mark-read")
async def mark_read(nid: str, user: UserContext = Depends(get_current_user)):
    await update_one("notifications", {"notification_id": nid, "recipient_id": user.user_id}, {"is_read": True})
    return {"ok": True}


@router.post("/notifications/mark-all-read")
async def mark_all_read(user: UserContext = Depends(get_current_user)):
    await db.notifications.update_many({"recipient_id": user.user_id, "is_read": False}, {"$set": {"is_read": True}})
    return {"ok": True}


# ============================ CCM ============================
@router.get("/ccm/alerts")
async def list_alerts(_user: UserContext = Depends(get_current_user)):
    return await find_many("ccm_alerts", limit=100, sort=[("created_at", -1)])


@router.post("/ccm/alerts/{aid}/acknowledge")
async def ack_alert(aid: str, user: UserContext = Depends(get_current_user)):
    await update_one("ccm_alerts", {"alert_id": aid}, {"acknowledged_by": user.user_id, "acknowledged_at": now_iso()})
    return {"ok": True}


@router.get("/ccm/monitors")
async def list_monitors(_user: UserContext = Depends(get_current_user)):
    monitors = [
        {"name": "MFA Coverage Check", "control_code": "IAM-003", "frequency_minutes": 1440, "last_result": "Warning", "consecutive_failures": 1},
        {"name": "Public S3 Bucket Detector", "control_code": "CLD-001", "frequency_minutes": 60, "last_result": "Fail", "consecutive_failures": 3},
        {"name": "Backup Job Success Monitor", "control_code": "BCK-001", "frequency_minutes": 1440, "last_result": "Warning", "consecutive_failures": 1},
        {"name": "Privileged Access Approval", "control_code": "IAM-001", "frequency_minutes": 1440, "last_result": "Pass", "consecutive_failures": 0},
        {"name": "Patch Compliance", "control_code": "END-002", "frequency_minutes": 1440, "last_result": "Warning", "consecutive_failures": 2},
        {"name": "SoD Violation Scanner", "control_code": "IAM-005", "frequency_minutes": 10080, "last_result": "Fail", "consecutive_failures": 1},
        {"name": "Dormant User Increase", "control_code": "IAM-002", "frequency_minutes": 10080, "last_result": "Pass", "consecutive_failures": 0},
    ]
    return monitors
