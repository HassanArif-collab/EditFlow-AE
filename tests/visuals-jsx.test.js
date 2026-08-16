/* Loads visuals.jsx in a vm sandbox — which is also the ES3 syntax gate,
   since its top level only declares vars and functions. Generated
   expressions are then evaluated with mocked AE globals, so a broken
   count-up or letter ramp fails here instead of in a published video. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const JSX = path.resolve(__dirname, '..', 'cep-panel-ae', 'extendscript', 'visuals.jsx');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(JSX, 'utf8'), sandbox, { filename: 'visuals.jsx' });

/* AE's expression helpers, mocked. easeOut(t, tMin, tMax, v1, v2) */
function aeCtx(extra) {
  return Object.assign({
    easeOut: (t, a, b, v1, v2) => {
      if (t <= a) return v1;
      if (t >= b) return v2;
      const p = (t - a) / (b - a);
      return v1 + (v2 - v1) * (1 - Math.pow(1 - p, 3));
    },
    Math,
  }, extra);
}

test('visuals.jsx parses as ES3 and exposes the builders', () => {
  for (const fn of ['ef_vis_buildShot', 'ef_vis_buildStatCounter', 'ef_vis_buildBarChart',
                    'ef_vis_buildTitleCard', 'ef_vis_buildMaster', 'ef_vis_dumpShot',
                    'ef_vis_renderShot', 'ef_vis_listAll', 'ef_vis_setActive',
                    'ef_vis_deleteVersion', 'ef_vis_clearAll', 'ef_vis_probeEnvironment']) {
    assert.equal(typeof sandbox[fn], 'function', fn);
  }
});

test('the jsx CODE contains no ES5+ tokens (ExtendScript is ES3)', () => {
  // strip comments first — the header documents these forbidden tokens by
  // name, and a naive scan would flag the documentation instead of the code
  const code = fs.readFileSync(JSX, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const tok of ['=>', 'const ', 'let ', '.forEach(', 'JSON.parse', 'toLocaleString']) {
    assert.ok(!code.includes(tok), `visuals.jsx code contains ${tok}`);
  }
});

/* ── count-up expression ── */

const countExpr = () => sandbox.ef_vis_countExpr(8484, 3, 'Rs ', '');

test('the counter starts at 0 — v7 requires counting from zero', () => {
  const out = vm.runInNewContext(countExpr(), aeCtx({ time: 10, inPoint: 10 }));
  assert.equal(out, 'Rs 0');
});

test('the counter lands EXACTLY on the target with separators', () => {
  const out = vm.runInNewContext(countExpr(), aeCtx({ time: 13, inPoint: 10 }));
  assert.equal(out, 'Rs 8,484', 'wrong final number = ruined documentary');
});

test('the counter holds the final value after the count finishes', () => {
  const out = vm.runInNewContext(countExpr(), aeCtx({ time: 20, inPoint: 10 }));
  assert.equal(out, 'Rs 8,484');
});

test('mid-count the value is strictly between 0 and the target', () => {
  const out = vm.runInNewContext(countExpr(), aeCtx({ time: 11, inPoint: 10 }));
  const n = Number(String(out).replace(/[^0-9]/g, ''));
  assert.ok(n > 0 && n < 8484, String(out));
});

test('a billion-scale number groups correctly (three separators)', () => {
  const e = sandbox.ef_vis_countExpr(1500000000, 3, '', '');
  const out = vm.runInNewContext(e, aeCtx({ time: 13, inPoint: 10 }));
  assert.equal(out, '1,500,000,000');
});

test('the count-up expression never yields NaN across its whole range', () => {
  const e = countExpr();
  for (let t = 9.5; t <= 14; t += 0.1) {
    const out = vm.runInNewContext(e, aeCtx({ time: t, inPoint: 10 }));
    assert.ok(!String(out).includes('NaN'), `t=${t.toFixed(1)} → ${out}`);
  }
});

/* ── letter stagger: the title-card rule that matters most ── */

const letterExpr = () => sandbox.ef_vis_letterProgressExpr(0.05, 0.45);

test('letter 1 leads and letter 10 lags — that IS the stagger', () => {
  const e = letterExpr();
  const at = (idx, time) => vm.runInNewContext(e,
    aeCtx({ time, textIndex: idx, thisLayer: { inPoint: 0 } }))[0];
  const first = at(1, 0.3), tenth = at(10, 0.3);
  assert.ok(first < tenth, `letter 1 (${first}) must be further along than letter 10 (${tenth})`);
  assert.ok(tenth > 90, 'a late letter has barely started — not a block fade');
});

test('every letter is fully in once its own ramp completes', () => {
  const e = letterExpr();
  const v = vm.runInNewContext(e, aeCtx({ time: 5, textIndex: 12, thisLayer: { inPoint: 0 } }));
  assert.deepEqual(Array.from(v), [0, 0, 0]);
});

