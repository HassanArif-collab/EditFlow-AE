/* The shotlist model is where geometry and timing are decided, so it carries
   the heaviest tests in the visual pipeline: a wrong number here becomes a
   wrong number on screen in a published video. */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { loadEsm } = require('./_load-esm');

const M = loadEsm(path.resolve(
  __dirname, '..', 'cep-panel-ae', 'client', 'src', 'shotlist-model.js'
));

const statShot = (props, extra) => ({
  id: 'shot_01', archetype: 'STAT_COUNTER', durationInFrames: 150,
  scriptLine: 'The line is Rs 8,484 per month.', props, ...extra,
});

/* ── motion limits: the style guide is enforced, not suggested ── */

test('motion values outside the v7 bands are clamped, not obeyed', () => {
  assert.equal(M.clampMotion('letterStagger', 0.9), 0.10, 'too slow');
  assert.equal(M.clampMotion('letterStagger', 0.001), 0.03, 'too fast = mushy');
  assert.equal(M.clampMotion('statCountUp', 30), 4.0);
  assert.equal(M.clampMotion('letterStagger', 0.05), 0.05, 'in-band passes through');
});

test('a non-numeric motion value falls back to the band minimum, never NaN', () => {
  assert.equal(M.clampMotion('letterStagger', 'fast'), 0.03);
});

/* ── colour ── */

test('hex accent colours convert to AE 0..1 floats', () => {
  const [r, g, b] = M.hexToRgb('#b8860b');
  assert.ok(Math.abs(r - 0.7216) < 0.001, String(r));
  assert.ok(Math.abs(g - 0.5255) < 0.001, String(g));
  assert.ok(Math.abs(b - 0.0431) < 0.001, String(b));
});

test('a malformed colour falls back instead of producing NaN channels', () => {
  assert.deepEqual(M.hexToRgb('not-a-colour', [1, 0, 0]), [1, 0, 0]);
  assert.deepEqual(M.hexToRgb(undefined, [1, 1, 1]), [1, 1, 1]);
});

/* ── number formatting: ES3 has no toLocaleString ── */

test('groupDigits inserts thousands separators', () => {
  assert.equal(M.groupDigits(1500000000), '1,500,000,000');
  assert.equal(M.groupDigits(8484), '8,484');
  assert.equal(M.groupDigits(282), '282');
  assert.equal(M.groupDigits(0), '0');
});

test('groupDigits handles negatives and non-numbers without crashing', () => {
  assert.equal(M.groupDigits(-4500), '-4,500');
  assert.equal(M.groupDigits('nonsense'), '0');
});

/* ── parsing ── */

test('a well-formed shotlist parses with frames converted to seconds', () => {
  const { shots, errors } = M.parseShotlist(JSON.stringify({
    shots: [statShot({ value: 8484, title: 'Poverty line', prefix: 'Rs ' })],
  }), { fps: 30 });
  assert.equal(errors.length, 0);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].duration, 5, '150 frames @30fps = 5s');
  assert.equal(shots[0].value, 8484);
});

test('prose or code fences around the JSON are tolerated', () => {
  const raw = 'Sure! Here is the shotlist:\n```json\n' +
    JSON.stringify({ shots: [statShot({ value: 1, title: 'x' })] }) + '\n```';
  assert.equal(M.parseShotlist(raw).shots.length, 1);
});

test('a bare array is accepted as well as {shots:[...]}', () => {
  assert.equal(M.parseShotlist(JSON.stringify([statShot({ value: 5, title: 'x' })])).shots.length, 1);
});

test('invalid JSON reports an error instead of throwing', () => {
  const r = M.parseShotlist('{oh no');
  assert.equal(r.shots.length, 0);
  assert.match(r.errors[0], /not valid JSON/);
});

