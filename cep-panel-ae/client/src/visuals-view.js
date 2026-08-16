/**
 * visuals-view.js — the Visuals tab.
 *
 * Lives in its own module so captions-view.js doesn't grow another thousand
 * lines, but renders with the SAME cap-* design system so the tab looks
 * native rather than bolted on.
 *
 * STATE MODEL — the thing that matters here:
 *
 *   What is BUILT lives in the After Effects project (comps under
 *   EF Visuals/). The panel holds no authority over it and re-reads it on
 *   every open. Closing AE, reloading the panel, or switching projects
 *   therefore cannot lose a single build.
 *
 *   The SHOTLIST has no home inside an .aep, so it is written to a sidecar
 *   file beside the project: MyDoc.aep -> MyDoc.editflow-visuals.json.
 *   It travels with the project and opens in any text editor.
 *
 *   An unsaved project has nowhere to put that file. The panel says so out
 *   loud and keeps the shotlist in browser storage until you save.
 *
 * Anything the project contains is shown even when the shotlist is gone —
 * a lost shotlist must never read as lost work.
 */
import { callExtendScript } from './extendscript.js';
import { parseShotlist, reconcile, masterPlan, DELIVERABLE } from './shotlist-model.js';

const LS_KEY = 'editflow_visuals';
const LS_UNSAVED = 'editflow_visuals_unsaved';

const V = {
  shots: [],           // specs from the shotlist
  errors: [],
  skipped: [],
  rows: [],            // reconcile() output — what the table renders
  master: null,        // { name, duration, layers } if a master exists
  project: null,       // { saved, name, path, statePath }
  status: null,
  error: null,
  busy: false,
  building: '',
  buildLog: [],        // per-shot outcome of the last batch
  visualsRoot: '',      // the project's visuals/ folder; every path resolves under it
  assets: null,         // ef_vis_scanAssets result: what is actually on disk
  source: '',
  picked: {},          // shotId -> version chosen in the dropdown
  loaded: false,
};

const _esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── Public API used by captions-view's tab host ── */

export function visualsTabHTML(compInfo) {
  return `
  <div class="cap-card">
    <div class="cap-card-title">🎬 Visual Shots</div>
    <div class="cap-card-subtitle">Build Content Factory shots as native AE comps — one comp per shot, every build kept as a version.</div>
    ${_projectRowHTML()}
    ${_sourceRowHTML()}
    ${_assetsRowHTML()}
    ${V.error ? `<div class="cap-status-err" style="margin-top:10px;">${_esc(V.error)}</div>` : ''}
    ${V.status ? `<div class="cap-status-progress" style="margin-top:10px;">${_esc(V.status)}</div>` : ''}
  </div>
  ${V.rows.length ? _shotTableHTML(compInfo) : _emptyHTML()}
  ${V.master ? _masterHTML() : ''}
  ${V.buildLog.length ? _buildLogHTML() : ''}
  ${(V.errors.length || V.skipped.length) ? _problemsHTML() : ''}`;
}

export function wireVisualsTab(root) {
  const $ = (sel) => root.querySelector(sel);

  const file = $('#vis-file');
  if (file) file.onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    _loadShotlist(await f.text(), f.name);
  };

  const pasteBtn = $('#vis-paste-btn');
  if (pasteBtn) pasteBtn.onclick = () => { V._showPaste = !V._showPaste; _rerender(); };

  const pasteUse = $('#vis-paste-use');
  if (pasteUse) pasteUse.onclick = () => {
    const ta = $('#vis-paste-text');
    if (ta) _loadShotlist(ta.value, 'pasted');
  };

  const dir = $('#vis-assets-dir');
  if (dir) dir.oninput = (e) => {
    V.visualsRoot = e.target.value;
    _save();
    clearTimeout(V._scanTimer);
    V._scanTimer = setTimeout(() => _scanAssets().then(_rerender), 400);
  };

  const buildAll = $('#vis-build-all');
  if (buildAll) buildAll.onclick = () => _buildAll();

  const master = $('#vis-build-master');
  if (master) master.onclick = () => _buildMaster();

  const openMaster = $('#vis-open-master');
  if (openMaster) openMaster.onclick = () => _open({ master: true });

  const clear = $('#vis-clear');
  if (clear) clear.onclick = () => _clearAll();

  const refresh = $('#vis-refresh');
  if (refresh) refresh.onclick = () => sync({ force: true });

  const forget = $('#vis-forget');
  if (forget) forget.onclick = () => _forgetShotlist();

  root.querySelectorAll('.vis-build-one').forEach((b) => {
    b.onclick = (e) => _buildOne(e.currentTarget.dataset.shot);
  });
  root.querySelectorAll('.vis-version-pick').forEach((sel) => {
    sel.onchange = (e) => {
      V.picked[e.currentTarget.dataset.shot] = e.target.value;
      _setActive(e.currentTarget.dataset.shot, e.target.value);
    };
  });
  root.querySelectorAll('.vis-version-del').forEach((b) => {
    b.onclick = (e) => _deleteVersion(e.currentTarget.dataset.shot);
  });
  root.querySelectorAll('.vis-open').forEach((b) => {
    b.onclick = (e) => _open({ shot: e.currentTarget.dataset.shot,
                              version: _selected(e.currentTarget.dataset.shot) });
  });
}

