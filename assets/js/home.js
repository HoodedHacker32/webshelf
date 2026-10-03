import { createSearchbox } from './searchbox.js';
import { SITE } from './config.js';
import { h } from './dom.js';
import { mountLogos } from './logo.js';
import './theme.js';

// The name lives in config.js; the HTML only holds a fallback.
document.title = SITE.name;
mountLogos();

document.getElementById('home-search').replaceChildren(createSearchbox({ autofocus: !window.matchMedia('(pointer: coarse)').matches }));

const repo = document.querySelector('[data-repo-links]');
if (SITE.repoUrl && repo) {
  repo.append(h('a', { href: SITE.repoUrl }, 'About'), h('a', { href: SITE.repoUrl }, 'Source code'));
}
