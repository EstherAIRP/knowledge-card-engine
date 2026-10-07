const METRIC_NAME = /^[a-z][a-z0-9_]*$/u;
const MAX_DURATION_MS = 120_000;
const BROWSER_METRICS = [
  'auth_fetch_ms',
  'cards_fetch_ms',
  'radar_render_ms',
  'bootstrap_ms'
];

function roundedMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 10) / 10;
}

function safeMetricName(name) {
  const value = String(name || '');
  if (!METRIC_NAME.test(value)) throw new TypeError('Performance metric name is invalid.');
  return value;
}

function safeBrowserMetric(value) {
  const numeric = roundedMs(value);
  if (numeric == null || numeric > MAX_DURATION_MS) return null;
  return numeric;
}

export function sitePerformanceEnabled(env = process.env) {
  return String(env?.KC_SITE_PERFORMANCE || '').trim() === '1';
}

export function createSitePerformanceTrace({
  enabled = false,
  route,
  now = () => performance.now(),
  logger = console.info
} = {}) {
  const routeName = String(route || 'unknown');
  const startedAt = now();
  const metrics = new Map();
  let finished = false;

  function record(name, value) {
    if (!enabled) return;
    const metricName = safeMetricName(name);
    const duration = roundedMs(value);
    if (duration == null || duration > MAX_DURATION_MS) return;
    metrics.set(metricName, duration);
  }

  async function measure(name, task) {
    if (typeof task !== 'function') throw new TypeError('Performance measurement task must be a function.');
    if (!enabled) return task();
    const started = now();
    try {
      return await task();
    } finally {
      record(name, now() - started);
    }
  }

  function serverTiming() {
    if (!enabled || metrics.size === 0) return null;
    return [...metrics.entries()]
      .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
      .join(', ');
  }

  function headers(extra = {}) {
    const timing = serverTiming();
    return timing ? { ...extra, 'Server-Timing': timing } : { ...extra };
  }

  function finish(status) {
    if (!enabled || finished) return;
    finished = true;
    const total = roundedMs(now() - startedAt);
    const payload = {
      event: 'kc_site_perf_server',
      route: routeName,
      status: Number(status) || 0,
      ...(total == null ? {} : { total_ms: total }),
      ...Object.fromEntries(metrics)
    };
    logger(JSON.stringify(payload));
  }

  return {
    enabled,
    record,
    measure,
    serverTiming,
    headers,
    finish
  };
}

export function logBrowserPerformance({
  enabled = false,
  searchParams,
  logger = console.info
} = {}) {
  if (!enabled) return null;
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams || '');
  const payload = {
    event: 'kc_site_perf_browser',
    view: 'radar'
  };
  for (const name of BROWSER_METRICS) {
    const value = safeBrowserMetric(params.get(name));
    if (value != null) payload[name] = value;
  }
  if (Object.keys(payload).length === 2) return null;
  logger(JSON.stringify(payload));
  return payload;
}
