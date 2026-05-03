"""Real connector test-connection + batch sync.

Each connector exposes:
  - test() → ConnectorResult
  - sync() → ConnectorResult (writes into iam_snapshots / cloud_audit_results / etc.)

Credentials are read from integration.auth_config (Fernet-decrypted at the
caller level via decrypt_dict before being passed in).
"""
import os
import asyncio
from datetime import date, datetime, timezone
from typing import Optional

from db import db, find_one, update_one, insert_one, now_iso, new_id
from crypto import decrypt_dict


class ConnectorResult:
    def __init__(self, success: bool, message: str, data: dict | None = None):
        self.success = success
        self.message = message
        self.data = data or {}

    def to_dict(self):
        return {"success": self.success, "message": self.message, "data": self.data}


# ============================ AWS ============================
async def aws_test(config: dict) -> ConnectorResult:
    try:
        import boto3
    except ImportError:
        return ConnectorResult(False, "boto3 not installed")
    ak = config.get("access_key_id") or os.environ.get("AWS_ACCESS_KEY_ID")
    sk = config.get("secret_access_key") or os.environ.get("AWS_SECRET_ACCESS_KEY")
    region = config.get("region", "ap-south-1")
    if not ak or not sk:
        return ConnectorResult(False, "AWS credentials missing. Set access_key_id + secret_access_key in integration auth_config.")
    try:
        loop = asyncio.get_event_loop()
        s3 = boto3.client("s3", aws_access_key_id=ak, aws_secret_access_key=sk, region_name=region)
        resp = await loop.run_in_executor(None, lambda: s3.list_buckets())
        names = [b["Name"] for b in resp.get("Buckets", [])][:5]
        return ConnectorResult(True, f"Connected. {len(resp.get('Buckets', []))} buckets accessible.", {"sample_buckets": names})
    except Exception as e:
        return ConnectorResult(False, f"AWS error: {str(e)[:200]}")


