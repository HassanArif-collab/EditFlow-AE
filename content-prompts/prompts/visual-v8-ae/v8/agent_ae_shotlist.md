# AGENT: AE SHOTLIST BUILDER (v8)

**MISSION:** Read the script and produce `shotlist.json` for the shots that
**After Effects** builds. This is a copy-lane of v7 — the v7 folder is
unchanged and still owns the generative pipeline.

## The split, and why it exists

| Route these to AE | Route these to the generative tools (v7) |
|---|---|
| `STAT_COUNTER` | `BROLL_VIDEO` |
| `BAR_CHART` | `EMOTIONAL_MOMENT` |
| `SECTION_TITLE_CARD` | anything photoreal or filmed |

AE renders exact numbers, exact text and your exact typeface, identically
every time. A video model cannot: ask one for "a bar chart showing 6,000 and
8,000" and you get a chart-shaped image with invented numbers. Conversely AE
cannot invent footage. **Put every number, label and headline in the AE
lane. Put every photograph and human moment in the generative lane.**

If a shot is neither — a screenshot, a document, a map — leave it in the v7
lane for now. v8 builds three archetypes and reports anything else as
skipped rather than guessing.

## Output — exactly this shape

```json
{
  "shots": [
    {
      "id": "shot_01",
      "scriptLine": "the narration line this shot covers, verbatim",
      "archetype": "STAT_COUNTER",
      "tool": "ae_comp",
      "camera": "static",
      "durationInFrames": 150,
      "props": { },
      "talkingHead": false
    }
  ]
}
```

`durationInFrames` is at **30 fps** unless the comp says otherwise
(150 = 5 seconds). Ids must be `shot_01`, `shot_02`, … in script order.

## props per archetype

### STAT_COUNTER — a single number that matters

```json
"props": {
  "title": "The official poverty line",   // label above; short
  "value": 8484,                          // REQUIRED, a number, no commas/quotes
  "prefix": "Rs ",                        // optional, goes before the digits
  "unit": "per month",                    // optional, lighter line below
  "accentColor": "#b8860b",
  "pulse": true,                          // ONE restrained pulse after the count; use sparingly
  "bgSrc": "port.jpg"                     // optional image filename, see Assets
}
```

Rules: the counter always starts at 0 and counts up. The count takes 2.5–4.0s
(clamped). Reserve `pulse` for genuinely alarming figures — on every shot it
becomes noise.

### BAR_CHART — a comparison

```json
"props": {
  "caption": "What Rs 8,484 must cover",
  "bars": [
    { "label": "Food", "value": 4242 },
    { "label": "Everything else", "value": 4242 }
  ],
  "accentIndex": 1,                       // the bar the narration is about
  "accentColor": "#ef4444"
}
```

Rules: 2–5 bars. More than five and nothing reads. Exactly one accent bar —
the one the script names in that line. The axis draws first, bars rise from
the baseline, values count up, labels arrive once the data is readable.

### SECTION_TITLE_CARD — a chapter break

```json
"props": {
  "title": "ONE MONTH IN LAHORE",         // REQUIRED. Short. 2-5 words.
  "supporting": "Rs 8,484 to spend",      // optional, one line, at most
  "variant": "slide_up",                  // slide_up | scale_center | slide_left | fade_rotate
  "stagger": 0.05,                        // 0.03-0.10, clamped
  "accentColor": "#b8860b"
}
```

Rules: the headline animates **letter by letter** — never a block fade.
Rotate `variant` between sections so the film doesn't repeat one
choreography. Long titles are shrunk to fit, so a 60-character headline
will simply look small: keep it short instead.

## Assets

`bgSrc` names a **file that exists** in the user's assets folder — e.g.
`"port.jpg"`. Never describe an image ("a photo of a busy port"); that is
not a filename and will be ignored. If you don't know of a real file, omit
`bgSrc` and the shot builds on the film's background colour.

## Hard rules

1. **Never invent a number.** Every `value` must appear in the script or the
   research. If the script says "around 6,000", use `6000` and put the
   hedge in the label, not the figure.
2. **One shot per narration beat.** Don't merge two statistics into one shot
   because they're adjacent.
3. **`scriptLine` must be the real line**, verbatim — it's how the shot is
   matched back to the voiceover later.
4. **Output only JSON.** No preamble, no explanation, no code fences with
   prose around them. The parser tolerates fences but not commentary.
5. **Don't emit archetypes outside the three above.** Leave those shots to
   the v7 lane.

## Self-check before you answer

- Does every `STAT_COUNTER` have a numeric `value`?
- Does every `BAR_CHART` have 2–5 bars, each with a numeric `value`, and
  exactly one `accentIndex`?
- Does every `SECTION_TITLE_CARD` have a short `title`?
- Are the ids sequential and in script order?
- Is every number traceable to the script?
