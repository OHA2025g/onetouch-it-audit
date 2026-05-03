"""Redis-or-Mongo TTL key/value cache with graceful fallback.

If `REDIS_URL` env var is set and Redis is reachable, uses Redis.
Otherwise persists to Mongo collection `kv_cache` with `expires_at` field +
process-local LRU for hot-path speed. Reads still respect TTL.
"""
import os
import json
import asyncio
import time
from typing import Any, Optional

from db import db

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
_redis = None
_mode = "memory+mongo"

try:
    if REDIS_URL:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        _mode = "redis"
except Exception:
    _redis = None


# Local LRU
_local: dict[str, tuple[float, Any]] = {}


async def ping() -> str:
    """Returns active mode label after probing Redis once."""
    global _redis, _mode
    if _redis is not None:
        try:
            await asyncio.wait_for(_redis.ping(), timeout=1.5)
            _mode = "redis"
            return _mode
        except Exception:
            _redis = None
    _mode = "memory+mongo"
    # Ensure TTL index on Mongo collection
    try:
        await db.kv_cache.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass
    return _mode


async def setex(key: str, value: Any, ttl_seconds: int):
    expires = time.time() + ttl_seconds
    _local[key] = (expires, value)
    if _redis is not None:
        try:
            await _redis.set(key, json.dumps(value, default=str), ex=ttl_seconds)
            return
        except Exception:
            pass
    # Mongo fallback (datetime for TTL index)
    from datetime import datetime, timezone
    await db.kv_cache.update_one(
        {"_id": key},
        {"$set": {"_id": key, "value": json.dumps(value, default=str),
                  "expires_at": datetime.fromtimestamp(expires, timezone.utc)}},
        upsert=True,
    )


async def get(key: str) -> Optional[Any]:
    # Local fast path
    item = _local.get(key)
    if item:
        exp, val = item
        if exp > time.time():
            return val
        else:
            _local.pop(key, None)
    if _redis is not None:
        try:
            v = await _redis.get(key)
            if v is not None:
                return json.loads(v)
            return None
        except Exception:
            pass
    # Mongo fallback
    doc = await db.kv_cache.find_one({"_id": key}, {"_id": 0})
    if not doc:
        return None
    from datetime import datetime, timezone
    exp = doc.get("expires_at")
    if exp and exp.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        return None
    try:
        return json.loads(doc["value"])
    except Exception:
        return None


async def delete(key: str):
    _local.pop(key, None)
    if _redis is not None:
        try:
            await _redis.delete(key)
        except Exception:
            pass
    await db.kv_cache.delete_one({"_id": key})


def mode() -> str:
    return _mode
