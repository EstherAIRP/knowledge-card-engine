import { randomUUID } from 'node:crypto';

const SESSION_ID = /^[A-Za-z0-9_-]{32,128}$/u;

export function createMemorySessionStore({ now = () => Date.now() } = {}) {
  const sessions = new Map();

  function purge(id) {
    const value = sessions.get(id);
    if (value && (!Number.isFinite(value.exp) || value.exp <= now())) {
      sessions.delete(id);
      return null;
    }
    return value || null;
  }

  return {
    async create(value) {
      const id = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      sessions.set(id, structuredClone(value));
      return id;
    },

    async get(id) {
      if (!SESSION_ID.test(String(id || ''))) return null;
      const value = purge(id);
      return value ? structuredClone(value) : null;
    },

    async delete(id) {
      if (SESSION_ID.test(String(id || ''))) sessions.delete(id);
    }
  };
}

function restConfig(env) {
  const url = typeof env?.KC_SESSION_STORE_REST_URL === 'string'
    ? env.KC_SESSION_STORE_REST_URL.trim().replace(/\/+$/u, '')
    : '';
  const token = typeof env?.KC_SESSION_STORE_REST_TOKEN === 'string'
    ? env.KC_SESSION_STORE_REST_TOKEN.trim()
    : '';
  if (!url || !token) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError('KC_SESSION_STORE_REST_URL must be an absolute HTTPS URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('KC_SESSION_STORE_REST_URL must be an HTTPS base URL without credentials, query, or fragment.');
  }
  return { url, token };
}

async function redisCommand(config, command, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });
  } catch {
    throw new Error('Shared session store is unavailable.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error('Shared session store request failed.');
  }
  return payload?.result;
}

export function createRestSessionStore({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
  prefix = 'kc:session:'
} = {}) {
  const config = restConfig(env);
  if (!config) throw new TypeError('Shared session store environment is incomplete.');

  return {
    async create(value) {
      if (!Number.isFinite(value?.exp) || value.exp <= now()) {
        throw new TypeError('Session value must contain a future exp timestamp.');
      }
      const id = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      const ttlSeconds = Math.max(1, Math.ceil((value.exp - now()) / 1000));
      const result = await redisCommand(
        config,
        ['SET', prefix + id, JSON.stringify(value), 'EX', String(ttlSeconds), 'NX'],
        fetchImpl
      );
      if (result !== 'OK') throw new Error('Shared session store did not create the session.');
      return id;
    },

    async get(id) {
      if (!SESSION_ID.test(String(id || ''))) return null;
      const result = await redisCommand(config, ['GET', prefix + id], fetchImpl);
      if (result == null) return null;
      if (typeof result !== 'string') throw new Error('Shared session store returned an invalid session value.');
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch {
        throw new Error('Shared session store returned malformed JSON.');
      }
      if (!parsed || typeof parsed !== 'object' || !Number.isFinite(parsed.exp) || parsed.exp <= now()) {
        await redisCommand(config, ['DEL', prefix + id], fetchImpl).catch(() => {});
        return null;
      }
      return parsed;
    },

    async delete(id) {
      if (!SESSION_ID.test(String(id || ''))) return;
      await redisCommand(config, ['DEL', prefix + id], fetchImpl);
    }
  };
}

export function hasRestSessionStoreConfig(env = process.env) {
  return Boolean(restConfig(env));
}

export function assertSessionStore(store) {
  if (
    !store
    || typeof store.create !== 'function'
    || typeof store.get !== 'function'
    || typeof store.delete !== 'function'
  ) {
    throw new TypeError('sessionStore must implement async create/get/delete.');
  }
  return store;
}
