// Currency converter with a rate history chart. Rates are the European Central
// Bank reference rates, served by Frankfurter (free, keyless, CORS-enabled).

import { h, getJSON } from '../dom.js';
import { parseConversion } from './units.js';
import { lineChart } from './chart.js';

const API = 'https://api.frankfurter.dev/v1';

// Words people type for a currency, mapped to ISO codes Frankfurter supports.
const WORDS = {
  dollar: 'USD', dollars: 'USD', 'us dollar': 'USD', 'us dollars': 'USD', usd: 'USD', $: 'USD', bucks: 'USD',
  pound: 'GBP', pounds: 'GBP', sterling: 'GBP', 'pound sterling': 'GBP', 'pounds sterling': 'GBP', 'british pound': 'GBP', 'british pounds': 'GBP', quid: 'GBP', '£': 'GBP',
  euro: 'EUR', euros: 'EUR', '€': 'EUR',
  yen: 'JPY', 'japanese yen': 'JPY', '¥': 'JPY',
  yuan: 'CNY', renminbi: 'CNY', rmb: 'CNY',
  rupee: 'INR', rupees: 'INR', 'indian rupee': 'INR', 'indian rupees': 'INR', '₹': 'INR',
  franc: 'CHF', francs: 'CHF', 'swiss franc': 'CHF', 'swiss francs': 'CHF',
  'canadian dollar': 'CAD', 'canadian dollars': 'CAD',
  'australian dollar': 'AUD', 'australian dollars': 'AUD', aussie: 'AUD',
  'new zealand dollar': 'NZD', 'new zealand dollars': 'NZD',
  'hong kong dollar': 'HKD', 'hong kong dollars': 'HKD',
  'singapore dollar': 'SGD', 'singapore dollars': 'SGD',
  won: 'KRW', 'korean won': 'KRW', '₩': 'KRW',
  peso: 'MXN', pesos: 'MXN', 'mexican peso': 'MXN', 'mexican pesos': 'MXN',
  real: 'BRL', reais: 'BRL', 'brazilian real': 'BRL',
  krona: 'SEK', kronor: 'SEK', 'swedish krona': 'SEK',
  krone: 'NOK', kroner: 'NOK', 'norwegian krone': 'NOK', 'danish krone': 'DKK',
  zloty: 'PLN', 'polish zloty': 'PLN',
  lira: 'TRY', 'turkish lira': 'TRY',
  rand: 'ZAR', 'south african rand': 'ZAR',
  forint: 'HUF', koruna: 'CZK', shekel: 'ILS', shekels: 'ILS', baht: 'THB', ringgit: 'MYR', rupiah: 'IDR',
};

const CODES = ['AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK',
  'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'];

function code(text) {
  const t = text.trim().toLowerCase();
  if (WORDS[t]) return WORDS[t];
  const upper = t.toUpperCase();
  return CODES.includes(upper) ? upper : null;
}

export function match(query) {
  // Allow a leading symbol amount: "$50 to gbp", "£20 in euros".
  const q = query.trim().replace(/^([$£€¥₹₩])\s*([\d.,]+)/, '$2 $1');
  const p = parseConversion(q);
  if (p) {
    const from = code(p.from);
    const to = code(p.to.replace(/^(how many|how much)\s+/, ''));
    if (from && to && from !== to) return { from, to, amount: p.amount ?? 1 };
  }
  const m = /^([a-z]{3})\s*(?:\/|-|\s)\s*([a-z]{3})$/i.exec(query.trim());
  if (m && code(m[1]) && code(m[2]) && code(m[1]) !== code(m[2])) return { from: code(m[1]), to: code(m[2]), amount: 1 };
  if (/^(currency converter|currency conversion|exchange rates?)$/i.test(query.trim())) return { from: 'USD', to: 'EUR', amount: 1 };
  return null;
}

const RANGES = [
  ['5D', 7], ['1M', 31], ['1Y', 365], ['5Y', 365 * 5], ['Max', null],
];

const isoDay = (d) => d.toISOString().slice(0, 10);

