# Browser Capabilities v6

This file teaches the agents what each browser tool lane does. It is intentionally capability-based, not a complete UI manual.

---

## Capability Card Format

Every browser asset task should resolve to:

```json
{
  "capability": "tool.capability_name",
  "inputs": {},
  "required_ui_state": [],
  "credit_risk": "",
  "success_criteria": [],
  "outputs": [],
  "fallback": ""
}
```

The Browser Operator Agent uses these cards with `browser_runtime.md` and the current UI map.

---

## Verified Logged-In UI Notes

Last checked with the user's Edge profile on 2026-06-26:

- Dreamina home shows `AI Agent` as the default prompt mode, with visible cards for `AI Video / Seedance 2.0`, `AI Image / Seedream 4.1`, `AI Avatar / OmniHuman`, `Canvas`, and `Dreamina Octo`.
- Dreamina credit badge was visible as `120`. Do not log account details beyond this generic visible credit count.
- Dreamina `AI Image` switching is expected to work with a simple visible click; the prior dry scout failed because the automation clicked the wrong mode surface. Treat image mode as usable once the prompt chip visibly says `AI Image`.
- Focused Dreamina image probe verified `AI Image` on 2026-06-26: click the visible `AI Image / Seedream 4.1` card, wait for the bottom prompt to say `Describe your image`, then confirm chips `AI Image`, model, aspect, quality, and active cost.
- Current Dreamina image model menu showed `Image 5.0 Lite`, `Image 4.7`, `Image 4.6`, `Image 4.5`, and `Image 4.1`; selected header read `Generate with: Image 4.1 by Seedream 4.0 Design`.
- Dreamina still-image routing rule from the operator: always use `GPT Image 2` / `ChatGPT Image 2` for Dreamina image creation. GPT Image 2 must be selected from the normal `AI Image` model menu; `AI Agent` does not expose GPT Image 2 and is not a fallback for this model. GPT Image 2 generates a 4-image batch, so treat one generation as a batch spend and use it only for high-leverage stills.
- GPT Image 2 aspect-order rule: 16:9 can be hidden after selecting GPT Image 2. Select a non-GPT image model such as Image 4.1 first, set 16:9, then switch the model to GPT Image 2. Before Generate, the bottom chips must show `AI Image`, `GPT Image 2`, and `16:9` together.
- Current Dreamina aspect/quality menu showed Auto, 21:9, 16:9, 3:2, 4:3, 1:1, 3:4, 2:3, 9:16, High (2K), Ultra (4K), and custom width/height. A 16:9 High (2K) test showed 2560x1440 and `2/image`.
- Dreamina `AI Video` switching was not fully reliable in the dry scout. Treat video mode as `requiresScout: true` and stop with `LOW_CONFIDENCE_UI` unless the prompt chip visibly says `AI Video`/`Seedance`.
- Google Flow dashboard shows `New project`; first project entry can show a `Maps Imagery Grounding` onboarding modal with `Get started`.
- Google Flow project workspace shows a prompt box, `+` upload/add button, `Agent` chip, and a `Video 4s 1x` settings chip.
- Google Flow settings chip exposes `Image`/`Video`, `Frames`/`Ingredients`, `9:16`/`16:9`, `1x`/`2x`/`3x`/`4x`, model dropdown currently showing `Omni Flash`, and durations `4s`/`6s`/`8s`/`10s`.
- The logged-in Flow UI showed `Generating will use 7 credits` for the observed `Video + 16:9 + 1x + Omni Flash + 4s` setup. Use the visible UI as the final credit source because pricing can drift.
- Operator-provided Flow budget table: Flow video with start/end frame or start-only frame costs 4s = 7 credits, 6s = 10 credits, 8s = 12 credits, 10s = 15 credits; Ingredients uses the same duration table. Veo 3.1 Lite/Fast/Quality costs 10/20/100 credits. Flow Nano Banana 2/Pro image generation is treated as unlimited for planning, with live UI still checked before batch use.

---

## `dreamina.still_image`

Purpose: Generate 16:9 still images for start frames, emotional moments, metaphors, and background plates.

Use when:

- GPT Image 2 reliability is needed.
- The shot needs text-free editorial imagery, a diagram plate, or a start frame for later motion.
- The planned output can tolerate Dreamina's free-tier AI badge being cropped or overscanned in Remotion.

Required UI state:

