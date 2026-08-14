# ArticleDoc Highlight — v6 for Claude

## Component Specification

**Composition type:** DOC_HIGHLIGHT / SCREENSHOT_HIGHLIGHT
**Render stack:** Remotion (React component)
**Source:** `article_capture.js` — real browser screenshots
**Duration band:** 8.0-12.0s

---

## THE 9-PHASE CINEMATIC SEQUENCE

Each DOC_HIGHLIGHT plays this exact sequence within its duration band:

```
Phase 0 (0.0s)  — Evidence enters scene. Documentary texture background settles.
Phase 1 (1.5s)  — Publication logo or source treatment fades in outside zoom wrapper.
Phase 2 (2.5s)  — Highlight sweep begins: slow paint across the cited sentence (1.8-2.2s).
Phase 3 (4.0s)  — Slow camera push or parallax develops. Center-safe zoom 1.10x-1.35x.
Phase 4 (6.0s)  — Per-element DOF blur (2-4px) softens non-hero text. Key sentence stays sharp.
Phase 5 (7.0s)  — Vignette subtly darkens edges. Grain overlay (0.03-0.07) visible.
Phase 6 (8.0s)  — Stat or callout reveal lands (if applicable — count-up from 0).
Phase 7 (10.0s) — Hold on evidence. Scene breathes. Flicker ±0.4% opacity.
Phase 8 (end)   — Exit transition or hard cut to next shot.
```

---

## CAMERA ANGLES

The article document is shown from one of three camera angles, selected per-shot by the Visual Planner. The camera glides smoothly between angles in consecutive DOC_HIGHLIGHT shots — no cuts.

| Angle | Description | Use Case |
|-------|-------------|----------|
| 95° | Near-side oblique (tilted right ~5°) | First highlight in a sequence |
| 180° | Front-facing (straight on) | Middle highlight, direct evidence |
| 270° | Far-side oblique (tilted left ~5°) | Final highlight, concluding evidence |

**Camera motion:** Gentle drift during the hold phase. No sudden movements.

---

## LAYOUT RULES

1. **Base layer:** Documentary paper/texture background — never clean white or solid color.
2. **Publication logo:** Positioned in top-right or bottom-left corner. Lives **outside** the zoom and perspective transform wrappers — stays fixed while the document moves.
3. **Document layer:** The screenshot is placed on a floating card with subtle shadow. Has slight perspective transform based on camera angle.
4. **Highlight bar:** A semi-transparent yellow/gold bar that paints across the cited sentence. Position calculated from actual DOM text bounds (from `article_capture.js` — never guessed by eye).
5. **DOF layer:** Non-hero text receives 2-4px blur. Hero text stays sharp.
6. **Grain layer:** Subtle film grain overlay, opacity 0.03-0.07 combined.
7. **Vignette:** Subtle dark vignette on edges, revealed during camera push.
8. **Stat overlay** (optional): If a key number is cited, it appears as a floating stat with count-up from 0.

---

## DESIGN RULES

- **Aged-paper texture** as base — not clean white.
- **Highlight sweep:** 1.8-2.2s. Faster looks cheap.
- **Zoom:** Center-safe only. Transform-origin: center center. Never top-left.
- **Zoom range:** 1.10x-1.35x maximum. Beyond 1.35x, text becomes unreadable.
- **Grain:** 0.03-0.07 combined opacity. Texture, not distraction.
- **Flicker:** ±0.4% opacity feel. Subliminal only.
- **No jitter wrapper.** If motion feels dead, fix hierarchy or timing.
- **No fake documents.** Source content must come from a real screenshot.

---

## SOUND

- `snd_sweep.mp3` during highlight sweep and camera push.
- Ambient bed only during hold phase.

---

## IMPLEMENTATION APPROACH

The Build Agent creates this as a Remotion component (`ArticleDoc.tsx`) per shot:
- Props: `{ screenshotPath, logoPath, highlightRect, angle, statValue?, statLabel?, cameraAngle }`
- Uses `useVideoConfig()` for frame timing
- Uses `spring()` for smooth camera push and highlight animation
- Uses `interpolate()` for DOF blur, grain opacity, and vignette timing
- Highlight bar position is a prop passed from `article_capture.js` output