export function visualsTabInit() {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (o) V.visualsRoot = o.visualsRoot || o.assetsDir || '';
  } catch (_) { /* first run */ }
  // Don't block startup on AE; sync as soon as the bridge answers.
  sync().catch(() => {});
}

/**
 * Re-read everything from After Effects. Safe to call often — the tab host
 * calls it every time the tab is opened, so switching projects, building
 * comps by hand, or reopening AE all reconcile without a button press.
 */
export function sync(opts) {
  // Serialised, not skipped. A sync that bailed out because another was in
  // flight used to let the slower one finish LAST and overwrite a shotlist
  // the user had just loaded — the panel would blank itself a second after
  // opening. Every caller now waits for its own turn.
  _syncTail = _syncTail.then(() => _syncNow(opts)).catch(() => {});
  return _syncTail;
}
let _syncTail = Promise.resolve();

async function _syncNow(opts) {
  const force = !!(opts && opts.force);
  try {
    const info = await callExtendScript('ef_vis_projectInfo');
    const switched = !V.project || V.project.path !== info.path;
    V.project = info;

    if (switched || force || !V.loaded) {
      await _loadSavedState();
      V.loaded = true;
    }
    await _readProject();
    V.error = null;
  } catch (e) {
    // No AE (browser rig, or panel opened outside AE) — keep whatever the
    // shotlist gave us rather than blanking the tab.
    V.rows = reconcile(V.shots, { shots: [] }).rows;
    V.error = _aeError(e);
  } finally {
    _rerender();
  }
}

/* ── Persistence ── */

function _stateBlob() {
  return {
    version: 1,
    visualsRoot: V.visualsRoot,
    source: V.source,
    shots: V.shots,
    errors: V.errors,
    skipped: V.skipped,
    savedAt: new Date().toISOString(),
  };
}

function _applyStateBlob(o) {
  if (!o || typeof o !== 'object') return false;
  V.shots = Array.isArray(o.shots) ? o.shots : [];
  V.errors = Array.isArray(o.errors) ? o.errors : [];
  V.skipped = Array.isArray(o.skipped) ? o.skipped : [];
  V.source = o.source || '';
  if (o.visualsRoot || o.assetsDir) V.visualsRoot = o.visualsRoot || o.assetsDir;
  return true;
}

async function _loadSavedState() {
  // assetsDir is a machine preference, not project data — always local
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (o) V.visualsRoot = o.visualsRoot || o.assetsDir || V.visualsRoot;
  } catch (_) {}

  if (V.project && V.project.saved) {
    try {
      const res = await callExtendScript('ef_vis_readState');
      if (res && res.data) { _applyStateBlob(JSON.parse(res.data)); return; }
    } catch (_) { /* fall through to local */ }
    // A saved project with no sidecar yet: start clean rather than
    // inheriting whatever the last project had loaded.
    V.shots = []; V.errors = []; V.skipped = []; V.source = '';
    return;
  }

  try { _applyStateBlob(JSON.parse(localStorage.getItem(LS_UNSAVED) || 'null')); } catch (_) {}
}

/* Returns a promise so a caller can be sure the shotlist is on disk before
   anything reads it back. A fire-and-forget write raced Refresh. */
