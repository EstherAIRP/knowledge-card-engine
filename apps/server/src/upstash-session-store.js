import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { HttpError } from './http.js';

const SESSION_KEY_PREFIX = 'knowledge-card:session:';

function keyFor(secret) {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function seal(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

function open(value, secret) {
  try {
    const parts = String(value || '').split('.');
    if (parts.length !== 3) return null;
    const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new TypeError('Upstash session REST URL must be an absolute URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new TypeError('Upstash session REST URL must be HTTPS without credentials, query, or fragment.');
  }
  return url.toString().replace(/\/$/u, '');
}

export function createUpstashSessionStore({
  url,
  token,
  sessionSecret,
  fetchImpl = fetch,
  now = () => Date.now()
}) {
  const endpoint = normalizeBaseUrl(url);
  const authToken = String(token || '').trim();
  if (!authToken) throw new TypeError('Upstash session REST token is required.');
  if (typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new TypeError('Session secret must contain at least 32 UTF-8 bytes.');
  }

  async function command(args) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Knowledge-Card-Engine'
        },
        body: JSON.stringify(args)
      });
    } catch {
      throw new HttpError(503, 'SESSION_STORE_UNAVAILABLE', 'Shared session store is unavailable.');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      throw new HttpError(503, 'SESSION_STORE_UNAVAILABLE', 'Shared session store is unavailable.');
    }
    return payload?.result;
  }

  return {
    async create(value) {
      const exp = Number(value?.exp);
      const ttl = Math.ceil((exp - now()) / 1000);
      if (!Number.isFinite(exp) || ttl < 1 || ttl > 3600) {
        throw new HttpError(500, 'SESSION_VALUE_INVALID', 'Session expiry is invalid.');
      }
      const id = randomBytes(32).toString('base64url');
      const encrypted = seal(value, sessionSecret);
      const result = await command(['SET', SESSION_KEY_PREFIX + id, encrypted, 'EX', ttl]);
      if (result !== 'OK') {
        throw new HttpError(503, 'SESSION_STORE_UNAVAILABLE', 'Shared session store did not confirm the session write.');
      }
      return id;
    },

    async get(id) {
      const result = await command(['GET', SESSION_KEY_PREFIX + String(id || '')]);
      if (result == null) return null;
      if (typeof result !== 'string') {
        throw new HttpError(503, 'SESSION_STORE_INVALID', 'Shared session store returned an invalid session value.');
      }
      const value = open(result, sessionSecret);
      if (!value || !Number.isFinite(value.exp) || value.exp <= now()) {
        await command(['DEL', SESSION_KEY_PREFIX + String(id || '')]).catch(() => {});
        return null;
      }
      return value;
    },

    async delete(id) {
      await command(['DEL', SESSION_KEY_PREFIX + String(id || '')]);
    }
  };
}
