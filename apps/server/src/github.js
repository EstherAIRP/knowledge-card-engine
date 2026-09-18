import { createSign } from 'node:crypto';
import { HttpError } from './http.js';

export const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_API = 'https://api.github.com';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export function createGitHubAppJwt(config, now = () => Date.now()) {
  const nowSeconds = Math.floor(now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: nowSeconds - 60,
    exp: nowSeconds + (9 * 60),
    iss: config.githubAppId
  }));
  const input = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  const signature = signer.sign(config.githubPrivateKey).toString('base64url');
  return `${input}.${signature}`;
}

export function githubHeaders(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'Knowledge-Card-Engine',
    ...extra
  };
}

async function jsonPayload(response) {
  return response.json().catch(() => ({}));
}

export function createInstallationTokenProvider({ config, fetchImpl = fetch, now = () => Date.now() }) {
  let cached = null;

  return async function installationToken() {
    if (cached && cached.expiresAt - now() > 60_000) return cached.token;

    const jwt = createGitHubAppJwt(config, now);
    let response;
    try {
      response = await fetchImpl(
        `${GITHUB_API}/app/installations/${encodeURIComponent(config.githubInstallationId)}/access_tokens`,
        {
          method: 'POST',
          headers: githubHeaders(jwt, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            repositories: [config.workspaceRepo],
            permissions: { contents: 'read' }
          })
        }
      );
    } catch {
      throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Unable to create the Workspace data credential.');
    }

    const payload = await jsonPayload(response);
    if (!response.ok || typeof payload.token !== 'string' || !payload.token || typeof payload.expires_at !== 'string') {
      throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Unable to create the Workspace data credential.');
    }
    const expiresAt = Date.parse(payload.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
      throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Workspace data credential has an invalid expiration.');
    }

    cached = { token: payload.token, expiresAt };
    return cached.token;
  };
}

export async function githubInstallationJson({ config, installationToken, fetchImpl = fetch, path, query = '' }) {
  const token = await installationToken();
  let response;
  try {
    response = await fetchImpl(`${GITHUB_API}${path}${query}`, {
      headers: githubHeaders(token)
    });
  } catch {
    throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Workspace repository request failed.');
  }

  const payload = await jsonPayload(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Configured Workspace repository data is unavailable.');
    }
    throw new HttpError(503, 'DATA_BACKEND_UNAVAILABLE', 'Workspace repository request failed.');
  }
  return payload;
}
