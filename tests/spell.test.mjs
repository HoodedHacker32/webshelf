// Spelling corrections (assets/js/spell.js). Run all tests: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctFrom, distance } from '../assets/js/spell.js';

test('a swapped pair of letters is one edit', () => {
  assert.equal(distance('teh', 'the'), 1);
  assert.equal(distance('kitten', 'sitting'), 3);
});

test('a misspelt name is corrected from what people search for', () => {
  const suggestions = ['how old is the arnold schwarzenegger', 'arnold schwarzenegger 16 years old', 'arnold schwarzenegger 19 years old',
    'arnold schwarzenegger age 18', 'how old arnold schwarzenegger in 1984', 'arnold schwarzenegger age now'];
  const fix = correctFrom('how old is arnold shwarxennegar', suggestions);
  assert.equal(fix.text, 'how old is arnold schwarzenegger');
  assert.deepEqual(fix.words, [{ from: 'shwarxennegar', to: 'schwarzenegger' }]);
  assert.equal(fix.strong, true);
});

test('words that people do search for are left alone', () => {
  const suggestions = ['photosynthesis', 'photosynthesis equation', 'photo synthesis for kids'];
  assert.equal(correctFrom('photo synthesis', suggestions), null);
  assert.equal(correctFrom('sourdough starter', ['sourdough starter recipe', 'sourdough starter discard']), null);
});

test('one suggestion is not enough evidence', () => {
  assert.equal(correctFrom('teh weather', ['the weather channel']), null);
  const fix = correctFrom('teh weather', ['the weather channel', 'the weather today']);
  assert.equal(fix.text, 'the weather');
  assert.equal(fix.strong, false);
});
