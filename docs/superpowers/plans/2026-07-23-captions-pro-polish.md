# Captions Pro-Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Every AE-facing task ends with bridge evidence (CLAUDE.md Rule 10): an `ef_dumpLayers` assertion and/or a rendered frame from `/api/ae-bridge/frame`. When the bridge is unreachable, the commit says "not yet AE-verified".

**Goal:** Make the captions system editable like a pro tool — word timing you can drag in AE, one constant font size, a real draggable caption box, platform safe-zone previews, and motion that looks hand-tuned — fixing every defect in the audit below.

**Architecture:** Word timing moves from numbers-baked-into-expressions to **layer markers** (one marker per word; the selector expression reads `thisLayer.marker.key(i).time`, so dragging a marker retimes a word live, and a read-back endpoint syncs edits into the panel). Grouping becomes **width-aware** (measured pixels vs the caption box decide words-per-caption, so font size never triggers shrink). The preview gains a **draggable box overlay** and **data-driven platform safe zones**. All word presets get real per-word animators in AE (closing the preview/AE mismatch), with a pro easing set shared between the JS model and jsx expression builders.

**Tech Stack:** CEP panel (vanilla ES modules, canvas), ExtendScript ES3, FastAPI backend + agent bridge, node:test + pytest, WhisperX (install task).

---

## Audit — confirmed defects this plan fixes

| # | Defect (evidence) | Root cause | Fixed in |
|---|---|---|---|
| A1 | Word timing off vs voice; retiming means editing numbers inside an expression | times baked as literals into the selector Amount expression; plain Whisper (~200–300ms error) because WhisperX was wired but never installed | Phase 1 |
| A2 | Big font ⇒ multi-word captions render small, one-word captions render big | grouping is font-blind (fixed `maxChars=30`); box wrap caps at 2 lines, then `fit` shrink fires (captions-view.js:1667) | Phase 2 |
| A3 | Caption box is an abstract % slider, not a box you can see/drag | no overlay UI; posX/posY/boxWidthPct are three disconnected sliders | Phase 3 |
| A4 | No way to see how the frame reads on TikTok/Reels/Shorts (UI chrome covers captions) | feature absent | Phase 4 |
| A5 | Animations look mechanical, not editor-tuned | easing set is 3 cubics + linear; no overshoot/expo; durations untuned | Phase 5 |
| A6 | **WYSIWYG lie:** preview animates popin/bounce/squash/typewriter per-word, AE renders them caption-level (`useSelector` only for fadeup_words, index.jsx:1467; `ef_applyPreset` layer-level, :814) | Phase 3 of the original rebuild was scoped to fadeup_words only | Phase 5 |
| A7 | Typewriter in AE = fixed 22 chars/sec sourceText expression; preview = per-word reveal | legacy `ef_typewriterExpr(cps=22)` never rebuilt | Phase 5 |
| A8 | Regenerating captions wipes any manual AE tweaks (replace clears all `EF_CAPTION` layers) | no read-back path | Phase 1 |
| A9 | 2-line captions at low posY / big font can clip the comp's bottom edge | horizontal box only; no vertical clamp | Phase 2 |
| A10 | Orphan one-word captions ("Yes.") look bare and amplify the size feeling | sentence-end break creates 1-word groups; no merge rule | Phase 2 |
| A11 | Pill height approximated from fontSize, not real glyph box | `pillH = fontSize*fit + pads` | Phase 5 (minor) |
| A12 | Word start times in the Content tab are display-only | inputs never built | Phase 1 |

Docs consulted (Rule 9): `docs/adobe/scripting-guide/docs/other/markervalue.md`, `.../layer/layer.md` (Marker property, setValueAtTime), `.../matchnames/layer/textlayer.md` (animator/selector matchnames), `docs/adobe/expressions/docs/` (marker.key(), ease curves).

## Decision log

- **Markers, not keyframes, for word timing (default).** A marker per word is draggable in the timeline (exactly the "grab and nudge" editors expect), keeps ONE layer per caption, survives regeneration via read-back, and needs no graph-editor knowledge. Baked keyframes (per-word Range-selector animators with eased keys) are offered as an optional one-way **"Bake for graph editor"** export in Task 5.5 — that's where "editor touches the curves" literally happens, at the cost of losing regenerability.
- **Kill shrink by grouping smarter, not by shrinking better.** The font must never change size between captions; the *word count per caption* is what adapts.
- **Safe zones are schematic** (drawn shapes + labels, correct geometry), not platform logo assets — no trademark files in the repo.

## File map

