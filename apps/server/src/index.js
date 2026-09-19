import { createAuthService, clearSessionCookie } from './auth.js';
import { tryLoadSiteConfig } from './config.js';
import { HttpError, htmlResponse, jsonResponse, methodNotAllowed } from './http.js';
import { createWorkspaceRepositoryReader } from './workspace-reader.js';
import { assertSessionStore, createMemorySessionStore } from './session-store.js';
import { renderPrivateSiteShell } from '../../web/src/index.js';

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

export function createPrivateSiteApp({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
  sessionStore = null,
  runtimeError = null
} = {}) {
  const state = tryLoadSiteConfig(env);
  const configured = state.configured && !runtimeError;
  const store = configured ? assertSessionStore(sessionStore || createMemorySessionStore({ now })) : null;
  const auth = configured ? createAuthService({ config: state.config, sessionStore: store, fetchImpl, now }) : null;
  const reader = configured ? createWorkspaceRepositoryReader({ config: state.config, fetchImpl, now }) : null;
  const configurationError = runtimeError || state.error;

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

      if (pathname === '/') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return htmlResponse(200, renderPrivateSiteShell(), {
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
          const authorized = await auth.authorize(request);
          return jsonResponse(200, {
            authenticated: true,
            user: {
              id: authorized.user.id,
              login: authorized.user.login,
              avatar_url: authorized.user.avatarUrl,
              permission: authorized.user.permission
            },
            expires_at: authorized.user.expiresAt
          });
        }
        if (request.method === 'POST') {
          assertSameOrigin(request, config);
          return await auth.logout(request);
        }
        return methodNotAllowed(['GET', 'POST']);
      }

      if (pathname === '/api/cards') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        await auth.authorize(request);
        const result = await reader.listCards({
          limit: url.searchParams.get('limit'),
          cursor: url.searchParams.get('cursor')
        });
        return jsonResponse(200, result);
      }

      if (pathname.startsWith('/api/cards/')) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        await auth.authorize(request);
        return jsonResponse(200, await reader.getCard(safeCardId(pathname)));
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
