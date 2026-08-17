"""The AI editor: fills the gaps in a shot, and nothing else.

A brief usually arrives complete — a large web model already chose the recipe
and its props. When that is true this file never runs, and the pipeline builds
with the model switched off. That is the design, not a limitation.

It runs for the leftovers:

  - the brief says `needs: ["props.value"]`
  - a required prop is missing
  - `note` is a sentence in English that has to become parameters

The model is handed ONE shot, the registry entry for that one recipe, and the
script line. Never the archetype catalogue, never the technique deck — that is
4,000 words a small local model drowns in, and it has no bearing on filling a
single number.

Whatever comes back is typechecked against the registry before it goes
anywhere near After Effects. Same principle as the transcript corrector: a
weak model may propose anything, and only what survives the guard is used.
"""
from __future__ import annotations

import json
import re
from typing import Any


def gaps(shot: dict, recipe: dict) -> list[str]:
    """Which props this shot is actually missing.

    `needs` from the brief is authoritative — the other side declares
    incompleteness rather than us inferring it from the shape of the JSON,
    because absent and deliberately-empty look identical there.
    """
    declared = [str(n).replace("props.", "") for n in (shot.get("needs") or [])]
    props = shot.get("props") or {}
    required = [
        key for key, spec in (recipe.get("params") or {}).items()
        if spec.get("required") and props.get(key) in (None, "", [])
    ]
    seen: dict[str, None] = {}
    for key in declared + required:
        seen[key] = None
    return list(seen)


def needs_model(shot: dict, recipe: dict) -> bool:
    """True only when there is something a model could usefully add."""
    return bool(gaps(shot, recipe)) or bool(str(shot.get("note") or "").strip())


def build_prompt(shot: dict, recipe: dict, missing: list[str]) -> str:
    """One shot, one recipe, nothing else in context."""
    params = recipe.get("params") or {}
    wanted = missing or list(params)
    lines = [
        "You are filling in the missing parameters of ONE shot in a "
        "documentary video. Answer with JSON only.",
        "",
        f"The shot is a {recipe.get('name', 'shot')}: {recipe.get('summary', '')}",
        "",
        "The narrator says, over this shot:",
        f'  "{shot.get("scriptLine", "")}"',
    ]
    if shot.get("note"):
        lines += ["", "The editor's direction for this shot:", f'  "{shot["note"]}"']

    known = {k: v for k, v in (shot.get("props") or {}).items() if v not in (None, "")}
    if known:
        lines += ["", "Already decided, do not change:", json.dumps(known, ensure_ascii=False)]

    lines += ["", "Fill in ONLY these:"]
    for key in wanted:
        spec = params.get(key, {})
        bits = [f"  {key} ({spec.get('type', 'string')})"]
        if spec.get("values"):
            bits.append("one of: " + ", ".join(spec["values"]))
        bits.append(spec.get("help", ""))
        lines.append(" — ".join(b for b in bits if b))

    lines += [
        "",
        "RULES:",
        "1. Return ONLY a JSON object of those keys. No prose, no explanation.",
        "2. Take numbers from the narration. Never invent a figure the "
        "narrator does not say.",
        "3. Text you write appears on screen. Keep it under six words.",
        "",
        "JSON:",
    ]
    return "\n".join(lines)


def parse_filled(raw: str, wanted: list[str]) -> dict[str, Any]:
    """Pull the JSON object out of a reply, keeping only the keys we asked for.

    A model that answers with extra keys is not wrong enough to reject, but the
    extras are dropped rather than passed to a builder that would ignore them.
    """
    if not raw:
        return {}
    match = re.search(r"\{[\s\S]*\}", str(raw))
    if not match:
        return {}
    try:
        data = json.loads(match.group(0))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: data[k] for k in wanted if k in data and data[k] is not None}


def numbers_in(text: str) -> set[str]:
    """Digit runs in a string, separators removed, for the honesty check."""
    return {m.replace(",", "").replace(" ", "")
            for m in re.findall(r"\d[\d,\s]*", str(text or ""))}


def invented_numbers(filled: dict, shot: dict) -> list[str]:
    """Numbers the model produced that the narration never said.

    A documentary that puts a figure on screen the narrator did not say is
    worse than one with a blank space. Anything not traceable to the script
    line, the note, or a prop already decided is reported so it can be
    refused rather than rendered.
    """
    allowed = numbers_in(shot.get("scriptLine", "")) | numbers_in(shot.get("note", ""))
    for value in (shot.get("props") or {}).values():
        allowed |= numbers_in(value)

    out = []
    for key, value in filled.items():
        if not isinstance(value, (int, float, str)):
            continue
        for found in numbers_in(value):
            # a small number is usually a count or an index, not a claim
            if len(found) < 3 or found in allowed:
                continue
            if any(found in a or a in found for a in allowed):
                continue
            out.append(f"{key}={found}")
    return out
