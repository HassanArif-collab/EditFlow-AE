# AI Tools Guide v6

This file documents the AI generation tools available to the v6 visual pipeline. The Visual Planner routes to these based on the shot requirement.

---

## BROWSER RUNTIME
- **Default browser:** shared Microsoft Edge profile via `v6/browser_runtime.md`
- **UI strategy:** capability cards from `v6/browser_capabilities.md` plus compact UI maps from Scout Mode
- **Executable routing:** `tools/visual_tool_router.js` maps shot/task metadata to capability, model, scout/auth flags, and planned credits
- **Rule:** Browser tasks configure tools semantically and verify state after each action; they do not rely on blind selectors or hidden account data
- **Credit gate:** final Generate/Create actions require an approved `BROWSER TASK` with `allow_credit_spend: true`

## DREAMINA (Still Generation + Multiframes)
- **Use for:** Cinematic stills, documentary imagery, background plates
- **Platform:** Dreamina / CapCut web app (browser-based)
- **Tool path:** `dreamina.still_image` and `dreamina.multiframes` browser capabilities
- **Prompt:** Use Image Prompt Formula from `prompt_formulas.md`
- **Model rule:** Always use GPT Image 2 / ChatGPT Image 2 for Dreamina image creation. Select it from the normal `AI Image` model menu; AI Agent does not expose GPT Image 2 and is not a fallback for it.
- **Current UI note:** logged-in scout shows `AI Agent` as default and cards for `AI Image / Seedream 4.1` and `AI Video / Seedance 2.0`; agents must verify the prompt chip says `AI Image` or `AI Video` before spending credits.
- **Verified image path:** Click the `AI Image / Seedream 4.1` card, wait for `Describe your image`, verify `AI Image`, model, 16:9, quality, and active cost beside the submit arrow. The 2026-06-26 probe showed Image 4.1, 16:9 High (2K), 2560x1440, and `2/image`; that Image 4.1 path is recorded as UI evidence only and is no longer an approved generation path unless GPT Image 2 is confirmed.
- **Visible image model menu:** Image 5.0 Lite, Image 4.7, Image 4.6, Image 4.5, Image 4.1. Select GPT Image 2 when visible. If it is not visible, stop and scout; do not use AI Agent and do not silently generate with Image 4.1.
- **Aspect order:** Set `16:9` while a non-GPT model such as Image 4.1 is active, then switch to GPT Image 2. Verify bottom chips show `AI Image`, `GPT Image 2`, and `16:9` together before Generate.
- **GPT Image 2 batch reality:** Dreamina GPT Image 2 creates 4 images per generation, not 1. Treat this as a batch spend, use it for high-leverage stills, and pick the strongest variant for the documentary.
- **Image-to-video:** Seedance Single-frame or Multiframes when account/region access is working
- **Multiframes:** Use 2-10 keyframes for journeys, morphs, multi-scene progression, or multi-angle continuity
- **Rules:** No readable text, no watermark, no fake logo, one focal concept
- **Caveat:** Dreamina video features and mode switching may be account/region/UI-state gated; prefer Flow for verified image-first motion when available

## GOOGLE FLOW (Image-First Video + Editing)
- **Use for:** Image-first animation, frames-to-video, ingredients/references, Omni Flash edits, Nano Banana start frames
- **Platform:** Google Flow / Labs Flow (browser-based)
- **Tool path:** `flow.frames_to_video`, `flow.ingredients_to_video`, `flow.omni_edit`, and `flow.image_model` browser capabilities
- **Prompt:** Use Video Prompt Formula or Image-to-Video Formula from `prompt_formulas.md`
- **Rules:** Start-frame-first for generated video, observational tone, no ad aesthetic, no moving background under static text
- **Models/features:** Veo 3.1 Lite/Fast/Quality, Gemini Omni Flash, Nano Banana 2, Nano Banana Pro, Frames, Ingredients/References, Extend, video editing
- **Credit costs:** Flow frame-video or ingredients-video costs 4s/6s/8s/10s = 7/10/12/15 credits. Veo 3.1 Lite/Fast/Quality = 10/20/100 credits. Flow Nano Banana 2/Pro image generation is treated as unlimited for planning, while the live UI remains the final check before batch use.
- **Current UI note:** logged-in scout reached a project workspace with prompt box, `+`, `Agent`, `Video 4s 1x`, and a settings popover for Image/Video, Frames/Ingredients, 9:16/16:9, 1x-4x, Omni Flash, and 4s/6s/8s/10s. The observed 4s Omni Flash setup showed `Generating will use 7 credits`; use the visible UI as final cost authority.
- **Budget default:** Start/end-frame or start-only Flow video at the duration budget above for ordinary motion; Veo 3.1 Quality only with explicit approval

## PEXELS (Stock Video)
- **Use for:** B-roll footage, environmental shots
- **Access:** pexels.com API or direct download
- **Rules:** Documentary credibility check — no overly staged stock footage
- **Search terms must be specific:** Not "Pakistan economy" — "Karachi port container crane shot"

## ARTICLE CAPTURE (Source Screenshots)
- **Use for:** DOC_HIGHLIGHT and SCREENSHOT_HIGHLIGHT
- **Tool:** `article_capture.js` (Playwright-based, in `_RnD_claude/`)
- **Captures:** Full page + tight crop of cited element + publication logo
- **Fallback:** Document recreation via prompt formula
- **Rules:** Real screenshots preferred over generated recreations

## LOTTIE (Premium Micro-Animations)
- **Use for:** Animated icons, accent elements, illustration motion
- **Integration:** `@remotion/lottie` npm package
- **Library:** lottiefiles.com or custom Lottie JSON
- **Rules:** Lightweight, single-purpose animations. Not decoration. Must improve clarity or emotion.
- **Only Lottie is wired.** Spline, Rive, Shader Gradient, Icons8 are not active tools.

## REMOTION COMPONENTS (Built on the Go)
- **Use for:** All data visuals (counters, charts, graphs, diagrams, titles)
- **Approach:** Build Agent creates each component per shot following specs in `visual_archetypes.md`
- **Stack:** React + `useVideoConfig` + `spring()` + `interpolate()`
- **Not pre-built:** Each archetype component is created when needed

---

## TOOL SELECTION RULES
1. Prefer AI-generated stills (Dreamina) over blank backgrounds.
2. Prefer real screenshots (article_capture.js) over generated recreations.
3. Prefer Pexels B-roll over AI video for real-world scenes.
4. Use Flow/Dreamina generated video only for impossible-to-film concepts or image-first motion that Remotion cannot supply.
5. Use Lottie as accent only — never as primary visual.
6. Data visuals (stats/charts) are always Remotion components, never generated images.
7. Always use Dreamina GPT Image 2 / ChatGPT Image 2 for Dreamina image creation; use Flow Nano Banana 2/Pro for photoreal/character consistency and repeated image refinements.
8. If Dreamina's current UI labels the active image lane as `Seedream 4.1` / `Image 4.1`, record that as runtime UI evidence while preserving the GPT Image 2 routing rule. If GPT Image 2 is hidden, stop and scout; AI Agent is not a GPT Image 2 route.
9. Use Remotion for free motion whenever possible: parallax, Ken Burns, speed ramps, transitions, titles, charts, lower thirds.
