// Everything the topic layout shows about a Wikipedia article's subject,
// gathered from Wikidata and Wikipedia (free, CORS-enabled):
// quick facts, photos, social profiles, related people and works.

import { getJSON } from './dom.js';

const WD = 'https://www.wikidata.org/w/api.php';
const WP = 'https://en.wikipedia.org/w/api.php';
const qs = (params) => new URLSearchParams({ format: 'json', origin: '*', ...params }).toString();

// Special:FilePath redirects to a thumbnail; 250 and 500 are widths Wikimedia serves.
export const commonsFile = (name, width = 500) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;

const FACTS = [
  ['P569', 'Born'], ['P570', 'Died'], ['P26', 'Spouse'], ['P40', 'Children'], ['P3373', 'Siblings'],
  ['P22', 'Father'], ['P25', 'Mother'], ['P571', 'Founded'], ['P112', 'Founders'], ['P169', 'CEO'],
  ['P159', 'Headquarters'], ['P36', 'Capital'], ['P38', 'Currency'], ['P1082', 'Population'],
  ['P57', 'Director'], ['P577', 'Release date'], ['P50', 'Author'], ['P175', 'Performer'],
  ['P2048', 'Height'], ['P131', 'Location'], ['P84', 'Architect'], ['P1619', 'Opened'], ['P264', 'Record label'],
];
const MULTI = new Set(['P26', 'P40', 'P3373', 'P112']);
export const UNITS = { Q11573: ' m', Q174728: ' cm', Q828224: ' km', Q11570: ' kg', Q712226: ' km²', Q3311267: ' ft' };

// Film and TV credits only make sense for people who work in film or TV;
// otherwise a politician's cameo would fill a "Films" carousel.
const SCREEN_JOBS = new Set(['Q33999', 'Q10800557', 'Q10798782', 'Q2405480', 'Q947873', 'Q2526255', 'Q3282637', 'Q578109', 'Q245068', 'Q28389', 'Q2259451', 'Q3455803', 'Q15214752']);

const PROFILES = [
  ['P2003', 'Instagram', (id) => `https://www.instagram.com/${id}/`],
  ['P2002', 'X', (id) => `https://x.com/${id}`],
  ['P2013', 'Facebook', (id) => `https://www.facebook.com/${id}`],
  ['P2397', 'YouTube', (id) => `https://www.youtube.com/channel/${id}`],
  ['P7085', 'TikTok', (id) => `https://www.tiktok.com/@${id}`],
];

const RELATIVES = ['P26', 'P40', 'P3373', 'P22', 'P25'];

export function best(claims, pid) {
  const list = (claims[pid] ?? []).filter((c) => c.mainsnak?.snaktype === 'value');
  const preferred = list.filter((c) => c.rank === 'preferred');
  return preferred.length ? preferred : list.filter((c) => c.rank !== 'deprecated');
}
export const values = (claims, pid) => best(claims, pid).map((c) => c.mainsnak.datavalue);
// Every non-deprecated value, ignoring preferred rank (for checks like "any occupation on screen").
export const allValues = (claims, pid) => (claims[pid] ?? [])
  .filter((c) => c.mainsnak?.snaktype === 'value' && c.rank !== 'deprecated').map((c) => c.mainsnak.datavalue);

export function parseTime(dv) {
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(dv?.value?.time ?? '');
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const exact = dv.value.precision >= 11 && m[3] !== '00';
  return { year, date: exact ? new Date(Date.UTC(year, Number(m[3]) - 1, Number(m[4]))) : null };
}

export const fmtDate = (t) => (t.date
  ? t.date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  : String(t.year));

export function ageBetween(from, to = new Date()) {
  let age = to.getUTCFullYear() - from.getUTCFullYear();
  if (to.getUTCMonth() < from.getUTCMonth() || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate())) age -= 1;
  return age;
}

// Wikidata now keeps many names under the language-neutral "mul" label instead of "en".
export const labelText = (e) => e?.labels?.en?.value ?? e?.labels?.mul?.value ?? null;

export async function getEntities(ids, props, signal) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const data = await getJSON(`${WD}?${qs({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props, languages: 'en|mul', sitefilter: 'enwiki' })}`, { signal });
    Object.assign(out, data?.entities ?? {});
  }
  return out;
}

// The properties the topic page shows in its facts table and tiles.
export function shownProps(entity) {
  const claims = entity?.claims ?? {};
  const skip = new Set(values(claims, 'P1619').length ? ['P571'] : []);
  const out = [];
  for (const [pid] of FACTS) {
    if (skip.has(pid) || !values(claims, pid).length) continue;
    out.push(pid);
    if (out.length >= 7) break;
  }
  return out;
}

// The subject's own Wikidata record (one request), by id when known.
// Fetched once per page, however many parts of the page ask for it.
const subjects = new Map();
export function fetchSubject({ qid, title }, ctx = {}) {
  const key = qid ?? `title:${title}`;
  if (!subjects.has(key)) subjects.set(key, fetchSubjectFresh({ qid, title }, ctx).catch((err) => { subjects.delete(key); throw err; }));
  return subjects.get(key);
}

