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

  async search(query, { signal } = {}) {
    if (!BACKEND.searxngUrl) throw new Error('No search server set');
    const url = `${BACKEND.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en&safesearch=1`;
    const data = await getJSON(url, { signal, timeout: 12000 });
    const terms = termsOf(query);
    const seen = new Set();
    return (data?.results ?? [])
      .filter((r) => typeof r?.url === 'string' && /^https?:\/\//.test(r.url))
      .filter((r) => !seen.has(r.url) && seen.add(r.url))
      .map((r) => ({
        url: r.url,
        title: runs(r.title, terms),
        snippet: runs(r.content, terms),
        source: `${(r.engines ?? [r.engine]).filter(Boolean).join(', ')} (via Webshelf search)`,
      }))
      .filter((r) => r.title.length);
  },
};
