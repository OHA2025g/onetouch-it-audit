"""Seed script: realistic Indian enterprise IT audit demo data."""
import asyncio
import random
from datetime import date, datetime, timedelta, timezone
from db import db, now_iso, new_id, insert_one
from auth import hash_password


ROLES = [
    {"role_name": "CIO", "permissions": {"*": ["*"]}, "dashboard_access": ["all"], "description": "Chief Information Officer — full control tower access"},
    {"role_name": "CISO", "permissions": {"risks": ["read", "create", "update"], "observations": ["read", "create", "update"], "controls": ["read"], "dashboards": ["read"], "evidence": ["read"], "policies": ["read"]}, "dashboard_access": ["cyber", "identity", "cloud"], "description": "Chief Information Security Officer"},
    {"role_name": "IT_Head", "permissions": {"observations": ["read", "update"], "remediation": ["read", "create", "update"], "evidence": ["read", "create"], "dashboards": ["read"]}, "dashboard_access": ["infra", "app", "remediation"], "description": "IT Department Head"},
    {"role_name": "App_Owner", "permissions": {"observations": ["read", "update"], "evidence": ["read", "create"], "applications": ["read"]}, "dashboard_access": ["app"], "description": "Application Owner"},
    {"role_name": "Auditor", "permissions": {"audits": ["read", "create", "update"], "observations": ["read", "create", "update"], "controls": ["read", "create", "update"], "evidence": ["read", "create", "update"], "reports": ["read", "create"]}, "dashboard_access": ["all"], "description": "IT Auditor"},
    {"role_name": "Compliance_Officer", "permissions": {"controls": ["read", "create", "update"], "policies": ["read", "create", "update"], "frameworks": ["read"], "reports": ["read", "create"]}, "dashboard_access": ["compliance"], "description": "Compliance Officer"},
    {"role_name": "Board_Viewer", "permissions": {"dashboards": ["read"], "reports": ["read"]}, "dashboard_access": ["cio"], "description": "Read-only board member"},
    {"role_name": "Admin", "permissions": {"*": ["*"]}, "dashboard_access": ["all"], "description": "System administrator"},
]

DEPARTMENTS = [
    {"department_name": "Information Technology", "business_unit": "Technology"},
    {"department_name": "Finance", "business_unit": "Corporate"},
    {"department_name": "Operations", "business_unit": "Business"},
    {"department_name": "Compliance & Risk", "business_unit": "Governance"},
    {"department_name": "Human Resources", "business_unit": "Corporate"},
]

USER_NAMES = [
    ("Rohan Mehta", "rohan.mehta", "CIO"),
    ("Priya Iyer", "priya.iyer", "CISO"),
    ("Vikram Shetty", "vikram.shetty", "IT_Head"),
    ("Ananya Reddy", "ananya.reddy", "App_Owner"),
    ("Karan Malhotra", "karan.malhotra", "Auditor"),
    ("Neha Bhattacharya", "neha.b", "Compliance_Officer"),
    ("Suresh Pillai", "suresh.pillai", "Board_Viewer"),
    ("Divya Krishnamurthy", "divya.k", "App_Owner"),
    ("Arjun Gupta", "arjun.gupta", "Auditor"),
    ("Ishita Singh", "ishita.singh", "IT_Head"),
]

ENTITY_SAMPLES = [
    ("SAP S/4HANA Production", "Application", "Critical"),
    ("Oracle EBS Finance", "Application", "Critical"),
    ("Salesforce CRM", "SaaS_Tool", "High"),
    ("AWS Account - Mumbai (ap-south-1)", "Cloud_Account", "Critical"),
    ("Azure Tenant - Production", "Cloud_Account", "Critical"),
    ("Active Directory On-Prem", "Application", "Critical"),
    ("Workday HRMS", "SaaS_Tool", "High"),
    ("ServiceNow ITSM", "SaaS_Tool", "Medium"),
    ("Microsoft 365 Tenant", "SaaS_Tool", "High"),
    ("Tally Prime Financial", "Application", "High"),
    ("PostgreSQL Customer DB", "Database", "Critical"),
    ("MongoDB Atlas - Analytics", "Database", "High"),
    ("Cisco Core Firewall - DC1", "Server", "Critical"),
    ("Check Point Firewall - DR", "Server", "High"),
    ("Kubernetes Production Cluster", "Container", "Critical"),
    ("GitHub Enterprise", "SaaS_Tool", "High"),
    ("Splunk SIEM Platform", "Application", "High"),
    ("CrowdStrike Falcon EDR", "SaaS_Tool", "Critical"),
    ("Veeam Backup Server", "Server", "Critical"),
    ("Internet Banking API Gateway", "API", "Critical"),
]

APP_SAMPLES = [
    ("SAP S/4HANA", "Critical", "Financial", ["SAP", "HANA", "ABAP"], "On_Premise", 72.5, 1, 5, True),
    ("Oracle EBS", "Critical", "Financial", ["Oracle DB", "Java"], "On_Premise", 68.0, 2, 8, True),
    ("Salesforce CRM", "High", "PII", ["Apex", "Lightning"], "SaaS", 85.0, 0, 2, True),
    ("Workday HRMS", "High", "PII", ["Workday Studio"], "SaaS", 88.0, 0, 1, True),
    ("Internet Banking Portal", "Critical", "Financial", ["Java", "Spring", "React"], "Cloud", 65.0, 3, 12, False),
    ("Mobile Banking App", "Critical", "Financial", ["React Native", "Node"], "Cloud", 70.0, 2, 6, True),
    ("Customer Onboarding Portal", "High", "PII", ["Python", "Django"], "Cloud", 78.0, 1, 4, True),
    ("Payment Gateway Service", "Critical", "Financial", ["Java", "Spring Boot"], "Cloud", 82.0, 0, 3, True),
    ("Loan Management System", "Critical", "Financial", ["Java", "Oracle"], "On_Premise", 71.0, 1, 5, False),
    ("Trading Platform", "Critical", "Financial", ["C++", "Java"], "On_Premise", 76.0, 0, 4, True),
    ("HR Self-Service Portal", "Medium", "PII", ["Java", "Angular"], "Cloud", 80.0, 0, 2, True),
    ("Vendor Procurement Portal", "Medium", "Internal", ["PHP", "MySQL"], "Cloud", 73.0, 0, 3, False),
    ("Document Management", "Medium", "Confidential", ["SharePoint"], "SaaS", 84.0, 0, 1, True),
    ("Analytics Data Lake", "High", "Confidential", ["Spark", "Databricks"], "Cloud", 79.0, 0, 2, True),
    ("API Gateway - Internal", "High", "Internal", ["Kong", "NGINX"], "Cloud", 81.0, 1, 3, True),
]

