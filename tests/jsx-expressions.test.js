/* Eval-based verification of index.jsx expression builders.
   Loading the whole jsx in a vm sandbox is also the ES3/ES5 syntax gate:
   its top level only declares vars/functions, so it parses and runs with
   no AE globals. Generated expressions are then evaluated with mocked
   time/textIndex/thisLayer to assert the per-word animation ramps. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const JSX_PATH = path.resolve(__dirname, '..', 'cep-panel-ae', 'extendscript', 'index.jsx');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(JSX_PATH, 'utf8'), sandbox, { filename: 'index.jsx' });

/* Mock AE's layer.marker property. markerTimes=[] means "no markers" —
   the expression must then fall back to its baked times. */
function _markerStub(markerTimes) {
  return { numKeys: markerTimes.length, key: (i) => ({ time: markerTimes[i - 1] }) };
}

function evalExpr(expr, { time, textIndex, inPoint, markerTimes = [] }) {
  const r = vm.runInNewContext(expr, {
    time, textIndex, textTotal: 99,
    thisLayer: { inPoint, marker: _markerStub(markerTimes) },
  });
  return Array.from(r);   // vm realm arrays fail host deepStrictEqual prototype checks
}

const evalMarkerExpr = evalExpr;   // same harness; named for marker-focused tests

/* ── jsx parses + builders exist ── */
test('index.jsx defines the single-layer engine builders', () => {
  for (const fn of ['ef_probeExpressionSelector', 'ef_wordProgressExpr', 'ef_applyWordAnimators',
    'ef_buildCaptionLayer', 'ef_groupHasPill', 'ef_setGroupTiming']) {
    assert.equal(typeof sandbox[fn], 'function', fn);
  }
});

/* ── word progress expression ── */
const EXPR = () => sandbox.ef_wordProgressExpr([0, 0.4, 0.9], 0.3, 'ease_out');

test('word not yet started → amount 100 (animator fully applied = hidden)', () => {
  const a = evalExpr(EXPR(), { time: 10.39, textIndex: 2, inPoint: 10 });
  assert.deepEqual(a, [100, 100, 100]);
});

test('word fully entered → amount 0 (visible, in place)', () => {
  const a = evalExpr(EXPR(), { time: 10.7, textIndex: 2, inPoint: 10 });
  assert.deepEqual(a, [0, 0, 0]);
});

test('mid-fade → amount strictly between 0 and 100', () => {
  const a = evalExpr(EXPR(), { time: 10.55, textIndex: 2, inPoint: 10 });
  assert.ok(a[0] > 0 && a[0] < 100, String(a[0]));
});

test('later word untouched while word 2 animates', () => {
  const a = evalExpr(EXPR(), { time: 10.55, textIndex: 3, inPoint: 10 });
  assert.deepEqual(a, [100, 100, 100]);
});

test('textIndex out of range clamps instead of erroring', () => {
  assert.deepEqual(evalExpr(EXPR(), { time: 20, textIndex: 50, inPoint: 10 }), [0, 0, 0]);
  assert.deepEqual(evalExpr(EXPR(), { time: 20, textIndex: 0, inPoint: 10 }), [0, 0, 0]);
});

test('expression is finite across a time sweep (no NaN)', () => {
  for (let t = 9.8; t <= 12.5; t += 0.07) {
    for (const idx of [1, 2, 3]) {
      const a = evalExpr(EXPR(), { time: t, textIndex: idx, inPoint: 10 });
      assert.ok(Number.isFinite(a[0]), `t=${t} idx=${idx}`);
    }
  }
});

test('generated expressions contain no ES5+ tokens (legacy expression engine)', () => {
  for (const easing of ['linear', 'ease_in', 'ease_out', 'ease_in_out']) {
    const e = sandbox.ef_wordProgressExpr([0, 0.5], 0.3, easing);
    for (const tok of ['=>', 'let ', 'const ', '.map(']) {
      assert.ok(!e.includes(tok), `${easing} contains ${tok}`);
    }
  }
});