test('nothing has started before the layer begins', () => {
  const e = letterExpr();
  const v = vm.runInNewContext(e, aeCtx({ time: -0.2, textIndex: 1, thisLayer: { inPoint: 0 } }));
  assert.deepEqual(Array.from(v), [100, 100, 100]);
});

test('letter ramp is finite for every letter across the whole card', () => {
  const e = letterExpr();
  for (let idx = 1; idx <= 30; idx++) {
    for (let t = -0.2; t <= 3; t += 0.15) {
      const v = vm.runInNewContext(e, aeCtx({ time: t, textIndex: idx, thisLayer: { inPoint: 0 } }));
      assert.ok(Number.isFinite(v[0]), `idx=${idx} t=${t.toFixed(2)}`);
    }
  }
});

/* ── digit grouping parity with the JS model ── */

test('jsx digit grouping matches the panel model exactly', () => {
  const { loadEsm } = require('./_load-esm');
  const M = loadEsm(path.resolve(__dirname, '..', 'cep-panel-ae', 'client', 'src', 'shotlist-model.js'));
  for (const n of [0, 7, 282, 8484, 40000, 1500000000, -4500]) {
    assert.equal(sandbox.ef_vis_groupDigits(n), M.groupDigits(n), `mismatch at ${n}`);
  }
});

/* ── version naming parity ── */

test('jsx version naming matches the panel model', () => {
  const { loadEsm } = require('./_load-esm');
  const M = loadEsm(path.resolve(__dirname, '..', 'cep-panel-ae', 'client', 'src', 'shotlist-model.js'));
  const cases = [[], ['shot_01 v1'], ['★ shot_01 v2', 'shot_01 v1'], ['shot_01 v3', 'shot_01 v1']];
  for (const names of cases) {
    assert.equal(sandbox.ef_vis_nextVersionName('shot_01', names),
                 M.nextVersionName('shot_01', names), JSON.stringify(names));
  }
});

/* ── Step 3 techniques ──────────────────────────────────────────────
   Every one of these multiplies `value` rather than assuming 100. The
   counter's pulse taught that lesson: it hardcoded [100,100] and silently
   threw away the auto-fit that had just shrunk a long number to fit the
   frame. A technique that resets scale is a technique that un-does the
   recipe underneath it. */

const runExpr = (expr, ctx) => vm.runInNewContext(expr, aeCtx(ctx));

test('PUSH_IN starts at the fitted scale, not at 100', () => {
  // the layer was fitted to 62% to fill the frame; the push must build on it
  const e = sandbox.ef_vis_pushExpr(1.2, 0, 5, 1);
  const at0 = runExpr(e, { time: 10, inPoint: 10, value: [62, 62] });
  assert.equal(at0[0], 62, 'a hardcoded 100 here would pop the frame');
  assert.equal(at0[1], 62);
});

test('PUSH_IN reaches exactly the requested zoom', () => {
  const e = sandbox.ef_vis_pushExpr(1.2, 0, 5, 1);
  const end = runExpr(e, { time: 15, inPoint: 10, value: [100, 100] });
  assert.ok(Math.abs(end[0] - 120) < 0.001, `got ${end[0]}`);
  assert.equal(end[0], end[1], 'uniform — a non-square push distorts the picture');
});

test('PUSH_IN only moves forward', () => {
  const e = sandbox.ef_vis_pushExpr(1.3, 0, 4, 1);
  let prev = 0;
  for (let t = 0; t <= 4; t += 0.5) {
    const s = runExpr(e, { time: 10 + t, inPoint: 10, value: [100, 100] })[0];
    assert.ok(s >= prev - 1e-9, `scale went backwards at t=${t}`);
    prev = s;
  }
});

test('a hold keeps the frame still before the move starts', () => {
  const e = sandbox.ef_vis_pushExpr(1.2, 1.5, 3, 1);
  assert.equal(runExpr(e, { time: 11, inPoint: 10, value: [100, 100] })[0], 100);
  const after = runExpr(e, { time: 14.5, inPoint: 10, value: [100, 100] })[0];
  assert.ok(Math.abs(after - 120) < 0.001, `got ${after}`);
});

test('PARALLAX rates give the foreground more travel than the background', () => {
  // v7: bg 0.5, mid 1.0, fg 1.5 — depth is the difference between them
  const at = (rate) => runExpr(sandbox.ef_vis_pushExpr(1.2, 0, 5, rate),
                               { time: 15, inPoint: 10, value: [100, 100] })[0];
  const bg = at(0.5), mid = at(1.0), fg = at(1.5);
  assert.ok(bg < mid && mid < fg, `${bg} < ${mid} < ${fg}`);
  assert.ok(Math.abs(bg - 110) < 0.001, 'half the zoom');
  assert.ok(Math.abs(fg - 130) < 0.001, 'one and a half times it');
});

