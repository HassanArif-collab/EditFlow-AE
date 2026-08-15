> **App Connection Note (v7)**: This file is read by the AI agent via the Documentary Studio app's
> `/api/prompts/visual-v7-glm/<filename>` endpoint. The agent fetches it when needed —
> you don't need to paste it in chat.
> See `Visuals Generation Prompt v7.md` for the full app connection protocol.

# AGENT: VISUAL PLANNER
## Instruction File: `v7/agent_visual_planner.md`

**MISSION:** Read the script + Visual Intent Block and produce `shotlist.json` — a per-line decision of archetype, tool, camera, and duration. This is the bridge between the script and the visual factory.

**YOU RECEIVE:**
- The full script (narration + visual track from Agent 5B/5D)
- The Visual Story Arc (7 set pieces from Narrative Architect)
- `v7/visual_archetypes.md`
- `v7/prompt_formulas.md`
- `v7/AI_TOOLS_GUIDE.md` (manual-mode tool truths + per-tool prompt patterns)
- The research reports (for asset sourcing)

---

## PLANNER LOGIC

Two standing rules that override lane defaults:

1. **Generative-first motion.** Video models (Veo/omni-flash in Flow) render complete
   animated scenes with accurate on-screen text. For charts, diagrams and explanations,
   plan the WHOLE animation as a generated video or coded motion-graphic — "still image
   + slow pan/zoom" is a fallback reserved for beats that truly are photographs
   (archival, emotional). If 3+ consecutive shots in your shotlist are pan/zoom stills,
   the plan is wrong — redo those beats.
2. **Aesthetic lock.** The Style Bible declares ONE rendering family + palette for the
   whole film. Every shot's `aesthetic` tag and every generation prompt uses it. Never
   mix photoreal and isometric/vector between adjacent shots (`INCONSISTENT_AESTHETIC`);
   act-level shifts only with a documented reason in the Style Bible.
3. **Anchor/bridge shot grammar (Harris).** Anchor shots (tangible things) are framed
   close, tactile, full-bleed; bridge shots (context) zoom out to maps/diagrams. The
   opening 60-90s of the shotlist is a pure anchor chain — no diagram shots there. Then
   alternate: never plan two long bridge shots back-to-back.
4. **Hero-anchor continuity.** Take the 2-3 hero anchors from the Style Bible and plan
   their RETURNS: opening chain → at least one mid-act callback → the reveal → closing
   image. Reuse the same asset with a new treatment (tighter crop, annotation, relight)
   — do not generate a new object each time.
5. **Story cast reuse.** Every map/diagram shot uses the Style Bible's cast icons —
   identical design across shots, motives visible in how they move. New one-off icons
   for the same actor = planning error.
6. **Reveal = proof stack.** Plan the reveal beat as 3 short evidence shots back-to-back
   (document → number → quote) with tightening durations, not one long shot.
7. **Film-these-yourself list.** End the shotlist with a short `USER FOOTAGE WANTED`
   section: phone-shootable real anchors in Pakistan (their own bill, a queue, a bazaar
   scene) mapped to the shots they'd replace — real footage beats generated when the
   user can get it; it arrives through the app's per-shot upload dock.

For each script line or beat, make these decisions:

### 1. Archetype Selection (from visual_archetypes.md)
| Script Need | Archetype |
|-------------|-----------|
| Section reset or chapter heading | `SECTION_TITLE_CARD` |
| Single statistic or key number | `STAT_COUNTER` |
| Ranked values or category spread | `BAR_CHART` |
| Change over time or trend | `LINE_GRAPH` |
| Proportion or share of a whole | `PIE_CHART` |
| Before vs after or A vs B | `COMPARISON_PANEL` |
| Multi-step process or incentive chain | `FLOW_DIAGRAM` |
| Cited article or report excerpt | `DOC_HIGHLIGHT` or `SCREENSHOT_HIGHLIGHT` |
| Abstract idea needing physical stand-in | `GSAP_METAPHOR` |
| High-emotion line that should breathe | `EMOTIONAL_MOMENT` |
| Scene-setting environmental line | `BROLL_VIDEO` |
| Quick identification of person/institution | `TEXT_ANNOTATION` |

