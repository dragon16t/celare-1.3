"""Zoom meetings for consultations (Server-to-Server OAuth). Falls back to Jitsi when unconfigured."""
import base64
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


def configured() -> bool:
    return all(os.environ.get(k) for k in ("ZOOM_ACCOUNT_ID", "ZOOM_S2S_CLIENT_ID", "ZOOM_S2S_CLIENT_SECRET"))


async def _token() -> str:
    raw = f"{os.environ['ZOOM_S2S_CLIENT_ID']}:{os.environ['ZOOM_S2S_CLIENT_SECRET']}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post("https://zoom.us/oauth/token",
                              params={"grant_type": "account_credentials", "account_id": os.environ["ZOOM_ACCOUNT_ID"]},
                              headers={"Authorization": f"Basic {base64.b64encode(raw.encode()).decode()}"})
    r.raise_for_status()
    return r.json()["access_token"]


async def create_meeting(topic: str, start_iso: Optional[str], duration: int = 30) -> Optional[Dict[str, Any]]:
    if not configured():
        return None
    try:
        token = await _token()
        body = {"type": 2 if start_iso else 1, "topic": topic, "duration": duration, "timezone": "Asia/Kolkata",
                "settings": {"waiting_room": False, "join_before_host": True, "auto_recording": "none"}}
        if start_iso:
            body["start_time"] = start_iso
        host = os.environ.get("ZOOM_HOST_USER_ID") or "me"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"https://api.zoom.us/v2/users/{host}/meetings",
                                  headers={"Authorization": f"Bearer {token}"}, json=body)
        r.raise_for_status()
        d = r.json()
        return {"meeting_id": d["id"], "password": d.get("password", ""), "join_url": d["join_url"],
                "start_url": d.get("start_url", "")}
    except Exception as exc:
        logger.error(f"[zoom] meeting create failed: {exc}")
        return None
