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
import { parseQuestion, parseDefinition, resolveSubject, factAnswer, questionsFor, kindsShown, leadSentences, contentTerms, highlight, KINDS, looksLikeQuestion } from './qa.js';
import { icon } from './icons.js';
import { musicArtist } from './rank.js';
import { mountTabs } from './page.js';
import './theme.js';

const params = new URLSearchParams(location.search);
const query = (params.get('q') ?? '').trim();
if (!query) location.replace('index.html');

const settings = getSettings();
const provider = currentProvider();
const abort = new AbortController();
const ctx = { signal: abort.signal, query };

document.title = `${query} - ${SITE.name}`;
$('#serp-h1').textContent = `${SITE.name} results for ${query}`;
$('#serp-search').replaceChildren(createSearchbox({ value: query }));
mountTabs(query);
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
      ? h('p', null, `${SITE.name} merged the engines’ results, ranked them with open rules and left out known AI content farms. It doesn’t personalise results. `, h('a', { href: 'settings.html#ranking' }, 'How results are ranked'))
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
    h('div', { class: 'result-meta' }, h('cite', { class: 'result-cite' }, address(r.url)), toggle),
    r.snippet.length ? h('p', { class: 'result-snippet' }, runs(r.snippet)) : null,
    about);
}

function showMore() {
  const next = all.slice(shown, shown + SITE.resultsPerLoad);
  const firstNew = list.querySelectorAll('.result').length;
  list.append(...next.map((r, i) => resultItem(r, shown + i)));
  shown += next.length;
  renderMoreButton();
  placePanel();
  return firstNew;
}