| File | Responsibility |
|---|---|
| `cep-panel-ae/client/src/caption-model.js` | width-aware `groupWords`, orphan merge, new EASINGS (`expo_out`, `back_out`), vertical clamp helper |
| `cep-panel-ae/client/src/captions-view.js` | box overlay drag UI, safe-zone toggle, editable word times, "Pull timings from AE" button, preset defaults |
| `cep-panel-ae/client/src/safe-zones.js` | NEW — data table + draw functions for TikTok/Reels/Shorts chrome |
| `cep-panel-ae/extendscript/index.jsx` | word markers, marker-driven expressions, per-word animators for all presets, `ef_readCaptionTimings`, pill glyph height |
| `tests/caption-model.test.js` | width grouping, merge rule, new easings, clamp |
| `tests/jsx-expressions.test.js` | marker expr fallback, per-preset expr ramps, ES3 guard |
| `tests/unit/test_subtitles_transcribe_mixdown.py` | whisperx-installed live marker (skip-if-absent) |
| `docs/ae-captions-runbook.md` | new steps: drag-a-marker retime, box drag, safe zones, preset parity |

---

## Phase 1 — Timing you can drag

### Task 1.1: Install WhisperX (kills most of the drift at the source)

- [ ] **Step 1:** On the machine that transcribes: `.venv\Scripts\pip install whisperx` (torch CPU wheel is pulled automatically; expect several minutes).
- [ ] **Step 2:** Verify: `.venv\Scripts\python -c "import whisperx; print('ok')"` → `ok`. If install fails on this machine, record why in the commit and stop this task — the engine toggle already falls back safely.
- [ ] **Step 3:** Live check (backend running): `curl -F "file=@tests/fixtures/ae/caption-smoke.wav" -F "sequence_name=wx" -F "engine=whisperx" http://127.0.0.1:8765/api/subtitles/transcribe-mixdown` → response `"engine":"whisperx"`.
- [ ] **Step 4:** Add a guarded pytest to `tests/unit/test_subtitles_transcribe_mixdown.py`:

```python
def test_whisperx_importable_or_documented():
    """Phase 1 requires forced alignment. If this skips, word timing runs
    on plain Whisper (~200-300ms error) — the #1 'captions don't match
    the voice' cause. Keep it visible, not silent."""
    pytest.importorskip("whisperx", reason="whisperx not installed — timing accuracy degraded")
```

- [ ] **Step 5:** Commit `chore(subtitles): whisperx installed + visibility test`.

### Task 1.2: One marker per word on every caption layer (jsx)

**Files:** Modify `cep-panel-ae/extendscript/index.jsx` (`ef_buildCaptionLayer`), test via `tests/jsx-expressions.test.js`.

- [ ] **Step 1:** In `ef_buildCaptionLayer`, after `layer.inPoint/outPoint` are set, add:

```js
    // One draggable marker per word — the expression reads marker times,
    // so nudging a marker retimes that word live (A1).
    try {
        var mk = layer.property("Marker");
        for (var mi = 0; mi < g.words.length; mi++) {
            var mv = new MarkerValue(String(g.words[mi].text));
            mk.setValueAtTime(g.words[mi].start, mv);
        }
    } catch (eMk) {}
```

- [ ] **Step 2:** Sandbox stub: the vm test context has no `MarkerValue`; add `MarkerValue: function (s) { this.comment = s; }` to the sandbox in `tests/jsx-expressions.test.js` if loading fails, and assert `ef_buildCaptionLayer` still parses (existing suite is the gate).
- [ ] **Step 3:** Commit `feat(ae): word markers on caption layers`.

### Task 1.3: Marker-driven word progress expression (with baked fallback)

**Files:** Modify `index.jsx` (`ef_wordProgressExpr`), `tests/jsx-expressions.test.js`.

- [ ] **Step 1: Failing tests** — extend the expression eval harness with a mocked `thisLayer.marker`:

```js
function evalMarkerExpr(expr, { time, textIndex, inPoint, markerTimes }) {
  const marker = {
    numKeys: markerTimes.length,
    key: (i) => ({ time: markerTimes[i - 1] }),
  };
  const r = vm.runInNewContext(expr, { time, textIndex, textTotal: 99, thisLayer: { inPoint, marker } });
  return Array.from(r);
}

test('marker times override baked times (dragged marker retimes the word)', () => {
  const expr = sandbox.ef_wordProgressExpr([0, 0.4, 0.9], 0.3, 'ease_out');
  // word 2 baked at inPoint+0.4, but its marker was DRAGGED to 12.0
  const a = evalMarkerExpr(expr, { time: 12.1, textIndex: 2, inPoint: 10, markerTimes: [10, 12.0, 10.9] });
  assert.ok(a[0] > 0 && a[0] < 100, 'mid-fade at dragged time, got ' + a[0]);
  const b = evalMarkerExpr(expr, { time: 10.5, textIndex: 2, inPoint: 10, markerTimes: [10, 12.0, 10.9] });
  assert.deepEqual(b, [100, 100, 100], 'not started before dragged marker');
});

test('missing/short markers fall back to baked times', () => {
  const expr = sandbox.ef_wordProgressExpr([0, 0.4, 0.9], 0.3, 'ease_out');
  const a = evalMarkerExpr(expr, { time: 10.75, textIndex: 2, inPoint: 10, markerTimes: [] });
  assert.deepEqual(a, [0, 0, 0], 'fully entered per baked time');
});
```

