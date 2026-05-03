"""Scoped AI-ish Insights / Recommendations / Action Items engine.

Each scope returns the same shape:
    { mode, generated_at, insights: [...], recommendations: [...], action_items: [...] }

Insight / Recommendation = { id, title, body, severity }   severity ∈ CRITICAL|WARNING|OK|HIGH|MEDIUM|LOW
Action item              = { id, title, priority (P1|P2|P3), assignee, reference, link }

Heuristic by default; LLM augmentation hook reserved behind `llm_enabled` flag.
"""
from datetime import datetime, timezone
from db import db, find_many, find_one
from services import calculate_sla_status, calculate_enterprise_score


# ============================================================ helpers
def _iso():
    return datetime.now(timezone.utc).isoformat()


def _mode(llm: bool) -> str:
    return "HEURISTIC + LLM" if llm else "HEURISTIC · LLM PAUSED"


def _short_id(s: str) -> str:
    s = str(s or "")
    return (s[:8] + "-" + s[9:13]) if len(s) >= 13 else s[:13]


async def _open_obs_with_sla():
    obs = await find_many("observations", limit=1000)
    critlike = []
    for o in obs:
        if o.get("status") in ("Closed",):
            continue
        days_rem, sla = calculate_sla_status(o.get("severity", "Medium"), o.get("due_date"))
        o["_days_rem"] = days_rem
        o["_sla"] = sla
        critlike.append(o)
    return critlike


async def _action_from_observations(obs_list, max_items=6):
    """Given list of observation dicts with _days_rem, build action_items."""
    items = []
    for o in obs_list[:max_items]:
        owner = await find_one("users", {"user_id": o.get("owner_id")}) if o.get("owner_id") else None
        owner_email = owner.get("email") if owner else "owner@auditai.com"
        days_old = abs(o.get("_days_rem", 0))
        priority = "P1" if o.get("severity") == "Critical" else "P2" if o.get("severity") == "High" else "P3"
        oid = o.get("observation_id") or o.get("_id")
        path = f"/observations/{oid}" if oid else "/observations"
        items.append({
            "id": oid or "obs",
            "title": f"Resolve {o.get('control_code') or 'OBS'} — {(o.get('title') or '')[:60]}{' (' + str(days_old) + 'd)' if days_old else ''}",
            "priority": priority,
            "assignee": owner_email,
            "reference": "exception:" + _short_id(str(oid or "")),
            "link": path,
            "deep_links": [{"type": "observation", "id": oid, "label": "Open observation", "path": path}] if oid else [],
        })
    return items


