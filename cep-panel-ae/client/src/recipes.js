/**
 * recipes.js — the registry of what After Effects can actually build.
 *
 * This is the contract between three parties who otherwise cannot see each
 * other:
 *
 *   - the web agent, which must not order a shot AE has no builder for
 *   - the local model, which may only choose from this list
 *   - the panel, which typechecks props before anything runs in AE
 *
 * `status` is the honest bit. A recipe marked `planned` is published so the
 * web agent knows it is coming, but the panel REFUSES to build it — the
 * alternative is a brief full of orders that fail one by one in AE.
 *
 * Params here mirror what `normalizeShot()` in shotlist-model.js accepts and
 * what the builders in extendscript/visuals.jsx actually read. `ef_vis_recipes()`
 * returns the same list from inside AE so the two cannot drift apart; the
 * test suite compares them.
 */

/* Motion bands live in shotlist-model.js (MOTION_LIMITS) and are applied by
   clampMotion(). Named here so the docs can say what a value will be forced
   into rather than silently changing it. */

export const RECIPES = {
  STAT_COUNTER: {
    status: 'built',
    archetypes: ['STAT_COUNTER'],
    summary: 'One number counting up from zero, label above, unit below.',
    use: 'A single figure the narration says out loud and wants to land.',
    // No techniques: this builder has fixed motion and does not read
    // spec.technique. Listing one here would have the web agent sending
    // motion the panel silently ignores.
    techniques: [],
    params: {
      value: { type: 'number', required: true, help: 'The number it counts to.' },
      title: { type: 'string', default: '', help: 'Label above the number.' },
      prefix: { type: 'string', default: '', help: 'Goes before the digits, e.g. "Rs ".' },
      unit: { type: 'string', default: '', help: 'Lighter line below, e.g. "per month".' },
      countDur: { type: 'number', default: null, clamp: 'statCountUp',
                  help: 'Seconds to count up. Forced into 2.5–4.0s.' },
      pulse: { type: 'boolean', default: false,
               help: 'One restrained pulse when the number lands. Never a loop.' },
    },
  },

  BAR_CHART: {
    status: 'built',
    archetypes: ['BAR_CHART'],
    summary: 'Axis draws first, bars rise from the baseline, values count up, labels last.',
    use: 'Comparing three to six quantities the script names.',
    techniques: [],
    params: {
      bars: { type: 'array', required: true,
              help: 'Array of {label, value, accent}. Two to six reads best.' },
      caption: { type: 'string', default: '', help: 'One line above the chart.' },
      accentIndex: { type: 'number', default: null,
                     help: 'Which bar the script is talking about. Exactly one is accented.' },
      growDur: { type: 'number', default: 0.9, clamp: 'barGrow',
                 help: 'Seconds for a bar to rise. Forced into 0.6–1.4s.' },
    },
  },

  SECTION_TITLE_CARD: {
    status: 'built',
    archetypes: ['SECTION_TITLE_CARD'],
    summary: 'Headline animating letter by letter, with one optional supporting line.',
    use: 'A chapter break, or the line that names what follows.',
    techniques: [],
    params: {
      title: { type: 'string', required: true, help: 'The headline.' },
      supporting: { type: 'string', default: '', help: 'One smaller line beneath it.' },
      variant: { type: 'enum', default: 'slide_up',
                 values: ['slide_up', 'scale_center', 'slide_left', 'fade_rotate'],
                 help: 'How each letter arrives.' },
      stagger: { type: 'number', default: 0.05, clamp: 'letterStagger',
                 help: 'Seconds between letters. Forced into 0.03–0.10s.' },
    },
  },

  /* ── Step 3 of the plan. Published so the web agent can see what is
     coming; the panel refuses to build these until status flips to built. */

  LINE_GRAPH: {
    status: 'planned',
    archetypes: ['LINE_GRAPH'],
    summary: 'A line drawing on across an axis, with the final value called out.',
    use: 'Something changing over time — inflation, a salary against years.',
    techniques: [],
    params: {
      points: { type: 'array', required: true, help: 'Array of {label, value}, in order.' },
      caption: { type: 'string', default: '', help: 'One line above the graph.' },
      highlightIndex: { type: 'number', default: null, help: 'The point the script names.' },
    },
  },

  COMPARISON_PANEL: {
    status: 'planned',
    archetypes: ['COMPARISON_PANEL'],
    summary: 'Two sides arriving one after the other, so the gap between them reads.',
    use: '"Then versus now", "what you earn versus what rent costs".',
    techniques: ['PUSH_IN'],
    params: {
      left: { type: 'object', required: true, help: '{title, value, unit}.' },
      right: { type: 'object', required: true, help: '{title, value, unit}.' },
      caption: { type: 'string', default: '', help: 'One line above both.' },
    },
  },

  DOC_HIGHLIGHT: {
    status: 'planned',
    archetypes: ['DOC_HIGHLIGHT', 'SCREENSHOT_HIGHLIGHT'],
    summary: 'A captured page scrolls to the cited line and highlights it.',
    use: 'Showing the source you are quoting. Needs `sourceAnchor` on the shot.',
    techniques: ['DOC_SCROLL', 'PUSH_IN'],
    needs: 'sourceAnchor',
    params: {
      holdAfter: { type: 'number', default: 1.5,
                   help: 'Seconds to hold on the highlighted line after scrolling.' },
    },
  },

  ASSET_REVEAL: {
    status: 'planned',
    archetypes: ['BROLL_VIDEO', 'GSAP_METAPHOR', 'EMOTIONAL_MOMENT'],
    summary: 'A finished image or clip, full frame, with a disciplined in and out.',
    use: 'Anything generated or captured elsewhere. Carries the generated and captured routes.',
    techniques: ['KEN_BURNS', 'PUSH_IN'],
    needs: 'assets',
    params: {
      fit: { type: 'enum', default: 'fill', values: ['fill', 'contain'],
             help: 'fill crops to frame, contain letterboxes.' },
    },
  },
};

