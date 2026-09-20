export const moduleId = 'web';
export const moduleKind = 'app';

export function renderPrivateSiteShell() {
  return String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Knowledge Radar</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color-scheme: light dark;
      --kc-brand: #536bff;
      --kc-brand-2: #6f82ff;
      --kc-brand-3: #4056dc;
      --kc-bg: #ffffff;
      --kc-bg-soft: #f6f7fb;
      --kc-panel: rgba(247, 248, 252, .88);
      --kc-text: #202127;
      --kc-muted: #686b76;
      --kc-subtle: #9296a3;
      --kc-divider: #e1e3ea;
      --kc-border: color-mix(in srgb, var(--kc-divider) 82%, transparent);
      --kc-page-max: 1440px;
      --kc-reading-max: 920px;
      --kc-page-gutter: clamp(16px, 3vw, 32px);
      --kc-radius-sm: 8px;
      --kc-radius-md: 12px;
      --kc-radius-lg: 18px;
      --kc-radius-xl: 24px;
      --kc-shadow: 0 16px 46px rgba(34, 39, 62, .07);
      --kc-danger: #b42318;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --kc-bg: #111318;
        --kc-bg-soft: #171a21;
        --kc-panel: rgba(27, 30, 38, .86);
        --kc-text: #f0f1f5;
        --kc-muted: #b1b4bf;
        --kc-subtle: #858995;
        --kc-divider: #30343d;
        --kc-border: color-mix(in srgb, var(--kc-divider) 88%, transparent);
        --kc-shadow: 0 18px 54px rgba(0, 0, 0, .24);
        --kc-danger: #ffb4ab;
      }
    }
    * { box-sizing: border-box; }
    html { background: var(--kc-bg); }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--kc-brand) 7%, transparent), transparent 28rem),
        var(--kc-bg);
      color: var(--kc-text);
    }
    button, input, select, a { font: inherit; }
    button { cursor: pointer; }
    a { color: inherit; }
    [hidden] { display: none !important; }

    .shell { min-height: 100vh; }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      min-height: 64px;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding-inline: max(var(--kc-page-gutter), calc((100vw - var(--kc-page-max)) / 2));
      border-bottom: 1px solid var(--kc-border);
      background: color-mix(in srgb, var(--kc-bg) 88%, transparent);
      backdrop-filter: blur(18px);
    }
    .brand-row, .session, .nav {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand {
      margin-right: 6px;
      font-weight: 800;
      letter-spacing: -.025em;
      white-space: nowrap;
    }
    .nav button {
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--kc-muted);
      padding: 9px 10px;
      font-size: 14px;
      font-weight: 650;
    }
    .nav button:hover,
    .nav button[aria-current="page"] {
      color: var(--kc-brand);
      background: color-mix(in srgb, var(--kc-brand) 9%, transparent);
    }
    .session {
      color: var(--kc-muted);
      font-size: 13px;
    }
    .release-badge {
      max-width: 250px;
      overflow: hidden;
      color: var(--kc-subtle);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatar {
      width: 28px;
      height: 28px;
      border: 1px solid var(--kc-border);
      border-radius: 50%;
      background: var(--kc-bg-soft);
    }
    .secondary,
    .radar-reset {
      min-height: 38px;
      padding: 0 14px;
      border: 1px solid var(--kc-border);
      border-radius: 999px;
      background: var(--kc-bg);
      color: var(--kc-muted);
    }
    .secondary:hover,
    .radar-reset:hover {
      border-color: var(--kc-brand);
      color: var(--kc-brand);
    }

    .page-shell {
      width: min(calc(100% - 2 * var(--kc-page-gutter)), var(--kc-page-max));
      margin-inline: auto;
    }
    .radar-view { padding-block: 28px 64px; }
    .radar-hero {
      position: relative;
      overflow: hidden;
      padding: 48px;
      border: 1px solid var(--kc-border);
      border-radius: 28px;
      background:
        radial-gradient(circle at 86% 12%, color-mix(in srgb, var(--kc-brand) 22%, transparent), transparent 34%),
        linear-gradient(145deg, var(--kc-bg-soft), var(--kc-bg));
      box-shadow: 0 18px 70px rgba(34, 39, 62, .06);
    }
    .radar-kicker {
      color: var(--kc-brand);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .16em;
    }
    .radar-hero h1 {
      margin: 8px 0 12px;
      font-size: clamp(38px, 6vw, 68px);
      line-height: .98;
      letter-spacing: -.045em;
    }
    .radar-hero > p {
      max-width: 760px;
      margin: 0;
      color: var(--kc-muted);
      font-size: 17px;
      line-height: 1.8;
    }
    .radar-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 34px;
    }
    .radar-stat {
      padding: 17px 18px;
      border: 1px solid var(--kc-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--kc-bg) 78%, transparent);
    }
    .radar-stat strong,
    .radar-stat span { display: block; }
    .radar-stat strong {
      font-size: 26px;
      line-height: 1.1;
    }
    .radar-stat span {
      margin-top: 5px;
      color: var(--kc-muted);
      font-size: 12px;
    }

    .radar-controls {
      margin-top: 20px;
      padding: 22px;
      border: 1px solid var(--kc-border);
      border-radius: 22px;
      background: var(--kc-panel);
    }
    .radar-controls-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
    }
    .radar-controls-head strong {
      display: block;
      font-size: 15px;
    }
    .radar-controls-head small {
      display: block;
      margin-top: 4px;
      color: var(--kc-muted);
      font-size: 12px;
    }
    .radar-search-row {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) 190px 160px auto;
      gap: 12px;
      align-items: end;
    }
    .radar-controls label > span,
    .radar-control-label {
      display: block;
      margin-bottom: 7px;
      color: var(--kc-muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
    }
    .radar-controls input[type="search"],
    .radar-controls select,
    .search-form input,
    .graph-toolbar input,
    .graph-toolbar select {
      width: 100%;
      height: 42px;
      padding: 0 12px;
      border: 1px solid var(--kc-border);
      border-radius: 11px;
      outline: none;
      background: var(--kc-bg);
      color: var(--kc-text);
    }
    .radar-controls input[type="search"]:focus,
    .radar-controls select:focus,
    .search-form input:focus,
    .graph-toolbar input:focus,
    .graph-toolbar select:focus {
      border-color: var(--kc-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--kc-brand) 14%, transparent);
    }
    .radar-control-group { margin-top: 18px; }
    .radar-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .radar-pills button {
      padding: 7px 11px;
      border: 1px solid var(--kc-border);
      border-radius: 999px;
      background: var(--kc-bg);
      color: var(--kc-muted);
      font-size: 12px;
      transition: .18s ease;
    }
    .radar-pills button:hover,
    .radar-pills button.active {
      border-color: var(--kc-brand);
      background: color-mix(in srgb, var(--kc-brand) 10%, var(--kc-bg));
      color: var(--kc-brand);
    }
    .radar-pills small { margin-left: 4px; opacity: .72; }
    .radar-results-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 26px 2px 12px;
      color: var(--kc-muted);
      font-size: 13px;
    }
    .radar-results-head strong {
      color: var(--kc-text);
      font-size: 17px;
    }
    .radar-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .knowledge-tile {
      display: flex;
      min-height: 330px;
      flex-direction: column;
      padding: 22px;
      border: 1px solid var(--kc-border);
      border-radius: 20px;
      background: var(--kc-bg);
      box-shadow: 0 10px 36px rgba(34, 39, 62, .035);
      text-align: left;
      color: var(--kc-text);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    .knowledge-tile:hover {
      transform: translateY(-3px);
      border-color: color-mix(in srgb, var(--kc-brand) 55%, var(--kc-border));
      box-shadow: var(--kc-shadow);
    }
    .knowledge-tile-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .knowledge-source {
      color: var(--kc-muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .knowledge-status {
      color: var(--kc-brand);
      font-size: 11px;
      font-weight: 750;
    }
    .knowledge-tile h2 {
      margin: 15px 0 10px;
      font-size: 20px;
      line-height: 1.35;
      letter-spacing: -.02em;
    }
    .knowledge-tile .summary {
      display: -webkit-box;
      overflow: hidden;
      margin: 0;
      color: var(--kc-muted);
      font-size: 14px;
      line-height: 1.65;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 5;
    }
    .knowledge-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 16px;
    }
    .knowledge-categories span,
    .pill {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 8px;
      background: var(--kc-bg-soft);
      color: var(--kc-muted);
      font-size: 11px;
    }
    .knowledge-tile footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
      padding-top: 18px;
      color: var(--kc-subtle);
      font-size: 12px;
    }
    .knowledge-tile footer b {
      color: var(--kc-brand);
      font-weight: 700;
    }
    .radar-empty {
      padding: 50px 24px;
      border: 1px dashed var(--kc-border);
      border-radius: 20px;
      color: var(--kc-muted);
      text-align: center;
    }

    .detail-view,
    .search-view,
    .graph-view {
      padding-block: 30px 64px;
    }
    .detail-back {
      margin-bottom: 16px;
      border: 0;
      background: transparent;
      color: var(--kc-brand);
      padding: 0;
      font-weight: 700;
    }
    .knowledge-detail-head {
      margin-bottom: 34px;
      padding: 22px;
      border: 1px solid var(--kc-border);
      border-radius: var(--kc-radius-lg);
      background: var(--kc-panel);
    }
    .knowledge-detail-top,
    .knowledge-detail-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .knowledge-detail-source,
    .knowledge-detail-footer,
    .article-meta {
      color: var(--kc-subtle);
      font-size: 12px;
    }
    .knowledge-detail-head h1 {
      max-width: 980px;
      margin: 10px 0 8px;
      font-size: clamp(30px, 5vw, 52px);
      line-height: 1.06;
      letter-spacing: -.035em;
    }
    .knowledge-detail-summary {
      max-width: 900px;
      margin: 0;
      color: var(--kc-muted);
      line-height: 1.7;
    }
    .knowledge-tags,
    .knowledge-actions,
    .knowledge-detail-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }
    .knowledge-actions span {
      padding: 5px 9px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--kc-brand) 11%, var(--kc-bg));
      color: var(--kc-brand);
      font-size: 11px;
      font-weight: 800;
    }
    .knowledge-tags span {
      color: var(--kc-subtle);
      font-size: 11px;
    }
    .relevance-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 18px;
      margin: 20px 0;
    }
    .relevance-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 5px 10px;
      align-items: center;
    }
    .relevance-item label,
    .relevance-item strong { font-size: 11px; }
    .relevance-item label { color: var(--kc-muted); }
    .relevance-track {
      grid-column: 1 / -1;
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--kc-bg-soft);
    }
    .relevance-track i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--kc-brand);
    }
    .knowledge-detail-footer {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--kc-border);
    }
    .knowledge-detail-footer a {
      color: var(--kc-brand);
      text-decoration: none;
    }
    article {
      width: min(100%, var(--kc-reading-max));
      margin-inline: auto;
    }
    article > h2,
    article section > h2 {
      margin-top: 2.2rem;
      padding-top: 1.1rem;
      border-top: 1px solid var(--kc-border);
    }
    article p,
    article li { line-height: 1.78; }
    article .result-button {
      width: 100%;
      margin-bottom: 10px;
    }

    .state {
      width: min(calc(100% - 2 * var(--kc-page-gutter)), 680px);
      margin: 12vh auto 0;
      padding: 32px;
      border: 1px solid var(--kc-border);
      border-radius: 24px;
      background:
        radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--kc-brand) 18%, transparent), transparent 40%),
        var(--kc-bg);
      box-shadow: var(--kc-shadow);
    }
    .state::before {
      display: block;
      margin-bottom: 8px;
      color: var(--kc-brand);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .16em;
      content: "KNOWLEDGE RADAR";
    }
    .state h1 {
      margin: 0 0 10px;
      font-size: 34px;
      letter-spacing: -.03em;
    }
    .state p {
      color: var(--kc-muted);
      line-height: 1.7;
    }
    .state a,
    .primary {
      display: inline-flex;
      min-height: 42px;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 0;
      border-radius: 10px;
      background: var(--kc-brand);
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    .state a:hover,
    .primary:hover { background: var(--kc-brand-3); }
    .error { color: var(--kc-danger); }
    .empty { color: var(--kc-muted); padding: 1rem 0; }
    .meta { margin-top: .55rem; color: var(--kc-muted); font-size: .8rem; }
    .result-button {
      width: 100%;
      padding: 16px;
      border: 1px solid var(--kc-border);
      border-radius: 14px;
      background: var(--kc-bg);
      color: var(--kc-text);
      text-align: left;
    }
    .result-button:hover { border-color: var(--kc-brand); }
    .result-button strong { display: block; margin-bottom: 6px; }
    .summary { color: var(--kc-muted); font-size: .92rem; line-height: 1.45; }

    .search-view h1,
    .graph-view h1 {
      margin: 0 0 18px;
      font-size: clamp(32px, 5vw, 52px);
      letter-spacing: -.035em;
    }
    .search-form,
    .graph-toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 18px;
      padding: 18px;
      border: 1px solid var(--kc-border);
      border-radius: 18px;
      background: var(--kc-panel);
    }
    .search-form input,
    .graph-toolbar input { min-width: min(420px, 100%); flex: 1; }
    .graph-toolbar select { width: auto; min-width: 160px; }
    .graph-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
      gap: 14px;
      min-height: 70vh;
    }
    .graph-canvas {
      width: 100%;
      min-height: 620px;
      border: 1px solid var(--kc-border);
      border-radius: 18px;
      background: var(--kc-bg);
      box-shadow: 0 10px 36px rgba(34, 39, 62, .035);
      touch-action: none;
    }
    .graph-info {
      padding: 18px;
      overflow: auto;
      border: 1px solid var(--kc-border);
      border-radius: 18px;
      background: var(--kc-panel);
    }
    .graph-edge { stroke: var(--kc-divider); stroke-width: 1.2; opacity: .7; }
    .graph-edge.card-card { stroke: color-mix(in srgb, var(--kc-brand) 45%, var(--kc-divider)); stroke-width: 1.8; }
    .graph-node circle { fill: var(--kc-bg); stroke: var(--kc-brand); stroke-width: 2; }
    .graph-node.concept circle { stroke-dasharray: 4 2; }
    .graph-node text { fill: var(--kc-text); font-size: 12px; pointer-events: none; }
    .graph-node.dim { opacity: .12; }
    .graph-node.focus circle { stroke-width: 4; }

    @media (max-width: 1080px) {
      .radar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .radar-search-row { grid-template-columns: 1fr 1fr; }
      .relevance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 900px) {
      header { align-items: flex-start; flex-wrap: wrap; padding-block: 10px; }
      .brand-row { width: 100%; justify-content: space-between; }
      .graph-wrap { grid-template-columns: 1fr; }
      .graph-canvas { min-height: 480px; }
      .radar-hero { padding: 34px; }
      .radar-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 680px) {
      .session span { display: none; }
      .nav { max-width: 100%; overflow-x: auto; }
      .radar-view,
      .detail-view,
      .search-view,
      .graph-view { padding-block: 18px 44px; }
      .radar-hero { padding: 26px 22px; border-radius: 22px; }
      .radar-stats { grid-template-columns: 1fr 1fr; }
      .radar-controls { padding: 16px; border-radius: 18px; }
      .radar-controls-head { align-items: flex-start; flex-direction: column; }
      .radar-search-row { grid-template-columns: 1fr; }
      .radar-grid { grid-template-columns: 1fr; }
      .knowledge-tile { min-height: 0; }
      .relevance-grid { grid-template-columns: 1fr; }
      .knowledge-detail-top,
      .knowledge-detail-footer { flex-direction: column; }
      .release-badge { display: none; }
    }
  </style>
