"""TOTP MFA utilities."""
import pyotp
import qrcode
import io
import base64
from typing import Optional

ISSUER = "One Touch IT Audit AI"


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def qr_data_url(secret: str, email: str) -> str:
    uri = provisioning_uri(secret, email)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False


# Roles that REQUIRE MFA
MFA_REQUIRED_ROLES = {"CIO", "CISO", "Admin"}


def role_requires_mfa(role_name: str) -> bool:
    return role_name in MFA_REQUIRED_ROLES
