# AI Tools Guide — v7.1 (July 2026, MANUAL MODE)

> **MANUAL MODE:** The user copies each prompt from the
> app's pipeline cards into the tool's website by hand and drops the result into the
> visuals folder. Your job is to write prompts so good they work on the first paste.

## TOOL MATRIX (verified July 2026)

| Tool | Where (manual) | Free tier | Use it for |
|---|---|---|---|
| **GPT Image 2** | chatgpt.com | Instant free (daily cap); Thinking needs Plus | ALL text-bearing stills (Urdu/English labels, charts, recreated documents); character sheets; up to 8 style-coherent images per Thinking prompt; 2K, ratios 3:1–1:3 |
| **Nano Banana Pro** (Gemini 3 Pro Image) | gemini.google.com | Free quota, silently falls back to base Nano Banana — CHECK the model label | Search-grounded infographics (it fetches real data itself); blending up to 14 reference images; restyling/regrading real photos; 4K |
| **Gemini Omni Flash** (video) | labs.google/flow | Free, daily caps | **Restyling REAL footage** (upload phone clip → "regrade as cinema, keep motion identical"); conversational multi-turn edits without regenerating; text+image+video+audio refs in one prompt; ≤10s, 720p, native audio |
| **Veo 3.1** | labs.google/flow | Limited free gens | Ingredients-to-video (2-3 reference images lock character/style); FIRST/LAST-frame bridges between two designed stills; Extend; native synced audio |
| **Seedream 5.0 Pro** ("Image 5.0") | dreamina.capcut.com → AI Image | Daily free credits | **Layered PNG export (10+ separated editable layers → animate each in Remotion/CapCut free)**; dense in-image text (~14 languages); surgical region edits; re-angle same scene |
| **Seedance 2.0** | dreamina.capcut.com → AI Video | ~2-3 free 5s clips/day | Omni-reference (up to 9 images + 3 videos + 3 audio steer one gen via @asset names); 15s, 2K, multi-camera cuts in one clip; first/last frame |
| **Hailuo 2.3** | hailuoai.video | 100 daily credits, **no watermark** | Most natural HUMAN motion — micro-expressions, weight shift. Best free human b-roll |
| **Kling 3.0** | klingai.com | Daily free credits | Multi-shot storyboard mode; strong physics (fabric, liquid, crowds) |
| **Runway Gen-4.5 Aleph** | runwayml.com | Free but VISIBLE watermark | Skip unless paid — best video-to-video restyle otherwise |
| **Pexels** | pexels.com | Free | Real-world b-roll. Specific searches only ("Karachi port container crane", not "Pakistan economy") |
| **Lottie** | lottiefiles.com + `@remotion/lottie` | Free | Accent micro-animations only, never primary |

## PER-TOOL PROMPT PATTERNS (copy into pipeline cards)

**GPT Image 2** — verbose paragraphs win; exact on-screen text in quotes.
- Infographic: `Clean documentary infographic explaining [TOPIC], 16:9. Bold headline "[TEXT]" top center. Three panels left to right: [P1], [P2], [P3], each with a flat icon and one stat label reading exactly "[STAT]". Palette [3 HEX], off-white ground, thin grid lines. [THEME SUFFIX]`
- Character sheet (ONCE per film): `Character reference sheet, 3x2 grid: [CHARACTER DESC — e.g. Pakistani security guard, 50s, grey-flecked mustache, navy uniform, tired kind eyes] — front, profile, 3/4, walking, sitting, drinking chai. Identical face and outfit in all six.`
- Layered scene for 2.5D: request each layer separately `on a solid uniform #00b140 background` and key it out.

**Nano Banana Pro**
- Grounded chart: `Search current data on [TOPIC] and create a 16:9 explainer infographic with accurate figures, labeled bar chart, small source line. [THEME SUFFIX]`
- Restyle a real photo (upload it): `Keep this exact scene and composition. Regrade as anamorphic cinema: golden-hour rim light, haze, deeper shadows, film grain. Remove [DISTRACTION].`

