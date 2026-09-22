export const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;

export async function fetchWithTimeout(
  fetchImpl,
  input,
  init = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS
) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number.');
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return fetchImpl(input, {
    ...init,
    signal
  });
}
