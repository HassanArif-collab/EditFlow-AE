> **App Connection Note (v7)**: This file is read by the AI agent via the Documentary Studio app's
> `/api/prompts/visual-v7-glm/<filename>` endpoint. The agent fetches it when needed —
> you don't need to paste it in chat.
> See `Visuals Generation Prompt v7.md` for the full app connection protocol.

# AGENT: COMPOSITION BUILD — v6 for Claude
## Instruction File: `v7/agent_composition_build.md`

**MISSION:** Build each planned visual as a disciplined Remotion component on the go, render using the Remotion pipeline, attach audio via Remotion `<Audio>` components, and hand verified renders to QA.

Read these first (and ONLY these — context budget discipline applies):
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `remotion/src/shotlist.json`
- `v7/visual_archetypes.md`
- `v7/technique_deck.md`
- `v7/failure_taxonomy.md`

---

## PRIME DIRECTIVE — RENDER STACK CONFIRMATION
Before writing a single line of code, confirm:
1. The canonical render stack is **Remotion** (React + FFmpeg bundled).
2. Every composition is a React component using `useVideoConfig`, `<AbsoluteFill>`, `<Sequence>`.
3. **Build-on-the-go** — there are no pre-built archetype components. You build each shot's component when you process that shot.
4. Lottie is supported via `@remotion/lottie`.
5. All timing is in seconds first, then converted to frames at 30fps.

---

## SHOT SPEC REQUIREMENT
Before building any row, emit a Shot Spec block. No exceptions.

```text
SHOT SPEC
Row:
Primary insight:
Audience takeaway:
Archetype:
Primary focus:
Secondary focus:
Tertiary environment:
Timing map: [0.0s entrance] [Xs hold] [Xs exit] [total: Xs]
Camera/motion plan:
Assets required:
Known risks:
```

If you cannot fill every field clearly, the row is not ready to build.

---

## THEME + MOTION DNA — READ FIRST
The film's ONE theme (from `v7/theme_catalog.md`) is locked in the Style Bible. Before
building anything: load its THEME SUFFIX, its Motion DNA tokens (durations, eases, settle,
stagger, layer rates, dim level, static grain) and the PREMIUM-MOTION CHECKLIST at the
bottom of the catalog. Every shot is built inside that theme and judged against that
checklist — a technically clean shot in the wrong theme is a failed shot.

**Layer law:** every scene has foreground / midground / background moving at 1.0 / 0.5 /
0.2x. A single-layer frame is an automatic QA failure — this is the #1 "basic 2D" tell.

**Tech lane choice (per shot):** Remotion DOM (default) · GSAP paused-timeline (complex
choreography — seek with `tl.progress(frame/durationInFrames)`) · three.js via
`<ThreeCanvas>` from `@remotion/three` (isometric dioramas, 3D data cities, flyovers —
time from `useCurrentFrame()/fps`, never `THREE.Clock`). All lanes are installed and render
through the same preview pipeline. Record the lane in the Shot Spec's `Camera/motion plan`.

## CREATIVE PASS — REQUIRED BEFORE ANY CODE
Your first idea is your most average idea. For each row, after the Shot Spec and before
writing a single line of code:

1. Propose **THREE genuinely different visual concepts** for the line, each built on a
   different technique card from `v7/technique_deck.md` (or a justified invention beyond the
   deck). One sentence each: what the viewer **feels**, and why that technique fits the
   line's *meaning* — not its aesthetics.
2. Pick the strongest. One-line rationale tied to the script line.
3. **Rotation rule:** never reuse the previous shot's technique unless the shots form an
   intentional `LAYERED_SCENE` continuous run.
4. **Invention quota:** at least ONE shot per act must use a technique that is NOT in the
   deck — invented for this specific line, composed from the atoms. Name it like a card
   (e.g. `INK_BLEED_REVEAL`) and state its intent in one sentence.
5. **Promotion:** when the user approves an invented technique, write it up as a full card
   (Feel / Use when / Mechanics / Params / Fails when) and give it to the user to append to
   `v7/technique_deck.md` — the deck grows from your inventions, not only from videos.

Write the chosen concept + technique into the Shot Spec's `Camera/motion plan` field.

---

## CRAFT ATOMS — COMPOSE, DON'T RE-DERIVE
The render sandbox provides `./atoms` next to your component. Import the foundations
instead of re-implementing them per shot:

```ts
import {
  MaskedReveal, ParallaxPush, PLayer, Grain, CutTheCurve, DustDissolve, PosterType,
  SPRINGS, enter, progress, sec, stagger,
  INK, accent, easeOutQuint, easeInOutQuart, anticipate,
} from './atoms'
```

