// Dice roller: add d4 to d20 to the tray, roll them all, see the total.

import { h } from '../dom.js';

const SIDES = [4, 6, 8, 10, 12, 20];
const MAX = 8;

export function match(query) {
  const q = query.trim().toLowerCase();
  if (/^(roll a die|roll die|roll a dice|roll dice|roll the dice|dice|dice roller|roll|throw a die|throw dice)$/.test(q)) return { dice: [6] };
  const m = /^roll (?:an? |(\d+) )?d(4|6|8|10|12|20)s?$/.exec(q) || /^(?:(\d+) )?d(4|6|8|10|12|20)$/.exec(q);
  if (m) return { dice: Array(Math.min(Number(m[1] || 1), MAX)).fill(Number(m[2])) };
  const n = /^roll (\d+|two|three|four|five|six) dice$/.exec(q);
  if (n) {
    const words = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    return { dice: Array(Math.min(words[n[1]] ?? Number(n[1]), MAX)).fill(6) };
  }
  return null;
}

const roll = (sides) => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / sides) * sides;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return (buf[0] % sides) + 1;
};

// One outline per die type, drawn for Webshelf.
const SHAPES = {
  4: 'M32 6 60 56H4Z',
  6: 'M8 8h48v48H8Z',
  8: 'M32 3 61 32 32 61 3 32Z',
  10: 'M32 3 60 26 32 61 4 26Z',
  12: 'M32 3 60 23 50 57H14L4 23Z',
  20: 'M32 3 58 18V46L32 61 6 46V18Z',
};

function die(sides, value) {
  return h('span', { class: 'die', role: 'img', 'aria-label': `d${sides} showing ${value}`, html:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${SHAPES[sides]}"/><text x="32" y="${sides === 4 ? 46 : 39}" text-anchor="middle">${value}</text></svg>` });
}

export function render({ dice }) {
  let tray = dice.map((s) => ({ sides: s, value: roll(s) }));

  const trayEl = h('div', { class: 'dice-tray' });
  const total = h('p', { class: 'dice-total num', role: 'status', 'aria-live': 'polite' });
  const rollBtn = h('button', { class: 'btn btn-primary btn-small', type: 'button' }, 'Roll');
  const clearBtn = h('button', { class: 'btn btn-outline btn-small', type: 'button' }, 'Clear');
  const pickers = h('div', { class: 'dice-pick', role: 'group', 'aria-label': 'Add a die' });

  const paint = () => {
    trayEl.replaceChildren(...(tray.length
      ? tray.map((d) => die(d.sides, d.value))
      : [h('p', { class: 'answer-note' }, 'Add dice to roll.')]));
    total.textContent = tray.length ? `Total: ${tray.reduce((a, d) => a + d.value, 0)}` : '';
    rollBtn.disabled = !tray.length;
    [...pickers.children].forEach((b) => { b.disabled = tray.length >= MAX; });
  };

  for (const s of SIDES) {
    const b = h('button', { class: 'dice-add', type: 'button', 'aria-label': `Add a d${s}` }, `d${s}`);
    b.addEventListener('click', () => {
      if (tray.length >= MAX) return;
      tray.push({ sides: s, value: roll(s) });
      paint();
    });
    pickers.append(b);
  }

  rollBtn.addEventListener('click', () => {
    tray = tray.map((d) => ({ ...d, value: roll(d.sides) }));
    trayEl.classList.remove('is-rolling');
    void trayEl.offsetWidth; // restart the shake
    trayEl.classList.add('is-rolling');
    paint();
  });
  clearBtn.addEventListener('click', () => { tray = []; paint(); });

  paint();
  return h('section', { class: 'answer answer-card dice', 'aria-label': 'Roll dice' },
    h('h2', { class: 'answer-title answer-title-pad' }, 'Roll dice'),
    h('div', { class: 'dice-body' }, trayEl, total),
    h('div', { class: 'dice-foot' }, pickers, h('div', { class: 'dice-actions' }, clearBtn, rollBtn)));
}
