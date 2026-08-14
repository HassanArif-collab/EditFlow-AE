# Visual Guidance Document Template v6

This document is the line-by-line screen plan. It is not optional. Every script line must map to a visible on-screen treatment.

---

## Purpose
Use `documents/Visual_Guidance_Document.md` to answer:
- What does the viewer see for each line of voiceover?
- What text is visible on screen?
- What moves and why?
- Which asset or citation is required?
- What continuity is carried from the previous line?
- What is the main QA risk for this line?

If a script line is skipped here, it is considered unplanned.

---

## Required Workflow
1. Number the script lines if they are not already numbered.
2. Preserve script order.
3. Create one row per script line.
4. If one visual continues across several lines, repeat the visual with a continuity note instead of collapsing rows.
5. If one line needs two micro-beats, split it into `12a` and `12b` rather than losing detail.

---

## Required Structure

```markdown
# Visual Guidance Document - [Video Title]

## Global Notes
- [overall pacing note]
- [style note]
- [special continuity note]

| # | Script Line / Time | Voiceover Text | What Appears On Screen | Archetype | Visual Technique | Narrative Purpose | Visible Text | Motion / Camera | Assets / Citations | Transition In/Out | Duration | QA Focus | Continuity Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Line 1 | [exact script line] | [exact on-screen plan] | SECTION_TITLE_CARD | [technique from menu] | [explains what by how] | [headline/subtitle or NONE] | [staggered reveal, hold, exit] | [asset names or source refs] | [hard cut in / fade out / paper reveal] | 4.0s | [main risk] | [start of sequence] |
```

---

## Column Rules
- `Script Line / Time`: line number first. Add estimated time only if known.
- `Voiceover Text`: use the exact script line or a faithful excerpt.
- `What Appears On Screen`: be literal. Say what the viewer sees, not just the idea.
- `Archetype`: must match the decision log.
- `Visual Technique`: must match the chosen technique from the VISUAL TECHNIQUE MENU in `v6/prompt_formulas.md`.
- `Narrative Purpose`: must state why this technique explains this beat's concept.
- `Visible Text`: include all meaningful screen text or write `NONE`.
- `Motion / Camera`: explain what moves and why it moves.
- `Assets / Citations`: list screenshots, generated images, logos, or references needed.
- `Transition In/Out`: specify entry and exit behavior.
- `Duration`: use the approved band.
- `QA Focus`: one main risk only.
- `Continuity Note`: explain what carries over from the previous line, or say `NEW SHOT`.

---

## Good Example

```markdown
| 14 | Line 14 | "The audit found repeated contract inflation." | A close crop of the cited audit paragraph sits on an aged paper field. A yellow sweep slowly reveals the exact sentence while a red stat callout appears in the lower right. | DOC_HIGHLIGHT | SKETCH_EVIDENCE | explains the audit finding by presenting it as evidence under examination | "Repeated contract inflation" plus a small source/date line | Slow highlight sweep, gentle center-safe push, stat rises from below and counts up | `ref_07_audit_closeup.png`, `logo_auditor.png` | hard cut in / soft paper fade out | 8.5s | highlight misalignment | Continues the evidence sequence from line 13 |
```

---

## Final Check
Before locking the document:
1. Every script line is covered
2. Every archetype matches the decision log
3. Every row has a Visual Technique and Narrative Purpose filled in
4. No row says only "same as above" without restating what is visible
5. Visible text is explicit where text will appear
6. QA focus is specific enough to guide later review
