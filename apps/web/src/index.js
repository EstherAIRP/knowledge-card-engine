export const moduleId = 'web';
export const moduleKind = 'app';

export function renderPrivateSiteShell() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Knowledge Card</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color-scheme: light dark;
      --bg: #f5f5f2;
      --panel: #ffffff;
      --text: #1f2420;
      --muted: #69716a;
      --line: #d9ddd9;
      --accent: #294f3f;
      --danger: #8a2c2c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111512;
        --panel: #171c18;
        --text: #e8ece8;
        --muted: #a6afa8;
        --line: #323a34;
        --accent: #a9d7c0;
        --danger: #ffb3b3;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    button, a { font: inherit; }
    button { cursor: pointer; }
    .shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
    header {
      display: flex; gap: 1rem; align-items: center; justify-content: space-between;
      padding: .9rem 1.2rem; border-bottom: 1px solid var(--line); background: var(--panel);
      position: sticky; top: 0; z-index: 3;
    }
    .brand { font-weight: 750; letter-spacing: -.02em; }
    .session { display: flex; gap: .75rem; align-items: center; color: var(--muted); font-size: .9rem; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--line); }
    .layout { display: grid; grid-template-columns: minmax(260px, 34%) 1fr; min-height: 0; }
    aside { border-right: 1px solid var(--line); padding: 1rem; overflow: auto; }
    main { padding: clamp(1rem, 3vw, 2.5rem); overflow: auto; }
    .card-button {
      width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 12px;
      background: var(--panel); color: var(--text); padding: .9rem; margin-bottom: .65rem;
    }
    .card-button:hover { border-color: var(--accent); }
    .card-button strong { display: block; margin-bottom: .35rem; }
    .summary { color: var(--muted); font-size: .92rem; line-height: 1.45; }
    .meta { margin-top: .55rem; color: var(--muted); font-size: .8rem; }
    .state { max-width: 680px; margin: 12vh auto 0; padding: 2rem; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
    .state h1 { margin-top: 0; }
    .state a, .primary { display: inline-block; color: #fff; background: #24292f; padding: .7rem 1rem; border-radius: 8px; text-decoration: none; border: 0; }
    .secondary { border: 1px solid var(--line); background: transparent; color: var(--text); padding: .45rem .7rem; border-radius: 8px; }
    .error { color: var(--danger); }
    article { max-width: 880px; }
    article h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin-top: 0; }
    article h2 { margin-top: 2rem; border-top: 1px solid var(--line); padding-top: 1.1rem; }
    article p, article li { line-height: 1.7; }
    .article-meta { color: var(--muted); margin-bottom: 1.5rem; }
    .empty { color: var(--muted); padding: 1rem 0; }
    [hidden] { display: none !important; }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); max-height: 42vh; }
      header { align-items: flex-start; }
      .session span { display: none; }
    }
  </style>
</head>
<body>
<div class="shell">
  <header id="header" hidden>
    <div class="brand">Knowledge Card</div>
    <div class="session">
      <img id="avatar" class="avatar" alt="" hidden>
      <span id="login"></span>
      <button id="logout" class="secondary" type="button">登出</button>
    </div>
  </header>
  <div id="app"></div>
