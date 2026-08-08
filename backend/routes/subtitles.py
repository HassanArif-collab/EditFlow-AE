"""EditFlow AE — Subtitles routes (transcription, cues, SRT export).

Endpoints (all under ``/api/subtitles``):

  POST /transcribe-mixdown  audio → word-level timestamps (the captions feature)
  POST /cues                words → grouped cues
  POST /srt                 cues → SRT text + a file under data/output/subtitles/
  GET  /presets             animation presets for the panel's picker
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..services.subtitles.cue_builder import (
    CueOpts,
    build_cues,
    remap_kept_words_to_output,
)
from ..services.subtitles.presets import load_presets
from ..services.subtitles.srt_export import cues_to_srt
from ..services.subtitles.word_sanitizer import sanitize_words
from ..services.whisper_service import whisper_service
from ..utils.progress import ProgressReporter
from .whisper_admin import is_model_installed

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subtitles", tags=["subtitles"])


class CuesReq(BaseModel):
    words: Optional[list[dict]] = None
    source: Optional[str] = "standalone"        # "standalone" | "final_cut"
    opts: Optional[dict[str, Any]] = None       # CueOpts overrides


@router.post("/cues")
async def cues(req: CuesReq):
    if not req.words:
        raise HTTPException(status_code=400, detail="Pass words.")
    words = req.words

    if (req.source or "standalone") == "final_cut":
        words = remap_kept_words_to_output(words)

    try:
        opts = CueOpts(**(req.opts or {}))
    except TypeError as exc:
        raise HTTPException(status_code=400, detail=f"Bad cue option: {exc}") from exc

    built = build_cues(words, opts)
    return {
        "cues": built,
        "summary": {
            "cues": len(built),
            "words": len(words),
            "duration": round(built[-1]["end"] - built[0]["start"], 2) if built else 0.0,
        },
    }


@router.get("/presets")
async def presets():
    """Animation presets for the view's picker (built-ins; MOGRT imports later)."""
    return {"presets": load_presets()}


class SrtReq(BaseModel):
    cues: list[dict]
    name: Optional[str] = None


