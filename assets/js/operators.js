// Search operators, as Google supported them (2020–2023):
//
//   "exact phrase"   the words together, in this order
//   -word            leave out results containing the word (or -"a phrase")
//   site:example.com only that site (and its subdomains)
//   filetype:pdf     only addresses ending in .pdf (also ext:pdf)
//   intitle:word     the word must be in the title
//   inurl:word       the word must be in the address
//   intext:word      the word must be in the text (the snippet, here)
//   a OR b           either word (passed to the engines; nothing to check here)
//
// Several site: (or filetype:) values mean any of them: no page is on two
// sites at once.
//
// The whole query still goes to the engines, which understand most of these.
// Results are then checked here too, because not every engine does.
//
// Tokenizer: the query is read left to right. A token is a quoted phrase
// (with an optional leading "-"), an operator ("name:value", where the value
// may itself be quoted), or a bare word. "OR" (in capitals) between two tokens
// is kept as written. Anything unmatched is a bare word, so a stray quote or
// colon never breaks a search.

const TOKEN = /(-?)"([^"]*)"|(-?)(\w+):(?:"([^"]*)"|(\S+))|(\S+)/g;
const OPERATORS = new Set(['site', 'filetype', 'ext', 'intitle', 'inurl', 'intext']);

export function parseQuery(query) {
  const parsed = { words: [], phrases: [], exclude: [], site: [], filetype: [], intitle: [], inurl: [], intext: [], hasOr: false };
  for (const m of String(query ?? '').matchAll(TOKEN)) {
    const [, phraseNeg, phrase, opNeg, opName, opQuoted, opValue, word] = m;
    if (phrase !== undefined) {
      if (!phrase.trim()) continue;
      (phraseNeg ? parsed.exclude : parsed.phrases).push(phrase.trim().toLowerCase());
    } else if (opName !== undefined && OPERATORS.has(opName.toLowerCase())) {
      const value = (opQuoted ?? opValue ?? '').toLowerCase();
      if (!value) continue;
      const name = opName.toLowerCase() === 'ext' ? 'filetype' : opName.toLowerCase();
      if (opNeg) parsed.exclude.push(`${name}:${value}`);
      else parsed[name].push(name === 'filetype' ? value.replace(/^\./, '') : value);
    } else {
      const text = word ?? m[0];
      if (text === 'OR') { parsed.hasOr = true; continue; }
      if (text.length > 1 && text.startsWith('-')) parsed.exclude.push(text.slice(1).toLowerCase());
      else parsed.words.push(text.toLowerCase());
    }
  }
  parsed.any = Boolean(parsed.phrases.length || parsed.exclude.length || parsed.site.length || parsed.filetype.length || parsed.intitle.length || parsed.inurl.length || parsed.intext.length);
  return parsed;
}

// The words to rank by and to look things up with: no operators, no quotes.
export function plainQuery(parsed) {
  return [...parsed.phrases, ...parsed.words, ...parsed.intitle, ...parsed.intext].join(' ').trim();
}

const textOf = (runsOrText) => (Array.isArray(runsOrText) ? runsOrText.map((r) => r.text).join('') : String(runsOrText ?? '')).toLowerCase();
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const pathOf = (url) => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } };

// Each check: does this result satisfy the operator?
function checks(parsed) {
  const list = [];
  if (parsed.site.length) {
    const wants = parsed.site.map((site) => site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''));
    list.push({ label: parsed.site.map((s) => `site:${s}`).join(' OR '), ok: (r) => { const h = hostOf(r.url); return wants.some((w) => h === w || h.endsWith(`.${w}`)); } });
  }
  if (parsed.filetype.length) {
    list.push({ label: parsed.filetype.map((t) => `filetype:${t}`).join(' OR '), ok: (r) => parsed.filetype.some((t) => pathOf(r.url).endsWith(`.${t}`)) });
  }
  for (const word of parsed.intitle) list.push({ label: `intitle:${word}`, ok: (r) => textOf(r.title).includes(word) });
  for (const word of parsed.inurl) list.push({ label: `inurl:${word}`, ok: (r) => r.url.toLowerCase().includes(word) });
  for (const word of parsed.intext) list.push({ label: `intext:${word}`, ok: (r) => textOf(r.snippet).includes(word) });
  for (const phrase of parsed.phrases) {
    list.push({ label: `"${phrase}"`, ok: (r) => `${textOf(r.title)} ${textOf(r.snippet)} ${r.url.toLowerCase()}`.includes(phrase) });
  }
  for (const ex of parsed.exclude) {
    const [name, value] = ex.includes(':') ? ex.split(/:(.*)/s) : [null, ex];
    if (name === 'site') list.push({ label: `-site:${value}`, ok: (r) => !hostOf(r.url).endsWith(value.replace(/^www\./, '')) });
    else if (name === 'filetype') list.push({ label: `-filetype:${value}`, ok: (r) => !pathOf(r.url).endsWith(`.${value}`) });
    else if (name === 'intitle') list.push({ label: `-intitle:${value}`, ok: (r) => !textOf(r.title).includes(value) });
    else if (name === 'inurl') list.push({ label: `-inurl:${value}`, ok: (r) => !r.url.toLowerCase().includes(value) });
    else if (name === 'intext') list.push({ label: `-intext:${value}`, ok: (r) => !textOf(r.snippet).includes(value) });
    else list.push({ label: `-${ex}`, ok: (r) => !`${textOf(r.title)} ${textOf(r.snippet)} ${r.url.toLowerCase()}`.includes(ex) });
  }
  return list;
}

// Keeps the results that satisfy every operator. `unmet` names any operator
// that no result satisfied (shown to the visitor), so a search never silently
// ignores what was asked for.
export function applyOperators(results, parsed) {
  if (!parsed.any) return { results, unmet: [] };
  const list = checks(parsed);
  const unmet = list.filter((c) => !results.some((r) => c.ok(r))).map((c) => c.label);
  return { results: results.filter((r) => list.every((c) => c.ok(r))), unmet };
}
