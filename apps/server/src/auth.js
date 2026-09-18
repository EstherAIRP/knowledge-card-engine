import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { GITHUB_API_VERSION, githubHeaders } from './github.js';
import { HttpError, redirectResponse } from './http.js';
import { assertSessionStore } from './session-store.js';

const SESSION_COOKIE = '__Host-kc_session';
const FLOW_COOKIE = '__Host-kc_oauth';
const SESSION_MS = 60 * 60 * 1000;
const FLOW_MS = 10 * 60 * 1000;
const SESSION_ID = /^[A-Za-z0-9_-]{32,128}$/u;
const GITHUB_API = 'https://api.github.com';

function keyFor(secret) {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function sealFlow(payload, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function openFlow(token, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [ivRaw, tagRaw, encryptedRaw] = parts.map((part) => Buffer.from(part, 'base64url'));
    if (ivRaw.length !== 12 || tagRaw.length !== 16 || encryptedRaw.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), ivRaw);
    decipher.setAuthTag(tagRaw);
    const raw = Buffer.concat([decipher.update(encryptedRaw), decipher.final()]).toString('utf8');
    const payload = JSON.parse(raw);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function cookies(request) {
  const map = new Map();
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      map.set(name, decodeURIComponent(value));
    } catch {
      map.set(name, '');
    }
  }
  return map;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
}

export function clearSessionCookie() {
  return cookie(SESSION_COOKIE, '', 0);
}

function clearFlowCookie() {
  return cookie(FLOW_COOKIE, '', 0);
}

function callbackUrl(config) {
  return new URL('/api/auth/callback', config.publicUrl).toString();
}

function appRoot(config, authResult = '') {
  const url = new URL('/', config.publicUrl);
  if (authResult) url.searchParams.set('auth', authResult);
  return url.toString();
}

function authorizationUrl(config, state, challenge) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.githubClientId);
  url.searchParams.set('redirect_uri', callbackUrl(config));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('allow_signup', 'false');
  return url.toString();
}

function validLogin(login) {
  return typeof login === 'string' && /^[A-Za-z0-9-]{1,39}$/u.test(login);
}

async function responseJson(response) {
  return response.json().catch(() => ({}));
}

async function exchangeCode(config, code, verifier, fetchImpl) {
  let response;
  try {
    response = await fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Knowledge-Card-Engine'
      },
      body: new URLSearchParams({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
        redirect_uri: callbackUrl(config),
        code_verifier: verifier
      })
    });
  } catch {
    throw new HttpError(503, 'AUTH_UPSTREAM_UNAVAILABLE', 'GitHub login is temporarily unavailable.');
  }

  const payload = await responseJson(response);
  if (!response.ok || typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new HttpError(502, 'AUTH_TOKEN_EXCHANGE_FAILED', 'GitHub login token exchange failed.');
  }
  const expiresIn = Number(payload.expires_in);
  return {
    accessToken: payload.access_token,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null
  };
}

async function githubIdentity(accessToken, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${GITHUB_API}/user`, {
      headers: githubHeaders(accessToken)
    });
  } catch {
    throw new HttpError(503, 'AUTH_UPSTREAM_UNAVAILABLE', 'GitHub identity verification is temporarily unavailable.');
  }

  const payload = await responseJson(response);
  if (!response.ok || !Number.isInteger(payload.id) || !validLogin(payload.login)) {
    throw new HttpError(502, 'AUTH_IDENTITY_FAILED', 'GitHub identity verification failed.');
  }
  return {
    id: String(payload.id),
    login: payload.login,
    avatarUrl: typeof payload.avatar_url === 'string' ? payload.avatar_url : ''
  };
}

export async function verifyWorkspaceEligibility(config, accessToken, fetchImpl = fetch) {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}`;
  let response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(accessToken) });
  } catch {
    throw new HttpError(503, 'AUTH_UPSTREAM_UNAVAILABLE', 'Workspace authorization could not be rechecked.');
  }

  const payload = await responseJson(response);
  if (response.status === 401) {
    throw new HttpError(401, 'AUTH_SESSION_INVALID', 'GitHub authorization is no longer valid.', { clearSession: true });
  }
  if (response.status === 403 || response.status === 404) {
    throw new HttpError(403, 'AUTH_FORBIDDEN', 'This GitHub account cannot access the private Workspace.');
  }
  if (response.status === 429 || response.status >= 500) {
    throw new HttpError(503, 'AUTH_UPSTREAM_UNAVAILABLE', 'Workspace authorization could not be rechecked.');
  }
  if (!response.ok) {
    throw new HttpError(502, 'AUTH_VERIFICATION_FAILED', 'Workspace authorization verification failed.');
  }

  if (
    String(payload.full_name || '').toLowerCase() !== config.workspaceFullName.toLowerCase()
    || payload.private !== true
  ) {
    throw new HttpError(503, 'AUTH_TARGET_INVALID', 'Configured Workspace must resolve to the expected private repository.');
  }

  const permissions = payload.permissions && typeof payload.permissions === 'object' ? payload.permissions : {};
  return {
    permission: permissions.admin ? 'admin'
      : permissions.maintain || permissions.push ? 'write'
        : permissions.triage ? 'triage'
          : 'read'
  };
}

