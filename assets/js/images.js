// Images tab: openly licensed images from Openverse (Flickr, Wikimedia Commons,
// museums and more), with Wikimedia Commons as a fallback. Keyless and
// CORS-enabled. Every image shows its creator and licence in the viewer.

import { h, svg, $, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { setupPage } from './page.js';
import * as wiki from './wiki.js';

const { query, ctx, track, target } = setupPage({
  page: 'images.html',
  title: 'Images',
  sources: [['Openverse', 'https://openverse.org'], ['Wikimedia Commons', 'https://commons.wikimedia.org']],
});

const grid = $('#results');
const status = $('#serp-status');
const moreBox = $('#serp-more');
const viewer = $('#viewer');
const items = [];
let page = 0;
let total = 0;
let fallback = false;

const LICENCES = { cc0: 'CC0 (public domain)', pdm: 'Public domain', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' };

async function openverse(n) {
  const data = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20&page=${n}&mature=false`, { ...ctx, timeout: 10000 });
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
    source: r.source,
  }));
}

async function commons() {
  const list = await wiki.commonsImages(query, { ...ctx, limit: 50 });
  total = list.length;
  return list.map((r) => ({ title: r.title, thumb: r.thumb, full: r.thumb, page: r.page, w: r.w || 4, h: r.h || 3, creator: null, licence: 'See the file page', licenceUrl: r.page, source: 'wikimedia' }));
}

// Justified rows: each tile grows in proportion to its shape, so a row's
// images share one height and fill the width, the way image searches look.
function tile(item, i) {
  const ratio = item.w / item.h;
  const img = h('img', { src: item.thumb, alt: item.title, loading: i < 12 ? 'eager' : 'lazy', referrerpolicy: 'no-referrer', width: String(Math.round(ratio * 180)), height: '180' });
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
  try {
    batch = fallback ? [] : await track(openverse(page));
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Openverse limits anonymous use; Commons carries on when it says no.
    if (page === 1) { fallback = true; batch = await track(commons()).catch(() => []); }
  }
  const start = items.length;
  items.push(...batch);
  grid.append(...batch.map((item, i) => tile(item, start + i)));
  if (!items.length) {
    status.replaceChildren('No images found for ', h('b', null, query), '. Try fewer or different words.');
    return;
  }
  status.replaceChildren('Images for ', h('b', null, query), ` · ${total.toLocaleString()} openly licensed`);
  if (!fallback && batch.length && items.length < total) {
    const more = h('button', { class: 'btn more-btn', type: 'button' }, 'More images');
    more.addEventListener('click', () => load());
    moreBox.replaceChildren(h('div', { class: 'more-row' }, more));
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
