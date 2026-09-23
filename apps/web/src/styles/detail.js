export const detailStyles = [
  {
    order: 11,
    css: String.raw`.detail-back {
      margin-bottom: 16px;
      border: 0;
      background: transparent;
      color: var(--kc-brand);
      padding: 0;
      font-weight: 700;
    }

.knowledge-detail-head {
      margin: 12px 0 34px;
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
    .knowledge-detail-footer {
      color: var(--kc-subtle);
      font-size: 12px;
    }

.knowledge-detail-actions,
    .knowledge-detail-categories,
    .knowledge-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }

.knowledge-detail-actions span {
      padding: 5px 9px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--kc-brand) 11%, var(--kc-bg));
      color: var(--kc-brand);
      font-size: 11px;
      font-weight: 800;
    }

.knowledge-detail-categories span {
      padding: 5px 9px;
      border-radius: 8px;
      background: var(--kc-bg-soft);
      color: var(--kc-muted);
      font-size: 11px;
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

.knowledge-detail-footer a,
    .knowledge-concepts-graph {
      color: var(--kc-brand);
      text-decoration: none;
    }

.knowledge-reading {
      width: 100%;
      margin-inline: 0;
    }

.knowledge-reading > p,
    .knowledge-reading > ul,
    .knowledge-reading > ol,
    .knowledge-reading > blockquote,
    .knowledge-reading > .knowledge-code-block,
    .knowledge-reading > table {
      max-width: var(--kc-reading-max);
    }

.knowledge-reading h1 {
      margin: 8px 0 22px;
      font-size: clamp(30px, 5vw, 48px);
      line-height: 1.08;
      letter-spacing: -.035em;
    }

.knowledge-reading h2 {
      margin-top: 2.2rem;
      padding-top: 1.1rem;
      border-top: 1px solid var(--kc-border);
      font-size: 22px;
      letter-spacing: -.01em;
    }

.knowledge-reading h3 { margin-top: 1.6rem; }

.knowledge-reading p,
    .knowledge-reading li { line-height: 1.78; }

.knowledge-reading p { color: var(--kc-text); }

.knowledge-reading li + li { margin-top: 6px; }

.knowledge-reading h2,
    .knowledge-reading h3,
    .knowledge-concepts-head h2,
    .knowledge-relations-head h2 { scroll-margin-top: 88px; }

.knowledge-reading a {
      color: var(--kc-brand);
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--kc-brand) 45%, transparent);
      text-underline-offset: 3px;
    }

.knowledge-reading code {
      padding: 2px 5px;
      border-radius: 6px;
      background: var(--kc-bg-soft);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .9em;
    }

.knowledge-code-block {
      position: relative;
      margin: 18px 0;
    }

.knowledge-reading pre {
      overflow-x: auto;
      margin: 0;
      padding: 42px 18px 16px;
      border: 1px solid var(--kc-border);
      border-radius: 14px;
      background: var(--kc-bg-soft);
      line-height: 1.65;
    }

.knowledge-code-copy {
      position: absolute;
      z-index: 1;
      top: 9px;
      right: 9px;
      min-height: 26px;
      padding: 0 9px;
      border: 1px solid var(--kc-border);
      border-radius: 7px;
      background: var(--kc-bg);
      color: var(--kc-muted);
      font-size: 10px;
      font-weight: 700;
    }

.knowledge-code-copy:hover {
      border-color: var(--kc-brand);
      color: var(--kc-brand);
    }

.knowledge-reading pre code {
      padding: 0;
      background: transparent;
      font-size: 13px;
    }

.knowledge-reading blockquote {
      margin: 18px 0;
      padding: 2px 0 2px 16px;
      border-left: 3px solid var(--kc-brand);
      color: var(--kc-muted);
    }

.knowledge-reading blockquote p { color: inherit; }

.knowledge-reading hr {
      margin: 32px 0;
      border: 0;
      border-top: 1px solid var(--kc-border);
    }

.knowledge-reading table {
      width: 100%;
      margin: 18px 0;
      border-collapse: collapse;
      font-size: 13px;
    }

.knowledge-reading th,
    .knowledge-reading td {
      padding: 9px 11px;
      border: 1px solid var(--kc-border);
      text-align: left;
      vertical-align: top;
    }

.knowledge-reading th { background: var(--kc-bg-soft); }`
  },
  {
    order: 13,
    css: String.raw`.detail-outline-header-toggle {
      display: none;
      min-height: 38px;
      align-items: center;
      gap: 7px;
      padding: 7px 0;
      border: 0;
      background: transparent;
      color: var(--kc-text);
      font-size: 14px;
      font-weight: 750;
      text-align: left;
      white-space: nowrap;
    }

.detail-outline-header-toggle:hover { color: var(--kc-brand); }

.detail-outline-header-chevron {
      color: var(--kc-subtle);
      font-size: 15px;
      line-height: 1;
      transition: transform .16s ease, color .16s ease;
    }

.detail-outline-header-toggle[aria-expanded="true"] .detail-outline-header-chevron {
      transform: rotate(180deg);
      color: var(--kc-brand);
    }

.knowledge-outline-label {
      margin-bottom: 10px;
      color: var(--kc-text);
      font-size: 12px;
      font-weight: 800;
    }`
  },
  {
    order: 15,
    css: String.raw`.knowledge-concepts {
      margin-top: 46px;
      padding-top: 24px;
      border-top: 1px solid var(--kc-border);
    }

.knowledge-concepts-head,
    .knowledge-relations-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 14px;
    }

.knowledge-concepts-head span,
    .knowledge-relations-head span {
      color: var(--kc-brand);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .12em;
    }

.knowledge-concepts-head h2,
    .knowledge-relations-head h2 {
      margin: 4px 0 0;
      padding: 0;
      border: 0;
      font-size: 22px;
    }

.knowledge-concepts-graph {
      padding: 0;
      border: 0;
      background: transparent;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

.knowledge-concept-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
    }

.knowledge-concept {
      display: block;
      width: 100%;
      padding: 14px;
      color: var(--kc-text);
      text-align: left;
      cursor: pointer;
      border: 1px solid var(--kc-border);
      border-radius: 13px;
      background: var(--kc-panel);
      transition: transform .18s ease, border-color .18s ease;
    }

.knowledge-concept:hover {
      transform: translateY(-2px);
      border-color: var(--kc-brand);
    }

.knowledge-concept-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }

.knowledge-concept-top span {
      color: var(--kc-subtle);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

.knowledge-concept h3 {
      margin: 2px 0 0;
      font-size: 16px;
    }

.knowledge-concept-top strong {
      color: var(--kc-brand);
      font-size: 11px;
    }

.knowledge-concept p {
      margin: 8px 0;
      color: var(--kc-muted);
      font-size: 12px;
      line-height: 1.6;
    }

.knowledge-concept-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: var(--kc-subtle);
      font-size: 10px;
    }

.knowledge-relations {
      margin: 42px 0 10px;
      padding-top: 28px;
      border-top: 1px solid var(--kc-border);
    }

.knowledge-relations-head small {
      color: var(--kc-subtle);
    }

.knowledge-relations-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

.knowledge-relation-card {
      display: block;
      width: 100%;
      padding: 18px;
      border: 1px solid var(--kc-border);
      border-radius: 16px;
      background: var(--kc-panel);
      color: var(--kc-text);
      text-align: left;
      transition: transform .18s ease, border-color .18s ease;
    }

.knowledge-relation-card:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--kc-brand) 55%, var(--kc-border));
    }

.knowledge-relation-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--kc-subtle);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

.knowledge-relation-top strong { color: var(--kc-brand); }

.knowledge-relation-card h3 {
      margin: 10px 0 7px;
      font-size: 17px;
    }

.knowledge-relation-summary,
    .knowledge-relation-note {
      margin: 0;
      font-size: 12px;
      line-height: 1.65;
    }

.knowledge-relation-summary { color: var(--kc-muted); }

.knowledge-relation-note {
      margin-top: 9px;
      padding-top: 9px;
      border-top: 1px dashed var(--kc-border);
      color: var(--kc-text);
    }

.knowledge-relation-scores,
    .knowledge-relation-signals {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 11px;
    }

.knowledge-relation-scores span,
    .knowledge-relation-signals span {
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 9px;
    }

.knowledge-relation-scores span {
      background: color-mix(in srgb, var(--kc-brand) 10%, var(--kc-bg));
      color: var(--kc-brand);
    }

.knowledge-relation-signals span {
      background: var(--kc-bg);
      color: var(--kc-subtle);
    }

.knowledge-relation-classifier {
      display: block;
      margin-top: 10px;
      color: var(--kc-subtle);
      font-size: 9px;
    }`
  }
];