**Omni Flash** — his superpower is EDITING, not first tries. Never re-roll an 80%-right clip.
- Real-footage restyle: `Restyle this clip as cinematic documentary footage: [GRADE], keep all motion and people identical, stabilize.` Then iterate conversationally: `Darker sky. Add distant traffic hum.`
- Relay the user's per-shot feedback VERBATIM as follow-up edits in the SAME session — identity persists.

**Veo 3.1** — five-part formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style/Ambiance] + one audio line.
- Frames bridge: GPT Image 2 makes frame A and frame B (text-perfect) → `The chart animates smoothly from the first state to the second, camera locked, soft tick as each bar rises.`
- Timestamped sequence: `[00:00-00:03] Wide, [SCENE]. [00:03-00:06] Close-up, [DETAIL]. [00:06-00:08] Crane up revealing [REVEAL]. Ambient: [SOUNDSCAPE].`

**Seedream 5.0 Pro**
- Layered motion-graphic source: `Infographic titled "[TITLE]": [ELEMENTS]. [THEME SUFFIX]. Separate layers: background, chart, headline, icons.` → export layers → animate in Remotion.
- Re-angle: `Same exact scene and subject, now from a low 45-degree angle, zoomed to [DETAIL].`

**Seedance 2.0** — ONE camera move per clip; no negative phrasing (describe what you want).
- `@[CHARACTER] walks along [LOCATION] at [TIME], [LIGHT]. Slow tracking shot left. [THEME SUFFIX]. Ambient street sound, distant azaan.`

## CONSISTENCY SYSTEM (one look across 20+ generations)

1. **Style bible paragraph** written once in Phase 1 (palette hex, film stock, grade, mood) — pasted VERBATIM at the end of every image/video prompt in every tool. This is the single highest-leverage rule.
2. Generate one **master style frame** + one **character sheet** early (GPT Image 2 Thinking or Nano Banana Pro).
3. Per tool: Nano Banana Pro → attach style frame + character sheet as references every time (14 slots). GPT Image 2 → batch up to 8 shots in ONE Thinking chat (batch coherence is the feature); later sessions re-upload the sheet: "same character, same grade." Flow/Veo → same 2-3 reference images as ingredients on EVERY clip; build start frames in Nano Banana Pro first — image consistency transfers to video. Dreamina → save character + style frame as assets, reference with @name in every Seedance prompt.
4. References replaced seeds. No tool needs seed juggling anymore.

## ARTIFACT DODGE LIST

- **Text in VIDEO = gibberish** (every video model). Render text in GPT Image 2 / Seedream stills, then animate image-to-video or first/last frame.
- **Urdu script:** GPT Image 2 is strongest but renders closer to Naskh than Nastaliq — keep labels short, zoom-check every glyph before use.
- **Negative prompts are ignored** (Omni Flash, Seedance): say "empty street at dawn", never "no people".
- **Two camera moves in one prompt** breaks Seedance/Veo — one move per clip, cut in the edit.
- **Faces/hands morph past ~8s** — keep clips short, lean on references, cut away before drift.
- **Restyle flicker:** prefer Omni Flash conversational edit; avoid fast pans in source footage.
- GPT Image 2: never trust real logos/brands; Thinking mode is slow — batch.
- Seedance: complex physics/crowds glitch — use Hailuo or Kling for those.
- Nano Banana Pro quota exhaustion silently downgrades the model — verify the label.

## TOOL SELECTION RULES (v7.1)

1. Data visuals (stats/charts/counters) = Remotion code. Generated images never carry the numbers.
2. Text-bearing stills = GPT Image 2 (or Seedream for layered export). Video models never render text.
3. Real footage exists or is phone-shootable? Use it — restyled through Omni Flash if it needs cinema. Real beats generated.
4. Character/recurring-object shots = reference-image workflow (ingredients/@assets), never fresh rolls.
5. Human close-up motion = Hailuo. Physics-heavy = Kling. Everything else video = Flow (Omni Flash ≤10s iterative, Veo for bridges/ingredients) or Seedance (long 15s takes, multi-cut).
6. Every prompt ends with the film's locked THEME SUFFIX (see `theme_catalog.md`). No exceptions.
7. Remotion supplies free motion first: parallax, layered builds, camera drift, titles, charts, lower thirds — generation is for what code cannot draw.