test('KEN_BURNS drift starts where the layer was and moves a bounded distance', () => {
  const e = sandbox.ef_vis_driftExpr({ width: 1920, height: 1080 }, 0, 5, 58, -22);
  const start = runExpr(e, { time: 10, inPoint: 10, value: [960, 540] });
  assert.equal(start[0], 960);
  assert.equal(start[1], 540);
  const end = runExpr(e, { time: 15, inPoint: 10, value: [960, 540] });
  assert.ok(Math.abs(end[0] - 1018) < 0.001);
  assert.ok(Math.abs(end[1] - 518) < 0.001);
});

/* ── DUST_DISSOLVE — it means loss, so the letters must actually leave ── */

test('dust holds the text fully solid until its start time', () => {
  const p = sandbox.ef_vis_dustExpr(2, 0.04, 1.0, 8, true);
  const opacity = runExpr(p + '(1-p)*100;', { time: 11, inPoint: 10, textIndex: 1 });
  assert.equal(opacity, 100, 'crumbling before the narration says so is nonsense');
});

test('dust ends with every letter gone', () => {
  const p = sandbox.ef_vis_dustExpr(2, 0.04, 1.0, 8, true);
  for (const textIndex of [1, 4, 8]) {
    const o = runExpr(p + '(1-p)*100;', { time: 20, inPoint: 10, textIndex });
    assert.equal(o, 0, `letter ${textIndex} never left`);
  }
});

test('rtl dissolves the last letter first — deletion order, not reading order', () => {
  const p = sandbox.ef_vis_dustExpr(2, 0.1, 0.6, 8, true);
  const at = (i) => runExpr(p + 'p;', { time: 12.35, inPoint: 10, textIndex: i });
  assert.ok(at(8) > at(1), 'rtl: the end of the number goes first');
});

test('ltr dissolves the first letter first', () => {
  const p = sandbox.ef_vis_dustExpr(2, 0.1, 0.6, 8, false);
  const at = (i) => runExpr(p + 'p;', { time: 12.35, inPoint: 10, textIndex: i });
  assert.ok(at(1) > at(8), 'ltr: reading order');
});

test('dust drifts upward and blurs, not just fades', () => {
  // fade alone reads as a dip to black; the drift and blur are what make it
  // read as crumbling
  const p = sandbox.ef_vis_dustExpr(0, 0.05, 1.0, 4, true);
  const pos = runExpr(p + '[0,p*100,0];', { time: 20, inPoint: 10, textIndex: 1 });
  const blur = runExpr(p + '[p*100,p*100];', { time: 20, inPoint: 10, textIndex: 1 });
  assert.equal(pos[1], 100, 'full drift at the end');
  assert.equal(blur[0], 100, 'full blur at the end');
});

/* ── PROOF_STACK rhythm ─────────────────────────────────────────────
   v7's grammar: the reveal is not one long shot, it is evidence landing
   back to back with the cut rhythm tightening into the last one. The whole
   recipe is that rhythm, so the rhythm is what gets tested. */

const slots = (n, total, mode, hold) =>
  Array.from(sandbox.ef_vis_stackSlots(n, total, mode, hold));

test('a few images tighten into the last one', () => {
  const s = slots(3, 4, 'auto', 0.8);
  assert.ok(s[0] > s[1], `${s[0]} should be longer than ${s[1]}`);
  assert.ok(s[1] > s[2] || Math.abs(s[2] - 0.8) < 0.01, 'accelerating, then the hold');
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 4) < 0.01, 'fills the shot exactly');
});

test('many images run even, with the last one held', () => {
  const s = slots(12, 6, 'auto', 0.8);
  const body = s.slice(0, -1);
  assert.ok(Math.max(...body) - Math.min(...body) < 0.001, 'a steady montage');
  assert.ok(s[11] > body[0] * 2, 'the point still lands on the final image');
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 6) < 0.01);
});

test('auto switches on the count, and can be overridden', () => {
  const few = slots(4, 5, 'auto', 0.5);
  assert.ok(few[0] > few[1], '4 images tighten');
  const forced = slots(4, 5, 'even', 0);
  assert.ok(Math.abs(forced[0] - forced[1]) < 1e-9, 'even was asked for and honoured');
});

test('no image is ever left below the threshold where it cannot be read', () => {
  // 20 images in 1.5s is not a montage, it is a flicker
  const s = slots(20, 1.5, 'even', 0);
  assert.ok(Math.min(...s) >= 0.13, `shortest ${Math.min(...s)}`);
});

test('a single image just fills the shot', () => {
  assert.deepEqual(slots(1, 5, 'auto', 0.8), [5]);
});

test('nonsense input returns nothing rather than NaN slots', () => {
  assert.equal(slots(0, 5, 'auto', 0).length, 0);
  assert.equal(slots(3, 0, 'auto', 0).length, 0);
});

test('slots are always in playable order, never negative', () => {
  for (const [n, total] of [[2, 3], [5, 8], [8, 4], [12, 20]]) {
    for (const s of slots(n, total, 'auto', 0.8)) {
      assert.ok(s > 0, `n=${n} total=${total} produced ${s}`);
    }
  }
});
