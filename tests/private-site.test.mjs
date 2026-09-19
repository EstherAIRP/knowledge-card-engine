import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import { createPrivateSiteApp } from '../apps/server/src/index.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function noContent(status = 204) {
  return new Response(null, { status });
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const value = response.headers.get('set-cookie');
  return value ? [value] : [];
}

function cookiePair(setCookie) {
  return String(setCookie).split(';', 1)[0];
}

function findCookie(response, name) {
  return setCookies(response).find((value) => value.startsWith(name + '='));
}

async function fixtureTexts() {
  const taxonomy = await fs.readFile(new URL('../examples/synthetic-workspace/config/taxonomy.yaml', import.meta.url), 'utf8');
  const first = await fs.readFile(new URL('../examples/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md', import.meta.url), 'utf8');
  const second = first
    .replaceAll('synthetic-example-project', 'synthetic-second-project')
    .replaceAll('Synthetic Example Project', 'Synthetic Second Project')
    .replaceAll('https://github.com/example/synthetic-example', 'https://github.com/example/synthetic-second')
    .replaceAll('github:example/synthetic-example', 'github:example/synthetic-second');
  return { taxonomy, first, second };
}

function blob(text) {
  return {
    encoding: 'base64',
    size: Buffer.byteLength(text, 'utf8'),
    content: Buffer.from(text, 'utf8').toString('base64')
  };
}

