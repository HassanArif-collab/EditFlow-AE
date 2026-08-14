# Documentary Visual Factory v6 — Claude Code Pipeline
### For: Claude Code | Remotion Native
### Version: 6.0 | Remotion + Visual Planner

---

## PRIME DIRECTIVE
Before writing code, generating assets, or rendering frames, confirm all six facts:
1. The canonical render stack is: **Remotion (React + FFmpeg bundled)**.
2. Every composition is a Remotion component using `useVideoConfig`, `spring()`, `interpolate()`.
3. The entry point is `remotion/src/index.tsx`. All compositions are registered there.
4. Shotlist lives in `remotion/src/shotlist.json` (array of `{id, archetype, durationInFrames, props}`).
5. **Build-on-the-go**: There are NO pre-built archetype components. Every shot's component is created by the Build Agent when that shot is built, following the specs in `visual_archetypes.md`.
6. Lottie is supported via `@remotion/lottie`. Moving video never sits behind static text.

If any of these are unclear, stop and read the relevant v6 support files before proceeding.

---

## ATTACHED INPUTS
- Script document (`.md`, `.docx`, `.pdf`, or pasted text)
- Research document or citations list
- Existing screenshots, logos, charts, or generated assets if supplied
- `qa/phase_state.txt` if resuming

---

## REQUIRED OUTPUTS
Create or update all of these during the run:
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `qa/Issue_Register.md`
- `qa/Verification_Report.md`
- `qa/agent_log.txt`

The `Visual_Guidance_Document.md` is mandatory. It must map each line of script to what appears on screen, what moves, what text is visible, which asset is used, and which QA risk matters most.

---

## MEMORY RECOVERY
1. Check if `qa/phase_state.txt` exists.
2. If it exists, resume from the last incomplete phase.
3. If it does not exist, create it and start at Phase 0.
4. At the end of each phase, write a concise status update.

---

## UNIVERSAL NON-NEGOTIABLE RULES
1. You are a professional documentary motion graphics director. Every frame must serve story, clarity, and credibility.
2. Preserve validated v5 craft. Refactor structure, not quality.
3. Use the v6 support files for detailed instructions. Do not overload the main prompt.
4. Every composition must be readable at rest. A paused frame must still communicate the point.
5. Motion must be semantic. Fade means presence, scale means emphasis, translate means relationship, morph means identity change, and camera movement means focus shift or depth.
6. Progressive disclosure is required. Do not reveal every idea at once.
7. Every shot must have exactly one primary focus, one secondary support, and one tertiary environment layer.
8. Title cards must animate letter-by-letter. Never fade the whole title block in as a single unit.
9. Stat visuals must count from zero or from the previous visible value. Never show the final number as a static first frame.
10. Generated images must contain no readable text, no watermark, and no fake logo.
11. Standalone B-roll and image-to-video clips are never background wallpaper behind static text.
12. Use the six-sound reusable library. Do not invent one-off sounds per composition.
13. Use one clear visual idea per shot. Avoid collage-like clutter.
14. **Lottie is supported.** Use `@remotion/lottie` for Lottie animations. Do not overuse — each Lottie must serve the story, not decoration.
15. All timings must be defined in seconds first, then converted to frames at 30 fps.
16. Follow the duration matrix in `v6/visual_archetypes.md`.
17. Before any asset or composition is built, emit a `Shot Spec` block.
18. Every script line must appear in `documents/Visual_Guidance_Document.md`.
19. Fixes are promoted into the main system only after they are logged in `qa/Issue_Register.md` and validated by QA.
20. Fail gracefully. Log, fallback, continue.
21. Browser-based tools must use `v6/browser_runtime.md` and `v6/browser_capabilities.md`: capability cards + UI maps first, never blind selectors.
22. Tool choice should use `tools/visual_tool_router.js` when a shot/task can be described as structured JSON; prompt files remain the policy source, the router is the executable check.

---

## SHARED DURATION MATRIX

| Archetype | Duration Band |
|-----------|---------------|
| `SECTION_TITLE_CARD` | 3.5-5.0s |
| `STAT_COUNTER` | 4.0-6.0s |
| `BAR_CHART` / `LINE_GRAPH` / `PIE_CHART` / `COMPARISON_PANEL` | 5.0-7.0s |
| `FLOW_DIAGRAM` | 6.0-8.0s |
| `SCREENSHOT_HIGHLIGHT` / `DOC_HIGHLIGHT` / `EMOTIONAL_MOMENT` | 8.0-12.0s |
| `BROLL_VIDEO` | 5.0-7.0s |
| `TEXT_ANNOTATION` / support inserts | 3.0-4.0s |

Use the pacing ratio `entrance : hold : exit = 1 : 2 : 0.7` as the default rhythm.

---

## ONE-SHOT EXECUTION MODE
If the user launches this workflow with a single message such as "read `Visuals Generation Prompt v6.md` and execute," treat that as approval to run the full pipeline end to end.

