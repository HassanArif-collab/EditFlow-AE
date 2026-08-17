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
    // The count itself is intrinsic; DUST_DISSOLVE is the one shot-level
    // motion that fits a number — the figure crumbling as it is described
    // as lost. It reads as meaning, so it is never decoration.
    techniques: ['DUST_DISSOLVE'],
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
    techniques: ['DUST_DISSOLVE'],
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

  LINE_GRAPH: {
    status: 'built',
    archetypes: ['LINE_GRAPH'],
    summary: 'A line drawing on across an axis, with the final value called out.',
    use: 'Something changing over time — inflation, a salary against years.',
    techniques: [],
    params: {
      points: { type: 'array', required: true,
                help: 'Array of {label, value}, in order. Two or more.' },
      caption: { type: 'string', default: '', help: 'One line above the graph.' },
      highlightIndex: { type: 'number', default: null,
                        help: 'The point the script names. Defaults to the last one.' },
    },
  },

  COMPARISON_PANEL: {
    status: 'built',
    archetypes: ['COMPARISON_PANEL'],
    summary: 'Two sides arriving one after the other, so the gap between them reads.',
    use: '"Then versus now", "what you earn versus what rent costs".',
    techniques: ['PUSH_IN'],
    params: {
      left: { type: 'object', required: true, help: '{title, value, unit, prefix}.' },
      right: { type: 'object', required: true,
               help: '{title, value, unit, prefix}. Arrives second — this is the side the point lands on.' },
      caption: { type: 'string', default: '', help: 'One line above both.' },
    },
  },

  DOC_HIGHLIGHT: {
    status: 'built',
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

  PROOF_STACK: {
    status: 'built',
    archetypes: ['PROOF_STACK'],
    summary: 'Several images cut back to back on a rhythm, not one long hold.',
    use: 'The reveal beat — document, then number, then quote — and any run of ' +
         'captured evidence. Covers both a 3-shot proof stack and a 12-image montage.',
    techniques: ['PUSH_IN', 'KEN_BURNS'],
    needs: 'assets',
    params: {
      rhythm: { type: 'enum', default: 'auto', values: ['auto', 'tightening', 'even'],
                help: 'auto: tighten for a few images, even for many. tightening ' +
                      'accelerates into the last shot; even is a steady montage.' },
      holdLast: { type: 'number', default: 0.8,
                  help: 'Extra seconds on the final image — the one the point lands on.' },
      zoom: { type: 'number', default: 1.06,
              help: 'Per-image scale if a technique is set. Small: these are quick cuts.' },
    },
  },

  TEXT_ANNOTATION: {
    status: 'built',
    archetypes: ['TEXT_ANNOTATION'],
    summary: 'A text label placed over an image, a chart, or bare background.',
    use: 'Naming what is on screen — a caption on a photo, a call-out on a ' +
         'diagram, a figure attributed to its source. The third most used ' +
         'archetype in the real corpus.',
    techniques: ['PUSH_IN', 'KEN_BURNS'],
    params: {
      text: { type: 'string', required: true, help: 'The label. One or two lines.' },
      place: { type: 'enum', default: 'lower_left',
               values: ['lower_left', 'lower_right', 'upper_left', 'upper_right',
                        'center', 'lower_center'],
               help: 'Where it sits in frame.' },
      boxed: { type: 'boolean', default: true,
               help: 'A backing plate behind the text, so it reads over any image.' },
      size: { type: 'enum', default: 'normal', values: ['small', 'normal', 'large'],
              help: 'small for an attribution, large for a statement.' },
      sub: { type: 'string', default: '',
             help: 'A quieter second line — a source, a date, a unit.' },
    },
  },

  PIE_CHART: {
    status: 'built',
    archetypes: ['PIE_CHART'],
    summary: 'Slices arriving one at a time, the named one pulled out.',
    use: 'A share of a whole, when the parts matter more than their exact size. ' +
         'A bar chart is easier to read for close values.',
    techniques: [],
    params: {
      slices: { type: 'array', required: true,
                help: 'Array of {label, value, accent}. Three to six reads best.' },
      caption: { type: 'string', default: '', help: 'One line above the chart.' },
      accentIndex: { type: 'number', default: null,
                     help: 'Which slice the script names. It is pulled out from the centre.' },
    },
  },

  FLOW_DIAGRAM: {
    status: 'built',
    archetypes: ['FLOW_DIAGRAM'],
    summary: 'Steps in a row, connectors drawing between them in sequence.',
    use: 'A process the narration walks through — how a payment moves, how a ' +
         'decision is made. Two to five steps.',
    techniques: [],
    params: {
      steps: { type: 'array', required: true,
               help: 'Array of {label, accent} or plain strings, in order.' },
      caption: { type: 'string', default: '', help: 'One line above the row.' },
      stepDur: { type: 'number', default: 0.55,
                 help: 'Seconds between one step landing and the next starting.' },
    },
  },

  ASSET_REVEAL: {
    status: 'built',
    archetypes: ['BROLL_VIDEO', 'GSAP_METAPHOR', 'EMOTIONAL_MOMENT'],
    summary: 'A finished image or clip, full frame, with a disciplined in and out.',
    use: 'Anything generated or captured elsewhere. Carries the generated and captured routes.',
    techniques: ['KEN_BURNS', 'PUSH_IN', 'PARALLAX_2_5D'],
    needs: 'assets',
    params: {
      fit: { type: 'enum', default: 'fill', values: ['fill', 'contain'],
             help: 'fill crops to frame, contain letterboxes.' },
      zoom: { type: 'number', default: 1.15,
              help: 'End scale for PUSH_IN / KEN_BURNS / PARALLAX. 1.10-1.35 for evidence.' },
      hold: { type: 'number', default: 0,
              help: 'Seconds held still before the move starts. 0 means move throughout.' },
    },
  },
};

