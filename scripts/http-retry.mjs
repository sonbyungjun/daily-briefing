const RETRYABLE_STATUSES = new Set([403, 408, 409, 425, 429, 500, 502, 503, 504]);

function getHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

function retryAfterMs(headers) {
  const value = getHeader(headers, 'retry-after');
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
}

function nextDelayMs({ attempt, baseDelayMs, maxDelayMs, headers }) {
  const serverDelayMs = retryAfterMs(headers);
  if (serverDelayMs !== null) return serverDelayMs;
  return Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
}

export async function fetchTextWithRetry(url, {
  retries = 4,
  baseDelayMs = 3000,
  maxDelayMs = 30000,
  fetcher = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = () => {},
  headers = {},
} = {}) {
  let lastStatus = 'unknown';
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetcher(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
          'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          ...headers,
        },
      });
      lastStatus = res.status;
      if (res.ok) return await res.text();

      const retryable = RETRYABLE_STATUSES.has(res.status);
      if (!retryable || attempt >= retries) {
        throw new Error(`${url} ${res.status}`);
      }

      const delayMs = nextDelayMs({ attempt, baseDelayMs, maxDelayMs, headers: res.headers });
      log(`fetch retry (${attempt}/${retries}): ${url} ${res.status}; waiting ${delayMs}ms`);
      await sleep(delayMs);
    } catch (e) {
      lastError = e;
      lastStatus = e?.message || 'fetch error';

      if (attempt >= retries || /^https?:\/\/.+\s\d{3}$/.test(String(lastStatus))) {
        throw e;
      }

      const delayMs = nextDelayMs({ attempt, baseDelayMs, maxDelayMs, headers: null });
      log(`fetch retry (${attempt}/${retries}): ${url} ${lastStatus}; waiting ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  throw new Error(`${url} ${lastError?.message || lastStatus}`);
}
