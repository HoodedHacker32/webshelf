// Market summary: a share or cryptocurrency price with a chart and key figures.
// Shares come from Twelve Data (free key, set in config.js); its symbol search
// needs no key. Cryptocurrencies come from CoinGecko, which needs no key.

import { h, getJSON } from '../dom.js';
import { MARKET, BACKEND } from '../config.js';
import { lineChart } from './chart.js';

const TD = 'https://api.twelvedata.com';
const CG = 'https://api.coingecko.com/api/v3';

// Coins people search for by name or symbol, mapped to CoinGecko ids.
const COINS = {
  bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', ether: 'ethereum',
  tether: 'tether', usdt: 'tether', solana: 'solana', sol: 'solana', xrp: 'ripple', ripple: 'ripple',
  bnb: 'binancecoin', 'binance coin': 'binancecoin', dogecoin: 'dogecoin', doge: 'dogecoin',
  cardano: 'cardano', ada: 'cardano', litecoin: 'litecoin', ltc: 'litecoin', polkadot: 'polkadot', dot: 'polkadot',
  tron: 'tron', trx: 'tron', avalanche: 'avalanche-2', avax: 'avalanche-2', chainlink: 'chainlink', link: 'chainlink',
  'shiba inu': 'shiba-inu', shib: 'shiba-inu', monero: 'monero', xmr: 'monero', stellar: 'stellar', xlm: 'stellar',
  'usd coin': 'usd-coin', usdc: 'usd-coin', 'bitcoin cash': 'bitcoin-cash', bch: 'bitcoin-cash',
};
// Names that mean the coin even with nothing after them; the rest need "price".
const BARE = new Set(['bitcoin', 'btc', 'ethereum', 'eth', 'dogecoin', 'litecoin', 'solana', 'cardano', 'xrp', 'monero', 'shiba inu', 'bitcoin cash']);
const PRICE_WORDS = '(?:price|price today|value|to usd|usd|to dollars|in usd|rate|chart)';

export function match(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  // Coins: "bitcoin", "btc price", "price of ethereum".
  const coin = new RegExp(`^(?:price of |value of )?(.+?)(?: ${PRICE_WORDS})?$`).exec(q);
  if (coin && COINS[coin[1]] && (q !== coin[1] || BARE.has(q))) {
    return { kind: 'coin', id: COINS[coin[1]] };
  }
  // Shares: "$tsla", "nasdaq: aapl", "tesla stock", "apple share price".
  let m = /^\$([a-z][a-z.]{0,5})$/.exec(q);
  if (m) return { kind: 'stock', text: m[1], symbol: true };
  m = /^(?:nasdaq|nyse|amex|nyse arca|lon|lse|tsx)\s*:\s*([a-z][a-z.]{0,5})$/.exec(q);
  if (m) return { kind: 'stock', text: m[1], symbol: true };
  m = /^(.+?) (?:stock|stocks|stock price|stock price today|share price|shares|stock quote|ticker|stock chart|market cap)$/.exec(q);
  if (m) return { kind: 'stock', text: m[1].replace(/^\$/, ''), symbol: false };
  // A bare ticker ("aapl", "nvda") is checked against the dictionary at render time.
  if (/^[a-z]{2,5}$/.test(q)) return { kind: 'stock', text: q, symbol: true, bare: true };
  return null;
}

const money = (v, cur = 'USD') => {
  const digits = Math.abs(v) >= 1 ? 2 : Math.abs(v) >= 0.01 ? 4 : 8;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })} ${cur}`;
};
const compact = (v) => (Number.isFinite(v) ? v.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 }) : '–');
const signed = (v, digits = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

// A word in the dictionary ("cat", "meta") is a word first, not a share.
async function isWord(text, signal) {
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(text)}`, { signal });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.en?.length);
  } catch { return false; }
}

async function findShare({ text, symbol, bare }, signal) {
  const data = await getJSON(`${TD}/symbol_search?symbol=${encodeURIComponent(text)}&outputsize=12`, { signal });
  const list = (data?.data ?? []).filter((s) => ['Common Stock', 'ETF', 'Depositary Receipt', 'American Depositary Receipt'].includes(s.instrument_type));
  const home = (s) => (s.country === 'United States' ? 0 : 1);
  const exact = list.filter((s) => s.symbol.toLowerCase() === text.toLowerCase()).sort((a, b) => home(a) - home(b));
  if (symbol) {
    if (!exact.length) return null;
    if (bare && await isWord(text, signal)) return null;
    return exact[0];
  }
  // A company name: the best match whose name starts with what was typed.
  const named = list.filter((s) => s.instrument_name.toLowerCase().startsWith(text.toLowerCase())).sort((a, b) => home(a) - home(b));
  return named[0] ?? exact[0] ?? null;
}

