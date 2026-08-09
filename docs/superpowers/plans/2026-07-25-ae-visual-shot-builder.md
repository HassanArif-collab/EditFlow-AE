# AE Visual Shot Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Every AE-facing task ends with bridge evidence (CLAUDE.md Rule 10): an `ef_vis_dumpShot` assertion plus a rendered frame from `/api/ae-bridge/frame`. Nothing is reported as working on the strength of code review alone.

**Goal:** Turn a `shotlist.json` from the Content Factory into finished After Effects comps — one comp per shot — for the three archetypes that carry most of a documentary (`STAT_COUNTER`, `BAR_CHART`, `SECTION_TITLE_CARD`), **and let three different builders compete at it so you can measure which one you actually want.**

**Architecture:** One shared substrate — a strict spec model, a set of AE primitives, and a verification harness — with **three interchangeable lanes** feeding it:

- **Lane C — Deterministic compiler (the control).** Pure code turns a shot into a build spec. No AI. This is the baseline every other lane has to beat.
- **Lane B — Local agent.** The Ollama model inside the panel translates a shot spec into calls to the AE primitives. Small model, constrained vocabulary, runs offline.
- **Lane A — Web agent.** A cloud model (the one already wired into your Documentary Studio app) writes actual ExtendScript builder code, pushes it to a branch in this repo, and the panel loads and runs it behind a review gate.
- **Lane D — Hybrid: think → build → verify.** The agent makes the *creative* decisions (which title variant, which bar carries the accent, does this stat deserve a pulse) and emits a **spec patch, never code**; Lane C's compiler builds it; then the agent is shown `ef_vis_dumpShot` plus rendered frames and either signs off or issues one corrected patch. The model never computes a coordinate, and never sees a pixel it didn't get a chance to check.

All four take the **same** `shotlist.json` and produce comps in the **same** AE project, then get scored by the **same** harness — build success, spec fidelity, archetype-rule compliance, and rendered frames you eyeball side by side.

**Tech Stack:** CEP panel (vanilla ES modules), ExtendScript ES3, node:test, the existing agent bridge for verification, Ollama via the backend's provider layer, and the Documentary Studio app's tunnel API for Lane A.

---

## Hard constraints (from you, 2026-07-25)

1. **Additive only.** The captions engine is untouched. New ExtendScript lives in its own file (`visuals.jsx`); `index.jsx` gets **zero** edits. `main.js` gets exactly **3 added lines**, nothing removed or rewritten.
2. **New branch** in EditFlow-AE: `feat/ae-visual-builder`.
3. **Never edit the v7 prompts.** If the Content Factory needs an AE lane, we **copy** `prompts/visual-v7-glm/` to `prompts/visual-v8-ae/` and edit the copy (Task 5.2).
4. **Scope is the top 3 archetypes.** No LINE_GRAPH, PIE_CHART, FLOW_DIAGRAM in v1.
5. **Output is comps in one AE project**, not rendered files.

## Verified inputs (read from your repo, not invented)

`shotlist.json` shape, from `prompts/visual-v7-glm/v7/agent_visual_planner.md`:

```json
{
  "shots": [{
    "id": "shot_01",
    "scriptLine": "Narration text for this line",
    "archetype": "STAT_COUNTER",
    "tool": "remotion_component",
    "camera": "static",
    "durationInFrames": 150,
    "props": { "title": "Lost Revenue", "value": 1500000000,
               "prefix": "PKR ", "unit": "per year",
               "bgSrc": "port.jpg", "accentColor": "#b8860b" },
    "talkingHead": false,
    "assetNeeded": "port.jpg",
    "qaRisk": "Missing count-up animation"
  }],
  "metadata": { "totalShots": 24, "budgetOk": true }
}
```

`tool` says `remotion_component`; we accept that value and build in AE anyway — the field describes the *planner's* intent and we must not require prompt changes (constraint 3).

**Archetype rules** (`v7/visual_archetypes.md`) that the builders must satisfy:

| Archetype | Rules the code must honour |
|---|---|
| `SECTION_TITLE_CARD` | headline split into **letters**, **staggered** (never a whole-block fade); one title + at most one supporting line; rotate signature variants: slide up / scale from centre / slide from left / fade with rotation settle |
| `STAT_COUNTER` | number counts **from 0** (or previous value); label enters **before or with** the number; unit/citation lighter than the hero number; optional single restrained pulse after the count |
| `BAR_CHART` | axes first; bars rise from baseline with **restrained overshoot**; values count up; labels arrive **after** the data is readable; the script's bar gets the accent |

**Canonical motion limits** (same file) — these become tested constants, not suggestions:

| Parameter | Safe range |
|---|---|
| Letter stagger | 0.03–0.10 s |
| Stat count-up | 2.5–4.0 s |
| Highlight sweep | 1.8–2.2 s |
| Grain opacity | 0.03–0.07 |

## The bake-off: what "better" means

A comparison without a scorecard is just vibes, and vibes can't tell you whether an agent beat plain code. Every lane is scored on the same five things, four of them automatic:

| Measure | How it's checked | Why it matters |
|---|---|---|
| **Built at all** | `ef_vis_buildShot` returned a comp, no `ERROR:` | A lane that errors on 1 shot in 5 is unusable regardless of how pretty the other 4 are |
| **Spec fidelity** | `ef_vis_dumpShot` vs the spec: final number, bar count, letter count, comp duration | Catches "looks fine, wrong data" — the failure mode that ruins a documentary |
| **Rule compliance** | Automated frame checks: title-card letters partially in at t=0.3s (stagger, not block fade); bar chart shows axis before bars; counter reads 0 at t=0 | These are *your* archetype rules from v7, enforced rather than hoped for |
| **Looks right** | 3 rendered frames per shot per lane, shown side by side | The part only you can judge |
| **Cost + time** | Seconds to build, tokens/credits spent | A lane that's 2% better and 40× slower is not better |