- Dreamina loaded and logged in.
- `AI Image` or equivalent image-generation lane active.
- Model rule: always select `GPT Image 2` / `ChatGPT Image 2` for Dreamina still-image creation.
- Selection order: set 16:9 while a non-GPT image model is active, then switch to GPT Image 2.
- Current logged-in UI may expose `AI Image / Seedream 4.1` and an `Image 4.1` chip; use those labels as UI evidence, not as a replacement for the GPT Image 2 routing preference.
- If GPT Image 2 is hidden in the AI Image model menu, stop with `LOW_CONFIDENCE_UI`; do not use AI Agent as a substitute and do not silently generate with Image 4.1.
- Aspect ratio set to `16:9`.
- Bottom chips verified together: `AI Image`, `GPT Image 2`, `16:9`.
- Prompt box contains the final image prompt from `prompt_formulas.md`.
- Automation confidence check: the bottom prompt chip must visibly say `AI Image`, not `AI Agent`, before any generation.
- Active-cost check: read the cost beside the submit arrow (for example `2/image`) from the bottom prompt area, not older generation history.
- Batch rule: GPT Image 2 currently produces 4 images per generation. Plan/select the best variant from the batch; do not spend GPT batches for routine exploration.

Success criteria:

- Generation row appears for the submitted prompt.
- A 4-image GPT Image 2 batch appears for the submitted prompt and at least one image URL or downloadable asset is found.
- Saved file lands in the requested asset directory.
- QA confirms no readable text, fake logo, or unwanted watermark beyond known AI badge crop area.

Fallback:

- Retry once with tighter negative requirements only after GPT Image 2 / ChatGPT Image 2 is confirmed.
- If still weak, use Flow Nano Banana for photoreal/character images or switch to Remotion-only `LIVING_STILL` fallback.

---

## `dreamina.multiframes`

Purpose: Generate one continuous motion sequence from multiple keyframes.

Use when:

- A shot needs a journey, morph, multi-scene progression, or 2-10 keyframes.
- Dreamina/Seedance region and account access are already working.
- Flow Frames/Ingredients is not the better fit.

Known capability:

- Dreamina Multiframes supports up to 10 keyframes and up to 54-second outputs.
- Each frame should have consistent lighting, style, composition, and subject placement.
- Frame duration can guide pacing.
- Camera prompts such as slow push, pan, orbit, and follow guide motion.

Required UI state:

- `AI Video` or equivalent video lane active.
- Seedance / video model lane selected.
- `Single-frame` or `Multiframes` mode selected as required.
- 2-10 keyframes uploaded or selected.
- Frame order and durations reviewed.
- Motion prompt references the camera plan from the shotlist.
- Automation confidence check: the prompt chip or selected card must visibly confirm `AI Video`/`Seedance`; if the prompt chip remains `AI Agent`, stop with `LOW_CONFIDENCE_UI`.

Success criteria:

- Generated video completes.
- Downloaded video is saved in `public/video/` or the requested asset path.
- QA confirms continuity, no text artifacts, no character drift beyond acceptable limits.

Fallback:

- Use Flow `frames_to_video` for one or two frames.
- Use Flow `ingredients_to_video` for identity/environment/style lock.
- Use Remotion parallax if in-shot generative motion is not worth the risk.

---

## `flow.frames_to_video`

Purpose: Animate a start frame, or transition from a start frame to an end frame.

Use when:

- The pipeline has already approved one or two start frames.
- The shot needs image-first motion.
- The default economical motion model is acceptable.

Required UI state:

- Google Flow project open.
- If the `Maps Imagery Grounding` onboarding modal appears, dismiss it with `Get started` before looking for generation controls.
- Standard prompt box available.
- Model/settings opened from the prompt box.
- `Video` selected.
- `Frames` selected.
- Start frame uploaded or selected.
- End frame uploaded or selected only when the shot requires a controlled transition.
- Aspect ratio set to 16:9 unless the project explicitly says otherwise.
- Duration and model tier selected from the plan.
- The settings chip should visibly expose Image/Video, Frames/Ingredients, 9:16/16:9, 1x-4x, model, and 4s/6s/8s/10s options.

Default model policy:

- Use Veo 3.1 Lite for ordinary image-first animation.
- Use Veo 3.1 Fast only when the plan accepts the extra cost.
- Do not use Veo 3.1 Quality in a single-day free-budget plan unless explicitly approved.
- Flow frame-video duration budget: 4s = 7 credits, 6s = 10 credits, 8s = 12 credits, 10s = 15 credits.
- If the runtime UI shows a different model/cost than this card, trust the visible UI and log the difference before spending credits.

