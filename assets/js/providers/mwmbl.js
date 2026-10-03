// Mwmbl: a non-profit, open-source search engine with a community-built index.
// Its v1 API is free, keyless and CORS-enabled. https://mwmbl.org

import { getJSON } from '../dom.js';

// Wikipedia extracts arrive with citation marks ("[10][11]"); drop them.
const runs = (parts) => (Array.isArray(parts) ? parts : [])
  .map((p) => ({ text: String(p?.value ?? '').replace(/\[\d+\]/g, ''), bold: Boolean(p?.is_bold) }))
  .filter((r) => r.text);

// Extracts are cut at a fixed length; show that the way the original did.
function markCut(snippet) {
  const last = snippet.at(-1);
  if (!last || /[.!?…"”')\]]\s*$/.test(last.text)) return snippet;
  return [...snippet.slice(0, -1), { ...last, text: `${last.text.trimEnd()} …` }];
}

export default {
  id: 'mwmbl',
  name: 'Mwmbl',
  about: 'Mwmbl is a non-profit, open-source search engine whose index is crawled by volunteers.',
  home: 'https://mwmbl.org',
  verticals: ['all'],

  async search(query, { signal } = {}) {
    const data = await getJSON(`https://api.mwmbl.org/api/v1/search/?s=${encodeURIComponent(query)}`, { signal, timeout: 10000 });
    if (!Array.isArray(data)) throw new Error('Unexpected response');
    const seen = new Set();
    return data
      .filter((r) => typeof r?.url === 'string' && /^https?:\/\//.test(r.url))
      .filter((r) => !seen.has(r.url) && seen.add(r.url))
      .map((r) => ({
        url: r.url,
        title: runs(r.title),
        snippet: runs(r.extract),
        source: r.source === 'wikipedia' ? 'Wikipedia (via Mwmbl)' : 'Mwmbl',
      }))
      .filter((r) => r.title.length)
      .map((r) => ({ ...r, snippet: markCut(r.snippet) }));
  },
};
