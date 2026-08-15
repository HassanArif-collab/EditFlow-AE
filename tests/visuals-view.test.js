/* The Visuals tab, driven against a fake After Effects.
 *
 * The reported failure was simple and total: close After Effects, reopen it,
 * and the tab is a folder picker with nothing else. Whatever else this view
 * does, these two things must hold —
 *
 *   1. the shotlist is remembered with the PROJECT, not in panel memory
 *   2. what is built is read back from the project, so the panel can never
 *      claim a shot is missing because it forgot
 *
 * so both are tested through the view's real public entry points.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { loadEsm } = require('./_load-esm');

const SRC = path.resolve(__dirname, '..', 'cep-panel-ae', 'client', 'src', 'visuals-view.js');
const MODEL = loadEsm(path.resolve(
  __dirname, '..', 'cep-panel-ae', 'client', 'src', 'shotlist-model.js'
));

const SHOTLIST = JSON.stringify({ shots: [
  { id: 'shot_01', archetype: 'STAT_COUNTER', durationInFrames: 150,
    scriptLine: 'Take home is 8,484.',
    props: { value: 8484, title: 'Take home', prefix: 'Rs ' } },
  { id: 'shot_02', archetype: 'SECTION_TITLE_CARD', durationInFrames: 120,
    scriptLine: 'Chapter two.', props: { title: 'Where it goes' } },
] });

/** A fake AE whose project survives "reopening" the panel. */
function fakeAE(opts = {}) {
  const ae = {
    saved: opts.saved !== false,
    projectPath: opts.path || 'G:/Docs/Doc.aep',
    sidecar: opts.sidecar || null,       // the file next to the .aep
    built: opts.built || {},             // shotId -> [{name, active, ...}]
    calls: [],
  };
  ae.call = async (fn, arg) => {
    ae.calls.push(fn);
    const cfg = typeof arg === 'string' ? JSON.parse(arg) : arg;
    switch (fn) {
      case 'ef_vis_projectInfo':
        return { saved: ae.saved, name: 'Doc.aep', path: ae.saved ? ae.projectPath : '',
                 hasState: !!ae.sidecar, statePath: ae.projectPath + '.json' };
      case 'ef_vis_readState':
        return { saved: ae.saved, data: (ae.saved && ae.sidecar) || '' };
      case 'ef_vis_writeState':
        if (!ae.saved) return { saved: false, wrote: false };
        ae.sidecar = cfg.data;
        return { saved: true, wrote: true };
      case 'ef_vis_listAll':
        return {
          shots: Object.keys(ae.built).map((s) => ({ shot: s, versions: ae.built[s] })),
          master: ae.master || null,
        };
      case 'ef_vis_buildShot': {
        const id = cfg.spec.id;
        const list = ae.built[id] || (ae.built[id] = []);
        const name = `${id} v${list.length + 1}`;
        list.forEach((v) => { v.active = false; });
        list.push({ name, active: true, duration: cfg.spec.duration, layers: 4 });
        return { comp: name, shot: id, layers: 4, missingAssets: [] };
      }
      case 'ef_vis_deleteVersion': {
        const list = ae.built[cfg.shot] || [];
        const at = list.findIndex((v) => v.name === cfg.version);
        const wasActive = at >= 0 && list[at].active;
        if (at >= 0) list.splice(at, 1);
        let promoted = '';
        if (wasActive && list.length) { list[0].active = true; promoted = list[0].name; }
        if (!list.length) delete ae.built[cfg.shot];
        return { removed: at >= 0 ? 1 : 0, promoted };
      }
      case 'ef_vis_setActive':
        (ae.built[cfg.shot] || []).forEach((v) => { v.active = v.name === cfg.version; });
        return { ok: true };
      case 'ef_vis_openComp':
        ae.opened = cfg;
        return { opened: cfg.version || 'master' };
      case 'ef_vis_clearAll':
        ae.built = {}; ae.master = null;
        return { removed: 1 };
      default:
        throw new Error('unexpected fn ' + fn);
    }
  };
  return ae;
}

/** Load a FRESH copy of the view — this is what "reopening the panel" means. */
function openPanel(ae, store) {
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const view = loadEsm(SRC, {
    callExtendScript: (fn, arg) => ae.call(fn, arg),
    parseShotlist: MODEL.parseShotlist,
    reconcile: MODEL.reconcile,
    masterPlan: MODEL.masterPlan,
    localStorage,
    window: { __editflowCompInfo: { width: 1920, height: 1080, frameRate: 30 },
              confirm: () => true },
    document: { querySelectorAll: () => [], querySelector: () => null },
  });
  view.setVisualsRerender(() => {});
  return view;
}

/* ── the reported bug ── */

test('reopening the panel restores the shotlist AND the builds', async () => {
  const ae = fakeAE();
  const store = {};

  // session 1: load a shotlist, build both shots
  const first = openPanel(ae, store);
  first.visualsTabInit();
  await first.sync({ force: true });
  await first._test.loadShotlist(SHOTLIST, 'shotlist-38000.json');
  await first._test.buildAll();
  assert.equal(first._test.state().rows.filter((r) => r.built).length, 2);

  // session 2: After Effects was closed and reopened. Same project file,
  // brand new panel with no memory whatsoever.
  const second = openPanel(ae, store);
  second.visualsTabInit();
  await second.sync({ force: true });
  const s = second._test.state();
  assert.equal(s.shots.length, 2, 'the shotlist came back from the sidecar');
  assert.equal(s.source, 'shotlist-38000.json');
  assert.equal(s.rows.filter((r) => r.built).length, 2, 'and both builds are still there');
  assert.equal(s.rows[0].activeVersion, 'shot_01 v1');
  assert.equal(s.error, null);
});