test('unsupported archetypes are reported as skipped, never silently dropped', () => {
  const r = M.parseShotlist(JSON.stringify({ shots: [
    statShot({ value: 1, title: 'a' }),
    // PIE_CHART has no recipe at all; LINE_GRAPH has one that is not built yet
    { id: 'shot_02', archetype: 'PIE_CHART', durationInFrames: 90, props: {} },
  ] }));
  assert.equal(r.shots.length, 1, 'only the supported shot builds');
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /PIE_CHART/);
});

test('one broken shot does not lose the others', () => {
  const r = M.parseShotlist(JSON.stringify({ shots: [
    statShot({ title: 'no value here' }),                       // broken
    { id: 'shot_02', archetype: 'STAT_COUNTER', durationInFrames: 90,
      props: { value: 282, title: 'per day' } },                // fine
  ] }));
  assert.equal(r.shots.length, 1);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /needs "value"/, 'names the missing prop');
});

/* ── per-archetype requirements ── */

test('BAR_CHART marks exactly one accent bar — the one the script names', () => {
  const { shots } = M.parseShotlist(JSON.stringify({ shots: [{
    id: 's', archetype: 'BAR_CHART', durationInFrames: 120,
    props: { bars: [{ label: 'Rent', value: 6000 }, { label: 'Food', value: 4200 },
                    { label: 'Left', value: 484 }], accentIndex: 2 },
  }] }));
  assert.deepEqual(shots[0].bars.map((b) => b.accent), [false, false, true]);
  assert.equal(shots[0].maxValue, 6000, 'tallest bar sets the scale');
});

test('a bar with a non-numeric value fails the whole shot loudly', () => {
  const r = M.parseShotlist(JSON.stringify({ shots: [{
    id: 's', archetype: 'BAR_CHART', durationInFrames: 120,
    props: { bars: [{ label: 'Rent', value: 'six thousand' }] },
  }] }));
  assert.equal(r.shots.length, 0);
  assert.match(r.errors[0], /non-numeric/);
});

test('SECTION_TITLE_CARD rejects an unapproved variant instead of passing it to AE', () => {
  const { shots } = M.parseShotlist(JSON.stringify({ shots: [{
    id: 's', archetype: 'SECTION_TITLE_CARD', durationInFrames: 90,
    props: { title: 'THE MONEY TRAIL', variant: 'explode_wildly' },
  }] }));
  assert.equal(shots[0].variant, 'slide_up', 'falls back to an approved family');
});

test('a title card with no title is an error, not an empty card', () => {
  const r = M.parseShotlist(JSON.stringify({ shots: [{
    id: 's', archetype: 'SECTION_TITLE_CARD', durationInFrames: 90, props: {},
  }] }));
  assert.match(r.errors[0], /needs "title"/, 'names the missing prop');
});

/* ── versions ── */

test('nextVersionName counts up and never reuses a name', () => {
  assert.equal(M.nextVersionName('shot_01', []), 'shot_01 v1');
  assert.equal(M.nextVersionName('shot_01', ['shot_01 v1']), 'shot_01 v2');
  assert.equal(M.nextVersionName('shot_01', ['shot_01 v3', 'shot_01 v1']), 'shot_01 v4');
});

test('nextVersionName sees through the active-version star', () => {
  assert.equal(M.nextVersionName('shot_01', ['★ shot_01 v2', 'shot_01 v1']), 'shot_01 v3');
});

test('nextVersionName ignores other shots entirely', () => {
  assert.equal(M.nextVersionName('shot_02', ['shot_01 v1', 'shot_01 v2']), 'shot_02 v1');
});

/* ── master timeline ── */

test('masterOrder keeps shotlist order, not alphabetical order', () => {
  const out = M.masterOrder([{ id: 'shot_10', duration: 1 }, { id: 'shot_02', duration: 1 }]);
  assert.deepEqual(out.map((s) => s.id), ['shot_10', 'shot_02']);
});

test('masterOrder lays shots end-to-end with a running offset', () => {
  const out = M.masterOrder([{ id: 'a', durationInFrames: 30 },
                             { id: 'b', durationInFrames: 45 }], 30);
  assert.equal(out[0].startTime, 0);
  assert.equal(out[1].startTime, 1);
  assert.equal(out[1].duration, 1.5);
});