- [ ] **Step 2:** Run `node --test tests/jsx-expressions.test.js` → FAIL (expression ignores markers).
- [ ] **Step 3:** Rewrite the generated expression (ES3-safe, scalar math unchanged):

```js
function ef_wordProgressExpr(relTimes, dur, easing) {
    var ts = [];
    for (var i = 0; i < relTimes.length; i++) ts.push(Math.round(relTimes[i] * 1000) / 1000);
    var easeBody = ef_easeBody(easing);   // extracted in Task 5.2; until then inline as today
    return "var ts=[" + ts.join(",") + "];" +
        "var i=textIndex-1;if(i>=ts.length)i=ts.length-1;if(i<0)i=0;" +
        "var t0=thisLayer.inPoint+ts[i];" +
        "if(thisLayer.marker.numKeys>=textIndex){t0=thisLayer.marker.key(textIndex).time;}" +
        "var p=(time-t0)/" + (dur || 0.3) + ";" +
        "if(p<0)p=0;if(p>1)p=1;var e;" + easeBody +
        "var a=(1-e)*100;[a,a,a];";
}
```

- [ ] **Step 4:** Tests PASS; whole suite green. Commit `feat(ae): marker-driven word timing — drag a marker, retime a word`.
- [ ] **Step 5 (bridge evidence):** generate the smoke caption → `ef_dumpLayers` shows markers; move marker 2 via `POST /api/ae-bridge/eval {"fn":"ef_nudgeMarkerForTest","args":[...]}`? NO — keep it manual+visual: render frames at old vs new marker time after dragging in AE (runbook step). Record "not yet AE-verified" until run.

### Task 1.4: Editable word times in the Content tab

**Files:** Modify `captions-view.js` (`_renderWordRow`, wiring in `_wireTabContent`).

- [ ] **Step 1:** Replace the read-only time span with a step input:

```js
function _renderWordRow(w, i) {
  const start = w.start || 0;
  const text = w.word || w.text || '';
  const isPill = !!w.pill;
  return `<div class="cap-word-row ${isPill ? 'pill-active' : ''}" data-idx="${i}">
    <input type="number" class="cap-word-time-input" data-idx="${i}" value="${start.toFixed(2)}" step="0.05" min="0" title="Word start (seconds) — ±0.05s per click" />
    <input type="text" class="cap-word-input" data-idx="${i}" value="${_esc(text)}" />
    <button class="cap-word-pill-btn ${isPill ? 'active' : ''}" data-idx="${i}" title="Toggle pill background">${isPill ? '💊' : '🔲'}</button>
  </div>`;
}
```

- [ ] **Step 2:** Wire `oninput`: parse float, set `S.words[idx].start` (and shift `.end` to keep duration), keep list sorted only on blur (avoid row jumps mid-typing), then `_refreshSummary(); _updatePreview();`.
- [ ] **Step 3:** Browser-rig check: paste transcript → edit a time → preview word moves. Commit `feat(captions): editable word start times`.

### Task 1.5: Read timings back from AE (regeneration keeps your edits)

**Files:** Modify `index.jsx` (new `ef_readCaptionTimings`), `captions-view.js` (button in Generate tab).

- [ ] **Step 1:** jsx:

```js
/* Read manual edits back: for each EF_CAPTION text layer, its in/out and
   its word markers. The panel maps these onto S.words so the NEXT
   generate doesn't wipe hand-tuned timing (A8). */
function ef_readCaptionTimings() {
    try {
        var comp = ef_getComp();
        if (!comp) return ef_err("No comp");
        var out = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            if (L.comment !== EF_TAG) continue;
            var d = { name: String(L.name), inPoint: L.inPoint, outPoint: L.outPoint, words: [] };
            try {
                var mk = L.property("Marker");
                for (var k = 1; k <= mk.numKeys; k++) {
                    d.words.push({ text: String(mk.keyValue(k).comment), time: mk.keyTime(k) });
                }
            } catch (e1) {}
            out.push(d);
        }
        return ef_json({ captions: out });
    } catch (e) { return ef_err("readCaptionTimings: " + e.toString()); }
}
```

- [ ] **Step 2:** Panel: "⬇ Pull timings from AE" button (Generate tab, next to Generate). Handler: `callExtendScript('ef_readCaptionTimings')` → match markers to `S.words` in order by text within each caption (first-unconsumed-match; mismatches logged and skipped) → update `word.start` (shift `.end` by same delta) → `_refreshContentList(); _updatePreview();` → status "Pulled N word timings".
- [ ] **Step 3:** Node test (vm): `ef_readCaptionTimings` exists; matching helper `matchTimingsToWords(words, captions)` lives in caption-model.js (pure) with tests: in-order match, duplicate words match sequentially, missing marker leaves word untouched.
- [ ] **Step 4:** Commit `feat(captions): pull hand-tuned timings back from AE before regenerate`.

## Phase 2 — One font size, always

