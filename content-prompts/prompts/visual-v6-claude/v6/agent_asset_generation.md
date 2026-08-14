# AGENT: ASSET GENERATION
## Instruction File: `v6/agent_asset_generation.md`

**MISSION:** Generate or capture only the assets needed by the approved planning documents.

Read these first:
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `v6/prompt_formulas.md`
- `v6/visual_archetypes.md`
- `v6/browser_runtime.md`
- `v6/browser_capabilities.md`
- `tools/visual_tool_router.js` when turning shot metadata into a `BROWSER TASK`

---

## GLOBAL RULES
1. Do not generate assets that are not called for by the decision log or guidance document.
2. Log every created file to `qa/agent_log.txt`.
3. Keep generated imagery text-free unless it's a recreated document with designed text.
4. Maintain palette discipline from the Style Bible.
5. If a screenshot is blocked or paywalled, log it and use the approved fallback path.

---

## BROWSER TASK CONTRACT
Any Dreamina, Google Flow, ChatGPT image, or browser-only source capture must be expressed as a `BROWSER TASK` before execution:

```json
{
  "capability": "dreamina.still_image | dreamina.multiframes | flow.frames_to_video | flow.ingredients_to_video | flow.omni_edit | flow.image_model | browser.source_capture",
  "inputs": {},
  "required_ui_state": [],
  "credit_risk": "",
  "allow_credit_spend": false,
  "success_criteria": [],
  "outputs": [],
  "fallback": ""
}
```

Agents may dry-run configure a browser tool into a ready-to-generate state. They must not click final Generate/Create/Submit unless the decision log calls for that asset and `allow_credit_spend` is true.

Use `tools/visual_tool_router.js` to create or validate the `capability`, model, auth/scout flags, and planned credits whenever the shot metadata is available.

If a required control is missing, enter Scout Mode from `v6/browser_runtime.md`; do not guess through coordinate clicks.

Current UI cautions from logged-in scout:
- Dreamina defaults to `AI Agent`. A Dreamina task is not ready unless the prompt chip visibly confirms `AI Image` or `AI Video` as required. If it remains `AI Agent`, stop with `LOW_CONFIDENCE_UI`.
- Dreamina GPT Image 2 / ChatGPT Image 2 is the required still-image route. It must be selected from the normal `AI Image` model menu; AI Agent does not expose GPT Image 2. Current visible labels may include `Seedream 4.1`, `Image 4.1`, and `Seedance 2.0`; record what is visible, but do not silently generate with Image 4.1. If GPT Image 2 is not visible in the image model menu, stop with `LOW_CONFIDENCE_UI`.
- Dreamina GPT Image 2 creates 4 images per generation, not 1. Treat each run as a batch spend, use it only for high-leverage stills, and download/select the strongest variant.
- Dreamina GPT Image 2 aspect order: select a non-GPT image model first, set `16:9`, then switch to GPT Image 2. Generate only after the bottom chips show `AI Image`, `GPT Image 2`, and `16:9`.
- Dreamina image mode is verified usable: click the visible `AI Image / Seedream 4.1` card, wait for `Describe your image`, then verify `AI Image`, model, 16:9, quality, and the active `2/image`-style cost beside the submit arrow.
- Flow may show a `Maps Imagery Grounding` onboarding modal after `New project`; dismiss `Get started`, then verify the project prompt bar before configuring.
- Flow's settings chip should expose Image/Video, Frames/Ingredients, aspect, multiplier, model, duration, and a visible credit estimate. Budget Flow frame-video and ingredients-video as 4s/6s/8s/10s = 7/10/12/15 credits, with Veo 3.1 Lite/Fast/Quality = 10/20/100 credits. Log the visible estimate before any authorized spend.
- Flow Nano Banana 2/Pro image creation can be used repeatedly for start frames and refinements; still verify the selected model in the UI before batch use.

---

## ASSET TYPES

