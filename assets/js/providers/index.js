// Web results providers. Each one turns a query into a list of results:
//   { url, title: Run[], snippet: Run[], source }
// where a Run is { text, bold }. Bold runs are the matched query terms.
//
// PLACEHOLDER: the real results source is still undecided. Add a provider
// here and set SITE.defaultProvider to switch the whole site over.

import { SITE } from '../config.js';
import { getSettings } from '../store.js';
import mwmbl from './mwmbl.js';
import wikipedia from './wikipedia.js';
import searxng from './searxng.js';
import webshelf from './webshelf.js';
import { BACKEND } from '../config.js';

// The search server only appears once its address is set in config.js.
export const PROVIDERS = BACKEND.searxngUrl ? { webshelf, searxng, mwmbl, wikipedia } : { webshelf, mwmbl, wikipedia };

export function currentProvider() {
  const chosen = getSettings().provider;
  return PROVIDERS[chosen] ?? PROVIDERS[SITE.defaultProvider];
}
