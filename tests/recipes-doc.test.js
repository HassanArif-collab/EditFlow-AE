/* docs/recipes.md is what the Content Prompts agent builds its briefs against.
 * A stale copy means they emit orders this panel refuses, and neither side can
 * see why. So the committed file must equal what the generator produces now. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { doc, OUT } = require('../scripts/gen-recipe-docs');

test('docs/recipes.md is up to date with the registry', () => {
  const onDisk = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  assert.equal(onDisk, doc,
    'docs/recipes.md is stale — run `node scripts/gen-recipe-docs.js`. ' +
    'The other agent writes briefs against this file.');
});
