# AI Tools Guide v6 (GLM)

This file documents the AI generation tools available to the v6 GLM visual pipeline. The Build Agent routes to these based on the shot requirement.

---

## DREAMINA (Still Generation + Multiframes)
- **Use for:** Cinematic stills, documentary imagery, background plates
- **Platform:** dreamina.cutout.pro (browser-based)
- **Tool:** `dreamina_gen_169.js` (Playwright automation in `_RnD_claude/`)
- **Prompt:** Use Image Prompt Formula from `prompt_formulas.md`
- **Image-to-video:** Dreamina Multiframes for subtle animation
- **Rules:** No readable text, no watermark, no fake logo, one focal concept
- **Credit cost:** ~1 cr/still, ~3-5 cr/multiframe

## FLOW (Video Generation)
- **Use for:** Cinematic video clips, b-roll substitutes
- **Platform:** flow.xyz (browser-based)
- **Tool:** `flow_video*.js` (Playwright automation in `_RnD_claude/`)
- **Prompt:** Use Video Prompt Formula from `prompt_formulas.md`
- **Rules:** Observational tone, no ad aesthetic, no moving background under text
- **Credit cost:** ~3-7 cr/video

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
- **Integration:** Lottie Web player (lottie-web npm package)
- **Library:** lottiefiles.com or custom Lottie JSON
- **Rules:** Lightweight, single-purpose animations. Not decoration. Must improve clarity or emotion.
- **Only Lottie is wired.** Spline, Rive, Shader Gradient, Icons8 are not active tools.

---

## TOOL SELECTION RULES
1. Prefer AI-generated stills (Dreamina) over blank backgrounds.
2. Prefer real screenshots (article_capture.js) over generated recreations.
3. Prefer Pexels B-roll over AI video for real-world scenes.
4. Use AI video (Flow/Dreamina Multiframes) only for impossible-to-film concepts.
5. Use Lottie as accent only — never as primary visual.
6. Data visuals (stats/charts) are always GSAP+HTML compositions, never generated images.
