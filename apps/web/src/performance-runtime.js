export const performanceRuntimeScript = String.raw`
(() => {
  const startedAt = performance.now();
  const originalFetch = window.fetch.bind(window);
  const metrics = {
    auth_fetch_ms: null,
    cards_fetch_ms: null,
    cards_fetch_end: null
  };
  let reported = false;

  function trackedPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      const url = new URL(raw || '', location.href);
      if (url.origin !== location.origin) return null;
      if (url.pathname === '/api/auth/session') return 'auth';
      if (url.pathname === '/api/cards') return 'cards';
      return null;
    } catch {
      return null;
    }
  }

  window.fetch = async function measuredFetch(input, options) {
    const kind = trackedPath(input);
    if (!kind) return originalFetch(input, options);
    const started = performance.now();
    try {
      return await originalFetch(input, options);
    } finally {
      const ended = performance.now();
      if (kind === 'auth' && metrics.auth_fetch_ms == null) {
        metrics.auth_fetch_ms = ended - started;
      }
      if (kind === 'cards' && metrics.cards_fetch_ms == null) {
        metrics.cards_fetch_ms = ended - started;
        metrics.cards_fetch_end = ended;
      }
    }
  };

  function sendReport() {
    if (reported || metrics.cards_fetch_end == null) return;
    const radar = document.querySelector('.radar-view');
    if (!radar) return;
    reported = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const renderedAt = performance.now();
      const params = new URLSearchParams();
      if (metrics.auth_fetch_ms != null) params.set('auth_fetch_ms', metrics.auth_fetch_ms.toFixed(1));
      if (metrics.cards_fetch_ms != null) params.set('cards_fetch_ms', metrics.cards_fetch_ms.toFixed(1));
      params.set('radar_render_ms', (renderedAt - metrics.cards_fetch_end).toFixed(1));
      params.set('bootstrap_ms', (renderedAt - startedAt).toFixed(1));
      originalFetch('/api/performance?' + params.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      }).catch(() => {});
    }));
  }

  const observer = new MutationObserver(sendReport);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', sendReport, { once: true });
})();
`;

export function instrumentPrivateSiteShell(html) {
  const shell = String(html || '');
  const marker = '<script>\n(() => {';
  if (!shell.includes(marker)) {
    throw new Error('Private site shell script marker is missing.');
  }
  return shell.replace(
    marker,
    `<script>${performanceRuntimeScript}</script>\n${marker}`
  );
}