VENDOR_SAMPLES = [
    ("Microsoft Azure", "Cloud Infrastructure", "Critical", "Admin", 92.0, 28.0),
    ("Amazon Web Services (AWS)", "Cloud Infrastructure", "Critical", "Admin", 94.0, 25.0),
    ("Salesforce.com Inc", "CRM SaaS", "High", "Write", 88.0, 35.0),
    ("Workday Inc", "HRMS SaaS", "High", "Write", 90.0, 30.0),
    ("ServiceNow", "ITSM SaaS", "High", "Write", 86.0, 38.0),
    ("CrowdStrike", "Endpoint Security", "Critical", "Read", 91.0, 22.0),
    ("Splunk Inc", "SIEM Platform", "High", "Read", 84.0, 40.0),
    ("Veeam Software", "Backup Solutions", "Critical", "Admin", 82.0, 45.0),
    ("Tata Communications", "Network MSP", "Critical", "Admin", 78.0, 50.0),
    ("Wipro Infotech", "IT Services", "High", "Admin", 75.0, 55.0),
]

CONTROL_SAMPLES = [
    ("IAM-001", "Privileged Access Approval", "Access_Management", "Critical", "Monthly", "All privileged access requires documented manager approval", ["Approval logs", "Access review reports"], "Unauthorized privileged access leading to data breach", [("ITGC", "ITGC-AC-01"), ("ISO27001", "A.9.2.3"), ("SOC2", "CC6.1"), ("IFC", "IFC-IT-01")]),
    ("IAM-002", "Dormant User Deactivation", "Access_Management", "High", "Monthly", "Users inactive for >90 days must be deactivated", ["AD report", "Last login logs"], "Stale accounts used for unauthorized access", [("ITGC", "ITGC-AC-02"), ("ISO27001", "A.9.2.6")]),
    ("IAM-003", "MFA Enforcement", "Access_Management", "Critical", "Continuous", "MFA required for all privileged + remote access", ["MFA configuration export"], "Account compromise via stolen credentials", [("ISO27001", "A.9.4.2"), ("RBI_IT", "RBI-AC-3"), ("DPDP", "DPDP-S-7")]),
    ("IAM-004", "Quarterly Access Review", "Access_Management", "High", "Quarterly", "Business owners must recertify all access quarterly", ["Recertification reports"], "Excessive access accumulation", [("ITGC", "ITGC-AC-03"), ("SOC2", "CC6.3")]),
    ("IAM-005", "Segregation of Duties", "Access_Management", "Critical", "Monthly", "No user shall have conflicting roles (e.g. create+approve)", ["SoD analysis report"], "Fraud risk via conflicting privileges", [("IFC", "IFC-IT-02"), ("ITGC", "ITGC-AC-04")]),
    ("CHG-001", "Change Approval Before Deployment", "Change_Management", "High", "Continuous", "All production changes require CAB approval", ["Change tickets", "Approval logs"], "Unauthorized code reaching production", [("ITGC", "ITGC-CM-01"), ("ISO27001", "A.12.1.2")]),
    ("CHG-002", "Emergency Change Review", "Change_Management", "Medium", "Monthly", "Emergency changes reviewed within 48hrs post-deployment", ["Emergency change log"], "Bypass of standard controls", [("ITGC", "ITGC-CM-02")]),
    ("CHG-003", "Code Review Mandatory", "DevSecOps", "High", "Continuous", "All code changes require peer review before merge", ["GitHub PR reviews"], "Security defects in production", [("SOC2", "CC8.1")]),
    ("BCK-001", "Backup Success Rate ≥ 95%", "Backup", "High", "Daily", "Daily backups must achieve >=95% success rate", ["Backup job reports"], "Data loss in disaster scenario", [("ISO27001", "A.12.3.1"), ("RBI_IT", "RBI-BCP-1")]),
    ("BCK-002", "Quarterly Restore Testing", "Backup", "High", "Quarterly", "Backup restoration tested every quarter", ["Restore test logs"], "Backups exist but cannot be restored", [("ISO27001", "A.12.3.1")]),
    ("VUL-001", "Critical Vuln Remediation ≤ 30d", "Vulnerability", "Critical", "Continuous", "Critical CVEs must be patched within 30 days", ["Vulnerability scan reports"], "Exploitable vulnerabilities in production", [("CERT_In", "CIN-VM-01"), ("ISO27001", "A.12.6.1")]),
    ("VUL-002", "Quarterly Pen Testing", "Vulnerability", "High", "Quarterly", "External + internal pen tests every quarter", ["Pen test reports"], "Undiscovered attack paths", [("RBI_IT", "RBI-VM-2"), ("ISO27001", "A.18.2.3")]),
    ("VUL-003", "Web Application Security Testing", "Application_Security", "High", "Quarterly", "All public web apps must undergo VAPT quarterly", ["VAPT reports"], "OWASP Top 10 vulnerabilities", [("ISO27001", "A.14.2.8")]),
    ("CLD-001", "S3 Bucket Public Access Block", "Cloud_Security", "Critical", "Continuous", "No S3 bucket shall be public unless approved", ["AWS Config rules", "S3 ACL exports"], "Data exposure via misconfigured bucket", [("ISO27001", "A.13.1.3")]),
    ("CLD-002", "Encryption At Rest", "Cloud_Security", "High", "Continuous", "All cloud storage encrypted with KMS keys", ["KMS configuration"], "Data theft via storage access", [("DPDP", "DPDP-S-3"), ("ISO27001", "A.10.1.1")]),
    ("CLD-003", "Cloud IAM Least Privilege", "Cloud_Security", "High", "Monthly", "Cloud IAM policies enforce least privilege", ["IAM policy reviews"], "Privilege escalation in cloud", [("ISO27001", "A.9.4.1")]),
    ("DAT-001", "Data Classification Tagging", "Data_Privacy", "High", "Quarterly", "All data assets tagged with classification level", ["Data inventory"], "PII handled without controls", [("DPDP", "DPDP-D-1")]),
    ("DAT-002", "PII Access Logging", "Data_Privacy", "Critical", "Continuous", "All PII data access must be logged", ["DLP audit logs"], "Untraceable PII exfiltration", [("DPDP", "DPDP-S-5")]),
    ("DAT-003", "Data Retention Policy", "Data_Privacy", "Medium", "Annual", "Data retention aligned with regulatory mandates", ["Retention policy doc"], "Regulatory penalties for over-retention", [("DPDP", "DPDP-R-1")]),
    ("INC-001", "Incident Response Plan Tested", "Incident_Management", "High", "HalfYearly", "IR plan must be tabletop tested every 6 months", ["IR drill reports"], "Slow response to real incidents", [("ISO27001", "A.16.1.5"), ("CERT_In", "CIN-IR-01")]),
    ("INC-002", "Critical Incident Reporting ≤ 6hrs", "Incident_Management", "Critical", "Continuous", "Critical incidents reported to CERT-In within 6 hours", ["Incident reports"], "Regulatory non-compliance", [("CERT_In", "CIN-IR-02")]),
    ("NET-001", "Firewall Rule Review", "Network_Security", "High", "Quarterly", "Firewall rules reviewed quarterly", ["Rule review reports"], "Stale rules allowing unwanted traffic", [("ISO27001", "A.13.1.1")]),
    ("NET-002", "Network Segmentation", "Network_Security", "High", "Annual", "Production segregated from non-prod networks", ["Network diagrams"], "Lateral movement of attackers", [("PCI-DSS-like", "Seg-1")]),
    ("END-001", "Endpoint EDR Coverage 100%", "Endpoint_Security", "Critical", "Daily", "All endpoints must have EDR agent", ["EDR coverage report"], "Undetected malware on endpoints", [("ISO27001", "A.12.2.1")]),
    ("END-002", "Critical Patch Compliance", "Endpoint_Security", "High", "Weekly", "Critical patches deployed within 7 days", ["Patch compliance report"], "Known exploits used against endpoints", [("ISO27001", "A.12.6.1")]),
    ("BCP-001", "DR Drill Annually", "BCP_DR", "Critical", "Annual", "Full DR failover test annually", ["DR drill report"], "BCP plan untested = ineffective", [("RBI_IT", "RBI-BCP-2"), ("ISO27001", "A.17.1.3")]),
    ("BCP-002", "RPO/RTO Compliance", "BCP_DR", "High", "Quarterly", "All Tier-1 systems within stated RPO/RTO", ["BCP compliance report"], "Excessive downtime during disasters", [("RBI_IT", "RBI-BCP-3")]),
    ("VEN-001", "Vendor SOC 2 Report Validity", "Access_Management", "High", "Annual", "Critical vendors must have valid SOC 2 Type II", ["SOC2 reports"], "Third-party risk exposure", [("SOC2", "CC9.2")]),
    ("VEN-002", "DPA Signed", "Data_Privacy", "Critical", "Annual", "Data Processing Agreement signed with all PII vendors", ["DPA documents"], "DPDP non-compliance", [("DPDP", "DPDP-V-1")]),
    ("APP-001", "API Authentication Mandatory", "Application_Security", "Critical", "Continuous", "All APIs must enforce authentication", ["API gateway config"], "Unauthorized API access", [("ISO27001", "A.14.1.2")]),
    ("APP-002", "Secure SDLC", "DevSecOps", "High", "Continuous", "Security gates in CI/CD pipeline", ["Pipeline configs"], "Vulnerable code in production", [("ISO27001", "A.14.2")]),
    ("LOG-001", "Centralized Logging", "Network_Security", "High", "Continuous", "All critical systems forward logs to SIEM", ["SIEM source config"], "Forensic blindness during incidents", [("ISO27001", "A.12.4.1")]),
    ("LOG-002", "Log Retention 365 Days", "Network_Security", "Medium", "Annual", "Audit logs retained for at least 1 year", ["Retention policy"], "Regulatory non-compliance", [("RBI_IT", "RBI-LOG-1")]),
]