### Task 2.1: Width-aware grouping (TDD)

**Files:** Modify `caption-model.js` (`groupWords`), `captions-view.js` (`_groupWordsForPreview` passes measurer), `tests/caption-model.test.js`.

- [ ] **Step 1: Failing tests**

```js
test('width mode: doubling font size halves words per caption (no shrink ever)', () => {
  const words = Array.from({ length: 12 }, (_, i) => ({ word: 'hello', start: i * 0.4, end: i * 0.4 + 0.3 }));
  const base = { maxWordsPerSegment: 8, maxDurationPerSegment: 99, maxGap: 99, maxLinesPerSegment: 2, spacePx: 10 };
  const small = M.groupWords(words, { ...base, maxWidthPx: 400, measure: (t) => t.length * 10 });   // ~6 per line
  const big   = M.groupWords(words, { ...base, maxWidthPx: 400, measure: (t) => t.length * 20 });   // ~3 per line
  const maxSmall = Math.max(...small.map((g) => g.words.length));
  const maxBig = Math.max(...big.map((g) => g.words.length));
  assert.ok(maxBig < maxSmall, `expected fewer words at big font: ${maxBig} vs ${maxSmall}`);
});

test('width mode caps a group at what maxLines can hold', () => {
  const words = Array.from({ length: 10 }, (_, i) => ({ word: 'abcdefgh', start: i * 0.3, end: i * 0.3 + 0.2 }));
  const groups = M.groupWords(words, { maxWordsPerSegment: 99, maxDurationPerSegment: 99, maxGap: 99,
    maxLinesPerSegment: 2, maxWidthPx: 200, measure: (t) => t.length * 10, spacePx: 10 });
  for (const g of groups) {
    const lines = M.wrapLines(g, { maxLinesPerSegment: 2, maxWidthPx: 200, measure: (t) => t.length * 10, spacePx: 10 });
    assert.ok(lines.length <= 2);
    for (const ln of lines) assert.ok((ln.text.length * 10 + (ln.text.split(' ').length - 1) * 10) <= 200 + 80,
      'line near box width, never far past it');
  }
});

test('char mode unchanged when no measure provided (back-compat)', () => {
  const words = [{ word: 'a', start: 0, end: 1 }, { word: 'b', start: 1, end: 2 }];
  assert.equal(M.groupWords(words, { maxWordsPerSegment: 4 }).length, 1);
});
```

- [ ] **Step 2:** Run → FAIL (groupWords ignores measure).
- [ ] **Step 3:** Implement inside `groupWords`: when `opts.measure && opts.maxWidthPx > 0`, replace the char-budget break with a **line-capacity break** — track `lineCount` and `lineWidth` incrementally (same greedy rule as `wrapLines`); adding a word that would need line `maxLines+1` breaks the group:

```js
  // width mode: simulate the wrap as words arrive; break when the word
  // would open line maxLines+1. This is what keeps font size CONSTANT:
  // words-per-caption adapts to the box, never the glyph size (A2).
  let lineCount = 1, lineWidth = 0;
  const fits = (w) => {
    const wpx = opts.measure(w);
    const withWord = lineWidth === 0 ? wpx : lineWidth + (opts.spacePx || 0) + wpx;
    if (withWord <= opts.maxWidthPx) { lineWidth = withWord; return true; }
    if (lineCount < maxLines) { lineCount += 1; lineWidth = wpx; return true; }
    return false;
  };
```

  (Reset `lineCount/lineWidth` whenever a group closes for any reason. Sentence-end, gap, dur, maxWords rules unchanged.)
- [ ] **Step 4:** `captions-view.js` `_groupWordsForPreview` passes `maxWidthPx: compW * S.boxWidthPct / 100, measure: _measureCompPx, spacePx: S.fontSize * LAYOUT.wordGapEm, maxLinesPerSegment: S.maxLinesPerSegment` (reuse the exact objects `_wrapForBox` builds — extract a shared `_boxOpts()` helper so grouping and wrapping can never disagree).
- [ ] **Step 5:** Tests PASS; browser-rig: set font 120 on 9:16 → captions carry fewer words, ALL the same glyph size, shrink never fires (assert via the ink probe: band heights equal across captions). Commit `fix(captions): width-aware grouping — font size is constant, word count adapts`.

### Task 2.2: Vertical clamp + shrink demoted to emergency-only

**Files:** Modify `caption-model.js` (new `clampBlockY`), `captions-view.js` (`_drawCaption`), `index.jsx` (`ef_buildCaptionLayer` position), tests.

- [ ] **Step 1: Failing test**

```js
test('clampBlockY keeps a 2-line block inside the bottom margin', () => {
  // comp 1920 tall, 2 lines of 96px leading, center requested at 95%
  const y = M.clampBlockY({ requestedY: 1824, compH: 1920, nLines: 2, lineHeight: 96, marginPct: 0.03 });
  assert.ok(y + (2 - 1) / 2 * 96 + 96 / 2 <= 1920 * 0.97 + 0.001);
  // and an unconstrained request passes through
  assert.equal(M.clampBlockY({ requestedY: 960, compH: 1920, nLines: 1, lineHeight: 96, marginPct: 0.03 }), 960);
});
```

