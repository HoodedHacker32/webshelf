// Webshelf ranking: asks our search server (Bing and others) and Mwmbl at the
// same time, then merges and orders the results with rank.js. If the server
// is asleep or slow, Mwmbl's results are ranked on their own.

import { BACKEND } from '../config.js';
import { rank, musicArtist } from '../rank.js';
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
  home: 'settings.html#ranking',
  verticals: ['all'],
  // Set after each search, for the page footer.
  last: { server: false, left: 0 },

  async search(query, ctx = {}) {
    const official = officialSites(query, ctx);
    const fromServer = BACKEND.searxngUrl
      ? searxng.search(query, { ...ctx, timeout: 6000 }).then((r) => (r.length ? r : null)).catch(() => null)
      : Promise.resolve(null);
    const fromMwmbl = mwmbl.search(query, ctx).catch(() => null);

    // The server already includes Mwmbl, so Mwmbl alone is only used without it.
    const server = await fromServer;
    const lists = server ? [{ engine: 'server', results: server }] : [];
    if (!server) {
      const own = await fromMwmbl;
      if (own) lists.push({ engine: 'mwmbl', results: own });
    }
    if (!lists.length) throw new Error('No search engine answered');

    const sites = await Promise.race([official, wait(2500).then(() => [])]);
    const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const { results, left } = await rank(query, lists, { officialHosts: sites.map((s) => host(s.url)) });
    this.last = { server: Boolean(server), left };
    // An official site no engine found still belongs first: add it, credited to
    // the open database that names it.
    const missing = sites.filter((s) => !results.some((r) => host(r.url) === host(s.url)))
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
      source: `Found by ${r.engines.map((e) => sourceNames[e] ?? e).join(' and ')}, ranked by Webshelf`,
    })));
  },
};