export async function render({ from, to, amount }, { signal }) {
  const [names, latest] = await Promise.all([
    getJSON(`${API}/currencies`, { signal }),
    getJSON(`${API}/latest?base=${from}&symbols=${to}`, { signal }),
  ]);
  let rate = latest?.rates?.[to];
  if (!rate) throw new Error('No rate');
  let state = { from, to, rate, date: latest.date };

  const nf = (v, max = 2) => v.toLocaleString(undefined, { maximumFractionDigits: v !== 0 && Math.abs(v) < 0.01 ? 6 : max });

  const lead = h('p', { class: 'fx-lead' });
  const big = h('p', { class: 'fx-big num' });
  const date = h('p', { class: 'fx-date' });

  const amountA = h('input', { class: 'field num', type: 'number', inputmode: 'decimal', step: 'any', value: String(amount), 'aria-label': 'Amount to convert' });
  const amountB = h('input', { class: 'field num', type: 'number', inputmode: 'decimal', step: 'any', 'aria-label': 'Converted amount' });
  const options = (selected) => Object.entries(names)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([c, n]) => h('option', { value: c, selected: c === selected }, n));
  const selA = h('select', { class: 'field', 'aria-label': 'Convert from currency' }, options(from));
  const selB = h('select', { class: 'field', 'aria-label': 'Convert to currency' }, options(to));

  const chartBox = h('div', { class: 'fx-chart' });
  const rangeBar = h('div', { class: 'fx-ranges', role: 'tablist', 'aria-label': 'Chart range' });
  let range = '1M';

  const text = () => {
    const a = parseFloat(amountA.value);
    const n = Number.isFinite(a) ? a : 0;
    lead.textContent = `${nf(n)} ${names[state.from]} equals`;
    big.textContent = `${nf(n * state.rate)} ${names[state.to]}`;
    const when = new Date(`${state.date}T16:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    date.replaceChildren(`${when} · European Central Bank rate, via `, h('a', { href: 'https://frankfurter.dev' }, 'Frankfurter'));
  };

  const fromA = () => {
    const a = parseFloat(amountA.value);
    amountB.value = Number.isFinite(a) ? String(parseFloat((a * state.rate).toFixed(4))) : '';
    text();
  };
  const fromB = () => {
    const b = parseFloat(amountB.value);
    amountA.value = Number.isFinite(b) ? String(parseFloat((b / state.rate).toFixed(4))) : '';
    text();
  };

  const drawChart = async () => {
    const days = RANGES.find((r) => r[0] === range)[1];
    const start = days ? isoDay(new Date(Date.now() - days * 864e5)) : '1999-01-04';
    chartBox.setAttribute('aria-busy', 'true');
    try {
      const data = await getJSON(`${API}/${start}..?base=${state.from}&symbols=${state.to}`, { signal });
      const points = Object.entries(data.rates ?? {}).map(([d, r]) => ({ x: new Date(`${d}T12:00:00Z`), y: r[state.to] }));
      const fmtDate = (d) => d.toLocaleDateString(undefined, days && days <= 31
        ? { day: 'numeric', month: 'short' }
        : { month: 'short', year: 'numeric' });
      chartBox.replaceChildren(lineChart(points, {
        height: 150,
        label: `${state.from} to ${state.to}, ${range}`,
        tone: points.length > 1 && points.at(-1).y < points[0].y ? 'negative' : 'positive',
        xFormat: fmtDate,
        tipFormat: (p) => `${nf(p.y, 4)} ${state.to} · ${p.x.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      }));
    } catch (err) {
      if (err.name !== 'AbortError') chartBox.replaceChildren(h('p', { class: 'answer-note' }, 'The rate history couldn’t be loaded.'));
    } finally {
      chartBox.removeAttribute('aria-busy');
    }
  };

  for (const [label] of RANGES) {
    const b = h('button', { class: 'fx-range', type: 'button', role: 'tab', 'aria-selected': String(label === range) }, label);
    b.addEventListener('click', () => {
      range = label;
      [...rangeBar.children].forEach((el) => el.setAttribute('aria-selected', String(el === b)));
      drawChart();
    });
    rangeBar.append(b);
  }

  const reload = async () => {
    const res = await getJSON(`${API}/latest?base=${selA.value}&symbols=${selB.value}`, { signal }).catch(() => null);
    const r = selA.value === selB.value ? 1 : res?.rates?.[selB.value];
    if (!r) return;
    state = { from: selA.value, to: selB.value, rate: r, date: res?.date ?? state.date };
    fromA();
    drawChart();
  };

  amountA.addEventListener('input', fromA);
  amountB.addEventListener('input', fromB);
  selA.addEventListener('change', reload);
  selB.addEventListener('change', reload);

  fromA();
  drawChart();

  return h('section', { class: 'answer fx', 'aria-label': 'Currency converter' },
    h('div', { class: 'fx-main' },
      lead, big, date,
      h('div', { class: 'fx-pairs' },
        h('div', { class: 'fx-pair' }, amountA, selA),
        h('div', { class: 'fx-pair' }, amountB, selB))),
    h('div', { class: 'fx-side' }, rangeBar, chartBox));
}
