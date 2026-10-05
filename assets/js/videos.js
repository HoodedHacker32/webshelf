// Videos tab. Our search server (Bing Videos, which covers YouTube, plus
// Dailymotion and PeerTube) leads; the Internet Archive takes a turn too. If the
// server is asleep, Dailymotion, PeerTube and YouTube links from Mwmbl are
// searched directly instead.

import { h, svg, $, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { setupPage } from './page.js';
import { BACKEND } from './config.js';

const { query, ctx, track, target } = setupPage({
  page: 'videos.html',
  title: 'Videos',
  sources: [['Bing Videos', 'https://www.bing.com/videos'], ['Mwmbl', 'https://mwmbl.org'], ['Dailymotion', 'https://www.dailymotion.com'], ['SepiaSearch', 'https://sepiasearch.org'], ['the Internet Archive', 'https://archive.org']],
});

const list = $('#results');
const status = $('#serp-status');
const moreBox = $('#serp-more');
const q = encodeURIComponent(query);

const clean = (text) => String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (text, n = 190) => (text.length > n ? `${text.slice(0, n).replace(/\s+\S*$/, '')} …` : text);

/* Sources: each takes a page number and returns a list of videos. -------- */

const youtubeId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? null;
  } catch { /* not a URL */ }
  return null;
};

// "11:59" or "105.0" (seconds) -> seconds.
const seconds = (text) => {
  const t = String(text ?? '');
  if (t.includes(':')) return t.split(':').map(Number).reduce((a, v) => a * 60 + v, 0);
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const SITES = { 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'dailymotion.com': 'Dailymotion', 'vimeo.com': 'Vimeo', 'archive.org': 'Internet Archive' };
const siteOf = (url) => {
  const host = hostOf(url);
  return Object.entries(SITES).find(([d]) => host === d || host.endsWith(`.${d}`))?.[1] ?? host;
};

// Words that carry the search, for checking a result is really about it.
const STOP = new Set(['a', 'an', 'the', 'to', 'in', 'of', 'on', 'at', 'by', 'for', 'and', 'or', 'is', 'how', 'what', 'video', 'videos']);
const meaningful = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));

const SOURCES = [
  {
    name: 'Webshelf search server',
    pages: 3,
    share: 3, // results per turn: it's the best source
    lead: true,
    async fetch(page) {
      if (!BACKEND.searxngUrl) return [];
      const data = await getJSON(`${BACKEND.searxngUrl}/search?q=${q}&format=json&categories=videos&language=en&safesearch=1&pageno=${page}`, { ...ctx, timeout: 8000 });
      return (data.results ?? []).filter((r) => /^https?:\/\//.test(r.url ?? '')).map((r) => ({
        url: r.url,
        title: clean(r.title),
        snippet: clean(r.content),
        thumb: r.thumbnail || r.thumbnail_src || null,
        duration: seconds(r.length),
        channel: r.author || null,
        date: r.publishedDate && r.publishedDate !== 'None' ? new Date(r.publishedDate) : null,
        site: siteOf(r.url),
      }));
    },
  },
  {
    name: 'YouTube',
    backup: true,
    pages: 1, // the web index returns one page
    async fetch() {
      const data = await getJSON(`https://api.mwmbl.org/api/v1/search/?s=${encodeURIComponent(`${query} youtube`)}`, { ...ctx, timeout: 10000 });
      const text = (parts) => (Array.isArray(parts) ? parts.map((p) => p.value).join('') : '');
      return (data ?? []).map((r) => ({ r, id: youtubeId(r.url) })).filter((x) => x.id).map(({ r, id }) => ({
        url: `https://www.youtube.com/watch?v=${id}`,
        title: text(r.title).replace(/\s+-\s+YouTube$/, ''),
        snippet: clean(text(r.extract)),
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        site: 'YouTube',
      }));
    },
  },
  {
    name: 'Dailymotion',
    backup: true,
    pages: 5,
    async fetch(page) {
      const fields = 'id,title,thumbnail_360_url,duration,owner.screenname,created_time,url,description';
      const data = await getJSON(`https://api.dailymotion.com/videos?search=${q}&fields=${fields}&limit=10&page=${page}&sort=relevance`, ctx);
      return (data.list ?? []).map((v) => ({
        url: v.url, title: v.title, snippet: clean(v.description), thumb: v.thumbnail_360_url,
        duration: v.duration, channel: v['owner.screenname'], date: new Date(v.created_time * 1000), site: 'Dailymotion',
      }));
    },
  },
  {
    name: 'PeerTube',
    backup: true,
    pages: 5,
    async fetch(page) {
      const data = await getJSON(`https://sepiasearch.org/api/v1/search/videos?search=${q}&start=${(page - 1) * 10}&count=10&nsfw=false`, ctx);
      return (data.data ?? []).map((v) => ({
        url: v.url, title: v.name, snippet: clean(v.description), thumb: v.thumbnailUrl,
        duration: v.duration, channel: v.channel?.displayName ?? v.account?.displayName, date: new Date(v.publishedAt), site: `PeerTube (${v.channel?.host ?? hostOf(v.url)})`,
      }));
    },
  },
  {
    name: 'Internet Archive',
    pages: 5,
    async fetch(page) {
      const fl = ['identifier', 'title', 'description', 'date', 'creator', 'runtime'].map((f) => `fl[]=${f}`).join('&');
      const data = await getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(`title:(${meaningful.join(' AND ') || query}) AND mediatype:movies`)}&${fl}&sort[]=downloads+desc&rows=8&page=${page}&output=json`, ctx);
      return (data.response?.docs ?? []).map((d) => {
        // Runtimes look like "00:23:41" (or are missing, or prose).
        const parts = String(d.runtime ?? '').split(':').map(Number);
        const runtime = d.runtime && parts.every(Number.isFinite) ? parts.reduce((t, v) => t * 60 + v, 0) : null;
        return {
          url: `https://archive.org/details/${d.identifier}`,
          title: Array.isArray(d.title) ? d.title[0] : d.title,
          snippet: clean(Array.isArray(d.description) ? d.description[0] : d.description),
          thumb: `https://archive.org/services/img/${d.identifier}`,
          duration: runtime,
          channel: Array.isArray(d.creator) ? d.creator[0] : d.creator,
          date: d.date ? new Date(d.date) : null,
          site: 'Internet Archive',
        };
      });
    },
  },
];