// With our server, it adds the key; otherwise the browser sends the key in config.js.
async function td(path, signal) {
  const url = BACKEND.marketUrl ? `${BACKEND.marketUrl}/${path}` : `${TD}/${path}&apikey=${encodeURIComponent(MARKET.twelveDataKey)}`;
  const data = await getJSON(url, { signal });
  if (data?.status === 'error') throw new Error(data.message ?? 'Twelve Data error');
  return data;
}

// Ranges: label, Twelve Data interval and points, CoinGecko days.
const RANGES = [
  ['1D', '5min', 79, 1], ['5D', '30min', 66, 5], ['1M', '1day', 23, 30], ['6M', '1day', 128, 180],
  ['YTD', '1day', null, 'ytd'], ['1Y', '1day', 253, 365], ['5Y', '1week', 262, 1825], ['Max', '1month', 600, 'max'],
];
const ytdDays = () => Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 864e5);

async function shareSeries(share, range, signal) {
  const [, interval, size] = RANGES.find((r) => r[0] === range);
  let path = `time_series?symbol=${encodeURIComponent(share.symbol)}&mic_code=${share.mic_code}&interval=${interval}&order=ASC`;
  path += range === 'YTD' ? `&start_date=${new Date().getUTCFullYear()}-01-01` : `&outputsize=${size}`;
  const data = await td(path, signal);
  const points = (data.values ?? []).map((v) => ({ x: new Date(v.datetime.replace(' ', 'T')), y: Number(v.close) }));
  // One day means the latest trading day only.
  if (range === '1D' && points.length) {
    const day = points.at(-1).x.toDateString();
    return points.filter((p) => p.x.toDateString() === day);
  }
  return points;
}

async function coinSeries(id, range, signal) {
  let days = RANGES.find((r) => r[0] === range)[3];
  if (days === 'ytd') days = ytdDays();
  const data = await getJSON(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}`, { signal });
  return (data.prices ?? []).map(([t, y]) => ({ x: new Date(t), y }));
}

function card({ path, name, sub, price, change, pct, when, credit, stats, series, baseline, ranges, today = 'today' }) {
  const tone = (v) => (v >= 0 ? 'is-up' : 'is-down');
  const changeLine = h('p', { class: `market-change ${tone(change)}` });
  const setChange = (c, p, label) => {
    changeLine.className = `market-change ${tone(c)}`;
    changeLine.textContent = `${signed(c)} (${signed(p)}%) ${label}`;
  };
  setChange(change, pct, today);

  const chartBox = h('div', { class: 'fx-chart market-chart', 'aria-live': 'polite' });
  const rangeBar = h('div', { class: 'fx-ranges market-ranges', role: 'tablist', 'aria-label': 'Chart range' });
  let range = '1D';
  const draw = async () => {
    chartBox.setAttribute('aria-busy', 'true');
    try {
      const points = await series(range);
      const first = range === '1D' && baseline != null ? baseline : points[0]?.y;
      const last = points.at(-1)?.y;
      if (range !== '1D' && Number.isFinite(first) && Number.isFinite(last)) setChange(last - first, ((last - first) / first) * 100, rangeWords[range]);
      else setChange(change, pct, today);
      const short = range === '1D' || range === '5D';
      chartBox.replaceChildren(lineChart(points, {
        // Drawn at about its shown size, so the axis text stays its real size.
        width: Math.round(Math.max(300, Math.min(600, window.innerWidth - 90))),
        height: 190,
        label: `${name}, ${rangeWords[range]}`,
        tone: last < first ? 'negative' : 'positive',
        baseline: range === '1D' && baseline != null ? { y: baseline, label: 'Previous close' } : null,
        xFormat: (d) => d.toLocaleString(undefined, short ? { hour: 'numeric', minute: '2-digit', ...(range === '5D' ? { weekday: 'short' } : {}) } : { month: 'short', year: range === '1M' || range === '6M' || range === 'YTD' ? undefined : 'numeric', day: range === '1M' ? 'numeric' : undefined }),
        tipFormat: (p) => `${money(p.y, sub.currency)} · ${p.x.toLocaleString(undefined, short ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' })}`,
      }));
    } catch (err) {
      if (err.name !== 'AbortError') chartBox.replaceChildren(h('p', { class: 'answer-note' }, 'The price history couldn’t be loaded.'));
    } finally {
      chartBox.removeAttribute('aria-busy');
    }
  };
  for (const label of ranges) {
    const b = h('button', { class: 'fx-range', type: 'button', role: 'tab', 'aria-selected': String(label === range), 'aria-label': rangeWords[label] }, label);
    b.addEventListener('click', () => {
      range = label;
      for (const x of rangeBar.children) x.setAttribute('aria-selected', String(x === b));
      draw();
    });
    rangeBar.append(b);
  }
  draw();

  return h('section', { class: 'answer market raised', 'aria-label': `Market summary: ${name}` },
    h('h2', { class: 'market-name' }, name),
    h('p', { class: 'market-sub' }, sub.line),
    h('p', { class: 'market-price num' }, money(price, sub.currency)),
    changeLine,
    h('p', { class: 'fx-date' }, when, ' · ', credit),
    rangeBar,
    chartBox,
    h('dl', { class: 'market-stats' }, stats.filter(([, v]) => v != null && v !== '–').map(([k, v]) => h('div', null, h('dt', null, k), h('dd', { class: 'num' }, v)))),
    path);
}

