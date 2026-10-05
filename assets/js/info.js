// The About and Privacy pages: the toolbar's search box and logo. Everything
// else on them is plain HTML.

import { $ } from './dom.js';
import { createSearchbox } from './searchbox.js';
import { mountLogos } from './logo.js';
import './theme.js';

$('#info-search').replaceChildren(createSearchbox());
mountLogos();
