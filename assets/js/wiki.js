// Wikipedia and Wikidata: suggestions, "Did you mean", knowledge panel data.
// All endpoints send CORS headers; `origin=*` makes the Action API do so.

import { getJSON } from './dom.js';

const WP = 'https://en.wikipedia.org';
const API = `${WP}/w/api.php`;
const WD_API = 'https://www.wikidata.org/w/api.php';

const qs = (params) => new URLSearchParams({ format: 'json', origin: '*', ...params }).toString();

// Title completions for the search box and "Related searches".
export async function completions(text, { limit = 8, signal } = {}) {
  const data = await getJSON(`${API}?${qs({ action: 'opensearch', search: text, limit, namespace: 0 })}`, { signal, timeout: 4000 });
  return Array.isArray(data?.[1]) ? data[1] : [];
}

// Top article for a query plus Wikipedia's spelling suggestion, if any.
// The results page, the ranking and the topic panel all ask about the same
// search; one request serves them all.
const lookups = new Map();
export function lookup(query, ctx = {}) {
  const key = query.trim().toLowerCase();
  if (!lookups.has(key)) lookups.set(key, lookupFresh(query, ctx).catch((err) => { lookups.delete(key); throw err; }));
  return lookups.get(key);
}

async function lookupFresh(query, { signal } = {}) {
  const data = await getJSON(`${API}?${qs({
    action: 'query', list: 'search', srsearch: query, srlimit: 3,
    srinfo: 'suggestion|totalhits', srprop: 'redirecttitle|snippet', srenablerewrites: 0,
    // The same request also returns each hit's Wikidata id.
    generator: 'search', gsrsearch: query, gsrlimit: 3, prop: 'pageprops', ppprop: 'wikibase_item',
  })}`, { signal });
  const info = data?.query?.searchinfo ?? {};
  const ids = {};
  for (const p of Object.values(data?.query?.pages ?? {})) ids[p.title] = p.pageprops?.wikibase_item ?? null;
  return { hits: data?.query?.search ?? [], ids, suggestion: info.suggestion || null, total: info.totalhits ?? 0 };
}

const norm = (s) => s.toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\s*\(.*?\)\s*/g, ' ')
  .replace(/^the\s+/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// The article a knowledge panel should show, or null when none is a close match.
export function panelTitle(query, hits) {
  const q = norm(query);
  if (!q) return null;
  for (const hit of hits.slice(0, 3)) {
    if (norm(hit.title) === q) return hit.title;
    if (hit.redirecttitle && norm(hit.redirecttitle) === q) return hit.title;
  }
  return null;
}

export async function summary(title, { signal } = {}) {
  const data = await getJSON(`${WP}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal });
  if (!data || data.type === 'disambiguation' || !data.extract) return null;
  return data;
}

// A handful of Wikidata facts, in Google's knowledge-panel order.
const FACTS = [
  ['P569', 'Born'], ['P570', 'Died'], ['P26', 'Spouse'], ['P571', 'Founded'], ['P112', 'Founders'],
  ['P169', 'CEO'], ['P159', 'Headquarters'], ['P36', 'Capital'], ['P38', 'Currency'], ['P1082', 'Population'],
  ['P57', 'Director'], ['P577', 'Release date'], ['P50', 'Author'], ['P175', 'Performer'],
  ['P2048', 'Height'], ['P131', 'Location'], ['P84', 'Architect'], ['P1619', 'Opened'], ['P264', 'Record label'],
];

export async function facts(title, { signal, max = 6 } = {}) {
  const data = await getJSON(`${WD_API}?${qs({
    action: 'wbgetentities', sites: 'enwiki', titles: title, props: 'claims',
  })}`, { signal });
  const entity = Object.values(data?.entities ?? {})[0];
  if (!entity?.claims) return { rows: [], website: null, image: null };
  const claims = entity.claims;

  const best = (pid) => {
    const list = (claims[pid] ?? []).filter((c) => c.mainsnak?.snaktype === 'value');
    const preferred = list.filter((c) => c.rank === 'preferred');
    return (preferred.length ? preferred : list.filter((c) => c.rank !== 'deprecated'));
  };

  const picked = [];
  const ids = new Set();
  for (const [pid, label] of FACTS) {
    const values = best(pid).slice(0, pid === 'P112' || pid === 'P26' ? 3 : 1).map((c) => c.mainsnak.datavalue);
    if (!values.length) continue;
    if (pid === 'P570' && !values[0]) continue;
    values.forEach((v) => { if (v?.type === 'wikibase-entityid') ids.add(v.value.id); });
    picked.push({ pid, label, values });
    if (picked.length >= max) break;
  }

  const website = best('P856')[0]?.mainsnak?.datavalue?.value ?? null;
  const imageFile = best('P18')[0]?.mainsnak?.datavalue?.value ?? null;
  // Special:FilePath redirects to a 500px thumbnail, a width Wikimedia serves.
  const image = imageFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=500` : null;
  const labels = ids.size ? await entityLabels([...ids], signal) : {};
  const died = picked.find((f) => f.pid === 'P570');

  const rows = picked.map(({ pid, label, values }) => ({
    label,
    parts: values.map((v) => formatValue(v, labels, pid === 'P569' && !died)).filter(Boolean),
  })).filter((r) => r.parts.length);

  return { rows, website, image };
}

async function entityLabels(ids, signal) {
  const data = await getJSON(`${WD_API}?${qs({ action: 'wbgetentities', ids: ids.slice(0, 50).join('|'), props: 'labels', languages: 'en|mul' })}`, { signal });
  const out = {};
  for (const [id, e] of Object.entries(data?.entities ?? {})) out[id] = e.labels?.en?.value ?? e.labels?.mul?.value;
  return out;
}

function formatValue(dv, labels, withAge) {
  if (!dv) return null;
  switch (dv.type) {
    case 'wikibase-entityid': {
      const text = labels[dv.value.id];
      return text ? { text, link: true } : null;
    }
    case 'time': {
      const { time, precision } = dv.value;
      const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(time);
      if (!m) return null;
      const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
      if (precision <= 9 || m[3] === '00') return { text: String(year) };
      const date = new Date(Date.UTC(year, Number(m[3]) - 1, Number(m[4])));
      let text = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (withAge) {
        const now = new Date();
        let age = now.getUTCFullYear() - date.getUTCFullYear();
        if (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age -= 1;
        text += ` (age ${age} years)`;
      }
      return { text };
    }
    case 'quantity': {
      const amount = Number(dv.value.amount);
      const unit = dv.value.unit?.endsWith('/Q11573') ? ' m' : '';
      return { text: amount.toLocaleString() + unit };
    }
    case 'string':
      return { text: dv.value };
    default:
      return null;
  }
}

// Full-colour images for a query, from Wikimedia Commons (bitmaps only).
export async function commonsImages(query, { signal, limit = 10 } = {}) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: query,
    gsrnamespace: 6, gsrlimit: limit, prop: 'imageinfo', iiprop: 'url|mime|size', iiurlwidth: 250,
  });
  const data = await getJSON(`https://commons.wikimedia.org/w/api.php?${params}`, { signal, timeout: 6000 });
  return Object.values(data?.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''), info: p.imageinfo?.[0] }))
    .filter((p) => p.info?.thumburl && /^image\/(jpeg|png|webp|gif)$/.test(p.info.mime))
    .map((p) => ({ title: p.title, thumb: p.info.thumburl, page: p.info.descriptionurl, w: p.info.thumbwidth, h: p.info.thumbheight, mime: p.info.mime, originalWidth: p.info.width }));
}