function renderMoreButton() {
  if (shown >= all.length) { moreBox.replaceChildren(); return; }
  const btn = h('button', { class: 'btn', type: 'button' }, 'More results');
  btn.addEventListener('click', () => {
    const first = showMore();
    list.querySelectorAll('.result')[first]?.querySelector('a')?.focus();
  });
  moreBox.replaceChildren(h('div', { class: 'more-row' }, btn));
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

async function searchWeb() {
  // An answer box that understood the search can say what the web results
  // should be about ("EUR to GBP exchange rate" for "50 euro to pounds").
  let webQuery = query;
  try { webQuery = found?.mod.webQuery?.(found.args) || query; } catch { /* keep the search */ }
  // A bare word might be a ticker ("aapl") or just a word ("cat"): only once the
  // market card has actually appeared does the search become "aapl stock".
  if (webQuery !== query && found?.args?.bare) {
    const shown = await Promise.race([answerShown, wait(2000).then(() => false)]);
    if (shown !== true) webQuery = query;
  }
  const results = await provider.search(webQuery, ctx);
  if (provider.id === 'webshelf') {
    const { server, left } = provider.last;
    $('#serp-source-note').replaceChildren(
      'Web results from ', server ? 'Bing and ' : '', h('a', { href: 'https://mwmbl.org' }, 'Mwmbl'),
      server ? '' : ` (${SITE.name}’s search server is waking up)`,
      ', ranked by ', h('a', { href: 'settings.html#ranking' }, SITE.name),
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
    moreBox.replaceChildren(errorState(err));
    elsewhere();
    return;
  }
  // Time the search itself, not the brief hold below.
  const secs = ((performance.now() - started) / 1000).toFixed(2);
  // Hold the list (briefly) until anything that would sit above it is placed,
  // so nothing pushes results down after they've appeared.
  // Topic pages already show their header and photos while waiting, so they
  // can wait a little longer for their carousels. The limit starts once we
  // know whether this is a topic page, with an absolute ceiling of 4 s.
  // A question's answer is the point of the page, so it gets the whole 4 s.
  const limit = factQ || defQ ? wait(4000) : panelKnown.then(() => wait(topicTitle ? 2500 : 1500));
  await Promise.race([aboveReady, limit, wait(4000)]);
  if (!all.length) {
    status.replaceChildren();
    moreBox.replaceChildren(emptyState());
    elsewhere();
    return;
  }
  status.replaceChildren('Results for ', h('b', null, query), ` · ${all.length.toLocaleString()} found in ${secs} s`);
  list.replaceChildren();
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

async function queueQuestions(subj, exclude) {
  const block = await questionsBlock(subj, exclude).catch(() => null);
  if (block) placeInList(h('li', { class: 'result-questions' }, block), 2);
}

async function factOrDefinition() {
  const asked = factQ ?? defQ;
  const subj = await resolveSubject(asked.subject, ctx);
  if (!subj) return null;
  const name = plainName(subj.title);
  if (factQ) {
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
  return (data.results ?? []).filter((r) => r.thumbnail_src || r.img_src).slice(0, 12).map((r) => {
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

function spelling(suggestion) {
  if (!suggestion || suggestion.toLowerCase() === query.toLowerCase()) return;
  $('#serp-spell').replaceChildren(h('p', { class: 'spell' },
    h('span', { class: 'spell-label' }, 'Did you mean '),
    h('a', { href: searchUrl(suggestion) }, h('b', null, h('i', null, suggestion))),
    h('span', { class: 'spell-label' }, '?')));
}

async function related() {
  if (!getSettings().suggestions) return;
  await resultsReady;
  const titles = await wiki.completions(query, { limit: 10, signal: abort.signal });
  const lower = query.toLowerCase();
  // Wikipedia's prefix search ignores spaces ("roll a die" finds "rolla"), so keep true completions only.
  const items = [...new Set(titles.map((t) => t.toLowerCase()))].filter((t) => t !== lower && t.startsWith(`${lower} `)).slice(0, 8);
  if (items.length < 2) return;
  const section = $('#serp-related');
  section.querySelector('.related-list').replaceChildren(...items.map((t) =>
    h('li', null, h('a', { href: searchUrl(t) }, t.slice(0, lower.length), h('b', null, t.slice(lower.length))))));
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

async function fillTopic(title, ent, panel, subject) {
  const [sum, data, images] = await Promise.all([
    wiki.summary(title, ctx),
    loadEntity(title, { ...ctx, subject }).catch(() => null),
    wiki.commonsImages(title, { ...ctx, limit: 6 }).catch(() => []),
  ]);
  if (!sum) { removeTopic(); return null; }
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
  for (const img of images) {
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

function placePending() {
  resultsOnScreen = true;
  for (const [slot, after] of pendingBlocks) {
    const results = list.querySelectorAll('.result');
    const anchor = results[after - 1] ?? results[results.length - 1];
    if (anchor) anchor.after(slot);
  }
  pendingBlocks.length = 0;
}

async function loadWorksFor(worksPromise, onScreenPromise) {
  let [groups, onScreenWork] = await Promise.all([worksPromise, onScreenPromise]);
  if (!topicTitle) return;
  if (!onScreenWork) groups = groups.filter((g) => g.id !== 'tv' && g.id !== 'film');
  if (!groups.length) return;
  placeInList(h('li', { class: 'result-works' }, groups.map(worksGroup)), 3);
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
    info = await track(wiki.lookup(query, ctx));
  } catch {
    panelDecided();
    worksDecided();
    questionsDecided();
    return;
  }
  const title = wiki.panelTitle(query, info.hits);
  // Wikipedia suggests respellings even for correct queries ("photo synthesis"),
  // so only offer one when none of its top articles shares a word with the search.
  const typed = contentTerms(query);
  const someMatch = info.hits.some((hit) => contentTerms(hit.title).some((t) => typed.includes(t)));
  if (!title && !someMatch) spelling(info.suggestion);
  // A topic would compete with an instant answer, so only one of them shows.
  if (!(title && !(await answering))) { worksDecided(); questionsDecided(); }
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
      .then((id) => (id ? loadWorks(id, { ...ctx, onScreen: true }) : [])).catch(() => []);
    subject.then((entity) => (entity ? queueQuestions({ title, entity }, [...kindsShown(entity, shownProps(entity)), 'whois', 'whatis']) : null)).finally(questionsDecided);
    const filling = track(fillTopic(title, ent, panel, subject)).catch(() => { removeTopic(); return null; });
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

if (query) {
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
