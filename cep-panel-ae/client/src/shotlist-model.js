/**
 * shotlist-model.js — pure logic for turning a Content Factory shotlist into
 * build specs for After Effects.
 *
 * No DOM, no CSInterface, no AE. Everything here is node-testable, which is
 * the point: geometry and timing are arithmetic, and arithmetic is where a
 * model would be non-deterministic and unverifiable.
 *
 * Input shape (from the v7 visual planner):
 *   { shots: [{ id, scriptLine, archetype, durationInFrames, props: {...} }] }
 */

import { RECIPES, TECHNIQUES, recipeForArchetype, validateProps } from './recipes.js';

/* Motion bands from prompts/visual-v7-glm/v7/visual_archetypes.md
   ("Canonical Motion Limits"). Values outside these are clamped, not obeyed —
   the style guide is enforced rather than hoped for. */
export const MOTION_LIMITS = {
  letterStagger: { min: 0.03, max: 0.10 },   // faster feels mushy, slower sluggish
  statCountUp:   { min: 2.5,  max: 4.0  },   // longer for large or alarming values
  barGrow:       { min: 0.6,  max: 1.4  },
  highlightSweep:{ min: 1.8,  max: 2.2  },
};

/* v1 scope. BROLL_VIDEO and EMOTIONAL_MOMENT stay with the generative tools —
   After Effects cannot invent footage. */
export const SUPPORTED_ARCHETYPES = new Set([
  'STAT_COUNTER',
  'BAR_CHART',
  'SECTION_TITLE_CARD',
]);

/* Signature variants approved in visual_archetypes.md for title cards. */
export const TITLE_VARIANTS = ['slide_up', 'scale_center', 'slide_left', 'fade_rotate'];

export function clampMotion(kind, value) {
  const band = MOTION_LIMITS[kind];
  const n = Number(value);
  if (!band) return n;
  if (!Number.isFinite(n)) return band.min;
  return Math.min(band.max, Math.max(band.min, n));
}

/* ── Colour ───────────────────────────────────────────────── */