function _save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ visualsRoot: V.visualsRoot })); } catch (_) {}
  const blob = _stateBlob();
  if (V.project && V.project.saved) {
    return callExtendScript('ef_vis_writeState', JSON.stringify({ data: JSON.stringify(blob) }))
      .catch(() => { /* a failed sidecar write must not break the build flow */ });
  }
  try { localStorage.setItem(LS_UNSAVED, JSON.stringify(blob)); } catch (_) {}
  return Promise.resolve();
}

async function _readProject() {
  const list = await callExtendScript('ef_vis_listAll');
  const r = reconcile(V.shots, list);
  V.rows = r.rows;
  V.master = r.master;
  await _scanAssets();
}

/**
 * Ask the disk what is actually there. A brief naming a file nobody dropped
 * in must show as waiting on its row BEFORE you press Build, rather than
 * becoming a magenta placeholder you find in the render.
 */
async function _scanAssets() {
  V.assets = null;
  if (!V.visualsRoot || !V.shots.length) return;
  const dirs = [...new Set(V.shots.map((s) => s.assetDir).filter(Boolean))];
  // captures resolve from the ROOT, shot assets from assetDir — two lists,
  // because joining a capture onto the shot folder silently finds nothing
  const images = [...new Set(V.shots
    .map((s) => s.sourceAnchor && s.sourceAnchor.image).filter(Boolean))];
  if (!dirs.length && !images.length) return;
  try {
    V.assets = await callExtendScript('ef_vis_scanAssets',
      JSON.stringify({ root: V.visualsRoot, dirs, images }));
  } catch (e) {
    V.assets = { error: _aeError(e) };
  }
}

/** Files this shot names that are not on disk yet. */
function _missingFor(spec) {
  if (!spec || !V.assets || V.assets.error) return [];
  const out = [];
  const have = (V.assets.dirs || {})[spec.assetDir];
  for (const name of spec.assets || []) {
    if (!have || have.indexOf(name) < 0) out.push(name);
  }
  const img = spec.sourceAnchor && spec.sourceAnchor.image;
  if (img && (V.assets.missingImages || []).indexOf(img) >= 0) out.push(img);
  return out;
}

/* ── Rendering ── */

function _projectRowHTML() {
  if (!V.project) return '';
  if (!V.project.saved) {
    return `<div class="cap-status-warn" style="margin-bottom:8px;">
      ⚠ This After Effects project has never been saved. Your shots still build,
      but the shotlist can only be remembered on this machine until you
      <strong>File → Save</strong> the project.
    </div>`;
  }
  return `<div class="cap-dim" style="font-size:11px;margin-bottom:8px;">
    Bound to <strong>${_esc(V.project.name)}</strong>${V.project.hasState ? ' · shotlist remembered alongside it' : ''}
  </div>`;
}

function _sourceRowHTML() {
  return `
    <div class="cap-btn-group" style="margin-bottom:8px;">
      <label class="cap-btn cap-btn-primary" style="cursor:pointer" title="Load a shotlist.json exported from the Documentary Studio app">
        📂 Load Shotlist<input type="file" id="vis-file" accept=".json,application/json" style="display:none" />
      </label>
      <button id="vis-paste-btn" class="cap-btn cap-btn-secondary">📋 Paste</button>
      <button id="vis-refresh" class="cap-btn cap-btn-secondary" title="Re-read this project — what is built, and which version is active">↻ Refresh</button>
      ${V.shots.length ? `<button id="vis-forget" class="cap-btn cap-btn-secondary" title="Forget the loaded shotlist. Your built comps are untouched.">Forget shotlist</button>` : ''}
    </div>
    ${V.source ? `<div class="cap-dim" style="font-size:11px;margin-bottom:6px;">Shotlist <strong>${_esc(V.source)}</strong> — ${V.shots.length} shot${V.shots.length === 1 ? '' : 's'}</div>` : ''}
    ${V._showPaste ? `<div class="cap-paste-area">
      <textarea id="vis-paste-text" placeholder='Paste shotlist JSON: {"shots":[{"id":"shot_01","archetype":"STAT_COUNTER",...}]}'></textarea>
      <div class="cap-btn-group" style="margin-top:6px;">
        <button id="vis-paste-use" class="cap-btn cap-btn-primary">Use This Shotlist</button>
      </div>
    </div>` : ''}`;
}