</head>
<body>
<div class="shell">
  <header id="header" hidden>
    <div class="brand-row">
      <div class="brand">Knowledge Radar</div>
      <nav class="nav" aria-label="私人知識導覽">
        <button id="nav-cards" type="button" aria-current="page">卡片</button>
        <button id="nav-search" type="button">搜尋</button>
        <button id="nav-graph" type="button">圖譜</button>
      </nav>
    </div>
    <div class="session">
      <span id="release" class="release-badge"></span>
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
  const releaseEl = document.getElementById('release');
  const nav = {
    cards: document.getElementById('nav-cards'),
    search: document.getElementById('nav-search'),
    graph: document.getElementById('nav-graph')
  };

  function clearPrivateState() {
    app.replaceChildren();
    header.hidden = true;
    loginEl.textContent = '';
    releaseEl.textContent = '';
    avatarEl.removeAttribute('src');
    avatarEl.hidden = true;
  }

  function setView(name) {
    for (const [key, button] of Object.entries(nav)) {
      if (key === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
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

  function sectionList(title, values, render) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = title;
    section.append(h2);
    if (!values?.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '目前沒有資料。';
      section.append(empty);
      return section;
    }
    for (const value of values) section.append(render(value));
    return section;
  }

  function renderDetail(detail) {
    setView('cards');
    const view = document.createElement('section');
    view.className = 'detail-view page-shell';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'detail-back';
    back.textContent = '← 回到 Knowledge Radar';
    back.addEventListener('click', () => renderCards().catch((error) => {
      if (error.message !== 'AUTH_STOP') stateView('讀取失敗', error.message, false, 'error');
    }));

    const head = document.createElement('section');
    head.className = 'knowledge-detail-head';

    const top = document.createElement('div');
    top.className = 'knowledge-detail-top';
    const headingBlock = document.createElement('div');
    const source = document.createElement('div');
    source.className = 'knowledge-detail-source';
    source.textContent = [detail.source?.type, detail.resource_kind, detail.status].filter(Boolean).join(' · ');
    const title = document.createElement('h1');
    title.textContent = detail.title;
    const summary = document.createElement('p');
    summary.className = 'knowledge-detail-summary';
    summary.textContent = detail.summary || '';
    headingBlock.append(source, title, summary);

    const actions = document.createElement('div');
    actions.className = 'knowledge-actions';
    for (const action of detail.actions || []) {
      const badge = document.createElement('span');
      badge.textContent = action;
      actions.append(badge);
    }
    top.append(headingBlock, actions);
    head.append(top);

    const categories = document.createElement('div');
    categories.className = 'knowledge-detail-categories';
    for (const category of detail.navigation_categories || []) {
      const badge = document.createElement('span');
      badge.className = 'pill';
      badge.textContent = category;
      categories.append(badge);
    }
    head.append(categories);

    const dimensions = [
      ['overall', 'Overall'],
      ['ai_rd', 'AI RD'],
      ['aoi_ai', 'AOI × AI'],
      ['llm_agent', 'LLM / Agent'],
      ['sillytavern_ai_rpg', 'SillyTavern / AI RPG'],
      ['image_gen', 'Image Gen']
    ];
    const relevance = document.createElement('div');
    relevance.className = 'relevance-grid';
    for (const [key, label] of dimensions) {
      const score = Number(detail.relevance?.[key]);
      if (!Number.isFinite(score)) continue;
      const item = document.createElement('div');
      item.className = 'relevance-item';
      const name = document.createElement('label');
      name.textContent = label;
      const value = document.createElement('strong');
      value.textContent = score + ' / 5';
      const track = document.createElement('div');
      track.className = 'relevance-track';
      const fill = document.createElement('i');
      fill.style.width = Math.max(0, Math.min(5, score)) * 20 + '%';
      track.append(fill);
      item.append(name, value, track);
      relevance.append(item);
    }
    if (relevance.childElementCount) head.append(relevance);

    const tags = document.createElement('div');
    tags.className = 'knowledge-tags';
    for (const tag of detail.tags || []) {
      const badge = document.createElement('span');
      badge.textContent = '#' + tag;
      tags.append(badge);
    }
    head.append(tags);

    const footer = document.createElement('div');
    footer.className = 'knowledge-detail-footer';
    const dates = document.createElement('span');
    dates.textContent = [
      detail.created_at ? '建立 ' + detail.created_at : '',
      detail.updated_at ? '更新 ' + detail.updated_at : '',
      detail.last_checked_at ? '最近檢查 ' + detail.last_checked_at : ''
    ].filter(Boolean).join(' · ');
    const links = document.createElement('span');
    if (detail.canonical_url) {
      const original = document.createElement('a');
      original.href = detail.canonical_url;
      original.target = '_blank';
      original.rel = 'noreferrer';
      original.textContent = '原始來源 ↗';
      links.append(original);
    }
    footer.append(dates, links);
    head.append(footer);

    const article = document.createElement('article');
    const body = document.createElement('div');
    appendMarkdown(body, detail.body);
    article.append(body);

    article.append(sectionList('關聯', detail.relations, (relation) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result-button';
      button.addEventListener('click', () => openCard(relation.other_id));
      const strong = document.createElement('strong');
      strong.textContent = relation.other_title;
      const info = document.createElement('div');
      info.className = 'meta';
      info.textContent = [relation.type, relation.method, Number(relation.score).toFixed(3)].join(' · ');
      button.append(strong, info);
      return button;
    }));

    article.append(sectionList('Concepts', detail.concepts, (concept) => {
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = concept.label + ' · ' + concept.origin;
      span.title = (concept.evidence || []).map((entry) => entry.kind + ':' + entry.value).join(', ');
      return span;
    }));

    view.append(back, head, article);
    app.replaceChildren(view);
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
    setView('cards');
    const payload = await api('/api/cards?limit=100');
    const cards = payload.items || [];

    const view = document.createElement('main');
    view.className = 'radar-view page-shell';

    const hero = document.createElement('section');
    hero.className = 'radar-hero';
    const kicker = document.createElement('div');
    kicker.className = 'radar-kicker';
    kicker.textContent = 'PERSONAL TECHNOLOGY RADAR';
    const title = document.createElement('h1');
    title.textContent = 'Knowledge Radar';
    const intro = document.createElement('p');
    intro.textContent = '把值得保留的 AI、Agent、AOI 與創作技術，整理成可搜尋、可比較、可持續更新的 Knowledge Cards。';

    const categoryCounts = new Map();
    const resourceCounts = new Map();
    let activeCount = 0;
    for (const card of cards) {
      if (card.status === 'active') activeCount += 1;
      if (card.resource_kind) resourceCounts.set(card.resource_kind, (resourceCounts.get(card.resource_kind) || 0) + 1);
      for (const category of card.navigation_categories || []) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
    }

    const stats = document.createElement('div');
    stats.className = 'radar-stats';
    for (const [value, label] of [
      [cards.length, 'Knowledge Cards'],
      [activeCount, 'Active'],
      [resourceCounts.size, '資源型態'],
      [categoryCounts.size, '主題分類']
    ]) {
      const stat = document.createElement('div');
      stat.className = 'radar-stat';
      const strong = document.createElement('strong');
      strong.textContent = String(value);
      const span = document.createElement('span');
      span.textContent = label;
      stat.append(strong, span);
      stats.append(stat);
    }
    hero.append(kicker, title, intro, stats);

    const controls = document.createElement('section');
    controls.className = 'radar-controls';
    const controlsHead = document.createElement('div');
    controlsHead.className = 'radar-controls-head';
    const controlsText = document.createElement('div');
    const controlsTitle = document.createElement('strong');
    controlsTitle.textContent = '搜尋與篩選';
    const controlsHint = document.createElement('small');
    controlsHint.textContent = '搜尋標題與摘要，或依主題分類、資源型態、狀態與更新時間整理';
    controlsText.append(controlsTitle, controlsHint);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'radar-reset';
    reset.textContent = '重設篩選';
    controlsHead.append(controlsText, reset);

    const row = document.createElement('div');
    row.className = 'radar-search-row';
    const makeLabel = (labelText, control) => {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = labelText;
      label.append(span, control);
      return label;
    };

    const query = document.createElement('input');
    query.type = 'search';
    query.placeholder = 'Knowledge Card、技術、主題…';
    query.autocomplete = 'off';

    const resource = document.createElement('select');
    const resourceAll = document.createElement('option');
    resourceAll.value = 'ALL';
    resourceAll.textContent = '全部';
    resource.append(resourceAll);
    for (const [kind, count] of [...resourceCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const option = document.createElement('option');
      option.value = kind;
      option.textContent = kind + ' (' + count + ')';
      resource.append(option);
    }

    const status = document.createElement('select');
    for (const [value, label] of [['ALL', '全部'], ['active', 'active'], ['archived', 'archived']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      status.append(option);
    }

    const sort = document.createElement('select');
    for (const [value, label] of [['newest', '最近更新'], ['title', '名稱']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sort.append(option);
    }
    row.append(
      makeLabel('搜尋', query),
      makeLabel('資源型態', resource),
      makeLabel('狀態', status),
      makeLabel('排序', sort)
    );

    const categoryGroup = document.createElement('div');
    categoryGroup.className = 'radar-control-group';
    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'radar-control-label';
    categoryLabel.textContent = '主題分類';
    const pills = document.createElement('div');
    pills.className = 'radar-pills';
    categoryGroup.append(categoryLabel, pills);
    controls.append(controlsHead, row, categoryGroup);

    const resultHead = document.createElement('section');
    resultHead.className = 'radar-results-head';
    const resultCount = document.createElement('div');
    const resultContext = document.createElement('div');
    resultHead.append(resultCount, resultContext);

    const grid = document.createElement('section');
    grid.className = 'radar-grid';

    let selectedCategory = 'ALL';
    const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-TW'));

    function renderCategoryPills() {
      pills.replaceChildren();
      const entries = [['ALL', cards.length], ...categories];
      for (const [category, count] of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.toggle('active', selectedCategory === category);
        button.textContent = category === 'ALL' ? '全部 ' : category + ' ';
        const small = document.createElement('small');
        small.textContent = String(count);
        button.append(small);
        button.addEventListener('click', () => {
          selectedCategory = category;
          renderCategoryPills();
          renderGrid();
        });
        pills.append(button);
      }
    }

    function renderGrid() {
      const needle = query.value.trim().toLocaleLowerCase('zh-TW');
      let filtered = cards.filter((card) => {
        if (resource.value !== 'ALL' && card.resource_kind !== resource.value) return false;
        if (status.value !== 'ALL' && card.status !== status.value) return false;
        if (selectedCategory !== 'ALL' && !(card.navigation_categories || []).includes(selectedCategory)) return false;
        if (!needle) return true;
        const haystack = [
          card.title,
          card.summary,
          card.resource_kind,
          card.status,
          ...(card.navigation_categories || [])
        ].filter(Boolean).join(' ').toLocaleLowerCase('zh-TW');
        return haystack.includes(needle);
      });

      filtered = [...filtered].sort((a, b) => {
        if (sort.value === 'title') return a.title.localeCompare(b.title, 'zh-TW');
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
          || a.title.localeCompare(b.title, 'zh-TW');
      });

      resultCount.replaceChildren();
      const countStrong = document.createElement('strong');
      countStrong.textContent = String(filtered.length);
      resultCount.append(countStrong, document.createTextNode(' 筆結果'));
      resultContext.textContent = selectedCategory === 'ALL' ? '全部主題' : selectedCategory;
      grid.replaceChildren();

      if (!filtered.length) {
        const empty = document.createElement('section');
        empty.className = 'radar-empty';
        const strong = document.createElement('strong');
        strong.textContent = '沒有符合條件的 Knowledge Card';
        const p = document.createElement('p');
        p.textContent = '調整搜尋字詞或清除部分篩選條件。';
        empty.append(strong, p);
        grid.append(empty);
        return;
      }

      for (const card of filtered) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'knowledge-tile';
        tile.addEventListener('click', () => openCard(card.id));

        const top = document.createElement('div');
        top.className = 'knowledge-tile-top';
        const source = document.createElement('div');
        source.className = 'knowledge-source';
        source.textContent = card.resource_kind || 'Knowledge Card';
        const state = document.createElement('div');
        state.className = 'knowledge-status';
        state.textContent = card.status || '';
        top.append(source, state);

        const h2 = document.createElement('h2');
        h2.textContent = card.title;
        const summary = document.createElement('p');
        summary.className = 'summary';
        summary.textContent = card.summary || '';

        const categoriesEl = document.createElement('div');
        categoriesEl.className = 'knowledge-categories';
        for (const category of (card.navigation_categories || []).slice(0, 4)) {
          const badge = document.createElement('span');
          badge.textContent = category;
          categoriesEl.append(badge);
        }

        const footer = document.createElement('footer');
        const updated = document.createElement('span');
        updated.textContent = card.updated_at ? '更新 ' + card.updated_at : '';
        const open = document.createElement('b');
        open.textContent = '查看分析 →';
        footer.append(updated, open);

        tile.append(top, h2, summary, categoriesEl, footer);
        grid.append(tile);
      }
    }

    const update = () => renderGrid();
    query.addEventListener('input', update);
    resource.addEventListener('change', update);
    status.addEventListener('change', update);
    sort.addEventListener('change', update);
    reset.addEventListener('click', () => {
      query.value = '';
      resource.value = 'ALL';
      status.value = 'ALL';
      sort.value = 'newest';
      selectedCategory = 'ALL';
      renderCategoryPills();
      renderGrid();
    });

    renderCategoryPills();
    renderGrid();
    view.append(hero, controls, resultHead, grid);
    app.replaceChildren(view);
  }

  async function renderSearch() {
    setView('search');
    const view = document.createElement('section');
    view.className = 'search-view page-shell';
    const h1 = document.createElement('h1');
    h1.textContent = '搜尋';
    const form = document.createElement('form');
    form.className = 'search-form';
    const input = document.createElement('input');
    input.type = 'search';
    input.name = 'q';
    input.placeholder = '搜尋標題、摘要、分類、標籤與正文';
    input.autocomplete = 'off';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary';
    submit.textContent = '搜尋';
    const results = document.createElement('div');
    form.append(input, submit);
    view.append(h1, form, results);
    app.replaceChildren(view);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query) return;
      results.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'empty';
      loading.textContent = '搜尋中…';
      results.append(loading);
      try {
        const payload = await api('/api/search?q=' + encodeURIComponent(query) + '&limit=50');
        results.replaceChildren();
        if (!payload.items.length) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = '沒有符合結果。';
          results.append(empty);
          return;
        }
        for (const item of payload.items) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'result-button';
          const strong = document.createElement('strong');
          strong.textContent = item.title;
          const summary = document.createElement('div');
          summary.className = 'summary';
          summary.textContent = item.summary;
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.textContent = 'score ' + item.score.toFixed(2) + ' · ' + item.matched_fields.join(', ');
          button.append(strong, summary, meta);
          button.addEventListener('click', async () => {
            await renderCards();
            await openCard(item.id);
          });
          results.append(button);
        }
      } catch (error) {
        if (error.message !== 'AUTH_STOP') {
          results.replaceChildren();
          const problem = document.createElement('div');
          problem.className = 'error';
          problem.textContent = error.message;
          results.append(problem);
        }
      }
    });
    input.focus();
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  }

  async function renderGraph() {
    setView('graph');
    const payload = await api('/api/graph');
    const view = document.createElement('section');
    view.className = 'graph-view page-shell';
    const h1 = document.createElement('h1');
    h1.textContent = '圖譜';
    const toolbar = document.createElement('div');
    toolbar.className = 'graph-toolbar';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '篩選節點';
    const kind = document.createElement('select');
    for (const [value, label] of [['all', '全部節點'], ['card', 'Cards'], ['concept', 'Concepts']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      kind.append(option);
    }
    const relationToggleLabel = document.createElement('label');
    const relationToggle = document.createElement('input');
    relationToggle.type = 'checkbox';
    relationToggle.checked = true;
    relationToggleLabel.append(relationToggle, document.createTextNode(' Card↔Card'));
    toolbar.append(search, kind, relationToggleLabel);

    const wrap = document.createElement('div');
    wrap.className = 'graph-wrap';
    const svg = svgElement('svg', { viewBox: '0 0 1000 700', class: 'graph-canvas', role: 'img', 'aria-label': 'Knowledge Card graph' });
    const viewport = svgElement('g');
    svg.append(viewport);
    const info = document.createElement('div');
    info.className = 'graph-info';
    info.textContent = '選取節點查看關聯。';
    wrap.append(svg, info);
    view.append(h1, toolbar, wrap);
    app.replaceChildren(view);

    const nodes = new Map(payload.nodes.map((node) => [node.id, node]));
    const nodeEls = new Map();
    const edgeEls = [];
    const xOf = (node) => 500 + (Number(node.x) * 360);
    const yOf = (node) => 350 + (Number(node.y) * 260);

    for (const edge of payload.edges) {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (!source || !target) continue;
      const line = svgElement('line', {
        x1: xOf(source), y1: yOf(source), x2: xOf(target), y2: yOf(target),
        class: 'graph-edge ' + edge.kind
      });
      line.dataset.kind = edge.kind;
      viewport.append(line);
      edgeEls.push({ edge, element: line });
    }

    for (const node of payload.nodes) {
      const group = svgElement('g', {
        class: 'graph-node ' + node.kind,
        transform: 'translate(' + xOf(node) + ' ' + yOf(node) + ')'
      });
      group.dataset.nodeId = node.id;
      const circle = svgElement('circle', { r: node.kind === 'concept' ? 9 : 7 });
      const text = svgElement('text', { x: 12, y: 4 });
      text.textContent = node.label;
      group.append(circle, text);
      viewport.append(group);
      nodeEls.set(node.id, group);

      group.addEventListener('click', async () => {
        for (const element of nodeEls.values()) element.classList.remove('focus');
        group.classList.add('focus');
        info.replaceChildren();
        const title = document.createElement('h2');
        title.textContent = node.label;
        const type = document.createElement('div');
        type.className = 'meta';
        type.textContent = node.kind;
        info.append(title, type);

        if (node.kind === 'card') {
          const open = document.createElement('button');
          open.type = 'button';
          open.className = 'primary';
          open.textContent = '開啟 Card';
          open.addEventListener('click', async () => {
            await renderCards();
            await openCard(node.entity_id);
          });
          info.append(open);
          const neighbors = payload.semantic_neighbors?.[node.entity_id] || [];
          const section = document.createElement('h3');
          section.textContent = 'Semantic neighbors';
          info.append(section);
          for (const neighbor of neighbors) {
            const row = document.createElement('div');
            row.className = 'meta';
            const neighborNode = nodes.get('card:' + neighbor.card_id);
            row.textContent = (neighborNode?.label || neighbor.card_id) + ' · similarity ' + neighbor.similarity.toFixed(3);
            info.append(row);
          }
        } else {
          const connected = payload.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
          const section = document.createElement('h3');
          section.textContent = 'Connected nodes';
          info.append(section);
          for (const edge of connected.slice(0, 30)) {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const row = document.createElement('div');
            row.className = 'meta';
            row.textContent = (nodes.get(otherId)?.label || otherId) + ' · ' + edge.relation_type;
            info.append(row);
          }
        }
      });
    }

    function applyFilter() {
      const needle = search.value.trim().toLocaleLowerCase('en-US');
      const selectedKind = kind.value;
      for (const [id, element] of nodeEls) {
        const node = nodes.get(id);
        const visibleKind = selectedKind === 'all' || node.kind === selectedKind;
        const visibleText = !needle || node.label.toLocaleLowerCase('en-US').includes(needle);
        element.classList.toggle('dim', !(visibleKind && visibleText));
      }
      for (const item of edgeEls) {
        item.element.style.display = (!relationToggle.checked && item.edge.kind === 'card-card') ? 'none' : '';
      }
    }
    search.addEventListener('input', applyFilter);
    kind.addEventListener('change', applyFilter);
    relationToggle.addEventListener('change', applyFilter);

    let scale = 1;
    let tx = 0;
    let ty = 0;
    let drag = null;
    function transform() {
      viewport.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + scale + ')');
    }
    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      scale = Math.max(.4, Math.min(4, scale * (event.deltaY < 0 ? 1.12 : .89)));
      transform();
    }, { passive: false });
    svg.addEventListener('pointerdown', (event) => {
      drag = { x: event.clientX, y: event.clientY, tx, ty };
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', (event) => {
      if (!drag) return;
      tx = drag.tx + (event.clientX - drag.x);
      ty = drag.ty + (event.clientY - drag.y);
      transform();
    });
    svg.addEventListener('pointerup', () => { drag = null; });
    svg.addEventListener('pointercancel', () => { drag = null; });
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
      const release = await api('/api/release');
      releaseEl.textContent = release.release_id ? 'release ' + release.release_id : 'bootstrap';
      await renderCards();
    } catch (error) {
      if (error.message === 'AUTH_STOP') return;
      if (error.message) stateView('服務暫時不可用', error.message, true, 'error');
    }
  }

  nav.cards.addEventListener('click', () => renderCards().catch((error) => {
    if (error.message !== 'AUTH_STOP') stateView('讀取失敗', error.message, false, 'error');
  }));
  nav.search.addEventListener('click', () => renderSearch().catch((error) => {
    if (error.message !== 'AUTH_STOP') stateView('搜尋不可用', error.message, false, 'error');
  }));
  nav.graph.addEventListener('click', () => renderGraph().catch((error) => {
    if (error.message !== 'AUTH_STOP') stateView('圖譜不可用', error.message, false, 'error');
  }));

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
