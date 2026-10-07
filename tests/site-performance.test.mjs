import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivateSiteApp } from '../apps/server/src/index.js';
import {
  createSitePerformanceTrace,
  logBrowserPerformance,
  sitePerformanceEnabled
} from '../apps/server/src/performance.js';
import { instrumentPrivateSiteShell } from '../apps/web/src/performance-runtime.js';

test('site performance diagnostics are opt-in', () => {
  assert.equal(sitePerformanceEnabled({}), false);
  assert.equal(sitePerformanceEnabled({ KC_SITE_PERFORMANCE: '0' }), false);
  assert.equal(sitePerformanceEnabled({ KC_SITE_PERFORMANCE: '1' }), true);
});

test('server performance trace exposes only named durations and status', async () => {
  let clock = 0;
  const logs = [];
  const trace = createSitePerformanceTrace({
    enabled: true,
    route: 'cards_list',
    now: () => clock,
    logger: (line) => logs.push(JSON.parse(line))
  });

  const value = await trace.measure('auth', async () => {
    clock += 12.34;
    return 'ok';
  });
  assert.equal(value, 'ok');
  clock += 1.11;
  trace.record('handler', 23.49);

  assert.equal(trace.serverTiming(), 'auth;dur=12.3, handler;dur=23.5');
  assert.equal(trace.headers()['Server-Timing'], 'auth;dur=12.3, handler;dur=23.5');

  trace.finish(200);
  assert.deepEqual(logs, [{
    event: 'kc_site_perf_server',
    route: 'cards_list',
    status: 200,
    total_ms: 13.5,
    auth: 12.3,
    handler: 23.5
  }]);
});

test('browser performance logger accepts only the fixed numeric metric set', () => {
  const logs = [];
  const payload = logBrowserPerformance({
    enabled: true,
    searchParams: new URLSearchParams({
      auth_fetch_ms: '40.12',
      cards_fetch_ms: '512.34',
      radar_render_ms: '33.33',
      bootstrap_ms: '600.01',
      title: 'must-not-be-logged',
      cards_fetch_end: '12345'
    }),
    logger: (line) => logs.push(JSON.parse(line))
  });

  assert.deepEqual(payload, {
    event: 'kc_site_perf_browser',
    view: 'radar',
    auth_fetch_ms: 40.1,
    cards_fetch_ms: 512.3,
    radar_render_ms: 33.3,
    bootstrap_ms: 600
  });
  assert.deepEqual(logs, [payload]);
});

test('performance shell instrumentation is inserted only when explicitly requested', async () => {
  const raw = '<!doctype html><body><div id="app"></div><script>\n(() => { console.log("app"); })();\n</script></body>';
  const instrumented = instrumentPrivateSiteShell(raw);
  assert.match(instrumented, /api\/performance/u);
  assert.match(instrumented, /MutationObserver/u);

  const disabled = createPrivateSiteApp({ env: {} });
  const disabledResponse = await disabled(new Request('https://cards.example.test/'));
  assert.equal(disabledResponse.status, 200);
  assert.doesNotMatch(await disabledResponse.text(), /api\/performance/u);

  const enabled = createPrivateSiteApp({ env: { KC_SITE_PERFORMANCE: '1' } });
  const enabledResponse = await enabled(new Request('https://cards.example.test/'));
  assert.equal(enabledResponse.status, 200);
  assert.match(await enabledResponse.text(), /api\/performance/u);
});