function _assetsRowHTML() {
  const a = V.assets;
  const files = a && a.dirs
    ? Object.keys(a.dirs).reduce((n, k) => n + a.dirs[k].length, 0) : 0;
  const note = !V.visualsRoot
    ? 'Set this to your project\'s visuals folder. Every file the brief names is looked up under it.'
    : a && a.error ? a.error
    : a ? `${files} file${files === 1 ? '' : 's'} found` +
          `${(a.missingDirs || []).length ? ` · ${a.missingDirs.length} folder(s) not created yet` : ''}` +
          `${(a.missingImages || []).length ? ` · ${a.missingImages.length} capture(s) missing` : ''}`
    : 'Nothing to look up yet — load a brief.';
  return `
    <div class="cap-row">
      <label class="cap-label" title="Your project's visuals/ folder. Shot files resolve under assets/<the brief's assetDir>/; captures resolve from this root.">Visuals Folder</label>
      <input type="text" class="cap-input" id="vis-assets-dir" value="${_esc(V.visualsRoot)}"
             placeholder="e.g. G:\\Content\\my-video\\visuals" style="flex:1" />
    </div>
    <div class="cap-dim" style="font-size:10px;margin:-2px 0 6px;">${_esc(note)}</div>`;
}

function _emptyHTML() {
  return `<div class="cap-card">
    <div class="cap-hint" style="margin:0;">
      Nothing built in this project yet, and no shotlist loaded.<br>
      Export a shotlist from the Documentary Studio app, or paste the JSON.<br>
      This tab builds <strong>STAT_COUNTER</strong>, <strong>BAR_CHART</strong> and
      <strong>SECTION_TITLE_CARD</strong> — b-roll and emotional shots stay with your generative tools.
    </div>
  </div>`;
}

function _shotTableHTML(compInfo) {
  const fps = DELIVERABLE.fps;
  const plan = masterPlan(V.rows, fps);
  const total = plan.order.reduce((a, r) => a + r.duration, 0);
  const built = V.rows.filter((r) => r.built).length;
  const rows = V.rows.map((r) => _shotRowHTML(r)).join('');
  return `
  <div class="cap-card">
    <div class="cap-card-title">📋 Shots (${built}/${V.rows.length} built)${total ? ` · ${total.toFixed(1)}s total` : ''}</div>
    <div class="vis-table">${rows}</div>
    <div class="cap-btn-group" style="margin-top:10px;">
      <button id="vis-build-all" class="cap-btn cap-btn-primary" ${V.busy || !V.shots.length ? 'disabled' : ''}>
        ${V.busy ? `Building ${_esc(V.building)}…` : `🚀 Build All (${V.shots.length})`}
      </button>
      <button id="vis-build-master" class="cap-btn cap-btn-secondary" ${V.busy || !V.shots.length ? 'disabled' : ''}
              title="${plan.missing.length ? `Not built yet, will leave a gap: ${_esc(plan.missing.join(', '))}` : 'Lay every shot\'s active version end-to-end into one comp you can render'}">
        🎞 Build Master${plan.missing.length ? ` (${plan.missing.length} missing)` : ''}</button>
      <button id="vis-clear" class="cap-btn cap-btn-danger" ${V.busy ? 'disabled' : ''}
              title="Remove every generated shot and version from the project">🗑 Clear All</button>
    </div>
  </div>`;
}

function _masterHTML() {
  return `<div class="cap-card">
    <div class="cap-row" style="align-items:center;">
      <div style="flex:1">
        <div class="cap-card-title" style="margin:0">🎞 ${_esc(V.master.name)}</div>
        <div class="cap-dim" style="font-size:11px;">${Number(V.master.duration).toFixed(1)}s · ${V.master.layers} shot${V.master.layers === 1 ? '' : 's'} placed</div>
      </div>
      <button id="vis-open-master" class="cap-btn cap-btn-secondary cap-btn-tiny">Open</button>
    </div>
  </div>`;
}

function _buildLogHTML() {
  return `<div class="cap-card">
    <div class="cap-card-title">🧾 Last build</div>
    <ul class="cap-error-list">
      ${V.buildLog.map((l) => `<li style="color:${l.ok ? 'var(--text-2)' : 'var(--error)'}">${_esc(l.text)}</li>`).join('')}
    </ul>
  </div>`;
}

