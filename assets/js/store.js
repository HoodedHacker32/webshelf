// Settings and search history, kept only in this browser.
// Storage can be missing or throw (private windows, blocked site data),
// so every read and write is guarded and the page works without it.

const KEY_SETTINGS = 'webshelf:settings';
const KEY_HISTORY = 'webshelf:history';
const HISTORY_MAX = 50;

export const DEFAULTS = {
  provider: null,          // null means SITE.defaultProvider
  newTab: false,
  suggestions: true,
  history: true,
  tempUnit: 'auto',        // 'auto' | 'c' | 'f'
  theme: 'auto',           // 'auto' | 'light' | 'dark'
  home: null,              // { name, lat, lon, tz }
  safeSearch: 1,           // 0 off | 1 moderate | 2 strict
  language: 'en',          // results language, a SearXNG language code
  dorking: false,          // the operator form on the results page
  shareClicks: false,      // opt-in click counts (clicks.js)
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSettings() {
  const saved = read(KEY_SETTINGS, {});
  return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function setSetting(name, value) {
  const next = { ...getSettings(), [name]: value };
  return write(KEY_SETTINGS, next);
}

// Fahrenheit for US visitors on 'auto', Celsius elsewhere.
export function tempUnit() {
  const unit = getSettings().tempUnit;
  if (unit === 'c' || unit === 'f') return unit;
  const lang = (navigator.language || '').toLowerCase();
  return /-(us|lr|mm)$/.test(lang) ? 'f' : 'c';
}

export function getHistory() {
  if (!getSettings().history) return [];
  const list = read(KEY_HISTORY, []);
  return Array.isArray(list) ? list.filter((q) => typeof q === 'string') : [];
}

export function addHistory(q) {
  const query = q.trim();
  if (!query || !getSettings().history) return;
  const lower = query.toLowerCase();
  const list = getHistory().filter((item) => item.toLowerCase() !== lower);
  list.unshift(query);
  write(KEY_HISTORY, list.slice(0, HISTORY_MAX));
}

export function removeHistory(q) {
  write(KEY_HISTORY, getHistory().filter((item) => item !== q));
}

export function clearHistory() {
  try { localStorage.removeItem(KEY_HISTORY); } catch { /* nothing stored */ }
}
