// Books tab, from Open Library (the Internet Archive's open catalogue of
// books, free and keyless): each book with its cover, author, first
// publication, editions and opening line, and a link to read or borrow it
// free when the Internet Archive has a copy.

import { h, $, getJSON } from './dom.js';
import { setupPage } from './page.js';
import { filterRow } from './searchtools.js';

const { query, ctx, track, target } = setupPage({
  page: 'books.html',
  title: 'Books',
  sources: [['Open Library', 'https://openlibrary.org']],
});

const list = $('#results');
const status = $('#serp-status');
const moreBox = $('#serp-more');
const OL = 'https://openlibrary.org';

// Filters, in the address: whether it can be read free, and when it first came out.
const tools = filterRow({
  query,
  page: 'books.html',
  filters: [
    ['read', 'Availability', [['', 'Any book'], ['free', 'Free to read'], ['borrow', 'Free to read or borrow']]],
    ['published', 'First published', [['', 'Any time'], ['2020', 'Since 2020'], ['2000', '2000–2019'], ['1900', '1900–1999'], ['old', 'Before 1900']]],
  ],
});
const { read, published } = tools.current;
const YEARS = { 2020: '[2020 TO *]', 2000: '[2000 TO 2019]', 1900: '[1900 TO 1999]', old: '[* TO 1899]' };
list.before(h('div', { class: 'video-tools' }, tools.menus));

// Whether a book is about the search: its title, authors or subjects have the
// words that matter (all of them for one or two words, most of a longer
// search). Open Library matches loosely ("dune" finds "d'une").
const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'and', 'or', 'by', 'for', 'book', 'books', 'novel', 'novels', 'author', 'read', 'ebook', 'ebooks', 'pdf']);
const norm = (text) => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = norm(query).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
const tests = words.map((w) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(w)}`, 'u'));
const needed = tests.length <= 2 ? tests.length : Math.ceil(tests.length * 0.6);
const about = (b) => {
  const text = norm(`${b.title} ${b.subtitle ?? ''} ${(b.author_name ?? []).join(' ')} ${(b.subject ?? []).slice(0, 30).join(' ')}`);
  return tests.filter((t) => t.test(text)).length >= needed;
};

const FIELDS = 'key,title,subtitle,author_name,author_key,first_publish_year,cover_i,edition_count,number_of_pages_median,first_sentence,subject,ratings_average,ratings_count,ebook_access,ia';
let page = 0;
let found = 0;
let shown = 0;

async function fetchPage(n) {
  const q = [query,
    read === 'free' ? 'ebook_access:public' : read === 'borrow' ? 'ebook_access:[borrowable TO *]' : '',
    YEARS[published] ? `first_publish_year:${YEARS[published]}` : ''].filter(Boolean).join(' ');
  const data = await getJSON(`${OL}/search.json?q=${encodeURIComponent(q)}&fields=${FIELDS}&limit=20&page=${n}`, { ...ctx, timeout: 12000 });
  found = data.numFound ?? 0;
  return data.docs ?? [];
}

const cut = (text, n = 170) => (text.length > n ? `${text.slice(0, n).replace(/\s+\S*$/, '')} …` : text);
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function card(b) {
  const url = `${OL}${b.key}`;
  const authors = (b.author_name ?? []).slice(0, 3);
  const cover = b.cover_i
    ? h('img', { src: `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', width: '80', height: '120' })
    : null;
  const thumb = h('a', { class: `book-cover${cover ? '' : ' is-blank'}`, href: url, target, rel: 'noreferrer', tabindex: '-1', 'aria-hidden': 'true' },
    cover ?? h('span', null, b.title.slice(0, 40)));
  cover?.addEventListener('error', () => { cover.remove(); thumb.classList.add('is-blank'); thumb.append(h('span', null, b.title.slice(0, 40))); }, { once: true });
  const facts = [
    authors.length ? authors.join(', ') : null,
    b.first_publish_year ? `first published ${b.first_publish_year}` : null,
    b.edition_count > 1 ? plural(b.edition_count, 'edition') : null,
    b.number_of_pages_median ? plural(b.number_of_pages_median, 'page') : null,
  ].filter(Boolean).join(' · ');
  const opening = b.first_sentence?.[0];
  // Catalogue subjects, less the library's own labels and near-repeats
  // ("Dune (imaginary place), fiction" after "Dune (Imaginary place)").
  const seenSubject = new Set();
  const subjects = (b.subject ?? []).filter((s) => {
    const base = s.toLowerCase().replace(/,.*$/, '').trim();
    if (s.length >= 40 || seenSubject.has(base) || /^(?:fiction|accessible book|protected daisy|in library|large type books|open library staff picks|long now manual for civilization|nyt:)/i.test(s)) return false;
    seenSubject.add(base);
    return true;
  }).slice(0, 4);
  const free = b.ebook_access === 'public';
  const lend = b.ebook_access === 'borrowable';
  const archive = b.ia?.[0] ? `https://archive.org/details/${b.ia[0]}` : url;
  return h('li', { class: 'result book' },
    h('div', { class: 'book-body' },
      thumb,
      h('div', { class: 'book-text' },
        h('h2', { class: 'result-title' }, h('a', { href: url, target, rel: 'noreferrer' }, b.title, b.subtitle ? `: ${b.subtitle}` : '')),
        h('p', { class: 'book-facts' }, facts),
        opening ? h('p', { class: 'result-snippet' }, `“${cut(opening.replace(/^[“"]|[”"]$/g, ''))}”`) : '',
        subjects.length ? h('p', { class: 'book-subjects' }, subjects.join(' · ')) : '',
        h('p', { class: 'book-actions' },
          b.ratings_count >= 5 ? h('span', { class: 'book-rating' }, `Rated ${b.ratings_average.toFixed(1)} of 5 by ${plural(b.ratings_count, 'reader')}`) : '',
          free ? h('a', { class: 'btn btn-small', href: archive, target, rel: 'noreferrer' }, 'Read free') : '',
          lend ? h('a', { class: 'btn btn-small', href: url, target, rel: 'noreferrer' }, 'Borrow free') : ''))));
}

async function load() {
  page += 1;
  moreBox.replaceChildren();
  let batch = [];
  let got = 0;
  try {
    // A few pages may pass before enough match the search.
    while (batch.length < 8 && page <= 5) {
      const docs = await track(fetchPage(page));
      got = docs.length;
      batch.push(...docs.filter(about));
      if (got < 20 || batch.length >= 8) break;
      page += 1;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (!shown) {
      status.replaceChildren('Open Library didn’t answer. ', h('a', { href: location.href }, 'Try again'), '.');
      return;
    }
  }
  list.append(...batch.map(card));
  shown += batch.length;
  if (!shown) {
    status.replaceChildren('No books found for ', h('b', null, query),
      ...(tools.active ? ['. ', h('a', { href: tools.urlFor({ read: '', published: '' }) }, 'Search without filters'), '.'] : ['. Try fewer or different words.']));
    return;
  }
  status.replaceChildren('Books for ', h('b', null, query), ` · ${shown} shown`);
  if (got === 20 && page * 20 < found) {
    const more = h('button', { class: 'btn', type: 'button' }, 'More books');
    more.addEventListener('click', () => load());
    moreBox.replaceChildren(h('div', { class: 'more-row' }, more));
  }
}

load();