/** "#b8860b" → [0.722, 0.525, 0.043] (AE wants 0..1 floats). */
export function hexToRgb(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return fallback || [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ── Number formatting ────────────────────────────────────── */

/**
 * Thousands separators without toLocaleString — ExtendScript is ES3 and
 * doesn't have it, so the panel and the jsx must agree on one hand-rolled
 * implementation or the preview lies about the final frame.
 */
export function groupDigits(n) {
  const neg = n < 0;
  const s = String(Math.floor(Math.abs(Number(n) || 0)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (neg ? '-' : '') + out;
}

/* ── Parsing ──────────────────────────────────────────────── */

/* Settled 2026-08-16: every shot and the master are built at this size, not
   at whatever composition happens to be frontmost in After Effects. Inheriting
   it meant an accidentally-open vertical comp built the whole brief vertical,
   discoverable only after everything was built. See docs/brief-schema.md. */
export const DELIVERABLE = { width: 1920, height: 1080, fps: 30 };

const DEFAULT_FPS = DELIVERABLE.fps;

/* Where a shot actually gets made. `after_effects` builds from a recipe; the
   other two place a file produced elsewhere. */
export const ROUTES = ['after_effects', 'generated', 'captured'];

/**
 * Parse a shotlist file. Tolerates the whole file, a bare array, or prose
 * around the JSON (agents add preambles). Never throws: returns
 * { shots, errors, skipped } so one bad shot can't lose the other 23.
 */
export function parseShotlist(raw, opts) {
  const options = opts || {};
  const fps = options.fps || DEFAULT_FPS;
  const out = { shots: [], errors: [], skipped: [] };

  let data;
  try {
    const text = String(raw);
    const start = text.search(/[[{]/);
    data = JSON.parse(start > 0 ? text.slice(start).replace(/```[\s\S]*$/, '') : text);
  } catch (e) {
    out.errors.push('not valid JSON: ' + String((e && e.message) || e));
    return out;
  }

  const list = Array.isArray(data) ? data : (data.shots || []);
  if (!list.length) {
    out.errors.push('no shots found (expected {"shots":[...]} or a bare array)');
    return out;
  }

  for (let i = 0; i < list.length; i++) {
    const res = normalizeShot(list[i], { fps, index: i });
    if (res.error) {
      (SUPPORTED_ARCHETYPES.has(String(list[i] && list[i].archetype))
        ? out.errors : out.skipped).push(`${(list[i] && list[i].id) || 'shot ' + (i + 1)}: ${res.error}`);
      continue;
    }
    out.shots.push(res.spec);
  }
  return out;
}

/**
 * One raw shot → a strict build spec, or { error }.
 *
 * Prop shape and types are checked ONCE, by the registry in recipes.js — that
 * file is the published contract, so a second copy of the rules here would
 * drift from what the web agent was told. What stays here is the part a
 * type table cannot express: domain invariants like "exactly one accent bar"
 * and "the bar scale is the tallest bar".
 *
 * Unsupported archetypes are *reported*, never silently dropped — a missing
 * shot you don't know about is worse than an error you do.
 */
export function normalizeShot(raw, opts) {
  const options = opts || {};
  const fps = options.fps || DELIVERABLE.fps;
  if (!raw || typeof raw !== 'object') return { error: 'not an object' };

  const archetype = String(raw.archetype || '').toUpperCase();
  if (!archetype && !raw.recipe) return { error: 'missing archetype' };

  // recipe wins; archetype is the fallback so older shotlists keep working
  const recipeName = String(raw.recipe || '').toUpperCase() ||
                     recipeForArchetype(archetype) || archetype;
  const recipe = RECIPES[recipeName];
  if (!recipe) {
    return { error: `${archetype || recipeName} has no After Effects builder — generate this shot instead` };
  }
  if (recipe.status !== 'built') {
    // Name the archetype the brief actually asked for, not just the recipe it
    // maps to — "ASSET_REVEAL is planned" tells you nothing about which shot.
    const asked = archetype && archetype !== recipeName ? `${archetype} (${recipeName})` : recipeName;
    return { error: `${asked} is planned, not built yet — generate this shot for now` };
  }

  const id = String(raw.id || `shot_${String((options.index || 0) + 1).padStart(2, '0')}`);
  const p = raw.props || {};
  const warnings = [];

  // Duration precedence, per brief-schema.md: frames, then seconds, then a
  // default loud enough to notice.
  const frames = Number(raw.durationInFrames);
  const seconds = Number(raw.duration);
  let duration;
  if (Number.isFinite(frames) && frames > 0) duration = frames / fps;
  else if (Number.isFinite(seconds) && seconds > 0) duration = seconds;
  else {
    duration = 5;
    warnings.push('no duration given — using 5s');
  }

  const checked = validateProps(recipeName, p);
  if (!checked.ok) return { error: checked.errors[0], errors: checked.errors };
  for (const w of checked.warnings) warnings.push(w);

  const spec = {
    id,
    archetype: archetype || recipeName,
    recipe: recipeName,
    duration: Math.round(duration * 1000) / 1000,
    scriptLine: String(raw.scriptLine || ''),
    talkingHead: !!raw.talkingHead,
    // props are flattened onto the spec because that is what the builders in
    // visuals.jsx read; nesting them would mean touching every builder
    ...checked.props,
    bgSrc: checked.common.bgSrc,
    accent: hexToRgb(checked.common.accentColor, [0.72, 0.53, 0.04]),
    // A colour this shot names beats the film's theme; without the flag the
    // builder cannot tell "the default" from "deliberately this colour".
    _accentFromShot: Object.prototype.hasOwnProperty.call(p, 'accentColor'),
    font: checked.common.font,
    ...briefFields(raw, warnings),
  };

  applyClamps(recipeName, spec);

  if (recipeName === 'STAT_COUNTER' && spec.countDur == null) {
    // a count that outruns the shot reads as a glitch; scale it to the shot
    spec.countDur = clampMotion('statCountUp', duration * 0.7);
  }

  if (recipeName === 'BAR_CHART') {
    const clean = [];
    for (const b of spec.bars) {
      const v = Number(b && b.value);
      if (!Number.isFinite(v)) {
        return { error: `bar "${(b && b.label) || '?'}" has a non-numeric value` };
      }
      clean.push({ label: String((b && b.label) || ''), value: v, accent: !!(b && b.accent) });
    }
    // exactly one accent bar: the one the script talks about
    const idx = Number.isFinite(Number(spec.accentIndex)) ? Number(spec.accentIndex)
      : clean.findIndex((b) => b.accent);
    clean.forEach((b, n) => { b.accent = n === idx; });
    spec.bars = clean;
    spec.maxValue = Math.max(...clean.map((b) => b.value), 1);
  }

  if (recipeName === 'SECTION_TITLE_CARD' && !String(spec.title || '').trim()) {
    return { error: 'SECTION_TITLE_CARD needs props.title — an empty card is never what was meant' };
  }

  if (warnings.length) spec.warnings = warnings;
  return { spec };
}

/** Force every motion value the registry marks into its v7 band. */
function applyClamps(recipeName, spec) {
  const params = RECIPES[recipeName].params;
  for (const key of Object.keys(params)) {
    const band = params[key].clamp;
    if (band && spec[key] != null) spec[key] = clampMotion(band, spec[key]);
  }
}

/**
 * The shot-level fields the brief carries beyond props. Stored verbatim and
 * displayed — `archetype` and `technique` belong to the Content Prompts side
 * and are never rewritten here, only reported when this panel cannot act on
 * them.
 */
function briefFields(raw, warnings) {
  const out = {};
  const technique = String(raw.technique || 'NONE').toUpperCase();
  out.technique = TECHNIQUES.indexOf(technique) >= 0 ? technique : 'NONE';
  if (out.technique !== technique) {
    warnings.push(`technique "${raw.technique}" is not in the agreed list — treated as NONE`);
  }

  const placement = String(raw.placement || 'full').toLowerCase();
  out.placement = placement === 'overlay' ? 'overlay' : 'full';

  const route = String(raw.productionRoute || 'after_effects').toLowerCase();
  out.productionRoute = ROUTES.indexOf(route) >= 0 ? route : 'after_effects';
  out.routeReason = String(raw.routeReason || '');

  out.assetDir = String(raw.assetDir || '');
  out.assets = Array.isArray(raw.assets) ? raw.assets.map(String) : [];
  out.note = String(raw.note || '');
  out.qaFocus = String(raw.qaFocus || '');
  // completeness is declared, never inferred from the shape of the JSON
  out.needs = Array.isArray(raw.needs) ? raw.needs.map(String) : [];

  const anchor = normalizeAnchor(raw.sourceAnchor, warnings);
  if (anchor) out.sourceAnchor = anchor;
  return out;
}

/**
 * `sourceAnchor` shape check. The pixel check against the real file happens in
 * After Effects, where the image is actually imported — here we only make sure
 * the numbers needed to do that arrived.
 */
function normalizeAnchor(a, warnings) {
  if (!a || typeof a !== 'object') return null;
  const r = a.rect || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const out = {
    url: String(a.url || ''),
    image: String(a.image || ''),          // relative to the VISUALS ROOT, not assetDir
    pageWidth: num(a.pageWidth),
    pageHeight: num(a.pageHeight),
    imageWidth: num(a.imageWidth) || num(a.pageWidth),
    imageHeight: num(a.imageHeight) || num(a.pageHeight),
    rect: { x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h) },
  };
  if (!out.image) { warnings.push('sourceAnchor has no image — the highlight cannot be placed'); return null; }
  if (!out.pageHeight || !out.rect.h) {
    warnings.push('sourceAnchor is missing page height or rect — the highlight cannot be placed');
    return null;
  }
  return out;
}

/* ── Versions ─────────────────────────────────────────────── */

/**
 * Next free version name for a shot. Builds NEVER overwrite: a rebuild — or
 * another builder's attempt — becomes v2, v3, … so you can compare and keep
 * the one you want.
 */
export function nextVersionName(shotId, existingNames) {
  const esc = String(shotId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('^(?:★ )?' + esc + ' v(\\d+)$');
  let max = 0;
  for (const name of existingNames || []) {
    const m = rx.exec(String(name));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${shotId} v${max + 1}`;
}

/* ── Reconciling the panel with the project ───────────────── */

/**
 * Merge the loaded shotlist with what actually exists in the AE project.
 *
 * The project is the truth about what is BUILT. The panel must never claim
 * a shot is unbuilt because it forgot — reopening After Effects wipes the
 * panel's memory but not the comps, and the two have to agree.
 *
 * Shots present in the project but missing from the shotlist are ORPHANS:
 * still listed, still openable, still deletable. Hiding them would mean a
 * lost shotlist reads as lost work.
 *
 * @param shots    specs from parseShotlist (may be empty)
 * @param project  the ef_vis_listAll payload: { shots: [{shot, versions}] }
 */
export function reconcile(shots, project) {
  const byId = new Map();
  for (const entry of (project && project.shots) || []) {
    byId.set(String(entry.shot), (entry.versions || []).map(_normVersion));
  }

  const rows = [];
  const seen = new Set();
  for (const spec of shots || []) {
    const versions = byId.get(spec.id) || [];
    seen.add(spec.id);
    rows.push(_row(spec.id, spec, versions, false));
  }
  for (const [id, versions] of byId) {
    if (!seen.has(id)) rows.push(_row(id, null, versions, true));
  }

  return {
    rows,
    orphans: rows.filter((r) => r.orphan).map((r) => r.id),
    built: rows.filter((r) => r.built).length,
    total: rows.length,
    master: (project && project.master) || null,
  };
}

function _normVersion(v) {
  // tolerate the old shape (a bare "★ shot_01 v1" string) so a stale panel
  // or an older jsx still renders instead of throwing
  if (typeof v === 'string') {
    return { name: v.replace(/^★ /, ''), active: v.indexOf('★ ') === 0, duration: 0, layers: 0 };
  }
  return {
    name: String((v && v.name) || '').replace(/^★ /, ''),
    active: !!(v && v.active),
    duration: Number((v && v.duration) || 0),
    layers: Number((v && v.layers) || 0),
  };
}

function _row(id, spec, versions, orphan) {
  const active = versions.find((v) => v.active) || versions[0] || null;
  return {
    id,
    spec,
    orphan,
    versions,
    built: versions.length > 0,
    activeVersion: active ? active.name : '',
    activeDuration: active ? active.duration : 0,
    activeLayers: active ? active.layers : 0,
  };
}

/**
 * Which shots the master will contain, and which it will be missing.
 *
 * An unbuilt shot keeps its SLOT rather than closing the gap: the timeline
 * stays aligned to the narration, and the hole is visible instead of every
 * later shot silently sliding earlier. Orphans have no position in the
 * shotlist, so they are not placed at all.
 */
export function masterPlan(rows, fps) {
  const placed = (rows || []).filter((r) => r.spec);
  return {
    order: masterOrder(placed.map((r) => r.spec), fps),
    missing: placed.filter((r) => !r.built).map((r) => r.id),
  };
}

/* ── Master timeline ──────────────────────────────────────── */

/**
 * Lay shots end-to-end in SHOTLIST order (not name order — "shot_10" must not
 * sort before "shot_02"). Returns {id, startTime, duration} with a running
 * offset, which is what the master comp builder consumes.
 */
export function masterOrder(shots, fps) {
  const rate = fps || DEFAULT_FPS;
  let t = 0;
  return (shots || []).map((s) => {
    const dur = Number.isFinite(Number(s.duration)) ? Number(s.duration)
      : (Number(s.durationInFrames) || 150) / rate;
    const row = { id: String(s.id), startTime: Math.round(t * 1000) / 1000,
                  duration: Math.round(dur * 1000) / 1000 };
    t += dur;
    return row;
  });
}
