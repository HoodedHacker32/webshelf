// Search operators (assets/js/operators.js). Run all tests: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, plainQuery, applyOperators } from '../assets/js/operators.js';

const r = (url, title, snippet = '') => ({ url, title: [{ text: title }], snippet: [{ text: snippet }] });

test('phrases, exclusions and operators are read', () => {
  const p = parseQuery('"gordon ramsay" -puffin site:bbc.co.uk filetype:PDF intitle:chef');
  assert.deepEqual(p.phrases, ['gordon ramsay']);
  assert.deepEqual(p.exclude, ['puffin']);
  assert.deepEqual(p.site, ['bbc.co.uk']);
  assert.deepEqual(p.filetype, ['pdf']);
  assert.deepEqual(p.intitle, ['chef']);
  assert.equal(p.any, true);
});

test('OR, ext: and excluded phrases', () => {
  const p = parseQuery('pizza OR pasta ext:md -"hello world"');
  assert.equal(p.hasOr, true);
  assert.deepEqual(p.words, ['pizza', 'pasta']);
  assert.deepEqual(p.filetype, ['md']);
  assert.deepEqual(p.exclude, ['hello world']);
});

test('plain searches are left alone, including colons in times', () => {
  const p = parseQuery('what is 2:30 in minutes');
  assert.equal(p.any, false);
  assert.equal(plainQuery(p), 'what is 2:30 in minutes');
  assert.equal(parseQuery('site:').any, false);
});

test('results are checked against each operator', () => {
  const results = [r('https://www.bbc.co.uk/a', 'Gordon Ramsay cooks'), r('https://bbc.co.uk/b', 'Gordon Ramsay puffin'), r('https://example.com', 'Gordon Ramsay')];
  const out = applyOperators(results, parseQuery('"gordon ramsay" -puffin site:bbc.co.uk'));
  assert.deepEqual(out.results.map((x) => x.url), ['https://www.bbc.co.uk/a']);
  assert.deepEqual(out.unmet, []);
});

test('an operator no result meets is named', () => {
  const out = applyOperators([r('https://example.com/page', 'Tax form')], parseQuery('tax form filetype:pdf'));
  assert.deepEqual(out.results, []);
  assert.deepEqual(out.unmet, ['filetype:pdf']);
});

test('inurl:, intext: and several sites', () => {
  const p = parseQuery('climate inurl:report intext:warming site:bbc.co.uk OR site:gov.uk');
  assert.deepEqual(p.inurl, ['report']);
  assert.deepEqual(p.intext, ['warming']);
  assert.equal(plainQuery(p), 'climate warming');
  const list = [
    r('https://www.bbc.co.uk/news/report-1', 'Climate', 'global warming'),
    r('https://www.gov.uk/report/2', 'Climate', 'warming trends'),
    r('https://example.com/report', 'Climate', 'warming'),
    r('https://www.gov.uk/guide', 'Climate', 'warming'),
  ];
  assert.deepEqual(applyOperators(list, p).results.map((x) => x.url), ['https://www.bbc.co.uk/news/report-1', 'https://www.gov.uk/report/2']);
});

test('the dorking form builds the search it describes', async () => {
  const { buildQuery, fieldsFrom } = await import('../assets/js/dorking.js');
  const q = buildQuery({ all: 'climate report', exact: 'sea level', any: 'ireland scotland', none: 'blog', site: 'gov.ie gov.uk', notsite: 'pinterest.com', filetype: 'pdf', intitle: 'annual', inurl: 'research' });
  assert.equal(q, 'climate report "sea level" ireland OR scotland -blog site:gov.ie OR site:gov.uk -site:pinterest.com filetype:pdf intitle:annual inurl:research');
  const f = fieldsFrom(parseQuery(q));
  assert.equal(f.exact, 'sea level');
  assert.equal(f.site, 'gov.ie gov.uk');
  assert.equal(f.notsite, 'pinterest.com');
  assert.equal(f.filetype, 'pdf');
  assert.equal(f.inurl, 'research');
});