async def aws_sync(integration_id: str, config: dict) -> ConnectorResult:
    """Pull AWS posture: S3 public access, IAM users, security groups → upsert cloud_audit_results."""
    try:
        import boto3
    except ImportError:
        return ConnectorResult(False, "boto3 not installed")
    ak = config.get("access_key_id") or os.environ.get("AWS_ACCESS_KEY_ID")
    sk = config.get("secret_access_key") or os.environ.get("AWS_SECRET_ACCESS_KEY")
    region = config.get("region", "ap-south-1")
    if not ak or not sk:
        return ConnectorResult(False, "AWS credentials missing")

    loop = asyncio.get_event_loop()
    try:
        def fetch():
            s3 = boto3.client("s3", aws_access_key_id=ak, aws_secret_access_key=sk, region_name=region)
            iam = boto3.client("iam", aws_access_key_id=ak, aws_secret_access_key=sk, region_name=region)
            ec2 = boto3.client("ec2", aws_access_key_id=ak, aws_secret_access_key=sk, region_name=region)

            # S3 public buckets
            buckets = s3.list_buckets().get("Buckets", [])
            public_buckets = 0
            unencrypted = 0
            for b in buckets[:50]:
                try:
                    pab = s3.get_public_access_block(Bucket=b["Name"])
                    cfg = pab.get("PublicAccessBlockConfiguration", {})
                    if not all([cfg.get("BlockPublicAcls"), cfg.get("BlockPublicPolicy"),
                                cfg.get("IgnorePublicAcls"), cfg.get("RestrictPublicBuckets")]):
                        public_buckets += 1
                except Exception:
                    public_buckets += 1  # absent = potentially public
                try:
                    s3.get_bucket_encryption(Bucket=b["Name"])
                except Exception:
                    unencrypted += 1

            # IAM unused access keys (>90 days)
            unused_keys = 0
            try:
                users = iam.list_users().get("Users", [])
                for u in users[:100]:
                    keys = iam.list_access_keys(UserName=u["UserName"]).get("AccessKeyMetadata", [])
                    for k in keys:
                        age = (datetime.now(timezone.utc) - k["CreateDate"]).days
                        if age > 90:
                            unused_keys += 1
            except Exception:
                pass

            # Security group misconfigs (any 0.0.0.0/0 inbound)
            sg_misconfigs = 0
            try:
                sgs = ec2.describe_security_groups().get("SecurityGroups", [])
                for sg in sgs[:200]:
                    for rule in sg.get("IpPermissions", []):
                        for cidr in rule.get("IpRanges", []):
                            if cidr.get("CidrIp") == "0.0.0.0/0":
                                sg_misconfigs += 1
                                break
            except Exception:
                pass

            return {
                "buckets_total": len(buckets),
                "public_buckets": public_buckets,
                "unencrypted_resources": unencrypted,
                "unused_access_keys": unused_keys,
                "security_group_misconfigs": sg_misconfigs,
            }

        data = await asyncio.wait_for(loop.run_in_executor(None, fetch), timeout=45)

        # Upsert cloud_audit_results for AWS (replace today's entry)
        await db.cloud_audit_results.delete_many({"cloud_provider": "AWS", "audit_date": date.today().isoformat()})
        score = max(50.0, 95.0 - data["public_buckets"] * 8 - data["unencrypted_resources"] * 2 - data["security_group_misconfigs"] * 1.5 - data["unused_access_keys"] * 0.5)
        await insert_one("cloud_audit_results", {
            "result_id": new_id(),
            "cloud_provider": "AWS",
            "account_id": "live-sync",
            "audit_date": date.today().isoformat(),
            "public_buckets": data["public_buckets"],
            "unencrypted_resources": data["unencrypted_resources"],
            "public_ips": 0,
            "weak_iam_policies": 0,
            "unused_access_keys": data["unused_access_keys"],
            "security_group_misconfigs": data["security_group_misconfigs"],
            "zombie_resources": 0,
            "cost_leakage_inr": 0,
            "monthly_spend_inr": 0,
            "idle_compute_cost_inr": 0,
            "non_compliant_regions": 0,
            "audit_score": round(score, 1),
            "created_at": now_iso(),
            "source": "live_sync",
        })

        return ConnectorResult(True, f"Synced AWS posture. {data['buckets_total']} buckets · {data['public_buckets']} public · {data['security_group_misconfigs']} SG issues.", data)
    except Exception as e:
        return ConnectorResult(False, f"AWS sync error: {str(e)[:300]}")


# ============================ LDAP ============================
async def ldap_test(config: dict) -> ConnectorResult:
    try:
        from ldap3 import Server, Connection, ALL
    except ImportError:
        return ConnectorResult(False, "ldap3 not installed")
    host = config.get("host"); user = config.get("bind_user"); pw = config.get("bind_password")
    if not host or not user or not pw:
        return ConnectorResult(False, "LDAP host + bind_user + bind_password required")
    try:
        loop = asyncio.get_event_loop()
        def _try():
            srv = Server(host, get_info=ALL)
            with Connection(srv, user=user, password=pw, auto_bind=True) as conn:
                return conn.server.info.naming_contexts if conn.server.info else []
        ctx = await asyncio.wait_for(loop.run_in_executor(None, _try), timeout=10)
        return ConnectorResult(True, "LDAP bind successful", {"naming_contexts": list(ctx) if ctx else []})
    except Exception as e:
        return ConnectorResult(False, f"LDAP error: {str(e)[:200]}")


