// Webshelf ranking: asks our search server (Bing and others) and Mwmbl at the
// same time, then merges and orders the results with rank.js. If the server
// is asleep or slow, Mwmbl's results are ranked on their own.

import { BACKEND } from '../config.js';
import { rank, musicArtist } from '../rank.js';
import { clickShares, pageOf } from '../clicks.js';
import { lookup } from '../wiki.js';
import { fetchSubject, values } from '../entity.js';
import searxng from './searxng.js';
import mwmbl from './mwmbl.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const words = (text) => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

// The official website of the thing searched for, if the search names one:
// Wikidata's "official website" for a matching Wikipedia article, otherwise
// MusicBrainz's official homepage for a band or artist of that exact name.
// Returns [{ url, name, about, source }].
async function officialSites(query, ctx) {
  const asked = words(query);
  if (!asked.length || asked.length > 5) return [];
  try {
    const info = await lookup(query, ctx);
    const title = info.hits[0]?.title;
    if (title && words(title.replace(/\s*\(.*\)$/, '')).every((w) => asked.includes(w))) {
      const entity = await fetchSubject({ qid: info.ids?.[title] ?? null, title }, ctx);
      const sites = values(entity?.claims ?? {}, 'P856').map((v) => v?.value).filter((u) => typeof u === 'string');
      // Wikipedia covers it ("water", "eiffel tower"): Wikidata's answer stands,
      // even if there's no official site, so a band that shares the name can't jump in.
      const about = String(info.hits[0]?.snippet ?? '').replace(/<[^>]+>/g, '');
      return sites.slice(0, 1).map((url) => ({ url, name: title.replace(/\s*\(.*\)$/, ''), about, source: 'Wikidata' }));
    }
  } catch { /* fall through to MusicBrainz */ }
  try {
    const artist = await musicArtist(query, ctx);
    const about = [artist?.type === 'Group' ? 'Band' : artist?.type, artist?.country && `from ${artist.country}`, artist?.tags?.length && `(${artist.tags.join(', ')})`].filter(Boolean).join(' ');
    return (artist?.official ?? []).slice(0, 1).map((url) => ({ url, name: artist.name, about, source: 'MusicBrainz' }));
  } catch { return []; }
}

const sourceNames = { bing: 'Bing', brave: 'Brave', mwmbl: 'Mwmbl', wikipedia: 'Wikipedia', wikidata: 'Wikidata' };

export default {
  id: 'webshelf',
  name: 'Webshelf ranking',
  about: 'Results from Bing (through our search server) and Mwmbl, merged and ranked by Webshelf using open signals: agreement between engines, how widely used a site is, how well its title matches, and the official website of what you searched for.',
  home: 'about.html#ranking',
  verticals: ['all'],
  // What the engines behind the server can do. SearXNG's Bing connector can't
  // fetch later pages or filter by date (Bing needs JavaScript for both), and
  // the engines that can (Google, Brave, DuckDuckGo, Startpage) block the
  // server. With a time range set, SearXNG drops every engine that can't
  // filter, which is all of them. Turn these on if a capable engine is added;
  // the page numbers, time ranges and date sort are built and wait on them.
  supports: { pages: false, timeRange: false, dates: false },
  // Set after each search, for the page: whether the server answered, how many
  // AI-farm results were left out, and the engines' corrections and suggestions.
  last: { server: false, left: 0, meta: { corrections: [], suggestions: [] } },

  // ctx: { signal, page, time, language, safe, serverTimeout, rankQuery, verbatim }
  // rankQuery is the search without operators (site:, "quotes", -words), for
  // ranking and for looking up official sites; the engines get the whole query.
  async search(query, ctx = {}) {
    const page = ctx.page ?? 1;
    const rankQuery = ctx.rankQuery ?? query;
    // Official sites belong to the first page, and not to verbatim searches.
    const official = page === 1 && !ctx.verbatim ? officialSites(rankQuery, ctx) : Promise.resolve([]);
    const fromServer = BACKEND.searxngUrl
      ? searxng.search(query, { ...ctx, timeout: ctx.serverTimeout ?? 4500 }).then((r) => (r.length ? r : null)).catch(() => null)
      : Promise.resolve(null);
    // Mwmbl has one page of results, so it only stands in on the first.
    const fromMwmbl = page === 1 ? mwmbl.search(query, ctx).catch(() => null) : Promise.resolve(null);
    // Click counts, for visitors who turned them on (nothing is sent otherwise).
    const shares = clickShares(rankQuery);

    // The server already includes Mwmbl, so Mwmbl alone is only used without it.
    const server = await fromServer;
    // The server's list is in its own merged order; split it back into each
    // engine's list, so every engine's results are ranked by its own order.
    const lists = [];
    if (server) {
      const byEngine = new Map();
      for (const r of server) {
        for (const e of r.engines?.length ? r.engines : ['server']) {
          if (!byEngine.has(e)) byEngine.set(e, []);
          byEngine.get(e).push({ ...r, engines: [e] });
        }
      }
      for (const [engine, results] of byEngine) lists.push({ engine, results });
    }
    if (!server) {
      const own = await fromMwmbl;
      if (own) lists.push({ engine: 'mwmbl', results: own });
    }
    if (!lists.length) throw new Error('No search engine answered');

    const sites = await Promise.race([official, wait(2500).then(() => [])]);
    const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const counted = await shares;
    const { results, left } = await rank(rankQuery, lists, {
      officialHosts: sites.map((s) => host(s.url)),
      crowd: !/(?:^|\s)site:/i.test(query),
      clicks: counted ? (url) => counted.get(pageOf(url)) ?? 0 : null,
    });
    this.last = { server: Boolean(server), left, meta: server?.meta ?? { corrections: [], suggestions: [] } };
    // An official site no engine found still belongs first: add it, credited to
    // the open database that names it.
    // Also when the engines found only an inner page of it: the home page is
    // what the search names, and the inner pages then sit under it as sitelinks.
    const isHome = (url) => { try { const u = new URL(url); return u.pathname.replace(/\/(?:index\.html?)?$/, '') === '' && !u.search; } catch { return false; } };
    const missing = page > 1 ? [] : sites.filter((s) => !results.some((r) => host(r.url) === host(s.url) && (isHome(r.url) || !isHome(s.url))))
      .map((s) => ({
        url: s.url,
        title: [{ text: `${s.name} – official website`, bold: false }],
        snippet: s.about ? [{ text: s.about, bold: false }] : [],
        source: `Official website, as listed by ${s.source}`,
      }));
    return missing.concat(results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet ?? [],
      date: r.date ?? null,
      source: `Found by ${r.engines.map((e) => sourceNames[e] ?? e).join(' and ')}, ranked by Webshelf`,
    })));
  },
};
