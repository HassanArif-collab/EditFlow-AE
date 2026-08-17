/* Real keyframes, not expressions.
 *
 * The owner asked for keyframes he can grab in the graph editor. An
 * expression is invisible in the timeline and cannot be curve-edited, so
 * "does it animate" is no longer the question — "are there keys, at the
 * right times, with the right values, eased" is.
 *
 * The mock records every setValueAtTime call, so these tests assert on the
 * keyframes that would actually land in the project.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const JSX = path.resolve(__dirname, '..', 'cep-panel-ae', 'extendscript', 'visuals.jsx');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(JSX, 'utf8'), sandbox, { filename: 'visuals.jsx' });

/** An AE stand-in that writes down every key, ease and hold it is given. */
function rig(scaleOverride) {
  const keys = {};          // "owner.Prop" -> [[time, value], ...]
  const eased = {};
  const held = {};
  const exprs = {};
  let n = 0;

  // AE hands back a TextDocument, mutated then set back
  const textDoc = () => ({
    resetCharStyle() {}, fontSize: 0, font: '', applyFill: false,
    fillColor: [1, 1, 1], applyStroke: false, justification: null, text: '',
  });

  function makeProp(owner, name) {
    const id = owner + '.' + name;
    const p = {
      numKeys: 0,
      value: name === 'Source Text' ? textDoc()
           : name === 'Scale' && scaleOverride ? scaleOverride.slice()
           : name === 'Position' ? [960, 540]
           : name === 'Scale' ? [100, 100] : 100,
      setValue(v) { p.value = v; },
      setValueAtTime(t, v) {
        (keys[id] = keys[id] || []).push([t, v]);
        p.numKeys++;
      },
      setInterpolationTypeAtKey(i, a) {
        if (a === 'HOLD') held[id] = (held[id] || 0) + 1;
      },
      setTemporalEaseAtKey() { eased[id] = (eased[id] || 0) + 1; },
      valueAtTime: () => p.value,
      sourceRectAtTime: () => ({ left: 0, top: 0, width: 200, height: 40 }),
      property: (sub) => makeProp(owner, name + '/' + sub),
      addProperty: (sub) => makeProp(owner, name + '/' + sub),
    };
    Object.defineProperty(p, 'expression', {
      get: () => exprs[id] || '',
      set: (v) => { exprs[id] = v; },
      configurable: true,
    });
    return p;
  }

  function makeLayer(kind) {
    const owner = kind + (++n);
    return {
      name: owner, blendingMode: null, startTime: 0, inPoint: 0, outPoint: 0,
      source: { width: 1280, height: 720 },
      property: (name) => makeProp(owner, name),
      moveToEnd() {}, moveToBeginning() {},
    };
  }

  const comp = {
    width: 1920, height: 1080, duration: 8, numLayers: 0,
    bgColor: null,
    layers: {
      addText: () => makeLayer('text'),
      addShape: () => makeLayer('shape'),
      addSolid: () => makeLayer('solid'),
      add: () => makeLayer('footage'),
    },
    layer: () => makeLayer('any'),
  };

  return { keys, eased, held, exprs, comp, makeLayer };
}

function withAE(fn, scaleOverride) {
  const r = rig(scaleOverride);
  Object.assign(sandbox, {
    app: {
      project: { rootFolder: { numItems: 0, item: () => null },
                 items: { addFolder: () => ({ numItems: 0, item: () => null }) } },
      beginUndoGroup() {}, endUndoGroup() {},
    },
    FolderItem: function () {}, CompItem: function () {},
    KeyframeEase: function (s, i) { this.speed = s; this.influence = i; },
    KeyframeInterpolationType: { BEZIER: 'BEZIER', HOLD: 'HOLD', LINEAR: 'LINEAR' },
    ParagraphJustification: { CENTER_JUSTIFY: 'c' },
    BlendingMode: { MULTIPLY: 'multiply' },
    Shape: function () { this.vertices = []; this.closed = false; },
  });
  try { return fn(r); } finally {
    for (const k of ['app', 'FolderItem', 'CompItem', 'KeyframeEase',
                     'KeyframeInterpolationType', 'ParagraphJustification',
                     'BlendingMode', 'Shape']) delete sandbox[k];
  }
}

/** First recorded key list whose property path ends with `suffix`. */
function keysEndingWith(r, suffix) {
  const hit = Object.keys(r.keys).filter((k) => k.endsWith(suffix));
  return hit.length ? r.keys[hit[0]] : null;
}

/* ── the helper itself ── */

