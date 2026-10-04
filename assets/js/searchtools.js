// The Tools menu on the results page, as Google had it: time range,
// language, sort order and verbatim. Every choice lives in the address
// (time, lang, sort, verbatim, page), so a filtered search can be shared.

import { searchUrl } from './config.js';
import { h, $ } from './dom.js';

export const LANGUAGES = [
  ['en', 'English'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian'],
  ['nl', 'Dutch'], ['pt', 'Portuguese'], ['pl', 'Polish'], ['sv', 'Swedish'], ['ja', 'Japanese'], ['all', 'Any language'],
];
const TIMES = [['', 'Any time'], ['day', 'Past 24 hours'], ['week', 'Past week'], ['month', 'Past month'], ['year', 'Past year']];
const SORTS = [['', 'Sorted by relevance'], ['date', 'Sorted by date']];

// The address of a results page with these tools, on page n.
export function pageUrl(query, tools, n = 1, page = 'search.html') {
  const params = new URLSearchParams();
  if (tools.time) params.set('time', tools.time);
  if (tools.lang) params.set('lang', tools.lang);
  if (tools.sort) params.set('sort', tools.sort);
  if (tools.verbatim) params.set('verbatim', '1');
  if (n > 1) params.set('page', String(n));
  const rest = params.toString();
  return `${searchUrl(query, page)}${rest ? `&${rest}` : ''}`;
}

// supports: what the results provider can do ({ timeRange, dates }); tools it
// can't honour aren't offered.
export function mountTools({ query, tools, settings, supports = {} }) {
  const tabs = $('#serp-tabs');
  if (!tabs) return;
  const active = Boolean(tools.time || tools.lang || tools.sort || tools.verbatim);
  const go = (change) => location.assign(pageUrl(query, { ...tools, ...change }, 1));

  const select = (label, options, value, key) => {
    const el = h('select', { class: 'field tools-select', 'aria-label': label },
      options.map(([v, text]) => h('option', { value: v, selected: (value ?? '') === v }, text)));
    el.addEventListener('change', () => go({ [key]: el.value || null }));
    return el;
  };
  const defaultLang = settings.language ?? 'en';
  const langOptions = LANGUAGES.map(([code, name]) => [code === defaultLang ? '' : code, code === defaultLang ? `${name} (your setting)` : name]);
  const verbatim = h('label', { class: 'check tools-check' },
    h('input', { type: 'checkbox', checked: tools.verbatim }), ' Verbatim');
  verbatim.querySelector('input').addEventListener('change', (e) => go({ verbatim: e.target.checked }));

  // The row is in the page already (search.html), shown before first paint
  // when the address has tools in it, so filling it never moves anything.
  const row = $('#search-tools');
  row.replaceChildren(
    supports.timeRange ? select('Time range', TIMES, tools.time, 'time') : '',
    select('Language', langOptions, tools.lang, 'lang'),
    supports.dates ? select('Sort order', SORTS, tools.sort, 'sort') : '',
    verbatim,
    active ? h('a', { class: 'tools-clear', href: searchUrl(query) }, 'Clear') : '');
  row.hidden = !active;

  const button = h('button', { class: 'tab tools-toggle', type: 'button', 'aria-expanded': String(active), 'aria-controls': 'search-tools' }, 'Tools');
  button.addEventListener('click', () => {
    row.hidden = !row.hidden;
    button.setAttribute('aria-expanded', String(!row.hidden));
  });
  tabs.append(button);
}
