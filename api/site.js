import { createPrivateSiteApp } from '../apps/server/src/index.js';
import {
  createRestSessionStore,
  hasRestSessionStoreConfig
} from '../apps/server/src/session-store.js';

function firstHeader(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value.split(',')[0].trim() : '';
}

async function nodeRequestToFetch(request) {
  const host = firstHeader(request.headers?.['x-forwarded-host']) || firstHeader(request.headers?.host) || 'localhost';
  const proto = firstHeader(request.headers?.['x-forwarded-proto']) || 'https';
  const url = new URL(request.url || '/', `${proto}://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers || {})) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value != null) {
      headers.set(name, String(value));
    }
  }

  return new Request(url, {
    method: request.method || 'GET',
    headers
  });
}

async function writeFetchResponse(response, outgoing) {
  outgoing.statusCode = response.status;

  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];

  for (const [name, value] of response.headers) {
    if (name.toLowerCase() === 'set-cookie') continue;
    outgoing.setHeader(name, value);
  }
  if (setCookies.length) outgoing.setHeader('Set-Cookie', setCookies);

  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

let sessionStore = null;
let runtimeError = null;

try {
  if (!hasRestSessionStoreConfig(process.env)) {
    runtimeError = {
      code: 'SESSION_STORE_NOT_CONFIGURED',
      message: 'KC_SESSION_STORE_REST_URL and KC_SESSION_STORE_REST_TOKEN are required on Vercel.'
    };
  } else {
    sessionStore = createRestSessionStore({ env: process.env });
  }
} catch (error) {
  runtimeError = {
    code: 'SESSION_STORE_CONFIG_INVALID',
    message: error instanceof Error ? error.message : 'Shared session store configuration is invalid.'
  };
}

const app = createPrivateSiteApp({
  env: process.env,
  sessionStore,
  runtimeError
});

export default async function handler(request, response) {
  try {
    await writeFetchResponse(await app(await nodeRequestToFetch(request)), response);
  } catch {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      detail: 'Unexpected server error.'
    }));
  }
}
