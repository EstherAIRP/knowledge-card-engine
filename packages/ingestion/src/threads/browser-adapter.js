import { extractThreadsConversationRecordsFromHtml, extractThreadsUiThreadIndicator } from './conversation.js';
import { classifyThreadsUrl, extractThreadsCanonicalUrlFromHtml, normalizeThreadsPostUrl } from './resolve-url.js';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30000;
const DEFAULT_SETTLE_TIMEOUT_MS = 5000;
const DEFAULT_SCROLL_ROUNDS = 2;
const DEFAULT_SCROLL_WAIT_MS = 650;
const DEFAULT_MAX_NETWORK_PAYLOADS = 60;
const DEFAULT_MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

function isThreadsHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'threads.com' || host.endsWith('.threads.com') || host === 'threads.net' || host.endsWith('.threads.net');
}

function isSafeThreadsUrl(rawUrl) {
  try {
    return isThreadsHost(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

function safeJsonText(value) {
  try {
    return JSON.stringify(value).replaceAll('<', '\\u003c');
  } catch {
    return null;
  }
}

function payloadsToSyntheticHtml(payloads) {
  const scripts = [];
  for (const payload of payloads || []) {
    const json = safeJsonText(payload);
    if (json) scripts.push(`<script type="application/json">${json}</script>`);
  }
  return `<!doctype html><html><body>${scripts.join('')}</body></html>`;
}

function postKey(post) {
  if (post?.id) return `id:${post.id}`;
  if (post?.shortcode) return `shortcode:${post.shortcode}`;
  return null;
}

function postRichness(post) {
  if (!post) return -1;
  let score = 0;
  if (post.text) score += 8;
  if (post.username) score += 4;
  if (post.timestamp) score += 2;
  if (post.reply_to) score += 4;
  if (post.root_post) score += 4;
  if (post.has_replies !== null && post.has_replies !== undefined) score += 2;
  if (Array.isArray(post.media)) score += Math.min(post.media.length, 4);
  return score;
}

function mergeRecordPosts(...groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const record of group || []) {
      const post = record?.post || record;
      const key = postKey(post);
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing || postRichness(post) > postRichness(existing)) byKey.set(key, post);
    }
  }
  return [...byKey.values()];
}

async function responseContentType(response) {
  try {
    if (typeof response?.headerValue === 'function') {
      return String(await response.headerValue('content-type') || '').toLowerCase();
    }
    if (typeof response?.allHeaders === 'function') {
      const headers = await response.allHeaders();
      return String(headers?.['content-type'] || '').toLowerCase();
    }
    if (typeof response?.headers === 'function') {
      const headers = await response.headers();
      return String(headers?.['content-type'] || '').toLowerCase();
    }
  } catch {
    // Content type is only a hint; endpoint matching still applies.
  }
  return '';
}

async function maybeCaptureJsonResponse(response, options) {
  const url = typeof response?.url === 'function' ? response.url() : response?.url;
  if (!url || !isSafeThreadsUrl(url)) return null;

  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  const contentType = await responseContentType(response);
  const likelyJson = pathname.includes('graphql')
    || pathname.includes('/api/')
    || contentType.includes('json');
  if (!likelyJson || typeof response?.json !== 'function') return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (typeof response?.text === 'function') {
      try {
        const raw = String(await response.text() || '').replace(/^for\s*\(;;\);?\s*/, '').trim();
        if (raw) payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }
  }
  if (payload === null || payload === undefined) return null;
  const json = safeJsonText(payload);
  if (!json || json.length > (options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES)) return null;
  return payload;
}

function browserUnavailableError(cause) {
  const error = new Error('Playwright is required for the Threads browser fallback. Run `npm install` and `npm run threads:browser:install`, or configure THREADS_BROWSER_CHANNEL=chrome to use an installed Chrome channel.');
  error.code = 'THREADS_BROWSER_UNAVAILABLE';
  error.cause = cause;
  return error;
}