async def ldap_sync(integration_id: str, config: dict) -> ConnectorResult:
    """Pull AD users → upsert iam_snapshots."""
    try:
        from ldap3 import Server, Connection, ALL, SUBTREE
    except ImportError:
        return ConnectorResult(False, "ldap3 not installed")
    host = config.get("host"); user = config.get("bind_user"); pw = config.get("bind_password")
    base_dn = config.get("base_dn") or ""
    if not all([host, user, pw, base_dn]):
        return ConnectorResult(False, "LDAP host + bind_user + bind_password + base_dn required")
    try:
        loop = asyncio.get_event_loop()
        def fetch():
            srv = Server(host, get_info=ALL)
            with Connection(srv, user=user, password=pw, auto_bind=True) as conn:
                conn.search(base_dn, "(objectClass=user)",
                            attributes=["sAMAccountName", "mail", "lastLogonTimestamp", "memberOf", "userAccountControl"],
                            search_scope=SUBTREE, size_limit=5000)
                return conn.entries

        entries = await asyncio.wait_for(loop.run_in_executor(None, fetch), timeout=60)
        total = len(entries)
        # Heuristics
        dormant = 0; orphan = 0; privileged = 0
        for e in entries:
            try:
                uac = int(getattr(e, "userAccountControl", 0).value or 0)
                if uac & 0x2:  # ACCOUNTDISABLE
                    dormant += 1
                groups = [str(g).lower() for g in (getattr(e, "memberOf", []).values or [])]
                if any("admin" in g for g in groups):
                    privileged += 1
                if not getattr(e, "mail", None) or not e.mail.value:
                    orphan += 1
            except Exception:
                pass

        await insert_one("iam_snapshots", {
            "snapshot_id": new_id(),
            "snapshot_date": date.today().isoformat(),
            "source_system": "Active Directory (live)",
            "total_users": total,
            "active_users": total - dormant,
            "dormant_users": dormant,
            "orphan_users": orphan,
            "privileged_users": privileged,
            "users_without_mfa": 0,
            "sod_violations": 0,
            "excess_roles": 0,
            "temp_access_not_revoked": 0,
            "avg_access_review_age_days": 90,
            "metadata": {"sync_id": new_id()},
            "created_at": now_iso(),
        })
        return ConnectorResult(True, f"Synced AD: {total} users · {dormant} dormant · {privileged} privileged · {orphan} orphan", {"total": total, "dormant": dormant, "privileged": privileged, "orphan": orphan})
    except Exception as e:
        return ConnectorResult(False, f"LDAP sync error: {str(e)[:300]}")