</div>
<script>
(() => {
  const app = document.getElementById('app');
  const header = document.getElementById('header');
  const loginEl = document.getElementById('login');
  const avatarEl = document.getElementById('avatar');
  const logoutEl = document.getElementById('logout');

  function clearPrivateState() {
    app.replaceChildren();
    header.hidden = true;
    loginEl.textContent = '';
    avatarEl.removeAttribute('src');
    avatarEl.hidden = true;
  }

  function stateView(title, detail, action = true, kind = '') {
    clearPrivateState();
    const box = document.createElement('section');
    box.className = 'state';
    const h1 = document.createElement('h1');
    h1.textContent = title;
    if (kind) h1.classList.add(kind);
    const p = document.createElement('p');
    p.textContent = detail;
    box.append(h1, p);
    if (action) {
      const link = document.createElement('a');
      link.href = '/api/auth/login';
      link.textContent = '使用 GitHub 登入';
      box.append(link);
    }
    app.append(box);
  }

  async function api(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options
    });
    if (response.status === 401 || response.status === 403) {
      clearPrivateState();
      const forbidden = response.status === 403;
      stateView(
        forbidden ? '沒有 Workspace 資格' : '需要登入',
        forbidden ? '目前 GitHub 帳號無法讀取這個私人 Workspace。' : 'Session 已失效，請重新登入。',
        true,
        forbidden ? 'error' : ''
      );
      throw new Error('AUTH_STOP');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || 'Request failed.');
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function appendMarkdown(container, markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    let list = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        list = null;
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
      if (heading) {
        list = null;
        const el = document.createElement('h' + Math.min(3, heading[1].length));
        el.textContent = heading[2];
        container.append(el);
        continue;
      }
      const bullet = /^[-*]\s+(.+)$/u.exec(line);
      if (bullet) {
        if (!list) {
          list = document.createElement('ul');
          container.append(list);
        }
        const li = document.createElement('li');
        li.textContent = bullet[1];
        list.append(li);
        continue;
      }
      list = null;
      const p = document.createElement('p');
      p.textContent = line;
      container.append(p);
    }
  }

  function renderDetail(detail) {
    const main = document.getElementById('reader');
    main.replaceChildren();
    const article = document.createElement('article');
    const title = document.createElement('h1');
    title.textContent = detail.title;
    const meta = document.createElement('div');
    meta.className = 'article-meta';
    meta.textContent = [detail.resource_kind, detail.status, detail.updated_at].filter(Boolean).join(' · ');
    const body = document.createElement('div');
    appendMarkdown(body, detail.body);
    article.append(title, meta, body);
    main.append(article);
  }

  async function openCard(id) {
    try {
      const detail = await api('/api/cards/' + encodeURIComponent(id));
      renderDetail(detail);
    } catch (error) {
      if (error.message !== 'AUTH_STOP') stateView('讀取失敗', error.message, false, 'error');
    }
  }

  async function renderCards() {
    const payload = await api('/api/cards?limit=100');
    const layout = document.createElement('div');
    layout.className = 'layout';
    const aside = document.createElement('aside');
    const reader = document.createElement('main');
    reader.id = 'reader';
    const intro = document.createElement('div');
    intro.className = 'empty';
    intro.textContent = payload.items.length ? '選擇一張 Knowledge Card 閱讀。' : '目前沒有 Knowledge Card。';
    reader.append(intro);

    for (const item of payload.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-button';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = item.summary;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = [item.resource_kind, item.status, item.updated_at].filter(Boolean).join(' · ');
      button.append(title, summary, meta);
      button.addEventListener('click', () => openCard(item.id));
      aside.append(button);
    }

    layout.append(aside, reader);
    app.replaceChildren(layout);
  }

  function applyAuthResult() {
    const url = new URL(location.href);
    const result = url.searchParams.get('auth');
    if (!result) return;
    history.replaceState(null, '', url.pathname + url.hash);
    const messages = {
      cancelled: 'GitHub 登入已取消。',
      invalid: '登入流程無效或已過期，請重新登入。',
      forbidden: '這個 GitHub 帳號沒有私人 Workspace 存取資格。',
      unavailable: 'GitHub 登入或資格驗證目前不可用，請稍後再試。'
    };
    if (messages[result]) stateView('登入未完成', messages[result], true, result === 'forbidden' ? 'error' : '');
  }

  async function bootstrap() {
    applyAuthResult();
    try {
      const session = await api('/api/auth/session');
      header.hidden = false;
      loginEl.textContent = session.user.login;
      if (session.user.avatar_url) {
        avatarEl.src = session.user.avatar_url;
        avatarEl.alt = session.user.login;
        avatarEl.hidden = false;
      }
      await renderCards();
    } catch (error) {
      if (error.message === 'AUTH_STOP') return;
      if (error.message) stateView('服務暫時不可用', error.message, true, 'error');
    }
  }

  logoutEl.addEventListener('click', async () => {
    try {
      await api('/api/auth/session', { method: 'POST' });
      clearPrivateState();
      stateView('已登出', 'GitHub user token 已撤銷。', true);
    } catch (error) {
      if (error.message !== 'AUTH_STOP') stateView('登出失敗', error.message, false, 'error');
    }
  });

  bootstrap();
})();
</script>
</body>
</html>`;
}
