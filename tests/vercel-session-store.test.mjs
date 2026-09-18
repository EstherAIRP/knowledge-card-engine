import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createPrivateSiteApp } from '../apps/server/src/index.js';
import { createUpstashSessionStore } from '../apps/server/src/upstash-session-store.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function configuredEnv() {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    VERCEL: '1',
    KC_PUBLIC_URL: 'https://cards.example.test',
    KC_SESSION_SECRET: 'fixture-session-secret-0123456789abcdef',
    KC_GITHUB_APP_ID: '123456',
    KC_GITHUB_CLIENT_ID: 'fixture-client-id',
    KC_GITHUB_CLIENT_SECRET: 'fixture-client-credential',
    KC_GITHUB_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    KC_GITHUB_INSTALLATION_ID: '42',
    KC_WORKSPACE_OWNER: 'example-owner',
    KC_WORKSPACE_REPO: 'example-workspace',
    KC_WORKSPACE_REF: 'main'
  };
}

test('Vercel refuses configured auth without a shared server-side session store', async () => {
  const app = createPrivateSiteApp({
    env: configuredEnv(),
    fetchImpl: async () => {
      throw new Error('Network access must not occur while runtime configuration is incomplete.');
    }
  });

  const health = await app(new Request('https://cards.example.test/api/health'));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'unconfigured', configured: false });

  const login = await app(new Request('https://cards.example.test/api/auth/login'));
  assert.equal(login.status, 503);
  assert.equal((await login.json()).code, 'SITE_NOT_CONFIGURED');
});

test('shared REST session store encrypts the user credential and supports create/get/delete', async () => {
  const nowMs = Date.parse('2026-09-18T12:00:00Z');
  const values = new Map();
  const commands = [];
  const storeAuth = 'fixture-store-auth';

  async function redisFetch(input, options = {}) {
    assert.equal(String(input), 'https://session-store.example.test');
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer ' + storeAuth);
    const command = JSON.parse(String(options.body || '[]'));
    commands.push(command);

    if (command[0] === 'SET') {
      values.set(command[1], command[2]);
      return json(200, { result: 'OK' });
    }
    if (command[0] === 'GET') {
      return json(200, { result: values.get(command[1]) ?? null });
    }
    if (command[0] === 'DEL') {
      values.delete(command[1]);
      return json(200, { result: 1 });
    }
    return json(400, { error: 'unexpected command' });
  }

  const store = createUpstashSessionStore({
    url: 'https://session-store.example.test',
    token: storeAuth,
    sessionSecret: 'fixture-session-secret-0123456789abcdef',
    fetchImpl: redisFetch,
    now: () => nowMs
  });

  const session = {
    sub: '101',
    login: 'fixture-user',
    accessToken: 'fixture-user-credential',
    exp: nowMs + 60_000
  };

  const id = await store.create(session);
  assert.match(id, /^[A-Za-z0-9_-]{40,}$/u);

  const storedCiphertext = [...values.values()][0];
  assert.equal(typeof storedCiphertext, 'string');
  assert.doesNotMatch(storedCiphertext, /fixture-user-credential/u);
  assert.deepEqual(await store.get(id), session);

  await store.delete(id);
  assert.equal(await store.get(id), null);
  assert.deepEqual(commands[0].slice(0, 2), ['SET', 'knowledge-card:session:' + id]);
  assert.deepEqual(commands[0].slice(3), ['EX', 60]);
});
