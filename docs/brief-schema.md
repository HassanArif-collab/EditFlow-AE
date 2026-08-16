# Brief schema — the order form the AE panel accepts

The web agent writes this; the After Effects panel builds from it. It is the
only thing the two tools share. Recipe names and their props live in
[recipes.md](recipes.md), which is generated from the code and cannot drift.

Nothing here throws. A shot the panel cannot use is reported on its own row
with a reason and the rest of the brief still builds — one bad shot must never
cost you the other twenty-three.

## Shape

```json
{
  "shots": [
    {
      "id": "shot_02",
      "scriptLine": "That line is Rs 8,484 per month.",

      "archetype": "STAT_COUNTER",
      "recipe": "STAT_COUNTER",
      "technique": "PUSH_IN",
      "props": { "value": 8484, "prefix": "Rs ", "unit": "per month", "pulse": true },

      "durationInFrames": 150,
      "placement": "full",

      "productionRoute": "after_effects",
      "routeReason": "pure data shot — AE builds it better than generation",

      "assetDir": "01-cold-open/03-energy-fluid",
      "assets": ["poverty-line-doc.png"],
      "sourceAnchor": {
        "url": "https://www.dawn.com/news/2011436",
        "image": "fullpage.png",
        "pageHeight": 6461,
        "rect": { "x": 108, "y": 1632, "w": 728, "h": 92 }
      },

      "note": "hold on the number, then push in slightly",
      "qaFocus": "illegible number, fake urgency, count too fast"
    }
  ]
}
```

A bare array (`[ {...}, {...} ]`) is accepted too, and prose around the JSON is
tolerated — agents add preambles.

## The three name fields are three different axes

They may carry the same word without conflict. `archetype: DOC_HIGHLIGHT,
recipe: DOC_HIGHLIGHT, technique: PUSH_IN` is legal and unambiguous.

| field | answers | owned by | validated against |
|---|---|---|---|
| `archetype` | *why* the script needs this shot | Content Prompts | `visual_archetypes.md` — their side |
| `recipe` | *what* After Effects builds | EditFlow-AE | [recipes.md](recipes.md) — this side |
| `technique` | *how* it moves | Content Prompts | `technique_deck.md` — their side |

The panel validates `recipe` only. `archetype` and `technique` are stored and
displayed verbatim — never rewritten, never dropped silently. A `technique` no
built recipe honours shows on the row as **not applied**; the honoured list is
published in [recipes.md](recipes.md) and is currently empty.

`recipe` may be `"CUSTOM"` to hand the shot to code mode instead of a builder.
If `recipe` is absent the panel falls back to `archetype`, so older shotlists
keep working.

## Fields

| field | required | meaning |
|---|---|---|
| `id` | yes | Stable across briefs. Comps, versions and the assets folder all key off it. Changing an id orphans the built comps rather than losing them. |
| `scriptLine` | yes | The spoken line, **pre-cleaned** — see below. |
| `archetype` | yes | Why the shot exists. |
| `recipe` | no | What to build. Falls back to `archetype`. |
| `technique` | no | How it moves. |
| `props` | per recipe | Typechecked against the recipe. See [recipes.md](recipes.md). |
| `durationInFrames` / `duration` | no | See precedence below. |
| `placement` | no | `full` (default) or `overlay`. |
| `productionRoute` | no | `after_effects` (default), `generated`, or `captured`. |
| `routeReason` | no | Why that route. Shown on hover so the choice is auditable. |
| `assetDir` | no | Folder under the visuals root holding this shot's files. |
| `assets` | no | Filenames inside `assetDir`. |
| `sourceAnchor` | for `DOC_HIGHLIGHT` | Captured page plus the rect to highlight. |
| `note` | no | Free English direction. The local model turns it into parameters. |
| `qaFocus` | no | The archetype's known failure modes, shown beside the review frame. |
| `talkingHead` | no | Marks a shot that sits over camera. Shown as a badge. |

## `scriptLine` is pre-cleaned — this is a contract

What arrives must be spoken text only. No `[HIGHLIGHT]…[/HIGHLIGHT]`, no
`[VISUAL: …]`, no `[BEAT — 2s silence]`, no timecodes, no footnote markers like
`[3]`, no `**bold**` or `*italic*`.

Not cosmetic: the panel displays this line, and matching it against the Whisper
transcript is how shot timing will be derived once that work is unparked.
Direction markers would break both.

## Duration

`durationInFrames` wins. Otherwise `duration` in seconds. Otherwise 5 seconds,
with a warning on the row so a forgotten value is visible rather than assumed.

Frames convert at the composition's own frame rate, not an assumed 30.

**Known weakness, accepted for now:** the web agent cannot know how long a line
takes to say, so these are estimates and the master will drift from the
narration. The master therefore carries your voiceover as its audio and every
row's duration is editable in the panel. Deriving duration from the transcript
is parked, not rejected.

## `placement`

- `full` — a cutaway. Takes its own slot in the master; the shot before ends.
- `overlay` — sits above your footage on its own layer and **consumes no slot**,
  so the shots around it keep their timing.

Default is `full`. Getting this wrong is not subtle: an overlay built as `full`
becomes a hard cut to a graphic in the middle of you speaking.

## `productionRoute`

- `after_effects` — the panel builds it from a recipe.
- `generated` — an image or video made elsewhere; the panel places the finished
  file. Shows **waiting for asset** until it appears in `assetDir`.
- `captured` — a screenshot or recording; placed the same way.

Use `routeReason` to say why. Some shots are genuinely faster and better
generated — a fluid metaphor with changing posture is days of puppet work in AE
and minutes in an image model.

## Assets

One setting in the panel names the **visuals root** — your project's `visuals/`
folder. Everything resolves under it:

```
<visuals root>/<assetDir>/<filename from assets[]>
```

Folders are created by the Content Prompts side before generation and are empty
drop targets — no `prompt.txt` or `notes.md` inside them. A file named in
`assets` but missing from disk is flagged **before** the build starts, not
discovered during it.

## `sourceAnchor`

```json
"sourceAnchor": {
  "url": "https://www.dawn.com/news/2011436",
  "image": "fullpage.png",
  "pageHeight": 6461,
  "rect": { "x": 108, "y": 1632, "w": 728, "h": 92 }
}
```

`image` is a filename inside `assetDir`. `rect` is in the pixel space of that
capture, and `pageHeight` is the capture's full height.

**The panel verifies `pageHeight` against the image on disk and refuses the shot
if they differ.** If the PNG were resized or re-exported after capture, the rect
would point at the wrong paragraph and the result would look like a research
error rather than a scaling bug. Better to refuse and say so.

## What the panel does with a bad shot

| problem | what happens |
|---|---|
| unknown `recipe` | row shows the error, names the valid recipes, does not build |
| planned recipe | row says it is not built yet; generate it for now |
| prop of the wrong type | refused with the expected type — never coerced |
| unknown prop | reported and dropped |
| missing asset | row shows **waiting for asset** |
| `pageHeight` mismatch | refused with both numbers |
| unhonoured `technique` | builds, row shows **not applied** |
| changed `scriptLine` | built comp flagged **script changed — rebuild?** |
