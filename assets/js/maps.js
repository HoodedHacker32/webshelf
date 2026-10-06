// Maps tab: places from OpenStreetMap's own search (Nominatim), listed beside
// a map of OpenStreetMap's tiles drawn with Leaflet (vendored in
// assets/vendor). Each place has its address, what kind of place it is, its
// opening hours, website and phone when mappers recorded them, and links to
// open it or get directions on openstreetmap.org. Free and keyless.
//
// "Near me" searches look around the location saved in Settings; without
// one, the visitor can share their location for this search (never saved).

import { h, $ } from './dom.js';
import { setupPage } from './page.js';
import { homeLocation, locateMe } from './answers/geo.js';

const { query, track, target } = setupPage({
  page: 'maps.html',
  title: 'Maps',
  sources: [['OpenStreetMap', 'https://www.openstreetmap.org/copyright'], ['Nominatim', 'https://nominatim.org']],
});

const list = $('#results');
// The map stays in view below the toolbar, whatever the toolbar's height.
const toolbar = $('#toolbar');
new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-h', `${toolbar.offsetHeight}px`)).observe(toolbar);
const status = $('#serp-status');
const mapBox = $('#map');

// Nominatim and the tile servers ask to know which site is calling: send
// the site's address (never the page, so never the search).
const REFERRER = 'strict-origin-when-cross-origin';

const NEAR = /\s*\b(?:near me|nearby|near here|close to me|around me|closest|nearest)\b\s*/gi;
const nearMe = NEAR.test(query);
const words = query.replace(NEAR, ' ').replace(/\s+/g, ' ').trim() || query;
let home = homeLocation();

