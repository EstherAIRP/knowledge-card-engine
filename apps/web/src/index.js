export const moduleId = 'web';
export const moduleKind = 'app';

export function renderPrivateSiteShell() {
  return String.raw`<!doctype html>
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
    button, input, select, a { font: inherit; }
    button { cursor: pointer; }
    .shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
    header {
      display: flex; gap: 1rem; align-items: center; justify-content: space-between;
      padding: .8rem 1.2rem; border-bottom: 1px solid var(--line); background: var(--panel);
      position: sticky; top: 0; z-index: 3;
    }
    .brand-row, .session, .nav { display: flex; gap: .7rem; align-items: center; }
    .brand { font-weight: 750; letter-spacing: -.02em; white-space: nowrap; }
    .nav button, .secondary {
      border: 1px solid var(--line); background: transparent; color: var(--text);
      padding: .45rem .7rem; border-radius: 8px;
    }
    .nav button[aria-current="page"] { border-color: var(--accent); color: var(--accent); }
    .session { color: var(--muted); font-size: .9rem; }
    .release-badge { font-size: .78rem; color: var(--muted); white-space: nowrap; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--line); }
    .layout { display: grid; grid-template-columns: minmax(260px, 34%) 1fr; min-height: 0; }
    aside { border-right: 1px solid var(--line); padding: 1rem; overflow: auto; }
    main { padding: clamp(1rem, 3vw, 2.5rem); overflow: auto; }
    .card-button, .result-button {
      width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 12px;
      background: var(--panel); color: var(--text); padding: .9rem; margin-bottom: .65rem;
    }
    .card-button:hover, .result-button:hover { border-color: var(--accent); }
    .card-button strong, .result-button strong { display: block; margin-bottom: .35rem; }
    .summary { color: var(--muted); font-size: .92rem; line-height: 1.45; }
    .meta { margin-top: .55rem; color: var(--muted); font-size: .8rem; }
    .state { max-width: 680px; margin: 12vh auto 0; padding: 2rem; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
    .state h1 { margin-top: 0; }
    .state a, .primary {
      display: inline-block; color: #fff; background: #24292f; padding: .7rem 1rem;
      border-radius: 8px; text-decoration: none; border: 0;
    }
    .error { color: var(--danger); }
    article { max-width: 880px; }
    article h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin-top: 0; }
    article h2 { margin-top: 2rem; border-top: 1px solid var(--line); padding-top: 1.1rem; }
    article p, article li { line-height: 1.7; }
    .article-meta { color: var(--muted); margin-bottom: 1.5rem; }
    .empty { color: var(--muted); padding: 1rem 0; }
    .pill {
      display: inline-block; border: 1px solid var(--line); border-radius: 999px;
      padding: .2rem .55rem; margin: .15rem .25rem .15rem 0; font-size: .82rem;
    }
    .search-view, .graph-view { padding: clamp(1rem, 3vw, 2rem); }
    .search-form, .graph-toolbar {
      display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;
    }
    .search-form input, .graph-toolbar input, .graph-toolbar select {
      min-width: min(420px, 100%); border: 1px solid var(--line); border-radius: 8px;
      padding: .65rem .75rem; background: var(--panel); color: var(--text);
    }
    .graph-toolbar select { min-width: 150px; }
    .graph-wrap {
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
      gap: 1rem; min-height: 70vh;
    }
    .graph-canvas {
      width: 100%; min-height: 620px; border: 1px solid var(--line); border-radius: 12px;
      background: var(--panel); touch-action: none;
    }
    .graph-info {
      border: 1px solid var(--line); border-radius: 12px; background: var(--panel);
      padding: 1rem; overflow: auto;
    }
    .graph-edge { stroke: var(--line); stroke-width: 1.2; opacity: .7; }
    .graph-edge.card-card { stroke-width: 2; }
    .graph-node circle { fill: var(--panel); stroke: var(--accent); stroke-width: 2; }
    .graph-node.concept circle { stroke-dasharray: 4 2; }
    .graph-node text { fill: var(--text); font-size: 12px; pointer-events: none; }
    .graph-node.dim { opacity: .12; }
    .graph-node.focus circle { stroke-width: 4; }
    [hidden] { display: none !important; }
    @media (max-width: 900px) {
      header { align-items: flex-start; flex-wrap: wrap; }
      .brand-row { width: 100%; justify-content: space-between; }
      .graph-wrap { grid-template-columns: 1fr; }
      .graph-canvas { min-height: 480px; }
    }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); max-height: 42vh; }
      .session span { display: none; }
      .nav { overflow-x: auto; max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="shell">
  <header id="header" hidden>
    <div class="brand-row">
      <div class="brand">Knowledge Card</div>
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
    const main = document.getElementById('reader');
    if (!main) return;
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
    setView('cards');
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

  async function renderSearch() {
    setView('search');
    const view = document.createElement('section');
    view.className = 'search-view';
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
    view.className = 'graph-view';
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