/* ── legacy grouping parity ── */
test('ef_groupWords breaks on urdu sentence end', () => {
  const w = (text, start, end) => ({ text, start, end });
  const g = sandbox.ef_groupWords(
    [w('ٹھیک۔', 0, 0.3), w('اگلا', 0.35, 0.6)],
    { maxWordsPerSegment: 8, maxCharsPerSegment: 60, maxDurationPerSegment: 5, maxGap: 1 }
  );
  assert.equal(g.length, 2);
});

/* ── group timing ── */
test('ef_setGroupTiming uses exact tIn/tOut from panel groups', () => {
  const layer = {};
  sandbox.ef_setGroupTiming(layer, { start: 1, end: 2, tIn: 1, tOut: 2.6 }, 2.4);
  assert.equal(layer.inPoint, 1);
  assert.equal(layer.outPoint, 2.6);
});

test('ef_setGroupTiming falls back to capped 50ms-gap rule without tIn/tOut', () => {
  const layer = {};
  sandbox.ef_setGroupTiming(layer, { start: 1, end: 2 }, 2.2);
  assert.equal(layer.inPoint, 1);
  assert.ok(Math.abs(layer.outPoint - 2.15) < 1e-9, String(layer.outPoint));
});

/* ── pill span math (pure geometry for single-layer pills) ── */
test('ef_pillSpanMath places word spans inside centered lines', () => {
  // Two lines: "AA BB" (width 100) and "CC" (width 40), centered on x=500.
  const lines = [{ startIdx: 0, endIdx: 1 }, { startIdx: 2, endIdx: 2 }];
  const meas = { lineWidths: [100, 40], prefixW: [45, 100, 40], selfW: [45, 50, 40] };
  const spans = sandbox.ef_pillSpanMath(lines, meas, {
    centerX: 500, centerY: 800, fontSize: 80, shrink: 1,
  });
  // line 1 left edge = 450; word0 right = 450+45; word1 = [500, 550]
  assert.equal(spans[0].left, 450);
  assert.equal(spans[0].right, 495);
  assert.equal(spans[1].left, 500);
  assert.equal(spans[1].right, 550);
  // line 2 centered: [480, 520]; below line 1 by 1.2em (96px): y=800±48
  assert.equal(spans[2].left, 480);
  assert.equal(spans[2].right, 520);
  assert.equal(spans[0].y, 800 - 48);
  assert.equal(spans[2].y, 800 + 48);
});

test('ef_pillSpanMath shrink scales spans about the block center', () => {
  const lines = [{ startIdx: 0, endIdx: 0 }];
  const meas = { lineWidths: [200], prefixW: [200], selfW: [200] };
  const full = sandbox.ef_pillSpanMath(lines, meas, { centerX: 500, centerY: 800, fontSize: 80, shrink: 1 });
  const half = sandbox.ef_pillSpanMath(lines, meas, { centerX: 500, centerY: 800, fontSize: 80, shrink: 0.5 });
  assert.equal(full[0].left, 400);
  assert.equal(half[0].left, 450);   // halfway toward center
  assert.equal(half[0].right, 550);
  assert.equal(half[0].y, 800);      // single line sits on the center
});

test('single-layer pill builders exist (AE-side, exercised via bridge)', () => {
  for (const fn of ['ef_measureWordSpans', 'ef_addPillsToCaption', 'ef_pillSpanMath']) {
    assert.equal(typeof sandbox[fn], 'function', fn);
  }
});

test('agent dev-loop tools exist (AE-side, exercised via bridge)', () => {
  for (const fn of ['ef_dumpLayers', 'ef_renderFrameAt', 'ef_setupTestComp']) {
    assert.equal(typeof sandbox[fn], 'function', fn);
  }
});

/* ── marker-driven timing (drag a marker, retime a word) ── */
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

test('ef_readCaptionTimings exists (read-back path for hand-tuned timing)', () => {
  assert.equal(typeof sandbox.ef_readCaptionTimings, 'function');
});

test('ef_clampBlockY mirrors the model: 2-line block stays inside the comp', () => {
  const cfg = { fontSize: 80 };   // lineHeight 96
  const y = sandbox.ef_clampBlockY(1824, 1920, 2, cfg);
  assert.ok(y + 48 + 48 <= 1920 * 0.97 + 1e-9, `escaped bottom: ${y}`);
  assert.equal(sandbox.ef_clampBlockY(960, 1920, 1, cfg), 960, 'unconstrained passes through');
});

