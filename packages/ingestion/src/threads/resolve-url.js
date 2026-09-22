const CANONICAL_THREADS_ORIGIN = 'https://threads.com';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isThreadsHost(hostname) {
  const host = hostname.toLowerCase();
  return host === 'threads.com' || host.endsWith('.threads.com') || host === 'threads.net' || host.endsWith('.threads.net');
}

function normalizePostPath(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || !parts[0].startsWith('@') || parts[1].toLowerCase() !== 'post' || !parts[2]) {
    return null;
  }
  return `/${parts[0]}/post/${parts[2]}`;
}

export function classifyThreadsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isThreads: false, kind: 'invalid', url: null };
  }

  if (!isThreadsHost(parsed.hostname)) {
    return { isThreads: false, kind: 'other', url: parsed.toString() };
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  let kind = 'other';
  if (parts[0]?.toLowerCase() === 'share' && parts[1]) {
    kind = 'share';
  } else if (parts[0]?.toLowerCase() === 't' && parts[1]) {
    kind = 'short';
  } else if (normalizePostPath(parsed)) {
    kind = 'post';
  }

  return {
    isThreads: true,
    kind,
    url: parsed.toString(),
    token: kind === 'share' || kind === 'short' ? parts[1] : null,
    shortcode: kind === 'post' ? parts[2] : null
  };
}

export function normalizeThreadsPostUrl(rawUrl) {
  const parsed = new URL(rawUrl.trim());
  if (!isThreadsHost(parsed.hostname)) {
    throw new Error('URL is not hosted by Threads.');
  }
  const pathname = normalizePostPath(parsed);
  if (!pathname) {
    throw new Error('URL is not a canonical Threads post URL.');
  }
  return `${CANONICAL_THREADS_ORIGIN}${pathname}`;
}

