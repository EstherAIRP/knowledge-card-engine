import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithTimeout } from '../apps/server/src/upstream.js';

test('upstream fetch aborts before the hosting hard timeout', async () => {
  let seenSignal = null;

  async function fetchImpl(_input, options = {}) {
    seenSignal = options.signal;
    return await new Promise((_resolve, reject) => {
      if (seenSignal.aborted) {
        reject(seenSignal.reason);
        return;
      }
      seenSignal.addEventListener('abort', () => reject(seenSignal.reason), { once: true });
    });
  }

  await assert.rejects(
    () => fetchWithTimeout(fetchImpl, 'https://upstream.example.test', {}, 20),
    (error) => error?.name === 'TimeoutError'
  );
  assert.ok(seenSignal);
  assert.equal(seenSignal.aborted, true);
});
