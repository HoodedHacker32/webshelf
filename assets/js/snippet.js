// Featured snippets, as classic search had them: for a question with a short
// answer (a time, an age, an amount, a measurement), the answer is found in a
// top result's own snippet and shown as a heading, with the passage it came
// from quoted beneath it, the answer highlighted, and the page linked.
//
// Extractive only: the heading is words copied from the passage, found by
// pattern (a number with its unit, a date). Nothing is rewritten or generated.
// Questions without a short answer ("why …", "what is …") get the passage
// alone, as Google's paragraph snippets did.

const SCALE = '(?:\\s?(?:thousand|million|billion|trillion))?';
const NUMBER = `(?:[$£€]\\s?)?\\d{1,3}(?:[,\\u00a0]\\d{3})+(?:\\.\\d+)?${SCALE}|(?:[$£€]\\s?)?\\d+(?:\\.\\d+)?${SCALE}`;
const QUALIFIER = '(?:(?:about|around|approximately|roughly|nearly|almost|over|under|more than|less than|some|just over|just under|up to|at least|an estimated|estimated)\\s)?';
const RANGE = `${QUALIFIER}(?:${NUMBER})(?:\\s?(?:–|-|to|and)\\s?(?:${NUMBER}))?`;
const TIME_UNITS = 'years?|months?|weeks?|days?|hours?|minutes?|seconds?|decades?|centuries|century|millennia|millennium';
const MEASURE_UNITS = `met(?:re|er)s per second|miles per hour|kilomet(?:re|er)s per hour|km/h|m/s|${TIME_UNITS}|km|kilomet(?:re|er)s?|miles?|met(?:re|er)s?|cm|centimet(?:re|er)s?|mm|millimet(?:re|er)s?|feet|foot|ft|inch(?:es)?|yards?|kg|kilograms?|grams?|g|pounds?|lbs?|tonnes?|tons?|ounces?|oz|°\\s?[CF]|degrees(?: celsius| fahrenheit| c| f)?|mph|kph|light[- ]years?|au|lit(?:re|er)s?|gallons?|calories|kcal|percent|per cent|%|people|inhabitants|residents`;
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const DATE = `\\d{1,2}(?:st|nd|rd|th)? (?:${MONTHS})\\.? \\d{4}|(?:${MONTHS})\\.? \\d{1,2}(?:st|nd|rd|th)?,? \\d{4}|(?:in |since |by )?(?:${MONTHS}) \\d{4}|\\d{4} (?:BC|BCE|AD|CE)|(?:the )?\\d{1,2}(?:st|nd|rd|th) century(?: (?:BC|BCE|AD))?|(?<![\\d,.])(?:1[0-9]|20)\\d{2}(?![\\d,])`;

const re = (source) => new RegExp(source, 'giu');
// The kinds of short answer, each with the patterns that find it, best first.
const KINDS = {
  ago: [re(`${RANGE}\\s?(?:${TIME_UNITS})(?: or so| or more)? ago`), re(DATE)],
  when: [re(DATE), re(`${RANGE}\\s?(?:${TIME_UNITS}) ago`)],
  age: [re(`${RANGE}[- ]years?[- ]old`), re(`aged? ${RANGE}`), re(`${RANGE} years`)],
  amount: [re(`${RANGE}\\s?(?:${MEASURE_UNITS})(?![\\p{L}])`)],
  measure: [re(`${RANGE}\\s?(?:${MEASURE_UNITS})(?![\\p{L}])`)],
};

// Which kind of short answer a question wants, or null.
export function answerKind(question) {
  const q = question.trim().toLowerCase();
  if (/^(?:how long ago|how many years ago)\b/.test(q)) return 'ago';
  if (/^(?:when\b|what (?:year|date|century)\b|in what year\b)/.test(q)) return 'when';
  if (/^how old\b|^what age\b/.test(q)) return 'age';
  if (/^how (?:many|much)\b|^what is the (?:population|number|cost|price)\b/.test(q)) return 'amount';
  if (/^how (?:long|tall|high|far|big|deep|fast|heavy|wide|large|hot|cold|small|short|close)\b|^what is the (?:distance|height|speed|temperature|size|weight|length|depth|area|diameter|boiling point|melting point)\b/.test(q)) return 'measure';
  return null;
}

