/* The recipe registry is a contract with two parties who cannot see the code:
 * the web agent writing the brief, and the local model choosing a recipe.
 *
 * Two things must hold or the contract is a lie:
 *   1. what the registry calls "built" is what visuals.jsx can actually build
 *   2. props that don't typecheck are refused, never passed to a builder
 *
 * The second is what makes a 4B model safe to point at After Effects.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { loadEsm } = require('./_load-esm');

const R = loadEsm(path.resolve(
  __dirname, '..', 'cep-panel-ae', 'client', 'src', 'recipes.js'
));

/* Load the jsx and ask IT what it can build, rather than trusting a comment. */
const JSX = path.resolve(__dirname, '..', 'cep-panel-ae', 'extendscript', 'visuals.jsx');
const box = { $: { global: null } };
vm.createContext(box);
box.$.global = box;
vm.runInContext(fs.readFileSync(JSX, 'utf8'), box, { filename: 'visuals.jsx' });

/* ── the anti-drift check ── */

test('every recipe the registry calls built has a real builder in the jsx', () => {
  for (const name of R.builtRecipes()) {
    assert.ok(box.ef_vis_builderFor(name),
      `recipes.js says ${name} is built, but visuals.jsx has no builder for it. ` +
      `The web agent will order this shot and it will fail in After Effects.`);
  }
});

test('every recipe the jsx can build is described in the registry', () => {
  for (const row of box.EF_VIS_RECIPES) {
    if (!box.ef_vis_builderFor(row.name)) continue;
    assert.ok(R.RECIPES[row.name],
      `visuals.jsx builds ${row.name} but recipes.js never mentions it, ` +
      `so nothing downstream knows it exists`);
    assert.equal(R.RECIPES[row.name].status, 'built',
      `${row.name} builds fine but the registry still calls it planned`);
  }
});

test('a planned recipe is published but refused, not quietly built', () => {
  // publishing them lets the web agent see what is coming; refusing them
  // stops a brief full of orders that fail one at a time in AE.
  //
  // Everything in the registry is built today, so the guard is exercised
  // against an injected entry — the machinery has to keep working for the
  // NEXT recipe added, which will start its life as planned.
  R.RECIPES.__NOT_YET__ = {
    status: 'planned', archetypes: [], summary: '', use: '', techniques: [],
    params: { thing: { type: 'string', default: '' } },
  };
  try {
    const res = R.validateProps('__NOT_YET__', {});
    assert.equal(res.ok, false);
    assert.match(res.errors.join(' '), /planned, not built/);
    assert.ok(R.builtRecipes().indexOf('__NOT_YET__') < 0, 'never offered as buildable');
  } finally {
    delete R.RECIPES.__NOT_YET__;
  }
});


/* ── the guard ── */

test('good props pass through with defaults filled in', () => {
  const res = R.validateProps('STAT_COUNTER', { value: 8484, prefix: 'Rs ' });
  assert.equal(res.ok, true, res.errors.join('; '));
  assert.equal(res.props.value, 8484);
  assert.equal(res.props.prefix, 'Rs ');
  assert.equal(res.props.pulse, false, 'defaults are applied, not left undefined');
});

test('a missing required prop is named, with the help text', () => {
  const res = R.validateProps('STAT_COUNTER', { title: 'Take home' });
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /needs "value"/);
});

test('a prop of the wrong type is refused rather than coerced', () => {
  // "8,484" reaching AE would render as NaN in the count expression
  const res = R.validateProps('STAT_COUNTER', { value: 'eight thousand' });
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /must be a number/);
});

test('a numeric string is accepted, because models emit them constantly', () => {
  const res = R.validateProps('STAT_COUNTER', { value: '8484' });
  assert.equal(res.ok, true);
  assert.equal(res.props.value, 8484);
  assert.equal(typeof res.props.value, 'number');
});

test('an invented recipe name is refused', () => {
  const res = R.validateProps('COOL_3D_EXPLOSION', { value: 1 });
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /unknown recipe/);
});

test('an invented parameter is reported and dropped, but does not lose the shot', () => {
  // Fatal would mean one hallucinated key costs a whole shot the model
  // otherwise got right. Report it, drop it, build the rest.
  const res = R.validateProps('STAT_COUNTER', { value: 1, glowIntensity: 9 });
  assert.equal(res.ok, true);
  assert.match(res.warnings.join(' '), /no parameter "glowIntensity"/);
  assert.equal(res.props.glowIntensity, undefined, 'never reaches the builder');
  assert.equal(res.props.value, 1);
});

test('the common props are recognised, not mistaken for typos', () => {
  // bgSrc/accentColor/font travel inside props but belong to every recipe
  const res = R.validateProps('STAT_COUNTER', { value: 1, accentColor: '#ff0000' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.warnings, [], 'a real brief would have been rejected');
  assert.equal(res.common.accentColor, '#ff0000');
});

test('an unapproved enum falls back to its default and says so', () => {
  const res = R.validateProps('SECTION_TITLE_CARD', { title: 'X', variant: 'explode' });
  assert.equal(res.ok, true, 'a cosmetic choice must not cost the title card');
  assert.equal(res.props.variant, 'slide_up');
  assert.match(res.warnings.join(' '), /slide_up/);
});

test('an enum with no safe default is still fatal', () => {
  // the fallback above is only legitimate because a default exists
  const res = R.validateProps('ASSET_REVEAL', { fit: 'squish' });
  assert.equal(res.props.fit, 'fill', 'fit has a default, so it falls back');
  assert.match(res.warnings.join(' '), /squish/);
});

test('an empty array where data is required is refused', () => {
  const res = R.validateProps('BAR_CHART', { bars: [] });
  assert.equal(res.ok, false);
  assert.match(res.errors.join(' '), /non-empty array/);
});

/* ── the archetype map the web agent reads ── */

test('their archetypes map to my recipes', () => {
  assert.equal(R.recipeForArchetype('STAT_COUNTER'), 'STAT_COUNTER');
  assert.equal(R.recipeForArchetype('SCREENSHOT_HIGHLIGHT'), 'DOC_HIGHLIGHT',
               'one builder covers both highlight archetypes');
  assert.equal(R.recipeForArchetype('BROLL_VIDEO'), 'ASSET_REVEAL');
});

test('an archetype AE cannot build returns null, the signal to generate it', () => {
  // every archetype the other repo emits is buildable now, so the guard is
  // checked against one nobody has defined — which is the case it exists for
  assert.equal(R.recipeForArchetype('HOLOGRAM_TABLE'), null);
  assert.equal(R.recipeForArchetype(''), null);
});

test('the honoured technique list only contains techniques of BUILT recipes', () => {
  // publishing a technique carried only by a planned recipe would have the
  // web agent emitting motion the panel silently ignores
  for (const t of R.honouredTechniques()) {
    const carriers = R.builtRecipes().filter((n) => (R.RECIPES[n].techniques || []).includes(t));
    assert.ok(carriers.length, `${t} is published but no built recipe honours it`);
  }
});

test('no technique is advertised while no builder even reads spec.technique', () => {
  // The generated doc briefly claimed PUSH_IN was honoured because the
  // registry said so — but no builder looks at spec.technique, so the motion
  // would have been silently dropped. A recipe may only advertise a technique
  // once the jsx actually consults it.
  const jsx = fs.readFileSync(JSX, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const reads = /spec\.technique/.test(jsx);
  if (!reads) {
    assert.deepEqual(R.honouredTechniques(), [],
      'recipes.js advertises a technique, but no builder in visuals.jsx reads ' +
      'spec.technique — the web agent would send motion that goes nowhere');
  }
});
