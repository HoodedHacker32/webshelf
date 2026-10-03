// Our own search server (server/README.md), e.g. 'https://203-0-113-7.sslip.io'.
// While it's null the site uses Mwmbl directly.
const BACKEND_URL = 'https://webshelf-search-us.onrender.com';

export const BACKEND = {
  searxngUrl: BACKEND_URL,
  // Share prices go through the server, which holds the Twelve Data key.
  marketUrl: BACKEND_URL ? `${BACKEND_URL}/market` : null,
};

// Site-wide constants. The name lives here so a rename is a one-line change.
export const SITE = {
  name: 'Webshelf',
  // Link to the public source repository. Footer links are hidden while null.
  repoUrl: null,
  // Results provider used when the visitor hasn't picked one in Settings.
  // PLACEHOLDER: the real web results source is still undecided.
  defaultProvider: BACKEND_URL ? 'searxng' : 'mwmbl',
  resultsPerLoad: 10,
};

// Share prices. Twelve Data's free key allows 800 requests a day; each share
// search uses two. PLACEHOLDER: 'demo' only covers AAPL, so other shares show
// plain results until a real key (or a proxy on our own server) is set here.
export const MARKET = {
  twelveDataKey: 'demo',
};

export const searchUrl = (q, page = 'search.html') => `${page}?q=${encodeURIComponent(q)}`;

// The tabs above the results. Each is its own page with the same toolbar.
export const TABS = [
  { id: 'all', label: 'All', page: 'search.html' },
  { id: 'images', label: 'Images', page: 'images.html' },
  { id: 'videos', label: 'Videos', page: 'videos.html' },
];