test('ef_vis_kf writes keys at the requested times and eases them', () => {
  withAE((r) => {
    const p = r.comp.layers.addText().property('Opacity');
    sandbox.ef_vis_kf(p, [[0, 0], [0.4, 100]], 'out');
    assert.equal(p.numKeys, 2);
    const rec = r.keys[Object.keys(r.keys)[0]];
    assert.deepEqual(rec[0], [0, 0]);
    assert.deepEqual(rec[1], [0.4, 100]);
    // unshaped keys interpolate linearly and read as robotic — the ease is
    // the entire difference between "animated" and "an editor did this"
    assert.ok(r.eased[Object.keys(r.eased)[0]] >= 2, 'both keys were eased');
  });
});

test('a hold style steps instead of interpolating', () => {
  withAE((r) => {
    const p = r.comp.layers.addText().property('Opacity');
    sandbox.ef_vis_kf(p, [[1, 0], [1.01, 100]], 'hold');
    assert.ok(r.held[Object.keys(r.held)[0]] >= 1, 'a hard on, not a fade');
  });
});

/* ── the counter ── */

test('the counter runs on a keyframed slider, from zero to the exact target', () => {
  withAE((r) => {
    const spec = { id: 's', recipe: 'STAT_COUNTER', value: 8484, title: 'Take home',
                   prefix: 'Rs ', unit: 'per month', countDur: 3, accent: [1, 1, 1],
                   technique: 'NONE' };
    sandbox.ef_vis_buildStatCounter(r.comp, spec, { visualsRoot: '' }, []);
    const slider = keysEndingWith(r, 'ADBE Slider Control-0001');
    assert.ok(slider, 'the count is carried by a slider you can keyframe');
    assert.deepEqual(slider[0], [0, 0], 'v7 requires counting from zero');
    assert.deepEqual(slider[1], [3, 8484], 'lands on countDur, on the exact number');
  });
});

test('the only surviving expression carries no timing', () => {
  withAE((r) => {
    const spec = { id: 's', recipe: 'STAT_COUNTER', value: 100, countDur: 2,
                   accent: [1, 1, 1], technique: 'NONE' };
    sandbox.ef_vis_buildStatCounter(r.comp, spec, { visualsRoot: '' }, []);
    const src = Object.keys(r.exprs).filter((k) => k.endsWith('.Source Text'));
    assert.equal(src.length, 1, 'exactly one expression on the whole shot');
    const e = r.exprs[src[0]];
    assert.ok(!/\btime\b/.test(e), 'time in there would mean timing off the keys');
    assert.ok(/effect\("Count"\)/.test(e), 'it only reads the keyframed slider');
  });
});

test('the pulse rides the fitted scale instead of resetting it to 100', () => {
  // the auto-fit shrinks a long number to 62%; a pulse keyed at 100 would
  // pop it back over the frame edge — the bug that shipped once already
  withAE((r) => {
    const spec = { id: 's', recipe: 'STAT_COUNTER', value: 10, countDur: 2,
                   pulse: true, accent: [1, 1, 1], technique: 'NONE' };
    sandbox.ef_vis_buildStatCounter(r.comp, spec, { visualsRoot: '' }, []);
    const scale = keysEndingWith(r, '.Scale');
    assert.ok(scale && scale.length === 3, 'rise, peak, settle');
    assert.equal(scale[0][1][0], 62, 'starts from the fitted scale');
    assert.ok(scale[1][1][0] > 62 && scale[1][1][0] < 70, `peak ${scale[1][1][0]}`);
    assert.equal(scale[2][1][0], 62, 'and returns to it');
  }, [62, 62]);
});

/* ── bars ── */

test('a bar rises, overshoots a little, and settles exactly', () => {
  withAE((r) => {
    const spec = { id: 's', recipe: 'BAR_CHART', growDur: 0.9, accent: [1, 1, 1],
                   technique: 'NONE', maxValue: 100, caption: '',
                   bars: [{ label: 'Rent', value: 100, accent: true }] };
    sandbox.ef_vis_buildBarChart(r.comp, spec, { visualsRoot: '' }, []);
    const bar = Object.keys(r.keys)
      .filter((k) => /^shape\d+\.Scale$/.test(k))
      .map((k) => r.keys[k])
      .find((v) => v.length === 3);
    assert.ok(bar, 'three keys, each draggable');
    assert.equal(bar[0][1][1], 0, 'flat on the baseline');
    assert.ok(bar[1][1][1] > 100, 'overshoots');
    assert.equal(bar[2][1][1], 100, 'settles exactly, never above');
  });
});

