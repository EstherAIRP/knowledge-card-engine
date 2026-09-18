import { randomBytes } from 'node:crypto';

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
      const id = randomBytes(32).toString('base64url');
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
