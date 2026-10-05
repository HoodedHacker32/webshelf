// Answers without AI. Two kinds, both checkable at their source:
// 1. Facts read from Wikidata for questions with a known shape
//    ("how tall is mount everest", "gordon ramsay age", "capital of france").
// 2. Definitions: the opening sentences of the Wikipedia article a "what is" /
//    "who is" question names, quoted word for word.
// Nothing is generated, rewritten or summarised, and open-ended why/how
// questions get no answer box at all.

import { getJSON } from './dom.js';
import { values, best, parseTime, fmtDate, ageBetween, UNITS, getEntities, fetchSubject, labelText } from './entity.js';
import { lookup } from './wiki.js';

const WP = 'https://en.wikipedia.org/w/api.php';
const qs = (params) => new URLSearchParams({ format: 'json', origin: '*', ...params }).toString();

/* Question shapes --------------------------------------------------------- */

// kind: [label, question template, Wikidata properties (first present wins)]
export const KINDS = {
  whois: ['About', (n) => `Who is ${n}?`, []],
  whatis: ['About', (n) => `What is ${n}?`, []],
  age: ['Age', (n) => `How old is ${n}?`, ['P569']],
  born: ['Born', (n) => `When was ${n} born?`, ['P569']],
  birthplace: ['Place of birth', (n) => `Where was ${n} born?`, ['P19']],
  died: ['Died', (n) => `When did ${n} die?`, ['P570']],
  spouse: ['Spouse', (n) => `Who is ${n} married to?`, ['P26']],
  children: ['Children', (n) => `How many children does ${n} have?`, ['P40']],
  height: ['Height', (n) => `How tall is ${n}?`, ['P2048', 'P2044']],
  population: ['Population', (n) => `What is the population of ${n}?`, ['P1082']],
  capital: ['Capital', (n) => `What is the capital of ${n}?`, ['P36']],
  currency: ['Currency', (n) => `What currency does ${n} use?`, ['P38']],
  founded: ['Founded', (n) => `When was ${n} founded?`, ['P571']],
  opened: ['Opened', (n) => `When did ${n} open?`, ['P1619']],
  founder: ['Founded by', (n) => `Who founded ${n}?`, ['P112']],
  ceo: ['CEO', (n) => `Who is the CEO of ${n}?`, ['P169']],
  author: ['Author', (n) => `Who wrote ${n}?`, ['P50', 'P170']],
  inventor: ['Invented by', (n) => `Who invented ${n}?`, ['P61']],
  director: ['Director', (n) => `Who directed ${n}?`, ['P57']],
  headOfState: ['Head of state', (n) => `Who is the head of state of ${n}?`, ['P35']],
  headOfGov: ['Head of government', (n) => `Who leads the government of ${n}?`, ['P6']],
  area: ['Area', (n) => `How big is ${n}?`, ['P2046']],
  netWorth: ['Net worth', (n) => `What is ${n}'s net worth?`, ['P2218']],
  location: ['Location', (n) => `Where is ${n}?`, ['P131', 'P17']],
  length: ['Length', (n) => `How long is ${n}?`, ['P2043']],
  occupation: ['Occupation', (n) => `What does ${n} do?`, ['P106']],
  nationality: ['Nationality', (n) => `What is ${n}'s nationality?`, ['P27']],
  education: ['Educated at', (n) => `Where did ${n} study?`, ['P69']],
  awards: ['Awards', (n) => `What awards has ${n} won?`, ['P166']],
  knownFor: ['Notable work', (n) => `What is ${n} known for?`, ['P800']],
  residence: ['Residence', (n) => `Where does ${n} live?`, ['P551']],
  headquarters: ['Headquarters', (n) => `Where is ${n} based?`, ['P159']],
  products: ['Products', (n) => `What does ${n} make?`, ['P1056']],
  employees: ['Employees', (n) => `How many people work at ${n}?`, ['P1128']],
  architect: ['Architect', (n) => `Who designed ${n}?`, ['P84']],
  visitors: ['Visitors per year', (n) => `How many people visit ${n}?`, ['P1174']],
  language: ['Official language', (n) => `What language is spoken in ${n}?`, ['P37']],
  // Events: a date (point in time, publication, first performance, founding)
  // or a span (start to end). Asked as "when was X", "when did X start".
  when: ['Date', (n) => `When was ${n}?`, ['P585', 'P580', 'P577', 'P1191', 'P571']],
  started: ['Started', (n) => `When did ${n} start?`, ['P580', 'P571', 'P585']],
  ended: ['Ended', (n) => `When did ${n} end?`, ['P582', 'P576', 'P585']],
};