function sessionIdFromRequest(request) {
  const id = cookies(request).get(SESSION_COOKIE);
  if (!id) return null;
  if (!SESSION_ID.test(id)) {
    throw new HttpError(401, 'AUTH_SESSION_INVALID', 'Session is invalid.', { clearSession: true });
  }
  return id;
}

async function revokeUserToken(config, accessToken, fetchImpl) {
  const basic = Buffer.from(`${config.githubClientId}:${config.githubClientSecret}`, 'utf8').toString('base64');
  let response;
  try {
    response = await fetchImpl(
      `${GITHUB_API}/applications/${encodeURIComponent(config.githubClientId)}/token`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': 'Knowledge-Card-Engine'
        },
        body: JSON.stringify({ access_token: accessToken })
      }
    );
  } catch {
    throw new HttpError(503, 'LOGOUT_REVOKE_FAILED', 'GitHub session revocation failed; the session remains active.');
  }

  if (response.status !== 204) {
    throw new HttpError(502, 'LOGOUT_REVOKE_FAILED', 'GitHub session revocation failed; the session remains active.');
  }
}

export function createAuthService({
  config,
  sessionStore,
  fetchImpl = fetch,
  now = () => Date.now()
}) {
  assertSessionStore(sessionStore);

  return {
    beginLogin() {
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(48).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const flow = sealFlow({ state, verifier, exp: now() + FLOW_MS }, config.sessionSecret);
      return redirectResponse(
        authorizationUrl(config, state, challenge),
        302,
        [cookie(FLOW_COOKIE, flow, FLOW_MS / 1000)]
      );
    },

    async finishLogin(request) {
      const url = new URL(request.url);
      const flowRaw = cookies(request).get(FLOW_COOKIE);
      const flow = flowRaw ? openFlow(flowRaw, config.sessionSecret) : null;
      const clearFlow = clearFlowCookie();

      if (url.searchParams.get('error')) {
        return redirectResponse(appRoot(config, 'cancelled'), 302, [clearFlow]);
      }

      const state = url.searchParams.get('state') || '';
      const code = url.searchParams.get('code') || '';
      if (
        !flow
        || !Number.isFinite(flow.exp)
        || flow.exp <= now()
        || typeof flow.state !== 'string'
        || typeof flow.verifier !== 'string'
        || !state
        || !code
        || flow.state !== state
      ) {
        return redirectResponse(appRoot(config, 'invalid'), 302, [clearFlow, clearSessionCookie()]);
      }

      try {
        const exchanged = await exchangeCode(config, code, flow.verifier, fetchImpl);
        const user = await githubIdentity(exchanged.accessToken, fetchImpl);
        await verifyWorkspaceEligibility(config, exchanged.accessToken, fetchImpl);

        const githubTokenExp = exchanged.expiresIn == null
          ? now() + SESSION_MS
          : now() + (exchanged.expiresIn * 1000);
        const exp = Math.min(now() + SESSION_MS, githubTokenExp);
        if (exp <= now()) throw new HttpError(502, 'AUTH_TOKEN_EXPIRED', 'GitHub returned an expired user token.');

        const sessionId = await sessionStore.create({
          sub: user.id,
          login: user.login,
          avatarUrl: user.avatarUrl,
          accessToken: exchanged.accessToken,
          githubTokenExp,
          exp
        });

        return redirectResponse(appRoot(config), 302, [
          clearFlow,
          cookie(SESSION_COOKIE, sessionId, Math.max(1, Math.floor((exp - now()) / 1000)))
        ]);
      } catch (error) {
        if (error instanceof HttpError && error.status === 403) {
          return redirectResponse(appRoot(config, 'forbidden'), 302, [clearFlow, clearSessionCookie()]);
        }
        return redirectResponse(appRoot(config, 'unavailable'), 302, [clearFlow, clearSessionCookie()]);
      }
    },

    async authorize(request) {
      const sessionId = sessionIdFromRequest(request);
      if (!sessionId) throw new HttpError(401, 'AUTH_REQUIRED', 'GitHub login is required.');

      const session = await sessionStore.get(sessionId);
      if (!session) {
        throw new HttpError(401, 'AUTH_SESSION_EXPIRED', 'Session has expired or was revoked.', { clearSession: true });
      }

      let eligibility;
      try {
        eligibility = await verifyWorkspaceEligibility(config, session.accessToken, fetchImpl);
      } catch (error) {
        if (error instanceof HttpError && error.clearSession) {
          await sessionStore.delete(sessionId);
        }
        throw error;
      }

      return {
        sessionId,
        session,
        user: {
          id: session.sub,
          login: session.login,
          avatarUrl: typeof session.avatarUrl === 'string' ? session.avatarUrl : '',
          permission: eligibility.permission,
          expiresAt: new Date(session.exp).toISOString()
        }
      };
    },

    async logout(request) {
      const sessionId = sessionIdFromRequest(request);
      if (!sessionId) {
        return new Response(null, {
          status: 204,
          headers: {
            'Cache-Control': 'no-store',
            'Set-Cookie': clearSessionCookie()
          }
        });
      }

      const session = await sessionStore.get(sessionId);
      if (!session) {
        return new Response(null, {
          status: 204,
          headers: {
            'Cache-Control': 'no-store',
            'Set-Cookie': clearSessionCookie()
          }
        });
      }

      await revokeUserToken(config, session.accessToken, fetchImpl);
      await sessionStore.delete(sessionId);

      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': clearSessionCookie()
        }
      });
    }
  };
}
