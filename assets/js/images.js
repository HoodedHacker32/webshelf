// Images tab. By default our search server's image search (Flickr,
// DeviantArt, ArtStation, Pinterest, Imgur, Pixabay, Pexels, Openverse,
// Wikimedia Commons and Bing Images), each source taking turns and every
// image checked against the search. "Free to reuse" searches only
// openly licensed images, from Openverse directly, with each image's creator
// and licence; it's also the fallback while the server is asleep.

import { h, svg, $, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { setupPage } from './page.js';
import { BACKEND } from './config.js';
import { filterRow } from './searchtools.js';
import { getSettings } from './store.js';
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
let toppedUp = false;
let total = 0;
let mode = free || !BACKEND.searxngUrl ? 'openverse' : 'server';

// A question searches for its subject: "how tall is the eiffel tower" ->
// "eiffel tower", the way the answer box reads it.
const STOP = new Set(['how', 'what', 'who', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'does', 'do', 'did', 'the', 'a', 'an', 'of', 'to', 'in', 'pictures', 'picture', 'photos', 'photo', 'images', 'image']);
const subject = parseQuestion(query)?.subject ?? parseDefinition(query)?.subject
  ?? (query.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).join(' ') || query);

// Only images about the search (see imagematch.js).
const relevant = imageMatcher(subject);

// Filters, in the address like the All tab's tools: size, kind and shape.
// Colour isn't offered: telling an image's colours means reading its pixels,
// which other sites' images don't allow.
const tools = filterRow({
  query,
  page: 'images.html',
  keep: ['rights'],
  filters: [
    ['size', 'Size', [['', 'Any size'], ['large', 'Large'], ['medium', 'Medium'], ['small', 'Small']]],
    ['type', 'Type', [['', 'Any type'], ['photo', 'Photos'], ['art', 'Artwork'], ['gif', 'GIFs']]],
    ['shape', 'Shape', [['', 'Any shape'], ['tall', 'Tall'], ['square', 'Square'], ['wide', 'Wide'], ['panoramic', 'Panoramic']]],
  ],
});
const { size: wantSize, type: wantType, shape: wantShape } = tools.current;

// Like Google's "Usage rights": everything, or only images free to reuse.
const rightsNote = free
  ? 'Only images their creators let anyone reuse (Creative Commons and public domain), from Openverse. Each has its licence: some ask for credit, or rule out changes or selling.'
  : 'Most images belong to their creators. To use one, check its page, or choose Free to reuse.';
grid.before(h('div', { class: 'image-tools' },
  h('nav', { class: 'image-filters', 'aria-label': 'Usage rights' },
    [['All images', ''], ['Free to reuse', 'free']].map(([label, rights]) => h('a', {
      class: 'btn btn-small', href: tools.urlFor({ rights }),
      'aria-current': (rights === 'free') === free ? 'page' : null,
    }, label))),
  h('div', { class: 'image-menus' }, tools.menus),
  h('p', { class: 'image-rights-note' }, rightsNote)),
h('nav', { class: 'image-related', 'aria-label': 'Related searches', hidden: true }));

// What a filter asks of an image: sizes by the longer side in pixels, shapes
// by width over height. An image whose size isn't known can't be judged, so
// a size or shape filter leaves it out. Kinds go by source: Flickr and Pexels
// are photo sites, DeviantArt and ArtStation art sites; Openverse labels its own.
const SIZES = { large: (l) => l >= 1200, medium: (l) => l >= 400 && l < 1200, small: (l) => l < 400 };
const SHAPES = { tall: (r) => r < 0.85, square: (r) => r >= 0.85 && r <= 1.18, wide: (r) => r > 1.18 && r <= 2, panoramic: (r) => r > 2 };
const KIND_OF = { flickr: 'photo', pexels: 'photo', unsplash: 'photo', deviantart: 'art', artstation: 'art' };
function fits(item) {
  if ((wantSize || wantShape) && !item.known) return false;
  if (wantShape && !SHAPES[wantShape]?.(item.w / item.h)) return false;
  // Openverse was asked for these already, by its own measures.
  if (item.vetted) return true;
  if (wantSize && !SIZES[wantSize]?.(Math.max(item.w, item.h))) return false;
  if (wantType === 'gif' && item.format !== 'gif') return false;
  if ((wantType === 'photo' || wantType === 'art') && item.kind !== wantType) return false;
  return true;
}
const OPENVERSE_FILTERS = [
  wantSize ? `&size=${wantSize}` : '',
  wantShape ? `&aspect_ratio=${wantShape === 'panoramic' ? 'wide' : wantShape}` : '',
  wantType === 'photo' ? '&category=photograph' : wantType === 'art' ? '&category=illustration' : '',
  wantType === 'gif' ? '&extension=gif' : '',
].join('');

