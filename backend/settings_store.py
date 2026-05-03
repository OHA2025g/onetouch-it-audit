"""System-wide settings stored in Mongo `system_settings` collection (single doc, key='global').

Currently exposes `mfa_enforcement_enabled` which gates the MFA challenge step during login.
When disabled, users with MFA-required roles skip TOTP entirely and receive an access token
directly from /auth/login. The TOTP code, secrets, and verification flow remain intact in the
codebase so an admin can re-enable enforcement at any time.
"""
from db import db

_SETTINGS_KEY = "global"
_DEFAULTS = {
    "mfa_enforcement_enabled": False,  # disabled per product decision Feb-2026
}


async def get_settings() -> dict:
    doc = await db.system_settings.find_one({"_key": _SETTINGS_KEY}, {"_id": 0})
    if not doc:
        doc = {"_key": _SETTINGS_KEY, **_DEFAULTS}
        await db.system_settings.insert_one(dict(doc))
        doc.pop("_id", None)
    # fill defaults for any newly added keys
    for k, v in _DEFAULTS.items():
        if k not in doc:
            doc[k] = v
    doc.pop("_key", None)
    return doc


async def update_settings(patch: dict) -> dict:
    # only allow known keys
    clean = {k: v for k, v in patch.items() if k in _DEFAULTS}
    if not clean:
        return await get_settings()
    await db.system_settings.update_one(
        {"_key": _SETTINGS_KEY},
        {"$set": clean, "$setOnInsert": {"_key": _SETTINGS_KEY}},
        upsert=True,
    )
    return await get_settings()


async def mfa_enforcement_enabled() -> bool:
    s = await get_settings()
    return bool(s.get("mfa_enforcement_enabled", False))