/* ── techniques ── */

test('PUSH_IN keys from wherever the layer already sits', () => {
  withAE((r) => {
    const L = r.comp.layers.add();
    const applied = sandbox.ef_vis_applyTechnique(L, r.comp, { technique: 'PUSH_IN' },
      { scalable: true, zoom: 1.2, dur: 4 });
    assert.equal(applied, 'PUSH_IN');
    const k = keysEndingWith(r, '.Scale');
    assert.equal(k[0][1][0], 62, 'a hardcoded 100 would pop the frame');
    assert.ok(Math.abs(k[1][1][0] - 74.4) < 0.01, `62 x 1.2 = 74.4, got ${k[1][1][0]}`);
  }, [62, 62]);
});

test('PARALLAX moves the foreground further than the background', () => {
  const endScale = (rate) => withAE((r) => {
    const L = r.comp.layers.add();
    sandbox.ef_vis_applyTechnique(L, r.comp, { technique: 'PARALLAX_2_5D' },
      { scalable: true, zoom: 1.2, dur: 4, rate });
    return keysEndingWith(r, '.Scale')[1][1][0];
  }, [100, 100]);
  const bg = endScale(0.5), mid = endScale(1.0), fg = endScale(1.5);
  assert.ok(Math.abs(bg - 110) < 0.01, `bg ${bg}`);
  assert.ok(Math.abs(mid - 120) < 0.01, `mid ${mid}`);
  assert.ok(Math.abs(fg - 130) < 0.01, `fg ${fg}`);
  assert.ok(bg < mid && mid < fg, 'depth is the difference between them');
});

test('KEN_BURNS keys position as well as scale', () => {
  withAE((r) => {
    const L = r.comp.layers.add();
    sandbox.ef_vis_applyTechnique(L, r.comp, { technique: 'KEN_BURNS' },
      { scalable: true, zoom: 1.2, dur: 4 });
    const pos = keysEndingWith(r, '.Position');
    assert.ok(pos && pos.length === 2, 'it travels, which is what makes it Ken Burns');
    assert.notEqual(pos[0][1][0], pos[1][1][0], 'sideways');
    assert.notEqual(pos[0][1][1], pos[1][1][1], 'and vertically');
  }, [100, 100]);
});

test('a hold delays the move without shortening it', () => {
  withAE((r) => {
    const L = r.comp.layers.add();
    sandbox.ef_vis_applyTechnique(L, r.comp, { technique: 'PUSH_IN' },
      { scalable: true, zoom: 1.2, dur: 3, hold: 1.5 });
    const k = keysEndingWith(r, '.Scale');
    assert.equal(k[0][0], 1.5, 'still until the hold ends');
    assert.equal(k[1][0], 4.5, 'then the full move');
  }, [100, 100]);
});

/* ── letters ── */

test('letters reveal on a keyframed range selector', () => {
  withAE((r) => {
    const spec = { id: 's', recipe: 'SECTION_TITLE_CARD', title: 'MONEY TRAIL',
                   variant: 'slide_up', stagger: 0.05, accent: [1, 1, 1],
                   technique: 'NONE', supporting: '' };
    sandbox.ef_vis_buildTitleCard(r.comp, spec, { visualsRoot: '' }, []);
    const sel = keysEndingWith(r, 'ADBE Text Percent Start');
    assert.ok(sel, 'the reveal is two keys you can drag, not an expression');
    assert.equal(sel[0][1], 0);
    assert.equal(sel[1][1], 100, 'sweeps the whole line');
    assert.ok(sel[1][0] > sel[0][0], 'and takes time doing it');
  });
});

test('DUST_DISSOLVE sweeps from the right — deletion order, not reading order', () => {
  withAE((r) => {
    const spec = { id: 's', recipe: 'STAT_COUNTER', value: 8484, countDur: 2,
                   accent: [1, 1, 1], technique: 'DUST_DISSOLVE' };
    sandbox.ef_vis_buildStatCounter(r.comp, spec, { visualsRoot: '' }, []);
    const sel = keysEndingWith(r, 'ADBE Text Percent Start');
    assert.ok(sel, 'dust is keyed too');
    assert.equal(sel[0][1], 100, 'selection starts at the right edge');
    assert.equal(sel[1][1], 0, 'and grows leftward across the number');
  });
});

/* ── nothing left behind ── */

