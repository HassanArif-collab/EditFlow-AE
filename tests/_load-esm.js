/* Load a browser ES module for Node tests.
   The repo has no package.json, so `import()` of .js resolves as CJS. Instead
   we strip `export` keywords, collect the exported names, and evaluate the
   source in the HOST realm via new Function (vm contexts create a separate
   realm whose arrays fail deepStrictEqual prototype checks). */
const fs = require('node:fs');
const path = require('node:path');

function loadEsm(filePath, sandbox = {}) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (/^\s*import\s/m.test(src)) {
    // Imports are satisfied two ways. A name already in `sandbox` wins — that
    // is how a view module gets a fake AE bridge instead of CSInterface. Any
    // other name is loaded from the real relative module, so a module that
    // simply imports a sibling needs no ceremony at the call site.
    const missing = [];
    const resolved = Object.assign({}, sandbox);
    src = src.replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_m, clause, from) => {
      const names = clause.replace(/[{}]/g, ' ').split(',')
        .map((n) => n.split(/\s+as\s+/).pop().trim()).filter(Boolean);
      const wanted = names.filter((n) => !(n in resolved));
      if (wanted.length && from.startsWith('.')) {
        const dep = loadEsm(path.resolve(path.dirname(filePath), from), sandbox);
        for (const n of wanted) if (n in dep) resolved[n] = dep[n];
      }
      for (const n of names) if (!(n in resolved)) missing.push(n);
      return '';
    });
    if (missing.length) {
      throw new Error(`loadEsm: ${filePath} imports ${missing.join(', ')} — pass them in sandbox`);
    }
    sandbox = resolved;
  }
  const names = [];
  src = src.replace(
    /^export\s+((?:async\s+)?(?:const|let|var|function|class))\s+([A-Za-z_$][\w$]*)/gm,
    (_m, kind, name) => {
      names.push(name);
      const decl = /^(const|let)$/.test(kind) ? 'var' : kind;
      return `${decl} ${name}`;
    }
  );
  src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  const keys = Object.keys(sandbox);
  const body = `${src}\n;return { ${names.join(', ')} };`;
  // eslint-disable-next-line no-new-func
  return new Function(...keys, body)(...keys.map((k) => sandbox[k]));
}

module.exports = { loadEsm };
