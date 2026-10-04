// Golden queries: real searches through the live search server and Webshelf's
// ranking, checking that a known answer is still near the top. Run it after
// changing assets/js/rank.js or the server's engines:
//
//   node tools/golden.mjs            (all of tests/golden-queries.json)
//   node tools/golden.mjs "radiohead" (one query, showing its top five)
//
// It needs the internet and wakes the Render server if it's asleep (the first
// query can take a minute). Queries are spaced out to stay within the
// free services' limits.
import { readFileSync } from 'node:fs';
import { useLists } from '../assets/js/rank.js';
import webshelf from '../assets/js/providers/webshelf.js';

// MusicBrainz asks every client to identify itself; browsers send a User-Agent
// on their own, Node doesn't.
const plainFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => plainFetch(url, { ...init, headers: { 'User-Agent': 'Webshelf golden queries (github.com/HoodedHacker32/webshelf)', ...(init.headers ?? {}) } });

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const top = new Map();
let n = 0;
for (const line of read('assets/data/top-sites.txt').split('\n')) if (line && line[0] !== '#') top.set(line.trim(), ++n);
const farms = new Set(read('assets/data/ai-sites.txt').split('\n').filter((l) => l && l[0] !== '#').map((l) => l.trim()));
useLists({ rank: top, farms, size: n });

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const one = process.argv[2];
const cases = one ? [{ q: one, expect: [], within: 5 }] : JSON.parse(read('tests/golden-queries.json'));

let failed = 0;
for (const c of cases) {
  let results = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    results = await webshelf.search(c.q, { serverTimeout: attempt ? 60000 : 15000 }).catch(() => []);
    if (webshelf.last.server) break;
  }
  const hosts = results.slice(0, Math.max(c.within, 5)).map((r) => host(r.url));
  const hit = hosts.slice(0, c.within).some((h) => c.expect.some((e) => h === e || h.endsWith(`.${e}`)));
  const ok = one ? true : hit;
  if (!ok) failed += 1;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${c.q.padEnd(26)} ${webshelf.last.server ? '' : '(server asleep: Mwmbl only) '}top: ${hosts.join(', ')}`);
  await wait(1500);
}
if (!one) console.log(`\n${cases.length - failed} of ${cases.length} passed`);
process.exitCode = failed ? 1 : 0;
