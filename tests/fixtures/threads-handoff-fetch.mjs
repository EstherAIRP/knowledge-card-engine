function response(status, body, url) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: () => null },
    async text() { return body; }
  };
}

const sourceUrl = 'https://threads.com/@alice/post/REMOTE1';
const post = {
  pk: '9100',
  code: 'REMOTE1',
  user: { username: 'alice' },
  caption: { text: '這是一篇完整的合成 Threads 單篇來源，用來驗證 Remote Ingest 在 accepted evidence 固定後才進入 analysis。' },
  timestamp: '2026-09-25T00:00:00Z',
  has_replies: false
};
const html = `<!doctype html><html><body><script type="application/json">${JSON.stringify({ post })}</script></body></html>`;

globalThis.fetch = async (url) => {
  const value = String(url);
  if (value === sourceUrl) return response(200, html, sourceUrl);
  throw new Error('Unexpected synthetic Threads URL: ' + value);
};
