// Webshelf's ranking: merges results from several engines and orders them with
// open signals, the way classic search engines did, with no AI involved.
//
// Each result's score is the sum of:
//   1. Agreement: reciprocal-rank fusion over every engine that returned it
//      (a result two engines rank highly beats one engine's favourite).
//   2. Authority: the site's place in the Tranco top-50,000 list.
//   3. Match: every query word present somewhere (missing words cost a lot),
//      words in the title, and the address itself spelling the query
//      ("gordonramsay.com" for "gordon ramsay").
//   4. Identity: the official website of the thing searched for, from Wikidata
//      or MusicBrainz, goes first, as it does on Google.
// Sites on the AI content-farm blocklist are left out.

import { getJSON } from './dom.js';

// Every number the ranking uses, in one place. A result's score is:
//   agreement × WEIGHTS.agreement      (sum over engines of engine weight / (rrfK + position))
// + authority × WEIGHTS.authority      (1 for the most visited site, falling to 0 at the 50,000th)
// + titleShare × WEIGHTS.titleMatch    (share of the search's words in the title)
// − missingShare × WEIGHTS.missingWords (share of the words found nowhere: title, snippet or address)
// + WEIGHTS.navigational               if the address spells the search ("gordonramsay.com")
// + WEIGHTS.officialHome / officialPage if it's the official site (home page / other page)
// + WEIGHTS.severalEngines             if more than one engine found it
export const WEIGHTS = {
  // How much each engine's ranking counts. Bing's index is the largest we reach.
  engines: { bing: 1, brave: 1, wikipedia: 0.8, wikidata: 0.5, mwmbl: 0.55 },
  otherEngine: 0.5,
  // Reciprocal-rank fusion constant: lower lets an engine's top results stand out more.
  rrfK: 20,
  // Agreement comes out around 0 to 0.13; this brings it to about 0 to 2.5.
  agreement: 20,
  // Kept modest so a good small site or forum can still outrank a big one:
  // the difference between the 10th and 10,000th most visited site is 0.2.
  authority: 0.35,
  titleMatch: 0.5,
  missingWords: 1.5,
  navigational: 1.5,
  officialHome: 6,
  officialPage: 3,
  severalEngines: 0.3,
};

// "www.en.m.wikipedia.org" -> "wikipedia.org" style lookups try each suffix.
const suffixes = (host) => {
  const parts = host.split('.');
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join('.'));
};

export function hostOfUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

