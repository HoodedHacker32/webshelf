// Image relevance (assets/js/imagematch.js). Run all tests: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageMatcher } from '../assets/js/imagematch.js';

test('pictures that aren\'t about the search are left out', () => {
  const zelda = imageMatcher('legend of zelda wallpapers');
  assert.equal(zelda({ title: 'Legend of Zelda 5', page: 'https://flickr.com/x' }), true);
  assert.equal(zelda({ title: 'Celebration Wallpapers - Top Free', page: 'https://wallpaperaccess.com/celebration' }), false);
  assert.equal(zelda({ title: 'DIY cookie monster costume', page: 'https://example.com/cookie' }), false);
  // The address counts too: a file named for it is about it.
  assert.equal(zelda({ title: 'Untitled', page: 'https://example.com/legend-of-zelda-triforce.jpg' }), true);
});

test('whole words, either number', () => {
  const cats = imageMatcher('cats');
  assert.equal(cats({ title: 'my little cat' }), true);
  assert.equal(cats({ title: 'Catacombs of Paris' }), false);
});
