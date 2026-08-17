/* The project is the source of truth for what is BUILT.
 *
 * Reported by the user: reopened After Effects, and the Visuals tab showed
 * a folder picker and nothing else. The comps were still in the project —
 * the panel had simply never asked. Everything here drives the real
 * visuals.jsx against a mock AE project, so the asking is verified rather
 * than assumed, and so the delete/promote paths cannot quietly lose work.
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

/* A small After Effects stand-in: 1-based item(), FolderItem/CompItem,
   remove(), and a record of every folder the code creates — so "reading
   must not write" is an assertion rather than a hope. */
function mockAE(tree) {
  function Folder(name) { this.name = name; this._items = []; }
  function Comp(name) {
    this.name = name; this.duration = 5; this.numLayers = 4;
    this.width = 1920; this.height = 1080;
  }
  const created = [];
  const root = wrap(new Folder('root'));

  function wrap(f) {
    Object.defineProperty(f, 'numItems', { get: () => f._items.length, configurable: true });
    f.item = (i) => f._items[i - 1];
    f.remove = () => {
      for (const p of allFolders()) {
        const at = p._items.indexOf(f);
        if (at >= 0) p._items.splice(at, 1);
      }
    };
    return f;
  }
  function allFolders() {
    const out = [];
    (function walk(f) {
      out.push(f);
      for (const c of f._items) if (c instanceof Folder) walk(c);
    })(root);
    return out;
  }
  function addComp(parent, name) {
    const c = new Comp(name);
    c.remove = () => {
      const at = parent._items.indexOf(c);
      if (at >= 0) parent._items.splice(at, 1);
    };
    parent._items.push(c);
    return c;
  }

  for (const folderName of Object.keys(tree || {})) {
    const vf = wrap(new Folder(folderName));
    root._items.push(vf);
    const shots = tree[folderName];
    for (const shotId of Object.keys(shots)) {
      // "__comps__" puts comps directly in the folder (that's the master)
      if (shotId === '__comps__') {
        for (const n of shots[shotId]) addComp(vf, n);
        continue;
      }
      const sf = wrap(new Folder(shotId));
      vf._items.push(sf);
      for (const n of shots[shotId]) addComp(sf, n);
    }
  }

  return {
    FolderItem: Folder,
    CompItem: Comp,
    created,
    root,
    app: {
      project: {
        rootFolder: root,
        file: null,
        dirty: false,
        items: {
          addFolder(name) {
            const f = wrap(new Folder(name));
            created.push(name);
            Object.defineProperty(f, 'parentFolder', {
              set: (p) => { if (p) p._items.push(f); },
              get: () => null,
              configurable: true,
            });
            return f;
          },
        },
      },
      beginUndoGroup() {},
      endUndoGroup() {},
    },
  };
}

function withAE(tree, fn) {
  const m = mockAE(tree);
  sandbox.app = m.app;
  sandbox.FolderItem = m.FolderItem;
  sandbox.CompItem = m.CompItem;
  try {
    return fn(m);
  } finally {
    delete sandbox.app;
    delete sandbox.FolderItem;
    delete sandbox.CompItem;
  }
}

/* ── reading the project ── */

test('listAll reports what the project holds, so a reopened panel is not empty', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1', 'shot_01 v2'], shot_02: ['\u2605 shot_02 v1'] } }, () => {
    const out = JSON.parse(sandbox.ef_vis_listAll());
    assert.equal(out.shots.length, 2);
    const s1 = out.shots.find((s) => s.shot === 'shot_01');
    assert.equal(s1.versions.length, 2);
    assert.equal(s1.versions[0].name, 'shot_01 v1', 'the star is stripped from the name');
    assert.equal(s1.versions[0].active, true);
    assert.equal(s1.versions[1].active, false);
    assert.equal(s1.versions[0].layers, 4, 'layer count comes from the comp, not panel memory');
    assert.equal(s1.versions[0].duration, 5);
  });
});

test('listAll separates the master from the shot folders', () => {
  withAE({ 'EF Visuals': { __comps__: ['EF Visuals Master'], shot_01: ['\u2605 shot_01 v1'] } }, () => {
    const out = JSON.parse(sandbox.ef_vis_listAll());
    assert.equal(out.master.name, 'EF Visuals Master');
    assert.equal(out.shots.length, 1, 'the master must not be listed as a shot');
  });
});

test('a project with no EF Visuals folder reports nothing rather than creating one', () => {
  withAE({}, (m) => {
    assert.deepEqual(JSON.parse(sandbox.ef_vis_listAll()).shots, []);
    assert.equal(m.created.length, 0, 'listing must never write to the project');
    assert.equal(m.root.numItems, 0);
  });
});

/* ── reading must not write ── */