/* The agreed technique vocabulary, narrowed to exactly what a builder here can
   act on. `NONE` is always valid and always honoured — it means "no shot-level
   motion", which is what the text and data recipes want, since their motion is
   intrinsic. Send NONE rather than omitting the field, so a missing technique
   is distinguishable from a deliberate still. */
export const TECHNIQUES = ['NONE', 'PUSH_IN', 'KEN_BURNS', 'DOC_SCROLL',
                           'PARALLAX_2_5D', 'DUST_DISSOLVE'];

/* What each one means, quoted to the panel and the docs so the web agent and
   the builder cannot hold different ideas of the same word. Sourced from
   v7/technique_deck.md. */
export const TECHNIQUE_HELP = {
  NONE: 'No shot-level motion. The recipe\'s own animation is the whole of it.',
  PUSH_IN: 'A slow scale toward the subject over the hold. Quiet emphasis.',
  KEN_BURNS: 'Scale plus a slow drift across a still, so a photograph feels filmed.',
  DOC_SCROLL: 'Scroll a tall capture to the cited line, then hold on it.',
  PARALLAX_2_5D: 'Layered depth: background, middle and foreground move at ' +
                 'different rates during a push. Needs assets exported as ' +
                 'separate layers, back to front.',
  DUST_DISSOLVE: 'Letters crumble away — fade, blur and drift upward in ' +
                 'sequence. It MEANS loss: something erased, deleted or gone. ' +
                 'Never a neutral transition.',
};

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
 * Returns { ok, recipe, props, common, errors[], warnings[] }.
 *
 * The errors/warnings split matters: a missing required prop means the shot
 * cannot be built, but an extra key the web agent invented is just noise to
 * drop. Treating the second as fatal would reject whole briefs over a typo.
 */
export function validateProps(recipeName, props) {
  const name = String(recipeName || '').toUpperCase();
  const spec = RECIPES[name];
  const errors = [];
  const warnings = [];
  if (!spec) {
    return { ok: false, recipe: name, props: {}, common: {},
             errors: [`unknown recipe "${recipeName}"`], warnings };
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
        // A cosmetic choice with a safe fallback must not cost the whole shot:
        // an agent inventing "explode_wildly" should get slide_up and a note,
        // not lose the title card. Only an enum with no default is fatal.
        if (p.default != null) {
          warnings.push(`"${key}" ${JSON.stringify(v)} is not one of ${p.values.join(', ')} — using ${p.default}`);
          out[key] = p.default;
        } else {
          errors.push(`"${key}" must be one of ${p.values.join(', ')} — got ${JSON.stringify(v)}`);
        }
        continue;
      }
      out[key] = String(v);
    }
  }

  // The common props travel in the same object but belong to every recipe.
  // Reading them here is what stops "accentColor" reading as a typo.
  const common = {};
  for (const key of Object.keys(COMMON_PARAMS)) {
    common[key] = Object.prototype.hasOwnProperty.call(given, key) && given[key] != null
      ? String(given[key]) : COMMON_PARAMS[key].default;
  }

  for (const key of Object.keys(given)) {
    if (!Object.prototype.hasOwnProperty.call(spec.params, key) &&
        !Object.prototype.hasOwnProperty.call(COMMON_PARAMS, key)) {
      warnings.push(`${name} has no parameter "${key}" — ignored`);
    }
  }

  return { ok: errors.length === 0, recipe: name, props: out, common, errors, warnings };
}