// The passage's sentences, with where each starts.
function sentences(text) {
  const out = [];
  const pattern = /[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/g;
  let m;
  while ((m = pattern.exec(text))) if (m[0].trim()) out.push({ text: m[0], start: m.index });
  return out;
}

const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// For a question and the top results' snippets (plain text, best result
// first), the best passage: { index, passage, answer: { start, end } | null }.
// `terms` are the question's meaningful words. `index` is which snippet.
export function findSnippet(question, texts, terms) {
  const kind = answerKind(question);
  const patterns = kind ? [...KINDS[kind]] : [];
  // "How many bones …": a number followed by one of the question's words
  // ("206 bones"), never a number on its own (a year, a page count).
  const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (kind === 'amount' && terms.length) patterns.push(re(`${RANGE}\\s(?:[\\p{L}]+\\s)?(?:${terms.map(escape).join('|')})[\\p{L}]*`));
  const coverOf = (text) => {
    const has = new Set(words(text));
    return terms.length ? terms.filter((t) => has.has(t) || [...has].some((w) => w.startsWith(t))).length / terms.length : 0;
  };
  let best = null;
  texts.forEach((raw, index) => {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 60) return;
    const all = sentences(text);
    // Whether the snippet is about the question is judged on all of it; the
    // sentence holding the answer only breaks ties.
    const cover = coverOf(text);
    all.forEach((s, at) => {
      let answer = null;
      for (const [i, pattern] of patterns.entries()) {
        pattern.lastIndex = 0;
        const m = pattern.exec(s.text);
        if (m) { answer = { start: s.start + m.index, end: s.start + m.index + m[0].length, rank: i }; break; }
      }
      const score = cover * 2 + coverOf(s.text) * 0.5 + (answer ? 1.5 - answer.rank * 0.3 : 0) - index * 0.25;
      if (!best || score > best.score) best = { score, index, text, all, at, answer, cover };
    });
  });
  if (!best) return null;
  // A short answer needs the snippet to be about the question too.
  if (kind && (!best.answer || best.cover < 0.5)) return null;
  if (!kind && best.cover < 0.6) return null;
  // The passage starts at the first sentence (up to the answer's) that is
  // about the question, dropping page furniture such as "Subscribe to our
  // newsletter", and runs to the snippet's end.
  const first = best.all.slice(0, best.at + 1).find((s) => coverOf(s.text) > 0) ?? best.all[best.at];
  // Furniture run straight into the first sentence without a full stop
  // ("… to your inbox Yes, the last ice age …"): start at the capital that
  // begins the words about the question.
  let from = first.start;
  const firstTerm = (() => {
    const lower = first.text.toLowerCase();
    const at = terms.map((t) => lower.search(new RegExp(`(?<![\\p{L}])${escape(t)}`, 'u'))).filter((i) => i >= 0);
    return at.length ? Math.min(...at) : -1;
  })();
  if (firstTerm > 0) {
    const before = first.text.slice(0, firstTerm);
    const joins = [...before.matchAll(/\p{Ll} (?=\p{Lu})/gu)].map((m) => m.index + 2);
    const cut = joins.filter((i) => i >= 20 && coverOf(before.slice(0, i)) === 0).pop();
    if (cut !== undefined && (!best.answer || first.start + cut <= best.answer.start)) from = first.start + cut;
  }
  const passage = best.text.slice(from).trim();
  const shift = best.text.slice(from).length - best.text.slice(from).trimStart().length;
  const answer = best.answer ? { start: best.answer.start - from - shift, end: best.answer.end - from - shift } : null;
  return { index: best.index, passage, answer };
}
