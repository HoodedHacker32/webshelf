// SearXNG: our own metasearch server (see server/README.md). It asks several
// search engines at once and merges their results. Its JSON API is enabled and
// the server's Caddy front sends the CORS headers browsers need.

import { getJSON } from '../dom.js';
import { BACKEND } from '../config.js';

// SearXNG returns plain text; bold the words that match the search, the way
// the other providers mark matched terms.
function runs(text, terms) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (!terms.length) return [{ text: clean, bold: false }];
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return clean.split(pattern).filter(Boolean).map((part) => ({ text: part, bold: terms.some((t) => t.toLowerCase() === part.toLowerCase()) }));
}

const termsOf = (query) => query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

export default {
  id: 'searxng',
  name: 'Webshelf search server',
  about: 'Our own SearXNG server, which asks several independent search engines at once and merges what they find.',
  get home() { return BACKEND.searxngUrl ?? 'https://docs.searxng.org'; },
  verticals: ['all'],

  // Options: page (1-based), time ('day' | 'week' | 'month' | 'year'),
  // language (SearXNG code, e.g. 'en', 'de'), safe (0 off, 1 moderate, 2 strict).
  async search(query, { signal, timeout = 12000, page = 1, time = null, language = 'en', safe = 1 } = {}) {
    if (!BACKEND.searxngUrl) throw new Error('No search server set');
    const params = new URLSearchParams({ q: query, format: 'json', language, safesearch: String(safe), pageno: String(page) });
    if (time) params.set('time_range', time);
    const data = await getJSON(`${BACKEND.searxngUrl}/search?${params}`, { signal, timeout });
    const terms = termsOf(query);
    const seen = new Set();
    // Engines disagree on the form of a link: Bing gives Wikipedia's mobile
    // address, and its redirect unwrapping can leave "/__url__" on the end.
    const tidy = (url) => url.replace(/\/__url__$/, '/').replace(/^https:\/\/(\w+)\.m\.wikipedia\.org\//, 'https://$1.wikipedia.org/');
    const results = (data?.results ?? [])
      .filter((r) => typeof r?.url === 'string' && /^https?:\/\//.test(r.url))
      .map((r) => ({ ...r, url: tidy(r.url) }))
      .filter((r) => !seen.has(r.url) && seen.add(r.url))
      .map((r) => ({
        url: r.url,
        title: runs(r.title, terms),
        snippet: runs(r.content, terms),
        engines: (r.engines ?? [r.engine]).filter(Boolean),
        date: r.publishedDate && r.publishedDate !== 'None' ? r.publishedDate : null,
        source: `${(r.engines ?? [r.engine]).filter(Boolean).join(', ')} (via Webshelf search)`,
      }))
      .filter((r) => r.title.length);
    // What the engines suggested alongside: spelling corrections and related searches.
    results.meta = {
      corrections: (data?.corrections ?? []).filter((c) => typeof c === 'string'),
      suggestions: (data?.suggestions ?? []).filter((c) => typeof c === 'string'),
    };
    return results;
  },
};
