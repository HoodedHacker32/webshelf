// The search box: a sunken field, a raised Search button, and a suggestion
// listbox (search history plus Wikipedia titles). Follows the ARIA combobox
// pattern: arrow keys move through the list, Enter searches, Escape closes.

import { h, svg, debounce } from './dom.js';
import { icon } from './icons.js';
import { searchUrl } from './config.js';
import { getSettings, getHistory, addHistory, removeHistory } from './store.js';
import { completions } from './wiki.js';

let uid = 0;

// `page` is where a search goes: the web results, or the Images or Videos tab.
export function createSearchbox({ value = '', autofocus = false, label = 'Search the web', page = 'search.html' } = {}) {
  const id = `suggest-${++uid}`;
  const input = h('input', {
    class: 'field searchbox-input',
    name: 'q',
    type: 'search',
    value,
    role: 'combobox',
    'aria-label': label,
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': id,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: '2048',
    enterkeyhint: 'search',
  });
  input.value = value;

  const clear = h('button', { class: 'searchbox-clear', type: 'button', 'aria-label': 'Clear search', hidden: !value },
    svg(icon('close')));
  const list = h('ul', { id, role: 'listbox', 'aria-label': 'Suggestions' });
  const panel = h('div', { class: 'suggest', hidden: true }, list);

  const form = h('form', { class: 'searchbox', action: page, method: 'get', role: 'search' },
    h('div', { class: 'searchbox-field' }, input, clear, panel),
    h('button', { class: 'btn btn-default searchbox-submit', type: 'submit' }, 'Search'));

  let typed = value;
  let items = [];
  let active = -1;
  let request = 0;
  let engaged = false; // suggestions open only after the visitor interacts, never on autofocus

  const go = (q) => {
    const query = q.trim();
    if (!query) { input.focus(); return; }
    addHistory(query);
    window.location.assign(searchUrl(query, page));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    go(input.value);
  });

  const setOpen = (open) => {
    panel.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
    }
  };

  const render = () => {
    const t = typed.trim().toLowerCase();
    list.replaceChildren(...items.map((item, i) => {
      const text = t && item.text.toLowerCase().startsWith(t)
        ? [item.text.slice(0, t.length), h('b', null, item.text.slice(t.length))]
        : [item.text];
      return h('li', {
        id: `${id}-${i}`,
        class: `suggest-item${item.history ? ' is-history' : ''}`,
        role: 'option',
        'aria-selected': String(i === active),
        onmousedown: (e) => {
          if (e.target.closest('.suggest-remove')) return;
          e.preventDefault();
          go(item.text);
        },
      },
      svg(icon(item.history ? 'history' : 'search')),
      h('span', { class: 'suggest-text' }, text),
      item.history ? h('button', {
        class: 'suggest-remove',
        type: 'button',
        tabindex: '-1',
        'aria-label': `Remove ${item.text} from history`,
        onmousedown: (e) => {
          e.preventDefault();
          removeHistory(item.text);
          refresh();
        },
      }, 'Remove') : null);
    }));
    setOpen(items.length > 0 && document.activeElement === input);
  };

  const refresh = async () => {
    const t = typed.trim();
    const lower = t.toLowerCase();
    const history = getHistory()
      .filter((q) => !lower || (q.toLowerCase().startsWith(lower) && q.toLowerCase() !== lower))
      .slice(0, lower ? 3 : 8)
      .map((text) => ({ text, history: true }));
    items = history;
    active = -1;
    render();

    if (!t || !getSettings().suggestions) return;
    const mine = ++request;
    let titles = [];
    try { titles = await completions(t); } catch { return; }
    if (mine !== request) return;
    const seen = new Set(history.map((i) => i.text.toLowerCase()));
    seen.add(lower);
    const extra = titles
      .map((title) => title.toLowerCase())
      .filter((s) => s.startsWith(lower) && !seen.has(s) && seen.add(s))
      .map((text) => ({ text, history: false }));
    items = [...history, ...extra].slice(0, 8);
    render();
  };

  const debounced = debounce(refresh, 120);

  const move = (step) => {
    if (panel.hidden || !items.length) return;
    active += step;
    if (active >= items.length) active = -1;
    if (active < -1) active = items.length - 1;
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active === -1) {
      input.value = typed;
      input.removeAttribute('aria-activedescendant');
    } else {
      input.value = items[active].text;
      input.setAttribute('aria-activedescendant', `${id}-${active}`);
    }
  };

  input.addEventListener('input', () => {
    engaged = true;
    typed = input.value;
    clear.hidden = !input.value;
    debounced();
  });
  input.addEventListener('focus', () => { if (engaged) refresh(); });
  input.addEventListener('pointerdown', () => {
    const wasFocused = document.activeElement === input;
    engaged = true;
    if (wasFocused && panel.hidden) refresh();
  });
  input.addEventListener('blur', () => setOpen(false));
  input.addEventListener('keydown', (e) => {
    engaged = true;
    if (e.key === 'ArrowDown' && panel.hidden) { e.preventDefault(); refresh(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      input.value = typed;
      setOpen(false);
    }
  });

  clear.addEventListener('click', () => {
    input.value = '';
    typed = '';
    clear.hidden = true;
    input.focus();
    refresh();
  });

  if (autofocus) {
    // Autofocus is a convenience, not a keyboard move, so it draws no focus ring
    // until the visitor actually types or clicks.
    input.classList.add('is-autofocused');
    const settle = () => input.classList.remove('is-autofocused');
    for (const type of ['keydown', 'pointerdown', 'blur']) input.addEventListener(type, settle, { once: true });
    queueMicrotask(() => input.focus({ preventScroll: true }));
  }

  return form;
}
