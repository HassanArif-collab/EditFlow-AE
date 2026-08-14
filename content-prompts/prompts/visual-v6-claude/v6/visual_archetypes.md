# Visual Archetypes v6 — Claude Pipeline

This file keeps the craft intelligence that was too heavy for the entry prompt. Use it as the source of truth for archetype choice, timing bands, motion intent, audio mapping, and visual limits.

**BUILD-ON-THE-GO:** This file describes archetypes for the Build Agent to create as Remotion components per shot. There are NO pre-built components. The agent builds each component following these specs.

---

## Global Selection Rules
1. Choose the simplest archetype that clearly communicates the line's primary insight.
2. Complexity must be earned. Do not use a `TIER 3` visual when a `TIER 1` solution would read faster and cleaner.
3. Every frame must have:
   - one primary focus
   - one secondary support
   - one tertiary environment layer
4. The static frame must still communicate the idea.
5. Motion should reveal structure, emphasis, sequence, or cause. Motion that exists only to decorate is noise.
6. Use only one vivid accent per shot unless the chart archetype explicitly requires multiple categories.
7. No video under static text.
8. No wrapper jitter. If motion feels dead, fix timing or depth, not by adding random shake.
9. Use documentary restraint. Premium does not mean busy.

---

## Timing Matrix

| Archetype | Duration | Default Rhythm | Typical Stagger |
|-----------|----------|----------------|-----------------|
| `SECTION_TITLE_CARD` | 3.5-5.0s | 0.8s in / 2.0s hold / 0.6s out | 3-6 frames between letters |
| `STAT_COUNTER` | 4.0-6.0s | 0.8s in / 2.4s hold / 0.6s out | 4-8 frames between supporting elements |
| `BAR_CHART` | 5.0-7.0s | 1.0s in / 3.0s hold / 0.7s out | 4-8 frames between bars |
| `LINE_GRAPH` | 5.0-7.0s | 1.0s in / 3.2s hold / 0.7s out | 4-8 frames between milestones |
| `PIE_CHART` | 5.0-7.0s | 1.0s in / 3.0s hold / 0.7s out | 4-8 frames between segments |
| `COMPARISON_PANEL` | 5.0-7.0s | 1.0s in / 3.0s hold / 0.7s out | 6-10 frames between left/right reveals |
| `FLOW_DIAGRAM` | 6.0-8.0s | 1.2s in / 4.0s hold / 0.8s out | 5-10 frames between nodes |
| `SCREENSHOT_HIGHLIGHT` | 8.0-12.0s | 1.5s in / 5.5s hold / 1.0s out | 6-10 frames between major phases |
| `DOC_HIGHLIGHT` | 8.0-12.0s | 1.5s in / 5.5s hold / 1.0s out | 6-10 frames between major phases |
| `GSAP_METAPHOR` | 5.0-7.0s | 1.0s in / 3.0s hold / 0.7s out | 4-8 frames between layers |
| `EMOTIONAL_MOMENT` | 8.0-12.0s | 1.2s in / 6.0s hold / 0.8s out | minimal |
| `BROLL_VIDEO` | 5.0-7.0s | observational hold with minimal cuts | not applicable |
| `TEXT_ANNOTATION` | 3.0-4.0s | 0.6s in / 1.8s hold / 0.5s out | 3-5 frames |

Always think in seconds first, then convert to frames at 30 fps.

---

## Canonical Motion Limits

| Parameter | Safe Range | Notes |
|-----------|------------|-------|
| Letter stagger | 0.03-0.10s | Faster feels mushy, slower feels sluggish |
| Highlight sweep | 1.8-2.2s | Faster looks cheap |
| Stat count-up | 2.5-4.0s | Longer for large or alarming values |
| Center-safe document zoom | 1.10x-1.35x | Do not zoom from top-left |
| Documentary DOF blur | 2px-4px | Blur supporting text only |
| Grain opacity | 0.03-0.07 combined | Texture, not distraction |
| Flicker | +/-0.4% opacity feel | Subliminal only |
| Foreground parallax rate | 1.5x | Fastest layer |
| Midground parallax rate | 1.0x | Main action layer |
| Background parallax rate | 0.5x | Slowest layer |

If a shot feels lifeless, first fix hierarchy, rhythm, or reveal order. Do not solve weak motion by pushing effects past these limits.

---

## Layout Rules
1. Respect safe margins. No vital text or data should touch the outer 10% of frame space.
2. Default to a left or right third for the main focal area, leaving negative space for support text or citations.
3. Use optical alignment, not floating placement.
4. If the shot has both a chart and text, decide which is primary. They cannot both be heroes.
5. Favor hard cuts, wipes, or paper-like reveals over generic dissolves unless the beat is intentionally reflective.

---

## Color and Attention Rules
1. Avoid pure bright gold. Prefer a restrained ochre or tarnished gold.
2. Limit red warning reveals. Use them for genuinely alarming beats, not as a default accent.
3. Topic-specific symbolic colors stay topic-specific. Do not universalize them across every documentary.
4. Multiple saturated colors are allowed only when the chart archetype genuinely needs category separation.