async def seed_all(force: bool = False):
    """Seed if collections empty, or wipe+reseed if force=True."""
    if force:
        for c in ["users", "roles", "departments", "audit_entities", "applications", "assets", "vendors",
                  "controls", "control_framework_mapping", "control_tests", "risks", "observations",
                  "remediation", "audits", "audit_scope", "audit_tasks", "evidence", "iam_snapshots",
                  "user_access_risks", "sod_conflicts", "compliance_snapshots", "regulatory_deadlines",
                  "application_audit_results", "cloud_audit_results", "score_history", "ccm_alerts",
                  "ccm_control_monitors", "notifications", "policies", "copilot_conversations",
                  "integrations", "ai_usage_log"]:
            await db[c].delete_many({})

    if await db.users.count_documents({}) > 0:
        return  # idempotent

    # ROLES
    role_map = {}
    for r in ROLES:
        rid = new_id()
        role_map[r["role_name"]] = rid
        await insert_one("roles", {
            "role_id": rid, "role_name": r["role_name"],
            "permissions": r["permissions"], "dashboard_access": r["dashboard_access"],
            "description": r["description"], "created_at": now_iso(),
        })

    # DEPARTMENTS
    dept_map = {}
    for d in DEPARTMENTS:
        did = new_id()
        dept_map[d["department_name"]] = did
        await insert_one("departments", {
            "department_id": did, "department_name": d["department_name"],
            "business_unit": d["business_unit"], "head_user_id": None,
            "parent_department_id": None, "created_at": now_iso(),
        })

    # USERS
    user_map = {}
    admin_id = new_id()
    user_map["Admin"] = admin_id
    await insert_one("users", {
        "user_id": admin_id, "name": "System Admin", "email": "admin@auditai.com",
        "password_hash": hash_password("Admin@123"),
        "department_id": dept_map["Information Technology"],
        "designation": "System Administrator", "role_id": role_map["Admin"],
        "role_name": "Admin", "status": "active",
        "last_login": None, "mfa_enabled": False, "failed_login_attempts": 0,
        "locked_until": None, "avatar_url": None, "created_at": now_iso(),
    })

    for name, slug, role in USER_NAMES:
        uid = new_id()
        user_map[role + ":" + name] = uid
        await insert_one("users", {
            "user_id": uid, "name": name, "email": f"{slug}@auditai.com",
            "password_hash": hash_password("Welcome@123"),
            "department_id": dept_map["Information Technology"] if role in ("CIO", "CISO", "IT_Head") else dept_map["Compliance & Risk"] if role in ("Compliance_Officer", "Auditor") else dept_map["Operations"],
            "designation": role.replace("_", " "), "role_id": role_map[role],
            "role_name": role, "status": "active",
            "last_login": now_iso(), "mfa_enabled": role in ("CIO", "CISO"),
            "failed_login_attempts": 0, "locked_until": None,
            "avatar_url": None, "created_at": now_iso(),
        })

    user_ids = list(user_map.values())

    # ENTITIES
    entity_ids = []
    for name, etype, crit in ENTITY_SAMPLES:
        eid = new_id()
        entity_ids.append(eid)
        risk = round(random.uniform(20, 85), 1)
        await insert_one("audit_entities", {
            "entity_id": eid, "entity_name": name, "entity_type": etype,
            "business_owner_id": random.choice(user_ids),
            "it_owner_id": random.choice(user_ids),
            "criticality": crit,
            "last_audited_date": (date.today() - timedelta(days=random.randint(30, 200))).isoformat(),
            "risk_score": risk,
            "audit_frequency": random.choice(["Quarterly", "HalfYearly", "Annual"]),
            "status": "Active", "metadata": {},
            "is_shadow_it": random.random() < 0.1,
            "created_at": now_iso(),
        })

    # APPLICATIONS
    app_ids = []
    for app in APP_SAMPLES:
        aid = new_id()
        app_ids.append(aid)
        await insert_one("applications", {
            "app_id": aid, "app_name": app[0], "criticality": app[1],
            "data_sensitivity": app[2], "technology_stack": app[3],
            "environment": "Prod", "hosting_type": app[4],
            "audit_score": app[5], "risk_score": round(100 - app[5], 1),
            "vulnerability_count_critical": app[6],
            "vulnerability_count_high": app[7],
            "vulnerability_count_medium": random.randint(5, 30),
            "open_critical_bugs": random.randint(0, 5),
            "dr_readiness": app[8],
            "api_auth_enabled": True,
            "logging_enabled": True,
            "change_failure_rate": round(random.uniform(0.5, 12.0), 2),
            "last_security_test_date": (date.today() - timedelta(days=random.randint(20, 200))).isoformat(),
            "business_owner_id": random.choice(user_ids),
            "technical_owner_id": random.choice(user_ids),
            "created_at": now_iso(),
        })

    # ASSETS
    asset_types = ["Server", "Database", "Network", "VM", "Endpoint", "Container", "Storage", "Firewall"]
    asset_ids = []
    for i in range(30):
        aid = new_id()
        asset_ids.append(aid)
        await insert_one("assets", {
            "asset_id": aid,
            "asset_name": f"{random.choice(['DB', 'WEB', 'APP', 'NET', 'FW'])}-{random.choice(['MUM', 'BLR', 'DEL'])}-{random.randint(100, 999)}",
            "asset_type": random.choice(asset_types),
            "criticality": random.choice(["Critical", "High", "Medium", "Medium", "Low"]),
            "environment": random.choice(["Prod", "Prod", "UAT", "Dev"]),
            "ip_address": f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
            "data_sensitivity": random.choice(["PII", "Financial", "Confidential", "Internal"]),
            "patch_status": random.choices(["Current", "Missing_Critical", "Missing_High", "Unknown"], weights=[60, 10, 20, 10])[0],
            "backup_status": random.choices(["Enabled", "Failed", "Disabled"], weights=[80, 10, 10])[0],
            "last_scanned_date": (date.today() - timedelta(days=random.randint(1, 60))).isoformat(),
            "audit_score": round(random.uniform(55, 95), 1),
            "os_version": random.choice(["Ubuntu 22.04", "RHEL 9", "Windows Server 2022", "Windows 10"]),
            "is_shadow_it": False,
            "owner_id": random.choice(user_ids),
            "business_unit_id": random.choice(list(dept_map.values())),
            "created_at": now_iso(),
        })

    # VENDORS
    vendor_ids = []
    for v in VENDOR_SAMPLES:
        vid = new_id()
        vendor_ids.append(vid)
        soc2 = (date.today() + timedelta(days=random.randint(-90, 365))).isoformat()
        await insert_one("vendors", {
            "vendor_id": vid, "vendor_name": v[0], "service_type": v[1],
            "criticality": v[2], "data_access_level": v[3],
            "contract_start": (date.today() - timedelta(days=random.randint(180, 1000))).isoformat(),
            "contract_end": (date.today() + timedelta(days=random.randint(30, 700))).isoformat(),
            "sla_score": v[4], "risk_score": v[5],
            "status": "Active",
            "soc2_expiry": soc2,
            "pen_test_date": (date.today() - timedelta(days=random.randint(30, 400))).isoformat(),
            "dpa_signed": random.random() > 0.2,
            "exit_plan": random.random() > 0.4,
            "incident_count": random.randint(0, 4),
            "created_at": now_iso(),
        })

    # CONTROLS + framework mapping
    control_ids = []
    for c in CONTROL_SAMPLES:
        cid = new_id()
        control_ids.append(cid)
        await insert_one("controls", {
            "control_id": cid, "control_name": c[1], "control_code": c[0],
            "category": c[2], "severity": c[3], "frequency": c[4],
            "description": c[5], "evidence_required": c[6],
            "risk_if_failed": c[7],
            "testing_method": "AI_Assisted",
            "owner_id": random.choice(user_ids),
            "is_active": True,
            "created_at": now_iso(),
        })
        for fw, clause in c[8]:
            await insert_one("control_framework_mapping", {
                "mapping_id": new_id(), "control_id": cid,
                "framework": fw, "framework_clause": clause,
                "requirement_description": c[5], "is_mandatory": True,
            })

    # IAM SNAPSHOT
    for i in range(30):
        d = (date.today() - timedelta(days=i)).isoformat()
        total = random.randint(2400, 2500)
        await insert_one("iam_snapshots", {
            "snapshot_id": new_id(), "snapshot_date": d,
            "source_system": "Active Directory",
            "total_users": total,
            "active_users": int(total * 0.92),
            "dormant_users": random.randint(80, 130),
            "orphan_users": random.randint(10, 25),
            "privileged_users": random.randint(40, 70),
            "users_without_mfa": random.randint(60, 150),
            "sod_violations": random.randint(8, 18),
            "excess_roles": random.randint(15, 40),
            "temp_access_not_revoked": random.randint(5, 12),
            "avg_access_review_age_days": random.randint(40, 95),
            "metadata": {}, "created_at": now_iso(),
        })

    # USER ACCESS RISKS
    risk_users = ["raghav.sharma@auditai.com", "meera.joshi@auditai.com", "vinay.rao@auditai.com",
                  "shreya.patel@auditai.com", "abhinav.kumar@auditai.com", "tanvi.desai@auditai.com",
                  "amit.singh@auditai.com", "kavita.nair@auditai.com", "ravi.verma@auditai.com",
                  "snigdha.bose@auditai.com", "harshad.mehta@auditai.com", "ritika.kapoor@auditai.com"]
    latest_snap = await db.iam_snapshots.find_one({}, sort=[("snapshot_date", -1)], projection={"_id": 0})
    for ue in risk_users:
        await insert_one("user_access_risks", {
            "risk_id": new_id(),
            "snapshot_id": latest_snap["snapshot_id"],
            "user_email": ue,
            "user_department": random.choice(["Finance", "IT", "Operations", "Sales"]),
            "risk_level": random.choice(["Critical", "High", "High", "Medium"]),
            "issues": random.choice([
                [{"type": "dormant", "description": "Inactive 120+ days", "severity": "High"}],
                [{"type": "no_mfa", "description": "MFA not enabled", "severity": "Critical"}, {"type": "privileged", "description": "Has admin role", "severity": "High"}],
                [{"type": "orphan", "description": "Manager left org", "severity": "High"}],
                [{"type": "sod", "description": "Vendor Create + Approve Payment", "severity": "Critical"}],
            ]),
            "last_login_date": (date.today() - timedelta(days=random.randint(30, 180))).isoformat(),
            "last_review_date": (date.today() - timedelta(days=random.randint(60, 200))).isoformat(),
            "manager_email": "manager@auditai.com",
            "recommendation": "Disable account and revoke privileged access; require MFA before reactivation.",
            "created_at": now_iso(),
        })

    # SOD CONFLICTS
    for _ in range(8):
        await insert_one("sod_conflicts", {
            "conflict_id": new_id(),
            "snapshot_id": latest_snap["snapshot_id"],
            "user_email": random.choice(risk_users),
            "system": random.choice(["SAP", "Oracle EBS", "Workday"]),
            "role_1": random.choice(["Vendor Maintainer", "PR Creator", "GL Poster"]),
            "role_2": random.choice(["Payment Approver", "PO Approver", "GL Approver"]),
            "conflict_type": "Create + Approve Payment",
            "risk_level": random.choice(["Critical", "High"]),
            "status": "Open",
            "created_at": now_iso(),
        })

    # COMPLIANCE SNAPSHOTS
    frameworks = ["ISO27001", "SOC2", "DPDP", "RBI_IT", "ITGC", "SEBI_Cyber", "CERT_In", "IFC"]
    for fw in frameworks:
        readiness = round(random.uniform(58, 92), 1)
        total_c = random.randint(40, 90)
        passed = int(total_c * readiness / 100)
        await insert_one("compliance_snapshots", {
            "snapshot_id": new_id(), "framework": fw,
            "snapshot_date": date.today().isoformat(),
            "total_controls": total_c, "controls_passed": passed,
            "controls_failed": int((total_c - passed) * 0.7),
            "controls_not_tested": int((total_c - passed) * 0.3),
            "evidence_collected": int(passed * 0.9),
            "evidence_pending": int(passed * 0.1),
            "evidence_rejected": random.randint(0, 5),
            "readiness_pct": readiness,
            "trend_delta": round(random.uniform(-3, 5), 1),
            "created_at": now_iso(),
        })

    # REGULATORY DEADLINES
    deadlines_data = [
        ("RBI_IT", "RBI Cyber Security Annual Report Submission", 28),
        ("DPDP", "DPDP Annual Compliance Disclosure", 75),
        ("SEBI_Cyber", "SEBI Cyber Audit Submission", 45),
        ("CERT_In", "CERT-In Quarterly Incident Report", 12),
        ("ISO27001", "ISO 27001 Surveillance Audit", 60),
        ("SOC2", "SOC 2 Type II Audit Window Opens", 18),
        ("IFC", "IFC IT Controls Testing", -5),
        ("ITGC", "ITGC Half-Yearly Review", 5),
    ]
    for fw, name, offset in deadlines_data:
        await insert_one("regulatory_deadlines", {
            "deadline_id": new_id(), "framework": fw,
            "event_name": name,
            "due_date": (date.today() + timedelta(days=offset)).isoformat(),
            "description": f"{name} required by {fw} regulator",
            "status": "Overdue" if offset < 0 else "Upcoming",
            "assigned_to": random.choice(user_ids),
            "days_remaining": offset,
            "created_at": now_iso(),
        })

    # CLOUD AUDIT RESULTS
    for prov in ["AWS", "Azure", "GCP"]:
        await insert_one("cloud_audit_results", {
            "result_id": new_id(), "cloud_provider": prov,
            "account_id": f"acct-{random.randint(100000, 999999)}",
            "audit_date": date.today().isoformat(),
            "public_buckets": random.randint(0, 5),
            "unencrypted_resources": random.randint(2, 18),
            "public_ips": random.randint(5, 30),
            "weak_iam_policies": random.randint(3, 15),
            "unused_access_keys": random.randint(8, 25),
            "security_group_misconfigs": random.randint(4, 22),
            "zombie_resources": random.randint(10, 40),
            "cost_leakage_inr": round(random.uniform(180000, 1200000), 2),
            "monthly_spend_inr": round(random.uniform(5000000, 25000000), 2),
            "idle_compute_cost_inr": round(random.uniform(120000, 800000), 2),
            "non_compliant_regions": random.randint(0, 3),
            "audit_score": round(random.uniform(60, 88), 1),
            "created_at": now_iso(),
        })

    # RISKS
    risk_categories = ["Cybersecurity", "Identity", "Infrastructure", "Application", "Cloud", "Data", "Vendor", "Compliance", "BCP"]
    risk_titles = [
        ("Unauthorized Privileged Access in Production", "Cybersecurity", 5, 5, "Critical", 25000000, "High exposure to data breach. Regulatory fines under DPDP Act."),
        ("Critical CVE Backlog Exceeding 30 Days", "Cybersecurity", 4, 5, "Critical", 18000000, "Active exploitation possible. CERT-In compliance breached."),
        ("Public S3 Buckets with Customer PII", "Cloud", 5, 5, "Critical", 30000000, "Catastrophic data leak risk; reputational damage; DPDP penalties."),
        ("Backup Restoration Untested in 9 Months", "BCP", 4, 5, "Critical", 50000000, "Cannot recover from ransomware; regulatory non-compliance."),
        ("MFA Coverage Below 90% for Privileged Users", "Identity", 4, 4, "High", 8000000, "Account takeover via credential theft."),
        ("DPA Not Signed with Critical SaaS Vendors", "Vendor", 3, 5, "High", 12000000, "DPDP Act violation; ₹250cr fine ceiling."),
        ("SoD Violations Persisting in SAP Finance", "Application", 4, 4, "High", 6000000, "Fraud risk in financial transactions."),
        ("Dormant Privileged Accounts Not Disabled", "Identity", 3, 4, "High", 4500000, "Latent insider threat."),
        ("Network Segmentation Gaps Between Prod/UAT", "Infrastructure", 3, 4, "High", 5500000, "Lateral movement during compromise."),
        ("Critical Patch Compliance Below 80%", "Cybersecurity", 4, 4, "High", 7000000, "Known vulnerabilities exploitable."),
        ("Vendor SOC 2 Reports Expired", "Vendor", 3, 4, "High", 3500000, "Cannot evidence vendor controls."),
        ("DR Drill Not Conducted in 14 Months", "BCP", 3, 5, "High", 22000000, "BCP plan unverified."),
        ("Audit Log Retention Below 365 Days", "Compliance", 2, 4, "Medium", 1500000, "Forensic investigation impaired."),
        ("Encryption At Rest Missing for Analytics DB", "Data", 3, 4, "High", 9000000, "Confidential data exposure risk."),
        ("Shadow IT SaaS Tools Without Approval", "Compliance", 3, 3, "Medium", 2200000, "Data leakage via unsanctioned apps."),
        ("Inadequate Logging on Internet Banking API", "Application", 4, 4, "High", 11000000, "Forensic blindness during fraud event."),
        ("Privileged Access Reviews Past Due", "Identity", 3, 3, "Medium", 1800000, "Excess access accumulating."),
        ("Firewall Rule Reviews Lapsed", "Infrastructure", 2, 3, "Medium", 950000, "Stale rules expanding attack surface."),
        ("Cloud Cost Leakage from Idle Resources", "Cloud", 2, 2, "Low", 800000, "Operational waste; FinOps gap."),
        ("Code Review Coverage Inconsistent", "Application", 3, 3, "Medium", 2400000, "Security defects reaching production."),
    ]

    risk_ids = []
    for i, (title, cat, lik, imp, sev, fin, biz) in enumerate(risk_titles):
        rid = new_id()
        risk_ids.append(rid)
        cwf = round(random.uniform(1.0, 1.8), 2)
        score = round(lik * imp * cwf, 2)
        await insert_one("risks", {
            "risk_id": rid, "title": title,
            "description": f"Risk identified during continuous IT audit. {biz}",
            "category": cat, "severity": sev,
            "likelihood": lik, "impact": imp,
            "control_weakness_factor": cwf, "risk_score": score,
            "owner_id": random.choice(user_ids),
            "status": "Open",
            "business_impact": biz,
            "financial_impact": fin,
            "financial_impact_currency": "INR",
            "affected_entity_ids": random.sample(entity_ids, k=min(3, len(entity_ids))),
            "ai_priority_rank": i + 1 if i < 10 else None,
            "ai_business_impact": biz,
            "ai_recommendation": f"Initiate immediate remediation. Estimated effort 40-80 hours.",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # OBSERVATIONS
    obs_titles = [
        ("Production database backups failing intermittently", "High", "BCK-001"),
        ("3 AWS S3 buckets discovered with public read access", "Critical", "CLD-001"),
        ("85 dormant Active Directory accounts not disabled", "High", "IAM-002"),
        ("MFA bypass possible for 12 admin accounts via legacy auth", "Critical", "IAM-003"),
        ("Critical CVE-2024-3094 unpatched on 8 production servers", "Critical", "VUL-001"),
        ("Vendor Salesforce SOC 2 report expired 45 days ago", "High", "VEN-001"),
        ("Data classification tagging missing for 23% of databases", "Medium", "DAT-001"),
        ("Emergency change deployed without post-review", "Medium", "CHG-002"),
        ("Pen test for Internet Banking 6 months overdue", "High", "VUL-002"),
        ("Network firewall rules: 47 rules unused for 12+ months", "Medium", "NET-001"),
        ("EDR agent missing on 14 endpoints in DR site", "Critical", "END-001"),
        ("Privileged access for terminated employee retained 8 days", "Critical", "IAM-001"),
        ("DPA not signed with HRMS vendor handling employee PII", "Critical", "VEN-002"),
        ("DR drill skipped for 2024 fiscal year", "High", "BCP-001"),
        ("Audit logs not forwarded to SIEM for 3 critical apps", "High", "LOG-001"),
        ("API authentication missing on internal microservice", "High", "APP-001"),
        ("Code review skipped on 18% of PRs in past quarter", "Medium", "CHG-003"),
        ("4 SoD violations in SAP Finance module", "Critical", "IAM-005"),
        ("Encryption at rest disabled on analytics data lake", "High", "CLD-002"),
        ("Critical incident reported to CERT-In after 11 hours (SLA: 6hrs)", "Critical", "INC-002"),
    ]

    obs_ids = []
    statuses = ["Submitted", "Response_Pending", "In_Progress", "In_Progress", "Evidence_Submitted", "Closed", "Reopened"]
    for i, (title, sev, code) in enumerate(obs_titles):
        oid = new_id()
        obs_ids.append(oid)
        ctrl = await db.controls.find_one({"control_code": code}, {"_id": 0})
        sla = {"Critical": 7, "High": 15, "Medium": 30, "Low": 60}[sev]
        days_old = random.randint(2, 45)
        due = (date.today() + timedelta(days=sla - days_old)).isoformat()
        st = random.choice(statuses)
        await insert_one("observations", {
            "observation_id": oid,
            "audit_id": None,
            "control_id": ctrl["control_id"] if ctrl else None,
            "control_code": code,
            "title": title,
            "description": f"During continuous IT audit, observation identified: {title}. Root cause analysis pending.",
            "severity": sev,
            "root_cause": "Process gap; control not consistently applied.",
            "risk_impact": "Could lead to unauthorized access or compliance breach.",
            "business_impact": "Potential regulatory fines and operational disruption.",
            "financial_impact": round(random.uniform(500000, 15000000), 2),
            "owner_id": random.choice(user_ids),
            "owner_name": random.choice([n for n, _, _ in USER_NAMES]),
            "due_date": due,
            "status": st,
            "management_response": "Remediation plan submitted; resources allocated." if st in ("Action_Plan_Submitted", "In_Progress", "Evidence_Submitted", "Closed") else None,
            "auditor_review": "Reviewed and accepted." if st == "Closed" else None,
            "is_repeated_finding": random.random() < 0.15,
            "ai_generated": random.random() < 0.4,
            "sla_days": sla,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat(),
            "updated_at": now_iso(),
        })

    # REMEDIATION
    for oid in obs_ids[:15]:
        obs = await db.observations.find_one({"observation_id": oid}, {"_id": 0})
        progress = random.choice([0, 25, 50, 50, 75, 100])
        await insert_one("remediation", {
            "remediation_id": new_id(),
            "observation_id": oid,
            "action_plan": f"1. Identify affected systems\n2. Implement compensating control\n3. Validate via control testing\n4. Update policy",
            "owner_id": obs.get("owner_id"),
            "target_date": obs.get("due_date"),
            "priority": obs.get("severity"),
            "progress": progress,
            "closure_status": "Closed" if progress == 100 else ("In_Progress" if progress > 0 else "Pending"),
            "sla_status": random.choice(["On_Time", "On_Time", "At_Risk", "Overdue"]),
            "ai_suggested": random.random() < 0.5,
            "created_at": now_iso(),
        })

    # SCORE HISTORY (90 days)
    base = 78.0
    for i in range(90, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        # Smooth-ish trend
        score = round(base + random.uniform(-2.5, 2.5) + (90 - i) * 0.04, 1)
        await insert_one("score_history", {
            "history_id": new_id(),
            "entity_type": "Enterprise",
            "entity_id": "global",
            "score_date": d,
            "score": score,
            "sub_scores": {
                "compliance": round(score - random.uniform(-3, 3), 1),
                "iam": round(score - random.uniform(-5, 5), 1),
                "cybersecurity": round(score - random.uniform(-4, 4), 1),
                "infrastructure": round(score - random.uniform(-3, 3), 1),
                "application": round(score - random.uniform(-3, 3), 1),
                "data_governance": round(score - random.uniform(-2, 2), 1),
                "vendor": round(score - random.uniform(-4, 4), 1),
                "bcp": round(score - random.uniform(-5, 5), 1),
                "remediation_closure": round(score - random.uniform(-3, 3), 1),
            },
            "created_at": now_iso(),
        })

    # CCM ALERTS
    ccm_data = [
        ("MFA coverage dropped to 87% (target ≥90%)", "High", "Threshold_Breach", "IAM-003"),
        ("New public S3 bucket detected: 'analytics-temp-uploads'", "Critical", "First_Failure", "CLD-001"),
        ("Veeam backup job failure for production cluster", "High", "Recurring_Failure", "BCK-001"),
        ("SoD violation detected: New user with PR Create + PO Approve", "Critical", "Anomaly", "IAM-005"),
        ("Patch compliance dropped below 80% for endpoints", "High", "Threshold_Breach", "END-002"),
        ("Privileged access granted at 02:14 IST without approval", "Critical", "Anomaly", "IAM-001"),
    ]
    for title, sev, atype, code in ccm_data:
        ctrl = await db.controls.find_one({"control_code": code}, {"_id": 0})
        await insert_one("ccm_alerts", {
            "alert_id": new_id(),
            "monitor_id": new_id(),
            "control_id": ctrl["control_id"] if ctrl else None,
            "control_code": code,
            "control_name": ctrl["control_name"] if ctrl else "Unknown",
            "severity": sev,
            "alert_type": atype,
            "details": {"description": title},
            "title": title,
            "auto_observation_id": None,
            "acknowledged_by": None,
            "acknowledged_at": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72))).isoformat(),
        })

    # POLICIES
    policy_data = [
        ("Information Security Policy", "POL-001", "IT_Security", "2.4"),
        ("Access Control Policy", "POL-002", "Access_Control", "1.8"),
        ("Password & Authentication Policy", "POL-003", "Password", "3.0"),
        ("Cloud Acceptable Use Policy", "POL-004", "Cloud_Usage", "1.2"),
        ("Backup & Restoration Policy", "POL-005", "Backup", "2.1"),
        ("Data Privacy Policy (DPDP-aligned)", "POL-006", "Data_Privacy", "1.5"),
        ("Vendor Risk Management Policy", "POL-007", "Vendor", "1.3"),
        ("Change Management Policy", "POL-008", "Change_Management", "2.7"),
        ("Incident Response Policy", "POL-009", "Incident_Response", "2.0"),
        ("Business Continuity Policy", "POL-010", "BCP", "1.4"),
    ]
    for name, code, ptype, ver in policy_data:
        eff = (date.today() - timedelta(days=random.randint(60, 700))).isoformat()
        nxt = (date.today() + timedelta(days=random.randint(-40, 365))).isoformat()
        nxt_d = datetime.fromisoformat(nxt).date()
        status = "Expired" if nxt_d < date.today() else "Active"
        await insert_one("policies", {
            "policy_id": new_id(), "policy_name": name, "policy_code": code,
            "policy_type": ptype,
            "owner_id": random.choice(user_ids),
            "version": ver, "effective_date": eff,
            "review_date": (date.today() - timedelta(days=random.randint(30, 200))).isoformat(),
            "next_review_date": nxt,
            "status": status,
            "content": f"This {name} establishes guidelines for {ptype.replace('_', ' ').lower()}. All employees must comply with the requirements outlined herein.\n\nScope: All IT systems, employees, contractors, and third-party vendors.\n\nKey Requirements:\n1. Mandatory adherence to defined controls\n2. Regular audit and review\n3. Reporting violations to security officer\n\nReview Frequency: Annual or upon major changes.\n\nApproved by: CIO Office",
            "linked_control_ids": [],
            "linked_framework_clauses": [],
            "exception_count": random.randint(0, 3),
            "created_at": now_iso(),
        })

    # AUDITS
    audit_names = [
        ("ITGC Audit FY26-Q1", "IT_General", "ITGC", "Planned"),
        ("Cloud Security Audit - AWS", "Cloud", "ISO27001", "In_Progress"),
        ("DPDP Compliance Readiness Audit", "Compliance", "DPDP", "In_Progress"),
        ("Vendor Risk Audit - Tier 1", "Vendor", "SOC2", "Reporting"),
        ("Internet Banking Security Audit", "Application", "RBI_IT", "Closed"),
    ]
    for name, atype, fw, status in audit_names:
        aid = new_id()
        await insert_one("audits", {
            "audit_id": aid, "audit_name": name,
            "audit_type": atype, "framework": fw,
            "scope_description": f"Comprehensive audit of {atype} controls aligned with {fw} framework.",
            "objective": "Assess effectiveness of IT controls and identify gaps.",
            "start_date": (date.today() - timedelta(days=random.randint(30, 90))).isoformat(),
            "end_date": (date.today() + timedelta(days=random.randint(15, 60))).isoformat(),
            "status": status,
            "audit_manager_id": random.choice(user_ids),
            "created_by": admin_id,
            "is_continuous": False,
            "risk_focus_areas": ["Access Management", "Cloud Security", "Data Privacy"],
            "created_at": now_iso(),
        })

    # NOTIFICATIONS for admin
    notifs = [
        ("CCM_Alert", "Critical control failure: Public S3 bucket detected", "Cloud audit found 3 buckets with public read access. Immediate action required."),
        ("SLA_Warning", "Observation due in 3 days", "Critical CVE-2024-3094 patching observation approaching SLA breach."),
        ("Report_Ready", "CIO Summary Report generated", "Q1 2026 CIO Summary report is ready for download."),
        ("Observation_Assigned", "New observation assigned", "DPA not signed with HRMS vendor — review required."),
    ]
    for ntype, title, body in notifs:
        await insert_one("notifications", {
            "notification_id": new_id(),
            "recipient_id": admin_id,
            "notification_type": ntype, "title": title, "body": body,
            "link_url": "/dashboard", "is_read": False,
            "priority": "High",
            "related_entity_id": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))).isoformat(),
        })

    # INTEGRATIONS
    integrations = [
        ("Active Directory On-Prem", "Identity", "LDAP", "Success"),
        ("AWS Production Account", "Cloud", "REST_API", "Success"),
        ("ServiceNow ITSM", "ITSM", "REST_API", "Success"),
        ("GitHub Enterprise", "DevOps", "REST_API", "Partial"),
        ("Splunk SIEM", "SIEM", "REST_API", "Failed"),
    ]
    for name, stype, ctype, status in integrations:
        await insert_one("integrations", {
            "integration_id": new_id(), "system_name": name,
            "system_type": stype, "connector_type": ctype,
            "api_endpoint": f"https://api.{name.lower().replace(' ', '')}.com",
            "auth_type": "API_Key", "auth_config": {},
            "sync_frequency": "Daily",
            "last_sync_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(2, 30))).isoformat(),
            "last_sync_status": status,
            "is_active": True,
            "data_mapping": {},
            "owner_id": admin_id,
            "created_at": now_iso(),
        })

    print("[seed] Done. Users + roles + 50 controls + entities + apps + vendors + risks + observations + remediation + alerts + policies + audits seeded.")


if __name__ == "__main__":
    asyncio.run(seed_all(force=True))
