export const radarStyles = [
  {
    order: 3,
    css: String.raw`.radar-reset {
      min-height: 38px;
      padding: 0 14px;
      border: 1px solid var(--kc-border);
      border-radius: 999px;
      background: var(--kc-bg);
      color: var(--kc-muted);
    }

.radar-reset:hover {
      border-color: var(--kc-brand);
      color: var(--kc-brand);
    }`
  },
  {
    order: 5,
    css: String.raw`.loading-view {
      padding-block: clamp(40px, 9vh, 88px) 64px;
    }

.loading-panel {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 28px;
      align-items: center;
      min-height: 260px;
      padding: clamp(28px, 5vw, 48px);
      overflow: hidden;
      border: 1px solid var(--kc-border);
      border-radius: 28px;
      background:
        radial-gradient(circle at 84% 10%, color-mix(in srgb, var(--kc-brand) 20%, transparent), transparent 36%),
        linear-gradient(145deg, var(--kc-bg-soft), var(--kc-bg));
      box-shadow: 0 18px 70px rgba(34, 39, 62, .06);
    }

.loading-radar {
      position: relative;
      width: 76px;
      height: 76px;
      flex: 0 0 auto;
    }

.loading-orbit,
    .loading-orbit::before,
    .loading-orbit::after {
      position: absolute;
      border: 2px solid color-mix(in srgb, var(--kc-brand) 22%, transparent);
      border-radius: 50%;
      content: "";
    }

.loading-orbit {
      inset: 0;
      border-top-color: var(--kc-brand);
      animation: kc-orbit 1.4s linear infinite;
    }

.loading-orbit::before {
      inset: 10px;
      border-right-color: color-mix(in srgb, var(--kc-brand-2) 78%, transparent);
      animation: kc-orbit-reverse 1.8s linear infinite;
    }

.loading-orbit::after {
      inset: 22px;
      border-bottom-color: var(--kc-brand);
      animation: kc-orbit 1.05s linear infinite;
    }

.loading-core {
      position: absolute;
      inset: 31px;
      border-radius: 50%;
      background: var(--kc-brand);
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--kc-brand) 12%, transparent);
      animation: kc-pulse 1.45s ease-in-out infinite;
    }

.loading-kicker {
      color: var(--kc-brand);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .16em;
    }

.loading-copy h1 {
      margin: 8px 0 10px;
      font-size: clamp(30px, 4vw, 46px);
      line-height: 1.05;
      letter-spacing: -.035em;
    }

.loading-copy p {
      max-width: 680px;
      margin: 0;
      color: var(--kc-muted);
      font-size: 15px;
      line-height: 1.7;
    }

.loading-progress {
      display: flex;
      gap: 6px;
      margin-top: 18px;
    }

.loading-progress span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--kc-brand);
      opacity: .28;
      animation: kc-dot 1.1s ease-in-out infinite;
    }

.loading-progress span:nth-child(2) { animation-delay: .14s; }

.loading-progress span:nth-child(3) { animation-delay: .28s; }

.loading-skeleton-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

.loading-skeleton-card {
      min-height: 122px;
      padding: 18px;
      border: 1px solid var(--kc-border);
      border-radius: 18px;
      background: color-mix(in srgb, var(--kc-bg) 92%, transparent);
    }

.loading-line {
      height: 10px;
      margin-top: 10px;
      overflow: hidden;
      border-radius: 999px;
      background:
        linear-gradient(
          100deg,
          color-mix(in srgb, var(--kc-divider) 55%, transparent) 20%,
          color-mix(in srgb, var(--kc-brand) 12%, transparent) 48%,
          color-mix(in srgb, var(--kc-divider) 55%, transparent) 76%
        );
      background-size: 220% 100%;
      animation: kc-shimmer 1.5s ease-in-out infinite;
    }

.loading-line:first-child { width: 42%; margin-top: 0; }

.loading-line:nth-child(2) { width: 82%; height: 14px; margin-top: 16px; }

.loading-line:nth-child(3) { width: 66%; }

.loading-line:nth-child(4) { width: 54%; }

@keyframes kc-orbit { to { transform: rotate(360deg); } }

@keyframes kc-orbit-reverse { to { transform: rotate(-360deg); } }

@keyframes kc-pulse {
      0%, 100% { transform: scale(.78); opacity: .62; }
      50% { transform: scale(1); opacity: 1; }
    }

@keyframes kc-dot {
      0%, 70%, 100% { transform: translateY(0); opacity: .28; }
      35% { transform: translateY(-5px); opacity: 1; }
    }

@keyframes kc-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
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
      grid-template-columns: minmax(260px, 1fr) 170px 140px 160px 130px 150px;
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
    }`
  },
  {
    order: 7,
    css: String.raw`.radar-control-group { margin-top: 18px; }

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

.knowledge-score {
      color: var(--kc-brand);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .02em;
      white-space: nowrap;
    }

.knowledge-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 14px;
    }

.knowledge-actions b {
      padding: 5px 9px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--kc-brand) 11%, var(--kc-bg));
      color: var(--kc-brand);
      font-size: 11px;
      font-weight: 800;
    }

.knowledge-tags-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

.knowledge-tags-buttons button {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--kc-subtle);
      font-size: 11px;
      cursor: pointer;
    }

.knowledge-tags-buttons button:hover {
      color: var(--kc-brand);
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
    }`
  },
  {
    order: 9,
    css: String.raw`.knowledge-tile footer {
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
      grid-column: 1 / -1;
      padding: 50px 24px;
      border: 1px dashed var(--kc-border);
      border-radius: 20px;
      color: var(--kc-muted);
      text-align: center;
    }`
  }
];
