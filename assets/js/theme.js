// Light and dark themes. The inline script in each page's <head> applies the
// saved choice before first paint; this module keeps "auto" in step with the OS.

import { getSettings } from './store.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(choice = getSettings().theme) {
  const dark = choice === 'dark' || (choice !== 'light' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

media.addEventListener('change', () => {
  if ((getSettings().theme ?? 'auto') === 'auto') applyTheme('auto');
});