test('reading versions of an unbuilt shot creates no folders', () => {
  // this used to litter the project with one empty folder per shot, just
  // for loading a shotlist and hitting Refresh
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1'] } }, (m) => {
    // .length, not deepEqual: arrays from the vm realm are not our Array
    assert.equal(sandbox.ef_vis_listVersions('shot_99').length, 0);
    assert.equal(sandbox.ef_vis_activeVersionComp('shot_99'), null);
    assert.equal(sandbox.ef_vis_setActiveVersion('shot_99', 'shot_99 v1'), false);
    assert.equal(m.created.length, 0);
  });
});

/* ── deleting a version ── */

test('deleting the active version promotes another, so the master keeps the shot', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1', 'shot_01 v2'] } }, () => {
    const res = JSON.parse(sandbox.ef_vis_deleteVersion('{"shot":"shot_01","version":"shot_01 v1"}'));
    assert.equal(res.removed, 1);
    assert.equal(res.promoted, 'shot_01 v2', 'a shot with versions left must never be starless');
    const after = JSON.parse(sandbox.ef_vis_listAll());
    assert.equal(after.shots[0].versions.length, 1);
    assert.equal(after.shots[0].versions[0].active, true);
  });
});

test('deleting a non-active version leaves the star where it was', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1', 'shot_01 v2'] } }, () => {
    sandbox.ef_vis_deleteVersion('{"shot":"shot_01","version":"shot_01 v2"}');
    const v = JSON.parse(sandbox.ef_vis_listAll()).shots[0].versions;
    assert.equal(v.length, 1);
    assert.equal(v[0].name, 'shot_01 v1');
    assert.equal(v[0].active, true);
  });
});

test('deleting the last version takes the empty shot folder with it', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1'] } }, () => {
    sandbox.ef_vis_deleteVersion('{"shot":"shot_01","version":"shot_01 v1"}');
    assert.deepEqual(JSON.parse(sandbox.ef_vis_listAll()).shots, []);
  });
});

test('deleting from a shot that was never built is a no-op, not a crash', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1'] } }, (m) => {
    const res = JSON.parse(sandbox.ef_vis_deleteVersion('{"shot":"nope","version":"nope v1"}'));
    assert.equal(res.removed, 0);
    assert.equal(m.created.length, 0);
  });
});

test('setting an active version stars exactly one', () => {
  withAE({ 'EF Visuals': { shot_01: ['\u2605 shot_01 v1', 'shot_01 v2', 'shot_01 v3'] } }, () => {
    assert.equal(sandbox.ef_vis_setActiveVersion('shot_01', 'shot_01 v3'), true);
    const v = JSON.parse(sandbox.ef_vis_listAll()).shots[0].versions;
    assert.deepEqual(v.map((x) => x.active), [false, false, true]);
  });
});

/* ── the sidecar that remembers the shotlist ── */

test('the sidecar sits next to the project and is named after it', () => {
  // MyDoc.aep -> MyDoc.editflow-visuals.json, so the shotlist travels with
  // the project instead of living in one browser profile on one machine
  const fake = (name) => ({ name, parent: { fsName: 'G:/Docs' } });
  sandbox.File = function (p) { this.fsName = p; this.exists = false; };
  try {
    assert.equal(sandbox.ef_vis_stateFileFor(fake('MyDoc.aep')).fsName,
                 'G:/Docs/MyDoc.editflow-visuals.json');
    assert.equal(sandbox.ef_vis_stateFileFor(fake('MyDoc.aepx')).fsName,
                 'G:/Docs/MyDoc.editflow-visuals.json');
    assert.equal(sandbox.ef_vis_stateFileFor(null), null, 'an unsaved project has nowhere to write');
  } finally { delete sandbox.File; }
});

test('an unsaved project says so instead of pretending to persist', () => {
  withAE({}, () => {
    const info = JSON.parse(sandbox.ef_vis_projectInfo());
    assert.equal(info.saved, false);
    assert.equal(info.hasState, false);
    assert.equal(JSON.parse(sandbox.ef_vis_readState()).saved, false);
    assert.equal(JSON.parse(sandbox.ef_vis_writeState('{"data":"{}"}')).wrote, false,
                 'a silent no-write would look identical to a successful save');
  });
});

test('a saved project round-trips the shotlist through the sidecar', () => {
  withAE({}, (m) => {
    const disk = {};
    m.app.project.file = { name: 'Doc.aep', fsName: 'G:/Docs/Doc.aep', parent: { fsName: 'G:/Docs' } };
    sandbox.File = function (p) {
      const self = this;
      this.fsName = p;
      Object.defineProperty(this, 'exists', { get: () => disk[p] !== undefined });
      this.open = () => true;
      this.write = (t) => { disk[p] = t; };
      this.read = () => disk[self.fsName];
      this.close = () => {};
    };
    try {
      const blob = JSON.stringify({ version: 1, shots: [{ id: 'shot_01' }] });
      const w = JSON.parse(sandbox.ef_vis_writeState(JSON.stringify({ data: blob })));
      assert.equal(w.wrote, true);
      assert.equal(w.path, 'G:/Docs/Doc.editflow-visuals.json');

      const r = JSON.parse(sandbox.ef_vis_readState());
      assert.equal(r.saved, true);
      assert.deepEqual(JSON.parse(r.data).shots, [{ id: 'shot_01' }],
                       'this round trip IS the fix: the shotlist outlives the panel');

      assert.equal(JSON.parse(sandbox.ef_vis_projectInfo()).hasState, true);
    } finally { delete sandbox.File; }
  });
});