- **Easing/springs:** use `SPRINGS` (`doc`/`reveal`/`snap`) and `enter()`/`progress()` — do not hand-roll bezier curves per shot.
- **2.5D push:** `ParallaxPush` + `PLayer rate={0.5|1|1.5}` (rates from the motion limits table).
- **Kinetic type:** `MaskedReveal` (overflow-hidden translate) — never whole-block opacity fades.
- **Texture:** `Grain` at 0.03–0.05, STATIC only (`flicker` is banned — see STABILITY RULES in the master prompt). Never over text layers.
- **Color:** `INK` tokens + `accent(hue)` — OKLCH only, one accent per shot.
- **Seamless cuts:** `CutTheCurve` per its technique card.

Uniqueness lives in YOUR layout, metaphor, and choreography — never in re-deriving these
foundations. The atoms are where "premium" lives; your composition is where "unique" lives.

---

## BUILD WORKFLOW — ROW BY ROW
For each row in `shotlist.json`, in strict order:

1. Read the matching row from shotlist.json + Decision Log + Guidance Document
2. Emit the **Shot Spec** (all fields must be filled)
3. Run the **CREATIVE PASS** (three concepts → pick one, with rationale)
4. Read the relevant archetype section in `v7/visual_archetypes.md` + the chosen technique card in `v7/technique_deck.md`
5. Build the Remotion component (create new file in `remotion/src/components/{id}.tsx`), composing from `./atoms`
6. Register the component in `remotion/src/index.tsx`
7. Add `<Audio>` tags for the archetype's mapped sound
8. Run **SEE–CRITIQUE–REVISE** (below) — no blind shipping
9. Render: `npx remotion render src/index.tsx {compositionName} out/{id}.mp4 --codec=h264`
10. Log completion to `qa/agent_log.txt`
11. Mark the row `RENDERED` in phase_state.txt
12. Continue to next row

Do not batch-build all shots in one script. Build row by row, render per row or per small batch.

---

## SEE–CRITIQUE–REVISE — NO BLIND SHIPPING
No designer ships work without looking at it. After building a component and before the
final render:

1. POST the component code to `<APP_URL>/api/render/preview` as
   `{ "remotionCode": "<full component code>", "durationInFrames": N, "frame": <mid-hold frame> }`.
   The response returns a base64 PNG of the paused mid-hold frame.
2. Look at the frame and score it against the **Taste Rubric**. If you cannot view images in
   your environment, show the user the frame (or ask them to open it) and self-critique from
   the code against the same rubric.
3. If any rubric line fails, revise the component and re-render the preview.
   **Maximum two revision passes** — then move on and log the remaining concern to
   `qa/agent_log.txt` as `[TASTE]`.

**TASTE RUBRIC** (judge the paused mid-hold frame):
- **One hero.** Can you name the single most important element in under a second?
- **Negative space.** Does the frame breathe? Nothing vital inside the outer 10%.
- **The paused frame alone** communicates the line's insight — no motion required.
- **Hierarchy:** hero / support / environment read as three clearly different weights.
- **Palette:** one accent, OKLCH, no pure black/white, texture present but invisible.
- **The gut check:** would this frame look at home in a Vox piece — or in a PowerPoint?

---

## CANONICAL BUILD RULES (Preserved from v5, Translated to Remotion)

### 1. Render Contract (Remotion)
Every composition:
- Uses `<AbsoluteFill>` as root container
- Uses `useVideoConfig()` for dimensions and fps
- Uses `spring()` for entrance animations (exponential ease-out)
- Uses `interpolate()` for timed transitions
- Sets `durationInFrames` in shotlist.json (not in the component)

### 2. Timing Rules
- Build timings in seconds first, then convert to frames at 30fps.
- Default canvas: `1920×1080`.
- Use pacing ratio `entrance : hold : exit = 1 : 2 : 0.7`.

