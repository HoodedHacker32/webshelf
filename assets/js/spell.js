// Spelling, as classic search did it: "Showing results for … / Search instead
// for …" when a word is clearly misspelt, "Did you mean …?" when it might be.
//
// No dictionary is shipped. The evidence is what people search for: the query
// suggestions from Webshelf's search server (Bing's). A word in the search
// that never appears in them, while a close spelling of it appears in several,
// is corrected to that spelling. Wikipedia's own suggestion is the fallback
// when the server is asleep, offered only as "Did you mean".
//
// The correction is automatic (the page shows the corrected search) only when
// the evidence is strong: the corrected word appears in at least three
// suggestions, the original in none, and Wikipedia has almost no pages with
// the search as typed.

import { BACKEND } from './config.js';
import { lookup } from './wiki.js';

const tokens = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

// Edit distance, counting a swap of two neighbouring letters as one edit
// ("teh" -> "the").
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// How different a word may be and still count as a misspelling of another.
const allowed = (word) => (word.length <= 4 ? 1 : word.length <= 7 ? 2 : Math.ceil(word.length * 0.4));

// The correction suggested by a list of query suggestions, or null:
// { text, words: [{ from, to }], strong }.
export function correctFrom(query, suggestions) {
  const typed = tokens(query);
  if (!typed.length || !suggestions.length) return null;
  const counts = new Map();
  for (const s of suggestions) for (const w of new Set(tokens(s))) counts.set(w, (counts.get(w) ?? 0) + 1);
  const changes = [];
  for (const word of typed) {
    if (word.length < 3 || /\d/.test(word) || counts.has(word)) continue;
    let best = null;
    for (const [candidate, n] of counts) {
      if (candidate[0] !== word[0] || Math.abs(candidate.length - word.length) > 3) continue;
      const dist = distance(word, candidate);
      if (dist === 0 || dist > allowed(word)) continue;
      if (!best || n > best.n || (n === best.n && dist < best.dist)) best = { to: candidate, n, dist };
    }
    if (best && best.n >= 2) changes.push({ from: word, to: best.to, n: best.n });
  }
  if (!changes.length || changes.length > 2) return null;
  let text = query;
  for (const c of changes) text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${c.from}(?![\\p{L}\\p{N}])`, 'iu'), c.to);
  return { text, words: changes.map(({ from, to }) => ({ from, to })), strong: changes.every((c) => c.n >= 3) };
}

async function serverSuggestions(text, signal) {
  if (!BACKEND.searxngUrl) return [];
  const res = await fetch(`${BACKEND.searxngUrl}/autocompleter?q=${encodeURIComponent(text)}`, { signal: signal ?? AbortSignal.timeout(1500) });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.[1]) ? data[1] : Array.isArray(data) ? data : [];
  return list.filter((s) => typeof s === 'string');
}

// { text, words, auto } or null. `auto` means show the corrected results.
export async function checkSpelling(query, { signal } = {}) {
  const [suggestions, wiki] = await Promise.all([
    serverSuggestions(query, AbortSignal.any ? AbortSignal.any([AbortSignal.timeout(1500), ...(signal ? [signal] : [])]) : AbortSignal.timeout(1500)).catch(() => []),
    lookup(query, { signal }).catch(() => null),
  ]);
  const fix = correctFrom(query, suggestions);
  if (fix) return { text: fix.text, words: fix.words, auto: fix.strong && (wiki?.total ?? 0) < 5 };
  return null;
}