/* ── reconcile: surviving an After Effects restart ──────────────────
   The panel's memory dies when AE closes. The comps do not. These tests
   pin the rule that makes that a non-event: the PROJECT says what is
   built, and nothing the panel forgot may present as work that is gone. */

const spec = (id) => M.normalizeShot(
  { id, archetype: 'STAT_COUNTER', durationInFrames: 150, props: { value: 100 } }
).spec;

const proj = (...entries) => ({
  shots: entries.map(([shot, versions]) => ({
    shot,
    versions: versions.map((v) => typeof v === 'string'
      ? { name: v.replace(/^★ /, ''), active: v.startsWith('★ '), duration: 5, layers: 4 }
      : v),
  })),
});

test('a reopened project reports built shots even though the panel forgot', () => {
  // exactly the reported bug: shotlist reloaded from disk, panel memory empty
  const r = M.reconcile([spec('shot_01'), spec('shot_02')],
                        proj(['shot_01', ['★ shot_01 v1']]));
  assert.equal(r.rows[0].built, true, 'the comp exists in the project');
  assert.equal(r.rows[0].activeVersion, 'shot_01 v1');
  assert.equal(r.rows[0].activeLayers, 4);
  assert.equal(r.rows[1].built, false, 'shot_02 was genuinely never built');
  assert.equal(r.built, 1);
});

test('comps with no shotlist row are shown as orphans, never hidden', () => {
  // losing a shotlist must not read as losing the work
  const r = M.reconcile([], proj(['shot_07', ['★ shot_07 v1', 'shot_07 v2']]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].orphan, true);
  assert.equal(r.rows[0].built, true);
  assert.deepEqual(r.orphans, ['shot_07']);
  assert.equal(r.rows[0].versions.length, 2, 'both versions stay reachable');
});

test('shotlist order is kept, with orphans appended after it', () => {
  const r = M.reconcile([spec('shot_02'), spec('shot_01')],
                        proj(['zz_extra', ['★ zz_extra v1']], ['shot_01', ['★ shot_01 v1']]));
  assert.deepEqual(r.rows.map((x) => x.id), ['shot_02', 'shot_01', 'zz_extra']);
});

test('the starred version is the active one, whatever order AE lists them in', () => {
  const r = M.reconcile([spec('shot_01')],
                        proj(['shot_01', ['shot_01 v1', '★ shot_01 v2', 'shot_01 v3']]));
  assert.equal(r.rows[0].activeVersion, 'shot_01 v2');
});

test('with no star at all the first version is used, matching what the master does', () => {
  const r = M.reconcile([spec('shot_01')], proj(['shot_01', ['shot_01 v1', 'shot_01 v2']]));
  assert.equal(r.rows[0].activeVersion, 'shot_01 v1');
});

test('an older jsx returning bare strings still renders instead of throwing', () => {
  // version skew between a reloaded panel and a not-yet-reloaded jsx
  const r = M.reconcile([spec('shot_01')],
                        { shots: [{ shot: 'shot_01', versions: ['★ shot_01 v1'] }] });
  assert.equal(r.rows[0].built, true);
  assert.equal(r.rows[0].activeVersion, 'shot_01 v1');
});

test('an empty project leaves every shot unbuilt rather than erroring', () => {
  const r = M.reconcile([spec('shot_01')], { shots: [] });
  assert.equal(r.rows[0].built, false);
  assert.equal(r.built, 0);
  assert.deepEqual(M.reconcile([], null).rows, [], 'no project payload at all');
});

/* ── masterPlan ── */

test('an unbuilt shot keeps its slot so later shots stay on the narration', () => {
  const rows = M.reconcile([spec('shot_01'), spec('shot_02'), spec('shot_03')],
                           proj(['shot_01', ['★ shot_01 v1']], ['shot_03', ['★ shot_03 v1']])).rows;
  const plan = M.masterPlan(rows, 30);
  assert.deepEqual(plan.missing, ['shot_02']);
  assert.equal(plan.order[2].startTime, 10, 'shot_03 does NOT slide earlier into the gap');
  assert.equal(plan.order.length, 3);
});