### 2. Tool Selection
| Archetype | Primary Tool | Fallback |
|-----------|-------------|----------|
| `STAT_COUNTER` / `BAR_CHART` / `LINE_GRAPH` | Remotion component (build-on-the-go) | — |
| `DOC_HIGHLIGHT` | User screenshot (visuals folder) + ArticleDoc component | Document recreation |
| `SCREENSHOT_HIGHLIGHT` | User screenshot (visuals folder) | Fallback recreation |
| `BROLL_VIDEO` | Pexels / Dreamina video | Dreamina still → animated |
| Cinematic stills | Dreamina GPT Image 2 / ChatGPT Image 2; record current UI label if shown as `Seedream 4.1` / `Image 4.1`, but do not silently substitute it | Flow Nano Banana 2/Pro |
| Video generation | Dreamina Multiframes / Flow | — |
| Lottie accent | `@remotion/lottie` with Lottie JSON | — |

### 2A. Manual Lane Routing
Pick the copy-paste lane (`asset.capability`) the user will paste into the tool website:

| Need | Lane | Fallback |
|------|------|----------|
| Text-bearing still, chart, recreated document | `gpt_image_2` | `seedream_5_pro` |
| Search-grounded infographic, photo restyle | `nano_banana_pro` | `gpt_image_2` |
| Layered PNG export (10+ separated layers) | `seedream_5_pro` | `gpt_image_2` |
| Animate an approved still | `flow.omni_flash` (≤10s) | `seedance_2` |
| First/last-frame bridge, ingredients continuity | `flow.veo` | `seedance_2` |
| 15s multi-camera take with @asset references | `seedance_2` | `flow.veo` |
| Human close-ups (no watermark) | `hailuo` | `user_footage` |
| Real-world b-roll | `pexels` | `user_footage` |

Hard rail: no generated video call may run without an approved start frame unless the decision log explicitly waives image-first for that shot.

Every asset ships as a copy-paste prompt in the shot's `pipeline`, ending with the locked THEME SUFFIX from `v7/theme_catalog.md` and written per `v7/AI_TOOLS_GUIDE.md`. Mark any credit-spending step in its `note`.

### 3. Camera/Motion Verb
| Verb | Meaning | Use When |
|------|---------|----------|
| static | No camera movement | Charts, text annotations |
| push | Gentle zoom in (1.05x-1.15x) | Revealing detail in document/still |
| tilt | Camera rotates (5-15°) | Highlight transitions (ArticleDoc) |
| drift | Slow horizontal/vertical | B-roll, ambient holds |
| kinetic | Fast, energetic camera | Reveals, shocking transitions |

### 4. Talking-Head Decision
If the script line is first-person narration or host-to-camera:
- `talkingHead: true` — HostScene with lower-third
- Overlay FACT_CARD for data

### 5. Credit Budget Gate
Track the daily credit budget (50 cr/day default):
- Dreamina still generation: ~1 cr each
- Dreamina Multiframes: ~3-5 cr
- Flow Veo 3.1 Lite/Fast/Quality: 10/20/100 cr per generation
- Flow frame-video or ingredients-video: 7/10/12/15 cr for 4s/6s/8s/10s
- Runtime override: use the tool's visible cost display as the final cost source. The 2026-06-26 Flow check showed a 4s setup at 7 credits, matching the operator budget table.
- Nano Banana 2/Pro: Flow image generation lane; treated as unlimited for planning, but verify the visible model before batch use
- Flag when budget is exceeded and fall back to cheaper options

---

## OUTPUT FORMAT

```json
{
  "shots": [
    {
      "id": "shot_01",
      "scriptLine": "Narration text for this line",
      "archetype": "STAT_COUNTER",
      "tool": "remotion_component",
      "camera": "static",
      "durationInFrames": 150,
      "props": {
        "title": "Lost Revenue",
        "value": 1500000000,
        "prefix": "PKR ",
        "unit": "per year",
        "bgSrc": "port.jpg",
        "accentColor": "#b8860b"
      },
      "talkingHead": false,
      "assetNeeded": "port.jpg",
      "qaRisk": "Missing count-up animation"
    }
  ],
  "metadata": {
    "totalShots": 24,
    "totalCredits": 14,
    "flowCreditsPlanned": 10,
    "dreaminaCreditsPlanned": 4,
    "budgetRemaining": 36,
    "budgetOk": true
  }
}
```

---

## HANDOFF
Deliver `remotion/src/shotlist.json` to the Build Agent. The shotlist is the sole source of truth for what to build. If the Creative Director later adjusts the script, update the shotlist accordingly.