// Kinds whose subject must be the article found (by its title or a redirect
// to it): "when was the battle of hastings" must not answer about an album.
export const EXACT_SUBJECT = new Set(['when', 'started', 'ended']);

// Facts about a role someone can leave: if it has ended, there is no current answer.
const CURRENT_ONLY = new Set(['spouse', 'ceo', 'headOfState', 'headOfGov', 'residence']);

const PATTERNS = [
  ['age', /^how old (?:is|was) (.+)$/], ['age', /^(.+?)(?:'s)? age$/], ['age', /^age of (.+)$/],
  ['born', /^when (?:was|is) (.+?) born$/],
  ['born', /^(?:when is |when's |what is |what's )?(.+?)(?:'s|s')? (?:birthday|date of birth|birth date|birthdate)$/],
  ['birthplace', /^where (?:was|is) (.+?) born$/], ['birthplace', /^(.+?)(?:'s)? (?:birthplace|place of birth)$/],
  ['died', /^when did (.+?) die$/], ['died', /^(.+?)(?:'s)? (?:death date|date of death)$/],
  ['spouse', /^who (?:is|was) (.+?) married to$/], ['spouse', /^who (?:is|was) (.+?)(?:'s)? (?:wife|husband|spouse)$/], ['spouse', /^(.+?)(?:'s)? (?:wife|husband|spouse)$/],
  ['children', /^how many (?:children|kids) (?:does|did) (.+?) have$/], ['children', /^(.+?)(?:'s)? (?:children|kids)$/],
  ['height', /^how (?:tall|high) (?:is|was) (?:the )?(.+)$/], ['height', /^(?:the )?(.+?)(?:'s)? height$/], ['height', /^height of (?:the )?(.+)$/],
  ['population', /^(?:what is )?(?:the )?population of (.+)$/], ['population', /^(.+?) population$/], ['population', /^how many people live in (.+)$/],
  ['capital', /^(?:what is )?(?:the )?capital(?: city)? of (.+)$/], ['capital', /^(.+?) capital(?: city)?$/],
  ['currency', /^(?:what is )?(?:the )?currency (?:of|in|used in) (.+)$/], ['currency', /^what currency (?:does|is used in) (.+?)(?: use)?$/], ['currency', /^(.+?) currency$/],
  ['opened', /^when (?:was|were|did) (?:the )?(.+?) (?:built|opened|open)$/],
  ['founded', /^when (?:was|were) (?:the )?(.+?) (?:founded|established|created|formed)$/],
  ['founder', /^who (?:founded|created|started|established) (.+)$/], ['founder', /^(?:the )?founders? of (.+)$/], ['founder', /^(.+?) founders?$/],
  ['ceo', /^who (?:is|was) (?:the )?ceo of (.+)$/], ['ceo', /^(.+?) ceo$/],
  ['inventor', /^who (?:invented|discovered) (?:the )?(.+)$/], ['inventor', /^(?:the )?inventor of (?:the )?(.+)$/],
  ['author', /^who wrote (.+)$/], ['author', /^(?:who is )?(?:the )?author of (.+)$/],
  ['director', /^who directed (.+)$/], ['director', /^(?:who is )?(?:the )?director of (.+)$/],
  ['headOfState', /^who is (?:the )?(?:president|king|queen|monarch|head of state) of (.+)$/], ['headOfState', /^(.+?) president$/],
  ['headOfGov', /^who is (?:the )?(?:prime minister|chancellor|premier|head of government) of (.+)$/], ['headOfGov', /^(.+?) prime minister$/],
  ['area', /^how (?:big|large) is (?:the )?(.+)$/], ['area', /^(?:what is )?(?:the )?(?:area|size) of (.+)$/],
  ['netWorth', /^(?:what is )?(.+?)(?:'s)? net worth$/],
  ['location', /^where is (?:the )?(.+)$/],
  ['length', /^how long is (?:the )?(.+)$/], ['length', /^(?:the )?length of (?:the )?(.+)$/],
  // Last, so "when was X born / founded / built" are read as those first.
  ['started', /^when did (?:the )?(.+?) (?:start|begin)$/], ['started', /^what year did (?:the )?(.+?) (?:start|begin)$/],
  ['ended', /^when did (?:the )?(.+?) (?:end|finish|stop)$/], ['ended', /^what year did (?:the )?(.+?) (?:end|finish)$/],
  ['when', /^when (?:was|were|is|did) (?:the )?(.+?)(?: happen| take place| occur)?$/],
  ['when', /^what (?:year|date) (?:was|were|did) (?:the )?(.+?)(?: happen| take place| occur)?$/],
];

export function parseQuestion(query) {
  // Phones type curly apostrophes ("swift’s").
  const q = query.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const [kind, re] of PATTERNS) {
    const m = re.exec(q);
    if (m && m[1] && m[1].length > 1) return { kind, subject: m[1].trim() };
  }
  return null;
}

const QUESTION_START = /^(who|what|whats|what's|when|where|why|how|which|whose|is|are|was|were|can|could|does|do|did|should|will|would)\b/i;
export const looksLikeQuestion = (q) => QUESTION_START.test(q.trim()) || q.trim().endsWith('?');

/* Facts from Wikidata ------------------------------------------------------ */

// Claims that have ended (a former spouse, a past CEO) are left out.
// The statements that can answer a question: never the subject itself (France
// is "in" France), and every occupation rather than only the preferred one.
function usable(entity, kind, pid) {
  const all = entity.claims[pid] ?? [];
  const list = kind === 'occupation' ? all.filter((c) => c.rank !== 'deprecated') : best(entity.claims, pid);
  return list.filter((c) => {
    const dv = c.mainsnak?.datavalue;
    if (dv?.value?.id === entity.id) return false;
    // A size without a unit can't be read; a visitor count from decades ago isn't an answer now.
    if (MEASURES.has(kind) && dv?.type === 'quantity' && !UNITS[dv.value.unit?.split('/').pop()]) return false;
    if (kind === 'visitors') {
      const when = c.qualifiers?.P585?.[0]?.datavalue;
      return when && parseTime(when)?.year >= new Date().getFullYear() - 15;
    }
    return true;
  });
}

const MEASURES = new Set(['height', 'area', 'length']);

function current(list, strict) {
  const live = list.filter((c) => !c.qualifiers?.P582);
  return strict || live.length ? live : list;
}

// The first property that can answer: for a role someone can leave, one still held.
const answerProp = (entity, kind) => KINDS[kind][2].find((p) => {
  const list = usable(entity, kind, p);
  return CURRENT_ONLY.has(kind) ? current(list, true).length : list.length;
});

function quantity(dv, claim) {
  const amount = Number(dv.value.amount);
  const unit = UNITS[dv.value.unit?.split('/').pop()] ?? '';
  const when = claim?.qualifiers?.P585?.[0]?.datavalue ? parseTime(claim.qualifiers.P585[0].datavalue) : null;
  return `${amount.toLocaleString()}${unit}${when ? ` (${when.year})` : ''}`;
}

// The answer to one kind of question about one Wikidata record, or null.
export async function factAnswer(kind, entity, { signal } = {}) {
  const def = KINDS[kind];
  if (!def || !entity?.claims) return null;
  const claims = entity.claims;
  // The first property with a usable (non-deprecated) value: Everest's "height" is deprecated, its elevation isn't.
  const pid = answerProp(entity, kind);
  if (!pid && !EXACT_SUBJECT.has(kind)) return null;

  if (kind === 'age') {
    const born = parseTime(values(claims, 'P569')[0]);
    const died = parseTime(values(claims, 'P570')[0]);
    if (!born?.date) return null;
    return died?.date
      ? { answer: `Died aged ${ageBetween(born.date, died.date)}`, note: `${fmtDate(born)} – ${fmtDate(died)}` }
      : { answer: `${ageBetween(born.date)} years`, note: `Born ${fmtDate(born)}` };
  }

  if (EXACT_SUBJECT.has(kind)) {
    const time = (p) => {
      const dv = best(claims, p)[0]?.mainsnak?.datavalue;
      return dv?.type === 'time' ? parseTime(dv) : null;
    };
    const start = time('P580');
    const end = time('P582');
    if (kind === 'when' && start && end) {
      const years = end.year - start.year;
      return { answer: `${fmtDate(start)} – ${fmtDate(end)}`, note: years >= 1 ? `About ${years} year${years === 1 ? '' : 's'}` : '' };
    }
    const one = pid ? time(pid) : null;
    // A yearly day ("when is christmas"): Wikidata's day in the year.
    if (!one && kind === 'when') {
      const day = values(claims, 'P837')[0]?.value?.id;
      if (!day) return null;
      const label = labelText((await getEntities([day], 'labels', signal).catch(() => ({})))[day]);
      // Wikidata's labels say "December 25"; the rest of the page says "25 December".
      return label ? { answer: label.replace(/^([A-Z][a-z]+) (\d{1,2})$/, '$2 $1'), note: 'Every year' } : null;
    }
    if (!one) return null;
    // Asked when something ended, a date it started is no answer.
    if (kind === 'ended' && pid === 'P585' && start) return null;
    return { answer: fmtDate(one), note: kind === 'when' && start && !end ? 'Start date; Wikidata gives no end' : '' };
  }

  // Counts that change over time: the latest figure only.
  const list = ['population', 'visitors', 'employees'].includes(kind) ? usable(entity, kind, pid).slice(-1) : current(usable(entity, kind, pid), CURRENT_ONLY.has(kind));
  if (!list.length) return null;
  // Count every value, but only name the few that are shown.
  const total = list.length;
  const dvs = list.slice(0, 6).map((c) => ({ dv: c.mainsnak.datavalue, claim: c }));
  const itemIds = dvs.filter((x) => x.dv?.type === 'wikibase-entityid').map((x) => x.dv.value.id);
  const labels = itemIds.length ? await getEntities(itemIds, 'labels', signal).catch(() => ({})) : {};
  const text = dvs.map(({ dv, claim }) => {
    if (dv?.type === 'wikibase-entityid') return labelText(labels[dv.value.id]);
    if (dv?.type === 'time') { const t = parseTime(dv); return t ? fmtDate(t) : null; }
    if (dv?.type === 'quantity') return quantity(dv, claim);
    return dv?.type === 'string' ? dv.value : null;
  }).filter(Boolean);
  if (!text.length) return null;

  if (kind === 'children') return { answer: String(total), note: text.join(', ') + (total > text.length ? ' and others' : '') };
  if (kind === 'location') return { answer: text.slice(0, 2).join(', '), note: '' };
  // One date answers a "when" question; several values are said to be several.
  if (['born', 'died', 'founded', 'opened'].includes(kind)) return { answer: text[0], note: '' };
  if (total > 1) {
    const shown = text.slice(0, 4);
    return { answer: shown.join(', '), note: `Wikidata lists ${total}${total > shown.length ? `; ${shown.length} are shown` : ''}.` };
  }
  return { answer: text[0], note: '' };
}

// Resolve the subject of a question to a Wikipedia article and Wikidata record.
export async function resolveSubject(text, { signal } = {}) {
  const info = await lookup(text, { signal });
  const hit = info.hits[0];
  if (!hit) return null;
  const qid = info.ids?.[hit.title] ?? null;
  const entity = await fetchSubject({ qid, title: hit.title }, { signal });
  return entity ? { title: hit.title, entity, redirect: hit.redirecttitle ?? null } : null;
}

// Whether a question's subject is exactly the article found, by its title or a
// redirect to it: "ww2" is World War II (a redirect), "world war 2" is too
// (Roman numerals read as numbers), "next eclipse" is no particular eclipse.
const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8' };
const sameName = (text) => String(text ?? '').toLowerCase()
  .replace(/\s*\(.*?\)\s*/g, ' ').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
  .split(' ').map((w) => ROMAN[w] ?? w).join(' ');
export function subjectMatches(text, subj) {
  const want = sameName(text);
  return Boolean(want && (want === sameName(subj.title) || (subj.redirect && want === sameName(subj.redirect))));
}

// Up to five questions Wikidata can answer about a subject, in a sensible order.
export function questionsFor(entity, { exclude = [], isHuman = false } = {}) {
  const skip = new Set([].concat(exclude));
  const order = isHuman
    ? ['age', 'spouse', 'children', 'occupation', 'knownFor', 'birthplace', 'nationality', 'education', 'awards', 'residence', 'height', 'netWorth', 'died']
    : ['opened', 'founded', 'founder', 'ceo', 'headquarters', 'products', 'employees', 'architect', 'visitors', 'location', 'height', 'population', 'capital', 'language', 'currency', 'area', 'length', 'headOfGov', 'author', 'director'];
  if (!entity?.claims) return [];
  // A building's inception is when work started; "founded" would misread it.
  if (values(entity.claims, 'P1619').length) skip.add('founded');
  // Elevation answers "how tall is Everest" when asked, but isn't worth suggesting for a city.
  return order.filter((k) => !skip.has(k) && (k === 'height' ? usable(entity, k, 'P2048').length : answerProp(entity, k)));
}

// The question kinds whose answers a topic page already shows (header tiles and
// the facts table), so the questions list doesn't repeat them.
export function kindsShown(entity, shownProps) {
  const shown = new Set(shownProps);
  return Object.entries(KINDS).filter(([, def]) => def[2].some((p) => shown.has(p))).map(([k]) => k)
    .concat(shown.has('P569') ? ['age', 'born'] : []);
}

/* Definitions quoted from Wikipedia ------------------------------------------ */
/* Only the opening of the article the question names is quoted. Picking an
   explanatory passage for "why" or "how" questions by keyword rules proved
   unreliable (it quoted misleading sentences), and doing it well needs a
   trained model, so those questions get plain results instead. */

const STOP = new Set(('a an the and or but of to in on at by for with from as is are was were be been being do does did ' +
  'what whats which who whom whose when where why how can could should would will i me my we our you your he him his she her ' +
  'it its they them their this that these those there here').split(' '));

const stem = (w) => {
  let s = w.toLowerCase().replace(/'s$/, '');
  if (s.length > 5 && s.endsWith('ies')) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && s.endsWith('es')) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
};
const words = (text) => text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
export const contentTerms = (text) => [...new Set(words(text).filter((w) => !STOP.has(w) && w.length > 1).map(stem))];

// "what is photosynthesis", "who is jensen huang", "what are black holes"
export function parseDefinition(query) {
  const m = /^(?:what|who)(?:'s| is| are| was| were)\s+(?:a |an |the )?(.+?)\??$/i.exec(query.trim());
  return m && m[1].split(/\s+/).length <= 6 ? { subject: m[1].trim() } : null;
}

// Split a passage into runs, bolding the words that match the question.
export function highlight(text, terms) {
  const set = new Set(terms);
  const out = [];
  for (const part of text.split(/(\b[\w']+\b)/)) {
    if (!part) continue;
    const bold = /^[\w']+$/.test(part) && set.has(stem(part));
    const last = out[out.length - 1];
    if (last && last.bold === bold) last.text += part;
    else out.push({ text: part, bold });
  }
  return out;
}

// The opening of an article, quoted: used for "Who is …?" / "What is …?".
export async function leadSentences(title, { signal, count = 2 } = {}) {
  const data = await getJSON(`${WP}?${qs({ action: 'query', prop: 'extracts', explaintext: 1, exintro: 1, exsentences: count, titles: title, redirects: 1 })}`, { signal });
  const page = Object.values(data?.query?.pages ?? {})[0];
  return page?.extract?.trim() || null;
}
