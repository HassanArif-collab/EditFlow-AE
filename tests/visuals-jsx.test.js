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
