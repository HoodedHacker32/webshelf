// Easy dorking: a form that writes search operators for you (site:, filetype:,
// intitle:, inurl:, "exact", -word, OR), for researchers and anyone who likes
// finding pages directly. Off unless turned on in Settings.
//
// Webshelf checks every result against the operators (operators.js). The
// engines behind it don't all apply them when asked by a server, so the form
// also links the same search on engines that do, in the visitor's own browser.

import { h, $ } from './dom.js';
import { searchUrl } from './config.js';

// Engines that honour operators when a person searches on them.
export const ELSEWHERE = [
  ['DuckDuckGo', (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`],
  ['Brave', (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`],
  ['Mojeek', (q) => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`],
  ['Bing', (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`],
];

export const elsewhereLinks = (query) => ELSEWHERE.flatMap(([name, url], i) =>
  [i ? ' · ' : '', h('a', { href: url(query), rel: 'noreferrer' }, name)]);

const FILETYPES = [
  ['', 'Any format'], ['pdf', 'PDF'], ['docx', 'Word (.docx)'], ['doc', 'Word (.doc)'], ['xlsx', 'Excel (.xlsx)'],
  ['csv', 'CSV'], ['pptx', 'PowerPoint (.pptx)'], ['odt', 'OpenDocument text'], ['txt', 'Plain text'], ['epub', 'EPUB'],
];

// One-click starting points. Each sets a few fields and leaves the rest.
const PRESETS = [
  ['PDF documents', { filetype: 'pdf' }],
  ['Government sites', { site: 'gov gov.uk gov.ie europa.eu' }],
  ['Universities', { site: 'edu ac.uk' }],
  ['Discussions', { site: 'reddit.com stackexchange.com news.ycombinator.com' }],
  ['Data files', { filetype: 'csv' }],
];

const list = (text) => String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
const quote = (v) => (/\s/.test(v) ? `"${v}"` : v);

// The search the fields describe.
export function buildQuery(f) {
  const parts = [];
  if (f.all?.trim()) parts.push(f.all.trim());
  if (f.exact?.trim()) parts.push(`"${f.exact.trim().replace(/"/g, '')}"`);
  const any = list(f.any);
  if (any.length) parts.push(any.join(' OR '));
  for (const w of list(f.none)) parts.push(`-${w}`);
  const sites = list(f.site);
  if (sites.length) parts.push(sites.map((s) => `site:${s}`).join(' OR '));
  for (const s of list(f.notsite)) parts.push(`-site:${s}`);
  if (f.filetype) parts.push(`filetype:${f.filetype}`);
  for (const w of list(f.intitle)) parts.push(`intitle:${quote(w)}`);
  for (const w of list(f.inurl)) parts.push(`inurl:${w}`);
  return parts.join(' ');
}

// The fields for a search already made, so the form can be adjusted.
export function fieldsFrom(parsed) {
  const notsite = parsed.exclude.filter((x) => x.startsWith('site:')).map((x) => x.slice(5));
  const none = parsed.exclude.filter((x) => !x.includes(':') && !/\s/.test(x));
  return {
    all: parsed.words.join(' '),
    exact: parsed.phrases[0] ?? '',
    any: '',
    none: none.join(' '),
    site: parsed.site.join(' '),
    notsite: notsite.join(' '),
    filetype: parsed.filetype[0] ?? '',
    intitle: parsed.intitle.join(' '),
    inurl: parsed.inurl.join(' '),
  };
}

// The address of a search for more results from one site.
export const siteSearchUrl = (host, plain) => searchUrl(`site:${host} ${plain}`.trim());

const FIELDS = [
  ['all', 'All these words'],
  ['exact', 'This exact phrase'],
  ['any', 'Any of these words'],
  ['none', 'None of these words'],
  ['site', 'On these sites or domains'],
  ['notsite', 'Not on these sites'],
  ['intitle', 'Words in the page title'],
  ['inurl', 'Words in the address'],
];

export function mountDorking({ parsed, open = false }) {
  const panel = $('#dork-panel');
  const tabs = $('#serp-tabs');
  if (!panel || !tabs) return;
  const start = fieldsFrom(parsed);

  const inputs = {};
  const rows = FIELDS.map(([key, label]) => {
    const id = `dork-${key}`;
    inputs[key] = h('input', { class: 'field', id, name: key, type: 'text', value: start[key], autocomplete: 'off', spellcheck: 'false' });
    return h('div', { class: 'dork-field' }, h('label', { for: id }, label), inputs[key]);
  });
  inputs.filetype = h('select', { class: 'field', id: 'dork-filetype', name: 'filetype' },
    FILETYPES.map(([v, text]) => h('option', { value: v, selected: v === start.filetype }, text)));
  // A file type from the address that isn't in the list still shows.
  if (start.filetype && !FILETYPES.some(([v]) => v === start.filetype)) {
    inputs.filetype.append(h('option', { value: start.filetype, selected: true }, start.filetype.toUpperCase()));
  }
  rows.push(h('div', { class: 'dork-field' }, h('label', { for: 'dork-filetype' }, 'File type'), inputs.filetype));

  const values = () => Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
  const preview = h('output', { class: 'dork-preview', for: Object.keys(inputs).map((k) => `dork-${k}`).join(' '), 'aria-live': 'polite' });
  const elsewhere = h('span', { class: 'dork-elsewhere' });
  const submit = h('button', { class: 'btn btn-default', type: 'submit' }, 'Search');
  const update = () => {
    const q = buildQuery(values());
    preview.textContent = q || 'Fill in a field to build a search.';
    preview.classList.toggle('is-empty', !q);
    submit.disabled = !q;
    elsewhere.replaceChildren(...(q ? ['Same search on ', ...elsewhereLinks(q)] : []));
  };

  const presets = h('div', { class: 'dork-presets', role: 'group', 'aria-label': 'Starting points' },
    PRESETS.map(([label, set]) => {
      const b = h('button', { class: 'btn btn-small', type: 'button' }, label);
      b.addEventListener('click', () => {
        for (const [k, v] of Object.entries(set)) inputs[k].value = v;
        update();
      });
      return b;
    }));

  const clear = h('button', { class: 'btn', type: 'button' }, 'Clear');
  clear.addEventListener('click', () => {
    for (const el of Object.values(inputs)) el.value = '';
    update();
    inputs.all.focus();
  });

  const form = h('form', { class: 'dork-form', role: 'search', 'aria-label': 'Build a search with operators' },
    presets,
    h('div', { class: 'dork-fields' }, rows),
    h('div', { class: 'dork-result' },
      h('span', { class: 'dork-preview-label' }, 'Search:'), preview),
    h('div', { class: 'dork-actions' }, submit, clear, elsewhere),
    h('p', { class: 'dork-note' }, 'Webshelf checks every result against these operators and says when none match. The engines behind it don’t always apply them, so the same search is linked on engines that do. ',
      h('a', { href: 'settings.html#dorking' }, 'Operator guide')));
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = buildQuery(values());
    if (q) location.assign(`${searchUrl(q)}&dork=1`);
  });
  panel.replaceChildren(form);
  update();
  panel.hidden = !open;

  const button = h('button', { class: 'tab dork-toggle', type: 'button', 'aria-expanded': String(open), 'aria-controls': 'dork-panel' }, 'Dorking');
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) inputs.all.focus();
  });
  const tools = tabs.querySelector('.tools-toggle');
  tabs.insertBefore(button, tools);
}