- [ ] **Step 2:** Implement:

```js
export function clampBlockY({ requestedY, compH, nLines, lineHeight, marginPct = 0.03 }) {
  const half = ((nLines - 1) / 2) * lineHeight + lineHeight / 2;
  const lo = compH * marginPct + half;
  const hi = compH * (1 - marginPct) - half;
  return Math.min(hi, Math.max(lo, requestedY));
}
```

- [ ] **Step 3:** Use it in `_drawCaption` (`blockCy`) and mirror the same formula in `ef_buildCaptionLayer`'s Position Y (jsx keeps its own 6-line ES3 copy with a comment naming `clampBlockY` as the source of truth). The `fit` shrink stays but now only fires when a SINGLE WORD is wider than the box.
- [ ] **Step 4:** Commit `fix(captions): vertical clamp — captions never clip the comp edge`.

### Task 2.3: Orphan-caption merge (the lonely "Yes." rule)

**Files:** Modify `caption-model.js` (`groupWords` post-pass), `captions-view.js` (setting), tests.

- [ ] **Step 1: Failing test**

```js
test('a 1-word, short, adjacent caption merges into its neighbor', () => {
  const words = [
    { word: 'Great', start: 0, end: 0.4 }, { word: 'work.', start: 0.45, end: 0.8 },
    { word: 'Yes.', start: 1.0, end: 1.3 },      // orphan: 1 word, short, close
    { word: 'Moving', start: 2.6, end: 3.0 }, { word: 'on.', start: 3.05, end: 3.4 },
  ];
  const groups = M.groupWords(words, { maxWordsPerSegment: 4, mergeOrphans: true });
  assert.equal(groups.length, 2);
  assert.match(groups[0].text, /Yes\.$/);
});

test('orphans stay separate when the gap is large or merging overflows the box', () => {
  const words = [
    { word: 'Hello', start: 0, end: 0.4 },
    { word: 'Yes.', start: 3.0, end: 3.3 },      // 2.6s gap — a real beat, keep it
  ];
  assert.equal(M.groupWords(words, { maxWordsPerSegment: 4, mergeOrphans: true }).length, 2);
});
```

- [ ] **Step 2:** Implement post-pass in `groupWords` (runs when `opts.mergeOrphans`): a group merges backward into the previous group when ALL of: `words.length === 1`, `duration < 0.6s`, gap to previous end `< 0.6s`, and the merged group still satisfies the active width/char budget (re-check with the same `fits` logic). Never merge across a sentence gap > maxGap.
- [ ] **Step 3:** Panel setting "Merge tiny captions" (checkbox, default ON, persisted `mergeOrphans` in SETTINGS_KEYS; passed by `_groupWordsForPreview`).
- [ ] **Step 4:** Commit `feat(captions): merge orphan one-word captions into their sentence`.

## Phase 3 — A box you can grab

### Task 3.1: Draggable caption box overlay in the preview

**Files:** Modify `captions-view.js` (`_renderPreviewSection` toggle btn, `_drawCaption`/`_updatePreview` overlay draw, `_wirePreview` pointer logic).

- [ ] **Step 1:** Add a 🔲 toggle button next to the preview play controls (`id="cap-box-toggle"`, persisted `S._showBox` session-only, default ON while dragging settings, OFF during playback).
- [ ] **Step 2:** Draw the overlay at the END of `_updatePreview` when `S._showBox`:

```js
function _drawBoxOverlay(ctx, w, h) {
  const bw = w * (S.boxWidthPct / 100);
  const cx = w * (S.posX / 100), cy = h * (S.posY / 100);
  const bh = S.maxLinesPerSegment * S.fontSize * LAYOUT.lineHeightEm * (w / _compW());
  ctx.save();
  ctx.strokeStyle = 'rgba(91,141,239,.9)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.setLineDash([]);
  for (const hx of [cx - bw / 2, cx + bw / 2]) {          // side handles
    ctx.fillStyle = '#5b8def'; ctx.fillRect(hx - 4, cy - 12, 8, 24);
  }
  ctx.restore();
}
```

  (`_compW()` = the existing `(S.compInfo && S.compInfo.width) || 1920`, extracted once.)
- [ ] **Step 3:** Pointer logic in `_wirePreview` (canvas `pointerdown/move/up`): hit-test the two side handles (±8px) → drag sets `S.boxWidthPct = clamp(60..100, 2*|x-cx|/w*100)`; hit inside the rect → drag moves `S.posX/S.posY` (clamped 5..95); all drags call `_updatePreview()` live and `_persistSettings()` on pointerup. The existing bottom-40px resize-bar drag keeps priority (check its zone first).
- [ ] **Step 4:** Browser-rig verify with the ink probe: drag box narrower → captions re-wrap inside it; drag box up → captions move. Screenshot/dataURL evidence. Commit `feat(captions): draggable caption box — move it, resize it, captions obey`.

