export async function verifyUrlWithRetry(url, {
  retries = 20,
  delayMs = 15000,
  fetcher = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = () => {},
} = {}) {
  let lastStatus = 'unknown';
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetcher(url, { cache: 'no-store' });
      lastStatus = res.status;
      if (res.ok) return res;
    } catch (e) {
      lastError = e;
      lastStatus = e?.message || 'fetch error';
    }

    if (attempt < retries) {
      log(`verify pending (${attempt}/${retries}): ${url} ${lastStatus}`);
      await sleep(delayMs);
    }
  }

  const detail = lastError?.message || lastStatus;
  throw new Error(`HTTP verify failed: ${url} ${detail}`);
}
