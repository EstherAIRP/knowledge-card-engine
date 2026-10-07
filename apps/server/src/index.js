import { AsyncLocalStorage } from 'node:async_hooks';
import { createAuthService, clearSessionCookie } from './auth.js';
import { tryLoadSiteConfig } from './config.js';
import { HttpError, htmlResponse, jsonResponse, methodNotAllowed } from './http.js';
import { createWorkspaceRepositoryReader } from './workspace-reader.js';
import { assertSessionStore, createMemorySessionStore } from './session-store.js';
import {
  createSitePerformanceTrace,
  logBrowserPerformance,
  sitePerformanceEnabled
} from './performance.js';
import { renderPrivateSiteShell } from '../../web/src/index.js';
import { instrumentPrivateSiteShell } from '../../web/src/performance-runtime.js';

export const moduleId = 'server';
export const moduleKind = 'app';

function configuredOrThrow(state) {
  if (!state.configured || !state.config) {
    throw new HttpError(503, 'SITE_NOT_CONFIGURED', 'Private site configuration is incomplete.');
  }
  return state.config;
}

function withClearedSession(response) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', clearSessionCookie());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function failure(error) {
  if (error instanceof HttpError) {
    const response = jsonResponse(error.status, { code: error.code, detail: error.message });
    return error.clearSession ? withClearedSession(response) : response;
  }
  return jsonResponse(500, { code: 'INTERNAL_ERROR', detail: 'Unexpected server error.' });
}

function safeCardId(pathname) {
  const encoded = pathname.slice('/api/cards/'.length);
  if (!encoded || encoded.includes('/')) throw new HttpError(400, 'CARD_ID_INVALID', 'Card id is invalid.');
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new HttpError(400, 'CARD_ID_INVALID', 'Card id is invalid.');
  }
}

function assertSameOrigin(request, config) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(config.publicUrl).origin) {
    throw new HttpError(403, 'CSRF_ORIGIN_INVALID', 'Request origin is not allowed.');
  }
}

function requestUrl(input) {
  try {
    if (input instanceof Request) return new URL(input.url);
    return new URL(String(input));
  } catch {
    return null;
  }
}