async function fetchSubjectFresh({ qid, title }, { signal } = {}) {
  const params = qid ? { ids: qid } : { sites: 'enwiki', titles: title };
  const data = await getJSON(`${WD}?${qs({ action: 'wbgetentities', props: 'claims', ...params })}`, { signal });
  const entity = Object.values(data?.entities ?? {})[0];
  return entity?.claims ? entity : null;
}

// Film and TV carousels only for people who work on screen (or for non-people).
export function worksOnScreen(entity) {
  if (!entity?.claims) return true;
  const isHuman = values(entity.claims, 'P31').some((v) => v?.value?.id === 'Q5');
  return !isHuman || allValues(entity.claims, 'P106').some((v) => SCREEN_JOBS.has(v?.value?.id));
}

// The subject of an English Wikipedia article, ready to lay out.
export async function loadEntity(title, { signal, subject } = {}) {
  const entity = await (subject ?? fetchSubject({ title }, { signal }));
  if (!entity?.claims) return null;
  const claims = entity.claims;
  const isHuman = values(claims, 'P31').some((v) => v?.value?.id === 'Q5');

  // Facts, with linked items resolved to labels (and relatives' photos).
  const picked = [];
  // Wikidata's inception for a structure is when building started; its opening date reads better.
  const skip = new Set(values(claims, 'P1619').length ? ['P571'] : []);
  for (const [pid, label] of FACTS) {
    if (skip.has(pid)) continue;
    const vals = values(claims, pid).slice(0, MULTI.has(pid) ? 6 : 1);
    if (vals.length) picked.push({ pid, label, vals });
    if (picked.length >= 7) break;
  }
  const relativeIds = RELATIVES.flatMap((pid) => values(claims, pid).map((v) => v?.value?.id)).filter(Boolean).slice(0, 8);
  const linkIds = new Set(picked.flatMap((f) => f.vals.map((v) => v?.value?.id).filter(Boolean)));
  relativeIds.forEach((id) => linkIds.add(id));
  const linked = linkIds.size ? await getEntities([...linkIds], 'labels|claims', signal).catch(() => ({})) : {};
  const labelOf = (id) => labelText(linked[id]);

  const born = parseTime(values(claims, 'P569')[0]);
  const died = parseTime(values(claims, 'P570')[0]);

  const rows = picked.map(({ pid, label, vals }) => ({
    label,
    parts: vals.map((v) => {
      if (v?.type === 'wikibase-entityid') {
        const text = labelOf(v.value.id);
        return text ? { text, link: true } : null;
      }
      if (v?.type === 'time') {
        const t = parseTime(v);
        if (!t) return null;
        let text = fmtDate(t);
        if (pid === 'P569' && t.date && !died) text += ` (age ${ageBetween(t.date)})`;
        if (pid === 'P570' && t.date && born?.date) text += ` (aged ${ageBetween(born.date, t.date)})`;
        return { text };
      }
      if (v?.type === 'quantity') {
        const unit = UNITS[v.value.unit?.split('/').pop()] ?? '';
        return { text: Number(v.value.amount).toLocaleString() + unit };
      }
      return v?.type === 'string' ? { text: v.value } : null;
    }).filter(Boolean),
  })).filter((r) => r.parts.length);

  // Quick-fact tiles for the top of the page.
  const tiles = [];
  if (isHuman && born?.date) {
    tiles.push(died?.date
      ? { label: 'Died', value: `Aged ${ageBetween(born.date, died.date)}`, note: fmtDate(died) }
      : { label: 'Age', value: `${ageBetween(born.date)} years`, note: fmtDate(born) });
  }
  for (const r of rows) {
    if (tiles.length >= 2) break;
    if (['Born', 'Died'].includes(r.label) && isHuman) continue;
    tiles.push({ label: r.label, value: r.parts.slice(0, 2).map((p) => p.text).join(', '), note: r.parts.length > 2 ? `and ${r.parts.length - 2} more` : '' });
  }

  const people = relativeIds.map((id) => {
    const file = values(linked[id]?.claims ?? {}, 'P18')[0]?.value;
    return labelOf(id) ? { name: labelOf(id), image: file ? commonsFile(file, 250) : null } : null;
  }).filter(Boolean);

  const profiles = PROFILES.map(([pid, name, url]) => {
    const id = values(claims, pid)[0]?.value;
    return id ? { name, handle: pid === 'P2397' ? '' : id, url: url(id) } : null;
  }).filter(Boolean);

  return {
    qid: entity.id,
    isHuman,
    onScreen: worksOnScreen(entity),
    rows,
    tiles,
    people,
    profiles,
    photos: values(claims, 'P18').map((v) => v.value).slice(0, 2).map((f) => commonsFile(f)),
    website: values(claims, 'P856')[0]?.value ?? null,
  };
}

