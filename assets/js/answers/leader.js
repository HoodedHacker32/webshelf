// Who holds a country's top office now: "who is the current president",
// "taoiseach", "prime minister of france", "us president", "king of spain".
// From Wikidata's head of state (P35) and head of government (P6) statements,
// the ones with no end date.
//
// With no country named, the visitor's own: from the saved location in
// Settings, else this device's time zone (Europe/Dublin is Ireland), else the
// browser's language region (en-IE). Nothing is looked up to find it.

import { h, getJSON } from '../dom.js';
import { searchUrl } from '../config.js';
import { getSettings } from '../store.js';
import TZ_COUNTRIES from './tz-countries.js';

const WD = 'https://www.wikidata.org/w/api.php';
const qs = (params) => new URLSearchParams({ format: 'json', origin: '*', ...params }).toString();

const STATE = 'president|head of state|king|queen|monarch|emperor|empress|sovereign|grand duke|emir|sultan';
const GOVERNMENT = 'prime minister|pm|taoiseach|premier|chancellor|head of government|leader';
const OFFICE = `(${STATE}|${GOVERNMENT})`;

// The adjectives people put in front ("irish president", "us president").
const ADJECTIVES = {
  us: 'US', american: 'US', usa: 'US', irish: 'IE', british: 'GB', uk: 'GB', english: 'GB', french: 'FR', german: 'DE',
  italian: 'IT', spanish: 'ES', portuguese: 'PT', dutch: 'NL', belgian: 'BE', swiss: 'CH', austrian: 'AT', polish: 'PL',
  swedish: 'SE', norwegian: 'NO', danish: 'DK', finnish: 'FI', icelandic: 'IS', greek: 'GR', turkish: 'TR', ukrainian: 'UA',
  russian: 'RU', canadian: 'CA', mexican: 'MX', brazilian: 'BR', argentine: 'AR', argentinian: 'AR', chilean: 'CL',
  colombian: 'CO', venezuelan: 'VE', peruvian: 'PE', australian: 'AU', 'new zealand': 'NZ', indian: 'IN', pakistani: 'PK',
  chinese: 'CN', japanese: 'JP', korean: 'KR', 'south korean': 'KR', israeli: 'IL', egyptian: 'EG', nigerian: 'NG',
  kenyan: 'KE', 'south african': 'ZA', iranian: 'IR', saudi: 'SA', indonesian: 'ID', filipino: 'PH', czech: 'CZ',
  hungarian: 'HU', romanian: 'RO', croatian: 'HR', serbian: 'RS', slovak: 'SK', slovenian: 'SI', estonian: 'EE',
  latvian: 'LV', lithuanian: 'LT', taiwanese: 'TW', vietnamese: 'VN', thai: 'TH',
};

export function match(query) {
  const q = query.trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const lead = "(?:who(?:'s| is| are| was)? )?(?:the )?(?:current |present |sitting )?";
  let m = new RegExp(`^${lead}${OFFICE}(?: (?:of|in) (?:the )?(.+?))?(?: now| today| right now)?$`).exec(q);
  // A bare "queen" or "president" is more likely a band or a film than a
  // question: without a country, it has to be asked ("who is …", "current …"),
  // unless the office's name says it all ("taoiseach", "prime minister").
  const asked = /^(?:who|the current|current|present|sitting|the present|the sitting)\b/.test(q) || /\b(?:now|today)$/.test(q);
  if (m && (m[2] || asked || /^(?:the )?(?:taoiseach|prime minister|head of state|head of government)$/.test(q))) return { office: m[1], country: m[2] ?? null };
  m = new RegExp(`^${lead}(${Object.keys(ADJECTIVES).join('|')}) ${OFFICE}(?: now| today| right now)?$`).exec(q);
  if (m) return { office: m[2], country: null, code: ADJECTIVES[m[1]] };
  return null;
}

const regionName = (code) => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code); } catch { return code; }
};

// The visitor's country: { code, how }.
export function localCountry() {
  const home = getSettings().home;
  if (home?.tz && TZ_COUNTRIES[home.tz]) return { code: TZ_COUNTRIES[home.tz], how: `your saved location (${home.name})` };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (TZ_COUNTRIES[tz]) return { code: TZ_COUNTRIES[tz], how: 'this device’s time zone' };
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = /-([A-Z]{2})\b/i.exec(lang ?? '')?.[1];
    if (region) return { code: region.toUpperCase(), how: 'your browser’s language setting' };
  }
  return null;
}

// What the web results should be about: the office, in the country meant.
export function webQuery({ office, country, code }) {
  const place = country ?? regionName(code ?? localCountry()?.code ?? '');
  return place ? `${office} of ${place}` : null;
}

const claimsOf = (entity, prop) => entity?.claims?.[prop] ?? [];
const idOf = (claim) => claim?.mainsnak?.datavalue?.value?.id ?? null;
const timeOf = (claim, prop) => claim?.qualifiers?.[prop]?.[0]?.datavalue?.value?.time ?? null;