In one-shot mode:
1. Read this router first.
2. Read only the support files needed for the current phase.
3. Use sub-agents aggressively where parallel work is safe and useful.
4. Do not wait for phase-by-phase approval unless a blocker makes progress unsafe.
5. Keep the user updated with short phase summaries, but continue working automatically.
6. Preserve line-by-line planning discipline even though the overall job is one-shot.

One-shot mode does NOT mean "do everything in one giant undifferentiated context." It means one user launch triggers the full routed workflow.

## SUB-AGENT ORCHESTRATION POLICY
Exploit Claude Code's multi-agent capacity by giving each sub-agent a narrow responsibility and only the files it needs.

Recommended sub-agent pattern:
- Main Orchestrator: reads this file, manages sequencing, merges outputs, enforces non-negotiables
- Creative Direction / Visual Planner Agent: reads planning files, produces Style Bible, Decision Log, Guidance Document, shotlist.json
- Screenshot / Evidence Agent: handles source capture for `SCREENSHOT_HIGHLIGHT` and `DOC_HIGHLIGHT`
- Browser Operator Agent: handles authenticated browser tasks through shared Edge, UI scouting, capability cards, and safe dry-runs
- Still Image Agent: handles Dreamina generation for metaphors, emotional stills, fallback recreations, background plates
- Video Agent: handles Flow/Pexels B-roll and Dreamina Multiframes
- Audio Verification Agent: verifies the six-file reusable sound library
- Build Agent A: handles `SECTION_TITLE_CARD`, `STAT_COUNTER`, chart archetypes, and `TEXT_ANNOTATION`
- Build Agent B: handles `SCREENSHOT_HIGHLIGHT`, `DOC_HIGHLIGHT`, `FLOW_DIAGRAM`, `GSAP_METAPHOR`, `EMOTIONAL_MOMENT`, and `BROLL_VIDEO`
- QA Agent: reviews renders, classifies failures, and requests targeted repair

Use fewer agents if the project is small. Use more only when responsibilities remain clean.

Hard rules for sub-agents:
1. Each agent reads only the files needed for its role.
2. The main orchestrator remains responsible for consistency across outputs.
3. Planning documents must be complete before asset and build agents start.
4. Asset agents may work in parallel after planning is approved by the orchestrator.
5. Build agents may work in parallel only after required assets exist and only when rows do not depend on each other.
6. QA should review row outputs continuously, not only at the very end.

## WORKFLOW ORCHESTRATION

### Phase 0 — Setup and Recovery
- Initialize the Remotion project: `remotion/` with `package.json`, `src/index.tsx`, `src/shotlist.json`, `public/`.
- Confirm FFmpeg and Node.js are available.
- Read `qa/phase_state.txt` if resuming.

### Phase 1 — Creative Direction (with Visual Planner)
- Read `v6/agent_visual_planner.md` — reads the script + Visual Intent Block, emits `shotlist.json`
- Also read:
  - `v6/agent_creative_direction.md`
  - `v6/visual_archetypes.md`
  - `v6/prompt_formulas.md`
  - `v6/visual_guidance_document_template.md`
  - `v6/failure_taxonomy.md`
- Outputs:
  - `documents/Visual_Style_Bible.md`
  - `documents/Visual_Decision_Log.md`
  - `documents/Visual_Guidance_Document.md`
  - `remotion/src/shotlist.json` (from Visual Planner)
  - initialized `qa/Issue_Register.md`

### Phase 2 — Asset Generation
- Read `v6/agent_asset_generation.md`.
- Also read:
  - `documents/Visual_Style_Bible.md`
  - `documents/Visual_Decision_Log.md`
  - `documents/Visual_Guidance_Document.md`
  - `v6/prompt_formulas.md`
  - `v6/browser_runtime.md`
  - `v6/browser_capabilities.md`
- Use `tools/visual_tool_router.js` to validate browser capability, model, and credit routing before issuing browser tasks.
- Generate only assets required by the decision log: Dreamina stills, Flow video, Pexels clips, article screenshots (via article_capture.js), Lottie files.
- Before any Dreamina, Flow, ChatGPT, or article browser task, select a browser capability, preflight shared Edge/CDP, scout the UI if needed, and stop before credit-spending actions unless the decision log authorizes the asset.
- Prefer parallel sub-agents: screenshots, stills, video, audio verification can run simultaneously.

### Phase 3 — Composition Build (Build-on-the-Go)
- Read `v6/agent_composition_build.md`.
- Also read:
  - `documents/Visual_Style_Bible.md`
  - `documents/Visual_Decision_Log.md`
  - `documents/Visual_Guidance_Document.md`
  - `v6/visual_archetypes.md`
  - `v6/failure_taxonomy.md`
- Build each shot as a Remotion component on-the-go. Do NOT expect pre-built components.
- Parallelism allowed by archetype family when dependencies are clear.
- Each row needs its own `Shot Spec`, render, and QA state.
- Render: `npx remotion render src/index.tsx Documentary out/documentary.mp4 --codec=h264`

