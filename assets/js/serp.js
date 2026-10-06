// Results page: web results, instant answer, images, topic panel, spelling,
// related searches. Each part loads on its own so one slow source never holds
// up the others.

import { SITE, BACKEND, searchUrl } from './config.js';
import { h, svg, $, hostOf, getJSON } from './dom.js';
import { getSettings, addHistory } from './store.js';
import { createSearchbox } from './searchbox.js';
import { currentProvider, PROVIDERS } from './providers/index.js';
import { findAnswer } from './answers/index.js';
import { mountLogos, rockBook } from './logo.js';
import * as wiki from './wiki.js';
import { loadEntity, loadWorks, entityId, fetchSubject, worksOnScreen, values, shownProps } from './entity.js';
import { parseQuestion, parseDefinition, resolveSubject, factAnswer, questionsFor, kindsShown, leadSentences, contentTerms, highlight, KINDS, looksLikeQuestion, EXACT_SUBJECT, subjectMatches } from './qa.js';
import { icon } from './icons.js';
import { musicArtist } from './rank.js';
import { recordClick } from './clicks.js';
import { mountTabs } from './page.js';
import { parseQuery, plainQuery, applyOperators } from './operators.js';
import { findSnippet } from './snippet.js';
import { checkSpelling } from './spell.js';
import { imageMatcher } from './imagematch.js';
import { mountTools, pageUrl } from './searchtools.js';
import { mountDorking, elsewhereLinks, siteSearchUrl } from './dorking.js';
import { peopleAsk, paaBlock } from './paa.js';
import './theme.js';
import './keys.js';

const params = new URLSearchParams(location.search);
const query = (params.get('q') ?? '').trim();
if (!query) location.replace('index.html');

const settings = getSettings();
// Which page of results, and the Tools menu's choices (all in the address, so
// a search can be shared or bookmarked exactly).
let page = Math.max(1, Math.min(10, parseInt(params.get('page') ?? '1', 10) || 1));
const tools = {
  time: ['day', 'week', 'month', 'year'].includes(params.get('time')) ? params.get('time') : null,
  lang: params.get('lang') || null,
  sort: params.get('sort') === 'date' ? 'date' : null,
  verbatim: params.get('verbatim') === '1',
};
// Operators ("exact", -word, site: …): the engines get the whole search; the
// words alone are used for ranking and for looking things up.
const parsed = parseQuery(query);
const plain = plainQuery(parsed) || query;
const provider = currentProvider();
// A link to a later page from a provider that has none shows the first page.
if (!provider.supports?.pages) page = 1;
const abort = new AbortController();
const ctx = { signal: abort.signal, query };

document.title = `${query} - ${SITE.name}`;
$('#serp-h1').textContent = `${SITE.name} results for ${query}`;
$('#serp-search').replaceChildren(createSearchbox({ value: query }));
mountTabs(query);
mountTools({ query, tools, settings, supports: provider.supports ?? {} });
if (settings.dorking) mountDorking({ parsed, open: params.get('dork') === '1' });
addHistory(query);
mountLogos().then(() => { if (pending) rockBook($('#toolbar')); });

$('#serp-source-note').replaceChildren('Web results from ',
  h('a', { href: provider.home }, provider.name), `, shown as they arrive. ${SITE.name} uses no AI.`);

/* Loading: the status line says so; the logo's blue book rocks once. --- */

let pending = 0;
const status = $('#serp-status');
const main = $('#main');
const track = async (promise) => {
  if (!pending) rockBook($('#toolbar'));
  pending += 1;
  main.setAttribute('aria-busy', 'true');
  try { return await promise; } finally {
    pending -= 1;
    if (!pending) main.removeAttribute('aria-busy');
  }
};

/* Results ------------------------------------------------------------- */

const list = $('#results');
const moreBox = $('#serp-more');
let all = [];
let shown = 0;

// Opt-in click counts (clicks.js): which web result was chosen, and where it was.
const counted = (e) => {
  const link = e.target.closest?.('.result-title a');
  const item = link?.closest('.result');
  if (!item || (e.type === 'auxclick' && e.button !== 1)) return;
  recordClick(plain, link.href, [...list.querySelectorAll('.result')].indexOf(item) + 1);
};
list.addEventListener('click', counted);
list.addEventListener('auxclick', counted);

const runs = (parts) => parts.map((r) => (r.bold ? h('b', null, r.text) : r.text));

// "https://en.wikipedia.org/wiki/Eiffel_Tower" -> "en.wikipedia.org/wiki/Eiffel_Tower"
function address(url) {
  try {
    const u = new URL(url);
    let path = decodeURI(u.pathname + u.search);
    if (path === '/') path = '';
    const text = u.hostname.replace(/^www\./, '') + path;
    return text.length > 72 ? `${text.slice(0, 70)}…` : text;
  } catch {
    return url;
  }
}

