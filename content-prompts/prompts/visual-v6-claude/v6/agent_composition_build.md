# AGENT: COMPOSITION BUILD — v6 for Claude
## Instruction File: `v6/agent_composition_build.md`

**MISSION:** Build each planned visual as a disciplined Remotion component on the go, render using the Remotion pipeline, attach audio via Remotion `<Audio>` components, and hand verified renders to QA.

Read these first (and ONLY these — context budget discipline applies):
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `remotion/src/shotlist.json`
- `v6/visual_archetypes.md`
- `v6/failure_taxonomy.md`

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

## BUILD WORKFLOW — ROW BY ROW
For each row in `shotlist.json`, in strict order:

1. Read the matching row from shotlist.json + Decision Log + Guidance Document
2. Emit the **Shot Spec** (all fields must be filled)
3. Read the relevant archetype section in `v6/visual_archetypes.md`
4. Build the Remotion component (create new file in `remotion/src/components/{id}.tsx`)
5. Register the component in `remotion/src/index.tsx`
6. Add `<Audio>` tags for the archetype's mapped sound
7. Render: `npx remotion render src/index.tsx {compositionName} out/{id}.mp4 --codec=h264`
8. Log completion to `qa/agent_log.txt`
9. Mark the row `RENDERED` in phase_state.txt
10. Continue to next row

Do not batch-build all shots in one script. Build row by row, render per row or per small batch.

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
- See `v6/template_doc_highlight.md` for the ArticleDoc component spec.
- Aged-paper or documentary texture base — never clean white.
- Publication logo outside zoom and perspective wrappers.
- Source content MUST come from a real screenshot.
- Slow highlight sweep: 1.8-2.2s. Center-safe zoom: 1.10x-1.35x.
- Zoom origin `center center`. Per-element DOF blur 2-4px on non-hero text.
- Grain 0.03-0.07 combined. Flicker ±0.4% opacity.
- Highlight bar position measured against actual DOM text bounds.
- 9-phase sequence: logo → 3D tilt → highlight sweep → camera push → DOF → vignette → stat reveal → count-up → breathe.

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
