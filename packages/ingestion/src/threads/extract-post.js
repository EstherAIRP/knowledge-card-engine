import { classifyThreadsUrl, resolveThreadsUrl } from './resolve-url.js';
import { normalizeThreadsPost } from './normalize.js';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

function decodeHtmlEntities(value) {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match ? decodeHtmlEntities(match[2]) : null;
}

function parseJsonText(text) {
  let value = decodeHtmlEntities(text).trim();
  if (!value) return null;
  value = value.replace(/^<!--/, '').replace(/-->$/, '').trim();
  value = value.replace(/^for\s*\(;;\);?\s*/, '').trim();
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function extractThreadsJsonPayloads(html) {
  const payloads = [];
  const scripts = String(html || '').match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const openTag = /^<script\b[^>]*>/i.exec(script)?.[0] || '';
    const type = getAttribute(openTag, 'type')?.toLowerCase();
    if (type && !['application/json', 'application/ld+json'].includes(type)) continue;
    const body = script.slice(openTag.length).replace(/<\/script>$/i, '');
    const parsed = parseJsonText(body);
    if (parsed !== null) payloads.push(parsed);
  }
  return payloads;
}

function shortcodeFromObject(raw) {
  const direct = raw?.shortcode || raw?.code;
  if (direct) return String(direct);
  for (const candidate of [raw?.permalink, raw?.url, raw?.canonical_url]) {
    if (!candidate) continue;
    try {
      const classified = classifyThreadsUrl(String(candidate));
      if (classified.kind === 'post') return classified.shortcode;
    } catch {
      // Ignore malformed URL candidates.
    }
  }
  return null;
}

function hasTextSignal(raw) {
  return typeof raw?.text === 'string'
    || typeof raw?.caption === 'string'
    || typeof raw?.caption?.text === 'string'
    || typeof raw?.body === 'string'
    || typeof raw?.content?.text === 'string';
}

function hasAuthorSignal(raw) {
  return Boolean(raw?.username || raw?.user?.username || raw?.owner?.username || raw?.author?.username);
}

function scorePostCandidate(raw, expectedShortcode, canonicalUrl) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return -Infinity;
  let score = 0;
  const shortcode = shortcodeFromObject(raw);
  if (shortcode && expectedShortcode && shortcode === expectedShortcode) score += 200;
  else if (shortcode) score += 20;

  const urls = [raw.permalink, raw.url, raw.canonical_url].filter(Boolean).map(String);
  if (canonicalUrl && urls.some((url) => {
    try {
      return classifyThreadsUrl(url).kind === 'post'
        && new URL(url).pathname.toLowerCase() === new URL(canonicalUrl).pathname.toLowerCase();
    } catch {
      return false;
    }
  })) score += 150;

  if (raw.id || raw.pk || raw.post_id || raw.media_id) score += 20;
  if (hasAuthorSignal(raw)) score += 20;
  if (hasTextSignal(raw)) score += 20;
  if (raw.taken_at || raw.timestamp || raw.created_at) score += 5;
  if (raw.text_post_app_info || raw.reply_info) score += 5;
  if (raw.image_versions2 || raw.video_versions || raw.carousel_media || raw.media_url) score += 5;

  return score;
}

function walkObjects(root, visitor, options = {}) {
  const maxNodes = options.maxNodes ?? 50000;
  const stack = [root];
  const seen = new Set();
  let visited = 0;

  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;
    if (visited > maxNodes) break;

    visitor(value);
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) stack.push(value[i]);
    } else {
      for (const child of Object.values(value)) {
        if (child && typeof child === 'object') stack.push(child);
      }
    }
  }
}

export function findThreadsPostCandidate(payloads, options = {}) {
  const expectedShortcode = options.expectedShortcode || null;
  const canonicalUrl = options.canonicalUrl || null;
  let best = null;
  let bestScore = -Infinity;

  for (const payload of payloads || []) {
    walkObjects(payload, (candidate) => {
      const score = scorePostCandidate(candidate, expectedShortcode, canonicalUrl);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }, options);
  }

  const minimumScore = expectedShortcode ? 220 : 45;
  if (!best || bestScore < minimumScore) return null;
  return best;
}

