/**
 * visuals-view.js — the Visuals tab.
 *
 * Lives in its own module so captions-view.js doesn't grow another thousand
 * lines, but renders with the SAME cap-* design system so the tab looks
 * native rather than bolted on.
 *
 * Flow: load a shotlist → review the shots → build → pick the version you
 * like → build the master. Nothing auto-runs, nothing is hidden.
 */
import { apiPost } from './api.js';
import { callExtendScript } from './extendscript.js';
import { parseShotlist, masterOrder, nextVersionName } from './shotlist-model.js';

const V = {
  shots: [],
  errors: [],
  skipped: [],
  versions: {},        // shotId -> ["★ shot_01 v1", "shot_01 v2"]
  status: null,
  error: null,
  busy: false,
  building: '',        // shot id currently building
  results: {},         // shotId -> { comp, layers, missingAssets }
  assetsDir: '',
  source: '',          // where the shotlist came from, for the header
};

const _esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── Public API used by captions-view's tab host ── */

export function visualsTabHTML(compInfo) {
  return `
  <div class="cap-card">
    <div class="cap-card-title">🎬 Visual Shots</div>
    <div class="cap-card-subtitle">Build Content Factory shots as native AE comps — one comp per shot, every build kept as a version.</div>
    ${_sourceRowHTML()}
    ${_assetsRowHTML()}
    ${V.error ? `<div class="cap-status-err" style="margin-top:10px;">${_esc(V.error)}</div>` : ''}
    ${V.status ? `<div class="cap-status-progress" style="margin-top:10px;">${_esc(V.status)}</div>` : ''}
  </div>
  ${V.shots.length ? _shotTableHTML(compInfo) : _emptyHTML()}
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
  if (dir) dir.oninput = (e) => { V.assetsDir = e.target.value; _persist(); };

  const buildAll = $('#vis-build-all');
  if (buildAll) buildAll.onclick = () => _buildAll();

  const master = $('#vis-build-master');
  if (master) master.onclick = () => _buildMaster();

  const clear = $('#vis-clear');
  if (clear) clear.onclick = () => _clearAll();

  const refresh = $('#vis-refresh');
  if (refresh) refresh.onclick = () => _refreshVersions();

  root.querySelectorAll('.vis-build-one').forEach((b) => {
    b.onclick = (e) => _buildOne(e.currentTarget.dataset.shot);
  });
  root.querySelectorAll('.vis-version-pick').forEach((sel) => {
    sel.onchange = (e) => _setActive(e.currentTarget.dataset.shot, e.target.value);
  });
  root.querySelectorAll('.vis-version-del').forEach((b) => {
    b.onclick = (e) => _deleteVersion(e.currentTarget.dataset.shot, e.currentTarget.dataset.version);
  });
}

export function visualsTabInit() {
  try {
    const saved = localStorage.getItem('editflow_visuals');
    if (saved) {
      const o = JSON.parse(saved);
      V.assetsDir = o.assetsDir || '';
    }
  } catch (_) { /* first run */ }
}

/* ── Rendering ── */

function _sourceRowHTML() {
  return `
    <div class="cap-btn-group" style="margin-bottom:8px;">
      <label class="cap-btn cap-btn-primary" style="cursor:pointer" title="Load a shotlist.json exported from the Documentary Studio app">
        📂 Load Shotlist<input type="file" id="vis-file" accept=".json,application/json" style="display:none" />
      </label>
      <button id="vis-paste-btn" class="cap-btn cap-btn-secondary">📋 Paste</button>
      ${V.shots.length ? `<button id="vis-refresh" class="cap-btn cap-btn-secondary" title="Re-read the versions that exist in your AE project">↻ Refresh</button>` : ''}
    </div>
    ${V.source ? `<div class="cap-dim" style="font-size:11px;margin-bottom:6px;">Loaded from <strong>${_esc(V.source)}</strong> — ${V.shots.length} shot${V.shots.length === 1 ? '' : 's'} ready</div>` : ''}
    ${V._showPaste ? `<div class="cap-paste-area">
      <textarea id="vis-paste-text" placeholder='Paste shotlist JSON: {"shots":[{"id":"shot_01","archetype":"STAT_COUNTER",...}]}'></textarea>
      <div class="cap-btn-group" style="margin-top:6px;">
        <button id="vis-paste-use" class="cap-btn cap-btn-primary">Use This Shotlist</button>
      </div>
    </div>` : ''}`;
}

function _assetsRowHTML() {
  return `
    <div class="cap-row">
      <label class="cap-label" title="Folder holding the images your shots reference (bgSrc). Missing files still build, with a magenta placeholder.">Assets Folder</label>
      <input type="text" class="cap-input" id="vis-assets-dir" value="${_esc(V.assetsDir)}"
             placeholder="e.g. G:\\Content\\project-assets" style="flex:1" />
    </div>`;
}

function _emptyHTML() {
  return `<div class="cap-card">
    <div class="cap-hint" style="margin:0;">
      No shotlist loaded. Export one from the Documentary Studio app, or paste the JSON.<br>
      This tab builds <strong>STAT_COUNTER</strong>, <strong>BAR_CHART</strong> and
      <strong>SECTION_TITLE_CARD</strong> — b-roll and emotional shots stay with your generative tools.
    </div>
  </div>`;
}

function _shotTableHTML(compInfo) {
  const rows = V.shots.map((s) => _shotRowHTML(s)).join('');
  const fps = (compInfo && compInfo.frameRate) || 30;
  const total = masterOrder(V.shots, fps).reduce((a, r) => a + r.duration, 0);
  return `
  <div class="cap-card">
    <div class="cap-card-title">📋 Shots (${V.shots.length}) · ${total.toFixed(1)}s total</div>
    <div class="vis-table">${rows}</div>
    <div class="cap-btn-group" style="margin-top:10px;">
      <button id="vis-build-all" class="cap-btn cap-btn-primary" ${V.busy ? 'disabled' : ''}>
        ${V.busy ? `Building ${_esc(V.building)}…` : `🚀 Build All (${V.shots.length})`}
      </button>
      <button id="vis-build-master" class="cap-btn cap-btn-secondary" ${V.busy ? 'disabled' : ''}
              title="Lay every shot's active version end-to-end into one comp you can render">🎞 Build Master</button>
      <button id="vis-clear" class="cap-btn cap-btn-danger" ${V.busy ? 'disabled' : ''}
              title="Remove every generated shot and version from the project">🗑 Clear All</button>
    </div>
  </div>`;
}

function _shotRowHTML(s) {
  const versions = V.versions[s.id] || [];
  const res = V.results[s.id];
  const active = versions.find((n) => n.indexOf('★ ') === 0);
  const summary = _summarize(s);

  const versionCell = versions.length
    ? `<select class="cap-select vis-version-pick" data-shot="${_esc(s.id)}" style="width:auto;font-size:10px;padding:2px 4px;">
         ${versions.map((n) => {
           const plain = n.replace(/^★ /, '');
           return `<option value="${_esc(plain)}" ${n === active ? 'selected' : ''}>${_esc(plain)}${n === active ? ' ★' : ''}</option>`;
         }).join('')}
       </select>
       <button class="cap-icon-btn vis-version-del" data-shot="${_esc(s.id)}" data-version="${_esc((active || versions[0]).replace(/^★ /, ''))}" title="Delete the selected version">🗑</button>`
    : `<span class="cap-dim" style="font-size:10px;">not built</span>`;

  const status = res
    ? (res.missingAssets && res.missingAssets.length
        ? `<span class="cap-pill cap-pill-warn" title="Missing: ${_esc(res.missingAssets.join(', '))}">⚠ asset</span>`
        : `<span class="cap-pill cap-pill-ok">✓ ${res.layers} layers</span>`)
    : (res === null ? `<span class="cap-pill cap-pill-err">failed</span>` : '');

  return `
  <div class="vis-row${V.building === s.id ? ' vis-row-active' : ''}">
    <div class="vis-row-main">
      <span class="vis-arch vis-arch-${_esc(s.archetype.toLowerCase())}">${_esc(_shortArch(s.archetype))}</span>
      <span class="vis-id">${_esc(s.id)}</span>
      <span class="vis-summary" title="${_esc(s.scriptLine)}">${_esc(summary)}</span>
      ${s.talkingHead ? `<span class="cap-pill" title="This shot sits over you — check the framing">🗣</span>` : ''}
      ${status}
    </div>
    <div class="vis-row-actions">
      ${versionCell}
      <button class="cap-btn cap-btn-tertiary vis-build-one" data-shot="${_esc(s.id)}" ${V.busy ? 'disabled' : ''}>Build</button>
    </div>
  </div>`;
}

function _shortArch(a) {
  return { STAT_COUNTER: 'STAT', BAR_CHART: 'BARS', SECTION_TITLE_CARD: 'TITLE' }[a] || a;
}

function _summarize(s) {
  if (s.archetype === 'STAT_COUNTER') {
    return `${s.title || 'value'} → ${s.prefix || ''}${s.value.toLocaleString('en-US')}${s.unit ? ' ' + s.unit : ''}`;
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

function _loadShotlist(text, source) {
  const compInfo = _compInfo();
  const parsed = parseShotlist(text, { fps: (compInfo && compInfo.frameRate) || 30 });
  V.shots = parsed.shots;
  V.errors = parsed.errors;
  V.skipped = parsed.skipped;
  V.results = {};
  V.source = source;
  V._showPaste = false;
  V.error = parsed.shots.length ? null : (parsed.errors[0] || 'No buildable shots in that file.');
  V.status = parsed.shots.length ? `${parsed.shots.length} shot${parsed.shots.length === 1 ? '' : 's'} loaded.` : null;
  _rerender();
  if (parsed.shots.length) _refreshVersions();
}

async function _refreshVersions() {
  try {
    const resp = await callExtendScript('ef_vis_listAll');
    const map = {};
    for (const s of (resp && resp.shots) || []) map[s.shot] = s.versions;
    V.versions = map;
    _rerender();
  } catch (e) {
    V.error = _aeError(e);
    _rerender();
  }
}

function _buildPayload(spec) {
  const c = _compInfo() || {};
  return {
    spec,
    width: c.width || 1920,
    height: c.height || 1080,
    fps: c.frameRate || 30,
    assetsDir: V.assetsDir,
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
    V.results[shotId] = res;
    V.status = `Built ${res.comp} (${res.layers} layers).`;
  } catch (e) {
    V.results[shotId] = null;
    V.error = _aeError(e);
  } finally {
    V.busy = false; V.building = ''; _rerender();
    await _refreshVersions();
  }
}

async function _buildAll() {
  if (V.busy || !V.shots.length) return;
  V.busy = true; V.error = null;
  let ok = 0, failed = 0, missing = [];
  for (const spec of V.shots) {
    V.building = spec.id;
    V.status = `Building ${spec.id}… (${ok + failed + 1}/${V.shots.length})`;
    _rerender();
    try {
      const res = await callExtendScript('ef_vis_buildShot', JSON.stringify(_buildPayload(spec)));
      V.results[spec.id] = res; ok++;
      if (res.missingAssets && res.missingAssets.length) missing = missing.concat(res.missingAssets);
    } catch (e) {
      // one bad shot must never stop the batch
      V.results[spec.id] = null; failed++;
    }
  }
  V.busy = false; V.building = '';
  V.status = `Built ${ok} of ${V.shots.length}${failed ? `, ${failed} failed` : ''}` +
             `${missing.length ? ` · missing assets: ${[...new Set(missing)].join(', ')}` : ''}.`;
  _rerender();
  await _refreshVersions();
}

async function _buildMaster() {
  if (V.busy || !V.shots.length) return;
  V.busy = true; V.error = null; V.status = 'Building master…'; _rerender();
  try {
    const c = _compInfo() || {};
    const fps = c.frameRate || 30;
    const res = await callExtendScript('ef_vis_buildMaster', JSON.stringify({
      order: masterOrder(V.shots, fps),
      width: c.width || 1920, height: c.height || 1080, fps,
    }));
    V.status = `Master built: ${res.placed} shot${res.placed === 1 ? '' : 's'}, ${Number(res.duration).toFixed(1)}s` +
               `${res.missing && res.missing.length ? ` · not yet built: ${res.missing.join(', ')}` : ''}.`;
  } catch (e) {
    V.error = _aeError(e);
  } finally { V.busy = false; _rerender(); }
}

async function _clearAll() {
  if (V.busy) return;
  if (!window.confirm('Remove every generated shot, every version, and the master comp from this project?\n\nYour shotlist stays loaded.')) return;
  V.busy = true; _rerender();
  try {
    await callExtendScript('ef_vis_clearAll');
    V.versions = {}; V.results = {};
    V.status = 'Cleared.';
  } catch (e) { V.error = _aeError(e); }
  finally { V.busy = false; _rerender(); }
}

async function _setActive(shotId, version) {
  try {
    await callExtendScript('ef_vis_setActive', JSON.stringify({ shot: shotId, version }));
    await _refreshVersions();
  } catch (e) { V.error = _aeError(e); _rerender(); }
}

async function _deleteVersion(shotId, version) {
  if (!window.confirm(`Delete ${version}?`)) return;
  try {
    await callExtendScript('ef_vis_deleteVersion', JSON.stringify({ shot: shotId, version }));
    await _refreshVersions();
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

function _persist() {
  try { localStorage.setItem('editflow_visuals', JSON.stringify({ assetsDir: V.assetsDir })); } catch (_) {}
}

/* The host view owns comp info and the chosen font; read them without
   importing captions-view (which would be a circular import). */
function _compInfo() { return window.__editflowCompInfo || null; }
function _captionFont() { return window.__editflowFontPS || ''; }

let _rerenderHook = null;
export function setVisualsRerender(fn) { _rerenderHook = fn; }
function _rerender() { if (_rerenderHook) _rerenderHook(); }