/* ── shared ease bodies: jsx must match the model exactly ── */
test('ef_easeBody matches caption-model EASINGS at 21 sample points', () => {
  const path2 = require('node:path');
  const { loadEsm } = require('./_load-esm');
  const M = loadEsm(path2.resolve(__dirname, '..', 'cep-panel-ae', 'client', 'src', 'caption-model.js'));
  for (const name of ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'expo_out', 'back_out']) {
    const body = sandbox.ef_easeBody(name);
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const e = vm.runInNewContext('var e;var p=' + p + ';' + body + 'e;', {});
      assert.ok(Math.abs(e - M.EASINGS[name](Math.min(p, 1))) < 1e-6,
        `${name} @ p=${p.toFixed(2)}: jsx ${e} vs model ${M.EASINGS[name](p)}`);
    }
  }
});

/* ── per-word presets in AE (was: preview lied, AE animated whole caption) ── */
test('popin word scale expr settles to 0 weight and never NaNs', () => {
  const expr = sandbox.ef_wordScaleSpringExpr([0, 0.4], 1.0);
  for (let t = 9.9; t < 12; t += 0.05) {
    const a = evalMarkerExpr(expr, { time: t, textIndex: 2, inPoint: 10 });
    assert.ok(Number.isFinite(a[0]), 'finite at t=' + t.toFixed(2));
  }
  const settled = evalMarkerExpr(expr, { time: 11.4, textIndex: 2, inPoint: 10 });
  assert.ok(Math.abs(settled[0]) < 2, 'settled, got ' + settled[0]);
  const before = evalMarkerExpr(expr, { time: 10.3, textIndex: 2, inPoint: 10 });
  assert.ok(Math.abs(before[0]) > 50, 'word 2 not started yet at 10.3, got ' + before[0]);
});

test('typewriter word expr is a hard step at the word start (no fade)', () => {
  const expr = sandbox.ef_wordStepExpr([0, 0.4]);
  assert.deepEqual(evalMarkerExpr(expr, { time: 10.39, textIndex: 2, inPoint: 10 }), [100, 100, 100]);
  assert.deepEqual(evalMarkerExpr(expr, { time: 10.41, textIndex: 2, inPoint: 10 }), [0, 0, 0]);
});

test('bounce word expr decays to rest', () => {
  const expr = sandbox.ef_wordBounceExpr([0, 0.4], 1.0);
  const settled = evalMarkerExpr(expr, { time: 11.5, textIndex: 2, inPoint: 10 });
  assert.ok(Math.abs(settled[0]) < 2, 'settled, got ' + settled[0]);
  for (let t = 9.9; t < 12; t += 0.05) {
    assert.ok(Number.isFinite(evalMarkerExpr(expr, { time: t, textIndex: 2, inPoint: 10 })[0]));
  }
});

test('every per-word expr honours dragged markers', () => {
  for (const expr of [sandbox.ef_wordScaleSpringExpr([0, 0.4], 1),
                      sandbox.ef_wordStepExpr([0, 0.4]),
                      sandbox.ef_wordBounceExpr([0, 0.4], 1)]) {
    const notYet = evalMarkerExpr(expr, { time: 10.5, textIndex: 2, inPoint: 10, markerTimes: [10, 12.0] });
    assert.ok(Math.abs(notYet[0]) > 50, 'marker at 12.0 must delay the word: ' + notYet[0]);
  }
});

test('per-word exprs contain no ES5+ tokens', () => {
  for (const expr of [sandbox.ef_wordScaleSpringExpr([0, 0.4], 1),
                      sandbox.ef_wordStepExpr([0, 0.4]),
                      sandbox.ef_wordBounceExpr([0, 0.4], 1)]) {
    for (const tok of ['=>', 'let ', 'const ', '.map(']) {
      assert.ok(!expr.includes(tok), `contains ${tok}`);
    }
  }
});
