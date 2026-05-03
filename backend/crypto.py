"""Field-level Fernet encryption for sensitive integration auth_config."""
import os
import json
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.environ.get("FERNET_KEY", "").encode()
_fernet: Fernet | None = None
if _KEY:
    try:
        _fernet = Fernet(_KEY)
    except Exception:
        _fernet = None


PREFIX = "fernet:v1:"


def encrypt_dict(data: dict | None) -> dict:
    """Encrypt every string value in dict at rest. Returns wrapped dict.

    {"access_key_id": "AKIA…"} → {"access_key_id": "fernet:v1:gAAA…"}
    Non-string values pass through.
    """
    if not data or not _fernet:
        return data or {}
    out = {}
    for k, v in data.items():
        if isinstance(v, str) and v and not v.startswith(PREFIX):
            try:
                token = _fernet.encrypt(v.encode()).decode()
                out[k] = PREFIX + token
            except Exception:
                out[k] = v
        else:
            out[k] = v
    return out


def decrypt_dict(data: dict | None) -> dict:
    """Decrypt prefixed values. Plain values pass through."""
    if not data:
        return {}
    if not _fernet:
        return {k: v for k, v in data.items() if not (isinstance(v, str) and v.startswith(PREFIX))}
    out = {}
    for k, v in data.items():
        if isinstance(v, str) and v.startswith(PREFIX):
            try:
                out[k] = _fernet.decrypt(v[len(PREFIX):].encode()).decode()
            except InvalidToken:
                out[k] = ""  # corrupt — return empty
        else:
            out[k] = v
    return out


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def mask_dict(data: dict | None) -> dict:
    """For UI display: replace encrypted values with '••• set' or '' if empty."""
    if not data:
        return {}
    return {k: ("••• set" if is_encrypted(v) or (isinstance(v, str) and v) else "") for k, v in data.items()}