const rangeWords = { '1D': 'today', '5D': 'past 5 days', '1M': 'past month', '6M': 'past 6 months', YTD: 'year to date', '1Y': 'past year', '5Y': 'past 5 years', Max: 'all time' };

async function renderShare(args, signal) {
  if (!BACKEND.marketUrl && !MARKET.twelveDataKey) return null;
  const share = await findShare(args, signal);
  if (!share) return null;
  let q;
  try {
    q = await td(`quote?symbol=${encodeURIComponent(share.symbol)}&mic_code=${share.mic_code}`, signal);
  } catch { return null; } // Not covered by this key: plain results instead.
  const n = (k) => (q[k] == null ? NaN : Number(q[k]));
  const price = n('close');
  const when = new Date(Number(q.last_quote_at ?? q.timestamp) * 1000)
    .toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const fmt = (v) => (Number.isFinite(v) ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–');
  return card({
    name: q.name,
    sub: { line: `${q.exchange}: ${q.symbol}`, currency: q.currency },
    price,
    change: n('change'),
    pct: n('percent_change'),
    when: `${when} · ${q.is_market_open ? 'Market open' : 'Market closed'}`,
    credit: h('span', null, 'Prices from ', h('a', { href: 'https://twelvedata.com', rel: 'noreferrer' }, 'Twelve Data'), ', may be delayed'),
    baseline: n('previous_close'),
    stats: [
      ['Open', fmt(n('open'))], ['High', fmt(n('high'))], ['Low', fmt(n('low'))], ['Prev close', fmt(n('previous_close'))],
      ['52-wk high', fmt(Number(q.fifty_two_week?.high))], ['52-wk low', fmt(Number(q.fifty_two_week?.low))],
      ['Volume', compact(n('volume'))], ['Avg volume', compact(n('average_volume'))],
    ],
    series: (range) => shareSeries(share, range, signal),
    ranges: RANGES.map((r) => r[0]),
    path: null,
  });
}

async function renderCoin({ id }, signal) {
  const [m] = await getJSON(`${CG}/coins/markets?vs_currency=usd&ids=${id}`, { signal });
  if (!m) return null;
  const when = new Date(m.last_updated).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const usd = (v) => (Number.isFinite(v) ? `$${v.toLocaleString(undefined, { maximumFractionDigits: v >= 1 ? 2 : 6 })}` : '–');
  return card({
    name: m.name,
    sub: { line: `${m.symbol.toUpperCase()} in US dollars`, currency: 'USD' },
    price: m.current_price,
    change: m.price_change_24h ?? 0,
    pct: m.price_change_percentage_24h ?? 0,
    when,
    credit: h('span', null, 'Prices from ', h('a', { href: `https://www.coingecko.com/en/coins/${id}`, rel: 'noreferrer' }, 'CoinGecko')),
    baseline: null,
    today: 'past 24 hours',
    stats: [
      ['24h high', usd(m.high_24h)], ['24h low', usd(m.low_24h)], ['Market cap', `$${compact(m.market_cap)}`],
      ['24h volume', `$${compact(m.total_volume)}`], ['All-time high', usd(m.ath)], ['Supply', compact(m.circulating_supply)],
    ],
    series: (range) => coinSeries(id, range, signal),
    ranges: RANGES.map((r) => r[0]),
    path: null,
  });
}

export async function render(args, { signal }) {
  return args.kind === 'coin' ? renderCoin(args, signal) : renderShare(args, signal);
}
