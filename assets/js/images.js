// Images tab. By default our search server's image search (Flickr,
// DeviantArt, ArtStation, Pinterest, Imgur, Pixabay, Pexels, Openverse,
// Wikimedia Commons and Bing Images), each source taking turns and every
// image checked against the search. "Free to reuse" searches only
// openly licensed images, from Openverse directly, with each image's creator
// and licence; it's also the fallback while the server is asleep.

import { h, svg, $, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { setupPage } from './page.js';
import { BACKEND, searchUrl } from './config.js';
import * as wiki from './wiki.js';
import { parseQuestion, parseDefinition } from './qa.js';
import { imageMatcher } from './imagematch.js';

const { query, ctx, track, target } = setupPage({
  page: 'images.html',
  title: 'Images',
  sources: [['Flickr', 'https://www.flickr.com'], ['DeviantArt', 'https://www.deviantart.com'], ['ArtStation', 'https://www.artstation.com'],
    ['Pinterest', 'https://www.pinterest.com'], ['Imgur', 'https://imgur.com'], ['Pixabay', 'https://pixabay.com'], ['Pexels', 'https://www.pexels.com'],
    ['Openverse', 'https://openverse.org'], ['Wikimedia Commons', 'https://commons.wikimedia.org'], ['Bing Images', 'https://www.bing.com/images']],
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

// Only images about the search (see imagematch.js).
const relevant = imageMatcher(subject);

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
  // Each source takes a turn, so no one site (or one confused engine) fills
  // the grid; within a source, its own order is kept.
  const bySource = new Map();
  for (const r of data.results ?? []) {
    const source = r.engines?.[0] ?? r.engine ?? 'other';
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(r);
  }
  const queues = [...bySource.values()];
  const mixed = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) mixed.push(q.shift());
  return mixed.filter((r) => r.img_src && /^https?:/.test(r.img_src)).map((r) => {
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
  const failed = () => {
    if (img.src !== item.full && item.full) img.src = item.full;
    else li.hidden = true;
  };
  img.addEventListener('error', failed);
  // Some hosts answer a blocked image with a 1-pixel placeholder rather than an error.
  img.addEventListener('load', () => { if (img.naturalWidth < 8 || img.naturalHeight < 8) failed(); });
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
  let fetched = 0;
  const seen = new Set(items.map((i) => i.full));
  try {
    if (mode === 'server') {
      const raw = await track(fromServer(page));
      fetched = raw.length;
      if (!raw.length && page === 1) throw new Error('No images from the server');
      batch = raw.filter(relevant);
      // Too few relevant images: Openverse's openly licensed ones fill in.
      if (page === 1 && batch.length < 12) batch.push(...await track(openverse(1)).catch(() => []));
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
  const more = mode === 'server' ? fetched > 0 && page < 5 : mode === 'openverse' && batch.length && items.length < total;
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
