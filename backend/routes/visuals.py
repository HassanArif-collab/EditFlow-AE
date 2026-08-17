"""EditFlow AE — the AI editor.

One endpoint. It fills the gaps in shots that have gaps, and leaves every
complete shot exactly as it arrived.

  POST /api/visuals/fill   {shots, recipes} -> {shots, filled, refused, skipped}

Nothing here decides what a shot IS. The web agent already chose the recipe;
this only supplies the parameters it left out, one shot at a time, so a small
local model gets a small question.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.visuals.shot_filler import (
    build_prompt, gaps, invented_numbers, needs_model, parse_filled,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/visuals", tags=["visuals"])


class FillReq(BaseModel):
    shots: list[dict]
    # the registry travels with the request: the panel is the only side that
    # knows which recipes this AE install can really build
    recipes: dict[str, dict]
    model: Optional[str] = None


@router.post("/fill")
async def fill(req: FillReq) -> dict[str, Any]:
    from ..services.provider_service import provider_service

    if not req.shots:
        raise HTTPException(status_code=400, detail="No shots to fill.")

    out: list[dict] = []
    filled_log: list[dict] = []
    refused: list[dict] = []
    skipped = 0

    for shot in req.shots:
        recipe = req.recipes.get(str(shot.get("recipe", "")).upper())
        if not recipe or not needs_model(shot, recipe):
            out.append(shot)
            skipped += 1
            continue

        missing = gaps(shot, recipe)
        prompt = build_prompt(shot, recipe, missing)
        try:
            resp = await provider_service.chat(
                messages=[{"role": "user", "content": prompt}],
                model=req.model,
                temperature=0,        # filling a form, not writing
                max_tokens=400,       # one small object
                think=False,          # extraction, not reasoning
            )
        except Exception as exc:  # noqa: BLE001 — one bad shot keeps the rest
            refused.append({"id": shot.get("id"), "why": str(exc)[:200]})
            out.append(shot)
            continue

        if resp.get("error"):
            refused.append({"id": shot.get("id"), "why": str(resp["error"])[:200]})
            out.append(shot)
            continue

        wanted = missing or list((recipe.get("params") or {}))
        proposed = parse_filled(resp.get("response", ""), wanted)
        if not proposed:
            refused.append({"id": shot.get("id"), "why": "nothing usable in the reply"})
            out.append(shot)
            continue

        # A figure on screen that the narrator never said is worse than a gap.
        invented = invented_numbers(proposed, shot)
        if invented:
            refused.append({
                "id": shot.get("id"),
                "why": f"invented numbers the narration never says: {', '.join(invented)}",
            })
            out.append(shot)
            continue

        merged = dict(shot)
        merged["props"] = {**(shot.get("props") or {}), **proposed}
        merged["needs"] = [n for n in (shot.get("needs") or [])
                           if str(n).replace("props.", "") not in proposed]
        merged["filledByAgent"] = sorted(proposed)
        out.append(merged)
        filled_log.append({"id": shot.get("id"), "props": proposed})

    if refused:
        logger.warning("visuals.fill: refused %d shot(s) — e.g. %s", len(refused), refused[0])

    return {
        "shots": out,
        "filled": filled_log,
        "refused": refused,
        "skipped": skipped,
        "model": req.model or (provider_service.get_active_chat() or {}).get("model"),
    }
