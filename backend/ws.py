"""WebSocket connection manager for real-time CCM alerts."""
import asyncio
import json
from typing import Dict, List
from fastapi import WebSocket
from datetime import datetime, timezone


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.active:
                self.active.remove(ws)

    async def broadcast(self, payload: dict):
        msg = json.dumps({**payload, "_ts": datetime.now(timezone.utc).isoformat()})
        async with self._lock:
            dead = []
            for ws in self.active:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.append(ws)
            for d in dead:
                if d in self.active:
                    self.active.remove(d)


manager = ConnectionManager()