## Phase 4 — Platform frame preview (9:16)

### Task 4.1: Safe-zone module (data + drawing, TDD on data)

**Files:** Create `cep-panel-ae/client/src/safe-zones.js`, extend `tests/caption-model.test.js` (pure data tests).

- [ ] **Step 1:** Module (schematic chrome, fractions of comp W/H; sourced from published creator safe-area guides — geometry only, no logos):

```js
/* Safe-zone chrome for 9:16 platforms. All rects are fractions {x,y,w,h}
   of the comp. "unsafe" = platform UI likely covers it. Schematic shapes
   only — no platform assets. */
export const SAFE_ZONES = {
  tiktok: {
    label: 'TikTok',
    unsafe: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.06, tag: 'status/search' },
      { x: 0.80, y: 0.32, w: 0.20, h: 0.42, tag: 'like/comment/share rail' },
      { x: 0.00, y: 0.74, w: 0.80, h: 0.16, tag: 'caption + username' },
      { x: 0.00, y: 0.90, w: 1.00, h: 0.10, tag: 'nav bar' },
    ],
  },
  reels: {
    label: 'IG Reels',
    unsafe: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.08, tag: 'top bar' },
      { x: 0.82, y: 0.36, w: 0.18, h: 0.38, tag: 'action rail' },
      { x: 0.00, y: 0.78, w: 0.82, h: 0.14, tag: 'caption + audio' },
      { x: 0.00, y: 0.92, w: 1.00, h: 0.08, tag: 'nav' },
    ],
  },
  shorts: {
    label: 'YT Shorts',
    unsafe: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.07, tag: 'top bar' },
      { x: 0.84, y: 0.40, w: 0.16, h: 0.36, tag: 'action rail' },
      { x: 0.00, y: 0.80, w: 0.84, h: 0.12, tag: 'title + channel' },
      { x: 0.00, y: 0.92, w: 1.00, h: 0.08, tag: 'nav' },
    ],
  },
};

export function boxIntersectsUnsafe(zoneKey, box) {
  const z = SAFE_ZONES[zoneKey];
  if (!z) return [];
  return z.unsafe.filter((r) =>
    box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y);
}
```

- [ ] **Step 2: Tests** (pure): every zone's rects are within [0,1]; `boxIntersectsUnsafe('tiktok', {x:.1,y:.75,w:.5,h:.1})` names the caption zone; a centered mid-frame box returns `[]` for all three platforms.
- [ ] **Step 3:** Commit `feat(preview): platform safe-zone data + intersection check`.

### Task 4.2: Overlay toggle + warning in the preview

**Files:** Modify `captions-view.js` (header segmented control, draw pass, warning).

- [ ] **Step 1:** Segmented control in the preview controls row — `None | TikTok | Reels | Shorts` (`S.safeZone` persisted; shown only when comp is portrait: `_compH() > _compW()`).
- [ ] **Step 2:** Draw pass after captions, before the box overlay: dim each unsafe rect (`rgba(0,0,0,.45)`), 1px outline, tag label at 9px; draw schematic glyphs (circle+heart outline in the rail rects, two text lines in the caption rect) so the eye reads it as a phone UI.
- [ ] **Step 3:** Warning: compute the caption box as fractions; if `boxIntersectsUnsafe(S.safeZone, box).length`, draw the box overlay amber and show a one-line tip under the preview: `⚠ box overlaps: like/comment rail — drag it left/up`.
- [ ] **Step 4:** Browser-rig on 9:16: toggle each platform, screenshot/dataURL each, verify a low-posY box triggers the warning and dragging clears it. Commit `feat(preview): TikTok/Reels/Shorts frame preview with caption-box warnings`.

## Phase 5 — Motion an editor would sign

### Task 5.1: Per-word animators for popin / bounce / squash / typewriter (closes A6+A7)

**Files:** Modify `index.jsx` (`ef_applyWordAnimators` grows per-preset branches; `useSelector` drops the fadeup_words-only condition), `tests/jsx-expressions.test.js`.

- [ ] **Step 1: Failing tests** — per-preset expression ramps, evaluated like the existing fadeup tests:

```js
test('popin word expr: scale weight settles to 0 by t+0.6 and never NaNs', () => {
  const expr = sandbox.ef_wordScaleSpringExpr([0, 0.4], 1.0);
  for (let t = 9.9; t < 12; t += 0.05) {
    const a = evalMarkerExpr(expr, { time: t, textIndex: 2, inPoint: 10, markerTimes: [] });
    assert.ok(Number.isFinite(a[0]), 'finite at ' + t);
  }
  const settled = evalMarkerExpr(expr, { time: 11.2, textIndex: 2, inPoint: 10, markerTimes: [] });
  assert.ok(Math.abs(settled[0]) < 2, 'settled, got ' + settled[0]);
});

test('typewriter word expr: hard step at the word start (no fade)', () => {
  const expr = sandbox.ef_wordStepExpr([0, 0.4]);
  assert.deepEqual(evalMarkerExpr(expr, { time: 10.39, textIndex: 2, inPoint: 10, markerTimes: [] }), [100, 100, 100]);
  assert.deepEqual(evalMarkerExpr(expr, { time: 10.41, textIndex: 2, inPoint: 10, markerTimes: [] }), [0, 0, 0]);
});
```

