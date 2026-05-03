"""JWT auth + RBAC."""
import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from db import db, find_one

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALG = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_MIN = int(os.environ.get('ACCESS_TOKEN_MINUTES', '60'))

security = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, role: str, permissions: dict, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "permissions": permissions,
        "email": email,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class UserContext(BaseModel):
    user_id: str
    role: str
    permissions: dict
    email: str
    name: str


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> UserContext:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    payload = decode_token(creds.credentials)
    return UserContext(
        user_id=payload["sub"],
        role=payload.get("role", ""),
        permissions=payload.get("permissions", {}),
        email=payload.get("email", ""),
        name=payload.get("name", ""),
    )


def require_role(*roles: str):
    async def dep(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role not in roles and user.role != 'Admin':
            raise HTTPException(status_code=403, detail=f"Role {user.role} not permitted")
        return user
    return dep


def has_permission(perms: dict, resource: str, action: str) -> bool:
    if perms.get('*', []) == ['*']:
        return True
    if action in perms.get(resource, []):
        return True
    if 'read' == action and 'read' in perms.get(resource, []):
        return True
    return False


def require_permission(resource: str, action: str):
    async def dep(user: UserContext = Depends(get_current_user)) -> UserContext:
        if not has_permission(user.permissions, resource, action):
            raise HTTPException(status_code=403, detail=f"Insufficient permission: {resource}:{action}")
        return user
    return dep
