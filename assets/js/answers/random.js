// Random number generator with editable bounds.

import { h } from '../dom.js';

export function match(query) {
  const q = query.trim().toLowerCase().replace(/[?!.]+$/, '');
  if (/^(random number|random number generator|rng|pick a number|pick a random number|generate a random number)$/.test(q)) return { min: 1, max: 10 };
  const m = /^(?:random number|pick a (?:random )?number|random) (?:between|from) (-?\d+) (?:and|to|-) (-?\d+)$/.exec(q)
    || /^random number (-?\d+) ?(?:-|to) ?(-?\d+)$/.exec(q);
  if (!m) return null;
  const a = Number(m[1]); const b = Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function between(min, max) {
  const span = max - min + 1;
  if (span <= 1) return min;
  if (span > 2 ** 32) return min + Math.floor(Math.random() * span);
  const buf = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / span) * span;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return min + (buf[0] % span);
}

export function render({ min, max }) {
  const out = h('p', { class: 'rng-out num', role: 'status', 'aria-live': 'polite' });
  const minIn = h('input', { class: 'field num', type: 'number', step: '1', value: String(min), id: `rng-min-${min}-${max}` });
  const maxIn = h('input', { class: 'field num', type: 'number', step: '1', value: String(max), id: `rng-max-${min}-${max}` });
  const note = h('p', { class: 'answer-note' });
  const go = h('button', { class: 'btn btn-primary btn-small', type: 'button' }, 'Generate');

  const generate = () => {
    const a = Math.round(Number(minIn.value));
    const b = Math.round(Number(maxIn.value));
    if (!Number.isFinite(a) || !Number.isFinite(b) || minIn.value === '' || maxIn.value === '') {
      note.textContent = 'Enter a whole number in both boxes.';
      return;
    }
    note.textContent = a > b ? 'Min was larger than Max, so they were swapped.' : '';
    out.textContent = between(Math.min(a, b), Math.max(a, b)).toLocaleString();
  };
  go.addEventListener('click', generate);
  generate();

  return h('section', { class: 'answer answer-card rng', 'aria-label': 'Random number generator' },
    h('h2', { class: 'answer-title' }, 'Random number'),
    out,
    h('div', { class: 'rng-row' },
      h('label', { class: 'rng-field', for: minIn.id }, h('span', null, 'Min'), minIn),
      h('label', { class: 'rng-field', for: maxIn.id }, h('span', null, 'Max'), maxIn),
      go),
    note);
}