Two extra columns exist only for the agent lanes: **first-try rate** (built correctly with no correction round — the honest measure of whether the environment brief is working) and **rounds used** (Lane D's think→verify loop, capped at 2).

**The control group is the point.** If Lane C (no AI at all) ties the agent lanes, that's the answer — use the compiler and stop paying for tokens. I expect Lane C to win on these three archetypes precisely *because* they're deterministic, and to lose the moment you add an archetype nobody wrote a builder for. That's the real question the bake-off answers: **where does the agent start earning its keep?**

**And Lane D is the likely overall winner**, because it doesn't ask the model to do the thing models are bad at. Lane C can't decide that *this* bar deserves the accent or that *this* stat wants a pulse; Lane A can decide it but might also invent a matchname; Lane D lets the model decide and the compiler build. Structurally it should score Lane C's fidelity with better creative choices — and the scorecard will say whether that's true or whether I'm flattering my own design.

## Stopping the web agent from hallucinating

The web agent is the one that can't grep our repo — it only knows what we hand it. So we hand it a lot, and four different kinds of "a lot", because they fail differently:

**1. The environment brief** (`docs/ae-agent-brief/`, generated — Task 5.0). Committed into the `visual-v8-ae` prompt copy so the app serves it at `/api/prompts/visual-v8-ae/<file>`, which is how your agents already read instructions.

| File | Contents |
|---|---|
| `ENVIRONMENT.md` | AE version actually installed, ExtendScript is **ES3** (no `let`/`const`/arrow/`toLocaleString`/`JSON`), no debugger, single-threaded, expressions run on a separate legacy engine |
| `MATCHNAMES.md` | Only the matchnames this repo has **actually run in AE** — `ADBE Text Animators`, `ADBE Text Expressible Selector`, `ADBE Text Range Type2`, `ADBE Vector Shape - Rect`, … each with the line of working code that uses it |
| `PRIMITIVES.md` | The `ef_vis_*` API surface it may call, with signatures and the arg ranges the compiler will clamp anyway |
| `KNOWN_FAILURES.md` | Our scar tissue: markers are 1-indexed; `textIndex` starts at 1; `toLocaleString` doesn't exist so thousands separators are hand-rolled; `inPoint` must be set before `outPoint`; `sourceRectAtTime` needs a time *after* the layer starts; a naive `"ppro"` substring matches `stopPropagation` |
| `WORKING_EXAMPLES.jsx` | Real, AE-proven excerpts from the captions engine — a text animator with an expression selector, a shape layer with a scale expression, a marker loop |

Generated from the code that already works, not hand-written, so it can't drift from reality (Task 5.0 Step 2 regenerates it).

**2. A live probe, not a stale doc** (`ef_vis_probeEnvironment`, Task 5.0). Returns the actual AE version, whether `canAddProperty("ADBE Text Expressible Selector")` is true on *this* install, the installed font list, and the comp settings. The brief carries a `PROBE` block filled from a real run, so the agent is told what this machine can do rather than what Adobe documents.

**3. The official Adobe docs, served on demand** (Task 5.0b). The mirror is 1.9 MB across 110 files — roughly 500K tokens, so pasting it is impossible and pasting *part* of it every call is wasteful. Instead we copy the ~14 files an AE builder actually needs (**173 KB total**) into `visual-v8-ae/reference/`, where your app already serves them at `/api/prompts/visual-v8-ae/reference/<file>`. The agent reads a one-page `INDEX.md` routing table and fetches only the page it needs, only when it needs it:

| Agent needs to… | Fetches |
|---|---|
| style text (font, size, fill, justification) | `textdocument.md` |
| find a match name for an animator/selector | `matchnames-textlayer.md` |
| build shape layers (rects, fills, strokes) | `matchnames-shapelayer.md` |
| create/size a comp, add layers | `compitem.md` |
| set a value, add a property, attach an expression | `property.md`, `propertygroup.md` |
| write an expression (time, linear, ease, textIndex) | `expression-language.md` |

**Precedence rule, stated in the brief:** when the Adobe docs and our brief disagree, **the brief wins** — Adobe documents the API in general, the brief documents what actually ran on this machine. `docs/adobe/` remains the local source of truth for *us*: any API claim in the agent's pushed code can be checked against it before the code is allowed to run.

**4. The error round-trip.** When gated code fails in AE, the exact `ERROR:` string, the failing function, and a rendered frame go **back to the agent** with the brief attached, and it gets one correction attempt (Task 5.4). Most model errors in ES3 are single-token — `const` instead of `var` — and are fixed instantly once the model sees the actual message instead of guessing.

That is the same anti-hallucination recipe as the captions engine: *retrieval, verified examples, a live capability probe, and a loop that shows the model its own failures.*

## Merging the two systems

Two codebases have to meet without either owning the other:

```
Documentary Studio app                     EditFlow-AE
(Next.js, port 3000, tunnel)               (FastAPI 8765 + AE panel)
  projects / scripts / research              spec model + AE primitives
  visual plans  ── shotsJson ──────────────► panel loads shotlist
                ── aeCode (Lane A) ────────► panel loads generated builder
                ◄── results.json ──────────  scorecard back to the plan
```

**The contract is one file: `shotlist.json`.** Everything else is optional convenience.

- **Transport, v1: a file.** You export the shotlist from the app, load it in the panel. Zero coupling, works with the tunnel down, and it's how you'll debug when something's wrong.
- **Transport, v2: the tunnel.** The panel can pull `GET <tunnel>/api/projects/<id>/visual-plans` directly (Task 7.1). Same parser either way.
- **Lane A's code path.** Your visual-plan record already has a `remotionCode` field — proof this pattern works. We do **not** add a DB column: Lane A pushes its generated builder to a **git branch** in EditFlow-AE (`agent/lane-a/<plan-id>`), which means it's reviewable, diffable, and revertible before a single line runs in your AE.
- **Results flow back** as `results.json` (the scorecard), which you can attach to the plan or just read in the panel.

**Prompt rule, unchanged:** the v7 folder is never edited. Lane A's instructions live in the `visual-v8-ae` copy (Task 5.2).

## Safety: Lane A executes AI-written code

Lane A means running ExtendScript that a cloud model wrote, inside After Effects, on a machine with your projects open. That deserves real guard rails, not optimism:

1. **Arrives by git, never by HTTP.** No endpoint accepts code. You `git pull` a branch and can read the diff first.
2. **Static gate before it runs** (Task 4.3): the file must define only `ef_lane_a_*` functions, and must not contain `app.project.close`, `.remove()` outside its own comp, `File(`, `Folder(`, `system.callSystem`, `$.evalFile`, or `app.executeCommand`. Fails the gate → never loaded.
3. **Sandbox project.** Bake-off runs happen in a dedicated AE project (`EditFlow Bakeoff.aep`), never your working file.
4. **Explicit human load.** The panel shows the diff summary and requires a click. Nothing auto-runs on `git pull`.

## Design decisions

- **The LLM does not do maths.** Bar heights, letter stagger and count-up curves are arithmetic; an LLM would make them non-deterministic and unverifiable. The compiler is pure JS. The LLM (Task 4.1) only fills *missing* props on a malformed shot and picks a signature variant — behind an explicit button, off by default.
- **Separate namespace `ef_vis_*`.** No collision with the caption engine's `ef_*`, and a grep instantly shows which system owns a function.
- **Separate jsx file loaded alongside index.jsx.** Honours constraint 1 literally.
- **One comp per shot, named `<id>_<ARCHETYPE>`**, all inside an AE folder named after the project. You arrange them yourself; nothing auto-renders.

## File map

| File | Responsibility |
|---|---|
| `cep-panel-ae/client/src/shotlist-model.js` | NEW. Pure: `parseShotlist`, `normalizeShot`, `MOTION_LIMITS`, `clampMotion`, `SUPPORTED_ARCHETYPES`. No DOM, no AE. |
| `cep-panel-ae/client/src/visuals-view.js` | NEW. The Visuals tab: load shotlist, list shots, Build All / Build One, status. |
| `cep-panel-ae/extendscript/visuals.jsx` | NEW. `ef_vis_*` builders. `index.jsx` untouched. |
| `cep-panel-ae/client/src/main.js` | +3 lines (import, button, click handler). |
| `tests/shotlist-model.test.js` | NEW. Parsing, normalisation, motion clamps. |
| `tests/visuals-jsx.test.js` | NEW. vm-eval of visuals.jsx + generated expressions. |
| `tests/fixtures/shotlist-sample.json` | NEW. A 3-shot fixture, one per archetype. |
| `docs/ae-visual-shots.md` | NEW. How to use it + in-AE checklist. |
| `prompts/visual-v8-ae/` (Content Factory repo) | NEW COPY, only if prompts need changes (Task 5.2). |
| `cep-panel-ae/client/src/lane-local.js` | NEW. Lane B: prompt + parse + validate for the local Ollama translator. |
| `cep-panel-ae/client/src/lane-web.js` | NEW. Lane A: load a pushed builder, run the static gate, hand it to AE. |
| `cep-panel-ae/client/src/bakeoff.js` | NEW. Runs all lanes over one shotlist, collects the scorecard. |
| `cep-panel-ae/extendscript/lane_a_loader.jsx` | NEW. Loads a gated Lane-A builder file inside AE and calls it. |
| `backend/routes/chat.py` | RESTORED from the EditFlowAI repo (Task 4.1) — Lane B needs a completion endpoint. |
| `tests/lane-local.test.js`, `tests/lane-web-gate.test.js`, `tests/bakeoff.test.js` | NEW. Prompt/parse, the static gate, and scoring — all pure, node-tested. |
| `docs/ae-visual-bakeoff.md` | NEW. How to run the comparison and read the scorecard. |

---

## Phase 1 — The shot compiler (pure, TDD)

### Task 1.1: Motion limits + archetype whitelist

**Files:** Create `cep-panel-ae/client/src/shotlist-model.js`, `tests/shotlist-model.test.js`.

- [ ] **Step 1: Write the failing test**

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { loadEsm } = require('./_load-esm');

const M = loadEsm(path.resolve(__dirname, '..', 'cep-panel-ae', 'client', 'src', 'shotlist-model.js'));

test('motion limits match the v7 archetype spec exactly', () => {
  // These numbers are the contract with the Content Factory's
  // "Canonical Motion Limits" table. If someone widens them, the look
  // drifts from the rest of the film — that is what this test protects.
  assert.deepEqual(M.MOTION_LIMITS.letterStagger, { min: 0.03, max: 0.10 });
  assert.deepEqual(M.MOTION_LIMITS.statCountUp, { min: 2.5, max: 4.0 });
  assert.deepEqual(M.MOTION_LIMITS.highlightSweep, { min: 1.8, max: 2.2 });
});

test('clampMotion pulls out-of-range values back inside the safe band', () => {
  assert.equal(M.clampMotion('letterStagger', 0.5), 0.10);
  assert.equal(M.clampMotion('letterStagger', 0.001), 0.03);
  assert.equal(M.clampMotion('statCountUp', 3.0), 3.0);
});

test('only the three v1 archetypes are supported', () => {
  assert.deepEqual([...M.SUPPORTED_ARCHETYPES].sort(),
    ['BAR_CHART', 'SECTION_TITLE_CARD', 'STAT_COUNTER']);
});
```

- [ ] **Step 2: Run it** — `node --test tests/shotlist-model.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement**

```js
/**
 * shotlist-model.js — turns a Content Factory shotlist.json into strict
 * build specs for the AE visual builders.
 *
 * Pure: no DOM, no AE, no network. The geometry and timing live here (and
 * in the jsx) precisely so an LLM never has to compute them.
 */

/* From v7/visual_archetypes.md → "Canonical Motion Limits". Widening these
   makes shots drift from the rest of the film. */
export const MOTION_LIMITS = {
  letterStagger: { min: 0.03, max: 0.10 },
  statCountUp: { min: 2.5, max: 4.0 },
  highlightSweep: { min: 1.8, max: 2.2 },
  grainOpacity: { min: 0.03, max: 0.07 },
};

export const SUPPORTED_ARCHETYPES = new Set([
  'STAT_COUNTER', 'BAR_CHART', 'SECTION_TITLE_CARD',
]);

export function clampMotion(key, value) {
  const lim = MOTION_LIMITS[key];
  if (!lim) return value;
  const n = Number(value);
  if (!isFinite(n)) return lim.min;
  return Math.min(lim.max, Math.max(lim.min, n));
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(visuals): motion limits + archetype whitelist`.

### Task 1.2: Parse and normalise a shotlist

**Files:** Modify `shotlist-model.js`; create `tests/fixtures/shotlist-sample.json`.

- [ ] **Step 1: Create the fixture** — `tests/fixtures/shotlist-sample.json`:

```json
{
  "shots": [
    { "id": "shot_01", "scriptLine": "Pakistan loses billions every year.",
      "archetype": "STAT_COUNTER", "tool": "remotion_component", "camera": "static",
      "durationInFrames": 150,
      "props": { "title": "Lost Revenue", "value": 1500000000, "prefix": "PKR ",
                 "unit": "per year", "accentColor": "#b8860b" } },
    { "id": "shot_02", "scriptLine": "Three ports, three very different stories.",
      "archetype": "BAR_CHART", "tool": "remotion_component", "camera": "static",
      "durationInFrames": 210,
      "props": { "title": "Annual throughput",
                 "bars": [ { "label": "Karachi", "value": 42 },
                           { "label": "Gwadar", "value": 8 },
                           { "label": "Qasim", "value": 31 } ],
                 "accentIndex": 1, "unit": "M tonnes", "accentColor": "#b8860b" } },
    { "id": "shot_03", "scriptLine": "Act two: the money trail.",
      "archetype": "SECTION_TITLE_CARD", "tool": "remotion_component", "camera": "static",
      "durationInFrames": 90,
      "props": { "title": "THE MONEY TRAIL", "supporting": "Act II",
                 "variant": "slide_up", "accentColor": "#b8860b" } }
  ],
  "metadata": { "totalShots": 3, "budgetOk": true }
}
```

- [ ] **Step 2: Write the failing tests**

```js
const fs = require('node:fs');
const SAMPLE = () => JSON.parse(fs.readFileSync(
  path.resolve(__dirname, 'fixtures', 'shotlist-sample.json'), 'utf8'));

test('parseShotlist accepts the Content Factory shape and keeps shot order', () => {
  const { shots, errors } = M.parseShotlist(SAMPLE());
  assert.equal(errors.length, 0);
  assert.deepEqual(shots.map((s) => s.id), ['shot_01', 'shot_02', 'shot_03']);
});

test('durationInFrames becomes seconds using the given fps', () => {
  const { shots } = M.parseShotlist(SAMPLE(), { fps: 30 });
  assert.equal(shots[0].duration, 5);      // 150 / 30
  assert.equal(shots[2].duration, 3);      // 90 / 30
});

test('unsupported archetypes are reported, not silently dropped', () => {
  const raw = SAMPLE();
  raw.shots.push({ id: 'shot_04', archetype: 'BROLL_VIDEO', durationInFrames: 120, props: {} });
  const { shots, errors } = M.parseShotlist(raw);
  assert.equal(shots.length, 3, 'unsupported shot is not built');
  assert.match(errors[0], /shot_04.*BROLL_VIDEO/);
});

test('a stat counter normalises to the fields the jsx needs', () => {
  const spec = M.normalizeShot(SAMPLE().shots[0], { fps: 30 });
  assert.equal(spec.archetype, 'STAT_COUNTER');
  assert.equal(spec.value, 1500000000);
  assert.equal(spec.prefix, 'PKR ');
  assert.deepEqual(spec.accent, [0.722, 0.525, 0.043].map((n) => Math.round(n * 1000) / 1000));
  assert.ok(spec.countDur >= 2.5 && spec.countDur <= 4.0, 'count-up inside the safe band');
});

test('a bar chart normalises bars and marks the accent bar', () => {
  const spec = M.normalizeShot(SAMPLE().shots[1], { fps: 30 });
  assert.equal(spec.bars.length, 3);
  assert.equal(spec.bars[1].accent, true, 'accentIndex 1 = Gwadar');
  assert.equal(spec.maxValue, 42, 'bars scale against the largest value');
});

test('a title card splits the headline into letters and staggers inside limits', () => {
  const spec = M.normalizeShot(SAMPLE().shots[2], { fps: 30 });
  assert.equal(spec.title, 'THE MONEY TRAIL');
  assert.ok(spec.stagger >= 0.03 && spec.stagger <= 0.10);
  assert.equal(spec.variant, 'slide_up');
});

test('missing props are reported per shot instead of throwing', () => {
  const { shots, errors } = M.parseShotlist({ shots: [
    { id: 'bad_01', archetype: 'STAT_COUNTER', durationInFrames: 90, props: {} },
  ] });
  assert.equal(shots.length, 0);
  assert.match(errors[0], /bad_01.*value/i);
});
```

- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** in `shotlist-model.js`:

```js
const DEFAULT_ACCENT = '#b8860b';

/** "#b8860b" → AE's [r,g,b] 0..1, rounded to 3dp so tests are stable. */
export function hexToRgb(hex) {
  const h = String(hex || DEFAULT_ACCENT).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const to3 = (v) => Math.round((v / 255) * 1000) / 1000;
  return [to3((n >> 16) & 255), to3((n >> 8) & 255), to3(n & 255)];
}

/** Longer count-ups for bigger numbers, always inside the safe band. */
function countDurationFor(value) {
  const digits = String(Math.abs(Math.round(Number(value) || 0))).length;
  return clampMotion('statCountUp', 2.0 + digits * 0.25);
}

/** One shot → a strict build spec, or throws with a readable reason. */
export function normalizeShot(shot, opts = {}) {
  const fps = opts.fps || 30;
  const id = shot.id || 'shot';
  const archetype = shot.archetype;
  if (!SUPPORTED_ARCHETYPES.has(archetype)) {
    throw new Error(`${id}: archetype ${archetype} is not supported in v1`);
  }
  const p = shot.props || {};
  const base = {
    id,
    archetype,
    duration: (Number(shot.durationInFrames) || 90) / fps,
    scriptLine: shot.scriptLine || '',
    accent: hexToRgb(p.accentColor),
    title: p.title || '',
  };

  if (archetype === 'STAT_COUNTER') {
    if (p.value == null || isNaN(Number(p.value))) {
      throw new Error(`${id}: STAT_COUNTER needs a numeric props.value`);
    }
    return { ...base, value: Number(p.value), from: Number(p.from) || 0,
             prefix: p.prefix || '', unit: p.unit || '',
             countDur: countDurationFor(p.value),
             pulse: !!p.pulse };
  }

  if (archetype === 'BAR_CHART') {
    const bars = Array.isArray(p.bars) ? p.bars : [];
    if (bars.length < 2) throw new Error(`${id}: BAR_CHART needs at least 2 props.bars`);
    const values = bars.map((b) => Number(b.value) || 0);
    const maxValue = Math.max(...values);
    if (maxValue <= 0) throw new Error(`${id}: BAR_CHART bars have no positive value`);
    return { ...base, unit: p.unit || '', maxValue,
             bars: bars.map((b, i) => ({
               label: String(b.label || ''), value: Number(b.value) || 0,
               accent: i === Number(p.accentIndex),
             })) };
  }

  // SECTION_TITLE_CARD
  if (!base.title) throw new Error(`${id}: SECTION_TITLE_CARD needs props.title`);
  const VARIANTS = ['slide_up', 'scale_center', 'slide_left', 'rotate_settle'];
  return { ...base,
           supporting: p.supporting || '',
           variant: VARIANTS.includes(p.variant) ? p.variant : 'slide_up',
           stagger: clampMotion('letterStagger', Number(p.stagger) || 0.05) };
}

/** Whole shotlist → { shots: spec[], errors: string[] }. Never throws:
    one bad shot must not stop the other 23 from building. */
export function parseShotlist(raw, opts = {}) {
  const out = { shots: [], errors: [] };
  const list = (raw && raw.shots) || [];
  if (!Array.isArray(list) || list.length === 0) {
    out.errors.push('shotlist has no "shots" array');
    return out;
  }
  for (const shot of list) {
    try {
      out.shots.push(normalizeShot(shot, opts));
    } catch (e) {
      out.errors.push(String(e.message || e));
    }
  }
  return out;
}
```

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `feat(visuals): shotlist parser + per-archetype normalisation`.

## Phase 2 — The AE builders

### Task 2.1: visuals.jsx skeleton + project/comp management

**Files:** Create `cep-panel-ae/extendscript/visuals.jsx`, `tests/visuals-jsx.test.js`.

- [ ] **Step 1: Write the loader test first** (this is also the ES3 syntax gate):

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const JSX = path.resolve(__dirname, '..', 'cep-panel-ae', 'extendscript', 'visuals.jsx');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(JSX, 'utf8'), sandbox, { filename: 'visuals.jsx' });