async function harness() {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const fixtures = await fixtureTexts();
  let nowMs = Date.parse('2026-09-18T12:00:00Z');

  const state = {
    eligible: true,
    userTokenValid: true,
    qualificationFailure: null,
    revokeStatus: 204,
    treeTruncated: false,
    revision: '1'.repeat(40),
    treeSha: 'a'.repeat(40),
    installationTokenCalls: 0,
    privateDataCalls: 0,
    qualificationCalls: 0,
    exchangedVerifier: '',
    userToken: 'ghu_test_user_token',
    installationToken: 'ghs_TEST_INSTALLATION_TOKEN_WITH_NEW_FORMAT'
  };

  const env = {
    KC_PUBLIC_URL: 'https://cards.example.test',
    KC_SESSION_SECRET: 'synthetic-session-secret-0123456789abcdef',
    KC_GITHUB_APP_ID: '123456',
    KC_GITHUB_CLIENT_ID: 'Iv1.synthetic',
    KC_GITHUB_CLIENT_SECRET: 'synthetic-client-secret',
    KC_GITHUB_PRIVATE_KEY: privateKeyPem,
    KC_GITHUB_INSTALLATION_ID: '42',
    KC_WORKSPACE_OWNER: 'EstherAIRP',
    KC_WORKSPACE_REPO: 'knowledge-card-workspace',
    KC_WORKSPACE_REF: 'main'
  };

  const card1Sha = 'b'.repeat(40);
  const card2Sha = 'c'.repeat(40);
  const taxonomySha = 'd'.repeat(40);

  async function fetchImpl(input, options = {}) {
    const url = new URL(String(input));
    const auth = new Headers(options.headers || {}).get('authorization') || '';

    if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
      const params = new URLSearchParams(String(options.body || ''));
      state.exchangedVerifier = params.get('code_verifier') || '';
      return json(200, {
        access_token: state.userToken,
        expires_in: 28_800,
        refresh_token: 'ghr_not_stored',
        refresh_token_expires_in: 15_897_600,
        token_type: 'bearer'
      });
    }

    if (url.origin !== 'https://api.github.com') throw new Error('Unexpected network target: ' + url);

    if (url.pathname === '/user') {
      if (!state.userTokenValid || auth !== 'Bearer ' + state.userToken) return json(401, { message: 'Bad credentials' });
      return json(200, { id: 101, login: 'synthetic-user', avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4' });
    }

    if (url.pathname === '/repos/EstherAIRP/knowledge-card-workspace') {
      state.qualificationCalls += 1;
      if (state.qualificationFailure === 'network') throw new Error('network');
      if (state.qualificationFailure === 'server') return json(503, { message: 'GitHub unavailable' });
      if (!state.userTokenValid || auth !== 'Bearer ' + state.userToken) return json(401, { message: 'Bad credentials' });
      if (!state.eligible) return json(404, { message: 'Not Found' });
      return json(200, {
        full_name: 'EstherAIRP/knowledge-card-workspace',
        private: true,
        permissions: { pull: true, push: false, admin: false }
      });
    }

    if (url.pathname === '/applications/Iv1.synthetic/token' && options.method === 'DELETE') {
      if (state.revokeStatus === 204) {
        state.userTokenValid = false;
        return noContent();
      }
      return json(state.revokeStatus, { message: 'revoke failed' });
    }

    if (url.pathname === '/app/installations/42/access_tokens' && options.method === 'POST') {
      state.installationTokenCalls += 1;
      const jwt = auth.replace(/^Bearer\s+/u, '');
      assert.equal(jwt.split('.').length, 3);
      const requestBody = JSON.parse(String(options.body || '{}'));
      assert.deepEqual(requestBody.repositories, ['knowledge-card-workspace']);
      assert.deepEqual(requestBody.permissions, { contents: 'read' });
      return json(201, {
        token: state.installationToken,
        expires_at: new Date(nowMs + 60 * 60 * 1000).toISOString()
      });
    }

    if (auth !== 'Bearer ' + state.installationToken) return json(401, { message: 'Bad installation token' });
    state.privateDataCalls += 1;

    if (url.pathname === '/repos/EstherAIRP/knowledge-card-workspace/commits/main') {
      return json(200, {
        sha: state.revision,
        commit: { tree: { sha: state.treeSha } }
      });
    }

    if (url.pathname === '/repos/EstherAIRP/knowledge-card-workspace/git/trees/' + state.treeSha) {
      return json(200, {
        truncated: state.treeTruncated,
        tree: [
          { path: 'config/taxonomy.yaml', type: 'blob', sha: taxonomySha },
          { path: 'content/knowledge/2026/synthetic-example-project.md', type: 'blob', sha: card1Sha },
          { path: 'content/knowledge/2026/synthetic-second-project.md', type: 'blob', sha: card2Sha },
          { path: 'profile/private.md', type: 'blob', sha: 'e'.repeat(40) }
        ]
      });
    }

    if (url.pathname.endsWith('/git/blobs/' + taxonomySha)) return json(200, blob(fixtures.taxonomy));
    if (url.pathname.endsWith('/git/blobs/' + card1Sha)) return json(200, blob(fixtures.first));
    if (url.pathname.endsWith('/git/blobs/' + card2Sha)) return json(200, blob(fixtures.second));

    throw new Error('Unexpected GitHub API route: ' + url.pathname);
  }

  const app = createPrivateSiteApp({
    env,
    fetchImpl,
    now: () => nowMs
  });

  async function login() {
    state.userTokenValid = true;
    state.eligible = true;
    state.qualificationFailure = null;

    const start = await app(new Request('https://cards.example.test/api/auth/login'));
    assert.equal(start.status, 302);
    const flowSetCookie = findCookie(start, '__Host-kc_oauth');
    assert.ok(flowSetCookie);
    assert.match(flowSetCookie, /HttpOnly/u);
    assert.match(flowSetCookie, /Secure/u);
    assert.match(flowSetCookie, /SameSite=Lax/u);

    const authorize = new URL(start.headers.get('location'));
    assert.equal(authorize.origin, 'https://github.com');
    assert.equal(authorize.pathname, '/login/oauth/authorize');
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authorize.searchParams.get('redirect_uri'), 'https://cards.example.test/api/auth/callback');

    const callback = new URL('https://cards.example.test/api/auth/callback');
    callback.searchParams.set('code', 'synthetic-code');
    callback.searchParams.set('state', authorize.searchParams.get('state'));

    const finish = await app(new Request(callback, {
      headers: { Cookie: cookiePair(flowSetCookie) }
    }));
    assert.equal(finish.status, 302);
    assert.equal(finish.headers.get('location'), 'https://cards.example.test/');
    assert.ok(state.exchangedVerifier.length >= 43);
    const actualChallenge = createHash('sha256').update(state.exchangedVerifier).digest('base64url');
    assert.equal(actualChallenge, authorize.searchParams.get('code_challenge'));

    const sessionSetCookie = findCookie(finish, '__Host-kc_session');
    assert.ok(sessionSetCookie);
    assert.doesNotMatch(sessionSetCookie, /ghu_test_user_token/u);
    assert.match(sessionSetCookie, /Max-Age=3600/u);
    return cookiePair(sessionSetCookie);
  }

  return {
    app,
    env,
    state,
    login,
    now: () => nowMs,
    advance(ms) { nowMs += ms; }
  };
}

