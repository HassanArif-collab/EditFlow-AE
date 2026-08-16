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
      "technique": "NONE",
      "props": { "value": 8484, "prefix": "Rs ", "unit": "per month", "pulse": true },
      "needs": [],

      "durationInFrames": 150,
      "placement": "full",

      "productionRoute": "after_effects",
      "routeReason": "pure data shot — AE builds it better than generation",

      "assetDir": "assets/cold-open/energy-fluid",
      "assets": ["poverty-line-doc.png"],
      "sourceAnchor": {
        "url": "https://www.dawn.com/news/2011436",
        "image": "assets/_captures/dawn-com-2011436/fullpage.png",
        "pageWidth": 1280,  "pageHeight": 6461,
        "imageWidth": 1280, "imageHeight": 6461,
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
displayed verbatim — never rewritten, never dropped silently.

`technique` is narrowed to exactly what a builder here can act on:
**`NONE`, `PUSH_IN`, `KEN_BURNS`, `DOC_SCROLL`, `PARALLAX_2_5D`**. Send `NONE`
rather than omitting the field, so "deliberately still" is distinguishable from
"forgot to say".

The motion values belong to the still-image recipes, which are all still
`planned`. **The three built recipes carry their motion intrinsically and take
`NONE`.** Each recipe in [recipes.md](recipes.md) states what it accepts; a
technique a recipe does not honour still builds and shows on the row as
**not applied**.

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
| `needs` | no | Array naming what is missing, e.g. `["props.value"]`. See below. |

## `needs` — completeness is declared, never guessed

A shot is either fully specified or says what it is missing. The panel does not
infer "half-filled" from the shape of the JSON, because absent and
deliberately-empty look identical there.

- `needs` absent or `[]` → complete. Builds with no model involved.
- `needs: ["props.value", "assets"]` → the local model is asked to fill exactly
  those, and only those. Everything else is taken as given.

This is what keeps the pipeline working with the model switched off: a complete
brief never invokes it.

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

## Assets — two different bases, so read this carefully

One setting in the panel names the **visuals root** — your project's `visuals/`
folder. Everything lives under it, but the two path fields are **not** relative
to the same thing:

```
<visuals root>/
  manifest.json
  assets/
    cold-open/energy-fluid/          <- assetDir, and assets[] are relative to IT
      poverty-line-doc.png
    _captures/dawn-com-2011436/      <- sourceAnchor.image is relative to the ROOT
      fullpage.png  anchor.json  inventory.json
```

| field | relative to | resolves as |
|---|---|---|
| `assets[]` | `assetDir` | `<root>/<assetDir>/<filename>` |
| `sourceAnchor.image` | the **visuals root** | `<root>/<image>` |

Captures are shared: one page cited by four shots is captured once, so it cannot
live inside any single shot's folder. `sourceAnchor.image` therefore arrives as
a full root-relative path with nothing to join — a bare `fullpage.png` would
resolve into the shot folder and silently miss.

**`assetDir` is opaque.** Never parsed, never sorted, never used to infer order.
Shot order is array position in `shots[]` and nothing else. This is why the
folder names carry no numeric prefix: reordering the script would otherwise
rename directories and orphan every asset already dropped into them.

Folders are created by the Content Prompts side before generation and are empty
drop targets — no `prompt.txt` or `notes.md` inside them; metadata lives in
`manifest.json`. A file named in `assets` but missing from disk is flagged
**before** the build starts, not discovered during it.

## `sourceAnchor`

```json
"sourceAnchor": {
  "url": "https://www.dawn.com/news/2011436",
  "image": "assets/_captures/dawn-com-2011436/fullpage.png",
  "pageWidth": 1280,  "pageHeight": 6461,
  "imageWidth": 1280, "imageHeight": 6461,
  "rect": { "x": 108, "y": 1632, "w": 728, "h": 92 }
}
```

`rect` is in **page** coordinates. `pageWidth/pageHeight` describe that
coordinate space; `imageWidth/imageHeight` describe the PNG on disk. The
Content Prompts side commits to never resizing a capture, so the two pairs are
equal today — but the panel maps through the ratio anyway, so a high-DPR
capture would still land correctly.

**The panel compares `imageWidth`/`imageHeight` against the real dimensions of
the file it imports, and refuses the shot when they differ**, naming both
numbers. A capture resized or re-exported after the fact would put the
highlight on the wrong paragraph, and that reads as a research error rather
than a scaling bug. Refusing is the kinder failure.

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

## Where these docs live

Two separate GitHub repositories:

| | repo |
|---|---|
| this panel, and both contract docs | `HassanArif-collab/EditFlow-AE`, branch `feat/visual-pipeline` |
| the web agent and the prompts | `HassanArif-collab/Content-Prompts-for-AI` |

Fetch the contract as raw URLs, not paths:

```
https://raw.githubusercontent.com/HassanArif-collab/EditFlow-AE/feat/visual-pipeline/docs/brief-schema.md
https://raw.githubusercontent.com/HassanArif-collab/EditFlow-AE/feat/visual-pipeline/docs/recipes.md
```

`docs/recipes.md` is generated from `cep-panel-ae/client/src/recipes.js` and a
test fails if the committed copy is stale, so the raw URL is always what the
panel actually enforces.

**One trap, flagged rather than fixed:** this repo also contains a *snapshot* of
the prompts under `content-prompts/` (90 tracked files, copied during an earlier
unify step). It is not the live source. `Content-Prompts-for-AI` is. Anything
edited there will not appear here, and the copy will drift — treat it as
read-only history, or delete it once the split is settled.