- [ ] **Step 2:** Implement in `ef_applyWordAnimators(layer, relTimes, cfg)` — branch on `cfg.preset`:
  - `fadeup_words`: as today (Opacity 0 + Position [0,slide], progress expr).
  - `popin`: Opacity animator (0, step expr dur 0.1) + Scale animator ([-100,-100], `ef_wordScaleSpringExpr` = damped spring weight `(Math.exp(-6*t)*Math.cos(3*2*Math.PI*t))*100` clamped ≥ settle).
  - `bounce`: Opacity (step 0.1) + Position ([0, -160*intensity], `e^(-6t)·cos(2·2πt)` weight expr).
  - `squash`: Opacity (step 0.1) + two Scale animators (X `[dev,0]`, Y `[-dev,0]`, shared squash expr from `ef_squashExpr` formula, per-word timed).
  - `typewriter`: Opacity (0, `ef_wordStepExpr` — pure step at the word time; kills the cps=22 sourceText hack; delete `ef_typewriterExpr` and its call).
  - `fade`/`fadeup`: unchanged caption-level (both sides agree they're caption-level — no lie).
  All selector expressions read markers first via the Task 1.3 pattern (share `ef_markerT0Fragment(relTimes)` string builder so the marker logic exists once).
- [ ] **Step 3:** `ef_createCaptions`: `useSelector = usingPanelGroups && !cfg.forceLegacy && cfg.preset !== 'fade' && cfg.preset !== 'fadeup' && ef_probeExpressionSelector(comp)` (fade/fadeup keep the single-layer caption-level path they already have).
- [ ] **Step 4:** Suite green (all ramps + ES3 token guard). Commit `feat(ae): every word preset now animates per-word in AE — preview parity`.
- [ ] **Step 5 (bridge):** preset sweep via eval, frame at word-2 mid-entry per preset, dumpLayers asserts 2+ animators per layer. Runbook step updated.

### Task 5.2: Pro easing set (model + jsx, one source of truth)

**Files:** Modify `caption-model.js` (EASINGS), `index.jsx` (new `ef_easeBody(easing)` used by every expr builder), `captions-view.js` (easing dropdown options), tests both sides.

- [ ] **Step 1: Failing tests**

```js
test('expo_out: fast start, long settle (80% done by p=0.35)', () => {
  assert.ok(M.EASINGS.expo_out(0.35) > 0.8);
  assert.equal(M.EASINGS.expo_out(1), 1);
});
test('back_out overshoots then lands', () => {
  assert.ok(M.EASINGS.back_out(0.7) > 1, 'overshoot');
  assert.ok(Math.abs(M.EASINGS.back_out(1) - 1) < 1e-9);
});
test('jsx ease bodies match the model at 20 sample points', () => {
  for (const name of ['expo_out', 'back_out', 'ease_out', 'ease_in_out']) {
    const body = sandbox.ef_easeBody(name);
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const e = vm.runInNewContext('var e;var p=' + p + ';' + body + 'e;', {});
      assert.ok(Math.abs(e - M.EASINGS[name](Math.min(p, 1))) < 1e-6, name + ' @ ' + p);
    }
  }
});
```

- [ ] **Step 2:** Implement:

```js
// caption-model.js additions
expo_out: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
back_out: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
```

```js
// index.jsx — single ease-body source used by ALL expression builders
function ef_easeBody(easing) {
    if (easing === "ease_out") return "e=1-Math.pow(1-p,3);";
    if (easing === "ease_in") return "e=p*p*p;";
    if (easing === "ease_in_out") return "e=(p<0.5)?4*p*p*p:1-Math.pow(-2*p+2,3)/2;";
    if (easing === "expo_out") return "e=(p>=1)?1:1-Math.pow(2,-10*p);";
    if (easing === "back_out") return "var c1=1.70158;var c3=c1+1;e=1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);";
    return "e=p;";
}
```

  Refactor `ef_wordProgressExpr`, `ef_wordFadeUpOpExpr`, `ef_wordFadeUpPosExpr`, `ef_buildFadeUpOp/Pos`, `ef_buildPillScale` to call it (delete their per-function ladders).
- [ ] **Step 3:** Panel easing dropdown gains `Expo Out (snappy)` and `Back Out (overshoot)`; **new tuned defaults**: `wordEasing: 'expo_out'`, `fadeDur: 0.28`, `slideDist: 28` (the 0.3/40 look floaty at 30fps — note in commit).
- [ ] **Step 4:** Tests PASS both sides. Commit `feat(captions): pro easing set (expo/back) shared model↔jsx + tuned defaults`.

### Task 5.3: Pill height from the real glyph box (A11, small)

**Files:** Modify `index.jsx` (`ef_measureWordSpans` also records per-line rect height; `ef_addPillsToCaption` uses it), node test on `ef_pillSpanMath` unchanged.

- [ ] **Step 1:** In `ef_measureWordSpans`, when measuring each full line, also store `lineHeights.push(temp.sourceRectAtTime(0,false).height)`; return it.
- [ ] **Step 2:** `ef_addPillsToCaption`: `var pillH = (meas.lineHeights[li] || (cfg.fontSize||80)) * fit + padY * 2;` (per-line, replacing the fontSize guess).
- [ ] **Step 3:** Commit `fix(ae): pill height from measured glyph box`.

### Task 5.4: Preview parity for the new motion

**Files:** Modify `caption-model.js` (`wordAnim` popin uses the same settle clamp; typewriter unchanged), `captions-view.js` nothing (already per-word).

- [ ] **Step 1:** Sync `wordAnim`'s popin/bounce formulas to exactly the Task 5.1 expressions (same constants) and add `expo_out/back_out` to the preview path automatically via EASINGS. Node test: sample `wordAnim('popin', …)` scale at t=start+0.6 ≈ 1 ± 0.02.
- [ ] **Step 2:** Commit `fix(captions): preview motion matches the new AE animators exactly`.

### Task 5.5 (optional, last): "Bake for graph editor"

**Files:** Modify `index.jsx` (new `ef_bakeCaptionKeyframes`), `captions-view.js` (button + confirm note).

- [ ] **Step 1:** jsx: for a selected (or all) EF_CAPTION layer, replace expression selectors with per-word Range-selector animators — for word i: animator with `ADBE Text Selector`, Units=Index, Start=i-1, End=i, and **keyframed** animator Opacity (0→100) + Position ([0,slide]→[0,0]) at `markerTime → markerTime+fadeDur`, then `setTemporalEaseAtKey(2, [new KeyframeEase(0, 66)])` for an eased land. Remove the expression selectors afterward.
- [ ] **Step 2:** Panel button "🎛 Bake keyframes (advanced)" with inline note: *"Converts captions to editable keyframes for the graph editor. One-way: Generate will replace baked layers."*
- [ ] **Step 3:** Bridge evidence: dumpLayers shows N animators with keyframed properties; frame renders unchanged at 3 sampled times vs pre-bake. Commit `feat(ae): bake captions to graph-editor keyframes (one-way)`.

## Phase 6 — Runbook + verification sweep

### Task 6.1: Runbook additions + full-suite gate

- [ ] **Step 1:** `docs/ae-captions-runbook.md` new steps: (11) drag word marker → word retimes on next frame; (12) Pull timings from AE → panel times update → Generate → timing preserved; (13) drag the caption box narrower → regenerate → AE matches; (14) safe-zone toggle matches where TikTok UI actually sits on a test upload; (15) preset sweep now per-word for popin/bounce/squash/typewriter.
- [ ] **Step 2:** Full gate: `node --test tests/*.test.js` and `python -m pytest tests/unit -q` green; bridge health + one end-to-end generate on the smoke comp with dumpLayers + 3 frames attached to the final commit message.
- [ ] **Step 3:** Commit `docs(ae): runbook for draggable timing, box, safe zones, motion parity`.

---

## Self-review

- **Coverage vs user complaints:** timing mismatch + hard-to-edit → 1.1–1.5 (drag markers, editable panel times, read-back); font size → 2.1–2.3; "real box" → 3.1; platform frame button → 4.1–4.2; professional animation/curves → 5.1–5.5; "audit other problems" → table A1–A12, each mapped. ✓
- **Placeholders:** none — every code step carries the code; Task 1.3 Step 5 explicitly rejects inventing a test-only jsx helper. ✓
- **Name consistency:** `ef_easeBody`, `ef_wordScaleSpringExpr`, `ef_wordStepExpr`, `ef_readCaptionTimings`, `ef_bakeCaptionKeyframes`, `clampBlockY`, `matchTimingsToWords`, `SAFE_ZONES`, `boxIntersectsUnsafe`, `_boxOpts`, `S.safeZone`, `mergeOrphans` — used identically wherever referenced. ✓
- **Order rationale:** WhisperX first (data quality), markers before read-back, grouping before box UI (box drag re-wraps live), motion last (touches most presets), bake truly last (one-way).
- **Risks:** marker `.key(i).time` indexing assumes markers stay in word order after dragging — AE re-sorts marker keys by time, so a word dragged PAST its neighbor swaps indexes; runbook step 11 checks this and the expression's clamp keeps it non-crashing (documented limitation: don't drag a word past another word, retime the neighbor too). WhisperX install weight on the AE PC. `KeyframeEase` API shape verified against `docs/adobe/scripting-guide/docs/other/keyframeease.md` before Task 5.5 starts.
