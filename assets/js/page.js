// What every results page shares: the query, the toolbar (logo, search box,
// tabs), the loading signal and the source line in the footer.

import { SITE, searchUrl } from './config.js';
import { h, $, $$ } from './dom.js';
import { getSettings, addHistory } from './store.js';
import { createSearchbox } from './searchbox.js';
import { mountLogos, rockBook } from './logo.js';
import './theme.js';

// Point the tabs at the same search on each page.
export function mountTabs(query) {
  for (const tab of $$('#serp-tabs .tab')) tab.href = searchUrl(query, tab.dataset.page);
}

export function setupPage({ page, title, sources }) {
  const params = new URLSearchParams(location.search);
  const query = (params.get('q') ?? '').trim();
  if (!query) location.replace('index.html');

  const settings = getSettings();
  const abort = new AbortController();
  document.title = `${query} - ${title} - ${SITE.name}`;
  $('#serp-h1').textContent = `${SITE.name} ${title.toLowerCase()} for ${query}`;
  $('#serp-search').replaceChildren(createSearchbox({ value: query, page }));
  mountTabs(query);
  addHistory(query);

  let pending = 0;
  const main = $('#main');
  mountLogos().then(() => { if (pending) rockBook($('#toolbar')); });
  const track = async (promise) => {
    if (!pending) rockBook($('#toolbar'));
    pending += 1;
    main.setAttribute('aria-busy', 'true');
    try { return await promise; } finally {
      pending -= 1;
      if (!pending) main.removeAttribute('aria-busy');
    }
  };

  $('#serp-source-note').replaceChildren(`${title} from `,
    ...sources.flatMap(([name, href], i) => [i ? (i === sources.length - 1 ? ' and ' : ', ') : '', h('a', { href }, name)]),
    `. ${SITE.name} uses no AI.`);

  return {
    query,
    settings,
    ctx: { signal: abort.signal, query },
    track,
    target: settings.newTab ? '_blank' : null,
  };
}
