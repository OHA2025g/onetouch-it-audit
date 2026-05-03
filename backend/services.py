"""Business logic: enterprise score, risk scoring, observation state machine, control testing."""
from datetime import date, datetime, timedelta, timezone
from db import db, find_many, find_one, insert_one, update_one, now_iso, new_id
from typing import Tuple


# Enterprise Score Service
ENTERPRISE_WEIGHTS = {
    'compliance': 0.20, 'cybersecurity': 0.15, 'iam': 0.15,
    'infrastructure': 0.10, 'application': 0.10, 'data_governance': 0.10,
    'vendor': 0.10, 'bcp': 0.05, 'remediation_closure': 0.05
}

SLA_DAYS = {"Critical": 7, "High": 15, "Medium": 30, "Low": 60}


async def _compliance_score() -> float:
    snaps = await find_many("compliance_snapshots")
    if not snaps:
        return 78.0
    return round(sum(s.get('readiness_pct', 0) for s in snaps) / len(snaps), 1)


async def _iam_score() -> float:
    snap = await db.iam_snapshots.find_one(sort=[("snapshot_date", -1)], projection={"_id": 0})
    if not snap:
        return 80.0
    total = max(snap.get('total_users', 1), 1)
    dormant = snap.get('dormant_users', 0)
    orphan = snap.get('orphan_users', 0)
    no_mfa = snap.get('users_without_mfa', 0)
    sod = snap.get('sod_violations', 0)
    score = 100 - (dormant / total * 30) - (orphan / total * 25) - (no_mfa / total * 25) - sod * 2
    return round(max(0, score), 1)


async def _cyber_score() -> float:
    apps = await find_many("applications")
    if not apps:
        return 75.0
    n = max(len(apps), 1)
    # Average per-app vulnerability density (not absolute total) so larger fleets aren't unfairly penalised
    avg_crit = sum(a.get('vulnerability_count_critical', 0) for a in apps) / n
    avg_high = sum(a.get('vulnerability_count_high', 0) for a in apps) / n
    # Floor at 30 to avoid 0 from extreme outliers; scale: -8 per avg crit, -2 per avg high
    score = 100 - avg_crit * 8 - avg_high * 2
    return round(max(30.0, min(100.0, score)), 1)


async def _infra_score() -> float:
    assets = await find_many("assets")
    if not assets:
        return 80.0
    avg = sum(a.get('audit_score', 75) for a in assets) / len(assets)
    return round(avg, 1)


async def _app_score() -> float:
    apps = await find_many("applications")
    if not apps:
        return 78.0
    avg = sum(a.get('audit_score', 75) for a in apps) / len(apps)
    return round(avg, 1)


async def _data_score() -> float:
    apps = await find_many("applications")
    if not apps:
        return 80.0
    classified = sum(1 for a in apps if a.get('data_sensitivity') in ('PII', 'Financial', 'Confidential'))
    pct = (classified / len(apps)) * 100 if apps else 0
    return round(min(100, 60 + pct * 0.4), 1)


async def _vendor_score() -> float:
    vendors = await find_many("vendors")
    if not vendors:
        return 80.0
    avg_risk = sum(v.get('risk_score', 30) for v in vendors) / len(vendors)
    return round(max(0, 100 - avg_risk), 1)


async def _bcp_score() -> float:
    apps = await find_many("applications")
    if not apps:
        return 70.0
    dr_ready = sum(1 for a in apps if a.get('dr_readiness'))
    pct = (dr_ready / len(apps)) * 100 if apps else 0
    return round(pct, 1)


async def _remediation_score() -> float:
    rems = await find_many("remediation")
    if not rems:
        return 75.0
    closed_on_time = sum(1 for r in rems if r.get('closure_status') == 'Closed' and r.get('sla_status') == 'On_Time')
    total = len([r for r in rems if r.get('closure_status') in ('Closed', 'In_Progress', 'Pending', 'Overdue')])
    if total == 0:
        return 75.0
    return round((closed_on_time / total) * 100, 1)