function resultItem(r, index) {
  const target = settings.newTab ? '_blank' : null;
  const rel = settings.newTab ? 'noopener noreferrer' : 'noreferrer';
  const aboutId = `about-${index}`;
  const host = hostOf(r.url);

  const about = h('div', { class: 'result-about raised', id: aboutId, hidden: true },
    h('p', { class: 'result-about-title' }, 'About this result'),
    h('p', null, `Found by ${provider.name}. ${provider.about}`),
    provider.id === 'webshelf'
      ? h('p', null, `${SITE.name} merged the engines’ results, ranked them with open rules and left out known AI content farms. It doesn’t personalise results. `, h('a', { href: 'about.html#ranking' }, 'How results are ranked'))
      : h('p', null, `Results appear in the order ${provider.name} returned them. ${SITE.name} doesn’t personalise them.`),
    h('p', null, `Source: ${r.source} · Site: ${host}`));

  const toggle = h('button', {
    class: 'result-about-btn',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': aboutId,
    'aria-label': `About this result from ${host}`,
  }, 'about');
  toggle.addEventListener('click', () => {
    const open = about.hidden;
    about.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  return h('li', { class: 'result' },
    h('h3', { class: 'result-title' }, h('a', { href: r.url, target, rel }, runs(r.title))),
    h('div', { class: 'result-meta' }, h('cite', { class: 'result-cite' }, address(r.url)), toggle,
      settings.dorking && !parsed.site.length
        ? h('a', { class: 'result-about-btn result-site', href: siteSearchUrl(host, plain), 'aria-label': `Search this site only (${host})` }, 'this site')
        : null),
    r.snippet.length ? h('p', { class: 'result-snippet' }, runs(r.snippet)) : null,
    r.sitelinks?.length ? h('ul', { class: 'sitelinks', 'aria-label': `More from ${host}` }, r.sitelinks.map((l) => h('li', null,
      h('a', { href: l.url, target, rel }, runs(l.title).length ? runs(l.title) : address(l.url)),
      l.snippet.length ? h('p', null, runs(l.snippet)) : null))) : null,
    about);
}

// Sitelinks, as Google showed under a site's home page: when the first result
// is a home page and more results come from the same site, up to six of them
// are listed under it instead of further down.
function addSitelinks() {
  const first = all[0];
  if (!first) return;
  let home;
  try { home = new URL(first.url); } catch { return; }
  if (home.pathname.replace(/\/$/, '') !== '' || home.search) return;
  const host = home.hostname.replace(/^www\./, '');
  const same = all.slice(1).filter((r) => { try { return new URL(r.url).hostname.replace(/^www\./, '') === host; } catch { return false; } });
  if (same.length < 2) return;
  first.sitelinks = same.slice(0, 6).map((r) => ({ ...r, title: shortTitle(r.title, host), snippet: [] }));
  const linked = new Set(first.sitelinks.map((l) => l.url));
  all = all.filter((r) => !linked.has(r.url));
}

// "About Gordon Ramsay - International Chef and Restaurateur | Gordon…" -> "About Gordon Ramsay".
function shortTitle(titleRuns, host) {
  const text = titleRuns.map((r) => r.text).join('').split(/\s[|–—-]\s/)[0].trim();
  return [{ text: text || host, bold: false }];
}

// A featured snippet for a question: the top result's own snippet, quoted with
// its page, when it covers the question's words and no answer box has already
// answered. Extractive only: nothing is rewritten.
async function featuredSnippet() {
  if (found || !looksLikeQuestion(query) || await answerShown) return;
  const terms = contentTerms(plain);
  if (!terms.length) return;
  // A page about a namesake ("The Battle of Hastings (album)") doesn't answer
  // a question that doesn't ask about one.
  const namesake = /\((album|film|song|single|band|novel|book|tv series|miniseries|video game|play|musical|ep|soundtrack|board game)\)/i;
  const top = all.slice(0, 5).filter((r) => {
    const m = namesake.exec(runs(r.title).map((x) => (typeof x === 'string' ? x : x.textContent)).join(''));
    return !m || plain.toLowerCase().includes(m[1].toLowerCase());
  });
  const text = (r) => withoutDate(r.snippet).map((x) => x.text).join('');
  const pick = findSnippet(plain, top.map(text), terms, top.map((r) => r.title.map((x) => x.text).join('')));
  // "Who is …" questions have no short answer to find, and a passage that
  // merely mentions the words isn't an answer either.
  if (!pick || (!pick.answer && /^who\b/i.test(plain))) return;
  const r = top[pick.index];
  // The featured page is the first result, so it isn't listed again below.
  all = all.filter((x) => x !== r);
  const target = settings.newTab ? '_blank' : null;
  const { passage, answer } = pick;
  const marked = (part) => highlight(part, terms).map((x) => (x.bold ? h('b', null, x.text) : x.text));
  const quote = answer
    ? [...marked(passage.slice(0, answer.start)), h('mark', { class: 'snippet-mark' }, passage.slice(answer.start, answer.end)), ...marked(passage.slice(answer.end))]
    : marked(passage);
  const heading = answer ? passage.slice(answer.start, answer.end) : null;
  $('#serp-answer').replaceChildren(h('section', { class: `answer snippetbox raised${heading ? ' has-answer' : ''}`, 'aria-label': heading ? `Answer: ${heading}` : `From ${hostOf(r.url)}` },
    heading ? h('p', { class: 'snippet-answer' }, heading.replace(/^\p{Ll}/u, (c) => c.toUpperCase())) : null,
    h('blockquote', { class: 'snippet-text', cite: r.url }, quote),
    h('p', { class: 'snippet-source' },
      h('cite', { class: 'result-cite' }, address(r.url)),
      h('a', { class: 'snippet-title', href: r.url, target, rel: 'noreferrer' }, runs(r.title))),
    h('p', { class: 'answer-note' }, heading
      ? 'The answer and the passage are quoted from the page’s search snippet, not written by Webshelf. '
      : 'Quoted from the page’s search snippet, not written by Webshelf. ',
      h('a', { href: 'about.html#snippets' }, 'About featured snippets'))));
}

// Engines start some snippets with the page's date ("Jul 27, 2026 · …"); a
// featured snippet quotes the words, not the date.
function withoutDate(snippet) {
  const [first, ...rest] = snippet;
  if (!first) return snippet;
  // "Jul 27, 2026 · …" and "6 days ago · …" alike.
  return [{ ...first, text: first.text.replace(/^(?:[A-Z][a-z]{2} \d{1,2}, \d{4}|\d{1,2} (?:minutes?|hours?|days?|weeks?) ago)\s*[·—-]\s*/, '') }, ...rest];
}

// Newest first; results without a date keep their order, after those with one.
function byDate(results) {
  const time = (r) => { const t = Date.parse(r.date ?? ''); return Number.isFinite(t) ? t : -Infinity; };
  return [...results].map((r, i) => ({ r, i })).sort((a, b) => time(b.r) - time(a.r) || a.i - b.i).map((x) => x.r);
}

// With numbered pages, a page shows all its results; otherwise ten at a time
// behind "More results".
function showMore() {
  const next = provider.supports?.pages ? all.slice(shown) : all.slice(shown, shown + SITE.resultsPerLoad);
  const firstNew = list.querySelectorAll('.result').length;
  list.append(...next.map((r, i) => resultItem(r, shown + i)));
  shown += next.length;
  renderMoreButton();
  placePanel();
  return firstNew;
}

// Numbered pages, as Google had them: Previous, 1 to 10, Next. Later pages
// are offered while this one was full enough to suggest there's more.
function renderMoreButton() {
  if (!provider.supports?.pages) {
    if (shown >= all.length) { moreBox.replaceChildren(); return; }
    const btn = h('button', { class: 'btn', type: 'button' }, 'More results');
    btn.addEventListener('click', () => {
      const first = showMore();
      list.querySelectorAll('.result')[first]?.querySelector('a')?.focus();
    });
    moreBox.replaceChildren(h('div', { class: 'more-row' }, btn));
    return;
  }
  const more = all.length >= 8 && page < 10;
  if (page === 1 && !more) { moreBox.replaceChildren(); return; }
  const last = Math.min(10, more ? Math.max(page + 4, 5) : page);
  const link = (n, label, rel) => (n === page
    ? h('span', { class: 'pager-current', 'aria-current': 'page' }, label)
    : h('a', { class: 'btn btn-small', href: pageUrl(query, tools, n), rel }, label));
  const items = [];
  if (page > 1) items.push(link(page - 1, 'Previous', 'prev'));
  for (let n = 1; n <= last; n++) items.push(link(n, String(n)));
  if (more) items.push(link(page + 1, 'Next', 'next'));
  moreBox.replaceChildren(h('nav', { class: 'pager', 'aria-label': 'Results pages' }, items));
}

// While the search server sleeps, results come from Mwmbl alone. Say so, keep
// asking the server, and offer its full results when they're ready, rather
// than swapping the list under the visitor.
function degradedNotice() {
  const text = h('span', null, 'Showing reduced results while ', SITE.name, '’s search server wakes up (up to a minute). ');
  const notice = h('p', { class: 'serp-notice is-waiting', role: 'status' }, text);
  (async () => {
    for (let tries = 0; tries < 16 && !abort.signal.aborted; tries++) {
      await wait(5000);
      try {
        const res = await fetch(`${BACKEND.searxngUrl}/healthz`, { signal: abort.signal });
        if (!res.ok) continue;
        const fuller = await provider.search(query, searchOptions({ serverTimeout: 10000 }));
        if (!provider.last.server) continue;
        const show = h('button', { class: 'btn btn-small', type: 'button' }, 'Show full results');
        show.addEventListener('click', () => {
          const kept = applyOperators(fuller, parsed).results;
          all = tools.sort === 'date' && provider.supports?.dates ? byDate(kept) : kept;
          list.querySelectorAll('.result').forEach((li) => li.remove());
          shown = 0;
          showMore();
          notice.remove();
          list.querySelector('.result a')?.focus();
        });
        notice.classList.remove('is-waiting');
        text.replaceChildren('The search server is awake: its full results are ready. ');
        notice.append(show);
        return;
      } catch { /* still asleep */ }
    }
    text.replaceChildren('Showing reduced results: ', SITE.name, '’s search server isn’t answering right now.');
  })();
  return notice;
}

function elsewhere() {
  const q = encodeURIComponent(query);
  const el = $('#serp-elsewhere');
  el.hidden = false;
  el.replaceChildren('Try this search on ',
    h('a', { href: `https://duckduckgo.com/?q=${q}`, rel: 'noreferrer' }, 'DuckDuckGo'), ', ',
    h('a', { href: `https://www.mojeek.com/search?q=${q}`, rel: 'noreferrer' }, 'Mojeek'), ', ',
    h('a', { href: `https://marginalia-search.com/search?query=${q}`, rel: 'noreferrer' }, 'Marginalia'), ' or ',
    h('a', { href: `https://en.wikipedia.org/w/index.php?search=${q}`, rel: 'noreferrer' }, 'Wikipedia'), '.');
}

function emptyState() {
  list.replaceChildren();
  return h('div', { class: 'serp-empty' },
    h('p', null, 'No web pages matched ', h('b', null, query), '.'),
    h('p', null, 'You could:'),
    h('ul', null,
      h('li', null, 'check the spelling,'),
      h('li', null, 'use fewer or more general words,'),
      h('li', null, 'or search for a related phrase.')));
}

// Pages after the first come only from the search server; Mwmbl has one page.
function laterPagesAsleep() {
  const retry = h('button', { class: 'btn', type: 'button' }, 'Try again');
  retry.addEventListener('click', () => location.reload());
  return h('div', { class: 'serp-error', role: 'alert' },
    h('p', { class: 'serp-error-title' }, `Page ${page} isn’t available yet.`),
    h('p', null, `Later pages come from ${SITE.name}’s search server, which is waking up. It takes up to a minute; try again shortly.`),
    retry);
}

function errorState(err) {
  const retry = h('button', { class: 'btn', type: 'button' }, 'Try again');
  retry.addEventListener('click', () => location.reload());
  const timedOut = err?.name === 'TimeoutError' || /timed out/i.test(err?.message ?? '');
  return h('div', { class: 'serp-error', role: 'alert' },
    h('p', { class: 'serp-error-title' }, `Web results from ${provider.name} didn’t load.`),
    h('p', null, timedOut
      ? `${provider.name} took too long to answer. It may be busy; trying again usually works.`
      : `${provider.name} didn’t respond. Check your connection and try again. Instant answers and Wikipedia still work.`),
    retry);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let aboveReady = Promise.resolve();

let answerShown = Promise.resolve(false);

// What every web search on this page asks the provider for.
function searchOptions(extra = {}) {
  return {
    ...ctx,
    page,
    time: provider.supports?.timeRange ? tools.time : null,
    language: tools.lang ?? settings.language ?? 'en',
    safe: settings.safeSearch ?? 1,
    rankQuery: plain,
    verbatim: tools.verbatim,
    ...extra,
  };
}

async function searchWeb() {
  // An answer box that understood the search can say what the web results
  // should be about ("EUR to GBP exchange rate" for "50 euro to pounds").
  let webQuery = query;
  if (!tools.verbatim && !parsed.any) {
    try { webQuery = found?.mod.webQuery?.(found.args) || query; } catch { /* keep the search */ }
  }
  // A bare word might be a ticker ("aapl") or just a word ("cat"): only once the
  // market card has actually appeared does the search become "aapl stock".
  if (webQuery !== query && found?.args?.bare) {
    const shown = await Promise.race([answerShown, wait(2000).then(() => false)]);
    if (shown !== true) webQuery = query;
  }
  const results = await provider.search(webQuery, searchOptions({ rankQuery: webQuery === query ? plain : webQuery }));
  if (provider.id === 'webshelf') {
    const { server, left } = provider.last;
    $('#serp-source-note').replaceChildren(
      'Web results from ', server ? 'Bing and ' : '', h('a', { href: 'https://mwmbl.org' }, 'Mwmbl'),
      server ? '' : ` (${SITE.name}’s search server is waking up)`,
      ', ranked by ', h('a', { href: 'about.html#ranking' }, SITE.name),
      left ? `. ${left} result${left === 1 ? '' : 's'} from AI content farms left out` : '',
      `. ${SITE.name} uses no AI.`);
  }
  return results;
}

async function loadResults() {
  const started = performance.now();
  status.replaceChildren('Searching for ', h('b', null, query), '…');
  try {
    all = await track(searchWeb());
  } catch (err) {
    if (err.name === 'AbortError') return;
    status.replaceChildren();
    list.replaceChildren();
    moreBox.replaceChildren(page > 1 && provider.id === 'webshelf' ? laterPagesAsleep() : errorState(err));
    elsewhere();
    return;
  }
  // Time the search itself, not the brief hold below.
  const secs = ((performance.now() - started) / 1000).toFixed(2);
  const filtered = applyOperators(all, parsed);
  all = tools.sort === 'date' && provider.supports?.dates ? byDate(filtered.results) : filtered.results;
  const meta = provider.id === 'webshelf' ? provider.last.meta : null;
  // Hold the list (briefly) until anything that would sit above it is placed,
  // so nothing pushes results down after they've appeared.
  // Topic pages already show their header and photos while waiting, so they
  // can wait a little longer for their carousels. The limit starts once we
  // know whether this is a topic page, with an absolute ceiling of 4 s.
  // A question's answer is the point of the page, so it gets the whole 4 s.
  const limit = factQ || defQ ? wait(4000) : panelKnown.then(() => wait(topicTitle ? 2500 : 1500));
  await Promise.race([aboveReady, limit, wait(4000)]);
  // The engines' spelling correction, if they offered one (placed before the
  // results, so it never pushes them down).
  const correction = meta?.corrections?.find((c) => c.toLowerCase() !== query.toLowerCase());
  if (correction && !$('#serp-spell').childElementCount) spelling(correction);
  const notices = h('div', { class: 'serp-notices' });
  if (filtered.unmet.length) {
    notices.append(h('p', { class: 'serp-notice' }, 'No results matched ',
      filtered.unmet.flatMap((u, i) => [i ? ', ' : '', h('b', null, u)]),
      '. The engines Webshelf’s server asks often ignore operators, so few of their results fit. Search without ', filtered.unmet.length > 1 ? 'them' : 'it',
      ', or run the same search on ', ...elsewhereLinks(query), '.'));
  }
  if (provider.id === 'webshelf' && BACKEND.searxngUrl && !provider.last.server) notices.append(degradedNotice());
  list.before(notices);
  if (!all.length) {
    status.replaceChildren();
    moreBox.replaceChildren(emptyState());
    elsewhere();
    return;
  }
  status.replaceChildren(page > 1 ? `Page ${page} of results for ` : 'Results for ', h('b', null, query),
    page > 1 ? '' : ` · ${all.length.toLocaleString()} found in ${secs} s`);
  list.replaceChildren();
  if (page === 1) {
    addSitelinks();
    await featuredSnippet();
  }
  shown = 0;
  showMore();
  placePending();
  resultsShown();
}

let resultsShown;
const resultsReady = new Promise((resolve) => { resultsShown = resolve; });

/* Instant answer ------------------------------------------------------ */

const found = findAnswer(query);

async function loadAnswer() {
  if (!found && (factQ || defQ)) {
    try {
      const el = await track(factOrDefinition());
      if (!el) return false;
      // Too late to go above results the visitor is already reading. It still
      // counts as answered, so no topic header goes in above them either.
      if (resultsOnScreen) return 'late';
      $('#serp-answer').replaceChildren(el);
      return true;
    } catch {
      return false;
    }
  }
  if (!found) return false;
  const box = $('#serp-answer');
  try {
    const el = await track(Promise.resolve(found.mod.render(found.args, ctx)));
    if (!el) return false;
    box.replaceChildren(el);
    return true;
  } catch (err) {
    if (err.name !== 'AbortError') {
      box.replaceChildren(h('p', { class: 'answer-error raised' },
        'This answer couldn’t load because its data source didn’t respond. The results below are unaffected.'));
    }
    return false;
  }
}

/* Answers from Wikidata and Wikipedia (no AI) ---------------------------- */

const factQ = found ? null : parseQuestion(query);
const defQ = found || factQ ? null : parseDefinition(query);
const plainName = (title) => title.replace(/\s*\(.*\)$/, '');
const isHumanEntity = (entity) => values(entity?.claims ?? {}, 'P31').some((v) => v?.value?.id === 'Q5');
const wikidataUrl = (entity) => `https://www.wikidata.org/wiki/${entity.id}`;
const wikipediaUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// Wikipedia's opening sentences, fetched once per article.
const leads = new Map();
const leadOf = (title) => {
  if (!leads.has(title)) leads.set(title, leadSentences(title, { ...ctx, count: 2 }).catch(() => null));
  return leads.get(title);
};

// How a question names its subject: "the Eiffel Tower", "the telephone",
// "Gordon Ramsay". The article goes in only when Wikipedia's own opening uses one.
function spokenName(subj, lead) {
  const name = plainName(subj.title);
  if (isHumanEntity(subj.entity) || !lead) return name;
  if (lead.startsWith(`The ${name}`)) return `the ${name}`;
  const m = lead.match(/^(?:A|An|The) ([\w-]+)/);
  return m && m[1].toLowerCase() === name.toLowerCase() ? `the ${name.toLowerCase()}` : name;
}

const askedAs = (kind, spoken) => KINDS[kind][1](spoken).replace(/^\w/, (c) => c.toUpperCase());

function factBox(name, subj, kind, a, spoken) {
  return h('section', { class: 'answer factbox raised', 'aria-label': askedAs(kind, spoken) },
    h('p', { class: 'factbox-path' }, h('a', { href: searchUrl(name) }, name), ` › ${KINDS[kind][0]}`),
    h('p', { class: `factbox-answer${a.answer.length > 28 ? ' is-long' : ''}` }, a.answer),
    a.note ? h('p', { class: 'factbox-note' }, a.note) : '',
    h('p', { class: 'answer-source' }, 'From ', h('a', { href: wikidataUrl(subj.entity), rel: 'noreferrer' }, 'Wikidata'),
      ' · ', h('a', { href: wikipediaUrl(subj.title), rel: 'noreferrer' }, `${name} on Wikipedia`)));
}

function quoteBox(subj, lead, askedAbout) {
  const runs = highlight(lead, contentTerms(askedAbout));
  return h('section', { class: 'answer quotebox raised', 'aria-label': `About ${plainName(subj.title)}` },
    h('blockquote', { class: 'quote-text', cite: wikipediaUrl(subj.title) }, runs.map((r) => (r.bold ? h('b', null, r.text) : r.text))),
    h('p', { class: 'answer-source' }, 'Quoted from ', h('a', { href: wikipediaUrl(subj.title), rel: 'noreferrer' }, `${plainName(subj.title)} on Wikipedia`)));
}

// "Questions about X": only questions Wikidata or Wikipedia can answer, and
// none the page already answers. Each answer loads when its question is opened.
async function questionsBlock(subj, exclude) {
  const name = plainName(subj.title);
  const human = isHumanEntity(subj.entity);
  const lead = await leadOf(subj.title);
  const asked = spokenName(subj, lead);
  const first = human ? 'whois' : 'whatis';
  const skip = [].concat(exclude ?? []);
  const kinds = [...(skip.includes(first) ? [] : [first]), ...questionsFor(subj.entity, { exclude: skip, isHuman: human })].slice(0, 4);
  if (kinds.length < 2) return null;
  const id = 'questions-title';
  return h('section', { class: 'questions', 'aria-labelledby': id },
    h('h2', { class: 'questions-title', id }, `Questions about ${asked}`),
    h('div', { class: 'questions-list' }, kinds.map((kind) => {
      const question = askedAs(kind, asked);
      const body = h('div', { class: 'question-answer' }, h('p', { class: 'answer-note' }, 'Loading…'));
      const row = h('details', { class: 'question' },
        h('summary', null, h('span', null, question), svg(icon('expandMore'))),
        body);
      const searchIt = () => h('a', { class: 'question-search', href: searchUrl(question.replace(/\?$/, '')) }, 'Search this question');
      row.addEventListener('toggle', async () => {
        if (!row.open || row.dataset.loaded) return;
        row.dataset.loaded = '1';
        try {
          if (kind === 'whois' || kind === 'whatis') {
            body.replaceChildren(
              lead ? h('blockquote', { class: 'quote-text', cite: wikipediaUrl(subj.title) }, lead) : h('p', null, 'No answer found.'),
              h('p', { class: 'answer-source' }, 'Quoted from ', h('a', { href: wikipediaUrl(subj.title), rel: 'noreferrer' }, `${name} on Wikipedia`), ' · ', searchIt()));
          } else {
            const a = await factAnswer(kind, subj.entity, ctx);
            body.replaceChildren(
              h('p', { class: 'question-fact' }, a ? a.answer : 'Wikidata has no current answer for this.'),
              a?.note ? h('p', { class: 'factbox-note' }, a.note) : '',
              h('p', { class: 'answer-source' }, 'From ', h('a', { href: wikidataUrl(subj.entity), rel: 'noreferrer' }, 'Wikidata'), ' · ', searchIt()));
          }
        } catch {
          body.replaceChildren(h('p', { class: 'answer-note' }, 'This answer couldn’t load. Try again in a moment.'));
          delete row.dataset.loaded;
        }
      });
      return row;
    })));
}

let questionsPlaced = false;
async function queueQuestions(subj, exclude) {
  const block = await questionsBlock(subj, exclude).catch(() => null);
  if (block) { questionsPlaced = true; placeInList(h('li', { class: 'result-questions' }, block), 2); }
}

// People also ask: questions people search for about this search, each
// answered by quoting the top result for it (see paa.js).
async function queuePeopleAsk() {
  const questions = await peopleAsk(plain, ctx).catch(() => []);
  const block = paaBlock(questions, { signal: abort.signal, target: target(), language: tools.lang ?? settings.language ?? 'en', safe: settings.safeSearch ?? 1 });
  if (block) { questionsPlaced = true; placeInList(h('li', { class: 'result-questions' }, block), 2); }
}

async function factOrDefinition() {
  const asked = factQ ?? defQ;
  const subj = await resolveSubject(asked.subject, ctx);
  if (!subj) return null;
  const name = plainName(subj.title);
  if (factQ) {
    if (EXACT_SUBJECT.has(factQ.kind) && !subjectMatches(factQ.subject, subj)) return null;
    const [a, lead] = await Promise.all([factAnswer(factQ.kind, subj.entity, ctx), leadOf(subj.title)]);
    if (!a) return null;
    await queueQuestions(subj, [factQ.kind]);
    return factBox(name, subj, factQ.kind, a, spokenName(subj, lead));
  }
  // A definition is quoted only from the article that is the thing asked about.
  const wanted = contentTerms(defQ.subject);
  if (!contentTerms(name).every((t) => wanted.includes(t))) return null;
  const lead = await leadOf(subj.title);
  if (!lead) return null;
  await queueQuestions(subj, [isHumanEntity(subj.entity) ? 'whois' : 'whatis']);
  return quoteBox(subj, lead, defQ.subject);
}

/* Images -------------------------------------------------------------- */

// Images like Google's image row: Bing Images through our server, each opening
// the Images tab; Wikimedia Commons (linked to each file) if the server is asleep.
async function serverImages() {
  if (!BACKEND.searxngUrl) return [];
  const data = await getJSON(`${BACKEND.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=images&language=en&safesearch=1`, { ...ctx, timeout: 4000 });
  const size = (text) => String(text ?? '').match(/(\d+)\s*[x××]\s*(\d+)/);
  const about = imageMatcher(query);
  return (data.results ?? []).filter((r) => (r.thumbnail_src || r.img_src) && about({ title: r.title, page: r.url, full: r.img_src })).slice(0, 12).map((r) => {
    const dims = size(r.resolution);
    return { title: r.title || query, thumb: r.thumbnail_src || r.img_src, page: searchUrl(query, 'images.html'), w: dims ? Number(dims[1]) : null, h: dims ? Number(dims[2]) : null, own: true };
  });
}

async function loadImages() {
  let images = await imagesEarly;
  if (images.length < 3) {
    try { images = await wiki.commonsImages(query, ctx); } catch { return; }
  }
  if (images.length < 3) return;
  const strip = $('#serp-images');
  const slot = h('li', { class: 'result-images' }, strip);
  strip.replaceChildren(
    h('div', { class: 'image-strip-list' }, images.map((img) => h('a', { href: img.page, target: img.own ? null : target(), rel: 'noreferrer', title: img.title },
      h('img', { src: img.thumb, alt: img.title, loading: 'lazy', referrerpolicy: 'no-referrer', height: '110',
        width: img.w && img.h ? String(Math.min(220, Math.round((img.w * 110) / img.h))) : null })))),
    h('p', { class: 'image-strip-more' },
      images[0].own
        ? h('a', { href: searchUrl(query, 'images.html') }, `More images for ${query}`)
        : h('a', { href: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(query)}&title=Special:MediaSearch&type=image`, rel: 'noreferrer' }, 'More images on Wikimedia Commons')));
  strip.hidden = false;
  placeInList(slot, 3);
}

/* Wikipedia: spelling, related searches ------------------------------- */

// The words of a suggested spelling, with the changed ones in bold italics.
function respelled(suggestion, original) {
  const typed = new Set(original.toLowerCase().split(/\s+/));
  return suggestion.split(/(\s+)/).map((w) => (!w.trim() || typed.has(w.toLowerCase()) ? w : h('b', null, h('i', null, w))));
}

function spelling(suggestion) {
  if (!suggestion || suggestion.toLowerCase() === query.toLowerCase()) return;
  $('#serp-spell').replaceChildren(h('p', { class: 'spell' },
    h('span', { class: 'spell-label' }, 'Did you mean: '),
    h('a', { href: pageUrl(suggestion, tools, 1) }, respelled(suggestion, query)),
    h('span', { class: 'spell-label' }, '?')));
}

// After an automatic correction: what was searched, and the way back.
function corrected(original) {
  $('#serp-spell').replaceChildren(h('p', { class: 'spell' },
    h('span', { class: 'spell-label' }, 'Showing results for '),
    h('a', { href: pageUrl(query, tools, 1) }, respelled(query, original))),
  h('p', { class: 'spell spell-instead' },
    h('span', { class: 'spell-label' }, 'Search instead for '),
    h('a', { href: `${pageUrl(original, tools, 1)}&spell=0` }, original)));
}

async function related() {
  if (!getSettings().suggestions) return;
  await resultsReady;
  const lower = query.toLowerCase();
  // The engines' related searches (Bing's, through the server) when there are
  // some; otherwise Wikipedia titles that extend the search.
  const fromEngines = (provider.id === 'webshelf' ? provider.last.meta?.suggestions : []) ?? [];
  let items = [...new Set(fromEngines.map((t) => t.toLowerCase()))].filter((t) => t !== lower).slice(0, 8);
  if (items.length < 2) {
    const titles = await wiki.completions(query, { limit: 10, signal: abort.signal });
    // Wikipedia's prefix search ignores spaces ("roll a die" finds "rolla"), so keep true completions only.
    items = [...new Set(titles.map((t) => t.toLowerCase()))].filter((t) => t !== lower && t.startsWith(`${lower} `)).slice(0, 8);
  }
  if (items.length < 2) return;
  // Bold what each suggestion adds to the search, as Google did.
  const words = new Set(lower.split(/\s+/));
  const section = $('#serp-related');
  section.querySelector('.related-list').replaceChildren(...items.map((t) =>
    h('li', null, h('a', { href: searchUrl(t) }, t.split(/(\s+)/).map((w) => (words.has(w) || !w.trim() ? w : h('b', null, w)))))));
  section.hidden = false;
}

/* Topic: a header with photos and quick facts, the About panel, works --
   Frames go in as soon as a topic is known and keep their size while they
   fill, so nothing ever pushes results down. */

let kpPanel = null;
let topicTitle = null;
const narrow = window.matchMedia('(max-width: 1099px)');
function target() { return settings.newTab ? '_blank' : null; }

function entityShell(title) {
  const section = $('#serp-entity');
  const desc = h('p', { class: 'entity-desc' });
  const hero = h('div', { class: 'entity-hero', role: 'group', 'aria-label': `Photos and quick facts about ${title}` });
  section.replaceChildren(h('h2', { class: 'entity-title', id: 'entity-title' }, title), desc, hero);
  section.hidden = false;
  document.body.classList.add('has-entity');
  return { desc, hero };
}

function panelShell(title) {
  const heading = h('h2', { class: 'kp-title', id: 'kp-title' }, 'About');
  // On phones the closed card shows the first two facts; the header above already names the topic.
  const summary = h('div', { class: 'kp-summary' });
  // The closed phone card still names its source, on one fixed-height line.
  const credit = h('p', { class: 'kp-credit' }, 'From Wikipedia');
  const details = h('div', { class: 'kp-details', id: 'kp-details' });
  const toggle = h('button', { class: 'btn btn-small kp-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'kp-details' }, `More about ${title}`);
  kpPanel = h('section', { class: 'kp raised no-media', 'aria-labelledby': 'kp-title' },
    h('div', { class: 'kp-head' }, h('div', { class: 'kp-heading' }, heading, summary, credit)),
    toggle,
    details);
  toggle.addEventListener('click', () => {
    const open = !kpPanel.classList.contains('is-open');
    kpPanel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? `Less about ${title}` : `More about ${title}`;
  });
  placePanel();
  return { summary, details };
}

function removeTopic() {
  kpPanel?.closest('.result-kp')?.remove();
  kpPanel?.remove();
  kpPanel = null;
  $('#serp-entity').hidden = true;
  document.body.classList.remove('has-entity');
}

// Wide screens show the panel at the right; narrow ones put it after the first result.
function placePanel() {
  if (!kpPanel) return;
  const rhs = $('#serp-rhs');
  if (!narrow.matches) {
    if (kpPanel.parentElement !== rhs) {
      kpPanel.closest('.result-kp')?.remove();
      rhs.replaceChildren(kpPanel);
    }
    return;
  }
  const slot = $('.result-kp') ?? h('li', { class: 'result-kp' });
  if (kpPanel.parentElement !== slot) slot.replaceChildren(kpPanel);
  const first = list.querySelector('.result');
  if (first) first.after(slot);
  else list.prepend(slot);
  rhs.replaceChildren();
}
narrow.addEventListener('change', placePanel);

const factValue = (row) => row.parts.map((p, i) => [i ? ', ' : '', p.link ? h('a', { href: searchUrl(p.text) }, p.text) : p.text]);

function heroPhoto(src, href, label) {
  const img = h('img', { src, alt: label, loading: 'lazy', referrerpolicy: 'no-referrer' });
  const cell = h('a', { class: 'hero-photo', href, target: target(), rel: 'noreferrer' }, img);
  img.addEventListener('error', () => cell.remove());
  return cell;
}

function heroTile(tile) {
  return h('div', { class: 'hero-tile raised' },
    h('p', { class: 'hero-tile-label' }, tile.label),
    h('p', { class: 'hero-tile-value' }, tile.value),
    tile.note ? h('p', { class: 'hero-tile-note' }, tile.note) : null);
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
}

async function fillTopic(title, ent, panel, subject, works = Promise.resolve([])) {
  const [sum, data, images] = await Promise.all([
    wiki.summary(title, ctx),
    loadEntity(title, { ...ctx, subject }).catch(() => null),
    wiki.commonsImages(title, { ...ctx, limit: 6 }).catch(() => []),
  ]);
  if (!sum) { removeTopic(); return null; }
  // "Known for": a person's three most-linked works of their main kind (the
  // kind they have most of: films for an actor, books for a writer), from
  // Wikidata, which lists works by how many pages link to them.
  if (data?.isHuman) {
    const groups = await Promise.race([works, wait(1500).then(() => [])]);
    const main = [...groups].sort((a, b) => b.items.length - a.items.length)[0];
    if (main?.items.length >= 3) data.rows.splice(1, 0, { label: 'Known for', parts: main.items.slice(0, 3).map((w) => ({ text: w.title, link: true })) });
  }
  const page = sum.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  const commons = `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(sum.title)}&title=Special:MediaSearch&type=image`;

  // Header: description, then up to three photos and two quick-fact tiles.
  ent.desc.textContent = sum.description ?? '';
  const thumb = sum.thumbnail?.source;
  const drawing = thumb && /\.svg|logo/i.test(thumb);
  const photos = [...(data?.photos ?? [])];
  if (!photos.length && thumb && !drawing) photos.push(thumb.replace(/\/330px-/, '/500px-'));
  // Photographs only (no signatures, logos, maps), and never the same file twice.
  // Compare files by stem, so "Name (cropped).jpg" and "Name.jpg" count as one photo.
  const fileOf = (url) => decodeURIComponent(url).replace(/^.*(?:FilePath\/|\/\d+px-)/, '').replace(/[?#].*$/, '')
    .replace(/_/g, ' ').toLowerCase().replace(/\.[a-z]+$/, '').replace(/\(?\bcrop(ped)?\b\)?/g, '').replace(/[\d\s().,-]+$/g, '').trim();
  const seenFiles = new Set(photos.map(fileOf));
  // Commons is searched by the title alone, so a file has to be named for
  // the topic (every word of its title), and a creative work takes no Commons
  // photos at all: "Inception" also finds a Peugeot concept car of that name.
  const isWork = /\b(?:film|series|sitcom|miniseries|album|single|song|novel|book|video game|musical|opera|play|painting|franchise|episode|soundtrack)\b/i.test(sum.description ?? '');
  const titleWords = (plainName(sum.title).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2);
  const namedFor = (img) => { const t = img.title.toLowerCase(); return titleWords.every((w) => t.includes(w)); };
  for (const img of isWork ? [] : images) {
    if (!namedFor(img)) continue;
    if (photos.length >= 3) break;
    if (img.mime !== 'image/jpeg' || /signature|autograph|logo|map|flag|coat of arms/i.test(img.title)) continue;
    if (seenFiles.has(fileOf(img.thumb))) continue;
    seenFiles.add(fileOf(img.thumb));
    // Commons serves 500px as a standard size; 250px looks soft in the header.
    // (Only for originals at least that wide: Commons won't scale up.)
    photos.push(img.originalWidth >= 500 ? img.thumb.replace(/\/250px-/, '/500px-') : img.thumb);
  }
  const tiles = data?.tiles ?? [];
  if (!photos.length && !tiles.length) {
    ent.hero.remove();
  } else {
    ent.hero.classList.add(`has-${Math.min(photos.length, 3)}-photos`, `has-${tiles.length}-tiles`);
    ent.hero.replaceChildren(
      ...photos.slice(0, 3).map((src, i) => heroPhoto(src, commons, i === 0 ? `Photo of ${sum.title}` : `${sum.title}: more images`)),
      tiles.length ? h('div', { class: 'hero-tiles' }, tiles.map(heroTile)) : '');
  }

  // About panel.
  panel.summary.replaceChildren(...(data?.rows ?? []).slice(0, 2).map((row) =>
    h('p', null, h('b', null, `${row.label}: `), row.parts.map((p) => p.text).join(', '))));
  const website = data?.website;
  panel.details.replaceChildren(
    website ? h('p', { class: 'kp-website' }, h('a', { href: website, rel: 'noreferrer' }, hostOf(website))) : '',
    h('p', { class: 'kp-extract' }, sum.extract, ' ', h('a', { href: page, rel: 'noreferrer' }, 'Wikipedia')),
    data?.rows.length ? h('table', { class: 'kp-table' }, h('tbody', null, data.rows.map((row) =>
      h('tr', null, h('th', { scope: 'row' }, row.label), h('td', null, factValue(row)))))) : '',
    data?.profiles.length ? h('section', { class: 'kp-block', 'aria-labelledby': 'kp-profiles' },
      h('h3', { class: 'kp-block-title', id: 'kp-profiles' }, 'Profiles'),
      h('ul', { class: 'kp-profiles' }, data.profiles.map((p) => h('li', null,
        h('a', { class: 'btn btn-small', href: p.url, rel: 'noreferrer', target: target() }, p.name))))) : '',
    data?.ratings?.length ? h('section', { class: 'kp-block', 'aria-labelledby': 'kp-ratings' },
      h('h3', { class: 'kp-block-title', id: 'kp-ratings' }, 'Ratings'),
      h('ul', { class: 'kp-ratings' }, data.ratings.map((r) => h('li', null, h('span', { class: 'kp-rating-value num' }, r.value), h('span', { class: 'kp-rating-by' }, r.by))))) : '',
    data?.cast?.length ? h('section', { class: 'kp-block', 'aria-labelledby': 'kp-cast' },
      h('h3', { class: 'kp-block-title', id: 'kp-cast' }, 'Cast'),
      h('ul', { class: 'kp-people kp-cast' }, data.cast.slice(0, 8).map((p) => h('li', null,
        h('a', { href: searchUrl(p.name) },
          h('span', { class: 'kp-person-photo' }, p.image
            ? h('img', { src: p.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
            : h('span', { class: 'kp-person-initial', 'aria-hidden': 'true' }, initials(p.name))),
          h('span', { class: 'kp-person-name' }, p.name)))))) : '',
    data?.people.length ? h('section', { class: 'kp-block', 'aria-labelledby': 'kp-people' },
      h('h3', { class: 'kp-block-title', id: 'kp-people' }, 'People also search for'),
      h('ul', { class: 'kp-people' }, [...data.people].sort((a, b) => Boolean(b.image) - Boolean(a.image)).slice(0, 4).map((p) => h('li', null,
        h('a', { href: searchUrl(p.name) },
          h('span', { class: 'kp-person-photo' }, p.image
            ? h('img', { src: p.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
            : h('span', { class: 'kp-person-initial', 'aria-hidden': 'true' }, initials(p.name))),
          h('span', { class: 'kp-person-name' }, p.name)))))) : '',
    h('p', { class: 'kp-source' }, 'From Wikipedia (CC BY-SA), Wikidata (CC0) and Wikimedia Commons'));
  return data;
}

// Works (TV shows, books, films, albums) as carousels after the third result.
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Free images of a show are often its logo, not a poster. Anything that isn't
// poster-shaped is fitted inside the frame instead of being cropped to it.
function coverImage(src) {
  const img = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('load', () => {
    if (img.naturalWidth / img.naturalHeight > 0.8) img.parentElement?.classList.add('is-fitted');
  }, { once: true });
  return img;
}

function worksGroup(g) {
  const label = `works-${g.id}`;
  // With no covers at all, a plain list reads better than a row of empty boxes.
  if (g.items.every((w) => !w.image)) {
    return h('section', { class: 'carousel', 'aria-labelledby': label },
      h('h2', { class: 'carousel-title', id: label }, g.heading),
      h('ul', { class: 'carousel-text' }, g.items.slice(0, 6).map((w) => h('li', null,
        h('a', { href: searchUrl(w.title) }, w.title), w.year ? h('span', { class: 'carousel-year' }, ` ${w.year}`) : ''))),
      g.items.length > 6 ? h('p', { class: 'carousel-more' }, h('a', { href: searchUrl(`${topicTitle} ${g.heading.toLowerCase()}`) }, `More ${g.heading.toLowerCase()}`)) : '');
  }
  const list = h('ul', { class: 'carousel-list' }, g.items.map((w) => h('li', { class: 'carousel-item' },
    h('a', { href: searchUrl(w.title), 'aria-label': w.image ? null : w.title },
      w.image
        ? [h('span', { class: 'carousel-cover' }, coverImage(w.image)),
          h('span', { class: 'carousel-name' }, w.title)]
        : h('span', { class: 'carousel-cover is-text' }, h('span', { class: 'carousel-cover-title' }, w.title),
          w.year ? h('span', { class: 'carousel-cover-year' }, w.year) : '')),
    w.image && w.year ? h('span', { class: 'carousel-year' }, w.year) : '')));
  const prev = h('button', { class: 'btn carousel-nav', type: 'button', 'aria-label': `Previous ${g.heading.toLowerCase()}` }, svg(icon('chevronLeft')));
  const next = h('button', { class: 'btn carousel-nav', type: 'button', 'aria-label': `More ${g.heading.toLowerCase()}` }, svg(icon('chevronRight')));
  const update = () => {
    prev.disabled = list.scrollLeft <= 2;
    next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
  };
  const page = (dir) => list.scrollBy({ left: dir * list.clientWidth * 0.8, behavior: reduceMotion() ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  list.addEventListener('scroll', update, { passive: true });
  list.addEventListener('load', update, true);
  new ResizeObserver(update).observe(list);
  return h('section', { class: 'carousel', 'aria-labelledby': label },
    h('div', { class: 'carousel-head' },
      h('h2', { class: 'carousel-title', id: label }, g.heading),
      h('div', { class: 'carousel-navs' }, prev, next)),
    list,
    // TVmaze's licence asks for a credit wherever its posters appear.
    g.items.some((w) => w.image?.startsWith('https://static.tvmaze.com/'))
      ? h('p', { class: 'carousel-credit' }, 'Posters from ', h('a', { href: 'https://www.tvmaze.com', rel: 'noreferrer' }, 'TVmaze'))
      : '');
}

const pendingBlocks = [];
let resultsOnScreen = false;

// Extra blocks (questions after result 2, carousels after result 3) go in with
// the results when they're ready in time. Afterwards they only go where the
// spot is below the screen (after their result, or else after the last one
// shown), so nothing the visitor can see ever moves.
function placeInList(slot, after) {
  if (!resultsOnScreen) { pendingBlocks.push([slot, after]); return; }
  const results = list.querySelectorAll('.result');
  const below = (el) => el && el.getBoundingClientRect().bottom >= window.innerHeight;
  const anchor = [results[after - 1], results[results.length - 1]].find(below);
  if (anchor) anchor.after(slot);
}

// Before the first result, or after result `after`.
function placeAt(slot, after) {
  const results = list.querySelectorAll('.result');
  if (after === 0 && results[0]) { results[0].before(slot); return; }
  const anchor = results[after - 1] ?? results[results.length - 1];
  if (anchor) anchor.after(slot);
}

function placePending() {
  resultsOnScreen = true;
  for (const [slot, after] of pendingBlocks) placeAt(slot, after);
  pendingBlocks.length = 0;
}

// "tom hanks movies", "sally rooney books", "taylor swift albums": the
// person's works of that kind lead the page, the person's panel beside them.
const WORKS_ASKS = [
  [/^(.+?)(?:'s|’s)? (?:movies|films|filmography)$/i, ['film', 'tv']],
  [/^(.+?)(?:'s|’s)? (?:tv shows|tv series|shows)$/i, ['tv']],
  [/^(.+?)(?:'s|’s)? (?:books|novels|bibliography)$/i, ['books']],
  [/^(.+?)(?:'s|’s)? (?:albums|discography)$/i, ['albums']],
  [/^(.+?)(?:'s|’s)? songs$/i, ['songs']],
];
const worksAsk = (() => {
  for (const [pattern, kinds] of WORKS_ASKS) {
    const m = pattern.exec(query.trim());
    if (m) return { subject: m[1], kinds };
  }
  return null;
})();

async function loadWorksFor(worksPromise, onScreenPromise) {
  let [groups, onScreenWork] = await Promise.all([worksPromise, onScreenPromise]);
  if (!topicTitle) return;
  const asked = (g) => worksAsk?.kinds.includes(g.id);
  if (!onScreenWork) groups = groups.filter((g) => asked(g) || (g.id !== 'tv' && g.id !== 'film'));
  // In the order asked: films before TV for "movies".
  const first = groups.filter(asked).sort((a, b) => worksAsk.kinds.indexOf(a.id) - worksAsk.kinds.indexOf(b.id));
  const rest = groups.filter((g) => !asked(g)).map((g) => ({ ...g, items: g.items.slice(0, 12) }));
  if (first.length) placeInList(h('li', { class: 'result-works is-asked' }, first.map(worksGroup)), 0);
  if (rest.length) placeInList(h('li', { class: 'result-works' }, rest.map(worksGroup)), 3);
}

let panelDecided;
const panelKnown = new Promise((resolve) => { panelDecided = resolve; });
let worksDecided;
const worksKnown = new Promise((resolve) => { worksDecided = resolve; });
let imagesDecided;
const imagesKnown = new Promise((resolve) => { imagesDecided = resolve; });
// The image row's request starts with the page, so it's usually ready with the results.
let imagesEarly = Promise.resolve([]);
let questionsDecided;
const questionsKnown = new Promise((resolve) => { questionsDecided = resolve; });

async function loadWiki(answering) {
  let info;
  try {
    info = await track(wiki.lookup(worksAsk?.subject ?? query, ctx));
  } catch {
    panelDecided();
    worksDecided();
    questionsDecided();
    return;
  }
  const title = wiki.panelTitle(worksAsk?.subject ?? query, info.hits);
  // Wikipedia suggests respellings even for correct queries ("photo synthesis"),
  // so only offer one when none of its top articles shares a word with the search.
  const typed = contentTerms(query);
  const someMatch = info.hits.some((hit) => contentTerms(hit.title).some((t) => typed.includes(t)));
  if (!title && !someMatch && !$('#serp-spell').childElementCount) spelling(info.suggestion);
  // A topic would compete with an instant answer, so only one of them shows.
  if (!(title && !(await answering))) {
    worksDecided();
    // No topic page: "People also ask", unless an answer box already brought its own questions.
    if (!found && !questionsPlaced && !tools.verbatim) queuePeopleAsk().finally(questionsDecided);
    else questionsDecided();
  }
  if (title && !(await answering)) {
    topicTitle = title;
    const ent = entityShell(title);
    const panel = panelShell(title);
    panelDecided();
    // The subject's record and its works start straight away from the
    // lookup's Wikidata id, so carousels are usually ready with the results.
    const qid = info.ids?.[title] ?? null;
    const subject = fetchSubject({ qid, title }, ctx).catch(() => null);
    const works = (qid ? Promise.resolve(qid) : entityId(title, ctx))
      .then((id) => (id ? loadWorks(id, { ...ctx, onScreen: true, limit: worksAsk ? 40 : 12 }) : [])).catch(() => []);
    subject.then((entity) => (entity ? queueQuestions({ title, entity }, [...kindsShown(entity, shownProps(entity)), 'whois', 'whatis']) : null)).finally(questionsDecided);
    const filling = track(fillTopic(title, ent, panel, subject, works)).catch(() => { removeTopic(); return null; });
    await loadWorksFor(works, subject.then(worksOnScreen));
    worksDecided();
    await filling;
  } else {
    // No Wikipedia article: a band or artist MusicBrainz knows by that exact name
    // still gets a panel, with where to listen.
    const artist = !looksLikeQuestion(query) && !(await answering)
      ? await Promise.race([musicArtist(query, ctx), wait(2500).then(() => null)])
      : null;
    if (artist && artist.links.length) {
      topicTitle = artist.name;
      fillArtist(artist, panelShell(artist.name));
    }
    panelDecided();
  }
}

// Which service a link belongs to, for the Listen and Profiles buttons.
const SERVICES = [
  ['open.spotify.com', 'Spotify', 'listen'], ['music.apple.com', 'Apple Music', 'listen'], ['music.youtube.com', 'YouTube Music', 'listen'],
  ['youtube.com', 'YouTube', 'listen'], ['deezer.com', 'Deezer', 'listen'], ['tidal.com', 'Tidal', 'listen'],
  ['soundcloud.com', 'SoundCloud', 'listen'], ['bandcamp.com', 'Bandcamp', 'listen'],
  ['instagram.com', 'Instagram', 'profile'], ['twitter.com', 'X', 'profile'], ['x.com', 'X', 'profile'],
  ['tiktok.com', 'TikTok', 'profile'], ['facebook.com', 'Facebook', 'profile'], ['threads.net', 'Threads', 'profile'],
];

function fillArtist(artist, { summary, details }) {
  const seen = new Set();
  const linked = artist.links.map((l) => {
    const host = hostOf(l.url);
    const service = SERVICES.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
    if (!service || seen.has(service[1])) return null;
    seen.add(service[1]);
    return { name: service[1], kind: service[2], url: l.url };
  }).filter(Boolean);
  const kind = { Group: 'Band', Person: 'Musician', Orchestra: 'Orchestra', Choir: 'Choir' }[artist.type] ?? 'Music artist';
  const line = [kind, artist.country, artist.began && `since ${artist.began.slice(0, 4)}`].filter(Boolean).join(' · ');
  const buttons = (items) => h('ul', { class: 'kp-profiles' }, items.map((p) => h('li', null,
    h('a', { class: 'btn btn-small', href: p.url, rel: 'noreferrer', target: target() }, p.name))));
  const block = (id, title, items) => (items.length ? h('section', { class: 'kp-block', 'aria-labelledby': id },
    h('h3', { class: 'kp-block-title', id }, title), buttons(items)) : '');
  const listen = linked.filter((l) => l.kind === 'listen');
  const profiles = linked.filter((l) => l.kind === 'profile');
  const website = artist.official[0];
  // No topic header sits above this panel, so it carries the name itself.
  kpPanel.querySelector('.kp-title').textContent = artist.name;
  kpPanel.querySelector('.kp-credit').textContent = 'From MusicBrainz';
  summary.replaceChildren(h('p', null, line));
  details.replaceChildren(
    h('p', { class: 'kp-subtitle' }, line),
    artist.tags.length ? h('p', { class: 'kp-extract' }, `Genres: ${artist.tags.join(', ')}`) : '',
    website ? h('p', { class: 'kp-website' }, h('a', { href: website, rel: 'noreferrer' }, hostOf(website))) : '',
    block('kp-listen', 'Listen', listen),
    block('kp-profiles', 'Profiles', profiles),
    h('p', { class: 'kp-source' }, 'From ', h('a', { href: `https://musicbrainz.org/artist/${artist.id}`, rel: 'noreferrer' }, 'MusicBrainz'), ' (CC0), the open music database'));
}

/* Go ------------------------------------------------------------------ */

if (query && page > 1) {
  // Answers, topic panels, questions and images belong to the first page.
  panelDecided(); worksDecided(); questionsDecided(); imagesDecided();
  loadResults();
  related().catch(() => {});
} else if (query) {
  // Spelling: a clear misspelling reloads the page with the corrected search
  // (before any results show); a possible one is offered as "Did you mean".
  const original = params.get('from');
  if (original) corrected(original);
  else if (params.get('spell') !== '0' && !found && !parsed.any && !tools.verbatim) {
    checkSpelling(query, ctx).then((fix) => {
      if (!fix) return;
      if (fix.auto && !resultsOnScreen) location.replace(`${pageUrl(fix.text, tools, 1)}&from=${encodeURIComponent(query)}`);
      else spelling(fix.text);
    }).catch(() => {});
  }
  // MusicBrainz is slow (about two seconds for a band), so its lookup starts
  // now, alongside everything else; the ranking and band panel reuse it.
  if (query.trim().split(/\s+/).length <= 5 && !looksLikeQuestion(query)) musicArtist(query, ctx);
  const answering = loadAnswer();
  answerShown = answering;
  loadWiki(answering);
  // Anything that sits above the results (an instant answer, the topic header)
  // is placed before the results show.
  // On topic pages the works carousels join them, so they go in with the results.
  if (!looksLikeQuestion(query)) imagesEarly = serverImages().catch(() => []);
  aboveReady = Promise.allSettled([answering, panelKnown, worksKnown, questionsKnown, imagesKnown]);
  loadResults();
  // Images rarely answer a question, so the strip is for plain searches only.
  Promise.all([answering, panelKnown]).then(([answered]) => {
    if (!answered && !topicTitle && !looksLikeQuestion(query)) loadImages().finally(imagesDecided);
    else imagesDecided();
  });
  related().catch(() => {});
}

window.addEventListener('pagehide', () => abort.abort());
