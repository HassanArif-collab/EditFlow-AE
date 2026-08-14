> **App Connection Note (v7)**: This file is read by the AI agent via the Documentary Studio app's
> `/api/prompts/visual-v7-glm/<filename>` endpoint. The agent fetches it when needed —
> you don't need to paste it in chat.
> See `Visuals Generation Prompt v7.md` for the full app connection protocol.

# AGENT: CREATIVE DIRECTION
## Instruction File: `v7/agent_creative_direction.md`

**MISSION:** Turn the script into a decision-complete visual plan before any asset generation begins.

Read these first:
- `documents/script.md` or the supplied script file
- `documents/research.md` or the supplied research file
- `v7/visual_archetypes.md`
- `v7/prompt_formulas.md`
- `v7/visual_guidance_document_template.md`
- `v7/failure_taxonomy.md`
- `v7/agent_visual_planner.md` (for shotlist output)

---

## CORE RESPONSIBILITIES
You must create four planning artifacts before Phase 2 starts:
1. `documents/Visual_Style_Bible.md`
2. `documents/Visual_Decision_Log.md`
3. `documents/Visual_Guidance_Document.md`
4. `remotion/src/shotlist.json` (via Visual Planner)
5. `qa/Issue_Register.md` with headers initialized

Do not allow asset generation or composition build to start until all exist.

---

## SCRIPT ANALYSIS PROTOCOL
Turn the script into a numbered line inventory.

### Classify every line or paragraph for:
- Story job: hook, context, reveal, proof, mechanism, consequence, reflection, transition
- Content type: stat, comparison, system, abstract idea, person, institution, document, timeline, emotional beat, b-roll cue
- Complexity tier: `TIER 1`, `TIER 2`, or `TIER 3`
- Best-fit archetype from `v7/visual_archetypes.md`
- Primary insight: the one thing the viewer must grasp

### Extract and catalog:
- Every major section heading -> `SECTION_TITLE_CARD`
- Every statistic -> number, unit, context, citation, emotional temperature, likely visual type
- Every named person -> name, role, annotation type
- Every named institution -> text card or diagram support
- Every document, report, audit, filing, article -> citation mapping and screenshot eligibility
- Every system or process description -> number of nodes/steps and flow treatment
- Every abstract claim -> best metaphor candidate
- Every emotional line -> whether it needs a high-restraint emotional visual instead of a chart
- Every citation -> URL/source mapping and screenshot treatment
- Every B-roll cue -> shot idea, environment, motion style

---

### Visual Technique and Narrative Purpose
For every beat, defer the per-line Visual Technique + Narrative Purpose assignment to `v7/agent_visual_planner.md` (which produces `shotlist.json`). Creative Direction only sets the **global** technique palette and beat-type guidance in `documents/Visual_Style_Bible.md`. The planner assigns the per-line technique based on that palette.

---

## VISUAL STYLE BIBLE REQUIREMENTS
Write `documents/Visual_Style_Bible.md` with these sections:
- Mood statement
- Rendering family (ONE per film — the Aesthetic Lock) + palette
- **Story cast** — the film's 2-4 agent-icons (e.g. the household, the ministry, the IMF):
  icon design, one-line motive each. The SAME icons appear in every map/diagram shot so
  viewers track them like characters; they may speak in short dialogue chips.
- **Hero anchors** — the 2-3 recurring objects of the film (the bill, the vacancy ad…)
  and where they return: opening chain → mid-act callback → reveal → closing image.
- Color palette with role, hex, and why
- Textured background standard
- Typography system (Inter + Fraunces, OKLCH)
- Animation language (Remotion spring/interpolate)
- Documentary highlight style
- Video clip language
- Sound library mapping + **per-act emotional tone direction** (the cold open gets an
  explicit sound direction, e.g. "slow-mo, suspenseful, one deep impact on the cut")
- Negative space and layout rules
- Motion limits and safety rules

The Style Bible must preserve the important v5 craft rules, especially:
- textured base background as layer 1
- documentary-first credibility
- no moving video behind static text
- title stagger requirement
- count-up requirement
- no frame-jitter wrapper
- subtle STATIC grain only — flicker/oscillation is banned (stability rules); texture is frame-locked
- per-element DOF for documentary highlights
- logo outside zoom/perspective wrappers
- center-safe zoom and hierarchy discipline
- 2.5D parallax (foreground 1.5x, midground 1.0x, background 0.5x)
- kinetic typography (masked reveals, not opacity fades)

If a v5 rule was topic-specific instead of universal, keep it as conditional guidance rather than a global law.

---

## VISUAL DECISION LOG REQUIREMENTS
Write `documents/Visual_Decision_Log.md`:

| # | Script Element | Story Job | Archetype | Tier | Primary Insight | Assets Needed | Duration Band | Motion Intent | QA Focus | Status |
|---|---|---|---|---|---|---|---|---|---|---|

One row per script beat. Duration bands from `v7/visual_archetypes.md`. Status starts as `PLANNED`.

Rules:
- `Motion Intent` must say what the motion means, not just what moves. (e.g., "growing separation" not "slide in from left")
- `QA Focus` must name the most likely failure mode for that row.

---

## VISUAL GUIDANCE DOCUMENT REQUIREMENTS
Write `documents/Visual_Guidance_Document.md` using the template. Must:
- cover every script line in order
- say exactly what appears on screen
- name the archetype
- specify visible text, motion and camera behavior, required assets
- call out the main QA risk

---

## PLANNER HANDOFF
After creating planning documents, run the Visual Planner (`v7/agent_visual_planner.md`) to produce `remotion/src/shotlist.json`.

---

## QUALITY FILTERS BEFORE HANDOFF
Before marking Phase 1 complete, verify:
1. Every script line appears in `Visual_Guidance_Document.md`
2. Every row has an archetype, duration band, motion intent, and QA focus
3. Screenshot tasks exist only when the chosen archetype actually needs them
4. Style Bible rules do not contradict the duration matrix
5. The plan preserves the useful v5 craft details instead of flattening them into generic motion language
6. For every URL asset: confirm the URL is live and accessible. Mark verified rows `VERIFIED`. Mark dead/paywalled URLs `FALLBACK`.
7. For every `STAT_COUNTER` row: confirm the cited stat value against the source.

---

## OUTPUT CONTRACT
Return a short summary with:
1. Total section cards, decision-log rows, script lines mapped
2. Any ambiguous lines or risky archetype calls
3. Shotlist.json summary (total shots, credit estimate)
