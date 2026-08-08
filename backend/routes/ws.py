"""Progress WebSocket.

The panel opens /api/chat/ws/{client_id} and receives transcription progress,
whisper download progress, and agent-bridge messages. Extracted from the old
chat.py so the chat/agent stack could be deleted; the PATH is unchanged so the
panel needs no edit.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..utils.progress import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["ws"])


@router.websocket("/ws/{client_id}")
async def websocket_progress(websocket: WebSocket, client_id: str):
    accepted_id = await manager.connect(websocket, client_id)
    if accepted_id is None:
        return
    try:
        while True:
            # The panel only listens; reading keeps the socket open and lets
            # us notice a disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(accepted_id)
    except Exception as exc:  # noqa: BLE001 — one bad socket must not kill the app
        logger.debug("ws %s closed: %s", accepted_id, exc)
        manager.disconnect(accepted_id)