test('a shotlist is written beside the project, not into browser storage', async () => {
  const ae = fakeAE();
  const store = {};
  const v = openPanel(ae, store);
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  assert.ok(ae.sidecar, 'the sidecar holds it');
  assert.equal(JSON.parse(ae.sidecar).shots.length, 2);
  assert.ok(!store.editflow_visuals_unsaved,
            'a saved project must not fall back to this machine only');
});

test('an unsaved project keeps the shotlist locally and says so', async () => {
  const ae = fakeAE({ saved: false });
  const store = {};
  const v = openPanel(ae, store);
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  assert.equal(ae.sidecar, null, 'there is nowhere to write it');
  assert.ok(store.editflow_visuals_unsaved, 'so it is kept here instead');
  assert.equal(v._test.state().project.saved, false);

  const again = openPanel(ae, store);
  again.visualsTabInit();
  await again.sync({ force: true });
  assert.equal(again._test.state().shots.length, 2, 'and still restored next time');
});

test('opening a different project does not show the previous project s shotlist', async () => {
  const ae = fakeAE();
  const store = {};
  const v = openPanel(ae, store);
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'first.json');
  assert.equal(v._test.state().shots.length, 2);

  ae.projectPath = 'G:/Docs/Other.aep';    // user opened another project
  ae.sidecar = null;
  ae.built = {};
  await v.sync({ force: false });
  assert.equal(v._test.state().shots.length, 0, 'a stale shotlist would be a lie');
});

/* ── the project is the truth ── */

test('a comp built by hand shows up without the panel being told', async () => {
  const ae = fakeAE();
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  assert.equal(v._test.state().rows[0].built, false);

  ae.built.shot_01 = [{ name: 'shot_01 v1', active: true, duration: 5, layers: 4 }];
  await v.sync({ force: false });
  assert.equal(v._test.state().rows[0].built, true);
});

test('work with no shotlist is still listed, never silently dropped', async () => {
  const ae = fakeAE({ built: { shot_09: [{ name: 'shot_09 v1', active: true, duration: 5, layers: 4 }] } });
  const v = openPanel(ae, {});
  v.visualsTabInit();
  await v.sync({ force: true });
  const rows = v._test.state().rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orphan, true, 'shown as "in project" rather than hidden');
  assert.equal(rows[0].built, true);
});

/* ── the delete-the-wrong-version bug ── */

test('the delete button removes the version chosen in the dropdown', async () => {
  // it used to always delete the ACTIVE version, whatever was selected
  const ae = fakeAE({ built: { shot_01: [
    { name: 'shot_01 v1', active: true, duration: 5, layers: 4 },
    { name: 'shot_01 v2', active: false, duration: 5, layers: 4 },
  ] } });
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  v._test.pick('shot_01', 'shot_01 v2');
  await v._test.deleteVersion('shot_01');
  assert.deepEqual(ae.built.shot_01.map((x) => x.name), ['shot_01 v1'],
                   'v2 was selected, so v2 is what goes');
});

test('deleting the active version leaves the shot with a new active one', async () => {
  const ae = fakeAE({ built: { shot_01: [
    { name: 'shot_01 v1', active: true, duration: 5, layers: 4 },
    { name: 'shot_01 v2', active: false, duration: 5, layers: 4 },
  ] } });
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  await v._test.deleteVersion('shot_01');          // no pick: the active one
  assert.equal(ae.built.shot_01.length, 1);
  assert.equal(ae.built.shot_01[0].active, true, 'a starless shot drops out of the master');
});

/* ── failures stay visible ── */

test('one failing shot neither stops the batch nor disappears', async () => {
  const ae = fakeAE();
  const real = ae.call;
  ae.call = async (fn, arg) => {
    const cfg = typeof arg === 'string' ? JSON.parse(arg) : arg;
    if (fn === 'ef_vis_buildShot' && cfg.spec.id === 'shot_01') throw new Error('AE said no');
    return real(fn, arg);
  };
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  await v._test.buildAll();
  const s = v._test.state();
  assert.equal(s.rows[1].built, true, 'shot_02 still built');
  assert.equal(s.buildLog.length, 2);
  assert.equal(s.buildLog[0].ok, false);
  assert.match(s.buildLog[0].text, /shot_01.*AE said no/);
});

test('losing the AE bridge does not blank the tab', async () => {
  const ae = fakeAE();
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  ae.call = async () => { throw new Error('Adobe CEP bridge unavailable'); };
  await v.sync({ force: true });
  const s = v._test.state();
  assert.equal(s.rows.length, 2, 'the shotlist is still on screen');
  assert.match(s.error, /After Effects not connected/);
});

/* ── the master ── */

test('the master is built from the active versions and reports its gaps', async () => {
  const ae = fakeAE({ built: { shot_01: [{ name: 'shot_01 v1', active: true, duration: 5, layers: 4 }] } });
  const v = openPanel(ae, {});
  await v.sync({ force: true });
  await v._test.loadShotlist(SHOTLIST, 'x.json');
  const plan = MODEL.masterPlan(v._test.state().rows, 30);
  assert.deepEqual(plan.missing, ['shot_02']);
  assert.equal(plan.order[1].startTime, 5, 'shot_02 keeps its slot');
});