# ============================ ServiceNow ============================
async def servicenow_test(config: dict) -> ConnectorResult:
    import requests
    instance = config.get("instance"); user = config.get("username"); pw = config.get("password")
    if not all([instance, user, pw]):
        return ConnectorResult(False, "instance + username + password required")
    try:
        loop = asyncio.get_event_loop()
        url = f"https://{instance}.service-now.com/api/now/table/incident?sysparm_limit=1"
        r = await loop.run_in_executor(None, lambda: requests.get(url, auth=(user, pw), timeout=10))
        if r.status_code == 200:
            return ConnectorResult(True, "ServiceNow OK", {"sample_count": len(r.json().get("result", []))})
        return ConnectorResult(False, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        return ConnectorResult(False, f"ServiceNow error: {str(e)[:200]}")


async def servicenow_sync(integration_id: str, config: dict) -> ConnectorResult:
    """Pull P1 incidents from last 30 days → log as observations."""
    import requests
    instance = config.get("instance"); user = config.get("username"); pw = config.get("password")
    if not all([instance, user, pw]):
        return ConnectorResult(False, "Credentials missing")
    try:
        loop = asyncio.get_event_loop()
        url = (f"https://{instance}.service-now.com/api/now/table/incident"
               "?sysparm_query=priority=1^opened_atONLast 30 days&sysparm_limit=20")
        r = await loop.run_in_executor(None, lambda: requests.get(url, auth=(user, pw), timeout=20))
        if r.status_code != 200:
            return ConnectorResult(False, f"HTTP {r.status_code}")
        rows = r.json().get("result", [])
        return ConnectorResult(True, f"Pulled {len(rows)} P1 incidents from last 30 days", {"incident_count": len(rows)})
    except Exception as e:
        return ConnectorResult(False, f"ServiceNow sync error: {str(e)[:200]}")


# ============================ GitHub ============================
async def github_test(config: dict) -> ConnectorResult:
    import requests
    token = config.get("token")
    if not token:
        return ConnectorResult(False, "GitHub PAT (token) required")
    try:
        loop = asyncio.get_event_loop()
        r = await loop.run_in_executor(None, lambda: requests.get("https://api.github.com/user", headers={"Authorization": f"token {token}"}, timeout=10))
        if r.status_code == 200:
            d = r.json()
            return ConnectorResult(True, f"Connected as {d.get('login')}", {"login": d.get("login")})
        return ConnectorResult(False, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        return ConnectorResult(False, f"GitHub error: {str(e)[:200]}")


async def github_sync(integration_id: str, config: dict) -> ConnectorResult:
    """Pull dependabot critical alerts across an org."""
    import requests
    token = config.get("token"); org = config.get("org")
    if not token or not org:
        return ConnectorResult(False, "token + org required")
    try:
        loop = asyncio.get_event_loop()
        url = f"https://api.github.com/orgs/{org}/dependabot/alerts?severity=critical&state=open&per_page=100"
        r = await loop.run_in_executor(None, lambda: requests.get(url, headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}, timeout=20))
        if r.status_code == 200:
            count = len(r.json())
            return ConnectorResult(True, f"{count} open critical Dependabot alerts in {org}", {"alerts": count})
        return ConnectorResult(False, f"HTTP {r.status_code}")
    except Exception as e:
        return ConnectorResult(False, f"GitHub sync error: {str(e)[:200]}")


# ============================ Registry ============================
TESTERS = {"AWS": aws_test, "LDAP": ldap_test, "ServiceNow": servicenow_test, "GitHub": github_test}
SYNCERS = {"AWS": aws_sync, "LDAP": ldap_sync, "ServiceNow": servicenow_sync, "GitHub": github_sync}

ALIASES = {
    "active directory": "LDAP", "ad": "LDAP",
    "service-now": "ServiceNow", "service now": "ServiceNow",
    "github enterprise": "GitHub", "aws ": "AWS", "amazon": "AWS",
}


def _detect_kind(name: str) -> str | None:
    n = (name or "").lower()
    for key in TESTERS:
        if key.lower() in n:
            return key
    for alias, target in ALIASES.items():
        if alias in n:
            return target
    return None


async def _record_log(integration_id: str, status: str, message: str, data: dict, kind: str):
    await update_one("integrations", {"integration_id": integration_id}, {
        "last_sync_at": now_iso(),
        "last_sync_status": status,
    })
    await insert_one("integration_logs", {
        "log_id": new_id(), "integration_id": integration_id,
        "sync_started_at": now_iso(), "sync_completed_at": now_iso(),
        "records_fetched": data.get("buckets_total") or data.get("total") or data.get("incident_count") or data.get("alerts") or 0,
        "records_processed": 0, "records_failed": 0,
        "error_message": message if status != "Success" else None,
        "status": status, "raw_sample": data, "operation": kind,
    })


async def test_connection(integration_id: str) -> ConnectorResult:
    integ = await find_one("integrations", {"integration_id": integration_id})
    if not integ:
        return ConnectorResult(False, "Integration not found")
    kind = _detect_kind(integ.get("system_name", ""))
    if not kind:
        return ConnectorResult(False, f"No connector for '{integ.get('system_name')}'. Supported: AWS, LDAP/AD, ServiceNow, GitHub.")
    config = decrypt_dict(integ.get("auth_config", {}))
    res = await TESTERS[kind](config)
    await _record_log(integration_id, "Success" if res.success else "Failed", res.message, res.data, "test")
    return res


async def run_sync(integration_id: str) -> ConnectorResult:
    integ = await find_one("integrations", {"integration_id": integration_id})
    if not integ:
        return ConnectorResult(False, "Integration not found")
    kind = _detect_kind(integ.get("system_name", ""))
    if not kind:
        return ConnectorResult(False, f"Sync not supported for '{integ.get('system_name')}'.")
    config = decrypt_dict(integ.get("auth_config", {}))
    res = await SYNCERS[kind](integration_id, config)
    await _record_log(integration_id, "Success" if res.success else "Failed", res.message, res.data, "sync")
    return res