test('login uses state + PKCE and creates an opaque one-hour server session only after private Workspace eligibility', async () => {
  const h = await harness();
  const sessionCookie = await h.login();
  assert.ok(sessionCookie.startsWith('__Host-kc_session='));
  assert.equal(h.state.qualificationCalls, 1);

  const session = await h.app(new Request('https://cards.example.test/api/auth/session', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(session.status, 200);
  assert.equal(session.headers.get('cache-control'), 'no-store');
  const payload = await session.json();
  assert.deepEqual(payload.user, {
    id: '101',
    login: 'synthetic-user',
    avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4',
    permission: 'read'
  });
  assert.equal(typeof payload.expires_at, 'string');
});

test('invalid OAuth state and denied login never create a private session', async () => {
  const h = await harness();
  const start = await h.app(new Request('https://cards.example.test/api/auth/login'));
  const flow = findCookie(start, '__Host-kc_oauth');
  const bad = await h.app(new Request('https://cards.example.test/api/auth/callback?code=x&state=wrong', {
    headers: { Cookie: cookiePair(flow) }
  }));
  assert.equal(bad.status, 302);
  assert.match(bad.headers.get('location'), /auth=invalid/u);
  assert.equal(findCookie(bad, '__Host-kc_session')?.includes('Max-Age=0'), true);

  const denied = await h.app(new Request('https://cards.example.test/api/auth/callback?error=access_denied', {
    headers: { Cookie: cookiePair(flow) }
  }));
  assert.equal(denied.status, 302);
  assert.match(denied.headers.get('location'), /auth=cancelled/u);
});

test('anonymous, revoked, forbidden, and GitHub verification failures fail closed before private installation data', async () => {
  const h = await harness();

  const anonymous = await h.app(new Request('https://cards.example.test/api/cards'));
  assert.equal(anonymous.status, 401);
  assert.equal(h.state.privateDataCalls, 0);
  assert.equal(h.state.installationTokenCalls, 0);

  let sessionCookie = await h.login();
  const privateBefore = h.state.privateDataCalls;
  h.state.eligible = false;
  const forbidden = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(forbidden.status, 403);
  assert.equal(h.state.privateDataCalls, privateBefore);

  h.state.eligible = true;
  h.state.qualificationFailure = 'server';
  const unavailable = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(unavailable.status, 503);
  assert.equal(h.state.privateDataCalls, privateBefore);

  h.state.qualificationFailure = null;
  h.state.userTokenValid = false;
  const revoked = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(revoked.status, 401);
  assert.equal(findCookie(revoked, '__Host-kc_session')?.includes('Max-Age=0'), true);
  assert.equal(h.state.privateDataCalls, privateBefore);
});

test('authorized card APIs use installation credentials, validate the collection, and expose only list summaries or stable-id detail', async () => {
  const h = await harness();
  const sessionCookie = await h.login();

  const list = await h.app(new Request('https://cards.example.test/api/cards?limit=1', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'no-store');
  const page = await list.json();
  assert.equal(page.items.length, 1);
  assert.equal('body' in page.items[0], false);
  assert.equal(typeof page.next_cursor, 'string');
  assert.equal(h.state.installationTokenCalls, 1);
  assert.ok(h.state.privateDataCalls > 0);

  const detail = await h.app(new Request('https://cards.example.test/api/cards/synthetic-example-project', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(detail.status, 200);
  const card = await detail.json();
  assert.equal(card.id, 'synthetic-example-project');
  assert.match(card.body, /Synthetic Example Project/u);
  assert.equal(card.source.identity, 'github:example/synthetic-example');

  const badPath = await h.app(new Request('https://cards.example.test/api/cards/profile%2Fprivate', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(badPath.status, 400);

  h.state.revision = '2'.repeat(40);
  const staleCursor = await h.app(new Request('https://cards.example.test/api/cards?limit=1&cursor=' + encodeURIComponent(page.next_cursor), {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(staleCursor.status, 409);
  assert.equal((await staleCursor.json()).code, 'DATA_VERSION_CHANGED');
});

test('truncated Git tree stops private content serving', async () => {
  const h = await harness();
  const sessionCookie = await h.login();
  h.state.treeTruncated = true;
  const response = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'WORKSPACE_TREE_TRUNCATED');
});

test('logout revokes the GitHub user token before clearing the session, and revoke failure does not pretend success', async () => {
  const h = await harness();
  const sessionCookie = await h.login();

  h.state.revokeStatus = 500;
  const failed = await h.app(new Request('https://cards.example.test/api/auth/session', {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      Origin: 'https://cards.example.test'
    }
  }));
  assert.equal(failed.status, 502);
  assert.equal(findCookie(failed, '__Host-kc_session'), undefined);
  assert.equal(h.state.userTokenValid, true);

  h.state.revokeStatus = 204;
  const loggedOut = await h.app(new Request('https://cards.example.test/api/auth/session', {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      Origin: 'https://cards.example.test'
    }
  }));
  assert.equal(loggedOut.status, 204);
  assert.equal(h.state.userTokenValid, false);
  assert.equal(findCookie(loggedOut, '__Host-kc_session')?.includes('Max-Age=0'), true);

  const oldCookie = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(oldCookie.status, 401);
});

test('session expiry, logout CSRF, public health, methods, and public app shell obey the read-only security boundary', async () => {
  const h = await harness();
  const sessionCookie = await h.login();

  h.advance((60 * 60 * 1000) + 1);
  const expired = await h.app(new Request('https://cards.example.test/api/cards', {
    headers: { Cookie: sessionCookie }
  }));
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).code, 'AUTH_SESSION_EXPIRED');

  const h2 = await harness();
  const active = await h2.login();
  const csrf = await h2.app(new Request('https://cards.example.test/api/auth/session', {
    method: 'POST',
    headers: { Cookie: active, Origin: 'https://evil.example' }
  }));
  assert.equal(csrf.status, 403);
  assert.equal(h2.state.userTokenValid, true);

  const shell = await h2.app(new Request('https://cards.example.test/'));
  assert.equal(shell.status, 200);
  const html = await shell.text();
  assert.doesNotMatch(html, /Synthetic Example Project/u);
  assert.match(html, /\/api\/auth\/session/u);

  const method = await h2.app(new Request('https://cards.example.test/api/cards', { method: 'POST' }));
  assert.equal(method.status, 405);

  const unconfigured = createPrivateSiteApp({ env: {} });
  const health = await unconfigured(new Request('https://cards.example.test/api/health'));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: 'unconfigured',
    configured: false,
    configuration_error: {
      code: 'SITE_CONFIG_MISSING',
      detail: 'KC_PUBLIC_URL is required.'
    }
  });
  assert.doesNotMatch(await (await unconfigured(new Request('https://cards.example.test/'))).text(), /client-secret|private-key|session-secret/iu);
});


test('health exposes only safe configuration diagnostics and honors runtime deployment errors', async () => {
  const missing = createPrivateSiteApp({
    env: {
      KC_PUBLIC_URL: 'https://cards.example.test'
    }
  });
  const missingHealth = await missing(new Request('https://cards.example.test/api/health'));
  assert.deepEqual(await missingHealth.json(), {
    status: 'unconfigured',
    configured: false,
    configuration_error: {
      code: 'SITE_CONFIG_MISSING',
      detail: 'KC_SESSION_SECRET is required.'
    }
  });

  const runtime = createPrivateSiteApp({
    env: {},
    runtimeError: {
      code: 'SESSION_STORE_NOT_CONFIGURED',
      message: 'KC_SESSION_STORE_REST_URL and KC_SESSION_STORE_REST_TOKEN are required on Vercel.'
    }
  });
  const runtimeHealth = await runtime(new Request('https://cards.example.test/api/health'));
  assert.deepEqual(await runtimeHealth.json(), {
    status: 'unconfigured',
    configured: false,
    configuration_error: {
      code: 'SESSION_STORE_NOT_CONFIGURED',
      detail: 'KC_SESSION_STORE_REST_URL and KC_SESSION_STORE_REST_TOKEN are required on Vercel.'
    }
  });

  const serialized = JSON.stringify(await runtimeHealth.clone().json()).toLowerCase();
  assert.doesNotMatch(serialized, /secret.*value|private key value|token value/u);
});
