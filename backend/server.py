"""FastAPI app entrypoint with WS, metrics, background CCM ticker."""
from fastapi import FastAPI, APIRouter, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
import time
import uuid
import asyncio
import random
import json
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from db import db, find_one, find_many, insert_one, now_iso, new_id
from routers_core import router as core_router
from routers_dashboard import router as dashboard_router
from routers_ai import router as ai_router
from seed import seed_all
from ws import manager as ws_manager
from metrics import (
    api_requests_total, api_latency_seconds, latest_metrics,
    ccm_alerts_fired_total, active_websocket_connections,
)
from auth import decode_token
from embeddings import reindex_all
import cache

app = FastAPI(title="One Touch IT Audit AI", version="1.1.0")

api_router = APIRouter(prefix="/api")
api_router.include_router(core_router)
api_router.include_router(dashboard_router)
api_router.include_router(ai_router)


@api_router.get("/")
async def root():
    return {"service": "One Touch IT Audit AI", "version": "1.1.0", "status": "ok"}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)[:200]}


@api_router.get("/health/deep")
async def deep_health():
    out = {"timestamp": time.time(), "services": {}}
    try:
        await db.command("ping")
        out["services"]["mongo"] = "ok"
    except Exception as e:
        out["services"]["mongo"] = f"fail: {str(e)[:100]}"
    out["services"]["llm"] = "configured" if os.environ.get("EMERGENT_LLM_KEY") else "missing-key"
    out["services"]["websockets"] = f"active={len(ws_manager.active)}"
    out["services"]["cache"] = cache.mode()
    out["services"]["fernet"] = "configured" if os.environ.get("FERNET_KEY") else "missing-key"
    return out


@api_router.get("/metrics")
async def metrics_endpoint():
    body, ct = latest_metrics()
    return Response(content=body, media_type=ct)


# ---------------- WebSocket ----------------
@app.websocket("/api/ws/alerts")
async def ws_alerts(websocket: WebSocket, token: str = ""):
    """WS endpoint with JWT auth via ?token=... query param. Pushes CCM alerts."""
    if not token:
        await websocket.close(code=1008)
        return
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=1008)
        return
    await ws_manager.connect(websocket)
    active_websocket_connections.set(len(ws_manager.active))
    try:
        await websocket.send_text(json.dumps({"type": "hello", "message": "WS connected", "_ts": datetime.now(timezone.utc).isoformat()}))
        while True:
            # Keep alive; client only listens
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await ws_manager.disconnect(websocket)
        active_websocket_connections.set(len(ws_manager.active))


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        api_requests_total.labels(request.method, request.url.path, "500").inc()
        raise
    duration = time.time() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/api/"):
        api_requests_total.labels(request.method, request.url.path, str(response.status_code)).inc()
        api_latency_seconds.labels(request.url.path).observe(duration)
    return response


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("audit-ai")


# ---------------- CCM Background Ticker ----------------
_CCM_TASK = None

CCM_SAMPLE_TEMPLATES = [
    ("MFA coverage dropped to 87% (target ≥90%)", "High", "Threshold_Breach", "IAM-003"),
    ("New public S3 bucket detected", "Critical", "First_Failure", "CLD-001"),
    ("Backup job failure", "High", "Recurring_Failure", "BCK-001"),
    ("New SoD violation detected", "Critical", "Anomaly", "IAM-005"),
    ("Patch compliance dropped below 80%", "High", "Threshold_Breach", "END-002"),
    ("Privileged access granted off-hours", "Critical", "Anomaly", "IAM-001"),
    ("Failed login attempts spike", "Medium", "Anomaly", "IAM-001"),
    ("Critical CVE published affecting fleet", "Critical", "First_Failure", "VUL-001"),
]


async def ccm_ticker():
    """Periodically generates a synthetic CCM alert and broadcasts via WS."""
    await asyncio.sleep(20)  # wait for boot
    while True:
        try:
            tpl = random.choice(CCM_SAMPLE_TEMPLATES)
            title, sev, atype, code = tpl
            ctrl = await find_one("controls", {"control_code": code})
            alert_id = new_id()
            alert_doc = {
                "alert_id": alert_id, "monitor_id": new_id(),
                "control_id": ctrl["control_id"] if ctrl else None,
                "control_code": code,
                "control_name": ctrl["control_name"] if ctrl else "Unknown",
                "severity": sev, "alert_type": atype,
                "details": {"description": title, "auto_generated": True},
                "title": title,
                "auto_observation_id": None,
                "acknowledged_by": None, "acknowledged_at": None,
                "created_at": now_iso(),
            }
            await insert_one("ccm_alerts", alert_doc)
            ccm_alerts_fired_total.labels(sev).inc()
            await ws_manager.broadcast({
                "type": "ccm_alert",
                "alert": {
                    "alert_id": alert_id, "title": title,
                    "severity": sev, "alert_type": atype,
                    "control_code": code,
                    "created_at": alert_doc["created_at"],
                },
            })
            # 90 - 180 sec interval
            await asyncio.sleep(random.randint(90, 180))
        except Exception as e:
            logger.error(f"CCM ticker error: {e}")
            await asyncio.sleep(60)


@app.on_event("startup")
async def on_startup():
    global _CCM_TASK
    try:
        await seed_all(force=False)
        logger.info("Seed check complete")
        await reindex_all()
        logger.info("Embeddings reindexed")
        mode = await cache.ping()
        logger.info(f"Cache mode: {mode}")
    except Exception as e:
        logger.error(f"Startup error: {e}")
    if _CCM_TASK is None or _CCM_TASK.done():
        _CCM_TASK = asyncio.create_task(ccm_ticker())
        logger.info("CCM ticker started")


@app.on_event("shutdown")
async def on_shutdown():
    global _CCM_TASK
    if _CCM_TASK and not _CCM_TASK.done():
        _CCM_TASK.cancel()
