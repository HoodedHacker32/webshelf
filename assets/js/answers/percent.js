// Percentages, the ways people ask them: "20% of 150", "what is 15 percent of
// 80", "30 is what percent of 120", "what percent of 120 is 30", "25% off 60",
// "15% tip on 80", "percent change from 50 to 65".

import { h } from '../dom.js';

const NUM = '(-?\\d+(?:[.,]\\d+)?)';
const PCT = `${NUM}\\s*(?:%|percent|per cent)`;
const num = (s) => Number(String(s).replace(',', '.'));
const fmt = (v) => (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 }));

const PATTERNS = [
  [new RegExp(`^(?:what is |what's )?${PCT} of ${NUM}\\??$`, 'i'), (p, y) => ({ kind: 'of', p: num(p), y: num(y) })],
  [new RegExp(`^${NUM} is what (?:%|percent|percentage) of ${NUM}\\??$`, 'i'), (x, y) => ({ kind: 'share', x: num(x), y: num(y) })],
  [new RegExp(`^what (?:%|percent|percentage) of ${NUM} is ${NUM}\\??$`, 'i'), (y, x) => ({ kind: 'share', x: num(x), y: num(y) })],
  [new RegExp(`^${PCT} off(?: of)? ${NUM}\\??$`, 'i'), (p, y) => ({ kind: 'off', p: num(p), y: num(y) })],
  [new RegExp(`^${PCT} tip (?:on|for) ${NUM}\\??$`, 'i'), (p, y) => ({ kind: 'tip', p: num(p), y: num(y) })],
  [new RegExp(`^(?:percent(?:age)? (?:change|increase|decrease) )?from ${NUM} to ${NUM}(?: (?:percent(?:age)? )?(?:change|increase|decrease))?\\??$`, 'i'), (a, b) => ({ kind: 'change', a: num(a), b: num(b) })],
];

export function match(query) {
  const q = query.trim();
  if (!/%|percent|per cent/i.test(q)) return null;
  for (const [re, make] of PATTERNS) {
    const m = re.exec(q);
    if (m) return make(m[1], m[2]);
  }
  return null;
}

export function render(a) {
  let answer; let working;
  if (a.kind === 'of') { answer = fmt((a.p / 100) * a.y); working = `${fmt(a.p)}% of ${fmt(a.y)} = ${fmt(a.p)} ÷ 100 × ${fmt(a.y)}`; }
  if (a.kind === 'share') {
    if (!a.y) return null;
    answer = `${fmt((a.x / a.y) * 100)}%`; working = `${fmt(a.x)} ÷ ${fmt(a.y)} × 100`;
  }
  if (a.kind === 'off') { answer = fmt(a.y * (1 - a.p / 100)); working = `${fmt(a.y)} − ${fmt(a.p)}% (${fmt((a.p / 100) * a.y)} off)`; }
  if (a.kind === 'tip') { const tip = (a.p / 100) * a.y; answer = fmt(a.y + tip); working = `Tip ${fmt(tip)} + bill ${fmt(a.y)} = total`; }
  if (a.kind === 'change') {
    if (!a.a) return null;
    const c = ((a.b - a.a) / Math.abs(a.a)) * 100;
    answer = `${c > 0 ? '+' : ''}${fmt(c)}%`; working = `(${fmt(a.b)} − ${fmt(a.a)}) ÷ ${fmt(Math.abs(a.a))} × 100 · ${c >= 0 ? 'an increase' : 'a decrease'}`;
  }
  return h('section', { class: 'answer factbox raised', 'aria-label': 'Percentage' },
    h('p', { class: 'factbox-path' }, 'Percentage'),
    h('p', { class: 'factbox-answer num' }, answer),
    h('p', { class: 'factbox-note num' }, working));
}
