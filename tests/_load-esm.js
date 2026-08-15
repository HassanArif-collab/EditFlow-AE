/* Load a browser ES module for Node tests.
   The repo has no package.json, so `import()` of .js resolves as CJS. Instead
   we strip `export` keywords, collect the exported names, and evaluate the
   source in the HOST realm via new Function (vm contexts create a separate
   realm whose arrays fail deepStrictEqual prototype checks). */
const fs = require('node:fs');

function loadEsm(filePath, sandbox = {}) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (/^\s*import\s/m.test(src)) {
    // Strip the import statements and require every name they bind to be in
    // the sandbox. That's what lets a view module be tested with a fake AE
    // bridge instead of needing CSInterface and a running panel.
    const missing = [];
    src = src.replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?\s*$/gm, (_m, clause) => {
      const names = clause.replace(/[{}]/g, ' ').split(',')
        .map((n) => n.split(/\s+as\s+/).pop().trim()).filter(Boolean);
      for (const n of names) if (!(n in sandbox)) missing.push(n);
      return '';
    });
    if (missing.length) {
      throw new Error(`loadEsm: ${filePath} imports ${missing.join(', ')} — pass them in sandbox`);
    }
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