test('visuals.jsx parses and exposes its builders', () => {
  for (const fn of ['ef_vis_buildShot', 'ef_vis_statCounter', 'ef_vis_barChart',
                    'ef_vis_titleCard', 'ef_vis_ensureFolder', 'ef_vis_dumpShot',
                    'ef_vis_countExpr', 'ef_vis_barGrowExpr']) {
    assert.equal(typeof sandbox[fn], 'function', fn);
  }
});

test('visuals.jsx does not redefine any caption engine function', () => {
  const src = fs.readFileSync(JSX, 'utf8');
  // Caption functions are ef_<name>; ours must all be ef_vis_<name>.
  const defined = [...src.matchAll(/^function\s+(ef_[A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const clashes = defined.filter((n) => !n.startsWith('ef_vis_'));
  assert.deepEqual(clashes, [], 'visuals.jsx must only define ef_vis_* functions');
});
```

- [ ] **Step 2: Run** → FAIL (file missing).

- [ ] **Step 3: Implement the skeleton**

```js
/**********************************************************************
 * visuals.jsx — Content Factory shot builder for After Effects.
 *
 * Builds ONE comp per shot from a normalised spec (see
 * client/src/shotlist-model.js). Loaded ALONGSIDE index.jsx; it never
 * touches the caption engine. Every function here is ef_vis_* so the two
 * systems can never collide.
 *
 * ES3 only — AE's ExtendScript has no let/const/arrow functions.
 *********************************************************************/

var EF_VIS_TAG = "EF_VISUAL";

function ef_vis_err(msg) { return "ERROR:" + String(msg); }

/* Reuse the project folder so re-running doesn't scatter comps. */
function ef_vis_ensureFolder(name) {
    var folderName = name || "EditFlow Shots";
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && it.name === folderName) return it;
    }
    return app.project.items.addFolder(folderName);
}

/* Machine-readable dump of one shot comp — the agent's proof it built
   what the spec asked for (mirrors ef_dumpLayers on the captions side). */
function ef_vis_dumpShot(compName) {
    try {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (!(it instanceof CompItem) || it.name !== compName) continue;
            var layers = [];
            for (var L = 1; L <= it.numLayers; L++) {
                var lay = it.layer(L);
                var d = { name: String(lay.name), inPoint: lay.inPoint, outPoint: lay.outPoint };
                try { d.text = String(lay.property("Source Text").value.text); } catch (e1) {}
                try { d.position = lay.property("Position").value; } catch (e2) {}
                try { d.scale = lay.property("Scale").value; } catch (e3) {}
                layers.push(d);
            }
            return ef_json({ comp: it.name, width: it.width, height: it.height,
                             duration: it.duration, frameRate: it.frameRate,
                             numLayers: it.numLayers, layers: layers });
        }
        return ef_vis_err("comp not found: " + compName);
    } catch (e) { return ef_vis_err("dumpShot: " + e.toString()); }
}
```

  (`ef_json` comes from index.jsx, which is always loaded first — the panel loads both. The test sandbox stubs it; see Step 4.)

- [ ] **Step 4: Add the `ef_json` stub to the test sandbox** so visuals.jsx evaluates standalone:

```js
const sandbox = { ef_json: (v) => JSON.stringify(v) };
```

- [ ] **Step 5: Run** → the first test still fails (builders missing) — that is Task 2.2. Commit the skeleton: `feat(visuals): visuals.jsx skeleton + shot dump`.

### Task 2.2: STAT_COUNTER

**Files:** Modify `visuals.jsx`, `tests/visuals-jsx.test.js`.

- [ ] **Step 1: Write the failing expression tests**

```js
function evalExpr(expr, ctx) {
  return vm.runInNewContext(expr, Object.assign({ thisLayer: { inPoint: 0 } }, ctx));
}

test('count expression starts at the from-value and lands exactly on target', () => {
  const e = sandbox.ef_vis_countExpr(0, 1500000000, 3.0, 'PKR ', ' per year');
  assert.match(evalExpr(e, { time: -0.1 }), /PKR 0/);
  assert.match(evalExpr(e, { time: 3.5 }), /PKR 1,500,000,000 per year/);
});

test('count expression is monotonic and never NaN across the ramp', () => {
  const e = sandbox.ef_vis_countExpr(0, 500, 3.0, '', '');
  let prev = -1;
  for (let t = 0; t <= 3.2; t += 0.1) {
    const shown = Number(String(evalExpr(e, { time: t })).replace(/[^0-9]/g, ''));
    assert.ok(Number.isFinite(shown), `NaN at t=${t}`);
    assert.ok(shown >= prev, `went backwards at t=${t}`);
    prev = shown;
  }
});

test('count expression is ES3-safe', () => {
  const e = sandbox.ef_vis_countExpr(0, 42, 3, '', '');
  for (const tok of ['=>', 'let ', 'const ', '.map(', 'toLocaleString']) {
    assert.ok(!e.includes(tok), `contains ${tok}`);
  }
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/* Count-up sourceText expression. Thousands separators are hand-rolled:
   toLocaleString() is not available in AE's legacy expression engine. */
function ef_vis_countExpr(from, to, dur, prefix, suffix) {
    var f = Number(from) || 0, t = Number(to) || 0, d = Number(dur) || 3;
    var pre = String(prefix || "").replace(/"/g, '\\"');
    var suf = String(suffix || "").replace(/"/g, '\\"');
    return "var p=(time-thisLayer.inPoint)/" + d + ";" +
        "if(p<0)p=0;if(p>1)p=1;" +
        "var e=1-Math.pow(1-p,3);" +                       // ease-out cubic
        "var v=Math.round(" + f + "+(" + t + "-" + f + ")*e);" +
        "var s=''+Math.abs(v);var o='';var c=0;" +
        "for(var i=s.length-1;i>=0;i--){o=s.charAt(i)+o;c++;" +
        "if(c%3===0&&i>0){o=','+o;}}" +
        "(v<0?'-':'')+\"" + pre + "\"+o+\"" + suf + "\";";
}

/* STAT_COUNTER: label first, hero number counting from 0, lighter unit.
   Layout is fixed and centred — the spec asks for hierarchy, not novelty. */
function ef_vis_statCounter(comp, spec) {
    var cx = comp.width / 2, cy = comp.height / 2;
    var heroSize = Math.round(comp.height * 0.16);
    var labelSize = Math.round(heroSize * 0.28);

    // Label enters BEFORE the number (archetype rule).
    var label = comp.layers.addText(String(spec.title || ""));
    label.name = "Label";
    ef_vis_styleText(label, labelSize, [1, 1, 1]);
    ef_vis_center(label, cx, cy - heroSize * 0.75);
    label.property("Opacity").expression =
        "var p=(time-thisLayer.inPoint)/0.4;if(p<0)p=0;if(p>1)p=1;p*100;";

    // Hero number.
    var hero = comp.layers.addText("0");
    hero.name = "Value";
    ef_vis_styleText(hero, heroSize, spec.accent);
    ef_vis_center(hero, cx, cy);
    hero.property("Source Text").expression =
        ef_vis_countExpr(spec.from, spec.value, spec.countDur, spec.prefix, "");
    // Start the count after the label has landed.
    hero.startTime = 0.25;

    if (spec.unit) {
        var unit = comp.layers.addText(String(spec.unit));
        unit.name = "Unit";
        ef_vis_styleText(unit, Math.round(heroSize * 0.22), [0.75, 0.75, 0.75]);
        ef_vis_center(unit, cx, cy + heroSize * 0.62);
        unit.property("Opacity").expression =
            "var p=(time-thisLayer.inPoint-" + (spec.countDur * 0.5) + ")/0.4;" +
            "if(p<0)p=0;if(p>1)p=1;p*70;";
    }
    return true;
}
```

  Plus the two shared helpers (added once, used by all three builders):

```js
function ef_vis_styleText(layer, size, color) {
    var tp = layer.property("Source Text");
    var td = tp.value;
    td.resetCharStyle();
    td.fontSize = size;
    td.applyFill = true;
    td.fillColor = color;
    td.applyStroke = false;
    td.justification = ParagraphJustification.CENTER_JUSTIFY;
    tp.setValue(td);
}

function ef_vis_center(layer, x, y) {
    var r = layer.sourceRectAtTime(0, false);
    layer.property("Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
    layer.property("Position").setValue([x, y]);
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(visuals): STAT_COUNTER builder`.

### Task 2.3: BAR_CHART

**Files:** Modify `visuals.jsx`, `tests/visuals-jsx.test.js`.

- [ ] **Step 1: Write the failing tests**

```js
test('bar grow expression rises from 0, overshoots once, settles at 100', () => {
  const e = sandbox.ef_vis_barGrowExpr(0.3, 0.9);   // delay, growth time
  assert.equal(Number(evalExpr(e, { time: 0.2 })), 0, 'still flat before its delay');
  const mid = Number(evalExpr(e, { time: 0.3 + 0.55 }));
  assert.ok(mid > 100, `expected restrained overshoot, got ${mid}`);
  assert.ok(mid < 115, `overshoot must stay restrained, got ${mid}`);
  assert.ok(Math.abs(Number(evalExpr(e, { time: 3 })) - 100) < 0.5, 'settles at 100');
});

test('bars are staggered so they do not animate chaotically', () => {
  // archetype rule: "avoid all bars animating chaotically"
  const a = sandbox.ef_vis_barGrowExpr(0.0, 0.9);
  const b = sandbox.ef_vis_barGrowExpr(0.12, 0.9);
  assert.notEqual(a, b, 'each bar must carry its own delay');
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/* Bar height as a percentage 0..100+, with ONE restrained overshoot.
   Damped so the settle is quick — the archetype forbids bouncy charts. */
function ef_vis_barGrowExpr(delay, growth) {
    var d = Number(delay) || 0, g = Number(growth) || 0.9;
    return "var t=time-thisLayer.inPoint-" + d + ";" +
        "if(t<=0){0;}else{" +
        "var p=t/" + g + ";if(p>1)p=1;" +
        "var e=1-Math.pow(1-p,3);" +
        "var os=(p<1)?Math.sin(p*Math.PI)*8*(1-p):0;" +
        "e*100+os;}";
}

/* BAR_CHART: axis first, bars rise from the baseline, accent bar coloured,
   labels after the data is readable. */
function ef_vis_barChart(comp, spec) {
    var n = spec.bars.length;
    var plotW = comp.width * 0.72, plotH = comp.height * 0.5;
    var left = (comp.width - plotW) / 2, baseY = comp.height * 0.78;
    var slot = plotW / n, barW = slot * 0.55;

    if (spec.title) {
        var title = comp.layers.addText(String(spec.title));
        title.name = "Chart Title";
        ef_vis_styleText(title, Math.round(comp.height * 0.055), [1, 1, 1]);
        ef_vis_center(title, comp.width / 2, comp.height * 0.16);
    }

    // Axis first (archetype rule).
    var axis = comp.layers.addShape();
    axis.name = "Axis";
    var axisGrp = axis.property("ADBE Root Vectors Group")
        .addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    var axisRect = axisGrp.addProperty("ADBE Vector Shape - Rect");
    axisRect.property("ADBE Vector Rect Size").setValue([plotW, 3]);
    var axisFill = axisGrp.addProperty("ADBE Vector Graphic - Fill");
    axisFill.property("ADBE Vector Fill Color").setValue([0.45, 0.45, 0.45]);
    axis.property("Position").setValue([comp.width / 2, baseY]);
    axis.property("Scale").expression =
        "var p=(time-thisLayer.inPoint)/0.5;if(p<0)p=0;if(p>1)p=1;[p*100,100];";

    for (var i = 0; i < n; i++) {
        var bar = spec.bars[i];
        var h = (bar.value / spec.maxValue) * plotH;
        var cxi = left + slot * i + slot / 2;
        var delay = 0.45 + i * 0.12;   // staggered, never chaotic

        var shape = comp.layers.addShape();
        shape.name = "Bar " + (i + 1) + " " + bar.label;
        var grp = shape.property("ADBE Root Vectors Group")
            .addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var rect = grp.addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([barW, h]);
        // Anchor the rect at its own base so scaling grows upward.
        rect.property("ADBE Vector Rect Position").setValue([0, -h / 2]);
        var fill = grp.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color")
            .setValue(bar.accent ? spec.accent : [0.35, 0.38, 0.42]);
        shape.property("Position").setValue([cxi, baseY]);
        shape.property("Scale").expression =
            "var s=" + ef_vis_barGrowExpr(delay, 0.9).replace(/^var /, "var ") +
            "";   // placeholder replaced below
        // Scale Y only: [100, grow]
        shape.property("Scale").expression =
            "var g=(function(){" + ef_vis_barGrowExpr(delay, 0.9) + "})();[100,g];";

        // Value counts up, label arrives after the data is readable.
        var val = comp.layers.addText("0");
        val.name = "Value " + (i + 1);
        ef_vis_styleText(val, Math.round(comp.height * 0.045),
                         bar.accent ? spec.accent : [1, 1, 1]);
        ef_vis_center(val, cxi, baseY - h - comp.height * 0.045);
        val.property("Source Text").expression =
            ef_vis_countExpr(0, bar.value, 0.9, "", "");
        val.startTime = delay;

        var lbl = comp.layers.addText(String(bar.label));
        lbl.name = "Label " + (i + 1);
        ef_vis_styleText(lbl, Math.round(comp.height * 0.038), [0.8, 0.8, 0.8]);
        ef_vis_center(lbl, cxi, baseY + comp.height * 0.05);
        lbl.property("Opacity").expression =
            "var p=(time-thisLayer.inPoint-" + (delay + 0.9) + ")/0.35;" +
            "if(p<0)p=0;if(p>1)p=1;p*100;";
    }
    return true;
}
```

  **Note for the implementer:** the doubled `Scale.expression` assignment above is deliberate in the plan only to show the wrong form then the right one — write **only** the second (`var g=(function(){…})();[100,g];`). Delete the placeholder line.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(visuals): BAR_CHART builder`.

### Task 2.4: SECTION_TITLE_CARD

**Files:** Modify `visuals.jsx`, `tests/visuals-jsx.test.js`.

- [ ] **Step 1: Write the failing tests**

```js
test('title card staggers per LETTER and never fades as one block', () => {
  const e = sandbox.ef_vis_letterExpr(0.05, 0.5, 'slide_up');
  // letter 1 has entered while letter 8 has not — that is the stagger
  const first = Number(evalExpr(e, { time: 0.45, textIndex: 1, textTotal: 10 }));
  const later = Number(evalExpr(e, { time: 0.45, textIndex: 8, textTotal: 10 }));
  assert.ok(first < later, `letter 1 (${first}) must lead letter 8 (${later})`);
});

test('every approved variant produces a finite, ES3-safe expression', () => {
  for (const v of ['slide_up', 'scale_center', 'slide_left', 'rotate_settle']) {
    const e = sandbox.ef_vis_letterExpr(0.05, 0.5, v);
    for (const tok of ['=>', 'let ', 'const ']) assert.ok(!e.includes(tok), `${v}: ${tok}`);
    for (let t = 0; t < 2; t += 0.1) {
      assert.ok(Number.isFinite(Number(evalExpr(e, { time: t, textIndex: 3, textTotal: 10 }))));
    }
  }
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/* Per-LETTER selector amount: 100 = animator fully applied (letter hidden
   / offset), 0 = settled. Uses textIndex so each letter has its own delay —
   the archetype forbids fading the headline in as one block. */
function ef_vis_letterExpr(stagger, dur, variant) {
    var st = Number(stagger) || 0.05, d = Number(dur) || 0.5;
    return "var i=textIndex-1;if(i<0)i=0;" +
        "var t=time-thisLayer.inPoint-i*" + st + ";" +
        "var p=t/" + d + ";if(p<0)p=0;if(p>1)p=1;" +
        "var e=1-Math.pow(1-p,3);" +
        "(1-e)*100;";
}

/* SECTION_TITLE_CARD: one headline, staggered letters, at most one
   supporting line. Variant chooses WHICH property the animator drives. */
function ef_vis_titleCard(comp, spec) {
    var cx = comp.width / 2, cy = comp.height / 2;
    var size = Math.round(comp.height * 0.11);

    var title = comp.layers.addText(String(spec.title));
    title.name = "Title";
    ef_vis_styleText(title, size, [1, 1, 1]);
    ef_vis_center(title, cx, cy);

    var expr = ef_vis_letterExpr(spec.stagger, 0.5, spec.variant);
    var animators = title.property("ADBE Text Properties").property("ADBE Text Animators");

    // Opacity is common to every variant.
    var fade = animators.addProperty("ADBE Text Animator");
    fade.name = "Letter Fade";
    fade.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
    ef_vis_addLetterSelector(fade, expr);

    var motion = animators.addProperty("ADBE Text Animator");
    motion.name = "Letter Motion";
    var props = motion.property("ADBE Text Animator Properties");
    if (spec.variant === "scale_center") {
        props.addProperty("ADBE Text Scale 3D").setValue([60, 60]);
    } else if (spec.variant === "slide_left") {
        props.addProperty("ADBE Text Position 3D").setValue([-comp.width * 0.06, 0]);
    } else if (spec.variant === "rotate_settle") {
        props.addProperty("ADBE Text Rotation").setValue(8);
    } else {   // slide_up (default)
        props.addProperty("ADBE Text Position 3D").setValue([0, size * 0.6]);
    }
    ef_vis_addLetterSelector(motion, expr);

    if (spec.supporting) {
        var sub = comp.layers.addText(String(spec.supporting));
        sub.name = "Supporting";
        ef_vis_styleText(sub, Math.round(size * 0.3), spec.accent);
        ef_vis_center(sub, cx, cy + size * 0.9);
        sub.property("Opacity").expression =
            "var p=(time-thisLayer.inPoint-0.5)/0.4;if(p<0)p=0;if(p>1)p=1;p*100;";
    }
    return true;
}

/* Expression selector, Based On = Characters (enum 1). */
function ef_vis_addLetterSelector(animator, expr) {
    var sel = animator.property("ADBE Text Selectors")
        .addProperty("ADBE Text Expressible Selector");
    try { sel.property("ADBE Text Range Type2").setValue(1); } catch (e) {}
    sel.property("ADBE Text Expressible Amount").expression = expr;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(visuals): SECTION_TITLE_CARD builder`.

### Task 2.5: `ef_vis_buildShot` — one comp per shot

**Files:** Modify `visuals.jsx`.

- [ ] **Step 1: Implement the dispatcher**

```js
/* Build ONE shot as its own comp inside the project folder. Called once
   per shot by the panel so a single failure can't abort the batch. */
function ef_vis_buildShot(jsonStr) {
    var started = false;
    try {
        var cfg = eval("(" + jsonStr + ")");
        var spec = cfg.spec;
        if (!spec || !spec.id) return ef_vis_err("no spec supplied");

        var w = cfg.width || 1920, h = cfg.height || 1080, fps = cfg.fps || 30;
        var folder = ef_vis_ensureFolder(cfg.folder || "EditFlow Shots");
        var name = spec.id + "_" + spec.archetype;

        // Replace an existing comp of the same name so re-runs are idempotent.
        for (var i = app.project.numItems; i >= 1; i--) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) { it.remove(); }
        }

        app.beginUndoGroup("EditFlow: Build " + name);
        started = true;

        var comp = app.project.items.addComp(name, w, h, 1.0,
                                             Math.max(0.5, spec.duration), fps);
        comp.parentFolder = folder;
        comp.comment = EF_VIS_TAG;

        // Background so the shot reads on its own.
        var bg = comp.layers.addSolid([0.06, 0.07, 0.09], "BG", w, h, 1.0);
        bg.moveToEnd();

        if (spec.archetype === "STAT_COUNTER") ef_vis_statCounter(comp, spec);
        else if (spec.archetype === "BAR_CHART") ef_vis_barChart(comp, spec);
        else if (spec.archetype === "SECTION_TITLE_CARD") ef_vis_titleCard(comp, spec);
        else { app.endUndoGroup(); return ef_vis_err("unsupported archetype: " + spec.archetype); }

        app.endUndoGroup();
        return ef_json({ comp: name, layers: comp.numLayers, duration: comp.duration });
    } catch (e) {
        if (started) { try { app.endUndoGroup(); } catch (_) {} }
        return ef_vis_err("buildShot: " + e.toString() + (e.line ? " (line " + e.line + ")" : ""));
    }
}
```

- [ ] **Step 2: Run the full node suite** — `node --test tests/visuals-jsx.test.js tests/shotlist-model.test.js` → all PASS.
- [ ] **Step 3: Commit** `feat(visuals): buildShot dispatcher — one comp per shot`.

## Phase 3 — The panel tab

### Task 3.1: Visuals view

**Files:** Create `cep-panel-ae/client/src/visuals-view.js`.

- [ ] **Step 1: Implement** — a self-contained view with: a file picker + paste box for `shotlist.json`, a shot table (id, archetype, duration, status), **Build All** and per-row **Build**, and an errors panel fed by `parseShotlist().errors`. It calls:

```js
import { parseShotlist } from './shotlist-model.js';
import { callExtendScript } from './extendscript.js';

async function buildOne(spec, settings) {
  return callExtendScript('ef_vis_buildShot', JSON.stringify({
    spec, width: settings.width, height: settings.height,
    fps: settings.fps, folder: settings.folder,
  }));
}
```

  Build All loops shots sequentially (never in parallel — AE is single-threaded), updating each row's status to `building → built (N layers)` or the returned error, and never aborting the batch on one failure.

- [ ] **Step 2: Load `visuals.jsx` once, on first use** (index.jsx is already loaded by `initExtendScript`):

```js
/* Load the visual builders next to the caption engine. Separate file =
   the captions engine is never touched by this feature. */
let _visualsLoaded = false;
async function ensureVisualsJsx() {
  if (_visualsLoaded) return;
  const cs = new CSInterface();
  const key = (cs.SYSTEM_PATH && cs.SYSTEM_PATH.EXTENSION) || 'extension';
  const root = cs.getSystemPath(key) || cs.getSystemPath('extension');
  const p = (root + '/extendscript/visuals.jsx').replace(/\\/g, '/');
  await new Promise((resolve) => cs.evalScript('$.evalFile("' + p + '")', () => resolve()));
  _visualsLoaded = true;
}
```

- [ ] **Step 3: Commit** `feat(visuals): panel view for loading and building a shotlist`.

### Task 3.2: Wire it into the panel — exactly 3 added lines

**Files:** Modify `cep-panel-ae/client/src/main.js` (additive only).

- [ ] **Step 1: Add the import**

```js
import { openVisuals } from './visuals-view.js';
```

- [ ] **Step 2: Add the header button + handler** (next to the existing 🔁 button block):

```js
  const btnVisuals = document.createElement('button');
  btnVisuals.id = 'btn-visuals';
  btnVisuals.title = 'Build Content Factory shots (shotlist.json) as AE comps';
  btnVisuals.textContent = '🎬';
  btnVisuals.style.cssText = 'position:fixed;top:6px;right:78px;z-index:9999;background:transparent;border:1px solid #444;border-radius:4px;color:#ccc;padding:2px 7px;cursor:pointer;font-size:12px;';
  btnVisuals.onclick = () => openVisuals();
  document.body.appendChild(btnVisuals);
```

- [ ] **Step 3: Verify captions are untouched** —

```bash
git diff --stat cep-panel-ae/client/src/captions-view.js cep-panel-ae/extendscript/index.jsx
```

Expected: **no output** (zero changes to either file).

- [ ] **Step 4: Browser-rig check** — open `http://127.0.0.1:8765/panel-ae/cep-loader.html`, click 🎬, paste `tests/fixtures/shotlist-sample.json`, confirm 3 rows render with the right archetypes and durations, and that Build reports the expected "CSInterface not available" error outside AE.
- [ ] **Step 5: Commit** `feat(visuals): 🎬 panel entry point (3 added lines in main.js)`.

## Phase 4 — Lane B: the local agent

### Task 4.1: Restore the chat endpoint

**Files:** Copy `backend/routes/chat.py` from the **EditFlowAI** repo; modify `backend/main.py`; create `tests/unit/test_chat_route.py`.

The repo cleanup deleted `chat.py` (only the WebSocket survived). It still exists in EditFlowAI at `backend/routes/chat.py` with `POST /chat/message`.

- [ ] **Step 1: Copy it in**

```bash
cp "G:/Tech/AI Orchestration System/AI Editing/EditFlowAI/backend/routes/chat.py" \
   "G:/Tech/AI Orchestration System/AI Editing/EditFlow-AE/backend/routes/chat.py"
```

- [ ] **Step 2: Trim it to what Lane B needs.** Delete `POST /session/new` and any handler that imports a service this repo no longer has. Keep `POST /chat/message`. Verify with:

```bash
python -c "import ast,io; ast.parse(io.open('backend/routes/chat.py',encoding='utf-8-sig').read()); print('parses')"
grep -n "^from\|^import" backend/routes/chat.py
```

Every `from ..services.X` it names must exist in `backend/services/`. If one doesn't (e.g. `chat_engine`), replace that call with a direct `provider_service.chat(...)` call — `provider_service` was deliberately kept in the cleanup for exactly this.

- [ ] **Step 3: Register it** in `backend/main.py`:

```python
from .routes import chat, diag, models_routes, providers, subtitles, whisper_admin, ws
...
app.include_router(chat.router, prefix="/api")
```

- [ ] **Step 4: Update the cleanup guard** — `tests/test_no_premiere.py` has an `allowed` route whitelist. Add `"chat"` to it, or the guard fails.

- [ ] **Step 5: Write the test**

```python
"""Lane B is useless if the prompt reaches the model altered — the whole
point of a local-vs-web comparison is that both see the same instructions."""
from unittest.mock import AsyncMock, patch

def test_chat_message_passes_the_prompt_through_unchanged(client):
    with patch("backend.routes.chat.provider_service.chat",
               new=AsyncMock(return_value={"response": "ok"})) as m:
        r = client.post("/api/chat/message",
                        json={"messages": [{"role": "user", "content": "BUILD SPEC X"}]})
    assert r.status_code == 200
    sent = m.await_args.args[0] if m.await_args.args else m.await_args.kwargs["messages"]
    assert sent[-1]["content"] == "BUILD SPEC X"
```

- [ ] **Step 6: Run** `python -m pytest tests -q` → all pass. **Commit** `feat(backend): restore chat completion endpoint for the local agent lane`.

### Task 4.2: Lane B — local model translates a shot into primitive calls

**Files:** Create `cep-panel-ae/client/src/lane-local.js`, `tests/lane-local.test.js`.

The local model does **not** write ExtendScript. It emits a JSON "build script": an ordered list of calls to the primitives Phase 2 already built. A small model can do that reliably; it cannot write correct ES3.

- [ ] **Step 1: Write the failing tests**

```js
test('a valid build script passes and keeps call order', () => {
  const out = L.parseBuildScript(JSON.stringify({ calls: [
    { fn: 'text', args: { content: 'THE MONEY TRAIL', size: 0.11, y: 0.5 } },
    { fn: 'letterStagger', args: { stagger: 0.05, variant: 'slide_up' } },
  ] }));
  assert.equal(out.errors.length, 0);
  assert.deepEqual(out.calls.map((c) => c.fn), ['text', 'letterStagger']);
});

test('a call the primitives do not define is rejected, not passed to AE', () => {
  // the whole safety model: the model can only compose a fixed vocabulary
  const out = L.parseBuildScript(JSON.stringify({ calls: [
    { fn: 'app.project.close', args: {} },
  ] }));
  assert.equal(out.calls.length, 0);
  assert.match(out.errors[0], /unknown primitive/i);
});

test('out-of-range motion values are clamped, not obeyed', () => {
  const out = L.parseBuildScript(JSON.stringify({ calls: [
    { fn: 'letterStagger', args: { stagger: 5.0, variant: 'slide_up' } },
  ] }));
  assert.equal(out.calls[0].args.stagger, 0.10, 'clamped to the v7 safe band');
});

test('prose around the JSON is tolerated (models add preambles)', () => {
  const out = L.parseBuildScript('Sure! Here you go:\n```json\n{"calls":[]}\n```');
  assert.equal(out.errors.length, 0);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/** The ONLY functions a local model may call. Anything else is rejected
    before it reaches AE — this list is the sandbox. */
export const PRIMITIVES = {
  text:          ['content', 'size', 'x', 'y', 'color'],
  countUp:       ['from', 'to', 'dur', 'prefix', 'suffix', 'x', 'y', 'size'],
  bar:           ['index', 'value', 'maxValue', 'label', 'accent'],
  axis:          [],
  letterStagger: ['stagger', 'variant'],
};

const CLAMPED = { stagger: 'letterStagger', dur: 'statCountUp' };

export function parseBuildScript(raw) {
  const out = { calls: [], errors: [] };
  let parsed;
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);      // tolerate prose/fences
    parsed = JSON.parse(m ? m[0] : raw);
  } catch (e) {
    out.errors.push('model did not return JSON: ' + String(e.message || e));
    return out;
  }
  for (const call of (parsed.calls || [])) {
    const allowed = PRIMITIVES[call.fn];
    if (!allowed) { out.errors.push(`unknown primitive: ${call.fn}`); continue; }
    const args = {};
    for (const k of Object.keys(call.args || {})) {
      if (!allowed.includes(k)) continue;             // drop unknown args silently
      args[k] = CLAMPED[k] ? clampMotion(CLAMPED[k], call.args[k]) : call.args[k];
    }
    out.calls.push({ fn: call.fn, args });
  }
  return out;
}
```

- [ ] **Step 4: Write the prompt builder** (same file) — it hands the model the shot, the archetype rules verbatim from v7, the primitive list, and demands JSON only. Keep it in one exported `buildPrompt(spec)` so Lane A can reuse the identical text (fair comparison).

- [ ] **Step 5:** Tests PASS. **Commit** `feat(visuals): Lane B — local model composes primitives, never raw code`.

## Phase 5 — Lane A: the web agent

### Task 5.0: Build the environment brief + live probe

**Files:** Create `cep-panel-ae/extendscript/visuals.jsx` addition (`ef_vis_probeEnvironment`), `tools/build-agent-brief.js`, `docs/ae-agent-brief/*`.

- [ ] **Step 1: The live probe** (append to `visuals.jsx`):

```js
/* What can THIS install actually do? The brief quotes this so the agent is
   told the machine's real capabilities, not Adobe's documented ones. */
function ef_vis_probeEnvironment() {
    try {
        var out = { version: String(app.version), buildName: String(app.buildName || "") };
        var probe = null, selectorOk = false;
        try {
            var tmp = app.project.items.addComp("__ef_probe", 128, 128, 1, 1, 30);
            probe = tmp.layers.addText("probe");
            var anim = probe.property("ADBE Text Properties")
                .property("ADBE Text Animators").addProperty("ADBE Text Animator");
            selectorOk = anim.property("ADBE Text Selectors")
                .canAddProperty("ADBE Text Expressible Selector");
            tmp.remove();
        } catch (e1) { selectorOk = false; }
        out.expressionSelector = selectorOk;
        out.fonts = [];
        try {
            var all = app.fonts.allFonts;
            for (var i = 0; i < Math.min(all.length, 40); i++) {
                out.fonts.push(String(all[i].postScriptName));
            }
        } catch (e2) {}
        out.saveFrameToPng = false;
        try { out.saveFrameToPng = (typeof app.project.items.addComp("__ef_probe2", 8, 8, 1, 1, 30).saveFrameToPng === "function"); } catch (e3) {}
        return ef_json(out);
    } catch (e) { return ef_vis_err("probeEnvironment: " + e.toString()); }
}
```

  (Remove `__ef_probe2` in the same try block — mirror the cleanup the captions probe already does.)

- [ ] **Step 2: The generator** — `tools/build-agent-brief.js` (Node, run manually) reads the *working* source and emits the brief so it can't drift:

```js
/* Regenerate docs/ae-agent-brief/ from code that already runs in AE.
   Hand-written API docs rot; generated ones can't. */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

const jsx = fs.readFileSync(path.join(ROOT, 'cep-panel-ae/extendscript/index.jsx'), 'utf8');

// Every matchname the shipping caption engine actually uses, with its line.
const matchnames = new Map();
for (const m of jsx.matchAll(/["'](ADBE [^"']+)["']/g)) {
  const line = jsx.slice(0, m.index).split('\n').length;
  const src = jsx.split('\n')[line - 1].trim();
  if (!matchnames.has(m[1])) matchnames.set(m[1], src);
}
const md = ['# Verified match names',
  '', 'Every entry below is used by code that runs in After Effects today.',
  '', '| Match name | Used as |', '|---|---|',
  ...[...matchnames].map(([k, v]) => `| \`${k}\` | \`${v.replace(/\|/g, '\\|').slice(0, 90)}\` |`)];
fs.writeFileSync(path.join(ROOT, 'docs/ae-agent-brief/MATCHNAMES.md'), md.join('\n') + '\n');
console.log('MATCHNAMES.md:', matchnames.size, 'verified names');
```

- [ ] **Step 3: Write `KNOWN_FAILURES.md` by hand** — this one is judgement, not extraction. Seed it with the failures this project actually hit: ES3 only (no `let`/`const`/arrow/`toLocaleString`/`JSON`); markers are 1-indexed and AE re-sorts them by time; `textIndex` starts at 1 so guard `textIndex >= 1`; set `inPoint` before `outPoint` or AE preserves the old duration; `sourceRectAtTime` must be called after the layer's start time; expression selectors need `ADBE Text Range Type2` (Words = 3, Characters = 1) and the enum is unverified on AE 2026.

- [ ] **Step 4: Run the generator, commit the brief** — `node tools/build-agent-brief.js`, then commit `docs(agent): generated AE environment brief + live capability probe`.

### Task 5.0b: Ship the Adobe reference to the web agent

**Files:** Create `tools/build-agent-reference.js`; output into the Content Factory repo at `prompts/visual-v8-ae/reference/`.

The web agent cannot read `docs/adobe/` — it's on the other side of a tunnel. Copy the useful slice into the prompt folder the app already serves.

- [ ] **Step 1: Write the copier** — `tools/build-agent-reference.js`:

```js
/* Copy the slice of the Adobe mirror an AE builder agent actually needs
   into the v8 prompt folder, where the Documentary Studio app serves it at
   /api/prompts/visual-v8-ae/reference/<file>.
   The full mirror is 1.9MB (~500K tokens) — this slice is ~173KB, fetched
   one page at a time. */
const fs = require('node:fs');
const path = require('node:path');

const MIRROR = path.resolve(__dirname, '..', 'docs', 'adobe');
const OUT = process.argv[2];   // .../Content-Prompts-for-AI/prompts/visual-v8-ae/reference
if (!OUT) { console.error('usage: node tools/build-agent-reference.js <out-dir>'); process.exit(1); }

const FILES = [
  ['scripting-guide/docs/text/textdocument.md',            'textdocument.md'],
  ['scripting-guide/docs/layer/textlayer.md',              'textlayer.md'],
  ['scripting-guide/docs/layer/shapelayer.md',             'shapelayer.md'],
  ['scripting-guide/docs/layer/layer.md',                  'layer.md'],
  ['scripting-guide/docs/item/compitem.md',                'compitem.md'],
  ['scripting-guide/docs/property/property.md',            'property.md'],
  ['scripting-guide/docs/property/propertygroup.md',       'propertygroup.md'],
  ['scripting-guide/docs/matchnames/layer/textlayer.md',   'matchnames-textlayer.md'],
  ['scripting-guide/docs/matchnames/layer/shapelayer.md',  'matchnames-shapelayer.md'],
  ['scripting-guide/docs/other/markervalue.md',            'markervalue.md'],
  ['scripting-guide/docs/other/keyframeease.md',           'keyframeease.md'],
  ['scripting-guide/docs/introduction/changelog.md',       'ae-version-changelog.md'],
];

fs.mkdirSync(OUT, { recursive: true });
let total = 0, copied = [];
for (const [src, dest] of FILES) {
  const from = path.join(MIRROR, src);
  if (!fs.existsSync(from)) { console.warn('MISSING (skipped):', src); continue; }
  const bytes = fs.readFileSync(from);
  fs.writeFileSync(path.join(OUT, dest), bytes);
  total += bytes.length; copied.push([dest, Math.round(bytes.length / 1024)]);
}
console.log(`copied ${copied.length} files, ${Math.round(total / 1024)}KB`);
```

- [ ] **Step 2: Add the expression pages** — the expression reference uses a different layout. These paths are verified to exist in the mirror; append them to `FILES`:

```js
  ['expressions/docs/general/interpolation.md',  'expr-interpolation.md'],  // linear(), ease()
  ['expressions/docs/general/global.md',         'expr-global.md'],         // time, thisLayer, comp()
  ['expressions/docs/general/time-conversion.md','expr-time.md'],
  ['expressions/docs/text/sourcetext.md',        'expr-sourcetext.md'],     // textIndex, textTotal
  ['expressions/docs/layer/properties.md',       'expr-layer-properties.md'],
```

  The whole `general/` + `text/` set is 116 KB, so taking these five keeps the bundle under ~250 KB.

- [ ] **Step 3: Generate `INDEX.md`** into the same folder — the routing table from the "Stopping the web agent from hallucinating" section above, plus this line at the top:

```markdown
> Fetch ONE page at a time, only when you need it. If this reference and
> `KNOWN_FAILURES.md` disagree, KNOWN_FAILURES wins — it describes code that
> actually ran on this machine; these pages describe the API in general.
```

- [ ] **Step 4: Run it and check the size**

```bash
node tools/build-agent-reference.js "G:/Tech/AI Orchestration System/ContentFactory V4 Z.AI/Content-Prompts-for-AI/prompts/visual-v8-ae/reference"
```

Expected: `copied 17 files, ~250KB`, and no `MISSING` lines. Any `MISSING` means a path changed in the mirror — fix the path, don't drop the file.

- [ ] **Step 5: Verify the app serves them** — with the Documentary Studio app running:

```bash
curl -s http://localhost:3000/api/prompts/visual-v8-ae/reference/INDEX.md | head -5
```

Expected: the routing table. If the app serves prompts from its own copy (`content-app/prompts/`), re-run the app's prompt-sync step so the reference folder lands there too.

- [ ] **Step 6: Commit in the Content Factory repo** `feat(prompts): AE scripting reference for the v8 builder agent` — and confirm `git status --short prompts/visual-v7-glm` is still empty.

### Task 5.1: The static gate for pushed code

**Files:** Create `cep-panel-ae/client/src/lane-web.js`, `tests/lane-web-gate.test.js`.

- [ ] **Step 1: Write the failing tests** — the gate is the safety boundary, so it gets tested hardest:

```js
const OK = 'function ef_lane_a_shot01(comp, spec) { return true; }';

test('a well-formed builder passes the gate', () => {
  assert.equal(W.gateCode(OK).ok, true);
});

test('code touching the project or filesystem is refused', () => {
  for (const bad of [
    'function ef_lane_a_x(){ app.project.close(); }',
    'function ef_lane_a_x(){ new File("C:/x.txt").remove(); }',
    'function ef_lane_a_x(){ system.callSystem("cmd /c del *"); }',
    'function ef_lane_a_x(){ $.evalFile("other.jsx"); }',
    'function ef_lane_a_x(){ app.executeCommand(2); }',
  ]) {
    const r = W.gateCode(bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.reason.length > 0);
  }
});

test('functions outside the ef_lane_a_ namespace are refused', () => {
  const r = W.gateCode('function ef_createCaptions(x){ }');
  assert.equal(r.ok, false);
  assert.match(r.reason, /namespace/i);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/* Refused outright. Lane A builds comps; it never touches projects, disk,
   the caption engine, or the app itself. */
const FORBIDDEN = [
  /app\.project\.close/, /app\.quit/, /app\.executeCommand/,
  /\bnew\s+File\b/, /\bnew\s+Folder\b/, /system\.callSystem/,
  /\$\.evalFile/, /\.saveAs\b/, /app\.project\.save/,
];

export function gateCode(src) {
  const text = String(src || '');
  for (const rx of FORBIDDEN) {
    if (rx.test(text)) return { ok: false, reason: `forbidden call: ${rx}` };
  }
  const defined = [...text.matchAll(/function\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
  if (defined.length === 0) return { ok: false, reason: 'defines no functions' };
  const stray = defined.filter((n) => !n.startsWith('ef_lane_a_'));
  if (stray.length) return { ok: false, reason: `namespace violation: ${stray.join(', ')}` };
  return { ok: true, reason: '', functions: defined };
}
```

- [ ] **Step 4:** Tests PASS. **Commit** `feat(visuals): Lane A static gate — refuse unsafe generated code`.

### Task 5.2: Load and run a gated Lane-A builder

**Files:** Create `cep-panel-ae/extendscript/lane_a_loader.jsx`; modify `lane-web.js`.

- [ ] **Step 1: The loader** — writes nothing to disk; the panel passes the already-gated source as a string and AE `eval`s it inside a function scope, then calls it:

```js
/* Runs a gated Lane-A builder. The panel has ALREADY passed the source
   through gateCode(); this is the second line of defence, not the first. */
function ef_lane_a_run(jsonStr) {
    var started = false;
    try {
        var cfg = eval("(" + jsonStr + ")");
        if (!cfg.src || !cfg.fn || cfg.fn.indexOf("ef_lane_a_") !== 0) {
            return ef_vis_err("lane A: bad function name");
        }
        var comp = ef_vis_findComp(cfg.compName);
        if (!comp) return ef_vis_err("lane A: comp not found: " + cfg.compName);
        app.beginUndoGroup("EditFlow: Lane A " + cfg.fn);
        started = true;
        eval(cfg.src);                       // defines ef_lane_a_*
        var out = this[cfg.fn](comp, cfg.spec);
        app.endUndoGroup();
        return ef_json({ ran: cfg.fn, ok: !!out, layers: comp.numLayers });
    } catch (e) {
        if (started) { try { app.endUndoGroup(); } catch (_) {} }
        return ef_vis_err("lane A run: " + e.toString());
    }
}
```

- [ ] **Step 2: The panel side** — `loadLaneABuilder(branch)`: reads the pushed file from the checked-out branch, runs `gateCode`, shows you the function list and a diff summary, and only builds after you click. Nothing auto-runs.

- [ ] **Step 3: Commit** `feat(visuals): Lane A loader with human review gate`.

### Task 5.3: The Lane A instruction file

**Files:** In the Content Factory repo, inside the **copy** only.

- [ ] **Step 1: Copy the folder** (never edit v7):

```bash
cd "G:/Tech/AI Orchestration System/ContentFactory V4 Z.AI/Content-Prompts-for-AI/prompts"
cp -r visual-v7-glm visual-v8-ae
```

- [ ] **Step 2: Add `visual-v8-ae/v8/agent_ae_builder.md`** telling the web agent: the archetype rules (already in the copied folder), the AE primitives available, the `ef_lane_a_*` namespace rule, the forbidden-call list from Task 5.1, that it must push to branch `agent/lane-a/<plan-id>` in EditFlow-AE, and that ExtendScript is **ES3** — no `let`, `const`, arrow functions, or `toLocaleString`.
- [ ] **Step 3: Verify v7 untouched** — `git status --short prompts/visual-v7-glm` → no output.
- [ ] **Step 4: Commit in that repo** `feat(prompts): visual-v8-ae lane for the AE builder agent (v7 unchanged)`.

### Task 5.4: The error round-trip

**Files:** Modify `cep-panel-ae/client/src/lane-web.js`.

- [ ] **Step 1:** When a gated Lane-A builder fails — gate refusal, AE `ERROR:` string, or a fidelity miss — assemble a correction request containing: the original shot spec, the exact failure text, the offending function name, the environment brief's `KNOWN_FAILURES.md`, and (for a fidelity miss) the rendered frame path. One retry only.
- [ ] **Step 2:** Log every attempt to `results.json` as `attempts: [{n, failure, fixed}]` so the scorecard can show *"Lane A: 2 of 3 shots first-try, 1 after correction"* — first-try rate is the number that actually tells you whether the brief is working.
- [ ] **Step 3: Commit** `feat(visuals): Lane A error round-trip with one correction attempt`.

## Phase 6 — Lane D: think → build → verify

### Task 6.0: The hybrid lane

**Files:** Create `cep-panel-ae/client/src/lane-hybrid.js`, `tests/lane-hybrid.test.js`.

This is the lane I'd expect to win, and it's cheap because every part already exists: the agent decides, Lane C builds, the bridge checks.

- [ ] **Step 1: Write the failing tests** — the contract is that the agent may only move creative dials, never geometry:

```js
test('a spec patch may only touch creative fields', () => {
  const base = { id: 's3', archetype: 'SECTION_TITLE_CARD', title: 'THE MONEY TRAIL',
                 variant: 'slide_up', stagger: 0.05, duration: 3 };
  const patched = H.applyPatch(base, { variant: 'scale_center', stagger: 0.08 });
  assert.equal(patched.variant, 'scale_center');
  assert.equal(patched.stagger, 0.08);
});

test('a patch trying to change data or geometry is refused', () => {
  const base = { id: 's1', archetype: 'STAT_COUNTER', value: 1500000000, duration: 5 };
  const patched = H.applyPatch(base, { value: 999, duration: 90, x: 0.2 });
  assert.equal(patched.value, 1500000000, 'the NUMBER is not the agent\'s to change');
  assert.equal(patched.duration, 5, 'timing comes from the shotlist');
  assert.equal(patched.x, undefined, 'geometry is never patchable');
});

test('patched motion values still get clamped to the v7 bands', () => {
  const base = { id: 's3', archetype: 'SECTION_TITLE_CARD', title: 'X', stagger: 0.05 };
  assert.equal(H.applyPatch(base, { stagger: 0.9 }).stagger, 0.10);
});

test('a verdict of "fix" carries a patch; "ok" ends the loop', () => {
  assert.equal(H.parseVerdict('{"verdict":"ok"}').done, true);
  const f = H.parseVerdict('{"verdict":"fix","patch":{"variant":"slide_left"},"why":"stagger unclear"}');
  assert.equal(f.done, false);
  assert.deepEqual(f.patch, { variant: 'slide_left' });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```js
/* The ONLY fields an agent may set. Everything else — values, durations,
   coordinates — comes from the shotlist or the compiler. This whitelist is
   why the hybrid lane cannot hallucinate a wrong number onto the screen. */
export const PATCHABLE = {
  SECTION_TITLE_CARD: ['variant', 'stagger', 'supporting'],
  STAT_COUNTER: ['pulse', 'unit'],
  BAR_CHART: ['accentIndex'],
};

const CLAMPED = { stagger: 'letterStagger' };

export function applyPatch(spec, patch) {
  const allowed = PATCHABLE[spec.archetype] || [];
  const out = { ...spec };
  for (const k of Object.keys(patch || {})) {
    if (!allowed.includes(k)) continue;                 // silently refused
    out[k] = CLAMPED[k] ? clampMotion(CLAMPED[k], patch[k]) : patch[k];
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'accentIndex')) {
    // accentIndex is patchable but must stay in range
    const i = Number(patch.accentIndex);
    out.bars = (spec.bars || []).map((b, n) => ({ ...b, accent: n === i }));
  }
  return out;
}

export function parseVerdict(raw) {
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    const v = JSON.parse(m ? m[0] : raw);
    return { done: v.verdict === 'ok', patch: v.patch || {}, why: v.why || '' };
  } catch (e) {
    return { done: true, patch: {}, why: 'unparseable verdict — accepting build' };
  }
}
```

- [ ] **Step 4: Wire the loop** (same file): `think(spec)` → `applyPatch` → `ef_vis_buildShot` → `ef_vis_dumpShot` + one rendered frame → `verify(spec, dump, framePath)` → `parseVerdict`. **Max two rounds**, then stop and keep the best build. Every round is recorded for the scorecard.
- [ ] **Step 5: Commit** `feat(visuals): Lane D — agent thinks and verifies, compiler builds`.

## Phase 7 — The scorecard

### Task 7.1: Run every lane over the same shotlist

**Files:** Create `cep-panel-ae/client/src/bakeoff.js`, `tests/bakeoff.test.js`.

- [ ] **Step 1: Write the failing tests** (scoring is pure — no AE needed):

```js
test('a lane that errors on a shot scores 0 for that shot, not a crash', () => {
  const s = B.scoreShot({ spec: { id: 's1', archetype: 'STAT_COUNTER', value: 100 },
                          result: { error: 'buildShot: bad property' }, dump: null });
  assert.equal(s.built, false);
  assert.equal(s.fidelity, 0);
  assert.match(s.notes[0], /bad property/);
});

test('fidelity compares the DUMP to the SPEC, not the lane\'s own claim', () => {
  // a lane reporting success while building the wrong number must score 0
  const s = B.scoreShot({
    spec: { id: 's1', archetype: 'STAT_COUNTER', value: 1500000000, duration: 5 },
    result: { comp: 's1_STAT_COUNTER' },
    dump: { duration: 5, layers: [{ name: 'Value', text: '1,400,000,000' }] },
  });
  assert.equal(s.fidelity, 0, 'wrong final number must fail fidelity');
});

test('scoreboard totals per lane and names a winner only on a real margin', () => {
  const board = B.scoreboard({
    laneC: [{ built: true, fidelity: 1, rules: 1, ms: 900 }],
    laneB: [{ built: true, fidelity: 1, rules: 1, ms: 8000 }],
  });
  assert.equal(board.winner, 'laneC', 'tie on quality → faster lane wins');
  const tie = B.scoreboard({ laneC: [{ built: true, fidelity: 1, rules: 1, ms: 1000 }],
                             laneB: [{ built: true, fidelity: 1, rules: 1, ms: 1050 }] });
  assert.equal(tie.winner, 'tie', 'a 5% time difference is not a winner');
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `scoreShot` (built / fidelity / rules / ms, with `notes[]`) and `scoreboard` (per-lane totals; winner only when quality differs or time differs by >25%).

- [ ] **Step 4: The runner** — `runBakeoff(shotlist, lanes)` builds every shot in every enabled lane into the sandbox project, calls `ef_vis_dumpShot` after each, renders 3 frames per shot per lane via `/api/ae-bridge/frame`, and writes `results.json`:

```json
{ "shotlist": "sample", "ranAt": "2026-07-25T10:00:00Z",
  "lanes": { "laneC": { "built": 3, "fidelity": 1.0, "rules": 1.0, "ms": 2700 },
             "laneB": { "built": 3, "fidelity": 1.0, "rules": 0.67, "ms": 24000 },
             "laneA": { "built": 2, "fidelity": 1.0, "rules": 1.0, "ms": 41000 } },
  "winner": "laneC",
  "frames": { "laneC": ["shot_01@1.5s.png", "..."] } }
```

- [ ] **Step 5: Commit** `feat(visuals): bake-off runner + scorecard`.

### Task 7.2: The comparison view

**Files:** Modify `visuals-view.js`.

- [ ] **Step 1:** Add a "Compare lanes" panel: checkboxes for which lanes to run, a Run button, and a results grid — one row per shot, one column per lane, each cell showing the rendered frame plus ✅/❌ for built / fidelity / rules and the time taken. Below it, the scoreboard and the named winner.
- [ ] **Step 2:** A "Keep this one" button per row copies the winning lane's comp into your working project and deletes the others' — so the bake-off ends with a usable result, not just a report.
- [ ] **Step 3: Commit** `feat(visuals): side-by-side lane comparison in the panel`.

### Task 7.3: Pull the shotlist straight from the app (optional)

**Files:** Modify `visuals-view.js`.

- [ ] **Step 1:** Add a tunnel-URL field. `GET <url>/api/tunnel/status` to check it's live, `GET <url>/api/projects` to pick a project, `GET <url>/api/projects/<id>/visual-plans` to list plans, then parse `shotsJson` with the **same** `parseShotlist` used for files — no second code path.
- [ ] **Step 2:** Verify against a running Documentary Studio app; if the tunnel is down the field shows the error and the file loader still works.
- [ ] **Step 3: Commit** `feat(visuals): load a shotlist directly from the Documentary Studio tunnel`.

## Phase 8 — Verification and docs

### Task 8.1: In-AE verification via the bridge

- [ ] **Step 1:** With the backend running with `EDITFLOW_AGENT_BRIDGE=1` and AE open, build the 3 fixture shots through the panel, then:

```bash
curl -X POST http://127.0.0.1:8765/api/ae-bridge/eval -H "Content-Type: application/json" \
  -d '{"fn":"ef_vis_dumpShot","args":["shot_01_STAT_COUNTER"]}'
```

  Assert: a `Value` layer whose Source Text carries a count expression, a `Label` layer, comp duration 5 s.

- [ ] **Step 2: Render frames and look at them** — for `shot_01`, frames at 0.2 s (label only), 1.5 s (mid-count), 4.5 s (final value with separators):

```bash
curl -o /tmp/stat_mid.png "http://127.0.0.1:8765/api/ae-bridge/frame?t=1.5"
```

- [ ] **Step 3:** Repeat for `shot_02_BAR_CHART` (axis at 0.3 s, bars mid-rise at 1.0 s, labels present at 2.5 s) and `shot_03_SECTION_TITLE_CARD` (partial letters at 0.3 s — proof of stagger, not a block fade).
- [ ] **Step 4: Commit** the evidence summary in the message: `test(visuals): AE-verified via bridge — dumps + frames for all 3 archetypes`.

### Task 8.2: Verify each lane in AE, not just the compiler

- [ ] **Step 1:** Repeat Task 8.1's dump-and-render checks for **Lane B** and **Lane A** on the same 3 fixture shots, into the sandbox project (`EditFlow Bakeoff.aep`).
- [ ] **Step 2:** Confirm the Lane A gate actually bites: hand `loadLaneABuilder` a builder containing `app.project.close()` and assert the panel refuses it and never reaches AE.
- [ ] **Step 3: Commit** `test(visuals): all four lanes AE-verified + gate refusal proven`.

### Task 8.3: Documentation

**Files:** Create `docs/ae-visual-shots.md` and `docs/ae-visual-bakeoff.md`.

- [ ] **Step 1: Write `ae-visual-shots.md`** — what the feature does; how to get a `shotlist.json` out of the Documentary Studio app (export a file, or paste the tunnel URL); the 🎬 button flow; the supported archetypes and their required props (copy the table from this plan's "Verified inputs"); the in-AE checklist from Task 8.1; and the explicit limitation that `BROLL_VIDEO` and `EMOTIONAL_MOMENT` stay with the generative tools.
- [ ] **Step 2: Write `ae-visual-bakeoff.md`** — how to run all four lanes over one shotlist, what each scorecard column means, how to read `results.json`, how to accept a winning comp, and the safety rules for Lane A (git-only delivery, the static gate, the sandbox project, the manual load click).
- [ ] **Step 3: Commit** `docs(visuals): how to build shots in AE and how to run the lane bake-off`.

---

## Self-review

- **Constraint coverage:** additive-only → separate `visuals.jsx` + `ef_vis_*` namespace + a Task 3.2 step that *asserts* zero diff on the caption files; new branch → stated below; never edit v7 → Task 5.3 copies the folder and then verifies v7 is clean; top-3 scope → `SUPPORTED_ARCHETYPES` is a hard whitelist, tested; comps in one project → `ef_vis_ensureFolder` + `ef_vis_buildShot`. ✓
- **Bake-off coverage:** four lanes exist (C = Phases 1–3, B = Phase 4, A = Phase 5, D = Phase 6), all consume the same spec and the same `buildPrompt` text so the comparison is fair; scoring is Phase 7; each lane is separately AE-verified in Task 8.2. ✓
- **Anti-hallucination coverage:** generated environment brief + live capability probe (Task 5.0), the Adobe reference served on demand to the web agent (Task 5.0b — the mirror itself is 1.9MB, far too big to paste), the static gate (Task 5.1), the error round-trip (Task 5.4), and — the strongest one — Lane D's patch whitelist, which makes it *structurally impossible* for the model to change a number or a coordinate. ✓
- **Two-system merge:** the contract is `shotlist.json` — a file in v1 (Task 3.1) and optionally the tunnel API in Task 7.3, both through **one** parser. No schema change to the Documentary Studio app: Lane A delivers code by git branch, not by a new DB column. ✓
- **Restored dependency:** `chat.py` comes back from the EditFlowAI repo in Task 4.1, including the step that adds `chat` to the cleanup guard's route whitelist — otherwise `tests/test_no_premiere.py` fails the moment it lands. ✓
- **Grounding:** the shotlist shape, all three archetype rule-sets and every motion limit are quoted from your repo, not invented. The one fabrication risk I deliberately avoided: I did **not** invent props for BAR_CHART/SECTION_TITLE_CARD beyond what the archetype rules imply (`bars`, `accentIndex`, `variant`, `supporting`) — these are flagged in Task 5.2 as the fields the v8 prompt copy must emit. ✓
- **Placeholders:** none — every step carries runnable code or an exact command. The one intentional "wrong then right" snippet (Task 2.3 Scale expression) is called out explicitly so it can't be pasted by accident. ✓
- **Naming:** `ef_vis_buildShot / ef_vis_statCounter / ef_vis_barChart / ef_vis_titleCard / ef_vis_countExpr / ef_vis_barGrowExpr / ef_vis_letterExpr / ef_vis_addLetterSelector / ef_vis_ensureFolder / ef_vis_dumpShot / ef_vis_styleText / ef_vis_center`, and `parseShotlist / normalizeShot / clampMotion / MOTION_LIMITS / SUPPORTED_ARCHETYPES / hexToRgb` — used identically throughout. ✓
- **Resolved blocker:** the chat completion endpoint the repo cleanup removed is restored in Task 4.1 by copying it from EditFlowAI. Phases 1–3 don't depend on it, so Lane C ships even if Lane B stalls.
- **Risks:** (1) `ADBE Text Range Type2` = 1 for Characters is unverified in AE 2026 — the same enum risk the captions engine carries, and Task 8.1's frame render is what catches it; (2) `ADBE Vector Rect Position` anchoring for baseline bar growth needs the in-AE check in Task 8.1 Step 3; (3) fonts stay at the AE default in v1 — the Style Bible's typeface is a v2 concern; (4) Lane A runs model-written code — mitigated by git-only delivery, the static gate (Task 5.1), a sandbox project, and a manual load click, and the gate's refusal is itself tested in Task 8.2.
- **Honest expectation:** Lane C should win on these three archetypes — they're pure arithmetic, which is exactly where code beats a model. The bake-off's real value is finding the archetype where that stops being true, because that's the point where the agent starts paying for itself. If Lane C wins everything, that is a result worth having, not a failure.

**Branch:** `feat/ae-visual-builder`, cut from `main` in EditFlow-AE.
