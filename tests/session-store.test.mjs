import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRestSessionStore,
  hasRestSessionStoreConfig
} from '../apps/server/src/session-store.js';

test('shared REST session store is only configured with both HTTPS URL and token', () => {
  assert.equal(hasRestSessionStoreConfig({}), false);
  assert.equal(hasRestSessionStoreConfig({
    KC_SESSION_STORE_REST_URL: 'https://redis.example.test',
    KC_SESSION_STORE_REST_TOKEN: 'secret'
  }), true);
  assert.throws(() => hasRestSessionStoreConfig({
    KC_SESSION_STORE_REST_URL: 'http://redis.example.test',
    KC_SESSION_STORE_REST_TOKEN: 'secret'
  }), /HTTPS/u);
});

test('shared REST session store creates, reads, and deletes TTL-bound server sessions', async () => {
  const nowMs = Date.parse('2026-09-18T16:00:00Z');
  const commands = [];
  const values = new Map();

  async function fetchImpl(url, options = {}) {
    assert.equal(url, 'https://redis.example.test');
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer synthetic-token');
    const command = JSON.parse(String(options.body || '[]'));
    commands.push(command);

    if (command[0] === 'SET') {
      assert.equal(command[1].startsWith('kc:session:'), true);
      assert.equal(command[3], 'EX');
      assert.equal(command[4], '3600');
      assert.equal(command[5], 'NX');
      values.set(command[1], command[2]);
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
    }

    if (command[0] === 'GET') {
      return new Response(JSON.stringify({ result: values.get(command[1]) ?? null }), { status: 200 });
    }

    if (command[0] === 'DEL') {
      values.delete(command[1]);
      return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    }

    throw new Error('unexpected command');
  }

  const store = createRestSessionStore({
    env: {
      KC_SESSION_STORE_REST_URL: 'https://redis.example.test',
      KC_SESSION_STORE_REST_TOKEN: 'synthetic-token'
    },
    fetchImpl,
    now: () => nowMs
  });

  const value = {
    sub: '101',
    login: 'synthetic-user',
    accessToken: 'server-only-token',
    exp: nowMs + (60 * 60 * 1000)
  };

  const id = await store.create(value);
  assert.match(id, /^[A-Za-z0-9_-]{32,128}$/u);
  assert.deepEqual(await store.get(id), value);

  await store.delete(id);
  assert.equal(await store.get(id), null);
  assert.deepEqual(commands.map((command) => command[0]), ['SET', 'GET', 'DEL', 'GET']);
});

test('shared REST session store fails closed on backend errors and malformed values', async () => {
  const env = {
    KC_SESSION_STORE_REST_URL: 'https://redis.example.test',
    KC_SESSION_STORE_REST_TOKEN: 'synthetic-token'
  };

  const broken = createRestSessionStore({
    env,
    fetchImpl: async () => new Response(JSON.stringify({ error: 'NOAUTH' }), { status: 401 })
  });
  await assert.rejects(
    broken.get('a'.repeat(64)),
    /Shared session store request failed/u
  );

  const malformed = createRestSessionStore({
    env,
    fetchImpl: async () => new Response(JSON.stringify({ result: '{not-json' }), { status: 200 })
  });
  await assert.rejects(
    malformed.get('b'.repeat(64)),
    /malformed JSON/u
  );
});