export function extractThreadsPostFromHtml(html, canonicalUrl, options = {}) {
  const classified = classifyThreadsUrl(canonicalUrl);
  if (!classified.isThreads || classified.kind !== 'post') {
    throw new Error('extractThreadsPostFromHtml requires a canonical Threads post URL.');
  }

  const payloads = extractThreadsJsonPayloads(html);
  const candidate = findThreadsPostCandidate(payloads, {
    expectedShortcode: classified.shortcode,
    canonicalUrl,
    maxNodes: options.maxNodes
  });
  if (!candidate) return null;

  return normalizeThreadsPost(candidate, {
    canonicalUrl,
    expectedShortcode: classified.shortcode,
    method: options.method || 'html_embedded_json',
    confidence: 'high'
  });
}

async function fetchThreadsHtml(canonicalUrl, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return { html: null, error: null };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(canonicalUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });

    const status = Number(response?.status || 0);
    if (status < 200 || status >= 300) {
      const error = new Error(`Threads post HTML request returned HTTP ${status || 'unknown'}.`);
      error.code = 'THREADS_POST_HTTP_ERROR';
      return { html: null, error };
    }

    const responseUrl = response?.url || canonicalUrl;
    const classified = classifyThreadsUrl(responseUrl);
    if (!classified.isThreads) {
      const error = new Error(`Threads post request left the Threads domain: ${responseUrl}`);
      error.code = 'THREADS_POST_UNSAFE_REDIRECT';
      return { html: null, error };
    }

    const html = typeof response?.text === 'function' ? await response.text() : '';
    return { html, error: null };
  } catch (error) {
    return { html: null, error };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeFallbackResult(result, canonicalUrl, expectedShortcode, method) {
  if (!result) return null;
  const raw = result.post && typeof result.post === 'object' ? result.post : result;
  const returnedShortcode = shortcodeFromObject(raw);
  if (!returnedShortcode) {
    const error = new Error(`${method} fallback did not provide a verifiable Threads shortcode or permalink.`);
    error.code = 'THREADS_POST_UNVERIFIED';
    throw error;
  }
  if (returnedShortcode !== expectedShortcode) {
    const error = new Error(`${method} fallback returned Threads post ${returnedShortcode}, expected ${expectedShortcode}.`);
    error.code = 'THREADS_POST_MISMATCH';
    throw error;
  }

  return normalizeThreadsPost(raw, {
    canonicalUrl,
    expectedShortcode,
    method,
    confidence: 'high'
  });
}

export async function extractResolvedThreadsPost(canonicalUrl, options = {}) {
  const classified = classifyThreadsUrl(canonicalUrl);
  if (!classified.isThreads || classified.kind !== 'post') {
    throw new Error('extractResolvedThreadsPost requires a canonical Threads post URL.');
  }

  let extractionError = null;
  if (options.html !== undefined) {
    const post = extractThreadsPostFromHtml(options.html, canonicalUrl, options);
    if (post) return post;
  } else {
    const fetched = await fetchThreadsHtml(canonicalUrl, options);
    extractionError = fetched.error;
    if (fetched.html) {
      const post = extractThreadsPostFromHtml(fetched.html, canonicalUrl, options);
      if (post) return post;
    }
  }

  if (typeof options.apiExtractor === 'function') {
    try {
      const result = await options.apiExtractor({
        provider: 'threads',
        canonical_url: canonicalUrl,
        shortcode: classified.shortcode
      });
      const post = normalizeFallbackResult(result, canonicalUrl, classified.shortcode, 'api');
      if (post) return post;
    } catch (error) {
      extractionError ||= error;
    }
  }

  if (typeof options.browserExtractor === 'function') {
    try {
      const result = await options.browserExtractor({
        provider: 'threads',
        canonical_url: canonicalUrl,
        shortcode: classified.shortcode
      });
      const post = normalizeFallbackResult(result, canonicalUrl, classified.shortcode, 'browser');
      if (post) return post;
    } catch (error) {
      extractionError ||= error;
    }
  }

  const error = new Error(extractionError
    ? `Threads post could not be extracted from primary HTML or fallbacks: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`
    : 'Threads post could not be extracted from primary HTML and no fallback succeeded.');
  error.code = 'THREADS_POST_EXTRACTION_FAILED';
  error.cause = extractionError;
  throw error;
}

export async function extractThreadsPost(rawUrl, options = {}) {
  const resolved = options.resolvedSource || await resolveThreadsUrl(rawUrl, {
    fetchImpl: options.resolveFetchImpl || options.fetchImpl,
    timeoutMs: options.resolveTimeoutMs ?? options.timeoutMs,
    maxRedirects: options.maxRedirects,
    browserResolver: options.urlBrowserResolver
  });

  return extractResolvedThreadsPost(resolved.canonical_url, options);
}
