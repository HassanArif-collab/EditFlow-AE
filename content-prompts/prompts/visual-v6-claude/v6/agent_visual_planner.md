# AGENT: VISUAL PLANNER
## Instruction File: `v6/agent_visual_planner.md`

**MISSION:** Read the script + Visual Intent Block and produce `shotlist.json` — a per-line decision of archetype, tool, camera, and duration. This is the bridge between the script and the visual factory.

**YOU RECEIVE:**
- The full script (narration + visual track from Agent 5B/5D)
- The Visual Story Arc (7 set pieces from Narrative Architect)
- `v6/visual_archetypes.md`
- `v6/prompt_formulas.md`
- `v6/browser_capabilities.md` when browser tools are candidates
- `tools/visual_tool_router.js` for executable tool routing
- The research reports (for asset sourcing)

---

## PLANNER LOGIC

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
| `DOC_HIGHLIGHT` | article_capture.js (screenshot) + ArticleDoc component | Document recreation |
| `SCREENSHOT_HIGHLIGHT` | article_capture.js | Fallback recreation |
| `BROLL_VIDEO` | Pexels / Dreamina video | Dreamina still → animated |
| Cinematic stills | Dreamina GPT Image 2 / ChatGPT Image 2; record current UI label if shown as `Seedream 4.1` / `Image 4.1`, but do not silently substitute it | Flow Nano Banana 2/Pro |
| Video generation | Dreamina Multiframes / Flow | — |
| Lottie accent | `@remotion/lottie` with Lottie JSON | — |

### 2A. Browser Capability Routing
For browser tools, route by capability instead of fixed scripts:

| Need | Preferred Capability | Fallback |
|------|----------------------|----------|
| Text/data/diagram start frame | `dreamina.still_image` with GPT Image 2 / ChatGPT Image 2 required | Remotion component |
| Photoreal or character-consistent start frame | `flow.image_model` with Nano Banana 2/Pro | Dreamina GPT Image 2 / ChatGPT Image 2 |
| Animate one approved start frame | `flow.frames_to_video` | Remotion LivingStill/parallax |
| Start-to-end transformation | `flow.frames_to_video` with start + end frames | `dreamina.multiframes` |
| Subject/environment/style lock | `flow.ingredients_to_video` | Nano Banana start frame + Remotion |
| 2-10 keyframe journey | `dreamina.multiframes` | Flow Frames/Ingredients |
| Surgical edit to a clip | `flow.omni_edit` | Remotion patch or regenerate |

Hard rail: no generated video call may run without an approved start frame unless the decision log explicitly waives image-first for that shot.

Executable check: when a shot has enough metadata, run or mirror `tools/visual_tool_router.js` to fill `tool`, `capability`, `flowCreditsPlanned`, `dreaminaCreditsPlanned`, `requiresBrowserAuth`, and `requiresScout`. If the router and planner disagree, record the reason in the decision log.

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
- Runtime override: use the visible browser UI as final cost source. The 2026-06-26 Flow scout showed a 4s setup at 7 credits, matching the operator budget table.
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
    "requiresBrowserAuth": true,
    "requiresScout": true,
    "budgetRemaining": 36,
    "budgetOk": true
  }
}
```

---

## HANDOFF
Deliver `remotion/src/shotlist.json` to the Build Agent. The shotlist is the sole source of truth for what to build. If the Creative Director later adjusts the script, update the shotlist accordingly.