async def calculate_all_sub_scores() -> dict:
    return {
        'compliance': await _compliance_score(),
        'iam': await _iam_score(),
        'cybersecurity': await _cyber_score(),
        'infrastructure': await _infra_score(),
        'application': await _app_score(),
        'data_governance': await _data_score(),
        'vendor': await _vendor_score(),
        'bcp': await _bcp_score(),
        'remediation_closure': await _remediation_score(),
    }


async def calculate_enterprise_score() -> dict:
    sub = await calculate_all_sub_scores()
    overall = sum(sub[k] * ENTERPRISE_WEIGHTS[k] for k in ENTERPRISE_WEIGHTS)
    overall = round(overall, 1)
    band = "Critical" if overall < 60 else "Fair" if overall < 75 else "Good" if overall < 90 else "Excellent"
    # 7d trend
    trend = await score_trend_delta(7)
    trend30 = await score_trend_delta(30)
    return {
        "overall_score": overall,
        "sub_scores": sub,
        "score_band": band,
        "trend_7d": trend,
        "trend_30d": trend30,
    }


async def score_trend_delta(days: int) -> dict:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    hist = await db.score_history.find_one(
        {"entity_type": "Enterprise", "score_date": {"$lte": cutoff}},
        sort=[("score_date", -1)],
        projection={"_id": 0},
    )
    today_hist = await db.score_history.find_one(
        {"entity_type": "Enterprise"},
        sort=[("score_date", -1)],
        projection={"_id": 0},
    )
    if not hist or not today_hist:
        return {"score": 0, "delta": 0, "direction": "flat"}
    delta = round(today_hist.get('score', 0) - hist.get('score', 0), 1)
    return {
        "score": today_hist.get('score', 0),
        "delta": delta,
        "direction": "up" if delta > 0 else "down" if delta < 0 else "flat",
    }


# Risk Scoring
def get_risk_band(score: float) -> str:
    if score >= 36: return "Critical"
    if score >= 21: return "High"
    if score >= 11: return "Medium"
    return "Low"


def calculate_sla_status(severity: str, due_date_str: str | None) -> Tuple[int, str]:
    if not due_date_str:
        return 0, "Unknown"
    try:
        d = datetime.fromisoformat(due_date_str.split("T")[0]).date()
    except Exception:
        return 0, "Unknown"
    days_remaining = (d - date.today()).days
    if days_remaining < 0:
        return days_remaining, "Overdue"
    if days_remaining <= 3:
        return days_remaining, "At_Risk"
    return days_remaining, "On_Time"


# Observation state machine
TRANSITIONS = {
    'Draft': ['Submitted'],
    'Submitted': ['Response_Pending', 'Closed'],
    'Response_Pending': ['Action_Plan_Submitted'],
    'Action_Plan_Submitted': ['In_Progress'],
    'In_Progress': ['Evidence_Submitted', 'Closed'],
    'Evidence_Submitted': ['Under_Review'],
    'Under_Review': ['Closed', 'Reopened'],
    'Closed': ['Reopened'],
    'Reopened': ['In_Progress'],
}


def can_transition(current: str, new: str) -> bool:
    return new in TRANSITIONS.get(current, [])


def auto_due_date(severity: str) -> str:
    days = SLA_DAYS.get(severity, 30)
    return (date.today() + timedelta(days=days)).isoformat()


async def create_notification(recipient_id: str, ntype: str, title: str, body: str, link_url: str = "", priority: str = "Normal", related_id: str | None = None):
    await insert_one("notifications", {
        "notification_id": new_id(),
        "recipient_id": recipient_id,
        "notification_type": ntype,
        "title": title,
        "body": body,
        "link_url": link_url,
        "is_read": False,
        "priority": priority,
        "related_entity_id": related_id,
        "created_at": now_iso(),
    })
