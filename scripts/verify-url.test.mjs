#!/usr/bin/env node
import assert from 'node:assert/strict';
import { verifyUrlWithRetry } from './verify-url.mjs';

async function testRetriesUntilUrlIsReady() {
  let attempts = 0;
  const res = await verifyUrlWithRetry('https://example.com/today', {
    retries: 3,
    delayMs: 1,
    sleep: async () => {},
    fetcher: async () => {
      attempts += 1;
      return { ok: attempts === 2, status: attempts === 2 ? 200 : 404 };
    },
  });

  assert.equal(res.status, 200);
  assert.equal(attempts, 2);
}

async function testThrowsLastStatusAfterRetries() {
  let attempts = 0;

  await assert.rejects(
    () => verifyUrlWithRetry('https://example.com/missing', {
      retries: 2,
      delayMs: 1,
      sleep: async () => {},
      fetcher: async () => {
        attempts += 1;
        return { ok: false, status: 404 };
      },
    }),
    /HTTP verify failed: https:\/\/example\.com\/missing 404/
  );

  assert.equal(attempts, 2);
}

await testRetriesUntilUrlIsReady();
await testThrowsLastStatusAfterRetries();
