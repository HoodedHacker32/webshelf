// Featured snippets (assets/js/snippet.js). Run all tests: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSnippet, answerKind } from '../assets/js/snippet.js';

const answerOf = (s) => (s?.answer ? s.passage.slice(s.answer.start, s.answer.end) : null);

test('questions are sorted by the kind of answer they want', () => {
  assert.equal(answerKind('how long ago was the last ice age'), 'ago');
  assert.equal(answerKind('when did the titanic sink'), 'when');
  assert.equal(answerKind('how old is the eiffel tower'), 'age');
  assert.equal(answerKind('how many bones are in the human body'), 'amount');
  assert.equal(answerKind('how fast is the speed of light'), 'measure');
  assert.equal(answerKind('why is the sky blue'), null);
});

test('the short answer is found in the passage and the page furniture before it dropped', () => {
  const texts = [
    'Subscribe to our newsletter. The last ice age ended about 11,700 years ago, when glaciers retreated across the northern hemisphere.',
    'Anthropocene arrives Since the end of the last ice age a little over 10,000 years or so ago, human civilization has blossomed.',
  ];
  const s = findSnippet('how long ago was the last ice age', texts, ['last', 'ice', 'age']);
  assert.equal(s.index, 0);
  assert.equal(answerOf(s), 'about 11,700 years ago');
  assert.ok(s.passage.startsWith('The last ice age'));
});

test('measurements keep their units', () => {
  const texts = ['Speed of light, speed at which light waves propagate. In a vacuum it is exactly 299,792,458 metres per second.'];
  assert.equal(answerOf(findSnippet('how fast is the speed of light', texts, ['speed', 'light'])), '299,792,458 metres per second');
});

test('dates for "when" questions', () => {
  const texts = ['RMS Titanic sank in the early morning hours of 15 April 1912 in the North Atlantic Ocean after striking an iceberg.'];
  assert.equal(answerOf(findSnippet('when did the titanic sink', texts, ['titanic', 'sink'])), '15 April 1912');
});

test('no box when the passage isn\'t about the question', () => {
  const texts = ['Gerhard Ermischer, Current President of the Conference of INGOs Mission statement: to strengthen civil society.'];
  assert.equal(findSnippet('how old is the eiffel tower', texts, ['eiffel', 'tower']), null);
});

test('furniture run into the first sentence without a full stop is dropped', () => {
  const texts = ['Get your weekly dose of good climate news to your inbox Yes, the last ice age started thawing over 20,000 years ago, but that stopped.'];
  const s = findSnippet('how long ago was the last ice age', texts, ['last', 'ice', 'age']);
  assert.ok(s.passage.startsWith('Yes, the last ice age'), s.passage);
  assert.equal(answerOf(s), 'over 20,000 years ago');
});

test('a count is a number followed by what was asked about, never a lone year', () => {
  const lone = ['How Many Bones Are There in the Human Body? An illustration of human skeletons from an 1851 encyclopedia.'];
  assert.equal(findSnippet('how many bones are in the human body', lone, ['bone', 'human', 'body']), null);
  const counted = ['An adult human body has 206 bones, which make up the skeleton and protect the organs of the body.'];
  assert.equal(answerOf(findSnippet('how many bones are in the human body', counted, ['bone', 'human', 'body'])), '206 bones');
});
