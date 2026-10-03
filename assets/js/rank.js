// Webshelf's ranking: merges results from several engines and orders them with
// open signals, the way classic search engines did, with no AI involved.
//
// Each result's score is the sum of:
//   1. Agreement: reciprocal-rank fusion over every engine that returned it
//      (a result two engines rank highly beats one engine's favourite).
//   2. Authority: the site's place in the Tranco top-50,000 list.
//   3. Match: query words in the title, and the address itself spelling the
//      query ("gordonramsay.com" for "gordon ramsay").
//   4. Identity: the official website of the thing searched for, from Wikidata
//      or MusicBrainz, goes first, as it does on Google.
// Sites on the AI content-farm blocklist are left out.

import { getJSON } from './dom.js';

// How much each engine's ranking counts. Bing's index is the largest we reach.
const ENGINE_WEIGHT = { bing: 1, brave: 1, wikipedia: 0.8, wikidata: 0.5, mwmbl: 0.55 };
const RRF_K = 20;

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

const words = (text) => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

// lists: [{ engine, results }] where each result is { url, title, snippet, ... }.
// Returns { results, left } with left = how many AI-farm results were removed.
export async function rank(query, lists, { officialHosts = [] } = {}) {
  const { rank: top, farms, size } = await loadLists();
  const terms = words(query);
  const squashed = terms.join('');
  const official = new Set(officialHosts.map((h) => h.replace(/^www\./, '').toLowerCase()));
  const merged = new Map();

  for (const { engine, results } of lists) {
    results.forEach((r, i) => {
      const key = normaliseUrl(r.url);
      const engines = r.engines?.length ? r.engines : [engine];
      const weight = Math.max(...engines.map((e) => ENGINE_WEIGHT[e] ?? 0.5));
      const entry = merged.get(key) ?? { ...r, url: r.url, engines: new Set(), agreement: 0 };
      engines.forEach((e) => entry.engines.add(e));
      entry.agreement += weight / (RRF_K + i + 1);
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
    const navigational = squashed.length > 3 && host.replace(/\.[a-z.]+$/, '').replace(/[^a-z0-9]/g, '') === squashed;

    const isOfficial = official.has(host) || [...official].some((o) => host.endsWith(`.${o}`));
    // A site's home page is the answer to its own name.
    let path = '/';
    try { path = new URL(entry.url).pathname; } catch { /* keep "/" */ }

    const score = entry.agreement * 20          // about 0 to 2.5
      + authority * 0.6
      + inTitle * 0.5
      + (navigational ? 1.5 : 0)
      + (isOfficial ? (path.length <= 1 ? 6 : 3) : 0)
      + (entry.engines.size > 1 ? 0.3 : 0);
    scored.push({ ...entry, engines: [...entry.engines], score });
  }
  scored.sort((a, b) => b.score - a.score);
  return { results: scored, left };
}