# ============================================================ CIO / global
async def _build_cio(llm: bool):
    risks = await find_many("risks", {"status": "Open"}, limit=500)
    score = await calculate_enterprise_score()
    snap = await db.iam_snapshots.find_one({}, sort=[("snapshot_date", -1)], projection={"_id": 0})
    cloud = await find_many("cloud_audit_results", limit=10)

    obs_open = await _open_obs_with_sla()
    crit_high = [o for o in obs_open if o.get("severity") in ("Critical", "High")]
    total_exposure = sum(o.get("financial_impact", 0) for o in crit_high)
    overdue = [o for o in crit_high if o.get("_sla") == "Overdue"]
    near_due = [o for o in crit_high if o.get("_sla") == "At_Risk"]

    by_cat = {}
    cat_count = {}
    for r in risks:
        c = r.get("category") or "Other"
        by_cat[c] = by_cat.get(c, 0) + r.get("financial_impact", 0)
        cat_count[c] = cat_count.get(c, 0) + 1
    top_cat = max(by_cat, key=by_cat.get) if by_cat else None

    mfa_cov_pct = 100.0
    if snap:
        total_u = max(snap.get("total_users", 1), 1)
        mfa_cov_pct = round(((total_u - snap.get("users_without_mfa", 0)) / total_u) * 100, 1)
    sod_count = snap.get("sod_violations", 0) if snap else 0
    public_buckets = sum(c.get("public_buckets", 0) for c in cloud)

    insights = []
    if total_exposure > 0:
        top_obs = sorted(crit_high, key=lambda x: -float(x.get("financial_impact") or 0))[:4]
        dlinks = []
        for o in top_obs:
            oid = o.get("observation_id")
            if oid:
                dlinks.append({
                    "type": "observation",
                    "id": oid,
                    "label": (o.get("title") or "Observation")[:56],
                    "path": f"/observations/{oid}",
                })
        insights.append({
            "id": "ins-exposure",
            "title": f"₹{int(total_exposure):,} high/critical exposure across {len(crit_high)} open exceptions",
            "body": "Aggregated from open critical + high severity findings.",
            "severity": "CRITICAL" if total_exposure > 50_00_000 else "WARNING",
            "deep_links": dlinks,
        })
    insights.append({
        "id": "ins-overdue",
        "title": f"{len(overdue)} overdue cases currently breaching SLA",
        "body": "Past-due items erode audit readiness score." if overdue else "No SLA breaches in the last cycle.",
        "severity": "CRITICAL" if len(overdue) > 5 else "WARNING" if overdue else "OK",
    })
    if top_cat:
        insights.append({
            "id": "ins-top-cat",
            "title": f"{top_cat} leads category exposure",
            "body": f"{cat_count[top_cat]} open findings, ₹{int(by_cat[top_cat]):,} at risk.",
            "severity": "WARNING",
        })
    if mfa_cov_pct < 95:
        insights.append({
            "id": "ins-mfa",
            "title": f"MFA coverage at {mfa_cov_pct}% (target ≥95%)",
            "body": f"{snap.get('users_without_mfa', 0) if snap else 0} users without MFA. Privileged users must be at 100%.",
            "severity": "CRITICAL" if mfa_cov_pct < 85 else "WARNING",
        })
    if score["overall_score"] < 75:
        insights.append({
            "id": "ins-score",
            "title": f"Enterprise score at {score['overall_score']} ({score['score_band']})",
            "body": f"Weakest area: {min(score['sub_scores'], key=score['sub_scores'].get).replace('_', ' ')}.",
            "severity": "WARNING",
        })

    recs = []
    if overdue or sum(1 for o in crit_high if o.get("severity") == "Critical") >= 3:
        recs.append({"id": "rec-escalate", "title": "Escalate top-3 critical cases", "body": "Cap SLA breaches at <5.", "severity": "HIGH"})
    weak = [k for k, v in score["sub_scores"].items() if v < 70]
    if weak:
        recs.append({"id": "rec-heatmap", "title": "Review heatmap gaps before close", "body": f"Any process scoring <70 needs owner sign-off ({len(weak)} areas).", "severity": "MEDIUM"})
    if mfa_cov_pct < 95:
        recs.append({"id": "rec-mfa", "title": "Enforce MFA on remaining privileged accounts", "body": "Push to 100% coverage for CIO/CISO/Admin roles before next audit window.", "severity": "HIGH"})
    if public_buckets > 0:
        recs.append({"id": "rec-buckets", "title": f"Block public access on {public_buckets} S3 buckets", "body": "Set BlockPublicAcls + RestrictPublicBuckets at account level.", "severity": "HIGH"})
    if sod_count > 5:
        recs.append({"id": "rec-sod", "title": f"Resolve {sod_count} SoD violations", "body": "Reassign conflicting roles in SAP & Oracle by week-close.", "severity": "MEDIUM"})

    candidates = sorted(overdue + near_due, key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(candidates, max_items=6)

    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ identity
async def _build_identity(llm: bool):
    snap = await db.iam_snapshots.find_one({}, sort=[("snapshot_date", -1)], projection={"_id": 0})
    insights, recs = [], []
    total = snap.get("total_users", 0) if snap else 0
    no_mfa = snap.get("users_without_mfa", 0) if snap else 0
    dormant = snap.get("dormant_users", 0) if snap else 0
    orphan = snap.get("orphan_users", 0) if snap else 0
    privileged = snap.get("privileged_users", 0) if snap else 0
    sod = snap.get("sod_violations", 0) if snap else 0
    mfa_pct = round((total - no_mfa) / max(total, 1) * 100, 1)

    if mfa_pct < 95:
        insights.append({"id": "id-mfa", "title": f"MFA coverage {mfa_pct}% (target ≥95%)", "body": f"{no_mfa} users still without MFA.", "severity": "CRITICAL" if mfa_pct < 85 else "WARNING"})
    if dormant > 0:
        insights.append({"id": "id-dormant", "title": f"{dormant} dormant accounts", "body": "Inactive >90 days — candidate for deprovisioning.", "severity": "WARNING" if dormant < 50 else "CRITICAL"})
    if orphan > 0:
        insights.append({"id": "id-orphan", "title": f"{orphan} orphan accounts", "body": "No active manager — elevated risk surface.", "severity": "CRITICAL" if orphan > 10 else "WARNING"})
    if sod > 0:
        insights.append({"id": "id-sod", "title": f"{sod} SoD violations", "body": "Conflicting role assignments in ERP/Finance.", "severity": "CRITICAL" if sod > 5 else "WARNING"})
    if privileged and total:
        ratio = round(privileged / total * 100, 1)
        insights.append({"id": "id-priv", "title": f"{privileged} privileged users ({ratio}% of base)", "body": "Least-privilege review recommended quarterly.", "severity": "WARNING" if ratio > 5 else "OK"})

    if mfa_pct < 100:
        recs.append({"id": "id-rec-mfa", "title": "Enforce MFA on all privileged accounts this sprint", "body": "Start with admin / CIO / CISO roles — zero tolerance.", "severity": "HIGH"})
    if dormant > 0:
        recs.append({"id": "id-rec-dormant", "title": f"Auto-disable {dormant} dormant accounts", "body": "Offboarding SLA: 24h post inactivity >90d.", "severity": "HIGH"})
    if orphan > 0:
        recs.append({"id": "id-rec-orphan", "title": f"Reassign or retire {orphan} orphan accounts", "body": "Assign manager or disable within 5 business days.", "severity": "HIGH"})
    if sod > 5:
        recs.append({"id": "id-rec-sod", "title": "Run SAP GRC role-conflict rebuild", "body": "Reassign conflicting roles to separate users.", "severity": "MEDIUM"})

    obs = await _open_obs_with_sla()
    iam_obs = [o for o in obs if (o.get("control_code") or "").startswith("IAM")]
    iam_obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(iam_obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ compliance
async def _build_compliance(llm: bool):
    snaps = await find_many("compliance_snapshots", limit=20)
    policies = await find_many("policies", limit=100)
    insights, recs = [], []
    weak = [s for s in snaps if s.get("readiness_pct", 0) < 70]
    strong = [s for s in snaps if s.get("readiness_pct", 0) >= 85]
    for s in sorted(weak, key=lambda x: x.get("readiness_pct", 0))[:3]:
        insights.append({"id": f"cmp-{s['framework']}", "title": f"{s['framework']} readiness at {s.get('readiness_pct')}%", "body": f"{s.get('controls_failed', 0)} controls failing.", "severity": "CRITICAL" if s.get("readiness_pct", 0) < 60 else "WARNING"})
    if strong:
        insights.append({"id": "cmp-strong", "title": f"{len(strong)} frameworks audit-ready (≥85%)", "body": ", ".join(s["framework"] for s in strong[:3]), "severity": "OK"})
    stale_pol = [p for p in policies if p.get("status") in ("Draft", "Under_Review")]
    if stale_pol:
        insights.append({"id": "cmp-policies", "title": f"{len(stale_pol)} policies not yet approved", "body": "Draft/review items block compliance evidence.", "severity": "WARNING"})

    if weak:
        recs.append({"id": "cmp-rec-weak", "title": f"Close gaps on weakest framework: {weak[0]['framework']}", "body": "Prioritize failing controls for current audit cycle.", "severity": "HIGH"})
    if stale_pol:
        recs.append({"id": "cmp-rec-pol", "title": f"Approve {len(stale_pol)} pending policies", "body": "Evidence review blocked until approved.", "severity": "MEDIUM"})
    recs.append({"id": "cmp-rec-reuse", "title": "Reuse cross-framework controls", "body": "Most ISO 27001 controls map to SOC 2 / DPDP — consolidate evidence.", "severity": "LOW"})

    obs = await _open_obs_with_sla()
    cmp_obs = [o for o in obs if o.get("severity") in ("Critical", "High")]
    cmp_obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(cmp_obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ applications
async def _build_applications(llm: bool):
    apps = await find_many("applications", limit=200)
    insights, recs = [], []
    high_risk = [a for a in apps if a.get("risk_score", 0) >= 70]
    high_sens = [a for a in apps if a.get("data_sensitivity") in ("Critical", "High")]
    unpatched = [a for a in apps if (a.get("vulnerabilities", {}) or {}).get("critical", 0) > 0]

    if high_risk:
        insights.append({"id": "app-hrisk", "title": f"{len(high_risk)} applications at HIGH risk (score ≥70)", "body": ", ".join(a.get("application_name", "") for a in high_risk[:3]), "severity": "CRITICAL"})
    if unpatched:
        insights.append({"id": "app-vuln", "title": f"{len(unpatched)} apps with unpatched Critical CVEs", "body": "Exploitable in <30 days — patch SLA breached.", "severity": "CRITICAL"})
    if high_sens:
        insights.append({"id": "app-sens", "title": f"{len(high_sens)} apps handling Critical/High-sensitivity data", "body": "Ensure encryption-at-rest + DLP coverage.", "severity": "WARNING"})

    if unpatched:
        recs.append({"id": "app-rec-patch", "title": "Emergency patch cycle for Critical CVEs", "body": "Prioritize internet-facing apps first.", "severity": "HIGH"})
    if high_risk:
        recs.append({"id": "app-rec-review", "title": "Quarterly app risk review with owners", "body": "Top-10 high-risk apps need mitigation plan sign-off.", "severity": "MEDIUM"})

    obs = await _open_obs_with_sla()
    app_obs = [o for o in obs if (o.get("control_code") or "").startswith(("APP", "VUL"))]
    app_obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(app_obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ cloud
async def _build_cloud(llm: bool):
    cloud = await find_many("cloud_audit_results", limit=50)
    insights, recs = [], []
    public = sum(c.get("public_buckets", 0) for c in cloud)
    unenc = sum(c.get("unencrypted_resources", 0) for c in cloud)
    unused_keys = sum(c.get("unused_iam_keys", 0) for c in cloud)
    sg_miscfg = sum(c.get("sg_misconfigurations", 0) for c in cloud)

    if public:
        insights.append({"id": "cld-pub", "title": f"{public} public S3 buckets", "body": "Internet-exposed — potential data leak.", "severity": "CRITICAL"})
    if unenc:
        insights.append({"id": "cld-enc", "title": f"{unenc} unencrypted cloud resources", "body": "Encryption-at-rest not enforced.", "severity": "WARNING"})
    if unused_keys:
        insights.append({"id": "cld-keys", "title": f"{unused_keys} unused IAM access keys", "body": "Revoke to reduce blast radius.", "severity": "WARNING"})
    if sg_miscfg:
        insights.append({"id": "cld-sg", "title": f"{sg_miscfg} security-group misconfigurations", "body": "Over-permissive ingress rules detected.", "severity": "WARNING" if sg_miscfg < 10 else "CRITICAL"})

    if public:
        recs.append({"id": "cld-rec-pub", "title": f"Block public access on {public} buckets", "body": "Apply BlockPublicAcls + RestrictPublicBuckets at account level.", "severity": "HIGH"})
    if unenc:
        recs.append({"id": "cld-rec-enc", "title": "Enforce SSE-KMS on all buckets & volumes", "body": "Deploy AWS Config rule for mandatory encryption.", "severity": "HIGH"})
    if unused_keys:
        recs.append({"id": "cld-rec-keys", "title": f"Rotate/revoke {unused_keys} stale IAM keys", "body": "Access keys unused >90 days must be deactivated.", "severity": "MEDIUM"})

    obs = await _open_obs_with_sla()
    cloud_obs = [o for o in obs if (o.get("control_code") or "").startswith("CLD")]
    cloud_obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(cloud_obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ vendors
async def _build_vendors(llm: bool):
    vendors = await find_many("vendors", limit=200)
    insights, recs = [], []
    high_risk = [v for v in vendors if v.get("risk_score", 0) >= 60]
    critical = [v for v in vendors if v.get("criticality") == "Critical"]
    expired = [v for v in vendors if v.get("dpa_signed") is False]

    if high_risk:
        insights.append({"id": "ven-hrisk", "title": f"{len(high_risk)} high-risk vendors (score ≥60)", "body": ", ".join(v.get("vendor_name", "") for v in high_risk[:3]), "severity": "CRITICAL" if len(high_risk) > 3 else "WARNING"})
    if expired:
        insights.append({"id": "ven-dpa", "title": f"{len(expired)} vendors without signed DPA", "body": "Regulatory exposure under DPDP Act.", "severity": "CRITICAL"})
    if critical:
        insights.append({"id": "ven-crit", "title": f"{len(critical)} vendors classified as Critical", "body": "Business continuity risk — ensure exit plans exist.", "severity": "WARNING"})

    if expired:
        recs.append({"id": "ven-rec-dpa", "title": f"Execute DPAs with {len(expired)} vendors this quarter", "body": "Blocker for DPDP Act compliance.", "severity": "HIGH"})
    if high_risk:
        recs.append({"id": "ven-rec-assess", "title": "Re-run vendor assessment on top-5 risky vendors", "body": "Include SOC 2 Type II + pen-test evidence.", "severity": "MEDIUM"})

    obs = await _open_obs_with_sla()
    ven_obs = [o for o in obs if (o.get("control_code") or "").startswith("VEN")]
    ven_obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(ven_obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ remediation
async def _build_remediation(llm: bool):
    obs = await _open_obs_with_sla()
    overdue = [o for o in obs if o.get("_sla") == "Overdue"]
    at_risk = [o for o in obs if o.get("_sla") == "At_Risk"]
    crit = [o for o in obs if o.get("severity") == "Critical"]
    insights, recs = [], []

    if overdue:
        insights.append({"id": "rem-overdue", "title": f"{len(overdue)} overdue remediations", "body": "SLA already breached — escalate to owners.", "severity": "CRITICAL"})
    if at_risk:
        insights.append({"id": "rem-risk", "title": f"{len(at_risk)} remediations at SLA risk", "body": "<7 days remaining — owner check-in required.", "severity": "WARNING"})
    if crit:
        insights.append({"id": "rem-crit", "title": f"{len(crit)} critical-severity items open", "body": "Board-visible, prioritize before month-end.", "severity": "CRITICAL" if len(crit) > 5 else "WARNING"})

    # owner leaderboard — top 3 delinquent owners
    by_owner = {}
    for o in overdue:
        by_owner[o.get("owner_id")] = by_owner.get(o.get("owner_id"), 0) + 1
    top_owners = sorted(by_owner.items(), key=lambda x: -x[1])[:3]
    if top_owners:
        insights.append({"id": "rem-owners", "title": f"Top delinquent owner holds {top_owners[0][1]} overdue items", "body": "Owner load imbalance — consider reassignment.", "severity": "WARNING"})

    recs.append({"id": "rem-rec-daily", "title": "Daily standup on overdue P1 items", "body": "15-min SRE-style standup until backlog <5.", "severity": "HIGH"})
    if overdue:
        recs.append({"id": "rem-rec-escalate", "title": f"Auto-escalate {len(overdue)} overdue to department heads", "body": "3-day escalation ladder via notification engine.", "severity": "HIGH"})

    ranked = sorted(overdue + at_risk + crit, key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(ranked, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ risks
async def _build_risks(llm: bool):
    risks = await find_many("risks", {"status": "Open"}, limit=500, sort=[("risk_score", -1)])
    insights, recs = [], []
    crit = [r for r in risks if r.get("severity") == "Critical"]
    by_cat = {}
    exp_by_cat = {}
    for r in risks:
        c = r.get("category") or "Other"
        by_cat[c] = by_cat.get(c, 0) + 1
        exp_by_cat[c] = exp_by_cat.get(c, 0) + r.get("financial_impact", 0)
    top_cat = max(exp_by_cat, key=exp_by_cat.get) if exp_by_cat else None
    total_exp = sum(r.get("financial_impact", 0) for r in risks)

    if crit:
        insights.append({"id": "risk-crit", "title": f"{len(crit)} Critical open risks", "body": f"Top: {crit[0].get('title', '')[:80]}", "severity": "CRITICAL"})
    if total_exp:
        insights.append({"id": "risk-exp", "title": f"Total financial exposure ₹{int(total_exp):,}", "body": "Probability-weighted across all open risks.", "severity": "WARNING" if total_exp > 10_00_00_000 else "OK"})
    if top_cat:
        insights.append({"id": "risk-cat", "title": f"{top_cat} leads exposure (₹{int(exp_by_cat[top_cat]):,})", "body": f"{by_cat[top_cat]} open risks in this category.", "severity": "WARNING"})

    recs.append({"id": "risk-rec-review", "title": "Monthly risk committee review", "body": "Top-10 risks need rupee-exposure sign-off.", "severity": "MEDIUM"})
    if crit:
        recs.append({"id": "risk-rec-crit", "title": f"Treatment plan for {len(crit)} Critical risks", "body": "Accept / mitigate / transfer decision within 30 days.", "severity": "HIGH"})

    # actions: top critical risks → create tracking cards
    actions = []
    for r in risks[:6]:
        actions.append({
            "id": r.get("risk_id") or "risk",
            "title": f"Review {r.get('risk_id', '')[:8]} — {(r.get('title') or '')[:60]}",
            "priority": "P1" if r.get("severity") == "Critical" else "P2",
            "assignee": (await find_one("users", {"user_id": r.get("owner_id")}) or {}).get("email", "owner@auditai.com") if r.get("owner_id") else "owner@auditai.com",
            "reference": "risk:" + _short_id(r.get("risk_id", "")),
            "link": "/risks",
        })
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ observations
async def _build_observations(llm: bool):
    obs = await _open_obs_with_sla()
    crit = [o for o in obs if o.get("severity") == "Critical"]
    high = [o for o in obs if o.get("severity") == "High"]
    overdue = [o for o in obs if o.get("_sla") == "Overdue"]
    insights, recs = [], []

    if crit:
        insights.append({"id": "obs-crit", "title": f"{len(crit)} Critical open observations", "body": "Board-visible — ensure daily status updates.", "severity": "CRITICAL"})
    if overdue:
        insights.append({"id": "obs-overdue", "title": f"{len(overdue)} observations past SLA", "body": "Erodes audit readiness score.", "severity": "CRITICAL"})
    if high:
        insights.append({"id": "obs-high", "title": f"{len(high)} High-severity observations open", "body": "Target: <10 at any time.", "severity": "WARNING" if len(high) > 10 else "OK"})

    recs.append({"id": "obs-rec-triage", "title": "Weekly triage with observation owners", "body": "Review new + transitioning observations every Monday.", "severity": "MEDIUM"})
    if overdue:
        recs.append({"id": "obs-rec-escalate", "title": "Escalate overdue to steering committee", "body": "3-week overdue → auto-escalated to CIO.", "severity": "HIGH"})

    ranked = sorted(obs, key=lambda o: (0 if o.get("severity") == "Critical" else 1 if o.get("severity") == "High" else 2, o.get("_days_rem", 999)))
    actions = await _action_from_observations(ranked, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ audits
async def _build_audits(llm: bool):
    audits = await find_many("audits", limit=200)
    insights, recs = [], []
    in_progress = [a for a in audits if a.get("status") == "In_Progress"]
    planned = [a for a in audits if a.get("status") == "Planned"]
    closed = [a for a in audits if a.get("status") == "Closed"]
    if in_progress:
        insights.append({"id": "aud-progress", "title": f"{len(in_progress)} audits currently in-progress", "body": ", ".join(a.get("audit_name", "")[:30] for a in in_progress[:3]), "severity": "WARNING"})
    if planned:
        insights.append({"id": "aud-planned", "title": f"{len(planned)} audits planned for the quarter", "body": "Coverage includes next-cycle frameworks.", "severity": "OK"})
    if closed:
        insights.append({"id": "aud-closed", "title": f"{len(closed)} audits closed this year", "body": "Archive reports for regulatory evidence.", "severity": "OK"})

    recs.append({"id": "aud-rec-plan", "title": "Lock next-quarter audit schedule", "body": "Align with regulatory deadlines (RBI, DPDP).", "severity": "MEDIUM"})
    recs.append({"id": "aud-rec-cover", "title": "Expand coverage to neglected entities", "body": "Target entities not audited in >12 months.", "severity": "LOW"})

    actions = []
    for a in (in_progress + planned)[:6]:
        actions.append({
            "id": a.get("audit_id", "aud"),
            "title": f"Advance {a.get('audit_type', '')} — {a.get('audit_name', '')[:60]}",
            "priority": "P2" if a.get("status") == "In_Progress" else "P3",
            "assignee": "auditor@auditai.com",
            "reference": "audit:" + _short_id(a.get("audit_id", "")),
            "link": "/audits",
        })
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ controls
async def _build_controls(llm: bool):
    controls = await find_many("controls", limit=500)
    obs = await _open_obs_with_sla()
    insights, recs = [], []
    failing_codes = {o.get("control_code") for o in obs if o.get("severity") in ("Critical", "High")}
    weak = [c for c in controls if c.get("control_code") in failing_codes]
    auto_controls = [c for c in controls if c.get("automation_level") == "Automated"]

    insights.append({"id": "ctrl-total", "title": f"{len(controls)} controls in library", "body": f"{len(auto_controls)} automated ({round(len(auto_controls) / max(len(controls), 1) * 100)}%).", "severity": "OK"})
    if weak:
        insights.append({"id": "ctrl-weak", "title": f"{len(weak)} controls tied to open Critical/High findings", "body": "Effectiveness review recommended.", "severity": "CRITICAL" if len(weak) > 10 else "WARNING"})
    if len(auto_controls) < len(controls) * 0.4:
        insights.append({"id": "ctrl-auto", "title": "Automation coverage below 40%", "body": "Manual controls = higher failure rate.", "severity": "WARNING"})

    recs.append({"id": "ctrl-rec-auto", "title": "Automate top-10 manual controls", "body": "Target 50%+ automation by year-end.", "severity": "MEDIUM"})
    if weak:
        recs.append({"id": "ctrl-rec-redesign", "title": "Redesign controls with recurring failures", "body": "Root-cause workshop with owner + framework SME.", "severity": "HIGH"})

    actions = []
    for c in list(weak)[:6]:
        actions.append({
            "id": c.get("control_id", "ctrl"),
            "title": f"Review control {c.get('control_code', '')} — {(c.get('control_name') or '')[:55]}",
            "priority": "P2",
            "assignee": "control-owner@auditai.com",
            "reference": "control:" + str(c.get("control_code", "")),
            "link": "/controls",
        })
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ evidence
async def _build_evidence(llm: bool):
    evs = await find_many("evidence", limit=500)
    insights, recs = [], []
    unvalidated = [e for e in evs if not e.get("ai_validation")]
    insufficient = [e for e in evs if (e.get("ai_validation") or {}).get("status") == "Insufficient"]
    stale = [e for e in evs if (e.get("ai_validation") or {}).get("freshness_score", 100) < 50]

    insights.append({"id": "evd-total", "title": f"{len(evs)} evidence artefacts on record", "body": f"{len(evs) - len(unvalidated)} validated by AI.", "severity": "OK"})
    if unvalidated:
        insights.append({"id": "evd-unval", "title": f"{len(unvalidated)} unvalidated uploads", "body": "Run AI validator on new evidence.", "severity": "WARNING"})
    if insufficient:
        insights.append({"id": "evd-insuf", "title": f"{len(insufficient)} evidence marked Insufficient", "body": "Re-collection required before audit close.", "severity": "CRITICAL" if len(insufficient) > 5 else "WARNING"})
    if stale:
        insights.append({"id": "evd-stale", "title": f"{len(stale)} stale evidence (freshness <50%)", "body": "Refresh before next audit cycle.", "severity": "WARNING"})

    if unvalidated:
        recs.append({"id": "evd-rec-val", "title": "Auto-run validator on upload", "body": "Ensure every evidence runs through AI validator on ingest.", "severity": "MEDIUM"})
    if insufficient:
        recs.append({"id": "evd-rec-recoll", "title": f"Re-collect {len(insufficient)} insufficient artefacts", "body": "Add to observation remediation plan.", "severity": "HIGH"})

    actions = []
    for e in (insufficient + stale)[:6]:
        actions.append({
            "id": e.get("evidence_id", "evd"),
            "title": f"Re-collect {(e.get('file_name') or '')[:55]}",
            "priority": "P2",
            "assignee": "evidence-owner@auditai.com",
            "reference": "evidence:" + _short_id(e.get("evidence_id", "")),
            "link": "/evidence",
        })
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ policies
async def _build_policies(llm: bool):
    pol = await find_many("policies", limit=200)
    insights, recs = [], []
    drafts = [p for p in pol if p.get("status") in ("Draft", "Under_Review")]
    approved = [p for p in pol if p.get("status") == "Approved"]
    insights.append({"id": "pol-total", "title": f"{len(pol)} policies in library", "body": f"{len(approved)} approved, {len(drafts)} pending.", "severity": "OK"})
    if drafts:
        insights.append({"id": "pol-draft", "title": f"{len(drafts)} policies awaiting approval", "body": "Blocks compliance evidence & control attestation.", "severity": "WARNING" if len(drafts) < 3 else "CRITICAL"})

    recs.append({"id": "pol-rec-cycle", "title": "Annual policy refresh cycle", "body": "Tag stale policies (>12 months) for renewal.", "severity": "MEDIUM"})
    if drafts:
        recs.append({"id": "pol-rec-approve", "title": "Close pending approvals this week", "body": "Escalate to policy owners.", "severity": "HIGH"})

    actions = []
    for p in drafts[:6]:
        actions.append({
            "id": p.get("policy_id", "pol"),
            "title": f"Approve {(p.get('policy_name') or '')[:55]}",
            "priority": "P2",
            "assignee": "policy-owner@auditai.com",
            "reference": "policy:" + _short_id(p.get("policy_id", "")),
            "link": "/policies",
        })
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ analytics (trends)
async def _build_analytics(llm: bool):
    score = await calculate_enterprise_score()
    insights, recs = [], []
    trend_7 = score.get("trend_7d", {}).get("delta", 0)
    trend_30 = score.get("trend_30d", {}).get("delta", 0)
    if trend_7 < -2:
        insights.append({"id": "ana-down", "title": f"Score dropped {abs(trend_7)} pts in 7 days", "body": "Investigate root cause — anomaly likely.", "severity": "CRITICAL"})
    elif trend_7 > 2:
        insights.append({"id": "ana-up", "title": f"Score improved {trend_7} pts in 7 days", "body": "Remediation activity trending well.", "severity": "OK"})
    else:
        insights.append({"id": "ana-flat", "title": "Score flat (±2 pts) over 7 days", "body": "Steady-state; look for structural changes.", "severity": "OK"})
    insights.append({"id": "ana-band", "title": f"Current band: {score['score_band']} ({score['overall_score']})", "body": f"30-day trend: {trend_30:+} pts.", "severity": "WARNING" if score["overall_score"] < 75 else "OK"})

    recs.append({"id": "ana-rec-forecast", "title": "Run quarterly readiness forecast", "body": "Project score trajectory to board.", "severity": "MEDIUM"})
    recs.append({"id": "ana-rec-anom", "title": "Set anomaly alert thresholds", "body": "Trigger alert if score drops >3 pts in 24h.", "severity": "LOW"})

    obs = await _open_obs_with_sla()
    obs.sort(key=lambda o: (0 if o.get("severity") == "Critical" else 1, o.get("_days_rem", 999)))
    actions = await _action_from_observations(obs, max_items=6)
    return {"mode": _mode(llm), "generated_at": _iso(), "insights": insights, "recommendations": recs, "action_items": actions}


# ============================================================ dispatcher
SCOPE_BUILDERS = {
    "cio": _build_cio,
    "identity": _build_identity,
    "compliance": _build_compliance,
    "applications": _build_applications,
    "cloud": _build_cloud,
    "vendors": _build_vendors,
    "remediation": _build_remediation,
    "risks": _build_risks,
    "observations": _build_observations,
    "audits": _build_audits,
    "controls": _build_controls,
    "evidence": _build_evidence,
    "policies": _build_policies,
    "analytics": _build_analytics,
}


async def build_insights(llm_enabled: bool = False, scope: str = "cio") -> dict:
    """Back-compat: original CIO insights call."""
    builder = SCOPE_BUILDERS.get(scope, _build_cio)
    return await builder(llm_enabled)
