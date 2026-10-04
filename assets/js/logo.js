// The owner's logo files, used as drawn. The site uses the pixel-art lockup the
// owner chose (logos/pixel-lockup.svg, built by tools/build_pixel_logo.py).
// Inlining the SVG lets the black parts follow the text colour in dark mode.

const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`logos/${name}.svg`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    }));
  }
  return cache.get(name);
}

// Replaces each <span data-logo="lockup"><img …></span> with the inline SVG.
// The <img> stays in place if the file can't be fetched.
export async function mountLogos(root = document) {
  await Promise.all([...root.querySelectorAll('[data-logo]')].map(async (host) => {
    try {
      const text = await load(host.dataset.logo);
      const tpl = document.createElement('template');
      tpl.innerHTML = text.slice(text.indexOf('<svg'));
      const svg = tpl.content.querySelector('svg');
      if (!svg) return;
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', host.dataset.label || 'Webshelf');
      svg.setAttribute('focusable', 'false');
      host.replaceChildren(svg);
      host.classList.add('is-inline');
    } catch {
      /* keep the <img> fallback */
    }
  }));
}

// The leaning blue book rocks once, as a loading cue. Skipped for reduced motion.
export function rockBook(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const books = '[data-logo].is-inline [data-book="blue"], [data-logo].is-inline path[style*="103,193,255"]';
  for (const book of root.querySelectorAll(books)) {
    book.classList.remove('book-rock');
    void book.getBoundingClientRect();
    book.classList.add('book-rock');
  }
}
