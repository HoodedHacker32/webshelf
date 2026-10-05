// People also ask. The questions are ones people really search for: query
// suggestions (through Webshelf's search server) that start with a question
// word and are about the search. Each answer is the snippet the search engines
// show for that question's top result, quoted as it is, with the page named
// and linked. Nothing is written or summarised here.

import { h, svg, getJSON, hostOf } from './dom.js';
import { icon } from './icons.js';
import { BACKEND, searchUrl } from './config.js';
import { parseQuestion, parseDefinition } from './qa.js';

const QUESTION = /^(what|how|why|who|when|where|which|is|are|can|does|do|did|should|will|was|were)\b/i;
const STOP = new Set(['a', 'an', 'the', 'to', 'in', 'of', 'on', 'for', 'and', 'or', 'is', 'are']);
const words = (text) => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));

async function suggest(text, signal) {
  const res = await fetch(`${BACKEND.searxngUrl}/autocompleter?q=${encodeURIComponent(text)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.[1]) ? data[1] : Array.isArray(data) ? data : [];
  return list.filter((s) => typeof s === 'string');
}

const asQuestion = (text) => {
  // A year tacked on the end ("how old is taylor swift 2026") is a search
  // habit, not part of the question.
  const t = text.trim().replace(/\s+/g, ' ').replace(/\?*$/, '').replace(/ (?:19|20)\d{2}$/, '');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}?`;
};

// Up to `max` questions about the search, most common phrasings first.
export async function peopleAsk(query, { signal, max = 12 } = {}) {
  if (!BACKEND.searxngUrl) return [];
  const typed = query.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[?!.]+$/, '');
  if (!words(typed).length || words(typed).length > 6) return [];
  // A question about something ("when is taylor swift's birthday") gets other
  // questions about that thing ("how old is taylor swift"), not the same
  // question with words tacked on ("… birthday zodiac").
  const isQuestion = QUESTION.test(typed);
  const subject = isQuestion ? (parseQuestion(typed) ?? parseDefinition(typed))?.subject : null;
  const topic = subject && words(subject).length <= 3 ? subject : typed;
  const terms = words(topic);
  // A question with no such subject ("why is the sky blue") asks for its own
  // continuations. Otherwise question words go in front, but only of short
  // searches (a name, a thing): in front of a longer one ("best hiking boots
  // for women") the suggestions just echo the made-up start.
  const prompts = isQuestion && topic === typed ? [`${topic} `, topic]
    : terms.length <= 3 && (topic !== typed || terms.length <= 2)
      ? [`what is ${topic}`, `who is ${topic}`, `how old is ${topic}`, `how ${topic}`, `why ${topic}`, `where ${topic}`, `is ${topic}`, `${topic} `]
      : [`${topic} `];
  // The search with words added is a refinement, not another question, unless
  // what's added carries on the sentence ("… but space is black").
  const refinement = (lower) => lower.startsWith(`${typed} `)
    && (!/^(?:but|and|if|when|during|at|in|on|after|before|without|instead|or)\b/.test(lower.slice(typed.length + 1))
      || /\d/.test(lower.slice(typed.length + 1)));
  const lists = await Promise.all(prompts.map((p) => suggest(p, signal).catch(() => [])));
  const seen = new Set();
  const out = [];
  // Take one from each list in turn, so the questions vary in kind.
  for (let i = 0; out.length < max && i < 10; i++) {
    for (const list of lists) {
      const s = list[i];
      if (!s) continue;
      const lower = s.toLowerCase().trim();
      if (!QUESTION.test(lower) || prompts.some((p) => p.trim() === lower) || lower === typed || refinement(lower)) continue;
      // Suggestions with search operators in them ("-ai", "site:") aren't questions.
      if (/(?:^|\s)-\S|\b\w+:\S/.test(lower)) continue;
      // "what is how to …": two question openings is a joined-up suggestion, not a question.
      if (/^(?:what|how|why|who|when|where|which|is|are|can|does|do)(?:\s+(?:is|are|to|does|do|was|were))?\s+(?:what|how|why|who|when|where|which)\b/.test(lower)) continue;
      // About the search: every one of its words is in the question.
      const has = new Set(words(lower));
      if (!terms.every((t) => has.has(t))) continue;
      if (lower.split(/\s+/).length < terms.length + 2 || seen.has(lower)) continue;
      seen.add(lower);
      out.push(asQuestion(s));
      if (out.length >= max) break;
    }
  }
  return out;
}

