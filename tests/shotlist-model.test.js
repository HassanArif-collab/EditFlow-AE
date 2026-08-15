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
    { id: 'shot_02', archetype: 'BROLL_VIDEO', durationInFrames: 90, props: {} },
  ] }));
  assert.equal(r.shots.length, 1, 'only the supported shot builds');
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /BROLL_VIDEO/);
});

test('one broken shot does not lose the others', () => {
  const r = M.parseShotlist(JSON.stringify({ shots: [
    statShot({ title: 'no value here' }),                       // broken
    { id: 'shot_02', archetype: 'STAT_COUNTER', durationInFrames: 90,
      props: { value: 282, title: 'per day' } },                // fine
  ] }));
  assert.equal(r.shots.length, 1);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /numeric props.value/);
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
  assert.match(r.errors[0], /needs props.title/);
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