function getHeader(response, name) {
  if (!response?.headers) return null;
  if (typeof response.headers.get === 'function') return response.headers.get(name);
  const key = Object.keys(response.headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? response.headers[key] : null;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function getAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match ? decodeHtmlAttribute(match[2]) : null;
}

export function extractThreadsCanonicalUrlFromHtml(html, baseUrl) {
  if (!html) return null;
  const tags = html.match(/<(?:link|meta)\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const rel = getAttribute(tag, 'rel')?.toLowerCase();
    const property = getAttribute(tag, 'property')?.toLowerCase();
    const name = getAttribute(tag, 'name')?.toLowerCase();
    let candidate = null;

    if (rel?.split(/\s+/).includes('canonical')) {
      candidate = getAttribute(tag, 'href');
    } else if (property === 'og:url' || name === 'og:url') {
      candidate = getAttribute(tag, 'content');
    }

    if (!candidate) continue;
    try {
      const absolute = new URL(candidate, baseUrl).toString();
      if (classifyThreadsUrl(absolute).kind === 'post') {
        return normalizeThreadsPostUrl(absolute);
      }
    } catch {
      // Ignore malformed metadata candidates and continue searching.
    }
  }

  // Threads may render a SPA shell whose canonical post URL only appears inside
  // embedded JSON. Normalize common JSON escaping and scan conservatively.
  const unescaped = decodeHtmlAttribute(html)
    .replaceAll('\\/', '/')
    .replaceAll('\\u002F', '/');
  const embedded = /https?:\/\/(?:www\.)?threads\.(?:com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/i.exec(unescaped)?.[0];
  if (embedded) {
    return normalizeThreadsPostUrl(embedded);
  }

  return null;
}

function assertSafeThreadsRedirect(targetUrl) {
  const parsed = new URL(targetUrl);
  if (!isThreadsHost(parsed.hostname)) {
    const error = new Error(`Threads redirect left the allowed Threads hosts: ${parsed.hostname}`);
    error.code = 'THREADS_UNSAFE_REDIRECT';
    throw error;
  }
}

async function requestWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveViaHttp(rawUrl, { fetchImpl, timeoutMs, maxRedirects }) {
  let currentUrl = rawUrl;
  let redirectCount = 0;

  for (;;) {
    const response = await requestWithTimeout(fetchImpl, currentUrl, timeoutMs);
    const status = Number(response?.status || 0);

    if (REDIRECT_STATUSES.has(status)) {
      if (redirectCount >= maxRedirects) {
        const error = new Error(`Threads redirect limit exceeded (${maxRedirects}).`);
        error.code = 'THREADS_REDIRECT_LIMIT';
        throw error;
      }
      const location = getHeader(response, 'location');
      if (!location) {
        const error = new Error(`Threads returned HTTP ${status} without a Location header.`);
        error.code = 'THREADS_REDIRECT_MISSING_LOCATION';
        throw error;
      }

      const nextUrl = new URL(location, currentUrl).toString();
      assertSafeThreadsRedirect(nextUrl);
      redirectCount += 1;

      if (classifyThreadsUrl(nextUrl).kind === 'post') {
        return {
          canonicalUrl: normalizeThreadsPostUrl(nextUrl),
          method: 'http_redirect',
          redirectCount
        };
      }

      currentUrl = nextUrl;
      continue;
    }

    const responseUrl = response?.url || currentUrl;
    if (classifyThreadsUrl(responseUrl).kind === 'post') {
      return {
        canonicalUrl: normalizeThreadsPostUrl(responseUrl),
        method: 'http_redirect',
        redirectCount
      };
    }

    const html = typeof response?.text === 'function' ? await response.text() : '';
    const metadataUrl = extractThreadsCanonicalUrlFromHtml(html, responseUrl);
    if (metadataUrl) {
      return {
        canonicalUrl: metadataUrl,
        method: 'html_metadata',
        redirectCount
      };
    }

    return null;
  }
}

async function resolveViaBrowser(rawUrl, browserResolver) {
  if (typeof browserResolver !== 'function') return null;
  const result = await browserResolver(rawUrl);
  const candidate = typeof result === 'string'
    ? result
    : result?.canonicalUrl || result?.canonical_url || result?.url || null;
  if (!candidate || classifyThreadsUrl(candidate).kind !== 'post') return null;
  return normalizeThreadsPostUrl(candidate);
}

export async function resolveThreadsUrl(rawUrl, options = {}) {
  const classified = classifyThreadsUrl(rawUrl);
  if (!classified.isThreads) {
    throw new Error('resolveThreadsUrl only accepts threads.com or threads.net URLs.');
  }

  if (classified.kind === 'post') {
    return {
      provider: 'threads',
      input_url: rawUrl,
      input_kind: 'post',
      canonical_url: normalizeThreadsPostUrl(rawUrl),
      method: 'direct',
      transient: false,
      redirect_count: 0
    };
  }

  if (classified.kind !== 'share' && classified.kind !== 'short') {
    const error = new Error(`Unsupported Threads URL path: ${new URL(rawUrl).pathname}`);
    error.code = 'THREADS_UNSUPPORTED_URL';
    throw error;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxRedirects = options.maxRedirects ?? 5;
  let httpError = null;

  if (typeof fetchImpl === 'function') {
    try {
      const httpResult = await resolveViaHttp(rawUrl, { fetchImpl, timeoutMs, maxRedirects });
      if (httpResult) {
        return {
          provider: 'threads',
          input_url: rawUrl,
          input_kind: classified.kind,
          canonical_url: httpResult.canonicalUrl,
          method: httpResult.method,
          transient: true,
          redirect_count: httpResult.redirectCount
        };
      }
    } catch (error) {
      httpError = error;
    }
  }

  try {
    const browserUrl = await resolveViaBrowser(rawUrl, options.browserResolver);
    if (browserUrl) {
      return {
        provider: 'threads',
        input_url: rawUrl,
        input_kind: classified.kind,
        canonical_url: browserUrl,
        method: 'browser',
        transient: true,
        redirect_count: null
      };
    }
  } catch (error) {
    const wrapped = new Error(`Threads browser fallback failed: ${error instanceof Error ? error.message : String(error)}`);
    wrapped.code = 'THREADS_BROWSER_RESOLUTION_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }

  const message = httpError
    ? `Threads transient URL could not be resolved by HTTP and no browser fallback succeeded: ${httpError.message}`
    : 'Threads transient URL could not be resolved and no browser fallback is configured.';
  const error = new Error(message);
  error.code = 'THREADS_RESOLUTION_FAILED';
  error.cause = httpError;
  throw error;
}