function _shotRowHTML(r) {
  const s = r.spec;
  const sel = _selected(r.id);

  const versionCell = r.versions.length
    ? `<select class="cap-select vis-version-pick" data-shot="${_esc(r.id)}" style="width:auto;font-size:10px;padding:2px 4px;">
         ${r.versions.map((v) => `<option value="${_esc(v.name)}" ${v.name === sel ? 'selected' : ''}>${_esc(v.name)}${v.active ? ' ★' : ''}</option>`).join('')}
       </select>
       <button class="cap-icon-btn vis-open" data-shot="${_esc(r.id)}" title="Open this version in After Effects">↗</button>
       <button class="cap-icon-btn vis-version-del" data-shot="${_esc(r.id)}" title="Delete the version selected on the left">🗑</button>`
    : `<span class="cap-dim" style="font-size:10px;">not built</span>`;

  const status = r.built
    ? `<span class="cap-pill cap-pill-ok" title="${_esc(r.activeVersion)} · ${r.activeLayers} layers">✓ ${r.versions.length > 1 ? `${r.versions.length} versions` : `${r.activeLayers} layers`}${r.activeDuration ? ` · ${r.activeDuration.toFixed(1)}s` : ''}</span>`
    : '';

  if (r.orphan) {
    return `
    <div class="vis-row">
      <div class="vis-row-main">
        <span class="vis-arch" title="Built in this project, but not in the loaded shotlist">IN PROJECT</span>
        <span class="vis-id">${_esc(r.id)}</span>
        <span class="vis-summary cap-dim">not in the current shotlist — your build is safe, load its shotlist to rebuild it</span>
        ${status}
      </div>
      <div class="vis-row-actions">${versionCell}</div>
    </div>`;
  }

  const missing = _missingFor(s);
  const elsewhere = s.productionRoute && s.productionRoute !== 'after_effects';

  // Everything the brief said that changes what you get, made visible. A
  // field carried but never shown is a field the web agent wrote for nothing.
  const marks = [
    s.placement === 'overlay'
      ? `<span class="cap-pill" title="Sits over your footage and takes no slot in the master">overlay</span>` : '',
    elsewhere
      ? `<span class="cap-pill" title="${_esc(s.routeReason || 'made outside After Effects')}">${_esc(s.productionRoute)}</span>` : '',
    missing.length
      ? `<span class="cap-pill cap-pill-warn" title="Not on disk yet: ${_esc(missing.join(', '))}">⏳ waiting for ${missing.length} file${missing.length === 1 ? '' : 's'}</span>` : '',
    (s.needs || []).length
      ? `<span class="cap-pill cap-pill-warn" title="The brief says these are still to be filled: ${_esc(s.needs.join(', '))}">needs ${s.needs.length}</span>` : '',
    (s.warnings || []).length
      ? `<span class="cap-pill cap-pill-warn" title="${_esc(s.warnings.join(' · '))}">⚠ ${s.warnings.length}</span>` : '',
  ].join('');

  return `
  <div class="vis-row${V.building === r.id ? ' vis-row-active' : ''}">
    <div class="vis-row-main">
      <span class="vis-arch vis-arch-${_esc(String(s.archetype).toLowerCase())}">${_esc(_shortArch(s.archetype))}</span>
      <span class="vis-id">${_esc(r.id)}</span>
      <span class="vis-summary" title="${_esc(s.scriptLine)}">${_esc(_summarize(s))}</span>
      ${s.talkingHead ? `<span class="cap-pill" title="This shot sits over you — check the framing">🗣</span>` : ''}
      ${marks}
      ${status}
    </div>
    <div class="vis-row-actions">
      ${versionCell}
      <button class="cap-btn cap-btn-tertiary vis-build-one" data-shot="${_esc(r.id)}" ${V.busy ? 'disabled' : ''}>${r.built ? 'Rebuild' : 'Build'}</button>
    </div>
  </div>`;
}

function _shortArch(a) {
  return { STAT_COUNTER: 'STAT', BAR_CHART: 'BARS', SECTION_TITLE_CARD: 'TITLE' }[a] || a;
}