async function defaultBrowserSessionFactory(options = {}) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (cause) {
    throw browserUnavailableError(cause);
  }

  const chromium = playwright?.chromium;
  if (!chromium?.launch) throw browserUnavailableError(null);

  const executablePath = options.executablePath || process.env.THREADS_BROWSER_EXECUTABLE || null;
  const configuredChannel = options.channel || process.env.THREADS_BROWSER_CHANNEL || null;
  const baseLaunch = {
    headless: options.headless ?? true,
    ...(Array.isArray(options.browserArgs) && options.browserArgs.length ? { args: options.browserArgs } : {})
  };
  const candidates = [];
  if (executablePath) {
    candidates.push({ ...baseLaunch, executablePath, label: 'executable' });
  } else if (configuredChannel) {
    candidates.push({ ...baseLaunch, channel: configuredChannel, label: `channel:${configuredChannel}` });
  } else {
    candidates.push({ ...baseLaunch, label: 'bundled-chromium' });
    candidates.push({ ...baseLaunch, channel: 'chrome', label: 'channel:chrome' });
  }

  const launchErrors = [];
  let browser = null;
  let launchMethod = null;
  for (const candidate of candidates) {
    const { label, ...launchOptions } = candidate;
    try {
      browser = await chromium.launch(launchOptions);
      launchMethod = label;
      break;
    } catch (error) {
      launchErrors.push(error);
    }
  }

  if (!browser) {
    const error = new Error('Threads browser fallback could not launch Chromium or Chrome. Install Chromium with `npm run threads:browser:install`, or set THREADS_BROWSER_EXECUTABLE / THREADS_BROWSER_CHANNEL.');
    error.code = 'THREADS_BROWSER_LAUNCH_FAILED';
    error.causes = launchErrors;
    throw error;
  }

  try {
    const context = await browser.newContext({
      userAgent: options.userAgent || DEFAULT_USER_AGENT,
      locale: options.locale || 'en-US',
      viewport: options.viewport || { width: 1280, height: 1800 }
    });
    const page = await context.newPage();
    return { browser, context, page, launch_method: launchMethod };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function closeBrowserSession(session) {
  if (!session) return;
  try {
    if (typeof session.context?.close === 'function') await session.context.close();
  } catch {
    // Continue cleanup.
  }
  try {
    if (typeof session.browser?.close === 'function') await session.browser.close();
  } catch {
    // Ignore cleanup failures.
  }
}

async function waitForSettle(page, options) {
  if (typeof page?.waitForLoadState === 'function') {
    try {
      await page.waitForLoadState('networkidle', { timeout: options.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS });
    } catch {
      // Threads may keep long-lived requests open; networkidle is best-effort only.
    }
  }

  const rounds = options.scrollRounds ?? DEFAULT_SCROLL_ROUNDS;
  for (let i = 0; i < rounds; i += 1) {
    if (typeof page?.evaluate === 'function') {
      try {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      } catch {
        break;
      }
    }
    if (typeof page?.waitForTimeout === 'function') {
      await page.waitForTimeout(options.scrollWaitMs ?? DEFAULT_SCROLL_WAIT_MS);
    }
  }
}

async function browseThreadsPage(rawUrl, options = {}) {
  if (!isSafeThreadsUrl(rawUrl)) {
    const error = new Error('Threads browser adapter only accepts threads.com or threads.net URLs.');
    error.code = 'THREADS_BROWSER_UNSAFE_URL';
    throw error;
  }

  const factory = options.browserSessionFactory || defaultBrowserSessionFactory;
  const session = await factory(options);
  const page = session?.page;
  if (!page || typeof page.goto !== 'function') {
    await closeBrowserSession(session);
    const error = new Error('Threads browser session factory did not provide a Playwright-compatible page.');
    error.code = 'THREADS_BROWSER_INVALID_SESSION';
    throw error;
  }

  const payloads = [];
  const pending = new Set();
  const maxPayloads = options.maxNetworkPayloads ?? DEFAULT_MAX_NETWORK_PAYLOADS;
  let responseHandler = null;

  if (typeof page.on === 'function') {
    responseHandler = (response) => {
      if (payloads.length >= maxPayloads) return;
      let task;
      task = maybeCaptureJsonResponse(response, options)
        .then((payload) => {
          if (payload && payloads.length < maxPayloads) payloads.push(payload);
        })
        .finally(() => pending.delete(task));
      pending.add(task);
    };
    page.on('response', responseHandler);
  }

  try {
    try {
      await page.goto(rawUrl, {
        waitUntil: 'domcontentloaded',
        timeout: options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS
      });
    } catch (cause) {
      const error = new Error(`Threads browser navigation failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      error.code = 'THREADS_BROWSER_NAVIGATION_FAILED';
      error.cause = cause;
      throw error;
    }

    await waitForSettle(page, options);
    if (pending.size) await Promise.allSettled([...pending]);

    const finalUrl = typeof page.url === 'function' ? page.url() : rawUrl;
    if (!isSafeThreadsUrl(finalUrl)) {
      const error = new Error(`Threads browser navigation left the allowed Threads hosts: ${finalUrl}`);
      error.code = 'THREADS_BROWSER_UNSAFE_REDIRECT';
      throw error;
    }

    const html = typeof page.content === 'function' ? await page.content() : '';
    return {
      final_url: finalUrl,
      html,
      payloads,
      launch_method: session.launch_method || 'custom'
    };
  } finally {
    if (responseHandler && typeof page.off === 'function') {
      try { page.off('response', responseHandler); } catch { /* no-op */ }
    }
    await closeBrowserSession(session);
  }
}

export function shouldAutoThreadsBrowserFallback(options = {}) {
  if (options.browserFallback === false) return false;
  if (options.browserFallback === true) return true;
  if (typeof options.browserSessionFactory === 'function') return true;
  return options.html === undefined && typeof options.fetchImpl !== 'function';
}

export async function resolveThreadsUrlViaBrowser(rawUrl, options = {}) {
  const snapshot = await browseThreadsPage(rawUrl, options);
  const finalClassified = classifyThreadsUrl(snapshot.final_url);
  if (finalClassified.kind === 'post') {
    return {
      canonical_url: normalizeThreadsPostUrl(snapshot.final_url),
      method: 'browser_navigation',
      launch_method: snapshot.launch_method
    };
  }

  const canonical = extractThreadsCanonicalUrlFromHtml(snapshot.html, snapshot.final_url || rawUrl);
  if (canonical) {
    return {
      canonical_url: canonical,
      method: 'browser_dom_metadata',
      launch_method: snapshot.launch_method
    };
  }

  const error = new Error('Threads browser loaded the share/short URL but could not determine a canonical post permalink.');
  error.code = 'THREADS_BROWSER_CANONICAL_NOT_FOUND';
  throw error;
}

export async function extractThreadsViaBrowser(canonicalUrl, options = {}) {
  const classified = classifyThreadsUrl(canonicalUrl);
  if (!classified.isThreads || classified.kind !== 'post') {
    const error = new Error('Threads browser extraction requires a canonical @user/post/<shortcode> URL.');
    error.code = 'THREADS_BROWSER_CANONICAL_REQUIRED';
    throw error;
  }

  const snapshot = await browseThreadsPage(canonicalUrl, options);
  const domRecords = extractThreadsConversationRecordsFromHtml(snapshot.html);
  const networkRecords = extractThreadsConversationRecordsFromHtml(payloadsToSyntheticHtml(snapshot.payloads));
  const posts = mergeRecordPosts(domRecords, networkRecords);
  const indicator = extractThreadsUiThreadIndicator(snapshot.html);

  if (!posts.length) {
    const error = new Error('Threads browser fallback rendered the page but found no verifiable post objects in DOM hydration or captured JSON responses.');
    error.code = 'THREADS_BROWSER_NO_POSTS';
    error.partial = {
      final_url: snapshot.final_url,
      network_payload_count: snapshot.payloads.length,
      thread_indicator: indicator
    };
    throw error;
  }

  return {
    provider: 'threads',
    posts,
    thread_indicator: indicator,
    complete: false,
    browser: {
      method: 'playwright_web_data',
      launch_method: snapshot.launch_method,
      final_url: snapshot.final_url,
      network_payload_count: snapshot.payloads.length,
      post_count: posts.length
    }
  };
}
