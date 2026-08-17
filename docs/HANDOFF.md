# Handoff — the AE visual pipeline

**Branch:** `feat/visual-pipeline` · **Updated:** 2026-08-17 (verified live in AE 25.6)

Read this first if you are picking this work up. It says what exists, what is
left, and which decisions must not be quietly undone.

---

## What this is

A CEP panel inside After Effects that turns a JSON brief into native AE comps.
A second agent, in a **separate repo** (`HassanArif-collab/Content-Prompts-for-AI`),
writes the brief. The two tools share exactly two files and nothing else:

- `docs/brief-schema.md` — the order form the panel accepts
- `docs/recipes.md` — generated from code; what AE can build

They fetch those as raw URLs off this branch. Never hand-edit `docs/recipes.md`;
run `node scripts/gen-recipe-docs.js`. A test fails if the committed copy is stale.

> ⚠ This repo also contains `content-prompts/` — a **stale snapshot** copied
> during an earlier unify step. It is not the live source. Do not edit it and do
> not trust it.

---

## Done

### Captions (older work, stable)
Word-level Whisper transcription, per-word AE text animation, draggable word
timing via layer markers, SRT export, a one-click installer (`EditFlow-AE.bat`),
and an AI transcript-correction pass with a hallucination guard.

### The visual pipeline

| Piece | Where | State |
|---|---|---|
| Recipe registry | `cep-panel-ae/client/src/recipes.js` | 8 recipes, all built |
| Builders | `cep-panel-ae/extendscript/visuals.jsx` (~1600 lines) | all keyframe-based |
| Brief parsing | `cep-panel-ae/client/src/shotlist-model.js` | full schema |
| Panel tab | `cep-panel-ae/client/src/visuals-view.js` | tab 6 |
| Contract docs | `docs/brief-schema.md`, `docs/recipes.md` | published |
| Demo | `samples/demo-brief.json` | 9 shots, all 8 recipes |
| Demo assets | `samples/visuals/`, made by `scripts/make-demo-assets.py` | capture, stack stills, parallax layers |

**The eight recipes:** `STAT_COUNTER`, `BAR_CHART`, `SECTION_TITLE_CARD`,
`LINE_GRAPH`, `COMPARISON_PANEL`, `DOC_HIGHLIGHT`, `ASSET_REVEAL`, `PROOF_STACK`.
That covers 10 of the other repo's 12 archetypes; only `PIE_CHART` and
`FLOW_DIAGRAM` route to generation.

**Techniques:** `NONE`, `PUSH_IN`, `KEN_BURNS`, `DOC_SCROLL`, `PARALLAX_2_5D`,
`DUST_DISSOLVE`. Each recipe declares which it honours; anything else shows on
the row as "not applied" rather than being dropped silently.

**State model.** The AE project is the source of truth for what is BUILT — the
panel re-reads it on every tab open and can never lose a build. The shotlist
lives in a sidecar next to the project: `MyDoc.aep` → `MyDoc.editflow-visuals.json`.
An unsaved project cannot persist anything and the tab says so in a banner.

---

## Not done

Roughly in the order that gives the most value.

2. **The agent (Step 4).** `POST /api/visuals/plan`, reusing
   `provider_service.chat(temperature=0)` exactly as
   `backend/services/subtitles/transcript_corrector.py` does. It is an
   **exception handler, not a driver**: a complete brief builds with the model
   switched off. It runs only for a `note` in English, missing props, a missing
   asset, or an archetype with no recipe. Guard it the same way the transcript
   corrector is guarded — it may only emit a known recipe with props that
   typecheck against the registry, and anything else is shown, not run.
3. **Code mode (Step 5).** For `recipe: "CUSTOM"`. Static gate first (ES3 only,
   `ef_vis_` namespace, no file or network access, no project mutation outside
   its own comp), one error round-trip, every attempt lands as a version.
4. **Voiceover in the master.** The master lays shots end to end on durations
   the web agent guessed. Import the voiceover as the master's audio and make
   each row's duration editable, so drift is visible immediately.
5. **`placement: overlay` in the master.** The field is parsed and shown but the
   master still lays every shot as a full-frame cutaway. An overlay shot should
   sit on its own layer and consume no slot.
6. **Contact sheet for review.** `ef_vis_renderShot` exists. Render one frame per
   shot and show `qaFocus` beside each, so reviewing twenty shots is not twenty
   comps opened by hand.
7. **Cancel on Build All**, and **script-change detection** (the sidecar stores
   `scriptLine`; diff on load and flag changed rows as "rebuild?").
8. **The last mile** — how the master reaches the edit (Dynamic Link vs render).
   Undecided, flagged so it is a decision rather than a surprise.

### Verified live in AE 25.6 (2026-08-17)

All nine demo shots build. Checked by dumping layer values and rendering
frames, not by trusting the return codes:

- eased keyframes land — the graph editor shows real S-curves
- parallax depth is exact: bg 90.0 / mid 99.9 / fg 109.9 from an 80% fit at
  zoom 1.25, i.e. the 0.5 / 1.0 / 1.5 rates
- the doc scroll settles with the cited line dead centre, marker swiped
- the proof-stack rhythm cuts at 1.57 / 1.13 / 0.81 / 0.59 then holds 0.90
- LINE_GRAPH's Shape vertices and Trim Paths draw correctly

Three bugs only the live pass could find, all fixed:

1. **DOC_HIGHLIGHT scrolled the page off frame.** A layer is positioned by its
   ANCHOR, which defaults to the centre of the source, not the top-left. The
   scroll maths assumed top-left. Renders showed half an empty frame.
2. **PROOF_STACK pushed before each image was visible.** Every image's move ran
   from t=0 instead of from its own cut, so each appeared already at full zoom
   and sat static. Now started at the layer's inPoint.
3. **ASSET_REVEAL never reported its technique**, so the panel said
   "not applied" for a parallax that was plainly working.

---

## Decisions that must not be quietly undone

- **Keyframes, not expressions.** Asked for explicitly. An expression cannot be
  curve-edited, so it can never feel hand-made. Exactly **one** expression is
  allowed in `visuals.jsx` — the counter's text formatter, driven by a keyframed
  Slider Control — and `tests/visuals-keyframes.test.js` fails if a second appears.
- **The deliverable is 1920×1080 @ 30fps**, pinned in `DELIVERABLE`
  (`shotlist-model.js`). It used to be inherited from whichever comp was
  frontmost, which meant an accidentally-open vertical comp built the whole
  brief vertical.
- **The registry cannot promise what AE cannot build.** `ef_vis_recipes()`
  reports a recipe as built only when its builder function really exists. Adding
  a recipe = write the builder + one row in `EF_VIS_RECIPES`. Nowhere else.
- **Props are typechecked once**, in `recipes.js`. Domain invariants that a type
  table cannot express (exactly one accent bar, tallest bar sets the scale) stay
  in `shotlist-model.js`. Do not add a second copy of the type rules.
- **Errors lose a shot; warnings never do.** A missing required prop is fatal.
  An invented key, an unapproved enum with a safe default, a bad technique — all
  warnings, shown on the row.
- **Read paths never write.** Listing versions or building a master must not
  create folders. Use `ef_vis_findShotFolder`, not `ef_vis_ensureShotFolder`.
  Only `ef_vis_buildShot` creates.
- **Builds never overwrite.** Every build is a new version; the star marks the
  active one; deleting the active one promotes another.

---

## Traps already paid for

- **An expression that sets Scale wipes the auto-fit underneath it.** The
  counter's pulse hardcoded `[100,100]` and silently undid the shrink that made
  a long number fit. Every technique now keys from the layer's *current* value.
- **`sourceAnchor.image` and `assets[]` resolve from different bases.** Captures
  are shared between shots, so they live at `<root>/assets/_captures/…` and are
  root-relative. `assets[]` are relative to `assetDir`. Joining a capture onto
  the shot folder silently finds nothing.
- **`app.fonts.allFonts` is a list of family GROUPS, not fonts.** Reading
  `.postScriptName` off it gives `undefined`.
- **Arrays returned from a `vm` sandbox fail `deepStrictEqual`** — different
  realm, different prototype. Compare elements.
- **ExtendScript is ES3.** No `let`/`const`/arrow/`JSON`/`forEach`/
  `toLocaleString`. A test enforces this.
- **After Effects discards unsaved projects on close.** Not a panel bug and not
  recoverable. Save the `.aep` before building.
- **`saveFrameToPng` returns before the bytes are flushed.** Re-stat in a loop.

---

## Running things

```bash
node --test tests/caption-model.test.js tests/jsx-expressions.test.js tests/recipes.test.js tests/recipes-doc.test.js tests/shotlist-model.test.js tests/visuals-jsx.test.js tests/visuals-keyframes.test.js tests/visuals-project-state.test.js tests/visuals-view.test.js
```

```bash
python -m pytest tests -q
```

```bash
node scripts/gen-recipe-docs.js
```

**Current: 205 JS, 107 python.** `node --test tests/` does not work — pass files.

### Driving AE from an agent

Start the backend with `EditFlow-AE.bat` (it sets `EDITFLOW_AGENT_BRIDGE=1`).
Then `POST /api/ae-bridge/eval` with `{fn, args}` calls any `ef_vis_*` function
in the open project. `GET /api/ae-bridge/health` should return
`{backend, panel, ae: true}`.

Hot-reload the jsx without touching AE:
`{"fn": "$.evalFile", "args": ["<abs path>/visuals.jsx"]}`.

The panel's own JS needs a panel reload; the jsx does not.

### Seeing it work

Open AE → Window → Extensions → EditFlow AI → **Visuals** (tab 6) →
📂 Load Shotlist → `samples/demo-brief.json` → Build All → Build Master.