---

## Audio Mapping

| Archetype | Default Sound |
|-----------|---------------|
| `SECTION_TITLE_CARD` | `snd_transition.mp3` |
| `STAT_COUNTER` neutral | `snd_appear.mp3` |
| `STAT_COUNTER` alarming | `snd_impact.mp3` with restrained `snd_tick.mp3` support if needed |
| `SCREENSHOT_HIGHLIGHT` | `snd_sweep.mp3` |
| `DOC_HIGHLIGHT` | `snd_sweep.mp3` |
| `BAR_CHART` | `snd_sweep.mp3` |
| `LINE_GRAPH` | `snd_sweep.mp3` |
| `PIE_CHART` | `snd_sweep.mp3` |
| `FLOW_DIAGRAM` | `snd_appear.mp3` or restrained `snd_tick.mp3` accents |
| `COMPARISON_PANEL` | `snd_appear.mp3` |
| `GSAP_METAPHOR` | `snd_appear.mp3` |
| `EMOTIONAL_MOMENT` | `snd_ambient_bed.mp3` only |
| `BROLL_VIDEO` | `snd_ambient_bed.mp3` only |
| `TEXT_ANNOTATION` | `snd_appear.mp3` |

---

## Archetype Selection Matrix

| Script Need | Preferred Archetype | Why |
|-------------|---------------------|-----|
| Section reset or chapter heading | `SECTION_TITLE_CARD` | Establishes structure and rhythm |
| Single statistic or key number | `STAT_COUNTER` | Fastest way to make a number land |
| Ranked values or category spread | `BAR_CHART` | Direct comparison |
| Change over time or trend | `LINE_GRAPH` | Shows movement and inflection |
| Proportion or share of a whole | `PIE_CHART` | Good only when categories are few |
| Before vs after or A vs B | `COMPARISON_PANEL` | Keeps comparison literal |
| Multi-step process or incentive chain | `FLOW_DIAGRAM` | Shows causality |
| Cited article or report excerpt | `SCREENSHOT_HIGHLIGHT` / `DOC_HIGHLIGHT` | Grounds claim in evidence |
| Abstract idea needing a physical stand-in | `GSAP_METAPHOR` | Makes the invisible visible |
| High-emotion line that should breathe | `EMOTIONAL_MOMENT` | Lets tone land |
| Scene-setting environmental line | `BROLL_VIDEO` | Adds world texture |
| Quick identification of person or institution | `TEXT_ANNOTATION` | Keeps support beats light |

---

## `SECTION_TITLE_CARD`
Use when a new section, act, or major argument begins.

Rules:
- Split the headline into individual letter spans.
- Use staggered letter animation. Never fade the whole block in at once.
- Keep one title, one accent treatment, and one supporting line at most.
- Rotate signature variants across sections so the video does not repeat one exact title choreography.

Approved signature families:
- slide up
- scale from center
- slide from left
- fade with restrained rotation settle

QA focus:
- missing stagger
- weak hierarchy
- overlong title text

---

## `STAT_COUNTER`
Use for single numbers, percentages, currency, case counts, totals, and key fact beats.

Rules:
- Number must count from `0` or from the previously visible value.
- Label enters before or alongside the number, not after a long delay.
- Unit and citation support should be lighter than the hero number.
- Alarming stats may get one restrained pulse after the count completes.

Avoid:
- static first-frame numbers
- multiple hero numbers competing at once
- red warning styling on neutral stats

QA focus:
- illegible number
- fake urgency
- count too fast

---

## `BAR_CHART`
Use for ranked categories, before/after grouped comparisons, and institutional breakdowns.

Rules:
- Grid/axes appear first if they are needed.
- Bars rise from baseline with restrained overshoot.
- Values count up.
- Labels arrive after the data is readable.
- The specific bar mentioned in the script gets the accent treatment.

Avoid:
- all bars animating chaotically
- labels competing with the bars
- decorative multi-color overload

QA focus:
- bad hierarchy
- flat contextual insight
- cramped labels

---

## `LINE_GRAPH`
Use for trend, growth, collapse, timeline movement, or an inflection point.

Rules:
- Draw left to right.
- Show milestone dots only where the script needs emphasis.
- After the line is legible, call out the specific peak, valley, or turning point the voiceover mentions.
- Use annotation sparingly.

Avoid:
- showing too many milestones
- animating the line faster than viewers can read it
- making the final point look unimportant

QA focus:
- wrong focal moment
- unreadable timeline
- mechanical draw timing

---

## `PIE_CHART`
Use only when proportions are few and the audience truly needs part-to-whole logic.

Rules:
- Limit to a small number of categories.
- Segments should expand cleanly from the center or sweep in with clear order.
- Labels arrive after segment positions are clear.
- Use the accent color only for the category that matters most to the script.

