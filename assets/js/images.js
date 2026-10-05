// Images tab. By default our search server's image search (Bing Images,
// Openverse and Wikimedia Commons, merged). "Free to reuse" searches only
// openly licensed images, from Openverse directly, with each image's creator
// and licence; it's also the fallback while the server is asleep.

import { h, svg, $, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { setupPage } from './page.js';
import { BACKEND, searchUrl } from './config.js';
import * as wiki from './wiki.js';
import { parseQuestion, parseDefinition } from './qa.js';

const { query, ctx, track, target } = setupPage({
  page: 'images.html',
  title: 'Images',
  sources: [['Bing Images', 'https://www.bing.com/images'], ['Openverse', 'https://openverse.org'], ['Wikimedia Commons', 'https://commons.wikimedia.org']],
});

const grid = $('#results');
const status = $('#serp-status');
const moreBox = $('#serp-more');
const viewer = $('#viewer');
const items = [];
const free = new URLSearchParams(location.search).get('rights') === 'free';
let page = 0;
let total = 0;
let mode = free || !BACKEND.searxngUrl ? 'openverse' : 'server';

// A question searches for its subject: "how tall is the eiffel tower" ->
// "eiffel tower", the way the answer box reads it.
const STOP = new Set(['how', 'what', 'who', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'does', 'do', 'did', 'the', 'a', 'an', 'of', 'to', 'in', 'pictures', 'picture', 'photos', 'photo', 'images', 'image']);
const subject = parseQuestion(query)?.subject ?? parseDefinition(query)?.subject
  ?? (query.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).join(' ') || query);

// Like Google's "Usage rights": everything, or only images free to reuse.
grid.before(h('nav', { class: 'image-filters', 'aria-label': 'Usage rights' },
  [['All images', null], ['Free to reuse', 'free']].map(([label, rights]) => h('a', {
    class: 'btn btn-small', href: `${searchUrl(query, 'images.html')}${rights ? `&rights=${rights}` : ''}`,
    'aria-current': (rights === 'free') === free ? 'page' : null,
  }, label))));

