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

/* ── the counter, now on real keyframes ─────────────────────────────
   The move used to be an expression, which cannot be curve-edited. The
   timing lives on a keyframed Slider Control instead; the only expression
   left formats that slider into text, because After Effects has no way to
   display a number without one. These tests cover both halves. */

const fmt = (prefix, suffix) => sandbox.ef_vis_countFormatExpr(prefix, suffix);
const readOut = (expr, sliderValue) => vm.runInNewContext(expr, aeCtx({
  effect: () => () => sliderValue,
}));

test('the formatter lands EXACTLY on the target with separators', () => {
  assert.equal(readOut(fmt('Rs ', ''), 8484), 'Rs 8,484',
               'wrong final number = ruined documentary');
});

test('the formatter shows zero at the start of the count', () => {
  assert.equal(readOut(fmt('Rs ', ''), 0), 'Rs 0');
});

test('a billion-scale number groups correctly (three separators)', () => {
  assert.equal(readOut(fmt('', ''), 1500000000), '1,500,000,000');
});

test('the formatter never yields NaN across the whole count', () => {
  const e = fmt('Rs ', '');
  for (let v = 0; v <= 8484; v += 97) {
    assert.ok(!String(readOut(e, v)).includes('NaN'), `slider=${v}`);
  }
});

test('a negative number keeps its sign outside the separators', () => {
  assert.equal(readOut(fmt('', ''), -12345), '-12,345');
});

test('the formatter carries no timing — that is what the keys are for', () => {
  const e = fmt('Rs ', '');
  assert.ok(!/time/.test(e), 'time in the expression means timing off the keys');
  assert.ok(!/inPoint/.test(e));
  assert.ok(/effect\("Count"\)/.test(e), 'it reads the keyframed slider');
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