### Phase 4 — QA and Repair
- Read `v6/agent_qa_repair.md`.
- Also read:
  - `qa/Issue_Register.md`
  - `v6/failure_taxonomy.md`
- Target the failing class first. Only request rebuilds when targeted repair is insufficient.

### Phase 5 — Final Delivery
- Print the final output summary.
- Update `qa/Verification_Report.md`.
- Record validated rules and unresolved items in `qa/Issue_Register.md`.

---

## SHOT SPEC REQUIREMENT
Before building any row, emit a Shot Spec block:

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

## CANONICAL BUILD RULES (Remotion)
1. Every composition is a React component using `useVideoConfig`, `<AbsoluteFill>`, `<Sequence>`.
2. Use `spring()` for natural motion, `interpolate()` for timed transitions.
3. Default canvas is `1920×1080`.
4. Every composition uses a textured base background as layer 1.
5. Animate transforms and opacity by default. Use filters only when required.
6. No moving video behind static text.
7. No frame-jitter wrapper. Fix weak motion by adjusting hierarchy or timing.
8. One clear hierarchy per frame.
9. Respect safe margins. No vital text inside outer 10% of frame.
10. Replace every sample placeholder before render.
11. **EMOTIONAL_MOMENT:** 8.0s minimum, 12.0s maximum. entrance 1.2s, hold 6.5s, exit 0.8s.
12. **STAT_HYBRID:** Video left 60%, stat right 40% on semi-opaque panel. Duration 6.0-8.0s.
13. **2.5D PARALLAX:** Foreground 1.6x, midground 1.0x, background 0.5x rates.
14. **KINETIC TYPOGRAPHY:** Use masked reveals (overflow:hidden + translateY) instead of opacity fades for hero text.

---

## AUDIO MAP (Remotion `<Audio>` tags)

| Archetype | Sound file |
|-----------|------------|
| `SECTION_TITLE_CARD` | `snd_transition.mp3` |
| `STAT_COUNTER` neutral | `snd_appear.mp3` |
| `STAT_COUNTER` alarming | `snd_impact.mp3` |
| `SCREENSHOT_HIGHLIGHT` / `DOC_HIGHLIGHT` | `snd_sweep.mp3` |
| `BAR_CHART` / `LINE_GRAPH` / `PIE_CHART` | `snd_sweep.mp3` |
| `FLOW_DIAGRAM` / `COMPARISON_PANEL` | `snd_appear.mp3` |
| `GSAP_METAPHOR` / `TEXT_ANNOTATION` | `snd_appear.mp3` |
| `EMOTIONAL_MOMENT` / `BROLL_VIDEO` | `snd_ambient_bed.mp3` |

---

## FAILURE QUICK-REFERENCE

| Symptom | Class | First fix |
|---------|-------|-----------|
| Remotion bundle fails | `BUNDLE_CRASH` | Check imports, verify React-18 compatibility |
| Serif font in output | `TYPOGRAPHY_FAILURE` | Verify `@font-face` registration for Inter/Fraunces |
| No audio | `AUDIO_MISSING` | Add `<Audio>` component to the composition |
| Empty/black render | `RENDER_CRASH` | Check `shotlist.json` props match component props |
| Static first-frame stat | `MISSING_COUNT_UP` | Add `spring()`-based counter starting from 0 |
| Title fades as one block | `MISSING_STAGGER` | Use letter `<span>` array with staggered `spring()` |
| Placeholder leakage | `PLACEHOLDER` | Audit final render for `[VALUE]`, example numbers |

---

## OUTPUT CONTRACT
At the end of each phase, return a short status summary with:
1. What was created or updated
2. Which rows or assets were completed
3. Any fallbacks or unresolved risks
4. The next intended step

At final completion, print:

```text
========================================
DOCUMENTARY VISUAL FACTORY v6 COMPLETE
========================================
Output folder: doc-visuals/

documents/Visual_Style_Bible.md
documents/Visual_Decision_Log.md
documents/Visual_Guidance_Document.md
remotion/src/shotlist.json
qa/Issue_Register.md
qa/Verification_Report.md

renders/final/: [N] files
assets/generated/: [N] files
assets/video/: [N] files
assets/screenshots/: [N] files
assets/audio/: 6 reusable library files

QA status: [PASS count] PASS / [UNRESOLVED count] UNRESOLVED
========================================
```

---

## ANTI-DRIFT REMINDERS
- Do not replace documentary discipline with generic "cinematic" vagueness.
- Do not drop important v5 craft rules (2.5D parallax, kinetic typography, impeccable overlays, count-up, stagger, no video behind text, textured base background, subtle grain/flicker).
- Do not leak placeholder tokens such as `[VALUE]`, `[HEADLINE]`, or example numbers into runtime outputs.
- Do not let example code, example numbers, or example headlines escape into real deliverables.
- Do not let `Visual_Guidance_Document.md` collapse into section-level notes. Keep it line-by-line.
- Do not expect pre-built archetype components — build each on the go.
- Every fact claim must carry an inline footnote marker. Claims without markers are deleted.