// The Wikidata id for an English Wikipedia article (a small, fast request).
export async function entityId(title, { signal } = {}) {
  const data = await getJSON(`${WD}?${qs({ action: 'wbgetentities', sites: 'enwiki', titles: title, props: 'info' })}`, { signal });
  const id = Object.keys(data?.entities ?? {})[0];
  return id && /^Q\d+$/.test(id) ? id : null;
}

// Works linked to the subject, grouped the way a reader looks for them.
const WORK_KINDS = [
  ['tv', 'TV shows', /television|tv series|reality|talk show|cooking show|programme|program/i],
  ['film', 'Films', /\bfilm\b|movie/i],
  ['books', 'Books', /\bbook\b|cookbook|novel|memoir|autobiography|non-fiction|edition/i],
  ['albums', 'Albums', /\balbum\b/i],
  ['songs', 'Songs', /\bsong\b|single/i],
];

export async function loadWorks(qid, { signal, onScreen = true } = {}) {
  const search = (q) => getJSON(`${WD}?${qs({ action: 'query', list: 'search', srsearch: q, srlimit: 50 })}`, { signal, timeout: 6000 })
    .then((d) => (d?.query?.search ?? []).map((s) => s.title))
    .catch(() => []);
  // Two searches, not five: Wikidata limits how many requests one visitor makes,
  // and "a|b" in haswbstatement means either.
  const queries = [
    // Books as works, not their many printed editions.
    `haswbstatement:P50=${qid} haswbstatement:P31=Q7725634|P31=Q571|P31=Q47461344|P31=Q8261|P31=Q4184783`,
    // Presented, performed, acted in or directed.
    `haswbstatement:${['P371', 'P175', ...(onScreen ? ['P161', 'P57'] : [])].map((p) => `${p}=${qid}`).join('|')}`,
  ];
  const ids = [...new Set((await Promise.all(queries.map(search))).flat())].slice(0, 60);
  if (!ids.length) return [];

  const items = await getEntities(ids, 'labels|descriptions|sitelinks', signal);
  const seen = new Set();
  const works = ids.map((id) => items[id]).filter((e) => e?.sitelinks?.enwiki && labelText(e)).map((e) => ({
    id: e.id,
    title: labelText(e),
    article: e.sitelinks.enwiki.title,
    description: e.descriptions?.en?.value ?? '',
  })).filter((w) => {
    // One card per show: skip individual seasons and episodes, and duplicates.
    if (/\bseason\b|\bseries \d|\bepisode\b/i.test(`${w.title} ${w.description}`)) return false;
    const key = w.title.toLowerCase().replace(/\s*\(.*\)$/, '');
    return !seen.has(key) && seen.add(key);
  });

  // Each work goes in the first group its description matches.
  for (const w of works) {
    w.kind = WORK_KINDS.find(([, , re]) => re.test(w.description))?.[0] ?? null;
    w.year = /\b(1[89]|20)\d{2}\b/.exec(w.description)?.[0] ?? '';
  }

  // Lead images from Wikipedia. Films use their theatrical poster, which
  // Wikipedia hosts as a non-free image for identification; everything else
  // uses free images only (for TV that's often a logo or title card).
  const pageImages = async (license, list) => {
    const titles = list.map((w) => w.article).slice(0, 50);
    if (!titles.length) return {};
    const data = await getJSON(`${WP}?${qs({ action: 'query', prop: 'pageimages', titles: titles.join('|'), piprop: 'thumbnail', pithumbsize: 250, pilicense: license, redirects: 1 })}`, { signal }).catch(() => null);
    const thumbs = {};
    for (const p of Object.values(data?.query?.pages ?? {})) if (p.thumbnail?.source) thumbs[p.title] = p.thumbnail.source;
    return thumbs;
  };
  const [freeThumbs, posterThumbs] = await Promise.all([
    pageImages('free', works.filter((w) => w.kind !== 'film')),
    pageImages('any', works.filter((w) => w.kind === 'film')),
  ]);
  works.forEach((w) => { w.image = (w.kind === 'film' ? posterThumbs : freeThumbs)[w.article] ?? null; });

  // TV shows: posters from TVmaze (open, no key or account), matched by the
  // show's IMDb id on Wikidata. Wikipedia's image stays if TVmaze has none.
  const shows = works.filter((w) => w.kind === 'tv').slice(0, 12);
  if (shows.length) {
    const posters = getEntities(shows.map((w) => w.id), 'claims', signal).catch(() => ({})).then((found) => Promise.all(shows.map(async (w) => {
      const imdb = values(found[w.id]?.claims ?? {}, 'P345')[0]?.value;
      if (typeof imdb !== 'string') return;
      const show = await getJSON(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdb)}`, { signal, timeout: 3000 }).catch(() => null);
      const src = show?.image?.medium;
      if (src) w.image = src.replace(/^http:/, 'https:');
    })));
    await Promise.race([posters, new Promise((resolve) => setTimeout(resolve, 2500))]);
  }

  return WORK_KINDS.map(([id, heading]) => ({ id, heading, items: works.filter((w) => w.kind === id).slice(0, 12) }))
    .filter((g) => g.items.length >= 2);
}
