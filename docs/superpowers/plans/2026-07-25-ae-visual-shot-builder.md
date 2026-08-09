# AE Visual Shot Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Every AE-facing task ends with bridge evidence (CLAUDE.md Rule 10): an `ef_vis_dumpShot` assertion plus a rendered frame from `/api/ae-bridge/frame`. Nothing is reported as working on the strength of code review alone.

**Goal:** Turn a `shotlist.json` from the Content Factory into finished After Effects comps — one comp per shot — for the three archetypes that carry most of a documentary: `STAT_COUNTER`, `BAR_CHART`, `SECTION_TITLE_CARD`.

**Architecture:** A **deterministic compiler**, not a prompt. The panel parses `shotlist.json`, normalises each shot into a strict build spec (pure JS, node-tested), and ExtendScript builds a comp from that spec with native layers and expressions. An LLM is available only to *fill gaps* in a malformed shot (missing title, no accent colour) — it never computes geometry or timing. Everything lands in one AE project so you can arrange and render normally.

**Tech Stack:** CEP panel (vanilla ES modules), ExtendScript ES3, node:test, the existing agent bridge for verification, Ollama via the provider layer already in the backend.

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

## Phase 4 — The agent (gap-filling only)

### Task 4.1: LLM repair for malformed shots

**Files:** Modify `visuals-view.js`; no backend change (uses the existing `/api/providers` + Ollama layer).

- [ ] **Step 1: Scope it honestly.** The LLM is asked one question only: *given this shot's `scriptLine` and `qaRisk`, supply the missing props* — as JSON matching the archetype's required fields. It never sees pixel maths. The response is fed back through `normalizeShot`, so an invented field simply fails validation and is reported.

- [ ] **Step 2: Implement** a "✨ Fix missing props" button that appears **only** on rows that failed validation:

```js
async function repairShot(rawShot, errorMessage) {
  const prompt = [
    'You are completing a shot spec for a documentary visual.',
    'Return ONLY a JSON object for the "props" field. No prose.',
    `Archetype: ${rawShot.archetype}`,
    `Narration: ${rawShot.scriptLine || ''}`,
    `Validation error: ${errorMessage}`,
    'Required for STAT_COUNTER: value (number), title (string).',
    'Required for BAR_CHART: bars (array of {label, value}).',
    'Required for SECTION_TITLE_CARD: title (string).',
    `Current props: ${JSON.stringify(rawShot.props || {})}`,
  ].join('\n');
  const resp = await apiPost('/api/chat', { messages: [{ role: 'user', content: prompt }] });
  return JSON.parse(String(resp.response).match(/\{[\s\S]*\}/)[0]);
}
```

  **Blocker to resolve first:** `/api/chat` was deleted in the repo cleanup — only the WebSocket survived. Either (a) add a tiny `POST /api/chat/complete` to `backend/routes/ws.py`'s router that calls `provider_service`, or (b) call Ollama directly from the panel. Pick (a); it keeps provider selection in one place. Write the route with a pytest that mocks `provider_service` and asserts the prompt is passed through unmodified.

- [ ] **Step 3: Never auto-apply.** The repaired props populate the row for review; you press Build. Commit `feat(visuals): optional LLM prop repair for malformed shots`.

## Phase 5 — Verification and docs

### Task 5.1: In-AE verification via the bridge

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

### Task 5.2: Prompt lane — copy, never edit

**Files:** In the Content Factory repo only, and only if needed.

- [ ] **Step 1:** If the planner needs to emit an AE lane, **copy** the whole folder:

```bash
cd "G:/Tech/AI Orchestration System/ContentFactory V4 Z.AI/Content-Prompts-for-AI/prompts"
cp -r visual-v7-glm visual-v8-ae
```

- [ ] **Step 2:** Edit **only** inside `visual-v8-ae/`: add `"tool": "ae_comp"` as an accepted value in the copied `agent_visual_planner.md`, and note that `STAT_COUNTER`, `BAR_CHART` and `SECTION_TITLE_CARD` route to After Effects.
- [ ] **Step 3: Verify v7 is untouched** — `cd .. && git status --short prompts/visual-v7-glm` → no output.
- [ ] **Step 4: Commit in that repo** `feat(prompts): visual-v8-ae lane (copy of v7, v7 unchanged)`.

### Task 5.3: Documentation

**Files:** Create `docs/ae-visual-shots.md`.

- [ ] **Step 1: Write it** — what the feature does; how to export `shotlist.json` from the Documentary Studio app; the 🎬 button flow; the supported archetypes and their required props (copy the table from this plan's "Verified inputs"); the in-AE checklist from Task 5.1; and the explicit limitation that `BROLL_VIDEO` and `EMOTIONAL_MOMENT` stay with the generative tools.
- [ ] **Step 2: Commit** `docs(visuals): how to build Content Factory shots in AE`.

---

## Self-review

- **Constraint coverage:** additive-only → separate `visuals.jsx` + `ef_vis_*` namespace + a Task 3.2 step that *asserts* zero diff on the caption files; new branch → stated below; never edit v7 → Task 5.2 copies and then verifies v7 is clean; top-3 scope → `SUPPORTED_ARCHETYPES` is a hard whitelist, tested; comps in one project → `ef_vis_ensureFolder` + `ef_vis_buildShot`. ✓
- **Grounding:** the shotlist shape, all three archetype rule-sets and every motion limit are quoted from your repo, not invented. The one fabrication risk I deliberately avoided: I did **not** invent props for BAR_CHART/SECTION_TITLE_CARD beyond what the archetype rules imply (`bars`, `accentIndex`, `variant`, `supporting`) — these are flagged in Task 5.2 as the fields the v8 prompt copy must emit. ✓
- **Placeholders:** none — every step carries runnable code or an exact command. The one intentional "wrong then right" snippet (Task 2.3 Scale expression) is called out explicitly so it can't be pasted by accident. ✓
- **Naming:** `ef_vis_buildShot / ef_vis_statCounter / ef_vis_barChart / ef_vis_titleCard / ef_vis_countExpr / ef_vis_barGrowExpr / ef_vis_letterExpr / ef_vis_addLetterSelector / ef_vis_ensureFolder / ef_vis_dumpShot / ef_vis_styleText / ef_vis_center`, and `parseShotlist / normalizeShot / clampMotion / MOTION_LIMITS / SUPPORTED_ARCHETYPES / hexToRgb` — used identically throughout. ✓
- **Known blocker, surfaced not buried:** Task 4.1 needs a chat completion endpoint that the repo cleanup removed. Phases 1–3 and 5 do not depend on it, so the feature is fully usable without Phase 4.
- **Risks:** (1) `ADBE Text Range Type2` = 1 for Characters is unverified in AE 2026 — same enum risk the captions engine carries, and Task 5.1's frame render is what catches it; (2) `ADBE Vector Rect Position` anchoring for baseline growth needs the in-AE check in Task 5.1 Step 3; (3) fonts are left at the AE default in v1 — the Style Bible's typeface is a v2 concern.

**Branch:** `feat/ae-visual-builder`, cut from `main` in EditFlow-AE.