const LICENCES = { cc0: 'CC0 (public domain)', pdm: 'Public domain', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' };

async function fromServer(n) {
  // The engines only offer GIFs when asked for them by name.
  const words = wantType === 'gif' ? `${subject} gif` : subject;
  const data = await getJSON(`${BACKEND.searxngUrl}/search?q=${encodeURIComponent(words)}&format=json&categories=images&language=en&safesearch=1&pageno=${n}`, { ...ctx, timeout: 8000 });
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
    const format = String(r.img_format ?? '').toLowerCase().replace(/^image\//, '').replace('jpeg', 'jpg')
      || (r.img_src.match(/\.(jpe?g|png|gif|webp|svg)(?:[?#]|$)/i)?.[1].toLowerCase().replace('jpeg', 'jpg') ?? '');
    return {
      title: r.title || 'Untitled',
      thumb: r.thumbnail_src || r.img_src,
      full: r.img_src,
      page: r.url || r.img_src,
      known: Boolean(dims),
      w: dims ? Number(dims[1]) : 4,
      h: dims ? Number(dims[2]) : 3,
      format,
      kind: KIND_OF[r.engines?.[0] ?? r.engine] ?? null,
      creator: r.author || null,
      licence: commons ? 'See the file page for its licence' : 'Reuse rights unknown: check the source',
      licenceUrl: commons ? r.url : null,
    };
  });
}

async function openverse(n) {
  const data = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(subject)}&page_size=20&page=${n}&mature=false${OPENVERSE_FILTERS}`, { ...ctx, timeout: 10000 });
  total = data.result_count ?? 0;
  return (data.results ?? []).map((r) => ({
    title: r.title || 'Untitled',
    thumb: r.thumbnail,
    full: r.url,
    page: r.foreign_landing_url,
    known: Boolean(r.width && r.height),
    w: r.width || 4,
    h: r.height || 3,
    format: r.filetype ?? '',
    vetted: true,
    creator: r.creator,
    creatorUrl: r.creator_url,
    licence: `${LICENCES[r.license] ?? r.license?.toUpperCase()}${r.license_version && !['cc0', 'pdm'].includes(r.license) ? ` ${r.license_version}` : ''}`,
    licenceUrl: r.license_url,
  }));
}

async function commons() {
  const list = await wiki.commonsImages(subject, { ...ctx, limit: 50 });
  total = list.length;
  return list.map((r) => ({ title: r.title, thumb: r.thumb, full: r.thumb, page: r.page, known: Boolean(r.w && r.h), w: r.w || 4, h: r.h || 3, creator: null, licence: 'See the file page for its licence', licenceUrl: r.page }));
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
      batch = raw.filter(relevant).filter(fits);
      // A filter leaves few: the next pages are looked through too.
      while (tools.active && batch.length < 12 && fetched && page < 3) {
        page += 1;
        const next = await track(fromServer(page)).catch(() => []);
        fetched = next.length;
        batch.push(...next.filter(relevant).filter(fits));
      }
      // Too few relevant images: Openverse's openly licensed ones fill in.
      if (!toppedUp && items.length + batch.length < 12) {
        toppedUp = true;
        batch.push(...(await track(openverse(1)).catch(() => [])).filter(fits));
      }
    } else if (mode === 'openverse') {
      batch = (await track(openverse(page))).filter(fits);
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Server asleep: Openverse. Openverse refusing (it limits anonymous use): Commons.
    if (page === 1 && mode === 'server') { mode = 'openverse'; page = 0; return load(); }
    if (page === 1 && mode === 'openverse') { mode = 'commons'; batch = (await track(commons()).catch(() => [])).filter(fits); }
  }
  batch = batch.filter((i) => !seen.has(i.full) && seen.add(i.full));
  const start = items.length;
  items.push(...batch);
  grid.append(...batch.map((item, i) => tile(item, start + i)));
  if (!items.length) {
    status.replaceChildren('No images found for ', h('b', null, query),
      tools.active ? ['. ', h('a', { href: tools.urlFor({ size: '', type: '', shape: '' }) }, 'Search without filters'), '.'] : '. Try fewer or different words.');
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
        item.licenceUrl ? h('a', { href: item.licenceUrl, rel: 'noreferrer' }, item.licence) : item.licence,
        item.known ? h('span', { class: 'viewer-size num' }, ` · ${item.w.toLocaleString()} × ${item.h.toLocaleString()}${item.format ? ` ${item.format.toUpperCase()}` : ''}`) : ''),
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

/* Related searches ----------------------------------------------------- */

// Chips that narrow the search, as Google's image chips did: what people
// search for after these words (the server's suggestions), shown as the words
// they add. Ones that only mean "pictures" again, or lead off to a shop or a
// sign-in, aren't images refinements and are left out.
const NOT_REFINEMENTS = /^(?:pictures?|images?|photos?|pics?|ai|ai generated|tickets?|official (?:site|website)|near me|login|price|prices|stock|for sale|reddit|wiki|wikipedia)$/;
async function relatedChips() {
  if (!BACKEND.searxngUrl || !getSettings().suggestions) return;
  const res = await fetch(`${BACKEND.searxngUrl}/autocompleter?q=${encodeURIComponent(subject)}`, { signal: AbortSignal.timeout(4000) });
  const data = await res.json();
  const list = Array.isArray(data?.[1]) ? data[1] : Array.isArray(data) ? data : [];
  const base = subject.toLowerCase();
  const chips = [...new Set(list.map((t) => String(t).toLowerCase()))]
    .filter((t) => t.startsWith(`${base} `))
    .map((t) => [t, t.slice(base.length + 1).trim()])
    .filter(([, added]) => added && added.split(' ').length <= 3 && !NOT_REFINEMENTS.test(added))
    .slice(0, 8);
  if (chips.length < 2) return;
  const nav = $('.image-related');
  nav.replaceChildren(h('ul', { class: 'image-related-list' }, chips.map(([full, added]) =>
    h('li', null, h('a', { class: 'btn btn-small', href: tools.urlFor({}, full) }, added)))));
  nav.hidden = false;
}

load();
relatedChips().catch(() => {});