/* Rendering ------------------------------------------------------------ */

const clock = (s) => {
  if (!Number.isFinite(s) || s <= 0) return null;
  const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = Math.floor(s % 60);
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
};

const age = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const days = (Date.now() - d.getTime()) / 864e5;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} hours ago`;
  if (days < 31) return `${Math.round(days)} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// "www.youtube.com › watch", as an address with its path.
function crumb(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean).slice(0, 2).map((p) => (p.length > 24 ? `${p.slice(0, 22)}…` : p));
    return [u.hostname, ...parts].join(' › ');
  } catch { return url; }
}

function card(v) {
  const time = clock(v.duration);
  const thumb = h('a', { class: 'video-thumb', href: v.url, target, rel: 'noreferrer', tabindex: '-1', 'aria-hidden': 'true' },
    h('img', { src: v.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', width: '168', height: '94' }),
    h('span', { class: 'video-play' }, svg(icon('play'))),
    time ? h('span', { class: 'video-time num' }, time) : '');
  thumb.querySelector('img').addEventListener('error', (e) => { e.target.remove(); thumb.classList.add('is-blank'); }, { once: true });
  const meta = [v.site, v.channel, age(v.date)].filter(Boolean).join(' · ');
  return h('li', { class: 'result video' },
    h('h2', { class: 'result-title' }, h('a', { href: v.url, target, rel: 'noreferrer' }, v.title, time ? h('span', { class: 'visually-hidden' }, `, ${time}`) : '')),
    h('div', { class: 'result-meta' }, h('cite', { class: 'result-cite' }, crumb(v.url))),
    h('div', { class: 'video-body' },
      thumb,
      h('div', { class: 'video-text' },
        v.snippet && v.snippet.toLowerCase() !== v.title.toLowerCase() ? h('p', { class: 'result-snippet' }, cut(v.snippet)) : '',
        h('p', { class: 'video-meta' }, meta))));
}

/* Taking turns across sources ------------------------------------------ */

const state = SOURCES.map((s) => ({ ...s, page: 0, queue: [], done: false }));
const seen = new Set();
let shownCount = 0;
let serverDown = false;
let shownFromServer = false;

async function refill() {
  await Promise.all(state.map(async (s) => {
    if (s.backup && !serverDown) return;
    if (s.done || s.queue.length >= 4) return;
    s.page += 1;
    try {
      const got = await s.fetch(s.page);
      const fresh = got.filter((v) => v.url && v.title && !seen.has(v.url));
      s.queue.push(...fresh);
      if (!got.length || s.page >= s.pages) s.done = true;
    } catch (err) {
      if (err.name !== 'AbortError') { s.done = true; console.warn(`${s.name} videos unavailable:`, err.message); }
    }
  }));
  // The server answered: the direct copies of its sources aren't needed.
  const lead = state.find((s) => s.lead);
  if (!serverDown && lead.done && !lead.queue.length && !shownFromServer) {
    // Asleep, failing or not set up: the backups take over.
    serverDown = true;
    await refill();
  }
  if (lead.queue.length) shownFromServer = true;
}

async function showMore(count = 12) {
  moreBox.replaceChildren();
  await track(refill());
  const batch = [];
  while (batch.length < count && state.some((s) => s.queue.length)) {
    for (const s of state) {
      for (let i = 0; i < (s.share ?? 1) && batch.length < count; i += 1) {
        const v = s.queue.shift();
        if (v && !seen.has(v.url)) { seen.add(v.url); batch.push(v); }
      }
      if (batch.length >= count) break;
    }
  }
  list.append(...batch.map(card));
  shownCount += batch.length;
  if (!shownCount) {
    status.replaceChildren('No videos found for ', h('b', null, query), '. Try fewer or different words.');
    return;
  }
  status.replaceChildren('Videos for ', h('b', null, query), ` · ${shownCount} shown`);
  if (state.some((s) => s.queue.length || !s.done)) {
    const more = h('button', { class: 'btn', type: 'button' }, 'More videos');
    more.addEventListener('click', () => showMore());
    moreBox.replaceChildren(h('div', { class: 'more-row' }, more));
  }
}

showMore();
