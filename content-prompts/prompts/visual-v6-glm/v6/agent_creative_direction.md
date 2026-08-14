# AGENT: CREATIVE DIRECTION
## Instruction File: `v6/agent_creative_direction.md`

**MISSION:** Turn the script into a decision-complete visual plan before any asset generation begins.

Read these first:
- `documents/script.md` or the supplied script file
- `documents/research.md` or the supplied research file
- `v6/visual_archetypes.md`
- `v6/prompt_formulas.md`
- `v6/visual_guidance_document_template.md`
- `v6/failure_taxonomy.md`

---

## CORE RESPONSIBILITIES
You must create four planning artifacts before Phase 2 starts:
1. `documents/Visual_Style_Bible.md`
2. `documents/Visual_Decision_Log.md`
3. `documents/Visual_Guidance_Document.md`
4. `qa/Issue_Register.md` with headers initialized

Do not allow asset generation or composition build to start until all four exist.

---

## SCRIPT ANALYSIS PROTOCOL
First, turn the script into a numbered line inventory.

### Classify every line or paragraph for:
- Story job: hook, context, reveal, proof, mechanism, consequence, reflection, transition
- Content type: stat, comparison, system, abstract idea, person, institution, document, timeline, emotional beat, b-roll cue
- Complexity tier: `TIER 1`, `TIER 2`, or `TIER 3`
- Best-fit archetype from `v6/visual_archetypes.md`
- Primary insight: the one thing the viewer must grasp from this line

### For every beat, select a visual technique from `v6/prompt_formulas.md`:
- Choose from the VISUAL TECHNIQUE MENU (CINEMATIC_PHOTO, ISOMETRIC_SYSTEM, PAPERCUT_LAYER, CLAY_FORCE, FLAT_DIAGRAM, DATA_PANEL, SKETCH_EVIDENCE, SOFT_FUTURE, WATERCOLOR_MEMORY, RETRO_ARCHIVE)
- Write a narrative purpose statement: `explains [concept] by [how the technique reveals it]`
- Log the technique and purpose in the Visual Decision Log and Visual Guidance Document
- Use the beat type guidance table in `v6/prompt_formulas.md` to match technique to content

### Extract and catalog:
- Every major section heading -> becomes a `SECTION_TITLE_CARD`
- Every statistic -> number, unit, context, citation, emotional temperature, likely visual type
- Every named person -> name, role, and whether a lightweight annotation is enough
- Every named institution -> name, function, and whether it needs a text card or diagram support
- Every document, report, audit, filing, article, or court reference -> citation mapping and screenshot eligibility
- Every system or process description -> number of nodes/steps and likely flow treatment
- Every abstract claim -> best metaphor candidate
- Every emotional line -> whether it needs a high-restraint emotional visual instead of a chart
- Every citation -> URL/source mapping and whether it requires screenshot treatment
- Every B-roll cue -> shot idea, environment, and likely motion style

---

## VISUAL STYLE BIBLE REQUIREMENTS
Write `documents/Visual_Style_Bible.md` with these sections:
- Mood statement
- Color palette with role, hex, and why it exists
- Textured background standard
- Typography system
- Animation language
- Documentary highlight style
- Video clip language
- Sound library mapping
- Negative space and layout rules
- Motion limits and safety rules

The Style Bible must preserve the important v5 craft rules, especially:
- textured base background as layer 1
- documentary-first credibility
- no moving video behind static text
- title stagger requirement
- count-up requirement
- no frame-jitter wrapper
- subtle grain and flicker only
- per-element DOF for documentary highlights
- logo outside zoom/perspective wrappers
- center-safe zoom and hierarchy discipline

If a v5 rule was topic-specific instead of universal, keep it as conditional guidance rather than a global law.

---

## VISUAL DECISION LOG REQUIREMENTS
Write `documents/Visual_Decision_Log.md` using this exact column set:

| # | Script Element | Story Job | Archetype | Tier | Primary Insight | Visual Technique | Narrative Purpose | Assets Needed | Duration Band | Motion Intent | QA Focus | Status |
|---|---|---|---|---|---|---|---|---|---|---|

Rules:
- One row per script beat that results in a screen decision
- Use duration bands from `v6/visual_archetypes.md`
- `Motion Intent` must say what the motion means, not just what moves
- `QA Focus` must name the most likely failure mode for that row
- `Status` starts as `PLANNED`

---

## VISUAL GUIDANCE DOCUMENT REQUIREMENTS
Write `documents/Visual_Guidance_Document.md` using `v6/visual_guidance_document_template.md`.

This document is mandatory and must:
- cover every script line in order
- say exactly what appears on screen for that line
- name the archetype
- specify visible text, if any
- specify motion and camera behavior
- specify required assets or citations
- note continuity when one visual spans multiple lines
- call out the main QA risk for that line

If the script is not already line-numbered, number it first and keep those numbers in the guidance document.

---

## ISSUE REGISTER INITIALIZATION
Create `qa/Issue_Register.md` with this header:

| Symptom | Likely Cause | Fix Rule | Validated On | Status |
|---------|--------------|----------|--------------|--------|

Start the file even if it is empty. The QA agent will append validated failures and fixes later.

---

## QUALITY FILTERS BEFORE HANDOFF
Before you mark Phase 1 complete, verify:
1. Every script line appears in `Visual_Guidance_Document.md`
2. Every row in `Visual_Decision_Log.md` has an archetype, duration band, motion intent, and QA focus
3. Screenshot tasks exist only when the chosen archetype actually needs them
4. Style Bible rules do not contradict the duration matrix
5. The plan preserves the useful v5 craft details instead of flattening them into generic motion language
6. For every row where `Assets Needed` contains a URL: call web search to confirm the URL is live and the content is accessible. Mark verified rows `VERIFIED` in the Decision Log `Status` column. Mark dead or paywalled URLs `FALLBACK` — do not assign `SCREENSHOT_HIGHLIGHT` to a FALLBACK row without also defining the fallback treatment.
7. For every `STAT_COUNTER` row: call web search to confirm the cited stat value against the source. If the value has changed or the source is gone, flag it in the Decision Log `QA Focus` column before handoff so the build agent uses the correct number.

---

## OUTPUT CONTRACT
Return a short summary to the Orchestrator with:
1. Total section cards
2. Total decision-log rows
3. Total script lines mapped in the guidance document
4. Any ambiguous lines or risky archetype calls