export function createPrivateSiteApp({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
  sessionStore = null,
  runtimeError = null,
  performanceLogger = console.info
} = {}) {
  const state = tryLoadSiteConfig(env);
  const configured = state.configured && !runtimeError;
  const performanceEnabled = sitePerformanceEnabled(env);
  const performanceContext = performanceEnabled ? new AsyncLocalStorage() : null;

  const measuredFetchImpl = performanceEnabled
    ? async (input, options) => {
        const context = performanceContext.getStore();
        if (!context) return fetchImpl(input, options);
        const url = requestUrl(input);
        const isGithub = url?.hostname === 'api.github.com' || url?.hostname === 'github.com';
        const isBlob = isGithub && /\/git\/blobs\//u.test(url.pathname);
        const started = performance.now();
        try {
          return await fetchImpl(input, options);
        } finally {
          if (isGithub) {
            const duration = Math.max(0, performance.now() - started);
            context.githubCalls += 1;
            context.githubMs += duration;
            if (isBlob) {
              context.blobCalls += 1;
              context.blobMs += duration;
            }
          }
        }
      }
    : fetchImpl;

  const store = configured ? assertSessionStore(sessionStore || createMemorySessionStore({ now })) : null;
  const auth = configured ? createAuthService({ config: state.config, sessionStore: store, fetchImpl: measuredFetchImpl, now }) : null;
  const reader = configured ? createWorkspaceRepositoryReader({ config: state.config, fetchImpl: measuredFetchImpl, now }) : null;
  const configurationError = runtimeError || state.error;

  async function withUpstreamMeasurements(trace, prefix, task) {
    if (!performanceEnabled) return task();
    const upstream = {
      githubCalls: 0,
      githubMs: 0,
      blobCalls: 0,
      blobMs: 0
    };
    try {
      return await performanceContext.run(upstream, task);
    } finally {
      trace.record(prefix + '_github', upstream.githubMs);
      trace.record(prefix + '_blob', upstream.blobMs);
      trace.recordValue(prefix + '_github_calls', upstream.githubCalls);
      trace.recordValue(prefix + '_blob_calls', upstream.blobCalls);
    }
  }

  async function authorizedJson(request, route, task) {
    const trace = createSitePerformanceTrace({
      enabled: performanceEnabled,
      route,
      logger: performanceLogger
    });
    try {
      const authorized = await trace.measure('auth', () =>
        withUpstreamMeasurements(trace, 'auth', () => auth.authorize(request))
      );
      const payload = await trace.measure('handler', () =>
        withUpstreamMeasurements(trace, 'handler', () => task(authorized))
      );
      const response = jsonResponse(200, payload, trace.headers());
      trace.finish(200);
      return response;
    } catch (error) {
      trace.finish(error instanceof HttpError ? error.status : 500);
      throw error;
    }
  }

  return async function handle(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (pathname === '/api/health') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return jsonResponse(200, {
          status: configured ? 'ok' : 'unconfigured',
          configured,
          ...(configured ? {} : {
            configuration_error: {
              code: configurationError?.code || 'SITE_CONFIG_INVALID',
              detail: configurationError?.message || 'Private site configuration is invalid.'
            }
          })
        });
      }

      if (pathname === '/' || /^\/knowledge\/[^/]+$/u.test(pathname)) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        const shell = renderPrivateSiteShell();
        return htmlResponse(200, performanceEnabled ? instrumentPrivateSiteShell(shell) : shell, {
          'Content-Security-Policy': [
            "default-src 'self'",
            "img-src 'self' https://avatars.githubusercontent.com data:",
            "style-src 'unsafe-inline'",
            "script-src 'unsafe-inline'",
            "connect-src 'self'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'"
          ].join('; '),
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer'
        });
      }

      const config = configuredOrThrow({ configured, config: state.config });

      if (pathname === '/api/auth/login') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return auth.beginLogin();
      }

      if (pathname === '/api/auth/callback') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return auth.finishLogin(request);
      }

      if (pathname === '/api/auth/session') {
        if (request.method === 'GET') {
          return await authorizedJson(request, 'auth_session', async (authorized) => ({
            authenticated: true,
            user: {
              id: authorized.user.id,
              login: authorized.user.login,
              avatar_url: authorized.user.avatarUrl,
              permission: authorized.user.permission
            },
            expires_at: authorized.user.expiresAt
          }));
        }
        if (request.method === 'POST') {
          assertSameOrigin(request, config);
          return await auth.logout(request);
        }
        return methodNotAllowed(['GET', 'POST']);
      }

      if (pathname === '/api/performance') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        await auth.authorize(request);
        logBrowserPerformance({
          enabled: performanceEnabled,
          searchParams: url.searchParams,
          logger: performanceLogger
        });
        return new Response(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' }
        });
      }

      if (pathname === '/api/cards') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return await authorizedJson(request, 'cards_list', async () => reader.listCards({
          limit: url.searchParams.get('limit'),
          cursor: url.searchParams.get('cursor')
        }));
      }

      if (pathname.startsWith('/api/cards/')) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return await authorizedJson(request, 'card_detail', async () => reader.getCard(safeCardId(pathname)));
      }

      if (pathname === '/api/search') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return await authorizedJson(request, 'search', async () => reader.search({
          query: url.searchParams.get('q'),
          limit: url.searchParams.get('limit')
        }));
      }

      if (pathname === '/api/graph') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return await authorizedJson(request, 'graph', async () => reader.graph());
      }

      if (pathname === '/api/release') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return await authorizedJson(request, 'release', async () => reader.release());
      }

      if (pathname.startsWith('/api/')) {
        return jsonResponse(404, { code: 'API_NOT_FOUND', detail: 'API endpoint not found.' });
      }

      return htmlResponse(404, '<!doctype html><meta charset="utf-8"><title>Not Found</title><p>Not found.</p>');
    } catch (error) {
      return failure(error);
    }
  };
}