function _summarize(s) {
  if (s.archetype === 'STAT_COUNTER') {
    return `${s.title || 'value'} → ${s.prefix || ''}${Number(s.value).toLocaleString('en-US')}${s.unit ? ' ' + s.unit : ''}`;
  }
  if (s.archetype === 'BAR_CHART') {
    return `${s.bars.length} bars · ${s.bars.map((b) => b.label).filter(Boolean).slice(0, 3).join(', ')}`;
  }
  return s.title || '';
}

function _problemsHTML() {
  return `<div class="cap-card">
    <div class="cap-card-title">⚠ Not built</div>
    ${V.errors.length ? `<div class="cap-hint" style="margin:4px 0;"><strong>Errors</strong> — these shots are the right type but their data is wrong:</div>
      <ul class="cap-error-list">${V.errors.map((e) => `<li>${_esc(e)}</li>`).join('')}</ul>` : ''}
    ${V.skipped.length ? `<div class="cap-hint" style="margin:8px 0 4px;"><strong>Skipped</strong> — archetypes After Effects doesn't build in v1 (they belong to your generative tools):</div>
      <ul class="cap-error-list" style="color:var(--text-3);">${V.skipped.map((e) => `<li>${_esc(e)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

/* ── Actions ── */

async function _loadShotlist(text, source) {
  const parsed = parseShotlist(text, { fps: DELIVERABLE.fps });
  V.shots = parsed.shots;
  V.errors = parsed.errors;
  V.skipped = parsed.skipped;
  V.source = source;
  V.buildLog = [];
  V._showPaste = false;
  V.error = parsed.shots.length ? null : (parsed.errors[0] || 'No buildable shots in that file.');
  V.status = parsed.shots.length ? `${parsed.shots.length} shot${parsed.shots.length === 1 ? '' : 's'} loaded.` : null;
  _rerender();
  await _save();
  return sync({ force: false });
}

function _forgetShotlist() {
  if (!window.confirm('Forget the loaded shotlist?\n\nEvery comp you have built stays in the project — they will show as "IN PROJECT" rows.')) return;
  V.shots = []; V.errors = []; V.skipped = []; V.source = ''; V.buildLog = [];
  V.status = 'Shotlist forgotten. Your builds are untouched.';
  _save().then(() => sync({ force: false })).catch(() => {});
}

function _selected(shotId) {
  if (V.picked[shotId]) return V.picked[shotId];
  const row = V.rows.find((r) => r.id === shotId);
  return row ? row.activeVersion : '';
}

function _buildPayload(spec) {
  return {
    spec,
    // Settled, not inherited: an accidentally-open vertical comp used to
    // build the entire brief vertical. See DELIVERABLE in shotlist-model.js.
    width: DELIVERABLE.width,
    height: DELIVERABLE.height,
    fps: DELIVERABLE.fps,
    visualsRoot: V.visualsRoot,
    fontPS: _captionFont(),
    boxWidthPct: 90,
  };
}

async function _buildOne(shotId) {
  const spec = V.shots.find((s) => s.id === shotId);
  if (!spec || V.busy) return;
  V.busy = true; V.building = shotId; V.error = null; _rerender();
  try {
    const res = await callExtendScript('ef_vis_buildShot', JSON.stringify(_buildPayload(spec)));
    V.status = `Built ${res.comp} (${res.layers} layers).`;
    V.buildLog = [{ ok: true, text: `${shotId}: ${res.comp}, ${res.layers} layers` +
      (res.missingAssets && res.missingAssets.length ? ` · missing ${res.missingAssets.join(', ')}` : '') }];
  } catch (e) {
    V.error = _aeError(e);
    V.buildLog = [{ ok: false, text: `${shotId}: ${_aeError(e)}` }];
  } finally {
    V.busy = false; V.building = '';
    delete V.picked[shotId];          // a new version exists; follow the star
    await sync({ force: false });
  }
}

async function _buildAll() {
  if (V.busy || !V.shots.length) return;
  V.busy = true; V.error = null; V.buildLog = [];
  let ok = 0, failed = 0;
  for (const spec of V.shots) {
    V.building = spec.id;
    V.status = `Building ${spec.id}… (${ok + failed + 1}/${V.shots.length})`;
    _rerender();
    try {
      const res = await callExtendScript('ef_vis_buildShot', JSON.stringify(_buildPayload(spec)));
      ok++;
      V.buildLog.push({ ok: true, text: `${spec.id}: ${res.comp}, ${res.layers} layers` +
        (res.missingAssets && res.missingAssets.length ? ` · missing ${res.missingAssets.join(', ')}` : '') });
    } catch (e) {
      // one bad shot must never stop the batch, and must never be silent
      failed++;
      V.buildLog.push({ ok: false, text: `${spec.id}: ${_aeError(e)}` });
    }
    delete V.picked[spec.id];
  }
  V.busy = false; V.building = '';
  V.status = `Built ${ok} of ${V.shots.length}${failed ? `, ${failed} failed — see below` : ''}.`;
  await sync({ force: false });
}

async function _buildMaster() {
  if (V.busy || !V.shots.length) return;
  V.busy = true; V.error = null; V.status = 'Building master…'; _rerender();
  try {
    const plan = masterPlan(V.rows, DELIVERABLE.fps);
    const res = await callExtendScript('ef_vis_buildMaster', JSON.stringify({
      order: plan.order, width: DELIVERABLE.width,
      height: DELIVERABLE.height, fps: DELIVERABLE.fps,
    }));
    V.status = `Master built: ${res.placed} shot${res.placed === 1 ? '' : 's'}, ${Number(res.duration).toFixed(1)}s` +
               `${res.missing && res.missing.length ? ` · gaps left for: ${res.missing.join(', ')}` : ''}.`;
  } catch (e) {
    V.error = _aeError(e);
  } finally { V.busy = false; await sync({ force: false }); }
}

async function _clearAll() {
  if (V.busy) return;
  if (!window.confirm('Remove every generated shot, every version, and the master comp from this project?\n\nThis cannot be undone from the panel.\nYour shotlist stays loaded.')) return;
  V.busy = true; _rerender();
  try {
    await callExtendScript('ef_vis_clearAll');
    V.picked = {};
    V.status = 'Cleared.';
  } catch (e) { V.error = _aeError(e); }
  finally { V.busy = false; await sync({ force: false }); }
}

async function _setActive(shotId, version) {
  try {
    await callExtendScript('ef_vis_setActive', JSON.stringify({ shot: shotId, version }));
    delete V.picked[shotId];
    await sync({ force: false });
  } catch (e) { V.error = _aeError(e); _rerender(); }
}

async function _deleteVersion(shotId) {
  const version = _selected(shotId);
  if (!version) return;
  const row = V.rows.find((r) => r.id === shotId);
  const last = row && row.versions.length === 1;
  if (!window.confirm(`Delete ${version}?${last ? '\n\nThis is the only version of this shot.' : ''}`)) return;
  try {
    const res = await callExtendScript('ef_vis_deleteVersion', JSON.stringify({ shot: shotId, version }));
    delete V.picked[shotId];
    V.status = res.promoted ? `Deleted ${version} — ${res.promoted} is now active.` : `Deleted ${version}.`;
    await sync({ force: false });
  } catch (e) { V.error = _aeError(e); _rerender(); }
}

async function _open(target) {
  try {
    await callExtendScript('ef_vis_openComp', JSON.stringify(target));
  } catch (e) { V.error = _aeError(e); _rerender(); }
}

/* ── Helpers ── */

function _aeError(e) {
  const msg = String((e && e.message) || e);
  if (/CSInterface|bridge unavailable/i.test(msg)) {
    return 'After Effects not connected — open this panel inside AE (Window → Extensions).';
  }
  return msg;
}

/* The host view owns comp info and the chosen font; read them without
   importing captions-view (which would be a circular import). */
function _compInfo() { return window.__editflowCompInfo || null; }
function _captionFont() { return window.__editflowFontPS || ''; }

/* Test seam. The tab's real entry points are DOM events, and driving those
   in node would mean simulating CEP and the whole panel shell. These are the
   very functions the click handlers call — there is no test-only behaviour
   behind them. */
export const _test = {
  state: () => V,
  loadShotlist: _loadShotlist,
  buildOne: _buildOne,
  buildAll: _buildAll,
  buildMaster: _buildMaster,
  setActive: _setActive,
  deleteVersion: _deleteVersion,
  clearAll: _clearAll,
  pick: (shotId, version) => { V.picked[shotId] = version; },
};

let _rerenderHook = null;
export function setVisualsRerender(fn) { _rerenderHook = fn; }
function _rerender() { if (_rerenderHook) _rerenderHook(); }
