export const graphStyles = [
  {
    order: 22,
    css: String.raw`.graph-wrap {
      position: relative;
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

.graph-inspector-backdrop {
      position: fixed;
      z-index: 39;
      inset: 64px 0 0;
      background: rgba(12, 16, 30, .18);
      backdrop-filter: blur(1px);
    }

.graph-inspector {
      position: fixed;
      z-index: 40;
      top: 84px;
      right: 24px;
      bottom: 24px;
      width: min(380px, calc(100vw - 48px));
      overflow: auto;
      padding: 20px;
      border: 1px solid var(--kc-border);
      border-radius: 20px;
      background: var(--kc-bg);
      box-shadow: -12px 12px 44px rgba(20, 25, 45, .18);
    }

.graph-inspector:focus { outline: none; }

.graph-inspector-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 14px;
    }

.graph-inspector-eyebrow {
      color: var(--kc-subtle);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

.graph-inspector h2 {
      margin: 5px 0 0;
      font-size: 22px;
      line-height: 1.3;
      letter-spacing: -.02em;
    }

.graph-inspector-close {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 50%;
      background: var(--kc-bg-soft);
      color: var(--kc-muted);
      font-size: 22px;
      line-height: 1;
    }

.graph-inspector-summary {
      margin: 14px 0;
      color: var(--kc-muted);
      font-size: 13px;
      line-height: 1.65;
    }

.graph-inspector-taxonomy {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 12px 0 16px;
    }

.graph-inspector-taxonomy span {
      padding: 5px 8px;
      border: 1px solid var(--kc-border);
      border-radius: 999px;
      background: var(--kc-bg-soft);
      color: var(--kc-muted);
      font-size: 10px;
      font-weight: 700;
    }

.graph-inspector-section {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--kc-border);
    }

.graph-inspector-section h3 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: .02em;
    }

.graph-inspector-neighbor {
      width: 100%;
      margin-bottom: 8px;
      padding: 10px;
      border: 1px solid var(--kc-border);
      border-radius: 12px;
      background: var(--kc-bg-soft);
      color: var(--kc-text);
      text-align: left;
    }

.graph-inspector-neighbor strong {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
    }

.graph-inspector-neighbor span {
      color: var(--kc-muted);
      font-size: 10px;
    }

.graph-edge { stroke: var(--kc-divider); stroke-width: 1.2; opacity: .7; }

.graph-edge.card-card { stroke: color-mix(in srgb, var(--kc-brand) 45%, var(--kc-divider)); stroke-width: 1.8; }

.graph-node circle { fill: var(--kc-bg); stroke: var(--kc-brand); stroke-width: 2; }

.graph-node.concept circle { stroke-dasharray: 4 2; }

.graph-node text { fill: var(--kc-text); font-size: 12px; pointer-events: none; }

.graph-node.dim { opacity: .12; }

.graph-node.focus circle { stroke-width: 4; }`
  },
  {
    order: 25,
    css: String.raw`.knowledge-graph-shell {
  --vp-c-text-1: var(--kc-text);
  --vp-c-text-2: var(--kc-muted);
  --vp-c-text-3: var(--kc-subtle);
  --vp-c-bg: var(--kc-bg);
  --vp-c-bg-soft: var(--kc-bg-soft);
  --vp-c-divider: var(--kc-divider);
  --vp-c-brand-1: var(--kc-brand);
  --vp-c-brand-2: var(--kc-brand-2);
  --vp-c-brand-soft: color-mix(in srgb, var(--kc-brand) 12%, transparent);
  --vp-shadow-3: var(--kc-shadow);
  padding-top: 20px;
  padding-bottom: 64px;
}
.graph-hero {
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
  padding: 48px;
  border: 1px solid var(--kc-border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 86% 12%, color-mix(in srgb, var(--kc-brand) 22%, transparent), transparent 34%),
    linear-gradient(145deg, var(--kc-bg-soft), var(--kc-bg));
  box-shadow: 0 18px 70px rgba(34, 39, 62, .06);
}
.graph-kicker {
  color: var(--kc-brand);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .16em;
}
.graph-hero h1 {
  margin: 8px 0 12px;
  padding: 0;
  border: 0;
  font-size: clamp(38px, 6vw, 68px);
  line-height: .98;
  letter-spacing: -.045em;
  word-break: keep-all;
}
.graph-hero > p {
  max-width: 800px;
  margin: 0;
  color: var(--kc-muted);
  font-size: 17px;
  line-height: 1.8;
}
.graph-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 34px;
}
.graph-stat {
  padding: 17px 18px;
  border: 1px solid var(--kc-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--kc-bg) 78%, transparent);
}
.graph-stat strong,
.graph-stat span { display: block; }
.graph-stat strong {
  color: var(--vp-c-text-1);
  font-size: 26px;
  line-height: 1.1;
}
.graph-stat span {
  margin-top: 5px;
  color: var(--kc-muted);
  font-size: 12px;
}

.graph-controls {
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid var(--kc-border);
  border-radius: 22px;
  background: var(--kc-panel);
}
.graph-controls__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}
.graph-controls__head strong {
  display: block;
  font-size: 15px;
}
.graph-controls__head small {
  display: block;
  margin-top: 4px;
  color: var(--kc-muted);
  font-size: 12px;
}
.legacy-graph-toolbar {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 160px auto auto auto auto;
  gap: 12px;
  align-items: end;
}
.legacy-graph-toolbar label,
.graph-search,
.graph-control {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--kc-muted);
  font-size: 12px;
  font-weight: 700;
}
.legacy-graph-toolbar input[type='search'],
.legacy-graph-toolbar select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--kc-border);
  border-radius: 11px;
  padding: 0 12px;
  outline: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.legacy-graph-toolbar input[type='search']:focus,
.legacy-graph-toolbar select:focus {
  border-color: var(--kc-brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--kc-brand) 14%, transparent);
}
.graph-search { min-width: 0; }
.graph-search__input { position: relative; }
.graph-search__input input { width: 100%; padding-right: 38px !important; }
.graph-search__input button {
  position: absolute; right: 7px; top: 50%; width: 28px; height: 28px; transform: translateY(-50%);
  border: 0; border-radius: 8px; background: transparent; color: var(--vp-c-text-2); font-size: 18px; cursor: pointer;
}
.graph-color-select { flex: 0 0 145px; }
.graph-filter-trigger {
  width: 100%; min-height: 42px; align-self: end; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: 1px solid var(--kc-border); border-radius: 11px; padding: 0 14px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
}
.graph-filter-trigger.active { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.graph-filter-trigger strong {
  min-width: 18px; height: 18px; display: grid; place-items: center; border-radius: 999px;
  background: var(--vp-c-brand-1); color: white; font-size: 9px;
}
.graph-toggle {
  display: flex !important; grid-auto-flow: column; align-items: center; justify-content: center; gap: 7px; min-height: 42px;
  border: 1px solid var(--kc-border); border-radius: 11px; padding: 0 14px; background: var(--vp-c-bg);
}
.graph-view-mode {
  display: inline-flex; min-height: 42px; padding: 3px; border: 1px solid var(--kc-border);
  border-radius: 11px; background: var(--vp-c-bg);
}
.graph-view-mode button {
  border: 0; border-radius: 8px; padding: 0 12px; background: transparent; color: var(--vp-c-text-2);
  font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
}
.graph-view-mode button.active { background: var(--vp-c-bg); color: var(--vp-c-brand-1); box-shadow: 0 1px 3px rgba(0, 0, 0, .08); }
.graph-layout-details { position: relative; align-self: end; }
.graph-layout-details summary {
  margin: 0; min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
  border: 1px solid var(--kc-border); border-radius: 11px; padding: 0 14px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 12px; font-weight: 800; list-style: none;
}
.graph-layout-details summary::-webkit-details-marker { display: none; }
.graph-layout-details > div {
  position: absolute; z-index: 20; right: 0; top: calc(100% + 6px); min-width: 260px;
  display: grid; gap: 6px; border: 1px solid var(--kc-border); border-radius: 12px; padding: 12px;
  background: var(--vp-c-bg); box-shadow: var(--vp-shadow-3); font-size: 11px; line-height: 1.5;
}

.graph-filter-chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 16px; }
.graph-filter-chips button {
  border: 1px solid var(--vp-c-brand-1); border-radius: 999px; padding: 5px 8px;
  background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font: inherit; font-size: 9px; font-weight: 800; cursor: pointer;
}
.graph-filter-result-count { margin-left: auto; font-size: 10px; font-weight: 800; opacity: .65; }

.graph-explorer { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; min-width: 0; }
.graph-explorer--filters { grid-template-columns: 250px minmax(640px, 1fr); }
.graph-explorer--inspecting { grid-template-columns: minmax(640px, 1fr) 320px; }
.graph-explorer--filters.graph-explorer--inspecting { grid-template-columns: 250px minmax(640px, 1fr) 320px; }

.graph-canvas-wrap {
  position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--kc-border); border-radius: 20px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 86%, transparent);
}
.knowledge-graph {
  display: block; width: 100%; height: clamp(480px, calc(100vh - 255px), 760px);
  min-height: 480px; user-select: none; touch-action: none; cursor: grab;
}
.knowledge-graph:active { cursor: grabbing; }
.graph-hit-area { fill: transparent; }
.graph-focus-hint {
  position: absolute; z-index: 4; top: 12px; left: 50%; transform: translateX(-50%);
  max-width: calc(100% - 170px); border: 1px solid var(--kc-border); border-radius: 999px;
  padding: 7px 12px; background: color-mix(in srgb, var(--vp-c-bg) 92%, transparent);
  font-size: 11px; font-weight: 700; text-align: center; pointer-events: none;
}
.graph-empty-state {
  position: absolute; z-index: 6; inset: 50% auto auto 50%; transform: translate(-50%, -50%);
  min-width: min(360px, calc(100% - 48px)); display: grid; gap: 8px; justify-items: center;
  border: 1px solid var(--kc-border); border-radius: 16px; padding: 18px;
  background: color-mix(in srgb, var(--vp-c-bg) 94%, transparent); box-shadow: var(--vp-shadow-3);
  text-align: center;
}
.graph-zoom-controls {
  position: absolute; z-index: 5; right: 12px; top: 12px; display: grid; overflow: hidden;
  border: 1px solid var(--kc-border); border-radius: 10px; background: var(--vp-c-bg);
  box-shadow: 0 4px 14px rgba(0, 0, 0, .08);
}
.graph-zoom-controls button {
  min-width: 42px; min-height: 34px; border: 0; border-bottom: 1px solid var(--kc-border);
  background: transparent; color: var(--vp-c-text-1); font: inherit; font-size: 15px; font-weight: 800; cursor: pointer;
}
.graph-zoom-controls button:last-child { border-bottom: 0; }
.graph-zoom-controls button:nth-child(n+3) { font-size: 9px; }

.graph-edge { stroke-width: 1.2; vector-effect: non-scaling-stroke; }
.graph-edge--card-concept { stroke: var(--vp-c-brand-2); opacity: .34; }
.graph-edge--concept-concept { stroke: var(--vp-c-text-2); opacity: .13; stroke-dasharray: 5 7; }
.graph-edge--card-card { opacity: .62; }
.graph-edge--filter-dimmed { opacity: .025 !important; }
.graph-edge--relation-similar-to { stroke: #2563eb; }
.graph-edge--relation-alternative-to { stroke: #d97706; stroke-dasharray: 10 4; }
.graph-edge--relation-complements { stroke: #059669; stroke-dasharray: 6 3; }
.graph-edge--relation-integrates-with { stroke: #7c3aed; }
.graph-edge--relation-depends-on { stroke: #dc2626; stroke-dasharray: 8 4 2 4; }
.graph-edge--relation-extends { stroke: #0891b2; stroke-dasharray: 3 3; }
.graph-edge--relation-contrasts-with { stroke: #be123c; stroke-dasharray: 1 5; stroke-linecap: round; }

.graph-node { transition: opacity .18s ease; }
.graph-node circle { vector-effect: non-scaling-stroke; transition: opacity .18s ease, stroke-width .18s ease; }
.graph-node-hit { fill: transparent; stroke: none; pointer-events: all; }
.graph-node-core { stroke-width: 2; }
.graph-node-interactive { cursor: pointer; }
.graph-node-interactive:hover .graph-node-core,
.graph-node-interactive:focus .graph-node-core { stroke-width: 3.5; }
.graph-node-interactive:focus { outline: none; }
.graph-node-label {
  font-size: 12px; font-weight: 800; fill: var(--vp-c-text-1); pointer-events: none;
  paint-order: stroke; stroke: var(--vp-c-bg); stroke-linejoin: round;
}
.graph-node--concept .graph-node-core { fill: var(--vp-c-brand-1); stroke: var(--vp-c-brand-1); }
.graph-node--card .graph-node-core { fill: var(--vp-c-bg); stroke: var(--node-accent, var(--vp-c-text-2)); }
.graph-node--related-concept .graph-node-core { stroke-width: 3; }
.graph-node-halo { fill: none; vector-effect: non-scaling-stroke; }
.graph-node-halo--selected { stroke: var(--node-accent, var(--vp-c-brand-1)); stroke-width: 4; opacity: .35; }
.graph-node-halo--neighbor { stroke: var(--node-accent, var(--vp-c-brand-1)); stroke-width: 3; opacity: .25; }
.graph-node--neighbor .graph-node-core { stroke: var(--node-accent, var(--vp-c-brand-1)); stroke-width: 3; }
.graph-node--selected { opacity: 1 !important; }
.graph-node--selected .graph-node-core { stroke: var(--node-accent, var(--vp-c-brand-1)); stroke-width: 4; }
.graph-node--filter-dimmed { opacity: .055; }
.graph-node--dimmed { opacity: .1; }
.graph-node--filter-dimmed.graph-node--dimmed { opacity: .035; }

.graph-inspector {
  border: 1px solid var(--kc-border); border-radius: 20px; padding: 18px;
  background: var(--vp-c-bg-soft); position: sticky; top: 82px;
}
.graph-inspector:focus { outline: none; }
.graph-inspector--drawer {
  position: fixed; z-index: 101; right: 0; top: 64px; bottom: 0; width: min(380px, 92vw);
  max-height: none; overflow: auto; border-radius: 20px 0 0 0; background: var(--vp-c-bg);
  box-shadow: -14px 0 44px rgba(0, 0, 0, .18);
}
.graph-inspector__header { display: flex; gap: 12px; align-items: start; justify-content: space-between; }
.graph-inspector__eyebrow { font-size: 10px; font-weight: 800; letter-spacing: .08em; opacity: .55; }
.graph-inspector h2 { margin: 4px 0 0; padding: 0; border: 0; font-size: 20px; line-height: 1.3; }
.graph-inspector__close { border: 0; background: transparent; color: var(--vp-c-text-2); font-size: 24px; line-height: 1; cursor: pointer; }
.graph-inspector__description { margin: 12px 0 8px; font-size: 13px; line-height: 1.65; opacity: .75; }
.graph-inspector__open { display: inline-block; margin-bottom: 12px; font-size: 12px; font-weight: 800; color: var(--vp-c-brand-1); cursor: pointer; border: 0; background: transparent; padding: 0; }
.graph-inspector__taxonomy { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 14px; }
.graph-inspector__taxonomy span {
  border: 1px solid var(--kc-border); border-radius: 999px; padding: 3px 6px;
  background: var(--vp-c-bg); font-size: 8px; font-weight: 800;
}
.graph-distance-guide { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; }
.graph-distance-guide div { border: 1px solid var(--kc-border); border-radius: 10px; padding: 9px; background: var(--vp-c-bg); }
.graph-distance-guide strong, .graph-distance-guide span { display: block; }
.graph-distance-guide strong { font-size: 10px; }
.graph-distance-guide span { margin-top: 3px; font-size: 9px; opacity: .62; }
.graph-neighbors__title { display: flex; justify-content: space-between; align-items: baseline; margin: 15px 0 8px; font-size: 12px; }
.graph-neighbors__title span { opacity: .55; }
.graph-neighbors { display: grid; gap: 8px; list-style: none; padding: 0; margin: 0; }
.graph-neighbors li { border: 1px solid var(--kc-border); border-radius: 12px; padding: 10px; background: var(--vp-c-bg); }
.graph-neighbor__heading { display: flex; gap: 8px; justify-content: space-between; align-items: start; }
.graph-neighbor__heading button {
  border: 0; padding: 0; background: transparent; color: var(--vp-c-text-1);
  font: inherit; font-size: 12px; font-weight: 800; text-align: left; cursor: pointer;
}
.graph-neighbor__bar { height: 4px; overflow: hidden; margin-top: 8px; border-radius: 999px; background: var(--vp-c-divider); }
.graph-neighbor__bar span { display: block; height: 100%; border-radius: inherit; background: var(--vp-c-brand-1); }
.graph-neighbor__metrics { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 7px; font-size: 10px; opacity: .72; }
.graph-relation-chip {
  display: inline-flex; margin-top: 7px; border-radius: 999px; padding: 3px 7px;
  background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font-size: 9px; font-weight: 800;
}
.graph-relation-chip--muted { background: var(--vp-c-bg-soft); color: var(--vp-c-text-3); }
.graph-inspector__note { margin: 14px 0 0; font-size: 10px; line-height: 1.6; opacity: .58; }

.graph-filter-panel {
  min-width: 0; max-height: min(720px, calc(100vh - 160px)); overflow: auto;
  border: 1px solid var(--kc-border); border-radius: 16px; padding: 16px;
  background: var(--vp-c-bg-soft);
}
.graph-filter-panel__header { display: flex; align-items: start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.graph-filter-panel__header strong { display: block; font-size: 13px; }
.graph-filter-panel__header span { display: block; margin-top: 3px; font-size: 9px; opacity: .6; }
.graph-filter-panel__close { border: 0; background: transparent; color: var(--vp-c-text-2); font-size: 20px; cursor: pointer; }
.graph-filter-group { padding: 10px 0; border-top: 1px solid var(--kc-border); }
.graph-filter-group summary { cursor: pointer; font-size: 10px; font-weight: 900; list-style: none; }
.graph-filter-options { display: grid; gap: 7px; margin-top: 9px; }
.graph-filter-options label { display: flex; align-items: start; gap: 7px; font-size: 10px; line-height: 1.4; cursor: pointer; }
.graph-filter-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; max-height: 160px; overflow: auto; }
.graph-filter-tags button {
  border: 1px solid var(--kc-border); border-radius: 999px; padding: 4px 7px;
  background: var(--vp-c-bg); color: var(--vp-c-text-2); font: inherit; font-size: 9px; cursor: pointer;
}
.graph-filter-tags button.active { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.graph-filter-panel__footer {
  position: sticky; bottom: -16px; display: grid; grid-template-columns: 1fr 1.3fr;
  gap: 8px; padding: 12px 0 16px; margin-top: 8px; background: var(--vp-c-bg-soft);
}
.graph-filter-panel__footer button { min-height: 38px; border-radius: 9px; font: inherit; font-size: 10px; font-weight: 900; cursor: pointer; }
.graph-filter-reset { border: 1px solid var(--kc-border); background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.graph-filter-fit { border: 1px solid var(--vp-c-brand-1); background: var(--vp-c-brand-1); color: white; }

.graph-color-legend { margin-top: 12px; border: 1px solid var(--kc-border); border-radius: 14px; padding: 10px 12px; background: var(--vp-c-bg-soft); }
.graph-color-legend > strong { display: block; margin-bottom: 7px; font-size: 10px; }
.graph-color-legend > div { display: flex; flex-wrap: wrap; gap: 7px 13px; }
.graph-color-legend span { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; }
.graph-color-legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.graph-legend, .graph-relation-legend { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 10px; font-size: 11px; opacity: .72; }
.graph-legend span, .graph-relation-legend span { display: inline-flex; align-items: center; gap: 7px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.legend-dot--concept { background: var(--vp-c-brand-1); }
.legend-dot--card { border: 2px solid var(--vp-c-text-2); background: var(--vp-c-bg); }
.legend-dot--neighbor { border: 3px solid var(--vp-c-brand-1); background: var(--vp-c-bg); }
.legend-line { width: 22px; height: 0; border-top: 2px solid; display: inline-block; }

.graph-filter-backdrop,
.graph-inspector-backdrop { position: fixed; z-index: 100; inset: 0; background: rgba(0, 0, 0, .32); }
.graph-inspector-backdrop { z-index: 90; }

@media (max-width: 1120px) {
  .legacy-graph-toolbar { grid-template-columns: minmax(260px, 1fr) 160px 1fr 1.4fr; }
  .graph-toggle,
  .graph-layout-details { grid-column: auto; }
}
@media (max-width: 760px) {
  .knowledge-graph-shell { padding-top: 16px; padding-bottom: 56px; }
  .graph-hero { padding: 26px 22px; border-radius: 22px; }
  .graph-hero > p { font-size: 14px; line-height: 1.65; }
  .graph-stats { grid-template-columns: 1fr 1fr; margin-top: 24px; }
  .graph-controls { padding: 16px; border-radius: 18px; }
  .graph-controls__head { align-items: flex-start; flex-direction: column; }
  .legacy-graph-toolbar { grid-template-columns: 1fr; align-items: stretch; }
  .graph-view-mode button { flex: 1; padding-inline: 8px; }
  .graph-filter-trigger,
  .graph-toggle,
  .graph-layout-details summary { justify-content: center; }
  .knowledge-graph { height: min(62vh, 620px); min-height: 420px; }
  .graph-focus-hint { top: 10px; max-width: calc(100% - 145px); font-size: 10px; }
  .graph-zoom-controls { right: 10px; top: 10px; }
  .graph-inspector--drawer {
    top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-height: 72vh;
    border-radius: 20px 20px 0 0;
  }
  .graph-filter-panel--mobile {
    position: fixed; z-index: 101; left: 0; right: 0; bottom: 0; top: auto;
    max-height: min(78vh, 720px); border-radius: 22px 22px 0 0; padding: 18px;
    box-shadow: 0 -14px 44px rgba(0, 0, 0, .2);
  }
}`
  }
];
