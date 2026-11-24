// Loads the ```js block under "## Код" of a snippet as a module, so a test runs the canon itself.
import { readFileSync } from 'node:fs';
export async function load(name) {
  const md = readFileSync(new URL(`../${name}.md`, import.meta.url), 'utf8');
  const m = /## Код\n\n```js\n([\s\S]*?)\n```/.exec(md);
  if (!m) throw new Error(`no code block in ${name}.md`);
  return import('data:text/javascript,' + encodeURIComponent(m[1]));
}
export function suite() {
  let failed = 0, n = 0;
  return {
    ok(c, name) { n++; if (!c) { failed++; console.log('FAIL', name); } },
    async throws(fn, re, name) { n++; let t = false; try { await fn(); } catch (e) { t = re.test(e.message); } if (!t) { failed++; console.log('FAIL', name); } },
    done(file) { console.log(`${file}: ${failed ? failed + ' of ' + n + ' failed' : 'all ' + n + ' passed'}`); if (failed) process.exitCode = 1; },
  };
}