Success criteria:

- Generated clip completes.
- Clip is downloaded or saved to project and then retrieved.
- Motion preserves the start frame's subject, composition, and palette.

Fallback:

- Switch to Remotion parallax/Ken Burns when generative motion is unnecessary.
- Use Dreamina Multiframes for 2-10 frame journey shots.

---

## `flow.ingredients_to_video`

Purpose: Generate a clip using visual references for subject, environment, style, or object consistency.

Use when:

- Character identity, product/object consistency, or visual style needs to be locked.
- Up to 3 reference images can define subject, environment, and style.

Required UI state:

- Google Flow project open.
- Dismiss any onboarding modal before configuration.
- Model/settings opened from the prompt box.
- `Video` selected.
- `Ingredients` selected.
- Duration credit budget uses the same Flow table as Frames: 4s = 7, 6s = 10, 8s = 12, 10s = 15 credits.
- References added in meaningful order:
  1. identity-defining subject or object
  2. environment or scene
  3. style, grade, or texture
- Prompt states the role of each ingredient.

Success criteria:

- Generated clip preserves the intended identity/world/style.
- No unplanned extra subject dominates the clip.
- Output is saved to the requested video path.

Fallback:

- Use Nano Banana to make a cleaner start frame, then `flow.frames_to_video`.
- Use Remotion compositing if consistency is more important than generated motion.

---

## `flow.omni_edit`

Purpose: Surgical editing of uploaded or generated video clips.

Use when:

- A real or generated clip needs a targeted change: relight, add object, remove object, wardrobe change, background adjustment, or camera-style refinement.
- The edit is worth the high credit cost.

Required UI state:

- Google Flow project open.
- Gemini Omni Flash selected for video editing.
- Clip uploaded, selected, and trimmed to the permitted segment.
- Edit prompt is narrow and references what should remain unchanged.
- Optional ingredients added only when they clarify the edit.

Credit policy:

- Treat Omni Flash edit as scarce and surgical.
- Do not use it as a default animation path.
- Stop before generation unless `allow_credit_spend` is true.

Success criteria:

- Edit preserves original structure and subject.
- Requested change is visible.
- No unrelated objects, text, or style drift appear.

Fallback:

- Regenerate from start frame with Flow Frames/Ingredients.
- Patch in Remotion when the change is overlay/compositing-friendly.

---

## `flow.image_model`

Purpose: Create or edit start frames with Nano Banana 2 or Nano Banana Pro.

Use when:

- Photoreal cinematic lighting or character consistency matters more than text rendering.
- A recurring character, object, or scene needs iterative refinement.
- A Flow video task needs a better start frame.

Model policy:

- Nano Banana 2 is the standard fast/default image model.
- Nano Banana Pro is for Ultra-only or explicitly approved professional control.
- Operator budget rule: Flow Nano Banana 2/Pro image creation can be used repeatedly for start frames and refinements; still verify the visible model before large batches.
- Dreamina GPT Image 2 / ChatGPT Image 2 remains required for text/data/card-like stills in Dreamina.

Success criteria:

- Start frame matches the visual technique and narrative purpose from `prompt_formulas.md`.
- Identity/style consistency is suitable for downstream motion.
- Output has no unwanted text or logo.

Fallback:

- Use Dreamina GPT Image 2 / ChatGPT Image 2 for text/data/layout reliability.
- Use Remotion-designed graphics for all final on-screen typography and data.

---

## `browser.source_capture`

Purpose: Capture evidence pages, reports, article excerpts, and source crops.

Use when:

- The shot is `SCREENSHOT_HIGHLIGHT`, `DOC_HIGHLIGHT`, or `ARTICLE_DOC`.
- A real source is stronger than a recreated document plate.

Required UI state:

- Source URL opened in a browser tab.
- Cited sentence, table, or stat located.
- Full-page screenshot and tight crop captured.
- Sentence or paragraph bounds measured from DOM geometry when possible.

Success criteria:

- Screenshot, crop, and source metadata are saved.
- Highlight geometry is measured, not guessed by eye.

Fallback:

- If blocked or paywalled, log `[ASSET] BLOCKED {url}` and use the fallback document recreation formula.
