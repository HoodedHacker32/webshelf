// Click counts: an opt-in way for visitors to help the ranking, off unless
// they turn it on in Settings ("Help improve results").
//
// With it on, a click on a web result sends Webshelf's click counter three
// things: a scrambled code made from the search (a SHA-256 hash, so the
// counter can group clicks by search without keeping its words), the
// clicked page's address without anything after "?" or "#", and the
// result's position. No identifier, cookie or account goes with it, and
// the counter keeps no IP addresses.
//
// The same visitors' searches also fetch that search's counts, and pages
// that people chose often move up a little (rank.js, WEIGHTS.clicks).
// Nobody who leaves it off sends anything.
//
// The counter is a Cloudflare Worker (server/clicks). While CLICKS.url in
// config.js is null, this is all switched off and the setting is hidden.

import { CLICKS } from './config.js';
import { getSettings } from './store.js';

export const clicksAvailable = () => Boolean(CLICKS.url);
export const clicksOn = () => clicksAvailable() && Boolean(getSettings().shareClicks);

// The same search typed differently ("Red  Panda", "red panda") is one search.
export async function searchCode(query) {
  const text = `webshelf-clicks-v1:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// An address as the counter keeps it: no query string, no fragment.
export function pageOf(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch { return null; }
}

export async function recordClick(query, url, position) {
  if (!clicksOn()) return;
  const page = pageOf(url);
  if (!page) return;
  const body = JSON.stringify({ q: await searchCode(query), u: page, p: position });
  // sendBeacon survives the page being left for the result.
  if (!navigator.sendBeacon?.(`${CLICKS.url}/click`, new Blob([body], { type: 'text/plain' }))) {
    fetch(`${CLICKS.url}/click`, { method: 'POST', body, keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => {});
  }
}

// For this search: { page address -> share of its clicks }, or null when
// there are too few clicks to mean anything (or it's off, or slow).
export async function clickShares(query, { signal } = {}) {
  if (!clicksOn()) return null;
  try {
    const res = await fetch(`${CLICKS.url}/counts?q=${await searchCode(query)}`, { signal: signal ?? AbortSignal.timeout(1200), referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const { pages } = await res.json();
    const total = (pages ?? []).reduce((sum, p) => sum + p.n, 0);
    if (total < CLICKS.minClicks) return null;
    return new Map(pages.map((p) => [p.u, p.n / total]));
  } catch { return null; }
}
