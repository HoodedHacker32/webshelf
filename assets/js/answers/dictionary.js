// Dictionary card. Definitions come from Wiktionary's REST API (CC BY-SA).

import { h, svg, getJSON } from '../dom.js';
import { icon } from '../icons.js';
import { searchUrl } from '../config.js';

export function match(query) {
  const q = query.trim().toLowerCase().replace(/[?!.]+$/, '');
  if (/^(dictionary|define|definition)$/.test(q)) return { word: '' };
  const m = /^(?:define|definition of|meaning of|what does) (.+?)(?: mean)?$/.exec(q)
    || /^(.+?) (?:definition|meaning|define)$/.exec(q)
    || /^what is the meaning of (.+)$/.exec(q);
  if (!m) return null;
  const word = m[1].replace(/^(the word|a|an)\s+/, '').replace(/^["“']|["”']$/g, '').trim();
  if (!word || word.split(/\s+/).length > 3) return null;
  return { word };
}

const text = (html) => new DOMParser().parseFromString(`<p>${html ?? ''}</p>`, 'text/html').body.textContent.trim();

export async function render({ word }, { signal }) {
  const box = h('section', { class: 'answer answer-card dict', 'aria-label': 'Dictionary' });
  const searchForm = h('form', { class: 'dict-search', role: 'search', action: 'search.html' },
    h('input', { class: 'field', name: 'q', type: 'search', placeholder: 'Search for a word', 'aria-label': 'Search for a word', value: word }),
    h('button', { class: 'dict-search-btn', type: 'submit', 'aria-label': 'Look up' }, svg(icon('search', 'icon-20'))));
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = searchForm.q.value.trim();
    if (w) window.location.assign(searchUrl(`define ${w}`));
  });
  box.append(h('h2', { class: 'answer-title' }, 'Dictionary'), searchForm);
  if (!word) return box;

  let data;
  try {
    data = await getJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.replace(/ /g, '_'))}`, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Wiktionary titles are case-sensitive; try the lower-case form once.
    if (word !== word.toLowerCase()) return render({ word: word.toLowerCase() }, { signal });
    return null;
  }
  const entries = (data?.en ?? [])
    .map((e) => ({
      pos: e.partOfSpeech,
      senses: (e.definitions ?? [])
        .map((d) => ({
          def: text(d.definition),
          example: text(d.parsedExamples?.[0]?.example ?? d.examples?.[0] ?? ''),
        }))
        .filter((d) => d.def && !/^\(?(obsolete|archaic|rare)\b/i.test(d.def)),
    }))
    .filter((e) => e.senses.length);
  if (!entries.length) return null;

  const list = h('div', { class: 'dict-entries' });
  const more = [];
  entries.forEach((entry, i) => {
    const senses = h('ol', { class: 'dict-senses' });
    entry.senses.forEach((s, j) => {
      const li = h('li', null, h('span', { class: 'dict-def' }, s.def), s.example ? h('span', { class: 'dict-example' }, `“${s.example}”`) : null);
      if (i > 0 || j > 2) { li.hidden = true; more.push(li); }
      senses.append(li);
    });
    const block = h('div', { class: 'dict-entry' }, h('p', { class: 'dict-pos' }, entry.pos.toLowerCase()), senses);
    if (i > 0) { block.hidden = true; more.push(block); }
    list.append(block);
  });

  box.append(
    h('div', { class: 'dict-word' }, h('span', { class: 'dict-headword' }, word)),
    list,
  );

  if (more.length) {
    const toggle = h('button', { class: 'dict-more', type: 'button', 'aria-expanded': 'false' },
      svg(icon('expandMore', 'icon-20')), h('span', null, 'More definitions'));
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      more.forEach((el) => { el.hidden = !open; });
      toggle.querySelector('span').textContent = open ? 'Fewer definitions' : 'More definitions';
      toggle.querySelector('svg').replaceWith(svg(icon(open ? 'expandLess' : 'expandMore', 'icon-20')));
    });
    box.append(h('div', { class: 'dict-more-row' }, toggle));
  }

  box.append(h('p', { class: 'answer-source' }, 'Definitions from ',
    h('a', { href: `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replace(/ /g, '_'))}` }, 'Wiktionary'), ' (CC BY-SA 4.0)'));
  return box;
}
