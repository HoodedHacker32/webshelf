import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanPage } from '../server/clicks/worker.js';
import { searchCode, pageOf } from '../assets/js/clicks.js';

const SITE = 'https://hoodedhacker32.github.io';

function stubDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            run: async () => { calls.push({ sql, args }); return {}; },
            all: async () => { calls.push({ sql, args }); return { results: [{ u: 'https://a.com/', n: 7 }] }; },
          };
        },
      };
    },
  };
}

const post = (body, origin = SITE) => new Request('https://clicks.example/click', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: JSON.stringify(body),
});

test('search codes are the same for the same search, typed differently', async () => {
  const a = await searchCode('Red  Panda ');
  assert.equal(a, await searchCode('red panda'));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, await searchCode('red pandas'));
});

test('pages are kept without query strings or fragments', () => {
  assert.equal(pageOf('https://www.example.com/a/b?utm=1#top'), 'https://www.example.com/a/b');
  assert.equal(pageOf('https://example.com'), 'https://example.com/');
  assert.equal(pageOf('javascript:alert(1)'), null);
});

test('the counter accepts only clean addresses', () => {
  assert.equal(cleanPage('https://example.com/a'), 'https://example.com/a');
  assert.equal(cleanPage('https://example.com/a?b=1'), null);
  assert.equal(cleanPage('ftp://example.com/'), null);
  assert.equal(cleanPage('https://user:pw@example.com/'), null);
  assert.equal(cleanPage(`https://example.com/${'x'.repeat(600)}`), null);
});

test('a click from the site is counted', async () => {
  const DB = stubDb();
  const res = await worker.fetch(post({ q: 'a'.repeat(32), u: 'https://example.com/a', p: 3 }), { DB });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.deepEqual(DB.calls[0].args.slice(0, 3), ['a'.repeat(32), 'https://example.com/a', 3]);
});

test('clicks from elsewhere, or malformed, are refused', async () => {
  const DB = stubDb();
  assert.equal((await worker.fetch(post({ q: 'a'.repeat(32), u: 'https://example.com/', p: 1 }, 'https://evil.example'), { DB })).status, 403);
  assert.equal((await worker.fetch(post({ q: 'not-a-code', u: 'https://example.com/', p: 1 }), { DB })).status, 400);
  assert.equal((await worker.fetch(post({ q: 'a'.repeat(32), u: 'https://example.com/?x=1', p: 1 }), { DB })).status, 400);
  assert.equal((await worker.fetch(post({ q: 'a'.repeat(32), u: 'https://example.com/', p: 0 }), { DB })).status, 400);
  assert.equal(DB.calls.length, 0);
});

test('counts are read by search code', async () => {
  const DB = stubDb();
  const res = await worker.fetch(new Request(`https://clicks.example/counts?q=${'b'.repeat(32)}`, { headers: { Origin: SITE } }), { DB });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { pages: [{ u: 'https://a.com/', n: 7 }] });
  assert.equal(DB.calls[0].args[0], 'b'.repeat(32));
});