async function places() {
  const params = new URLSearchParams({
    q: words, format: 'jsonv2', limit: '10', addressdetails: '1', extratags: '1', namedetails: '1',
    polygon_geojson: '1', polygon_threshold: '0.002', 'accept-language': navigator.language || 'en',
  });
  // Around the saved location: about 15 km each way.
  if (nearMe && home) {
    const dLat = 0.14;
    const dLon = 0.14 / Math.max(0.2, Math.cos((home.lat * Math.PI) / 180));
    params.set('viewbox', [home.lon - dLon, home.lat + dLat, home.lon + dLon, home.lat - dLat].join(','));
    params.set('bounded', '1');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { referrerPolicy: REFERRER, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

/* Describing a place ---------------------------------------------------- */

const KIND_WORDS = { administrative: 'Area', yes: '', city: 'City', town: 'Town', village: 'Village', hamlet: 'Hamlet', suburb: 'Suburb', neighbourhood: 'Neighbourhood' };
function kindOf(p) {
  const type = KIND_WORDS[p.type] ?? p.type.replace(/_/g, ' ');
  const country = p.addresstype === 'country' ? 'Country' : null;
  const text = country ?? (type || p.category.replace(/_/g, ' '));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The name in the visitor's language when mappers recorded one ("Galway", not "Cathair na Gaillimhe").
const nameOf = (p) => p.name || p.namedetails?.name || p.display_name.split(',')[0];

// The address without the name it starts with.
function addressOf(p) {
  const parts = p.display_name.split(', ');
  return (parts[0] === nameOf(p) ? parts.slice(1) : parts).join(', ');
}

// Opening hours as mappers write them ("Mo-Fr 09:00-17:00; Sa 10:00-14:00"),
// with the day codes spelled out.
const DAYS = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', PH: 'public holidays' };
const hours = (text) => text.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS[d]).replace(/;\s*/g, '; ').replace(/24\/7/, 'Open 24 hours');

const safeUrl = (url) => {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch { return null; }
};
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/* The map --------------------------------------------------------------- */

let map = null;
const markers = [];
let outline = null;

function setupMap() {
  const L = window.L;
  map = L.map(mapBox, { zoomControl: true, worldCopyJump: true }).setView([30, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: REFERRER,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
}

const pin = (n, current) => window.L.divIcon({
  className: `map-pin${current ? ' is-current' : ''}`,
  html: `<span><b>${n}</b></span>`,
  iconSize: [28, 34],
  iconAnchor: [14, 34],
});

function bboxOf(p) {
  const [s, n, w, e] = p.boundingbox.map(Number);
  return [[s, w], [n, e]];
}

let current = -1;
function select(i, { fly = true } = {}) {
  current = i;
  const p = found[i];
  markers.forEach((m, j) => m.setIcon(pin(j + 1, j === i)));
  for (const [j, li] of [...list.children].entries()) li.classList.toggle('is-current', j === i);
  if (outline) { outline.remove(); outline = null; }
  // Areas (a city, a park, a country) are outlined, as paper maps do.
  if (p.geojson && /Polygon/.test(p.geojson.type)) {
    outline = window.L.geoJSON(p.geojson, { style: { className: 'map-outline', weight: 2, fill: true, fillOpacity: 0.06, dashArray: '6 4' }, interactive: false }).addTo(map);
  }
  if (fly) map.flyToBounds(bboxOf(p), { maxZoom: 17, padding: [24, 24], duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.6 });
}

/* The list -------------------------------------------------------------- */

let found = [];

function card(p, i) {
  const tags = p.extratags ?? {};
  const website = safeUrl(tags.website ?? tags['contact:website'] ?? '');
  const phone = tags.phone ?? tags['contact:phone'];
  const osm = `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`;
  const open = h('button', { class: 'place-open', type: 'button' }, nameOf(p));
  open.addEventListener('click', () => select(i));
  return h('li', { class: 'result place' },
    h('h2', { class: 'result-title place-title' }, h('span', { class: 'place-num num', 'aria-hidden': 'true' }, String(i + 1)), open),
    h('p', { class: 'place-kind' }, kindOf(p)),
    h('p', { class: 'place-address' }, addressOf(p)),
    tags.opening_hours ? h('p', { class: 'place-detail' }, h('span', { class: 'place-label' }, 'Hours '), hours(tags.opening_hours)) : '',
    phone ? h('p', { class: 'place-detail' }, h('span', { class: 'place-label' }, 'Phone '), h('a', { href: `tel:${phone.split(';')[0].replace(/[^\d+]/g, '')}` }, phone.split(';')[0])) : '',
    h('p', { class: 'place-links' },
      website ? h('a', { href: website, target, rel: 'noreferrer' }, hostOf(website)) : '',
      h('a', { href: `https://www.openstreetmap.org/directions?to=${p.lat}%2C${p.lon}`, target, rel: 'noreferrer' }, 'Directions'),
      h('a', { href: osm, target, rel: 'noreferrer' }, 'Open on OpenStreetMap')));
}

async function load() {
  let data;
  try {
    data = await track(places());
  } catch (err) {
    if (err.name === 'AbortError') return;
    status.replaceChildren('The map search didn’t answer. ', h('a', { href: location.href }, 'Try again'), '.');
    return;
  }
  // The same place mapped twice (a building and its point) is listed once.
  const seen = new Set();
  found = data.filter((p) => {
    const key = `${nameOf(p)}|${Number(p.lat).toFixed(3)}|${Number(p.lon).toFixed(3)}`;
    return !seen.has(key) && seen.add(key);
  });
  if (!found.length) {
    status.replaceChildren('No places found for ', h('b', null, words), nearMe ? ` near ${home.name}.` : '',
      ' Try a place name, an address, or a kind of place and a town ("cafe in Galway").');
    return;
  }
  status.replaceChildren(found.length === 1 ? 'Place for ' : 'Places for ', h('b', null, words), nearMe ? ` near ${home.name}` : '');
  list.replaceChildren(...found.map(card));
  if (!map) return;
  found.forEach((p, i) => {
    const m = window.L.marker([Number(p.lat), Number(p.lon)], { icon: pin(i + 1, false), title: nameOf(p), keyboard: false }).addTo(map);
    m.on('click', () => {
      select(i, { fly: false });
      list.children[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    markers.push(m);
  });
  // One clear answer (a city, a landmark): show it. Several: show them all.
  if (found.length === 1 || Number(found[0].importance) > 0.45 && !nearMe) select(0);
  else {
    map.fitBounds(window.L.latLngBounds(found.map((p) => [Number(p.lat), Number(p.lon)])), { padding: [32, 32], maxZoom: 15 });
    current = -1;
  }
}

// "Pizza near me" with no saved location: searching the whole world would
// find a village called Pizza, so ask first.
function askWhere() {
  const use = h('button', { class: 'btn btn-small', type: 'button' }, 'Use my location');
  const note = h('span', { class: 'map-ask-note' });
  use.addEventListener('click', async () => {
    use.disabled = true;
    note.textContent = 'Finding you…';
    try {
      home = await locateMe();
      home.name = 'you';
      load();
    } catch (err) {
      note.textContent = err.message;
      use.disabled = false;
    }
  });
  status.replaceChildren(h('span', null, 'To find ', h('b', null, words), ' near you, share your location for this search, or ',
    h('a', { href: 'settings.html#location' }, 'save one in Settings'), '. '), use, ' ', note);
}

// The map shows the world while the search runs.
if (window.L) setupMap();
if (nearMe && !home) askWhere();
else load();
