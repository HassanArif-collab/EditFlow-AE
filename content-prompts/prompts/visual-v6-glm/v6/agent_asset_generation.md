# AGENT: ASSET GENERATION
## Instruction File: `v6/agent_asset_generation.md`

**MISSION:** Generate or capture only the assets needed by the approved planning documents.

Read these first:
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `v6/prompt_formulas.md`
- `v6/visual_archetypes.md`
- `v6/failure_taxonomy.md`

---

## GLOBAL RULES
1. Do not generate assets that are not called for by the decision log or guidance document.
2. Log every created file to `qa/agent_log.txt` using:
   - `[AGENT] [TIMESTAMP] [FILE] [STATUS: OK/FALLBACK/REGEN/BLOCKED/FAILED] [NOTE]`
3. Keep generated imagery text-free unless the asset is a recreated document that intentionally contains designed text added later by the composition layer.
4. Maintain palette discipline from the Style Bible.
5. If a screenshot is unreadable, blocked, or paywalled, log it and use the approved fallback path instead of stalling.

---

## ASSET TYPES

### 1. Screenshots and Source Crops

Only for rows with archetype `SCREENSHOT_HIGHLIGHT` or `DOC_HIGHLIGHT`.

**Browser automation sequence — run this for each required source URL:**
1. Call z.ai browser tool → navigate to the citation URL
2. Check page state — if paywalled, 404, or blank → jump to step 5
3. Scroll to the cited sentence, table, or stat
4. Capture full-page screenshot → `assets/screenshots/{ref_id}_full.png`
5. Capture a tight crop of the cited element → `assets/screenshots/{ref_id}_crop.png`
6. Capture the source logo (header or favicon region) → `assets/logos/{source_name}_logo.png`

**If blocked at any step:**
- Save whatever is visible
- Log: `[ASSET] BLOCKED {url} — {reason} → fallback eligible`
- Mark row status as `FALLBACK` in `phase_state.txt`
- Proceed using FALLBACK DOCUMENT RECREATION FORMULA from `v6/prompt_formulas.md`

### 2. Generated Still Images
Generate still images only for:
- `GSAP_METAPHOR`
- `GSAP_METAPHOR+IMAGE`
- `EMOTIONAL_MOMENT`
- fallback document recreations
- any explicit background texture tasks approved by the decision log

Requirements:
- no readable text
- no fake watermark
- no fake news-style logo
- one clear focal concept
- negative space preserved for any future overlay text if the archetype needs it
- visual technique must match the row's chosen technique from the Visual Decision Log

**Tool invocation:**
1. Read the row's `Visual Technique` and `Narrative Purpose` from the Visual Decision Log
2. Build prompt using IMAGE PROMPT FORMULA from `v6/prompt_formulas.md` — fill `[TECHNIQUE]`, `[Narrative purpose]`, `[Archetype]`, `[Subject]`, `[BG_HEX]`, `[TEXT_HEX]`, `[ACCENT_HEX]` from the Style Bible
3. Call z.ai image generation tool with that prompt
3. Run the Prompt Hardening Checklist — if any item fails, refine prompt and regenerate once
4. If text artifact persists after one retry → log `REGEN_FAILED`, switch to FALLBACK DOCUMENT RECREATION FORMULA

If text artifacts appear, regenerate immediately.

### 3. Standalone Video and Image-to-Video
Generate video only for:
- `BROLL_VIDEO`
- `EMOTIONAL_MOMENT` when animated stills are approved
- any guidance-document row that explicitly calls for standalone video

Rules:
- observational documentary tone
- no ad aesthetic
- no moving background under text
- no presenter-to-camera unless the guidance document explicitly asks for it
- prefer subtle camera movement over dramatic movement

**Tool invocation:**
- **BROLL_VIDEO:** Read the row's `Visual Technique` and `Narrative Purpose` from the Visual Decision Log. Build prompt using VIDEO PROMPT FORMULA from `v6/prompt_formulas.md` (prepend Visual technique + Narrative purpose) → call z.ai video generation tool
- **Image-to-video fallback:** Read the row's technique + purpose. Pass the generated still + IMAGE-TO-VIDEO FORMULA (prepend Visual technique + Narrative purpose) → call z.ai image-to-video tool
- Accept only if: no on-screen text, documentary tone, clip fits the archetype duration band
- If video generation fails → automatically fall back to image-to-video using the still from Fix 2
- If image-to-video also fails → log `BLOCKED`, use GSAP_METAPHOR archetype as substitute

### 4. Sound Library Verification
Verify these files exist:
- `assets/audio/snd_appear.mp3`
- `assets/audio/snd_sweep.mp3`
- `assets/audio/snd_impact.mp3`
- `assets/audio/snd_ambient_bed.mp3`
- `assets/audio/snd_transition.mp3`
- `assets/audio/snd_tick.mp3`

If any are missing, regenerate them using the canonical script or equivalent generation path and log the repair.

---

## FALLBACK LOGIC
- Unreadable or blocked screenshot -> document recreation or text-only citation treatment if approved by the decision log
- Bad generated image -> regenerate once with tighter negatives before changing the concept
- Bad video generation -> use image-to-video if the scene still works as a static composition with subtle motion
- Asset still fails after two prompt refinements -> log to `qa/Issue_Register.md` and continue with the least-risk fallback

---

## PRE-HANDOFF CHECK
Before handing assets to the build agent, confirm:
1. Every asset in `Assets Needed` exists or has a logged fallback
2. No extra orphan assets were created
3. File names match the references used in the guidance document
4. All generated imagery stays text-free and stylistically aligned

---

## OUTPUT CONTRACT
Return a short summary with:
1. Total screenshots captured
2. Total generated stills
3. Total video clips
4. Any blocked sources
5. Any rows that must use fallback assets
