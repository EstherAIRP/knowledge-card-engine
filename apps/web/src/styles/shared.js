export const sharedStyles = [
  {
    order: 6,
    css: String.raw`.radar-controls input[type="search"],
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
    }`
  },
  {
    order: 8,
    css: String.raw`.knowledge-categories span,
    .pill {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 8px;
      background: var(--kc-bg-soft);
      color: var(--kc-muted);
      font-size: 11px;
    }`
  },
  {
    order: 17,
    css: String.raw`.state {
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

.meta { margin-top: .55rem; color: var(--kc-muted); font-size: .8rem; }`
  },
  {
    order: 19,
    css: String.raw`.summary { color: var(--kc-muted); font-size: .92rem; line-height: 1.45; }`
  },
  {
    order: 21,
    css: String.raw`.search-form,
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

.graph-toolbar select { width: auto; min-width: 160px; }`
  }
];
