// Question shapes (assets/js/qa.js). Run all tests: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion, subjectMatches } from '../assets/js/qa.js';

test('"when" questions about events', () => {
  assert.deepEqual(parseQuestion('when was ww2'), { kind: 'when', subject: 'ww2' });
  assert.deepEqual(parseQuestion('When did WW1 start?'), { kind: 'started', subject: 'ww1' });
  assert.deepEqual(parseQuestion('when did the french revolution end'), { kind: 'ended', subject: 'french revolution' });
  assert.deepEqual(parseQuestion('what year was the battle of hastings'), { kind: 'when', subject: 'battle of hastings' });
  // The more particular shapes still win.
  assert.equal(parseQuestion('when was barack obama born').kind, 'born');
  assert.equal(parseQuestion('when was the eiffel tower built').kind, 'opened');
});

test('the subject must be the article found', () => {
  assert.equal(subjectMatches('ww2', { title: 'World War II', redirect: 'WW2' }), true);
  assert.equal(subjectMatches('world war 2', { title: 'World War II' }), true);
  assert.equal(subjectMatches('battle of hastings', { title: 'Battle of Hastings' }), true);
  assert.equal(subjectMatches('next eclipse', { title: 'List of solar eclipses visible from the United States' }), false);
});

test('birthday questions, with straight or curly apostrophes', () => {
  assert.deepEqual(parseQuestion("when is taylor swift's birthday"), { kind: 'born', subject: 'taylor swift' });
  assert.deepEqual(parseQuestion('When is Taylor Swift’s birthday?'), { kind: 'born', subject: 'taylor swift' });
  assert.deepEqual(parseQuestion('taylor swift birthday'), { kind: 'born', subject: 'taylor swift' });
});