/* The agreed technique vocabulary, narrowed to exactly what a builder here can
   act on. `NONE` is always valid and always honoured — it means "no shot-level
   motion", which is what the text and data recipes want, since their motion is
   intrinsic. Send NONE rather than omitting the field, so a missing technique
   is distinguishable from a deliberate still. */
export const TECHNIQUES = ['NONE', 'PUSH_IN', 'KEN_BURNS', 'DOC_SCROLL', 'PARALLAX_2_5D'];

/* Every recipe takes these too — they are set on the shot, not inside props. */
export const COMMON_PARAMS = {
  bgSrc: { type: 'string', default: '', help: 'Background image filename, from the shot assets.' },
  accentColor: { type: 'string', default: '#b8860b', help: 'Hex, e.g. "#b8860b".' },
  font: { type: 'string', default: '', help: 'PostScript name. Falls back to the caption font.' },
};

/** Recipe names the panel will actually build right now. */
export function builtRecipes() {
  return Object.keys(RECIPES).filter((k) => RECIPES[k].status === 'built');
}

/**
 * Every technique value a built recipe honours today.
 *
 * `NONE` is excluded — it is honoured by definition and listing it would
 * suggest the motion techniques are live when they are not.
 */
export function honouredTechniques() {
  const out = new Set();
  for (const name of builtRecipes()) {
    for (const t of RECIPES[name].techniques || []) if (t !== 'NONE') out.add(t);
  }
  return [...out].sort();
}

/**
 * Which technique to send for a given recipe. A recipe with no motion hook
 * wants NONE — sending it PUSH_IN would show as "not applied" on the row.
 */
export function techniquesFor(recipeName) {
  const spec = RECIPES[String(recipeName || '').toUpperCase()];
  if (!spec) return [];
  const list = (spec.techniques || []).filter((t) => t !== 'NONE');
  return list.length ? ['NONE', ...list] : ['NONE'];
}

/**
 * Their archetype → my recipe. Returns null when After Effects has no builder,
 * which is the web agent's signal to route the shot to generation instead.
 */
export function recipeForArchetype(archetype) {
  const a = String(archetype || '').toUpperCase();
  for (const name of Object.keys(RECIPES)) {
    if ((RECIPES[name].archetypes || []).indexOf(a) >= 0) return name;
  }
  return null;
}

/**
 * Typecheck props against a recipe.
 *
 * This is the guard that makes a small local model safe: it may propose
 * anything it likes, and only what typechecks reaches After Effects. Same
 * principle as is_plausible_correction() in the transcript corrector —
 * refuse and report, never run and hope.
 *
 * Returns { ok, recipe, props, errors[] }. Unknown keys are dropped with a
 * note rather than passed through to a builder that would ignore them.
 */
export function validateProps(recipeName, props) {
  const name = String(recipeName || '').toUpperCase();
  const spec = RECIPES[name];
  const errors = [];
  if (!spec) {
    return { ok: false, recipe: name, props: {}, errors: [`unknown recipe "${recipeName}"`] };
  }
  if (spec.status !== 'built') {
    errors.push(`${name} is planned, not built yet — this shot cannot be built`);
  }

  const given = props && typeof props === 'object' ? props : {};
  const out = {};
  for (const key of Object.keys(spec.params)) {
    const p = spec.params[key];
    const has = Object.prototype.hasOwnProperty.call(given, key) && given[key] != null;
    if (!has) {
      if (p.required) errors.push(`${name} needs "${key}" — ${p.help}`);
      else if (p.default !== null && p.default !== undefined) out[key] = p.default;
      continue;
    }
    const v = given[key];
    if (p.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) { errors.push(`"${key}" must be a number, got ${JSON.stringify(v)}`); continue; }
      out[key] = n;
    } else if (p.type === 'boolean') {
      out[key] = !!v;
    } else if (p.type === 'string') {
      out[key] = String(v);
    } else if (p.type === 'array') {
      if (!Array.isArray(v) || !v.length) { errors.push(`"${key}" must be a non-empty array`); continue; }
      out[key] = v;
    } else if (p.type === 'object') {
      if (typeof v !== 'object' || Array.isArray(v)) { errors.push(`"${key}" must be an object`); continue; }
      out[key] = v;
    } else if (p.type === 'enum') {
      if (p.values.indexOf(String(v)) < 0) {
        errors.push(`"${key}" must be one of ${p.values.join(', ')} — got ${JSON.stringify(v)}`);
        continue;
      }
      out[key] = String(v);
    }
  }

  for (const key of Object.keys(given)) {
    if (!Object.prototype.hasOwnProperty.call(spec.params, key)) {
      errors.push(`${name} has no parameter "${key}" — ignored`);
    }
  }

  return { ok: errors.length === 0, recipe: name, props: out, errors };
}