test('orphans are never placed in the master', () => {
  const rows = M.reconcile([spec('shot_01')],
                           proj(['shot_01', ['★ shot_01 v1']], ['stray', ['★ stray v1']])).rows;
  const plan = M.masterPlan(rows, 30);
  assert.deepEqual(plan.order.map((o) => o.id), ['shot_01']);
});

/* ── the brief fields (docs/brief-schema.md) ────────────────────────
   These are the seam with the Content Prompts repo. A field silently
   dropped here is a field the web agent spent effort producing for
   nothing, and the failure would only show up as a shot that looks
   subtly wrong on screen. */

const brief = (over) => Object.assign({
  id: 'shot_02', archetype: 'STAT_COUNTER', recipe: 'STAT_COUNTER',
  technique: 'NONE', durationInFrames: 150,
  scriptLine: 'That line is Rs 8,484 per month.',
  props: { value: 8484, prefix: 'Rs ' },
}, over);

const one = (over) => M.normalizeShot(brief(over), { fps: 30 });

test('every brief field survives into the spec', () => {
  const { spec } = one({
    placement: 'overlay', productionRoute: 'generated',
    routeReason: 'fluid metaphor — faster generated',
    assetDir: 'assets/cold-open/energy-fluid', assets: ['fluid.png'],
    note: 'hold, then push in', qaFocus: 'illegible number', needs: ['props.unit'],
  });
  assert.equal(spec.placement, 'overlay');
  assert.equal(spec.productionRoute, 'generated');
  assert.equal(spec.routeReason, 'fluid metaphor — faster generated');
  assert.equal(spec.assetDir, 'assets/cold-open/energy-fluid');
  assert.deepEqual(spec.assets, ['fluid.png']);
  assert.equal(spec.note, 'hold, then push in');
  assert.equal(spec.qaFocus, 'illegible number');
  assert.deepEqual(spec.needs, ['props.unit']);
});

test('the defaults are the safe ones', () => {
  const { spec } = one({});
  assert.equal(spec.placement, 'full', 'an overlay mistaken for full is a hard cut mid-sentence');
  assert.equal(spec.productionRoute, 'after_effects');
  assert.deepEqual(spec.needs, [], 'no needs means complete — build without the model');
  assert.equal(spec.technique, 'NONE');
});

test('a technique outside the agreed list becomes NONE and says so', () => {
  const { spec } = one({ technique: 'LIQUID_POSTER_TYPE' });
  assert.equal(spec.technique, 'NONE');
  assert.match(spec.warnings.join(' '), /LIQUID_POSTER_TYPE/);
});

test('DUST_DISSOLVE is in the vocabulary and survives onto the shot', () => {
  // it means loss — a number crumbling as the narration says it vanished
  assert.equal(one({ technique: 'DUST_DISSOLVE' }).spec.technique, 'DUST_DISSOLVE');
});

test('recipe wins over archetype, and archetype still works alone', () => {
  assert.equal(one({ archetype: 'DOC_HIGHLIGHT', recipe: 'STAT_COUNTER' }).spec.recipe, 'STAT_COUNTER');
  const legacy = M.normalizeShot({ id: 's', archetype: 'STAT_COUNTER',
    durationInFrames: 150, props: { value: 1 } }, { fps: 30 });
  assert.equal(legacy.spec.recipe, 'STAT_COUNTER', 'older shotlists have no recipe field');
});

test('an archetype AE cannot build names itself in the reason', () => {
  const r = M.normalizeShot({ id: 's', archetype: 'LINE_GRAPH',
                              props: { points: [{ label: 'a', value: 1 }] } }, { fps: 30 });
  assert.match(r.error, /LINE_GRAPH/, 'the recipe name alone would not say which shot');
  assert.match(r.error, /generate/);
});

/* ── duration precedence ── */