const LICENCES = { cc0: 'CC0 (public domain)', pdm: 'Public domain', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' };

async function fromServer(n) {
  const data = await getJSON(`${BACKEND.searxngUrl}/search?q=${encodeURIComponent(subject)}&format=json&categories=images&language=en&safesearch=1&pageno=${n}`, { ...ctx, timeout: 8000 });
  const size = (text) => String(text ?? '').match(/(\d+)\s*[x×\u00d7]\s*(\d+)/);
  return (data.results ?? []).filter((r) => r.img_src && /^https?:/.test(r.img_src)).map((r) => {
    const dims = size(r.resolution);
    const commons = /wikimedia\.org/.test(r.url ?? '');
    return {
      title: r.title || 'Untitled',
      thumb: r.thumbnail_src || r.img_src,
      full: r.img_src,
      page: r.url || r.img_src,
      w: dims ? Number(dims[1]) : 4,
      h: dims ? Number(dims[2]) : 3,
      creator: r.author || null,
      licence: commons ? 'See the file page for its licence' : 'Reuse rights unknown: check the source',
      licenceUrl: commons ? r.url : null,
    };
  });
}

async function openverse(n) {
  const data = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(subject)}&page_size=20&page=${n}&mature=false`, { ...ctx, timeout: 10000 });
  total = data.result_count ?? 0;
  return (data.results ?? []).map((r) => ({
    title: r.title || 'Untitled',
    thumb: r.thumbnail,
    full: r.url,
    page: r.foreign_landing_url,
    w: r.width || 4,
    h: r.height || 3,
    creator: r.creator,
    creatorUrl: r.creator_url,
    licence: `${LICENCES[r.license] ?? r.license?.toUpperCase()}${r.license_version && !['cc0', 'pdm'].includes(r.license) ? ` ${r.license_version}` : ''}`,
    licenceUrl: r.license_url,
  }));
}

async function commons() {
  const list = await wiki.commonsImages(subject, { ...ctx, limit: 50 });
  total = list.length;
  return list.map((r) => ({ title: r.title, thumb: r.thumb, full: r.thumb, page: r.page, w: r.w || 4, h: r.h || 3, creator: null, licence: 'See the file page for its licence', licenceUrl: r.page }));
}

// Justified rows: each tile grows in proportion to its shape, so a row's
// images share one height and fill the width, the way image searches look.
function tile(item, i) {
  const ratio = item.w / item.h;
  const img = h('img', { src: item.thumb, alt: item.title, loading: i < (innerWidth < 760 ? 4 : 12) ? 'eager' : 'lazy', referrerpolicy: 'no-referrer', width: String(Math.round(ratio * 180)), height: '180' });
  // Openverse's thumbnail service sometimes fails; the original image is next,
  // and only a tile whose image can't load at all is hidden.
  img.addEventListener('error', () => {
    if (img.src !== item.full && item.full) img.src = item.full;
    else li.hidden = true;
  });
  const button = h('button', { class: 'image-tile-open', type: 'button', 'aria-haspopup': 'dialog' }, img);
  button.addEventListener('click', () => openViewer(i));
  const li = h('li', { class: 'image-tile', style: `--r: ${ratio.toFixed(3)}` },
    button,
    h('a', { class: 'image-tile-caption', href: item.page, target, rel: 'noreferrer' },
      h('span', { class: 'image-tile-title' }, item.title),
      h('span', { class: 'image-tile-site' }, hostOf(item.page))));
  return li;
}

async function load() {
  page += 1;
  moreBox.replaceChildren();
  let batch = [];
  const seen = new Set(items.map((i) => i.full));
  try {
    if (mode === 'server') {
      batch = await track(fromServer(page));
      if (!batch.length && page === 1) throw new Error('No images from the server');
    } else if (mode === 'openverse') {
      batch = await track(openverse(page));
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Server asleep: Openverse. Openverse refusing (it limits anonymous use): Commons.
    if (page === 1 && mode === 'server') { mode = 'openverse'; page = 0; return load(); }
    if (page === 1 && mode === 'openverse') { mode = 'commons'; batch = await track(commons()).catch(() => []); }
  }
  batch = batch.filter((i) => !seen.has(i.full) && seen.add(i.full));
  const start = items.length;
  items.push(...batch);
  grid.append(...batch.map((item, i) => tile(item, start + i)));
  if (!items.length) {
    status.replaceChildren('No images found for ', h('b', null, query), '. Try fewer or different words.');
    return;
  }
  status.replaceChildren('Images for ', h('b', null, query),
    mode === 'server' ? '' : ` · ${total.toLocaleString()} openly licensed`);
  const more = mode === 'server' ? batch.length > 0 && page < 5 : mode === 'openverse' && batch.length && items.length < total;
  if (more) {
    const button = h('button', { class: 'btn more-btn', type: 'button' }, 'More images');
    button.addEventListener('click', () => load());
    moreBox.replaceChildren(h('div', { class: 'more-row' }, button));
  }
}

/* Viewer --------------------------------------------------------------- */

let current = 0;
function openViewer(i) {
  current = (i + items.length) % items.length;
  const item = items[current];
  const big = h('img', { class: 'viewer-image', src: item.full, alt: item.title, referrerpolicy: 'no-referrer', width: String(item.w), height: String(item.h), style: { aspectRatio: `${item.w} / ${item.h}`, backgroundImage: `url("${item.thumb}")` } });
  big.addEventListener('error', () => { big.src = item.thumb; }, { once: true });
  const nav = (step, label, name) => {
    const b = h('button', { class: 'btn viewer-nav', type: 'button', 'aria-label': label }, svg(icon(name)));
    b.addEventListener('click', () => openViewer(current + step));
    return b;
  };
  const close = h('button', { class: 'btn viewer-close', type: 'button', 'aria-label': 'Close' }, svg(icon('close')));
  close.addEventListener('click', () => viewer.close());
  viewer.replaceChildren(
    h('div', { class: 'viewer-bar' }, h('span', { class: 'viewer-count' }, `${current + 1} of ${items.length}`), nav(-1, 'Previous image', 'chevronLeft'), nav(1, 'Next image', 'chevronRight'), close),
    h('div', { class: 'viewer-frame' }, big),
    h('div', { class: 'viewer-info' },
      h('h2', { class: 'viewer-title', id: 'viewer-title' }, item.title),
      h('p', { class: 'viewer-meta' },
        item.creator ? ['By ', item.creatorUrl ? h('a', { href: item.creatorUrl, rel: 'noreferrer' }, item.creator) : item.creator, ' · '] : '',
        item.licenceUrl ? h('a', { href: item.licenceUrl, rel: 'noreferrer' }, item.licence) : item.licence),
      h('p', { class: 'viewer-actions' },
        h('a', { class: 'btn', href: item.page, target, rel: 'noreferrer' }, `Visit ${hostOf(item.page)}`),
        h('a', { class: 'viewer-full', href: item.full, target, rel: 'noreferrer' }, 'Open full image'))));
  if (!viewer.open) viewer.showModal();
}
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') openViewer(current + 1);
  else if (e.key === 'ArrowLeft') openViewer(current - 1);
});
viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });

load();
