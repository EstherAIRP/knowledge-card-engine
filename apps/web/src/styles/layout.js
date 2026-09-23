export const layoutStyles = [
  {
    order: 2,
    css: String.raw`.shell { min-height: 100vh; }

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

.brand-row, .nav {
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
    }`
  },
  {
    order: 4,
    css: String.raw`.page-shell {
      width: min(calc(100% - 2 * var(--kc-page-gutter)), var(--kc-page-max));
      margin-inline: auto;
    }`
  },
  {
    order: 10,
    css: String.raw`.detail-view,
    .search-view,
    .graph-view {
      padding-block: 30px 64px;
    }`
  },
  {
    order: 12,
    css: String.raw`.knowledge-detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }

.knowledge-detail-main { min-width: 0; }

.knowledge-outline { display: none; }`
  },
  {
    order: 14,
    css: String.raw`.knowledge-outline nav {
      display: grid;
      gap: 2px;
    }

.knowledge-outline a {
      display: block;
      padding: 5px 8px;
      border-left: 2px solid transparent;
      color: var(--kc-subtle);
      font-size: 12px;
      line-height: 1.45;
      text-decoration: none;
      transition: color .16s ease, border-color .16s ease, background .16s ease;
    }

.knowledge-outline a:hover,
    .knowledge-outline a.active {
      border-left-color: var(--kc-brand);
      background: color-mix(in srgb, var(--kc-brand) 7%, transparent);
      color: var(--kc-brand);
    }

.knowledge-outline .knowledge-outline-h3 {
      padding-left: 20px;
      font-size: 11px;
    }

@media (min-width: 1120px) {
      .knowledge-detail-layout {
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: clamp(28px, 4vw, 52px);
      }
      .knowledge-outline {
        position: sticky;
        top: 84px;
        display: block;
        max-height: calc(100vh - 108px);
        overflow-y: auto;
        padding: 4px 0 18px 18px;
        border-left: 1px solid var(--kc-border);
      }
    }`
  },
  {
    order: 16,
    css: String.raw`@media (max-width: 640px) {
      .knowledge-relations-grid { grid-template-columns: 1fr; }
      .knowledge-concepts-head,
      .knowledge-relations-head {
        align-items: start;
        flex-direction: column;
      }
    }`
  },
  {
    order: 23,
    css: String.raw`@media (max-width: 1080px) {
      .radar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .radar-search-row { grid-template-columns: 1fr 1fr; }
      .relevance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

@media (max-width: 900px) {
      header { align-items: flex-start; flex-wrap: wrap; padding-block: 10px; }
      .brand-row { width: 100%; justify-content: space-between; }
      .graph-canvas { min-height: 480px; }
      .graph-inspector-backdrop { inset: 64px 0 0; }
      .graph-inspector {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: 100%;
        max-height: 72vh;
        border-radius: 20px 20px 0 0;
      }
      .radar-hero { padding: 34px; }
      .radar-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

@media (max-width: 680px) {
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
      .loading-panel { grid-template-columns: 1fr; gap: 20px; }
      .loading-radar { width: 64px; height: 64px; }
      .loading-core { inset: 26px; }
      .loading-skeleton-grid { grid-template-columns: 1fr; }
      .loading-skeleton-card:nth-child(n+2) { display: none; }
      .knowledge-tile { min-height: 0; }
      .relevance-grid { grid-template-columns: 1fr; }
      .knowledge-detail-top,
      .knowledge-detail-footer { flex-direction: column; }
    }`
  }
];