// The top result's snippet for a question: { text, url, title } or null.
export async function answerFor(question, { signal, language = 'en', safe = 1 } = {}) {
  const params = new URLSearchParams({ q: question, format: 'json', language, safesearch: String(safe) });
  const data = await getJSON(`${BACKEND.searxngUrl}/search?${params}`, { signal, timeout: 10000 });
  // The result that covers the question's words best (of the top five), not
  // simply the first: engines sometimes put a page about one word first.
  const want = words(question).filter((w) => !QUESTION.test(w));
  const cover = (r) => {
    const has = new Set(words(`${r.title} ${r.content}`));
    return want.length ? want.filter((w) => has.has(w)).length / want.length : 1;
  };
  const hit = (data?.results ?? []).slice(0, 5)
    .filter((r) => typeof r.content === 'string' && r.content.trim().length >= 80 && /^https?:/.test(r.url ?? ''))
    .map((r, i) => ({ r, score: cover(r) - i * 0.02 }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)[0]?.r;
  if (!hit) return null;
  // Engines start some snippets with the page's date ("Jul 27, 2026 · …").
  let text = hit.content.replace(/\s+/g, ' ').trim().replace(/^[A-Z][a-z]{2} \d{1,2}, \d{4}\s*[·—-]\s*/, '');
  // End on a whole sentence where the snippet has one.
  const cut = text.slice(0, 320);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'));
  text = text.length > 320 ? (stop > 120 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')} …`) : text;
  return { text, url: hit.url.replace(/\/__url__$/, '/'), title: hit.title };
}

// The box: four questions; opening one loads its answer and adds two more.
export function paaBlock(questions, { signal, target, language, safe }) {
  if (questions.length < 2) return null;
  const pool = [...questions];
  const list = h('div', { class: 'questions-list' });
  const id = 'paa-title';

  const row = (question) => {
    const body = h('div', { class: 'question-answer' }, h('p', { class: 'answer-note' }, 'Loading…'));
    const details = h('details', { class: 'question' },
      h('summary', null, h('span', null, question), svg(icon('expandMore'))), body);
    details.addEventListener('toggle', async () => {
      if (!details.open || details.dataset.loaded) return;
      details.dataset.loaded = '1';
      try {
        const a = await answerFor(question, { signal, language, safe });
        const searchIt = h('a', { class: 'question-search', href: searchUrl(question.replace(/\?$/, '')) }, 'Search this question');
        body.replaceChildren(...(a
          ? [h('blockquote', { class: 'quote-text', cite: a.url }, a.text),
            h('p', { class: 'answer-source' }, 'From ', h('a', { href: a.url, target, rel: 'noreferrer' }, a.title || hostOf(a.url)),
              ` · ${hostOf(a.url)} · `, searchIt)]
          : [h('p', null, 'No short answer was found for this question.'), h('p', { class: 'answer-source' }, searchIt)]));
      } catch {
        body.replaceChildren(h('p', { class: 'answer-note' }, 'This answer couldn’t load. Try again in a moment.'));
        delete details.dataset.loaded;
        return;
      }
      // Like Google, opening a question brings up two more.
      for (const next of pool.splice(0, 2)) list.append(row(next));
    });
    return details;
  };
  list.append(...pool.splice(0, 4).map(row));
  return h('section', { class: 'questions paa', 'aria-labelledby': id },
    h('h2', { class: 'questions-title', id }, 'People also ask'),
    list,
    h('p', { class: 'paa-note' }, 'Questions people search for. Answers are quoted from the top result for each.'));
}
