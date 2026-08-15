# Visual Shots — building Content Factory shots in After Effects

Turns a `shotlist.json` from the Documentary Studio app into native After
Effects comps: one comp per shot, every build kept as a version, and a
master comp that lays them end to end.

**Status:** verified in After Effects 25.6 on 2026-08-15 with the
"38,000 Salary in 2026" script — 7 shots built, counters landing exactly on
`Rs 8,484` / `Rs 282` / `2,350`, master comp 30.8s.

## What it builds

| Archetype | What you get |
|---|---|
| `STAT_COUNTER` | A number counting from 0 to the target with thousands separators, a label above, a lighter unit below, optional single pulse |
| `BAR_CHART` | Axis draws first, bars rise from the baseline with restrained overshoot, values count up, labels arrive after the data, one accent bar |
| `SECTION_TITLE_CARD` | Headline animating letter by letter (four approved variants), one optional supporting line |

Everything else — b-roll, emotional beats, photoreal — stays with your
generative tools. Those shots are listed as **skipped** with a reason, never
silently dropped.

## Using it

1. Open the panel in After Effects → **Visuals** tab (tab 6).
2. **📂 Load Shotlist** (or 📋 Paste) — the JSON your web agent produced.
3. Set the **Assets Folder** if your shots reference images (`bgSrc`).
   A missing image still builds, with a loud magenta placeholder.
4. **🚀 Build All**, or **Build** on a single row.
5. Pick the version you want per shot with the dropdown; ★ marks the one the
   master will use; 🗑 deletes a version you don't want.
6. **🎞 Build Master** — every active version, end to end, ready to render.
7. **🗑 Clear All** wipes every generated shot and starts over.

## Closing After Effects

Nothing is lost, provided the project is **saved**.

- **What you built** lives in the project, as comps under `EF Visuals/`. The
  panel keeps no authority over it — every time you open the Visuals tab it
  re-reads the project and shows what is actually there. Building a comp by
  hand, or switching projects, shows up without pressing anything.
- **The shotlist** has no home inside an `.aep`, so it is written next to it:
  `MyDoc.aep` → `MyDoc.editflow-visuals.json`. It travels with the project
  and opens in any text editor.

**An unsaved project is the one case where work really does disappear** —
After Effects itself discards untitled projects on close, and no panel can
recover them. The tab says so in a yellow banner until you `File → Save`.

If the shotlist is ever missing, comps still show as **IN PROJECT** rows so
you can open or delete them. A lost shotlist never reads as lost work.

## Versions

Building never overwrites. A rebuild — or a different agent's attempt at the
same shot — becomes `shot_01 v2`, `v3`, and so on inside `EF Visuals/shot_01/`.
That's also how you compare approaches: build the same shot two ways, flip
the dropdown, keep the winner, delete the rest.

The 🗑 button deletes **the version selected in the dropdown**. Deleting the
active one promotes another, so a shot can never end up with no active
version and silently vanish from the master.

## Project layout

```
EF Visuals/
  shot_01/
    ★ shot_01 v1        ← the star marks the active version
    shot_01 v2
  shot_02/
  EF Visuals Master     ← nested comps, so editing a shot updates the master
EF Assets/              ← images imported once and reused
```

## Getting a shotlist

Give your web agent the two files in
`content-prompts/prompts/visual-v8-ae/v8/`:

- `agent_ae_shotlist.md` — the props contract and rules
- `AE_ENVIRONMENT.md` — only needed if the agent will write ExtendScript

The v7 folder is untouched and still owns the generative lane.

## The master

`🎞 Build Master` lays every shot's active version end to end. A shot you
haven't built yet **keeps its slot** rather than closing the gap — the
timeline stays aligned to the narration and the hole is visible, instead of
every later shot silently sliding earlier. The button tells you how many are
missing before you press it.

## Known limits (v1)

- **Duration comes from the shotlist, not your voiceover.** If a narration
  line runs long, the shot doesn't stretch to match. Voiceover sync is the
  next feature; the seam is there (`duration` is a per-shot field the master
  honours, and this repo already produces word-level timestamps).
- **`talkingHead` shows a 🗣 badge but doesn't change framing** — guessing at
  composition over your face would be wrong more often than right.
- Fonts follow the panel's caption font unless a shot sets `props.font`.
