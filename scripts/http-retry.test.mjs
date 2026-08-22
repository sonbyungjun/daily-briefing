#!/usr/bin/env node
import assert from 'node:assert/strict';
import { fetchTextWithRetry } from './http-retry.mjs';

async function testRetriesRateLimitThenReturnsText() {
  let attempts = 0;
  const delays = [];

  const text = await fetchTextWithRetry('https://example.com/source', {
    retries: 3,
    baseDelayMs: 100,
    sleep: async ms => delays.push(ms),
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 429, headers: new Map([['retry-after', '2']]), text: async () => '' };
      }
      return { ok: true, status: 200, headers: new Map(), text: async () => 'ok' };
    },
  });

  assert.equal(text, 'ok');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [2000]);
}

async function testRetryAfterIsNotCappedByMaxDelay() {
  let attempts = 0;
  const delays = [];

  const text = await fetchTextWithRetry('https://example.com/slow-source', {
    retries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    sleep: async ms => delays.push(ms),
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 429, headers: new Map([['retry-after', '2']]), text: async () => '' };
      }
      return { ok: true, status: 200, headers: new Map(), text: async () => 'ok' };
    },
  });

  assert.equal(text, 'ok');
  assert.deepEqual(delays, [2000]);
}

async function testRetriesForbiddenThenReturnsText() {
  let attempts = 0;
  const delays = [];

  const text = await fetchTextWithRetry('https://example.com/blocked', {
    retries: 3,
    baseDelayMs: 100,
    sleep: async ms => delays.push(ms),
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 403, headers: new Map(), text: async () => '' };
      }
      return { ok: true, status: 200, headers: new Map(), text: async () => 'ok' };
    },
  });

  assert.equal(text, 'ok');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [100]);
}

async function testThrowsNonRetryableStatusImmediately() {
  let attempts = 0;

  await assert.rejects(
    () => fetchTextWithRetry('https://example.com/missing', {
      retries: 3,
      sleep: async () => {},
      fetcher: async () => {
        attempts += 1;
        return { ok: false, status: 404, headers: new Map(), text: async () => '' };
      },
    }),
    /https:\/\/example\.com\/missing 404/
  );

  assert.equal(attempts, 1);
}

await testRetriesRateLimitThenReturnsText();
await testRetryAfterIsNotCappedByMaxDelay();
await testRetriesForbiddenThenReturnsText();
await testThrowsNonRetryableStatusImmediately();