### 1. Screenshots and Source Crops (article_capture.js)
Only for rows with archetype `SCREENSHOT_HIGHLIGHT` or `DOC_HIGHLIGHT`.

Run a `browser.source_capture` task, backed by `article_capture.js`, for each required URL:
- Navigate to citation URL
- Scroll to the cited sentence, table, or stat
- Capture full-page screenshot → `public/screenshots/{ref_id}_full.png`
- Capture tight crop of cited element → `public/screenshots/{ref_id}_crop.png`
- Capture source logo → `public/logos/{source_name}_logo.png`

If blocked: log `[ASSET] BLOCKED {url}` and mark row status `FALLBACK`. Use FALLBACK DOCUMENT RECREATION FORMULA.

### 2. Generated Still Images (Dreamina)
Generate still images only for: `GSAP_METAPHOR`, `EMOTIONAL_MOMENT`, fallback document recreations.

Requirements: no readable text, no fake watermark, no fake logo, one clear focal concept, negative space preserved for overlay text.

**Tool:** `BROWSER TASK` capability `dreamina.still_image` using shared Edge and the current UI map.
**Prompt:** Build using IMAGE PROMPT FORMULA from `v6/prompt_formulas.md`
**State gate:** Continue only when Dreamina confirms GPT Image 2 / ChatGPT Image 2 in the `AI Image` model menu and the bottom chips show `AI Image`, `GPT Image 2`, and `16:9`. AI Agent is not a GPT Image 2 route. Stop with `LOW_CONFIDENCE_UI` if the model/aspect cannot be confirmed.
**Credit gate:** Log the active cost from the bottom prompt controls, not from older generation-history text.
**Retry:** If text artifacts appear, regenerate once. If still fails, log `REGEN_FAILED` and switch to fallback.

### 3. Standalone Video and Image-to-Video
Generate video only for: `BROLL_VIDEO`, `EMOTIONAL_MOMENT` (approved animated stills).

**Tool:** `BROWSER TASK` capability `flow.frames_to_video`, `flow.ingredients_to_video`, `flow.omni_edit`, or `dreamina.multiframes`.
**Prompt:** Use VIDEO PROMPT FORMULA
**Rules:** Observational documentary tone, no ad aesthetic, no moving background under text.
**Gate:** No Flow/Dreamina video task may run without an approved start frame unless the decision log explicitly waives the image-first rule.
**State gate:** Flow is ready only after the project prompt bar and settings chip are visible; Dreamina is ready only after `AI Video`/`Seedance` is visible in the prompt controls.

If video generation fails → fall back to image-to-video using the generated still. If that also fails → log `BLOCKED`, use `GSAP_METAPHOR` as substitute.

### 4. Pexels B-Roll
Search Pexels for specific documentary footage. Search terms must be specific (not "Pakistan economy" — "Karachi port container crane shot"). Download to `public/video/`.

### 5. Lottie Files
If the shotlist calls for a Lottie accent:
- Source from lottiefiles.com or provide a JSON URL
- Download to `public/lottie/{name}.json`
- Wired via `@remotion/lottie` component

### 6. Sound Library Verification
Verify these files exist in `public/audio/`:
- `snd_appear.mp3`, `snd_sweep.mp3`, `snd_impact.mp3`, `snd_ambient_bed.mp3`, `snd_transition.mp3`, `snd_tick.mp3`

If missing, generate or source them.

---

## FALLBACK LOGIC
- Blocked screenshot → document recreation or text-only citation
- Bad generated image → regenerate once with tighter negatives
- Bad video → use image-to-video
- Asset still fails after 2 refinements → log to `qa/Issue_Register.md` and continue with least-risk fallback

---

## PRE-HANDOFF CHECK
1. Every asset in `Assets Needed` exists or has a logged fallback
2. No extra orphan assets created
3. File names match references in guidance document
4. All generated imagery stays text-free and stylistically aligned

---

## OUTPUT CONTRACT
Return a short summary with:
1. Total screenshots captured, generated stills, video clips
2. Any blocked sources or fallbacks used