test('durationInFrames wins, then seconds, then a loud default', () => {
  assert.equal(one({ durationInFrames: 150 }).spec.duration, 5);
  assert.equal(one({ durationInFrames: 150, duration: 99 }).spec.duration, 5, 'frames win');
  const secs = one({ durationInFrames: null, duration: 3.5 }).spec;
  assert.equal(secs.duration, 3.5);
  const none = one({ durationInFrames: null }).spec;
  assert.equal(none.duration, 5);
  assert.match(none.warnings.join(' '), /no duration/, 'a forgotten duration must be visible');
});

test('frames convert at the deliverable rate, not an assumed 30', () => {
  assert.equal(M.DELIVERABLE.fps, 30);
  assert.equal(M.normalizeShot(brief({ durationInFrames: 120 }), { fps: 60 }).spec.duration, 2);
});

/* ── sourceAnchor ── */

const ANCHOR = {
  url: 'https://www.dawn.com/news/2011436',
  image: 'assets/_captures/dawn-com-2011436/fullpage.png',
  pageWidth: 1280, pageHeight: 6461, imageWidth: 1280, imageHeight: 6461,
  rect: { x: 108, y: 1632, w: 728, h: 92 },
};

test('sourceAnchor is carried whole, image path untouched', () => {
  const { spec } = one({ sourceAnchor: ANCHOR });
  // relative to the VISUALS ROOT, not assetDir — joining it to the shot
  // folder is the silent miss this contract exists to prevent
  assert.equal(spec.sourceAnchor.image, 'assets/_captures/dawn-com-2011436/fullpage.png');
  assert.deepEqual(spec.sourceAnchor.rect, { x: 108, y: 1632, w: 728, h: 92 });
  assert.equal(spec.sourceAnchor.imageHeight, 6461);
});

test('imageWidth/Height fall back to the page size when omitted', () => {
  const { pageWidth, pageHeight, ...rest } = ANCHOR;
  const { spec } = one({ sourceAnchor: { ...rest, pageWidth, pageHeight,
                                         imageWidth: undefined, imageHeight: undefined } });
  assert.equal(spec.sourceAnchor.imageWidth, 1280);
  assert.equal(spec.sourceAnchor.imageHeight, 6461);
});

test('an anchor with no rect is refused rather than highlighting the wrong line', () => {
  const { spec } = one({ sourceAnchor: { image: 'x.png', pageHeight: 100 } });
  assert.equal(spec.sourceAnchor, undefined);
  assert.match(spec.warnings.join(' '), /highlight cannot be placed/);
});

/* ── props ── */

test('the common props ride inside props without reading as typos', () => {
  const { spec } = one({ props: { value: 1, accentColor: '#ff0000', font: 'Arial-Bold' } });
  assert.deepEqual(spec.accent, [1, 0, 0]);
  assert.equal(spec.font, 'Arial-Bold');
  assert.equal(spec.warnings, undefined, 'accentColor is not an unknown parameter');
});

test('an invented prop is a warning, not a lost shot', () => {
  const { spec } = one({ props: { value: 1, sparkles: true } });
  assert.equal(spec.value, 1, 'the shot still builds');
  assert.match(spec.warnings.join(' '), /sparkles/);
});

test('an unapproved enum falls back and warns instead of failing', () => {
  const r = M.normalizeShot({ id: 's', archetype: 'SECTION_TITLE_CARD', durationInFrames: 90,
    props: { title: 'THE MONEY TRAIL', variant: 'explode_wildly' } }, { fps: 30 });
  assert.equal(r.spec.variant, 'slide_up');
  assert.match(r.spec.warnings.join(' '), /explode_wildly/);
});

test('motion values are still clamped through the registry', () => {
  assert.equal(one({ props: { value: 1, countDur: 30 } }).spec.countDur, 4.0);
  const derived = one({ durationInFrames: 60, props: { value: 1 } }).spec;
  assert.equal(derived.countDur, 2.5, 'a short shot still gets a legal count');
});