### 3. Background
- Every composition uses a textured base background as layer 1.
- OKLCH color space. No pure black (#000) or pure white (#fff).

### 4. Motion Rules
- Animate transforms and opacity by default. Use filters only when required.
- No moving video behind static text.
- No frame-jitter wrapper. Fix weak motion by adjusting hierarchy or timing.
- **Stagger reveals** to match 2-3 words per second cadence.
- **Letter-by-letter title animation** — never fade the whole block.
- **Narration-synced choreography (Harris):** the Shot Spec's `Camera/motion plan` maps
  narration phrases to motion events — "on 'they fled' → cast icons scatter west; on
  'PKR 40,000' → bar overshoots and settles." Nothing moves without a word behind it,
  and no key phrase lands on a static frame.
- **Reveal proof-stack pacing:** at the reveal beat, cut document → number → quote with
  tightening durations (e.g. 2.5s → 2.0s → 1.5s) and ONE `snd_impact.mp3` on the final
  cut — not three evenly-timed shots.
- **Cast icon reuse:** import the same icon component for an actor across all shots —
  never redraw the ministry a second way mid-film.

### 5. Hierarchy
- One clear primary focus, one secondary support, one tertiary environment per frame.
- Respect safe margins. No vital text inside outer 10% of frame.

### 6. Typography
- Two fonts: Inter (UI/data) and Fraunces (editorial/quotes).
- Tabular numbers for all stats (`fontVariantNumeric: "tabular-nums"`).
- No Google Fonts CDN. Use local `@font-face` registration.

### 7. Color
- OKLCH. Never hex or named colors.
- Tint neutrals toward brand hue (chroma 0.005-0.01).
- Avoid pure bright gold. Restrained ochre or tarnished gold.

### 8. Placeholder Audit
Replace every `[VALUE]`, `[HEADLINE]`, or example number before render.

---

## ARCHETYPE-SPECIFIC BUILD RULES (Preserved from v5)

### SECTION_TITLE_CARD
- Split headline into letter spans. Staggered entrance animation (0.03-0.10s per letter).
- One title, one accent treatment, one supporting line maximum.
- Rotate signature families across sections: slide-up, scale-from-center, slide-from-left, fade-with-settle.

### STAT_COUNTER
- Number counts from 0 or previous visible value using `spring()`.
- Label enters before or alongside the number.
- Unit and citation support lighter than hero number.
- Alarming stats get one restrained pulse after count completes.

### BAR_CHART / LINE_GRAPH / PIE_CHART
- Grid/axes appear first. Data animates in (bars rise, lines draw, segments sweep).
- Values count up via `interpolate()` or `spring()`.
- Labels arrive after data is readable.
- One accent color for the hero element.

### COMPARISON_PANEL
- Parallel structure. Reveal both sides in coordinated but slightly staggered sequence.
- Decisive difference in visual center. One side hero, other reference.

### FLOW_DIAGRAM
- 2-3 steps: keep simple, diagram-first. 4+ steps: layer reveal with travel cues.
- One node focal at a time. Arrows show causation, not connection.

### SCREENSHOT_HIGHLIGHT / DOC_HIGHLIGHT (ArticleDoc)
- See `v7/template_doc_highlight.md` for the ArticleDoc component spec.
- Aged-paper or documentary texture base — never clean white.
- Publication logo outside zoom and perspective wrappers.
- Source content MUST come from a real screenshot.
- Slow highlight sweep: 1.8-2.2s. Center-safe zoom: 1.10x-1.35x.
- Zoom origin `center center`. Per-element DOF blur 2-4px on non-hero text.
- Grain 0.03-0.05, STATIC (frame-locked, one overlay). NO flicker — banned.
- Highlight bar position measured against actual DOM text bounds.
- 9-phase sequence: logo → 3D tilt → highlight sweep → camera push → DOF → vignette → stat reveal → count-up → STILL HOLD (drift ≤0.5%/s one direction; no oscillation).

### GSAP_METAPHOR
- One metaphor, not three. Simple enough to understand in paused frame.
- Good families: gate, bottleneck, stack, siphon, hidden tunnel, balance beam, broken chain.
- If a generated still helps, use it as background with animated overlay.

### EMOTIONAL_MOMENT
- 8.0s minimum, 12.0s maximum. entrance 1.2s, hold 6.5s (minimum), exit 0.8s.
- Restraint beats spectacle. Minimal text. Ambient audio only.
- Nearly invisible camera movement.

### BROLL_VIDEO
- Observational, credible. One camera idea: static, slow pan, slow dolly.
- Standalone or contained accent, not moving wallpaper.

---

## 2.5D PARALLAX RULE
When simulating camera push or zoom, use three different scale rates:
- Target object: 1.6x (fastest)
- Background texture: 1.1x (much slower)
- Foreground elements: 2.0x (fastest, opposite direction)

Apply to: `DOC_HIGHLIGHT`, `SCREENSHOT_HIGHLIGHT`, `BROLL_VIDEO` (parallax stills), `GSAP_METAPHOR`.

## KINETIC TYPOGRAPHY — MASKED REVEALS
For Tier 2-3 text elements, use masked reveals instead of opacity fades:
1. Wrap text in container with `overflow: hidden`.
2. Start at `transform: translateY(100%)`.
3. Animate to `translateY(0%)` with spring easing.
4. Use for: hero stat numbers, emotional quotes, alarming sub-stats.

---

## CONTEXT BUDGET RULE — PREVENTS PHASE 3 OVERFLOW
- Maximum **12 rows** per build agent invocation.
- Pass only matching Decision Log and Guidance Document rows for that batch.
- Use `HANDOFF_NOTE` in `phase_state.txt` to track row progress.

---

## WRITE GUARD RULE
Before writing to any log file, verify write access. If blocked, write to `qa/agent_log_fallback.txt` instead. Never let a log write failure halt composition building. Log failures are WARN class, not ERROR class. Mark `SETUP_WARN: LOG_FALLBACK` in phase_state.txt and continue.

---

## BUILD LOGGING
For each finished render, append to `qa/agent_log.txt`:
```
[BUILD] [ISO_TIMESTAMP] [FILENAME] [ARCHETYPE] [DURATION] [SOUND] [STATUS]
```

---

## OUTPUT CONTRACT
Return a short summary after each batch:
1. Row range completed
2. Archetypes built
3. Any fallback assets used
4. Any renders that produced warnings
5. Highest-risk QA concern
