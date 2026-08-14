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

const DEFAULT_FPS = 30;

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
 * One raw shot → a strict build spec, or { error }. Unsupported archetypes
 * are *reported*, never silently dropped — a missing shot you don't know
 * about is worse than an error you do.
 */
export function normalizeShot(raw, opts) {
  const options = opts || {};
  const fps = options.fps || DEFAULT_FPS;
  if (!raw || typeof raw !== 'object') return { error: 'not an object' };

  const archetype = String(raw.archetype || '').toUpperCase();
  if (!archetype) return { error: 'missing archetype' };
  if (!SUPPORTED_ARCHETYPES.has(archetype)) {
    return { error: `archetype ${archetype} is not built in After Effects (v1 builds ${[...SUPPORTED_ARCHETYPES].join(', ')})` };
  }

  const id = String(raw.id || `shot_${String((options.index || 0) + 1).padStart(2, '0')}`);
  const p = raw.props || {};
  const frames = Number(raw.durationInFrames);
  const duration = Number.isFinite(frames) && frames > 0 ? frames / fps : 5;

  const spec = {
    id,
    archetype,
    duration: Math.round(duration * 1000) / 1000,
    scriptLine: String(raw.scriptLine || ''),
    talkingHead: !!raw.talkingHead,
    bgSrc: typeof p.bgSrc === 'string' ? p.bgSrc : '',
    accent: hexToRgb(p.accentColor, [0.72, 0.53, 0.04]),
    font: typeof p.font === 'string' ? p.font : '',
  };

  if (archetype === 'STAT_COUNTER') {
    const value = Number(p.value);
    if (!Number.isFinite(value)) return { error: 'STAT_COUNTER needs a numeric props.value' };
    spec.value = value;
    spec.title = String(p.title || '');
    spec.prefix = String(p.prefix || '');
    spec.unit = String(p.unit || '');
    spec.countDur = clampMotion('statCountUp', p.countDur != null ? p.countDur
      : Math.min(4.0, Math.max(2.5, duration * 0.7)));
    spec.pulse = !!p.pulse;
  }

  if (archetype === 'BAR_CHART') {
    const bars = Array.isArray(p.bars) ? p.bars : [];
    if (!bars.length) return { error: 'BAR_CHART needs props.bars [{label, value}]' };
    const clean = [];
    for (const b of bars) {
      const v = Number(b && b.value);
      if (!Number.isFinite(v)) return { error: `bar "${(b && b.label) || '?'}" has a non-numeric value` };
      clean.push({ label: String((b && b.label) || ''), value: v, accent: !!(b && b.accent) });
    }
    // exactly one accent bar: the one the script talks about
    const idx = Number.isFinite(Number(p.accentIndex)) ? Number(p.accentIndex)
      : clean.findIndex((b) => b.accent);
    clean.forEach((b, n) => { b.accent = n === idx; });
    spec.bars = clean;
    spec.maxValue = Math.max(...clean.map((b) => b.value), 1);
    spec.caption = String(p.caption || '');
    spec.growDur = clampMotion('barGrow', p.growDur != null ? p.growDur : 0.9);
  }

  if (archetype === 'SECTION_TITLE_CARD') {
    const title = String(p.title || '').trim();
    if (!title) return { error: 'SECTION_TITLE_CARD needs props.title' };
    spec.title = title;
    spec.supporting = String(p.supporting || '');
    spec.variant = TITLE_VARIANTS.indexOf(String(p.variant)) >= 0 ? String(p.variant) : 'slide_up';
    spec.stagger = clampMotion('letterStagger', p.stagger != null ? p.stagger : 0.05);
  }

  return { spec };
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