test('no builder writes an animation expression any more', () => {
  const code = fs.readFileSync(JSX, 'utf8');
  const sites = code.match(/\.expression\s*=/g) || [];
  assert.equal(sites.length, 1,
    'the only expression allowed is the counter text formatter');
  assert.ok(/Source Text"\)\.expression/.test(code),
    'and it is on Source Text, where AE gives no alternative');
});

/* ── the style bible ────────────────────────────────────────────────
   The theme is written by the other repo into manifest.json at the visuals
   root. Before this, every recipe built in default colours while the
   generated stills around it followed the theme — a film that did not match
   its own images. */

function withManifest(json, fn) {
  const files = json === null ? {} : { 'G:/vis/manifest.json': json };
  sandbox.File = function (p) {
    const path = String(p);
    this.fsName = path;
    Object.defineProperty(this, 'exists', { get: () => path in files });
    this.open = () => true;
    this.read = () => files[path];
    this.close = () => {};
  };
  // the cache is keyed on the root, so reset it between cases
  sandbox.EF_VIS_STYLE = null;
  sandbox.EF_VIS_STYLE_ROOT = null;
  try { return fn(); } finally { delete sandbox.File; }
}

const BIBLE = JSON.stringify({
  styleBible: {
    theme: 'Archival scrapbook',
    palette: '#F5E6D3 #2D1B0E #C0392B',
    colors: { bg: '#F5E6D3', text: '#2D1B0E', accent: '#C0392B' },
  },
});

test('the theme is read from manifest.json at the visuals root', () => {
  withManifest(BIBLE, () => {
    const sb = sandbox.ef_vis_styleBible('G:/vis');
    assert.equal(sb.theme, 'Archival scrapbook');
    const bg = sandbox.ef_vis_styleColor({ visualsRoot: 'G:/vis' }, 'bg', [0, 0, 0]);
    assert.ok(Math.abs(bg[0] - 0xF5 / 255) < 0.001, `got ${bg}`);
    assert.ok(Math.abs(bg[1] - 0xE6 / 255) < 0.001);
  });
});

test('a code-writing agent can reach the same bible with no argument', () => {
  // the whole reason it lives in the jsx: generated code that hardcodes hexes
  // drifts the moment the theme changes
  withManifest(BIBLE, () => {
    sandbox.ef_vis_styleBible('G:/vis');
    assert.equal(sandbox.ef_vis_styleBible().theme, 'Archival scrapbook');
  });
});

test('no manifest means the built-in defaults, not a broken colour', () => {
  withManifest(null, () => {
    const bg = sandbox.ef_vis_styleColor({ visualsRoot: 'G:/vis' }, 'bg', [0.04, 0.05, 0.08]);
    assert.deepEqual(Array.from(bg), [0.04, 0.05, 0.08]);
  });
});

test('a half-set palette falls back entirely rather than theming some layers', () => {
  // colors is null until three hexes are set; theming the background but not
  // the text is worse than theming nothing
  withManifest(JSON.stringify({ styleBible: { theme: 'x', colors: null } }), () => {
    const bg = sandbox.ef_vis_styleColor({ visualsRoot: 'G:/vis' }, 'bg', [0.04, 0.05, 0.08]);
    assert.deepEqual(Array.from(bg), [0.04, 0.05, 0.08]);
    const ink = sandbox.ef_vis_styleInk({ visualsRoot: 'G:/vis' }, 1, [1, 1, 1]);
    assert.deepEqual(Array.from(ink), [1, 1, 1]);
  });
});

test('quieter greys stay readable on a light theme', () => {
  // a fixed grey vanishes on paper; the ink is mixed toward the background
  // so the hierarchy survives
  withManifest(BIBLE, () => {
    const cfg = { visualsRoot: 'G:/vis' };
    const full = sandbox.ef_vis_styleInk(cfg, 1, [1, 1, 1]);
    const quiet = sandbox.ef_vis_styleInk(cfg, 0.7, [0.8, 0.8, 0.8]);
    assert.ok(quiet[0] > full[0], 'quieter means closer to the paper, not to white');
    assert.ok(quiet[0] < 0xF5 / 255, 'but still darker than the paper itself');
  });
});

test('a shot that names its own colour beats the theme', () => {
  withManifest(BIBLE, () => {
    const themed = sandbox.ef_vis_styleColor({ visualsRoot: 'G:/vis' }, 'accent', [0, 1, 0]);
    assert.ok(Math.abs(themed[0] - 0xC0 / 255) < 0.001, 'theme applies by default');
    // buildShot only themes the accent when the shot did not set one
    assert.ok(Math.abs(themed[1] - 0x39 / 255) < 0.001);
  });
});