// The statement in force: no end date, preferred rank first, latest start.
function current(entity, prop) {
  const open = claimsOf(entity, prop).filter((c) => idOf(c) && !c.qualifiers?.P582 && c.rank !== 'deprecated');
  open.sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred') || String(timeOf(b, 'P580') ?? '').localeCompare(String(timeOf(a, 'P580') ?? '')));
  return open[0] ?? null;
}

async function countryByCode(code, signal) {
  const data = await getJSON(`${WD}?${qs({ action: 'query', list: 'search', srsearch: `haswbstatement:P297=${code}`, srlimit: 1 })}`, { signal });
  return data?.query?.search?.[0]?.title ?? null;
}

// A named country, checked to be one (it has an ISO code) and to be called
// what was typed, by its name or one of its other names ("usa").
async function countryByName(name, signal) {
  const data = await getJSON(`${WD}?${qs({ action: 'query', list: 'search', srsearch: `${name} haswbstatement:P297`, srlimit: 3 })}`, { signal });
  const ids = (data?.query?.search ?? []).map((s) => s.title);
  if (!ids.length) return null;
  const ents = await getJSON(`${WD}?${qs({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases', languages: 'en' })}`, { signal });
  const norm = (s) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z]/g, '');
  const want = norm(name);
  return ids.find((id) => {
    const e = ents?.entities?.[id];
    return [e?.labels?.en?.value, ...(e?.aliases?.en ?? []).map((a) => a.value)].filter(Boolean).some((n) => norm(n) === want);
  }) ?? null;
}

const formatDate = (time) => {
  const m = /^\+?(\d{4})-(\d{2})-(\d{2})/.exec(time ?? '');
  if (!m || m[2] === '00') return m ? m[1] : null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] || 1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export async function render(args, { signal }) {
  const local = !args.country && !args.code ? localCountry() : null;
  const code = args.code ?? local?.code ?? null;
  const qid = args.country ? await countryByName(args.country, signal) : code ? await countryByCode(code, signal) : null;
  if (!qid) return null;
  const countryData = await getJSON(`${WD}?${qs({ action: 'wbgetentities', ids: qid, props: 'labels|claims', languages: 'en' })}`, { signal });
  const country = countryData?.entities?.[qid];
  const countryName = country?.labels?.en?.value ?? regionName(code);

  // Which office: the head of state or of government, by the word asked; if
  // the country's office of that kind isn't called that ("president" in the
  // UK), the other one is checked, and failing that the answer says so.
  const asked = args.office;
  const stateFirst = new RegExp(`^(?:${STATE})$`).test(asked);
  const order = stateFirst ? [['P35', 'P1906'], ['P6', 'P1313']] : [['P6', 'P1313'], ['P35', 'P1906']];
  const offices = order.map(([holder, office]) => ({ holder: current(country, holder), office: idOf(current(country, office)) }));
  const ids = [...new Set(offices.flatMap((o) => [idOf(o.holder), o.office]).filter(Boolean))];
  if (!ids.length) return null;
  const labels = await getJSON(`${WD}?${qs({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'en' })}`, { signal });
  const label = (id) => labels?.entities?.[id]?.labels?.en?.value ?? null;
  const generic = /^(?:head of state|head of government|leader|pm)$/.test(asked);
  const titled = (o) => o.holder && (generic || (label(o.office) ?? '').toLowerCase().includes(asked === 'pm' ? 'prime minister' : asked));
  const chosen = offices.find(titled) ?? offices.find((o) => o.holder);
  if (!chosen?.holder) return null;
  const name = label(idOf(chosen.holder));
  if (!name) return null;
  const officeName = (label(chosen.office) ?? (stateFirst ? 'Head of state' : 'Head of government')).replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  const since = formatDate(timeOf(chosen.holder, 'P580'));
  const exact = titled(chosen);

  return h('section', { class: 'answer factbox raised', 'aria-label': `${officeName}: ${name}` },
    h('p', { class: 'factbox-path' }, h('a', { href: searchUrl(countryName) }, countryName), ` › ${officeName}`),
    h('p', { class: 'factbox-answer' }, h('a', { href: searchUrl(name) }, name)),
    h('p', { class: 'factbox-note' }, `${officeName}${since ? ` since ${since}` : ''}`),
    exact ? null : h('p', { class: 'answer-note' }, `${countryName} has no office called “${asked}”; this is its ${officeName.toLowerCase()}.`),
    local ? h('p', { class: 'answer-note' }, `${countryName} is worked out from ${local.how}. For another country, search “${asked} of France”, for example.`) : null,
    h('p', { class: 'answer-source' }, 'From ', h('a', { href: `https://www.wikidata.org/wiki/${qid}`, rel: 'noreferrer' }, 'Wikidata')));
}