@router.post("/srt")
async def srt(req: SrtReq):
    text = cues_to_srt(req.cues)
    if not text:
        raise HTTPException(status_code=400, detail="No non-empty cues to export.")
    srt_path = ""
    try:
        from ..config import get_settings
        out_dir = get_settings().DATA_DIR / "output" / "subtitles"
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = (req.name or f"subtitles-{uuid.uuid4().hex[:8]}").rsplit(".", 1)[0]
        path = out_dir / f"{stem}.srt"
        path.write_text(text, encoding="utf-8")
        srt_path = str(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("subtitles.srt: file write failed: %s", exc)
    return {"srt": text, "srt_path": srt_path}


def _whisperx_model_size(active_model: str) -> str:
    """Map a full model name (e.g. 'Systran/faster-whisper-large-v3') to the
    plain size string WhisperX loads ('large-v3')."""
    name = active_model or "large-v3"
    if "faster-whisper-" in name:
        name = name.split("faster-whisper-")[-1]
    return name


@router.post("/transcribe-mixdown")
async def transcribe_mixdown(
    file: UploadFile = File(...),
    client_id: Optional[str] = Form(None),
    sequence_name: Optional[str] = Form(None),
    in_seconds: float = Form(0.0),
    out_seconds: float = Form(0.0),
    language: Optional[str] = Form(None),
    force: bool = Form(False),
    engine: str = Form("auto"),
    vocab: str = Form(""),
):
    """Receive a WAV mixdown from the panel, transcribe it, return word cues.

    Used by the AE captions panel: the CEP side exports the comp's audio to a
    WAV, uploads it here, and we run Whisper/WhisperX on it. Returns
    word-level timestamps so the panel can group them into captions and
    animate each word on a native AE text layer.

    Returns 409 with body {error: "no_model", ...} if no Whisper model is
    installed — the frontend uses this signal to pop the Whisper download UI.
    """
    from ..config import get_settings

    try:
        # 1. Resolve the active model + compute a *range-based* fingerprint.
        #    Same sequence + In/Out + model → same fingerprint → same on-disk
        #    WAV. This lets the CEP side skip re-uploading when the user
        #    re-opens the panel for the same range, and lets Whisper's
        #    transcript cache (keyed by file_fingerprint) hit on re-runs.
        active_model = whisper_service.get_active_model_name()
        # Language MUST be part of the key — otherwise re-transcribing the same
        # range in a different language returns the first language's cached
        # transcript (the "can't retranscribe in another language" bug).
        lang_key = (language or "auto").strip().lower()
        vocab = (vocab or "").strip()
        # Engine + vocab are part of the key: whisperx vs whisper timings
        # differ, and vocab biasing changes the transcript.
        fingerprint = hashlib.sha256(
            f"{sequence_name}|{in_seconds}|{out_seconds}|{active_model}|{lang_key}"
            f"|{engine}|{vocab}".encode("utf-8")
        ).hexdigest()[:16]

        # 2. Persist the uploaded WAV under data/media_cache/mixdowns/.
        mixdowns_dir = get_settings().DATA_DIR / "media_cache" / "mixdowns"
        mixdowns_dir.mkdir(parents=True, exist_ok=True)
        wav_path = mixdowns_dir / f"{fingerprint}.wav"
        try:
            content = await file.read()
            wav_path.write_bytes(content)
        finally:
            await file.close()

        # 3. Model-availability short-circuit. 409 (not 422/500) so the
        #    frontend can distinguish "install a model first" from a real
        #    error.
        if not is_model_installed(active_model):
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "no_model",
                    "available": [],
                    "download_hint": "open_settings_whisper",
                },
            )

        # 4. Transcribe. range_in/range_out=0 → whole file (the CEP side
        #    already pre-trimmed to In/Out, so we don't re-trim here).
        #    Passing file_fingerprint explicitly so the cache key is the
        #    range-based fingerprint, not a content hash — re-runs of the
        #    same In/Out hit the cache even if the WAV bytes differ.
        reporter = ProgressReporter(task_type="transcribe", client_id=client_id)
        lang = language if language and language != 'auto' else None

        # 4a. WhisperX forced alignment (engine auto|whisperx): ~50ms word
        #     boundaries vs ~200-300ms from plain faster-whisper — visible
        #     in word-by-word caption animation. Any failure falls back to
        #     the whisper path below and the response `engine` says which ran.
        result = None
        engine_used = None
        if engine in ("auto", "whisperx"):
            try:
                from ..services.transcribe.whisperx_engine import WhisperXEngine
                wx = WhisperXEngine(model_size=_whisperx_model_size(active_model))
                if wx.is_available():
                    # ponytail: no transcript cache / progress ticks on the
                    # whisperx path yet — add if slow runs get annoying.
                    result = await wx.transcribe(
                        str(wav_path), language=lang, word_timestamps=True,
                    )
                    engine_used = "whisperx"
            except Exception as wx_exc:  # noqa: BLE001
                logger.warning("whisperx failed, falling back to whisper: %s", wx_exc)
                result = None

        if result is None:
            result = await whisper_service.transcribe_fingerprinted(
                source_path=str(wav_path),
                file_fingerprint=fingerprint,
                language=lang,
                word_timestamps=True,
                vad_filter=True,
                progress=reporter,
                force=force,
                range_in=0.0,
                range_out=0.0,
                vocab=vocab or None,
            )
            engine_used = result.engine

        # 5. Flatten segments → word list. TranscriptWord.probability maps
        #    to the spec's `confidence` field name. sanitize_words guards
        #    against overlaps, zero durations and missing timestamps
        #    (whisperx defaults unalignable tokens to 0).
        words_out: list[dict] = []
        for seg in result.segments:
            for w in seg.words:
                words_out.append({
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "confidence": w.probability,
                })
        words_out = sanitize_words(words_out)

        return {
            "words": words_out,
            "fingerprint": fingerprint,
            "duration": result.duration,
            "model": result.model or active_model,
            "engine": engine_used or result.engine,
        }

    except HTTPException:
        # Re-raise 409 (and any other deliberate HTTPException) unchanged
        # so the try/except below doesn't mask it as a 500.
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("subtitles.transcribe_mixdown failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
