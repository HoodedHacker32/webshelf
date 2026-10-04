// Tiny DOM helpers. Text from outside sources is always set as text, never HTML.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === 'class') el.className = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'html') el.innerHTML = value; // trusted, static markup only
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Parse a trusted static SVG string (from icons.js) into an element.
export function svg(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Wikidata asks API users not to send bursts of parallel requests, and
// answers them with "too many requests". Its calls queue, two at a time.
const LIMITED = { 'www.wikidata.org': 2 };
const queues = {};
async function inTurn(url, run) {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* not a URL */ }
  const max = LIMITED[host];
  if (!max) return run();
  const q = (queues[host] ??= { active: 0, waiting: [] });
  if (q.active >= max) await new Promise((resolve) => q.waiting.push(resolve));
  q.active += 1;
  try { return await run(); } finally {
    q.active -= 1;
    q.waiting.shift()?.();
  }
}

// Fetch JSON with a timeout. Throws on network errors and non-2xx answers.
// "Too many requests" gets one retry after a pause.
export async function getJSON(url, options = {}) {
  try {
    return await inTurn(url, () => fetchJSON(url, options));
  } catch (err) {
    if (err.status !== 429 || options.signal?.aborted) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
    return inTurn(url, () => fetchJSON(url, options));
  }
}

async function fetchJSON(url, { signal, timeout = 8000, headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
