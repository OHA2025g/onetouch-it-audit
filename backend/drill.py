"""Drill-down helpers: relate enterprise risks to observations without a direct FK (seed heuristic)."""
from typing import Any, Dict, List

from db import find_many

# Risk register `category` → control `category` buckets used to surface related observations.
RISK_CATEGORY_TO_CONTROL_CATEGORIES: Dict[str, List[str]] = {
    "Cybersecurity": ["Vulnerability", "Endpoint_Security", "Network_Security", "Incident_Management", "DevSecOps"],
    "Identity": ["Access_Management"],
    "Infrastructure": ["Network_Security", "Backup"],
    "Application": ["Application_Security", "Change_Management"],
    "Cloud": ["Cloud_Security"],
    "Data": ["Data_Privacy"],
    "Vendor": ["Access_Management", "Data_Privacy"],
    "Compliance": ["Data_Privacy", "Access_Management"],
    "BCP": ["Backup"],
}


async def related_observations_for_risk(risk: Dict[str, Any], limit: int = 40) -> List[Dict[str, Any]]:
    cats = RISK_CATEGORY_TO_CONTROL_CATEGORIES.get(risk.get("category") or "", [])
    if not cats:
        return []
    controls = await find_many("controls", {"category": {"$in": cats}}, limit=300)
    cids = [c["control_id"] for c in controls if c.get("control_id")]
    if not cids:
        return []
    return await find_many(
        "observations",
        {"control_id": {"$in": cids}},
        limit=limit,
        sort=[("created_at", -1)],
    )
