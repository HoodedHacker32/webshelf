// Office holders (assets/js/answers/leader.js): which searches are questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.navigator ??= { languages: ['en-IE'] };
const { match } = await import('../assets/js/answers/leader.js');

test('questions about a country\'s leader are recognised', () => {
  assert.deepEqual(match('who is the current president'), { office: 'president', country: null });
  assert.deepEqual(match('president of the usa'), { office: 'president', country: 'usa' });
  assert.deepEqual(match('Who is the Taoiseach?'), { office: 'taoiseach', country: null });
  assert.deepEqual(match('french prime minister'), { office: 'prime minister', country: null, code: 'FR' });
  assert.deepEqual(match('king of spain'), { office: 'king', country: 'spain' });
});

test('a bare word that could be a band or a film is left alone', () => {
  assert.equal(match('queen'), null);
  assert.equal(match('president'), null);
  assert.equal(match('leader'), null);
  assert.equal(match('queen bohemian rhapsody'), null);
});