// One address per page, whichever engine found it.
export function normaliseUrl(url) {
  try {
    const u = new URL(url.replace(/\/__url__$/, '/'));
    u.hostname = u.hostname.replace(/^www\./, '').replace(/^(\w+)\.m\.wikipedia\.org$/, '$1.wikipedia.org');
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']) u.searchParams.delete(p);
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch { return url; }
}

/* Lists, loaded once and cached by the browser. ------------------------- */

let lists = null;
// For tools that run outside a browser (tools/golden.mjs): hand over the lists
// read from disk, in the shape rank() uses.
export function useLists(data) { lists = Promise.resolve(data); }
async function loadLists() {
  if (!lists) {
    const text = (path) => fetch(path).then((r) => (r.ok ? r.text() : '')).catch(() => '');
    lists = Promise.all([text('assets/data/top-sites.txt'), text('assets/data/ai-sites.txt')]).then(([top, ai]) => {
      const rank = new Map();
      let n = 0;
      for (const line of top.split('\n')) if (line && line[0] !== '#') rank.set(line.trim(), ++n);
      const farms = new Set(ai.split('\n').filter((l) => l && l[0] !== '#').map((l) => l.trim()));
      return { rank, farms, size: n || 1 };
    });
  }
  return lists;
}

/* Official websites of the thing searched for. -------------------------- */

const MB = 'https://musicbrainz.org/ws/2';

// A band or artist whose name is the search (or the search plus "band",
// "music", "songs"…), with its official site and listening links.
// MusicBrainz asks for about one request a second, so each search asks once.
const artists = new Map();
export function musicArtist(query, ctx = {}) {
  const key = query.trim().toLowerCase();
  if (!artists.has(key)) artists.set(key, findArtist(query, ctx).catch(() => null));
  return artists.get(key);
}

async function findArtist(query, { signal } = {}) {
  const name = query.trim().replace(/\s+(band|music|songs|albums|artist|singer|official)$/i, '');
  if (name.split(/\s+/).length > 5) return null;
  const data = await getJSON(`${MB}/artist/?query=${encodeURIComponent(`artist:"${name}"`)}&fmt=json&limit=3`, { signal, timeout: 4000 });
  const hit = (data?.artists ?? []).find((a) => a.score >= 95 && a.name.toLowerCase() === name.toLowerCase());
  if (!hit) return null;
  const full = await getJSON(`${MB}/artist/${hit.id}?inc=url-rels+tags&fmt=json`, { signal, timeout: 4000 });
  const links = (full.relations ?? []).map((r) => ({ type: r.type, url: r.url?.resource })).filter((l) => l.url);
  return {
    id: hit.id,
    name: full.name,
    type: full.type,
    country: full.area?.name ?? null,
    began: full['life-span']?.begin ?? null,
    tags: (full.tags ?? []).sort((a, b) => b.count - a.count).map((t) => t.name).slice(0, 3),
    official: links.filter((l) => l.type === 'official homepage').map((l) => l.url),
    links,
  };
}

/* Ranking ---------------------------------------------------------------- */

const STOP = new Set(['a', 'an', 'the', 'to', 'in', 'into', 'of', 'on', 'at', 'by', 'for', 'from', 'with', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'how', 'what', 'who', 'when', 'where', 'why', 'which', 'do', 'does', 'did', 'it', 'its', 'my', 'me', 'i', 'vs', 'as']);
const words = (text) => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

// lists: [{ engine, results }] where each result is { url, title, snippet, ... }.
// data (optional, for tests): { rank: Map(host -> place), farms: Set(host), size }.
// Returns { results, left } with left = how many AI-farm results were removed.
export async function rank(query, lists, { officialHosts = [], data = null } = {}) {
  const { rank: top, farms, size } = data ?? await loadLists();
  // Little words ("to", "in", "the") match almost any page, so only the words
  // that carry meaning count; the address check still uses them all
  // ("theguardian.com" for "the guardian").
  const all = words(query);
  const meaningful = all.filter((w) => !STOP.has(w));
  const terms = meaningful.length ? meaningful : all;
  const squashed = all.join('');
  const official = new Set(officialHosts.map((h) => h.replace(/^www\./, '').toLowerCase()));
  const merged = new Map();

  for (const { engine, results } of lists) {
    results.forEach((r, i) => {
      const key = normaliseUrl(r.url);
      const engines = r.engines?.length ? r.engines : [engine];
      const weight = Math.max(...engines.map((e) => WEIGHTS.engines[e] ?? WEIGHTS.otherEngine));
      const entry = merged.get(key) ?? { ...r, url: r.url, engines: new Set(), agreement: 0 };
      engines.forEach((e) => entry.engines.add(e));
      entry.agreement += weight / (WEIGHTS.rrfK + i + 1);
      if (!entry.snippet?.length && r.snippet?.length) entry.snippet = r.snippet;
      merged.set(key, entry);
    });
  }

  let left = 0;
  const scored = [];
  for (const entry of merged.values()) {
    const host = hostOfUrl(entry.url);
    if (suffixes(host).some((s) => farms.has(s)) || farms.has(host)) { left += 1; continue; }

    // Authority: 1 for the most popular site, falling slowly to 0 at 50,000th.
    const place = [host, ...suffixes(host)].map((s) => top.get(s)).find(Boolean);
    const authority = place ? 1 - Math.log(place) / Math.log(size + 1) : 0;

    // Match: share of query words in the title; the address spelling the query.
    const title = words(entry.title.map?.((r) => r.text).join('') ?? entry.title);
    const inTitle = terms.length ? terms.filter((t) => title.includes(t)).length / terms.length : 0;
    // Every word somewhere (title, snippet or address) matters most: a page about
    // "Gordon" the engineering firm isn't an answer to "gordon ramsay".
    const text = `${title.join(' ')} ${words(entry.snippet?.map?.((r) => r.text).join('') ?? entry.snippet).join(' ')} ${words(entry.url).join(' ')}`;
    const covered = terms.length ? terms.filter((t) => text.includes(t)).length / terms.length : 1;
    const navigational = squashed.length > 3 && host.replace(/\.[a-z.]+$/, '').replace(/[^a-z0-9]/g, '') === squashed;

    const isOfficial = official.has(host) || [...official].some((o) => host.endsWith(`.${o}`));
    // A site's home page is the answer to its own name.
    let path = '/';
    try { path = new URL(entry.url).pathname; } catch { /* keep "/" */ }

    const score = entry.agreement * WEIGHTS.agreement
      + authority * WEIGHTS.authority
      + inTitle * WEIGHTS.titleMatch
      - (1 - covered) * WEIGHTS.missingWords
      + (navigational ? WEIGHTS.navigational : 0)
      + (isOfficial ? (path.length <= 1 ? WEIGHTS.officialHome : WEIGHTS.officialPage) : 0)
      + (entry.engines.size > 1 ? WEIGHTS.severalEngines : 0);
    scored.push({ ...entry, engines: [...entry.engines], score });
  }
  scored.sort((a, b) => b.score - a.score);
  return { results: scored, left };
}