test('a saved project with no sidecar yet reads as empty, not as an error', () => {
  withAE({}, (m) => {
    m.app.project.file = { name: 'Fresh.aep', fsName: 'G:/D/Fresh.aep', parent: { fsName: 'G:/D' } };
    sandbox.File = function (p) { this.fsName = p; this.exists = false; };
    try {
      const r = JSON.parse(sandbox.ef_vis_readState());
      assert.equal(r.saved, true);
      assert.equal(r.data, '');
    } finally { delete sandbox.File; }
  });
});

/* ── scanning the visuals folder ────────────────────────────────────
   assets[] and sourceAnchor.image resolve from DIFFERENT bases. Getting
   that wrong looks like a missing file rather than a path bug, so it is
   pinned here against a fake filesystem. */

function withFS(tree, fn) {
  // tree: { "G:/vis/assets/a": ["one.png"], "G:/vis/cap.png": true }
  const isDir = (p) => Object.prototype.hasOwnProperty.call(tree, p) && Array.isArray(tree[p]);
  sandbox.Folder = function (p) {
    const path = String(p).replace(/[\/]+$/, '');
    this.fsName = path;
    Object.defineProperty(this, 'exists', { get: () => isDir(path) });
    this.getFiles = () => (tree[path] || []).map((n) => {
      const f = new sandbox.File(path + '/' + n);
      f.name = n;
      return f;
    });
  };
  sandbox.File = function (p) {
    const path = String(p);
    this.fsName = path;
    this.name = path.split('/').pop();
    Object.defineProperty(this, 'exists', { get: () => tree[path] === true });
  };
  try { return fn(); } finally { delete sandbox.Folder; delete sandbox.File; }
}

const FS = {
  'G:/vis': [],
  'G:/vis/assets/cold-open/energy-fluid': ['fluid.png', 'fluid-alt.png'],
  'G:/vis/assets/_captures/dawn-com-2011436': ['fullpage.png'],
  'G:/vis/assets/_captures/dawn-com-2011436/fullpage.png': true,
};

test('scanning reports what each shot folder actually holds', () => {
  withFS(FS, () => {
    const r = JSON.parse(sandbox.ef_vis_scanAssets(JSON.stringify({
      root: 'G:/vis', dirs: ['assets/cold-open/energy-fluid'],
    })));
    assert.deepEqual(r.dirs['assets/cold-open/energy-fluid'], ['fluid.png', 'fluid-alt.png']);
    assert.equal(r.missingDirs.length, 0);
  });
});

test('a folder the brief names but nobody created is reported, not guessed at', () => {
  withFS(FS, () => {
    const r = JSON.parse(sandbox.ef_vis_scanAssets(JSON.stringify({
      root: 'G:/vis', dirs: ['assets/cold-open/energy-fluid', 'assets/nope/missing'],
    })));
    assert.deepEqual(r.missingDirs, ['assets/nope/missing']);
    assert.ok(r.dirs['assets/cold-open/energy-fluid'], 'the others still scan');
  });
});

test('a capture resolves from the ROOT, not from the shot folder', () => {
  // the silent miss the contract exists to prevent: joining this onto
  // assetDir would look for G:/vis/assets/cold-open/energy-fluid/assets/...
  withFS(FS, () => {
    const r = JSON.parse(sandbox.ef_vis_scanAssets(JSON.stringify({
      root: 'G:/vis',
      dirs: ['assets/cold-open/energy-fluid'],
      images: ['assets/_captures/dawn-com-2011436/fullpage.png'],
    })));
    assert.deepEqual(r.missingImages, [], 'found at the root-relative path');
  });
});

test('a capture that was never dropped in is named', () => {
  withFS(FS, () => {
    const r = JSON.parse(sandbox.ef_vis_scanAssets(JSON.stringify({
      root: 'G:/vis', dirs: [], images: ['assets/_captures/gone/fullpage.png'],
    })));
    assert.deepEqual(r.missingImages, ['assets/_captures/gone/fullpage.png']);
  });
});

