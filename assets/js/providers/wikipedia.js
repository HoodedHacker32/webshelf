// Wikipedia full-text search, for when only encyclopedia results are wanted.

import { getJSON } from '../dom.js';

// Wikipedia marks matches with <span class="searchmatch">; turn that into runs.
function runsFromSnippet(html) {
  const doc = new DOMParser().parseFromString(`<p>${html}</p>`, 'text/html');
  const out = [];
  for (const node of doc.body.firstChild.childNodes) {
    const text = node.textContent;
    if (text) out.push({ text, bold: node.nodeType === 1 && node.classList.contains('searchmatch') });
  }
  return out;
}

export default {
  id: 'wikipedia',
  name: 'Wikipedia',
  about: 'Searches English Wikipedia articles only.',
  home: 'https://en.wikipedia.org',
  verticals: ['all'],

  async search(query, { signal } = {}) {
    const params = new URLSearchParams({
      action: 'query', list: 'search', srsearch: query, srlimit: 30,
      srprop: 'snippet', format: 'json', origin: '*',
    });
    const data = await getJSON(`https://en.wikipedia.org/w/api.php?${params}`, { signal });
    return (data?.query?.search ?? []).map((hit) => ({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
      title: [{ text: hit.title, bold: false }],
      snippet: runsFromSnippet(hit.snippet ?? ''),
      source: 'Wikipedia',
    }));
  },
};