Avoid:
- too many slices
- rainbow palettes
- tiny labels around the whole circle

QA focus:
- clutter
- weak labeling
- poor proportion readability

---

## `COMPARISON_PANEL`
Use for side-by-side systems, before/after states, or two institutions in tension.

Rules:
- Keep each side structurally parallel.
- Reveal both sides in a coordinated but slightly staggered sequence.
- Put the decisive difference in the visual center of attention.
- If one side is clearly more important, make that side the hero and the other side the reference.

Avoid:
- two equally loud sides fighting each other
- mirrored clutter
- unclear conclusion

QA focus:
- bad hierarchy
- wrong comparison emphasis
- overload

---

## `FLOW_DIAGRAM`
Use for systems, incentive chains, money movement, bureaucratic sequence, or causal loops.

Rules:
- `2-3` steps -> keep it simple and diagram-first
- `4+` steps -> layer the reveal and use travel cues or dots
- One node should be the current focal point while others support
- Use arrows, movement, and timing to show cause, not just connection

Variants:
- `FLOW_DIAGRAM`
- `FLOW_DIAGRAM+GSAP`
- `FLOW_DIAGRAM+VIDEO` only when video is clearly the main visual or a small accent, never both at once

Avoid:
- every node animating at once
- duplicated diagram + video saying the same thing
- decorative arrows with no narrative meaning

QA focus:
- wrong archetype choice
- confusing causality
- cluttered node density

---

## `SCREENSHOT_HIGHLIGHT`
Use when the proof is strongest as an article, report excerpt, website section, or quoted visual evidence.

Rules:
- Treat it like documentary evidence, not a UI demo.
- Use paper or restrained documentary treatment.
- Put the logo outside zoom and perspective wrappers.
- Measure highlight position from actual DOM text.
- Use per-element blur only on non-hero text.
- Keep the key sentence sharp.
- Highlight sweep must be slow.
- Zoom must stay center-safe.
- Grain and flicker must stay subtle.

Suggested phase order inside the duration band:
1. evidence enters / environment settles
2. logo or source treatment appears
3. highlight sweep begins
4. slow camera push or parallax develops
5. support text softens
6. stat or callout reveal lands

Avoid:
- wrapper jitter
- fake overlay blur
- overdone grain
- highlight bars guessed by eye

QA focus:
- highlight misalignment
- too much grain/flicker
- cheap camera movement

---

## `DOC_HIGHLIGHT`
Use for documents, audits, filings, legal notices, leaked paperwork, and institutional records.

Rules:
- Similar discipline as `SCREENSHOT_HIGHLIGHT`, but the document itself is the hero rather than a webpage.
- Keep the texture documentary and tactile.
- Show only as much of the page as needed to make the evidence credible and readable.
- Use annotation or stat overlays sparingly.

Avoid:
- turning serious evidence into a flashy motion gimmick
- giant unreadable document pages with no focal guidance

QA focus:
- readability
- fake-document look
- weak evidence framing

---

## `GSAP_METAPHOR`
Use when the line is abstract and needs a physical or spatial stand-in.

Rules:
- Use one metaphor, not three.
- Keep it simple enough to understand in the paused frame.
- Motion should reveal the mechanism inside the metaphor.
- If a static generated image helps, use the `GSAP_METAPHOR+IMAGE` variant.

Good metaphor families:
- gate
- bottleneck
- stack of documents
- siphon
- hidden tunnel
- balance beam
- broken chain

QA focus:
- wrong archetype choice
- metaphor too literal or too random
- clutter

---

## `EMOTIONAL_MOMENT`
Use for lines that need weight, grief, tension, dread, or moral reflection more than explanation.

Rules:
- Restraint beats spectacle.
- Let the shot hold longer than a standard chart beat.
- Minimal text on screen.
- Ambient bed only unless a stronger cue is specifically justified.
- Keep camera movement nearly invisible unless the moment truly benefits from a gentle push.

Avoid:
- turning emotional beats into ad-like montage
- crowding the frame with labels

QA focus:
- tonal mismatch
- over-animation
- stock-photo feel

---

## `BROLL_VIDEO`
Use for environmental lines, scene-setting, atmosphere, human context, or physical locations.

Rules:
- Keep it observational and credible.
- Use one camera idea: static, slow pan, slow dolly, or gentle push.
- If the footage contains text, it should not become the main thing viewers must read.
- B-roll is standalone or a contained accent, not moving wallpaper.

Avoid:
- ad aesthetic
- dramatic drone obsession
- too much motion for a quiet line

QA focus:
- wrong tone
- fake stock aesthetic
- distracting motion

---

## Support Variants Preserved From v4/v5
These remain available when the script needs them:
- `TEXT_ANNOTATION` for people and institutions
- `TREND_INDICATOR` as a lightweight line-graph variant
- `GSAP_METAPHOR+IMAGE` when metaphor needs a still image assist
- `TICKER` for short rolling source or fact strips used sparingly

Use support variants only when they reduce complexity rather than adding it.
