// Market summary: a share or cryptocurrency price with a chart and key figures.
// Shares come from Yahoo Finance through our search server, which shares each
// answer between visitors (server/container/market.py); browsers can't ask
// Yahoo themselves. Cryptocurrencies come from CoinGecko, which needs no key.

import { h, getJSON } from '../dom.js';
import { BACKEND } from '../config.js';
import { lineChart } from './chart.js';

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
  // A ticker with its market ("vod.l" for London, "birg.ir" for Dublin).
  if (/^[a-z0-9]{1,6}\.[a-z]{1,2}$/.test(q)) return { kind: 'stock', text: q, symbol: true };
  return null;
}

// Yahoo gives London prices in pence as "GBp"; finance pages write GBX.
const CURRENCY = { GBp: 'GBX', ZAc: 'ZAC', ILA: 'ILA' };
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

async function market(path, signal) {
  const data = await getJSON(`${BACKEND.marketUrl}/${path}`, { signal });
  if (data?.error) throw new Error(data.error);
  return data;
}

// A share's home market first: a symbol with no exchange suffix ("AAPL",
// not "AAPL.TO") trades in the US, where the main listing usually is.
const home = (s) => (s.symbol.includes('.') ? 1 : 0);
async function findShare({ text, symbol, bare }, signal) {
  const data = await market(`search?q=${encodeURIComponent(text)}`, signal);
  const list = (data.quotes ?? []).filter((s) => s.type === 'EQUITY' || s.type === 'ETF');
  const lower = text.toLowerCase();
  const exact = list.filter((s) => s.symbol.toLowerCase() === lower || s.symbol.toLowerCase().split('.')[0] === lower).sort((a, b) => home(a) - home(b));
  if (symbol) {
    if (!exact.length) return null;
    if (bare && await isWord(text, signal)) return null;
    return exact[0];
  }
  // A company name: Yahoo's own first answer, which knows a company's main
  // listing ("google" finds Alphabet, "bank of ireland" the Dublin shares).
  return list[0] ?? null;
}

// Ranges: label, Yahoo's range, CoinGecko days.
const RANGES = [
  ['1D', '1d', 1], ['5D', '5d', 5], ['1M', '1mo', 30], ['6M', '6mo', 180],
  ['YTD', 'ytd', 'ytd'], ['1Y', '1y', 365], ['5Y', '5y', 1825], ['Max', 'max', 'max'],
];
const ytdDays = () => Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 864e5);

const shareChart = (share, range, signal) => market(`chart?symbol=${encodeURIComponent(share.symbol)}&range=${RANGES.find((r) => r[0] === range)[1]}`, signal);
const pointsOf = (data) => (data.points ?? []).map(([t, y]) => ({ x: new Date(t * 1000), y }));

async function coinSeries(id, range, signal) {
  let days = RANGES.find((r) => r[0] === range)[2];
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
  if (!BACKEND.marketUrl) return null;
  let share; let today;
  try {
    share = await findShare(args, signal);
    if (!share) return null;
    // Today's chart carries the price and the day's figures too.
    today = await shareChart(share, '1D', signal);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return null; // Prices unavailable: plain results instead.
  }
  const q = today.meta ?? {};
  const n = (v) => (v == null ? NaN : Number(v));
  const price = n(q.regularMarketPrice);
  if (!Number.isFinite(price)) return null;
  const prev = n(q.previousClose ?? q.chartPreviousClose);
  const when = new Date(n(q.regularMarketTime) * 1000)
    .toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const session = q.currentTradingPeriod?.regular;
  const open = session && Date.now() / 1000 >= session.start && Date.now() / 1000 < session.end;
  const fmt = (v) => (Number.isFinite(v) ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–');
  return card({
    name: q.longName ?? share.name,
    sub: { line: `${share.exchange}: ${share.symbol}`, currency: CURRENCY[q.currency] ?? q.currency ?? 'USD' },
    price,
    change: price - prev,
    pct: ((price - prev) / prev) * 100,
    when: `${when} · ${open ? 'Market open' : 'Market closed'}`,
    credit: h('span', null, 'Prices from ', h('a', { href: `https://finance.yahoo.com/quote/${encodeURIComponent(share.symbol)}`, rel: 'noreferrer' }, 'Yahoo Finance'), ', may be delayed'),
    baseline: prev,
    stats: [
      ['Open', fmt(n(today.open))], ['High', fmt(n(q.regularMarketDayHigh))], ['Low', fmt(n(q.regularMarketDayLow))], ['Prev close', fmt(prev)],
      ['52-wk high', fmt(n(q.fiftyTwoWeekHigh))], ['52-wk low', fmt(n(q.fiftyTwoWeekLow))],
      ['Volume', compact(n(q.regularMarketVolume))],
    ],
    // The first chart (today) is the one already fetched.
    series: async (range) => pointsOf(range === '1D' ? today : await shareChart(share, range, signal)),
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

// Web results about the share or coin: "aapl stock" finds finance pages,
// where "aapl" alone finds aapl.org.
export function webQuery(args) {
  return args.kind === 'coin' ? `${args.id.replace(/-/g, ' ')} price` : `${args.text} stock`;
}

export async function render(args, { signal }) {
  return args.kind === 'coin' ? renderCoin(args, signal) : renderShare(args, signal);
}
