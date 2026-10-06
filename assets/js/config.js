// Our own search server (server/README.md), e.g. 'https://203-0-113-7.sslip.io'.
// While it's null the site uses Mwmbl directly.
const BACKEND_URL = 'https://webshelf-search-us.onrender.com';

export const BACKEND = {
  searxngUrl: BACKEND_URL,
  // Share prices go through the server, which fetches them from Yahoo Finance
  // and shares each answer between visitors (server/container/market.py).
  marketUrl: BACKEND_URL ? `${BACKEND_URL}/market` : null,
};

// Site-wide constants. The name lives here so a rename is a one-line change.
export const SITE = {
  name: 'Webshelf',
  // Link to the public source repository. Footer links are hidden while null.
  repoUrl: 'https://github.com/HoodedHacker32/webshelf',
  // Results provider used when the visitor hasn't picked one in Settings.
  // PLACEHOLDER: the real web results source is still undecided.
  defaultProvider: 'webshelf',
  resultsPerLoad: 10,
};

export const searchUrl = (q, page = 'search.html') => `${page}?q=${encodeURIComponent(q)}`;

// The tabs above the results. Each is its own page with the same toolbar.
export const TABS = [
  { id: 'all', label: 'All', page: 'search.html' },
  { id: 'images', label: 'Images', page: 'images.html' },
  { id: 'videos', label: 'Videos', page: 'videos.html' },
  { id: 'books', label: 'Books', page: 'books.html' },
  { id: 'maps', label: 'Maps', page: 'maps.html' },
];