test('no visuals root set is a clear refusal, not an empty result', () => {
  withFS(FS, () => {
    assert.match(sandbox.ef_vis_scanAssets('{"dirs":[]}'), /^ERROR:.*root/);
    assert.match(sandbox.ef_vis_scanAssets('{"root":"G:/nope","dirs":[]}'), /^ERROR:.*not found/);
  });
});

/* ── DOC_HIGHLIGHT refuses a mis-sized capture ──────────────────────
   `rect` is in the pixels of the original capture. If the PNG on disk was
   resized or re-exported, the highlight lands on a different paragraph —
   and that reads to a viewer as a research error, not a scaling bug. The
   schema promises a refusal; this is that promise, tested. */

function withCapture(imageDims, fn) {
  const m = mockAE({});
  // AE's property chains nest arbitrarily deep (Root Vectors Group ->
  // Vector Group -> Vectors Group -> Rect -> Rect Size). One recursive stub
  // beats guessing the exact depth each builder walks.
  const anyProp = () => {
    const node = {
      setValue() {}, moveToEnd() {}, name: '', numKeys: 0, value: [100, 100],
      // the builders write real keyframes now, not expressions
      setValueAtTime() { node.numKeys++; },
      setInterpolationTypeAtKey() {}, setTemporalEaseAtKey() {},
      property: () => anyProp(), addProperty: () => anyProp(),
      valueAtTime: () => node.value,
      sourceRectAtTime: () => ({ left: 0, top: 0, width: 100, height: 20 }),
    };
    Object.defineProperty(node, 'expression', { get: () => '', set: () => {} });
    return node;
  };
  const layer = () => Object.assign(anyProp(), { source: { width: 1280, height: 6461 } });
  const comp = {
    width: 1920, height: 1080, duration: 8,
    layers: { add: layer, addShape: layer, addSolid: layer },
  };
  sandbox.app = m.app;
  sandbox.FolderItem = m.FolderItem;
  sandbox.CompItem = m.CompItem;
  sandbox.BlendingMode = { MULTIPLY: 'multiply' };
  sandbox.ImportOptions = function () {};
  sandbox.File = function (p) { this.fsName = String(p); this.exists = true; };
  m.app.project.importFile = () => Object.assign({ name: 'fullpage.png' }, imageDims);
  try { return fn(comp); } finally {
    delete sandbox.app; delete sandbox.FolderItem; delete sandbox.CompItem;
    delete sandbox.BlendingMode; delete sandbox.ImportOptions; delete sandbox.File;
  }
}

const SPEC = () => ({
  id: 'shot_05', recipe: 'DOC_HIGHLIGHT', assetDir: 'assets/a',
  accent: [0.9, 0.8, 0.2], holdAfter: 1.5, technique: 'DOC_SCROLL',
  sourceAnchor: {
    url: 'https://www.dawn.com/news/2011436',
    image: 'assets/_captures/dawn-com-2011436/fullpage.png',
    pageWidth: 1280, pageHeight: 6461, imageWidth: 1280, imageHeight: 6461,
    rect: { x: 108, y: 1632, w: 728, h: 92 },
  },
});

test('a capture matching the declared size builds', () => {
  withCapture({ width: 1280, height: 6461 }, (comp) => {
    const out = sandbox.ef_vis_buildDocHighlight(comp, SPEC(), { visualsRoot: 'G:/vis' }, []);
    assert.ok(typeof out !== 'string', `refused a good capture: ${out}`);
  });
});

test('a resized capture is refused, naming both sizes', () => {
  withCapture({ width: 640, height: 3230 }, (comp) => {
    const out = sandbox.ef_vis_buildDocHighlight(comp, SPEC(), { visualsRoot: 'G:/vis' }, []);
    assert.match(String(out), /^ERROR:/);
    assert.match(String(out), /640x3230/, 'says what it found');
    assert.match(String(out), /1280x6461/, 'and what it expected');
    assert.match(String(out), /wrong line/, 'and why that matters');
  });
});

test('a shot with no sourceAnchor is refused rather than building an empty page', () => {
  withCapture({ width: 1280, height: 6461 }, (comp) => {
    const spec = SPEC();
    delete spec.sourceAnchor;
    assert.match(String(sandbox.ef_vis_buildDocHighlight(comp, spec, { visualsRoot: 'G:/vis' }, [])),
                 /needs sourceAnchor/);
  });
});

test('a capture that is not on disk is reported as missing, not as a size error', () => {
  withCapture({ width: 1280, height: 6461 }, (comp) => {
    sandbox.File = function (p) { this.fsName = String(p); this.exists = false; };
    const missing = [];
    const out = sandbox.ef_vis_buildDocHighlight(comp, SPEC(), { visualsRoot: 'G:/vis' }, missing);
    assert.ok(typeof out !== 'string', 'a missing file is a placeholder, not a refusal');
    assert.deepEqual(missing, ['assets/_captures/dawn-com-2011436/fullpage.png']);
  });
});
