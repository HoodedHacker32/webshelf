// Ranking rules (assets/js/rank.js). Run all tests: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, normaliseUrl, WEIGHTS } from '../assets/js/rank.js';

const result = (url, title, snippet = '', engines = ['bing']) => ({ url, title: [{ text: title, bold: false }], snippet: [{ text: snippet, bold: false }], engines });
const data = (top = [], farms = []) => ({ rank: new Map(top.map((h, i) => [h, i + 1])), farms: new Set(farms), size: 50000 });
const urls = (out) => out.results.map((r) => r.url);

test('the same page from several engines is merged into one result', async () => {
  const out = await rank('gordon ramsay', [{ engine: 'server', results: [
    result('https://en.m.wikipedia.org/wiki/Gordon_Ramsay', 'Gordon Ramsay - Wikipedia', '', ['bing']),
    result('https://en.wikipedia.org/wiki/Gordon_Ramsay', 'Gordon Ramsay', '', ['mwmbl']),
  ] }], { data: data() });
  assert.equal(out.results.length, 1);
  assert.deepEqual(out.results[0].engines.sort(), ['bing', 'mwmbl']);
});

test('the official home page goes first', async () => {
  const out = await rank('radiohead', [{ engine: 'server', results: [
    result('https://en.wikipedia.org/wiki/Radiohead', 'Radiohead - Wikipedia', 'Radiohead are an English rock band'),
    result('https://www.radiohead.com/', 'RADIOHEAD.COM', 'Radiohead'),
  ] }], { officialHosts: ['radiohead.com'], data: data(['wikipedia.org']) });
  assert.equal(urls(out)[0], 'https://www.radiohead.com/');
});

test('a result missing a searched word drops below one that has them all', async () => {
  const out = await rank('gordon ramsay', [{ engine: 'server', results: [
    result('https://gordon.us.com/', 'Gordon | Civil Engineering', 'An engineering firm'),
    result('https://www.bbc.com/news/x', 'Gordon Ramsay opens restaurant', 'Chef Gordon Ramsay'),
  ] }], { data: data(['bbc.com']) });
  assert.equal(urls(out)[0], 'https://www.bbc.com/news/x');
});

test('little words do not count as matches', async () => {
  const out = await rank('50 euro to pounds', [{ engine: 'server', results: [
    result('https://youtube.com/50cent', '50 Cent - YouTube', 'Music videos to watch'),
    result('https://www.xe.com/eur-gbp', 'EUR to GBP: euro to pounds converter', 'Convert euro to pounds'),
  ] }], { data: data(['youtube.com', 'xe.com']) });
  assert.equal(urls(out)[0], 'https://www.xe.com/eur-gbp');
});

test('AI content farms are left out and counted', async () => {
  const out = await rank('cats', [{ engine: 'server', results: [
    result('https://farm.example.ai/cats', 'Cats', 'cats'),
    result('https://en.wikipedia.org/wiki/Cat', 'Cat - Wikipedia', 'cats'),
  ] }], { data: data([], ['farm.example.ai']) });
  assert.deepEqual(urls(out), ['https://en.wikipedia.org/wiki/Cat']);
  assert.equal(out.left, 1);
});

test('a good small site can outrank a big one that matches less well', async () => {
  // Same engine position, but the small site has the words in its title.
  const out = await rank('sourdough starter ratio', [
    { engine: 'a', results: [result('https://www.bigsite.com/food', 'Food news', 'sourdough starter ratio guide')] },
    { engine: 'b', results: [result('https://smallbakery.blog/starter', 'Sourdough starter ratio, explained', 'sourdough starter ratio')] },
  ], { data: data(['bigsite.com']) });
  assert.equal(urls(out)[0], 'https://smallbakery.blog/starter');
});

test('authority stays modest', () => {
  assert.ok(WEIGHTS.authority <= 0.5, 'authority should not dominate engine agreement');
});

test('addresses are normalised', () => {
  assert.equal(normaliseUrl('https://www.example.com/a/?utm_source=x#top'), 'https://example.com/a');
  assert.equal(normaliseUrl('https://en.m.wikipedia.org/wiki/Cat'), 'https://en.wikipedia.org/wiki/Cat');
});
