import { legacyGraphCss, legacyGraphScript } from './legacy-graph.js';

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
    }
    .radar-reset {
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
    }

    .page-shell {
      width: min(calc(100% - 2 * var(--kc-page-gutter)), var(--kc-page-max));
      margin-inline: auto;
    }

    .loading-view {
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
      grid-column: 1 / -1;
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
      width: min(100%, var(--kc-reading-max));
      margin-inline: auto;
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
    .knowledge-reading h3 { scroll-margin-top: 88px; }
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
    .knowledge-reading pre {
      overflow-x: auto;
      margin: 18px 0;
      padding: 16px 18px;
      border: 1px solid var(--kc-border);
      border-radius: 14px;
      background: var(--kc-bg-soft);
      line-height: 1.65;
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
    .knowledge-reading th { background: var(--kc-bg-soft); }

    .knowledge-detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }
    .knowledge-detail-main { min-width: 0; }
    .knowledge-outline { display: none; }
    .knowledge-outline-label {
      margin-bottom: 10px;
      color: var(--kc-text);
      font-size: 12px;
      font-weight: 800;
    }
    .knowledge-outline nav {
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
    }

    .knowledge-concepts {
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
    }

    @media (max-width: 640px) {
      .knowledge-relations-grid { grid-template-columns: 1fr; }
      .knowledge-concepts-head,
      .knowledge-relations-head {
        align-items: start;
        flex-direction: column;
      }
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
    .graph-node.focus circle { stroke-width: 4; }

    @media (max-width: 1080px) {
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
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-orbit,
      .loading-orbit::before,
      .loading-orbit::after,
      .loading-core,
      .loading-progress span,
      .loading-line {
        animation: none !important;
      }
    }
    ${legacyGraphCss}
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
  </header>
  <div id="app">
    <main class="loading-view page-shell" role="status" aria-live="polite" aria-busy="true">
      <section class="loading-panel">
        <div class="loading-radar" aria-hidden="true">
          <div class="loading-orbit"></div>
          <div class="loading-core"></div>
        </div>
        <div class="loading-copy">
          <div class="loading-kicker">KNOWLEDGE RADAR</div>
          <h1>正在載入知識庫</h1>
          <p>驗證私人 Workspace，並準備目前 release 的 Knowledge Cards、搜尋與圖譜。</p>
          <div class="loading-progress" aria-hidden="true"><span></span><span></span><span></span></div>
        </div>
      </section>
      <div class="loading-skeleton-grid" aria-hidden="true">
        <div class="loading-skeleton-card"><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div></div>
        <div class="loading-skeleton-card"><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div></div>
        <div class="loading-skeleton-card"><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div></div>
      </div>
    </main>
  </div>
</div>
<script>
(() => {
  ${legacyGraphScript}
  const app = document.getElementById('app');
  const header = document.getElementById('header');
  const nav = {
    cards: document.getElementById('nav-cards'),
    search: document.getElementById('nav-search'),
    graph: document.getElementById('nav-graph')
  };

  function cleanupDetailOutline() {
    if (typeof app.__kcDetailOutlineCleanup === 'function') app.__kcDetailOutlineCleanup();
    app.__kcDetailOutlineCleanup = null;
  }

  function clearPrivateState() {
    cleanupDetailOutline();
    app.replaceChildren();
    header.hidden = true;
  }

  function setView(name) {
    if (name !== 'graph' && typeof app.__kcGraphCleanup === 'function') app.__kcGraphCleanup();
    for (const [key, button] of Object.entries(nav)) {
      if (key === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  function createLoadingView(title = '正在載入 Knowledge Radar', detail = '準備目前的私人知識內容…') {
    const view = document.createElement('main');
    view.className = 'loading-view page-shell';
    view.setAttribute('role', 'status');
    view.setAttribute('aria-live', 'polite');
    view.setAttribute('aria-busy', 'true');

    const panel = document.createElement('section');
    panel.className = 'loading-panel';

    const radar = document.createElement('div');
    radar.className = 'loading-radar';
    radar.setAttribute('aria-hidden', 'true');
    const orbit = document.createElement('div');
    orbit.className = 'loading-orbit';
    const core = document.createElement('div');
    core.className = 'loading-core';
    radar.append(orbit, core);

    const copy = document.createElement('div');
    copy.className = 'loading-copy';
    const kicker = document.createElement('div');
    kicker.className = 'loading-kicker';
    kicker.textContent = 'KNOWLEDGE RADAR';
    const h1 = document.createElement('h1');
    h1.textContent = title;
    const p = document.createElement('p');
    p.textContent = detail;
    const progress = document.createElement('div');
    progress.className = 'loading-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    copy.append(kicker, h1, p, progress);
    panel.append(radar, copy);

    const skeleton = document.createElement('div');
    skeleton.className = 'loading-skeleton-grid';
    skeleton.setAttribute('aria-hidden', 'true');
    for (let cardIndex = 0; cardIndex < 3; cardIndex += 1) {
      const card = document.createElement('div');
      card.className = 'loading-skeleton-card';
      for (let lineIndex = 0; lineIndex < 4; lineIndex += 1) {
        const line = document.createElement('div');
        line.className = 'loading-line';
        card.append(line);
      }
      skeleton.append(card);
    }

    view.append(panel, skeleton);
    return view;
  }

  function renderLoading(title, detail) {
    if (typeof app.__kcGraphCleanup === 'function') app.__kcGraphCleanup();
    cleanupDetailOutline();
    app.replaceChildren(createLoadingView(title, detail));
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

  function plainMarkdownText(value) {
    return String(value || '')
      .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
      .replace(/\*\*([^*]+)\*\*/gu, '$1')
      .replace(/\*([^*]+)\*/gu, '$1')
      .replace(/\x60([^\x60]+)\x60/gu, '$1')
      .trim();
  }

  function appendInlineMarkdown(container, value) {
    const text = String(value || '');
    const tokenPattern = /(\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)]+\)|\*[^*\n]+\*)/gu;
    let cursor = 0;
    for (const match of text.matchAll(tokenPattern)) {
      if (match.index > cursor) container.append(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      if (token.startsWith('\x60')) {
        const code = document.createElement('code');
        code.textContent = token.slice(1, -1);
        container.append(code);
      } else if (token.startsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = token.slice(2, -2);
        container.append(strong);
      } else if (token.startsWith('*')) {
        const em = document.createElement('em');
        em.textContent = token.slice(1, -1);
        container.append(em);
      } else {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token);
        const label = link?.[1] || token;
        const href = link?.[2]?.trim() || '';
        const cardLink = /^(?:\.\/)?([^/#?]+)\.md(?:#[^?]*)?$/u.exec(href);
        if (cardLink) {
          const anchor = document.createElement('a');
          anchor.href = '#';
          anchor.textContent = label;
          anchor.addEventListener('click', (event) => {
            event.preventDefault();
            openCard(cardLink[1]);
          });
          container.append(anchor);
        } else if (/^https?:\/\//iu.test(href)) {
          const anchor = document.createElement('a');
          anchor.href = href;
          anchor.target = '_blank';
          anchor.rel = 'noreferrer';
          anchor.textContent = label;
          container.append(anchor);
        } else {
          container.append(document.createTextNode(label));
        }
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
  }

  function markdownTableCells(line) {
    let value = String(line || '').trim();
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    return value.split('|').map((cell) => cell.trim());
  }

  function isMarkdownTableSeparator(line, width) {
    const cells = markdownTableCells(line);
    return cells.length === width && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
  }

  function markdownHeadingSlug(value, used) {
    let base = plainMarkdownText(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/gu, '-')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
      .replace(/-{2,}/gu, '-')
      .replace(/^-|-$/gu, '');
    if (!base) base = 'section';
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) {
      slug = base + '-' + suffix;
      suffix += 1;
    }
    used.add(slug);
    return slug;
  }

  function markdownBlockStarts(lines, index) {
    const line = String(lines[index] || '');
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^(#{1,3})\s+/u.test(trimmed)) return true;
    if (/^(\x60{3,})([A-Za-z0-9_+-]*)\s*$/u.test(trimmed)) return true;
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line)) return true;
    if (/^\s*>\s?/u.test(line)) return true;
    if (/^\s*(?:[-*+]|\d+\.)\s+/u.test(line)) return true;
    if (trimmed.includes('|') && index + 1 < lines.length) {
      const cells = markdownTableCells(trimmed);
      if (cells.length >= 2 && isMarkdownTableSeparator(lines[index + 1], cells.length)) return true;
    }
    return false;
  }

  function appendMarkdown(container, markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const usedHeadingIds = new Set();
    let index = 0;

    while (index < lines.length) {
      const raw = lines[index];
      const trimmed = raw.trim();
      if (!trimmed) {
        index += 1;
        continue;
      }

      const fence = /^(\x60{3,})([A-Za-z0-9_+-]*)\s*$/u.exec(trimmed);
      if (fence) {
        const fenceToken = fence[1];
        const language = fence[2];
        const codeLines = [];
        index += 1;
        while (index < lines.length && lines[index].trim() !== fenceToken) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (language) code.className = 'language-' + language;
        code.textContent = codeLines.join('\n');
        pre.append(code);
        container.append(pre);
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/u.exec(trimmed);
      if (heading) {
        const level = Math.min(3, heading[1].length);
        const el = document.createElement('h' + level);
        el.id = markdownHeadingSlug(heading[2], usedHeadingIds);
        appendInlineMarkdown(el, heading[2]);
        container.append(el);
        index += 1;
        continue;
      }

      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(raw)) {
        container.append(document.createElement('hr'));
        index += 1;
        continue;
      }

      if (/^\s*>\s?/u.test(raw)) {
        const quote = document.createElement('blockquote');
        const quoteLines = [];
        while (index < lines.length) {
          const match = /^\s*>\s?(.*)$/u.exec(lines[index]);
          if (!match) break;
          quoteLines.push(match[1]);
          index += 1;
        }
        const p = document.createElement('p');
        appendInlineMarkdown(p, quoteLines.join(' '));
        quote.append(p);
        container.append(quote);
        continue;
      }

      const listItem = /^\s*([-*+]|\d+\.)\s+(.+)$/u.exec(raw);
      if (listItem) {
        const ordered = /^\d+\.$/u.test(listItem[1]);
        const list = document.createElement(ordered ? 'ol' : 'ul');
        while (index < lines.length) {
          const item = /^\s*([-*+]|\d+\.)\s+(.+)$/u.exec(lines[index]);
          if (!item || /^\d+\.$/u.test(item[1]) !== ordered) break;
          const li = document.createElement('li');
          appendInlineMarkdown(li, item[2]);
          list.append(li);
          index += 1;
        }
        container.append(list);
        continue;
      }

      const headerCells = trimmed.includes('|') ? markdownTableCells(trimmed) : [];
      if (headerCells.length >= 2 && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1], headerCells.length)) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const cell of headerCells) {
          const th = document.createElement('th');
          appendInlineMarkdown(th, cell);
          headRow.append(th);
        }
        thead.append(headRow);
        table.append(thead);
        index += 2;

        const tbody = document.createElement('tbody');
        while (index < lines.length && lines[index].trim().includes('|')) {
          const cells = markdownTableCells(lines[index]);
          if (cells.length !== headerCells.length) break;
          const row = document.createElement('tr');
          for (const cell of cells) {
            const td = document.createElement('td');
            appendInlineMarkdown(td, cell);
            row.append(td);
          }
          tbody.append(row);
          index += 1;
        }
        if (tbody.childElementCount) table.append(tbody);
        container.append(table);
        continue;
      }

      const paragraphLines = [trimmed];
      index += 1;
      while (index < lines.length && lines[index].trim() && !markdownBlockStarts(lines, index)) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const p = document.createElement('p');
      appendInlineMarkdown(p, paragraphLines.join(' '));
      container.append(p);
    }
  }

  function createDetailOutline(article) {
    const headings = [...article.querySelectorAll('h2, h3')].filter((heading) => heading.id);
    if (!headings.length) return null;

    const aside = document.createElement('aside');
    aside.className = 'knowledge-outline';
    const label = document.createElement('div');
    label.className = 'knowledge-outline-label';
    label.textContent = '文章目錄';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '文章目錄');
    const links = new Map();

    for (const heading of headings) {
      const anchor = document.createElement('a');
      anchor.href = '#' + encodeURIComponent(heading.id);
      anchor.textContent = heading.textContent;
      anchor.className = heading.tagName === 'H3' ? 'knowledge-outline-h3' : 'knowledge-outline-h2';
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', location.pathname + location.search + '#' + encodeURIComponent(heading.id));
      });
      links.set(heading.id, anchor);
      nav.append(anchor);
    }

    let queued = false;
    const updateActive = () => {
      queued = false;
      let active = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 120) active = heading;
        else break;
      }
      for (const [id, anchor] of links) anchor.classList.toggle('active', id === active.id);
    };
    const queueUpdate = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(updateActive);
    };

    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);
    app.__kcDetailOutlineCleanup = () => {
      window.removeEventListener('scroll', queueUpdate);
      window.removeEventListener('resize', queueUpdate);
    };

    aside.append(label, nav);
    requestAnimationFrame(updateActive);
    return aside;
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
    cleanupDetailOutline();
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
    const meta = document.createElement('div');
    const source = document.createElement('div');
    source.className = 'knowledge-detail-source';
    const sourceLabels = { github: 'GitHub', threads: 'Threads' };
    const resourceLabels = {
      project: '專案',
      skill: 'Skill',
      tutorial: '教學',
      guide: '指南',
      article: '文章',
      reference: '參考資料',
      paper: '論文',
      tool: '工具'
    };
    source.textContent = [
      sourceLabels[detail.source?.type] || detail.source?.type,
      resourceLabels[detail.resource_kind] || detail.resource_kind,
      detail.status
    ].filter(Boolean).join(' · ');
    meta.append(source);

    const categories = document.createElement('div');
    categories.className = 'knowledge-detail-categories';
    for (const category of detail.navigation_categories || []) {
      const badge = document.createElement('span');
      badge.textContent = category;
      categories.append(badge);
    }
    if (categories.childElementCount) meta.append(categories);

    const actions = document.createElement('div');
    actions.className = 'knowledge-detail-actions';
    for (const action of detail.actions || []) {
      const badge = document.createElement('span');
      badge.textContent = action;
      actions.append(badge);
    }
    top.append(meta, actions);
    head.append(top);

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
    if (tags.childElementCount) head.append(tags);

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
    article.className = 'knowledge-reading';
    appendMarkdown(article, detail.body);

    const concepts = Array.isArray(detail.concepts) ? detail.concepts : [];
    let conceptSection = null;
    if (concepts.length) {
      conceptSection = document.createElement('section');
      conceptSection.className = 'knowledge-concepts';

      const conceptHead = document.createElement('div');
      conceptHead.className = 'knowledge-concepts-head';
      const conceptTitleBlock = document.createElement('div');
      const conceptKicker = document.createElement('span');
      conceptKicker.textContent = 'PHASE 3 · CONCEPTS';
      const conceptTitle = document.createElement('h2');
      conceptTitle.textContent = 'Concept Neighborhood';
      conceptTitleBlock.append(conceptKicker, conceptTitle);
      const graphLink = document.createElement('button');
      graphLink.type = 'button';
      graphLink.className = 'knowledge-concepts-graph';
      graphLink.textContent = 'Knowledge Graph →';
      graphLink.addEventListener('click', () => renderGraph().catch((error) => {
        if (error.message !== 'AUTH_STOP') stateView('圖譜讀取失敗', error.message, false, 'error');
      }));
      conceptHead.append(conceptTitleBlock, graphLink);

      const grid = document.createElement('div');
      grid.className = 'knowledge-concept-grid';
      for (const concept of concepts) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'knowledge-concept';
        card.addEventListener('click', () => renderGraph({ query: concept.label || concept.id }).catch((error) => {
          if (error.message !== 'AUTH_STOP') stateView('圖譜讀取失敗', error.message, false, 'error');
        }));
        const cardTop = document.createElement('div');
        cardTop.className = 'knowledge-concept-top';
        const labelBlock = document.createElement('div');
        const type = document.createElement('span');
        type.textContent = concept.type || 'concept';
        const label = document.createElement('h3');
        label.textContent = concept.label || concept.id;
        labelBlock.append(type, label);
        const strength = document.createElement('strong');
        const strengthValue = Number(concept.strength);
        strength.textContent = Number.isFinite(strengthValue) ? Math.round(strengthValue * 100) + '%' : '';
        cardTop.append(labelBlock, strength);

        const description = document.createElement('p');
        description.textContent = concept.description || '';
        const conceptMeta = document.createElement('div');
        conceptMeta.className = 'knowledge-concept-meta';
        const cardCount = document.createElement('span');
        cardCount.textContent = Number.isFinite(Number(concept.card_count)) ? concept.card_count + ' Cards' : '';
        const origin = document.createElement('span');
        origin.textContent = concept.origin || '';
        conceptMeta.append(cardCount, origin);
        card.append(cardTop, description, conceptMeta);
        grid.append(card);
      }

      conceptSection.append(conceptHead, grid);
    }

    const relations = Array.isArray(detail.relations) ? detail.relations : [];
    let relationSection = null;
    if (relations.length) {
      relationSection = document.createElement('section');
      relationSection.className = 'knowledge-relations';

      const relationHead = document.createElement('div');
      relationHead.className = 'knowledge-relations-head';
      const relationTitleBlock = document.createElement('div');
      const relationKicker = document.createElement('span');
      relationKicker.textContent = 'SEMANTIC RELATION INDEX';
      const relationTitle = document.createElement('h2');
      relationTitle.textContent = 'Related Knowledge';
      relationTitleBlock.append(relationKicker, relationTitle);
      const count = document.createElement('small');
      count.textContent = relations.length + ' relations';
      relationHead.append(relationTitleBlock, count);

      const grid = document.createElement('div');
      grid.className = 'knowledge-relations-grid';
      const typeLabel = (relation) => {
        const labels = {
          similar_to: 'Similar',
          alternative_to: 'Alternative',
          complements: 'Complements',
          integrates_with: 'Integrates with',
          contrasts_with: 'Contrasts with'
        };
        const pointsOut = relation.direction === 'source_to_target'
          ? relation.source === detail.id
          : relation.direction === 'target_to_source'
            ? relation.target === detail.id
            : true;
        if (relation.type === 'depends_on') return pointsOut ? 'Depends on' : 'Depended on by';
        if (relation.type === 'extends') return pointsOut ? 'Extends' : 'Extended by';
        return labels[relation.type] || 'Related';
      };

      for (const relation of relations) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'knowledge-relation-card';
        card.addEventListener('click', () => openCard(relation.other_id));

        const cardTop = document.createElement('div');
        cardTop.className = 'knowledge-relation-top';
        const type = document.createElement('span');
        type.textContent = typeLabel(relation);
        const score = document.createElement('strong');
        const scoreValue = Number(relation.score);
        score.textContent = Number.isFinite(scoreValue) ? Math.round(scoreValue * 100) + '%' : '';
        cardTop.append(type, score);

        const title = document.createElement('h3');
        title.textContent = relation.other_title;
        const summary = document.createElement('p');
        summary.className = 'knowledge-relation-summary';
        summary.textContent = relation.other_summary || '';
        card.append(cardTop, title, summary);

        if (relation.note) {
          const note = document.createElement('p');
          note.className = 'knowledge-relation-note';
          note.textContent = relation.note;
          card.append(note);
        }

        const evidence = relation.evidence || {};
        const scoreParts = [
          ['Taxonomy', Number(evidence.taxonomy)],
          ['Semantic', Number(evidence.vector_similarity)]
        ].filter(([, value]) => Number.isFinite(value));
        if (scoreParts.length) {
          const scores = document.createElement('div');
          scores.className = 'knowledge-relation-scores';
          for (const [label, value] of scoreParts) {
            const chip = document.createElement('span');
            chip.textContent = label + ' ' + Math.round(value * 100) + '%';
            scores.append(chip);
          }
          card.append(scores);
        }

        const signals = [
          ...(Array.isArray(evidence.shared_categories) ? evidence.shared_categories : []),
          ...(Array.isArray(evidence.shared_tags) ? evidence.shared_tags : [])
        ].slice(0, 4);
        if (signals.length) {
          const signalRow = document.createElement('div');
          signalRow.className = 'knowledge-relation-signals';
          for (const signal of signals) {
            const chip = document.createElement('span');
            chip.textContent = signal;
            signalRow.append(chip);
          }
          card.append(signalRow);
        }

        const classifier = document.createElement('small');
        classifier.className = 'knowledge-relation-classifier';
        classifier.textContent = relation.manual || String(relation.method || '').startsWith('manual_')
          ? 'Human override'
          : 'Automatic relation';
        classifier.title = [relation.method, relation.direction].filter(Boolean).join(' · ');
        card.append(classifier);
        grid.append(card);
      }

      relationSection.append(relationHead, grid);
    }

    const mainColumn = document.createElement('div');
    mainColumn.className = 'knowledge-detail-main';
    mainColumn.append(head, article);
    if (conceptSection) mainColumn.append(conceptSection);
    if (relationSection) mainColumn.append(relationSection);

    const layout = document.createElement('div');
    layout.className = 'knowledge-detail-layout';
    layout.append(mainColumn);
    const outline = createDetailOutline(article);
    if (outline) layout.append(outline);

    view.append(back, layout);
    app.replaceChildren(view);

    if (location.hash) {
      const requestedId = decodeURIComponent(location.hash.slice(1));
      const target = article.querySelector('#' + CSS.escape(requestedId));
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
  }

  async function openCard(id) {
    try {
      setView('cards');
      renderLoading('正在開啟 Knowledge Card', '載入正文、關聯與 Concepts…');
      const detail = await api('/api/cards/' + encodeURIComponent(id));
      renderDetail(detail);
    } catch (error) {
      if (error.message !== 'AUTH_STOP') stateView('讀取失敗', error.message, false, 'error');
    }
  }

  async function renderCards() {
    setView('cards');
    renderLoading('正在載入 Knowledge Cards', '讀取目前 release 的卡片、分類與 metadata…');
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
    const actionCounts = new Map();
    const tagCounts = new Map();
    let highRelevanceCount = 0;
    for (const card of cards) {
      const overall = Number(card.relevance?.overall);
      if (Number.isFinite(overall) && overall >= 4) highRelevanceCount += 1;
      if (card.resource_kind) resourceCounts.set(card.resource_kind, (resourceCounts.get(card.resource_kind) || 0) + 1);
      for (const category of card.navigation_categories || []) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
      for (const action of card.actions || []) {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      }
      for (const tag of card.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const stats = document.createElement('div');
    stats.className = 'radar-stats';
    for (const [value, label] of [
      [cards.length, 'Knowledge Cards'],
      [highRelevanceCount, '高度相關'],
      [actionCounts.get('TRY') || 0, '值得 TRY'],
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

    const action = document.createElement('select');
    const actionAll = document.createElement('option');
    actionAll.value = 'ALL';
    actionAll.textContent = '全部';
    action.append(actionAll);
    for (const item of [...actionCounts.keys()].sort()) {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item + ' (' + actionCounts.get(item) + ')';
      action.append(option);
    }

    const tag = document.createElement('select');
    const tagAll = document.createElement('option');
    tagAll.value = 'ALL';
    tagAll.textContent = '全部';
    tag.append(tagAll);
    for (const [item, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-TW')).slice(0, 60)) {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item + ' (' + count + ')';
      tag.append(option);
    }

    const sort = document.createElement('select');
    for (const [value, label] of [['newest', '最近更新'], ['relevance', '相關性'], ['title', '名稱']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sort.append(option);
    }
    row.append(
      makeLabel('搜尋', query),
      makeLabel('資源型態', resource),
      makeLabel('Action', action),
      makeLabel('Tag', tag),
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
        if (action.value !== 'ALL' && !(card.actions || []).includes(action.value)) return false;
        if (tag.value !== 'ALL' && !(card.tags || []).includes(tag.value)) return false;
        if (status.value !== 'ALL' && card.status !== status.value) return false;
        if (selectedCategory !== 'ALL' && !(card.navigation_categories || []).includes(selectedCategory)) return false;
        if (!needle) return true;
        const haystack = [
          card.title,
          card.summary,
          card.source_type,
          card.resource_kind,
          card.status,
          ...(card.navigation_categories || []),
          ...(card.tags || []),
          ...(card.actions || [])
        ].filter(Boolean).join(' ').toLocaleLowerCase('zh-TW');
        return haystack.includes(needle);
      });

      filtered = [...filtered].sort((a, b) => {
        if (sort.value === 'title') return a.title.localeCompare(b.title, 'zh-TW');
        if (sort.value === 'relevance') {
          const score = Number(b.relevance?.overall || 0) - Number(a.relevance?.overall || 0);
          if (score) return score;
        }
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
        source.textContent = [card.source_type, card.resource_kind].filter(Boolean).join(' · ') || 'Knowledge Card';
        const score = document.createElement('div');
        score.className = 'knowledge-score';
        const overall = Math.max(0, Math.min(5, Math.round(Number(card.relevance?.overall || 0))));
        score.textContent = '★'.repeat(overall) + '☆'.repeat(5 - overall);
        score.title = 'Overall relevance ' + overall + ' / 5';
        top.append(source, score);

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

        const actionsEl = document.createElement('div');
        actionsEl.className = 'knowledge-actions';
        for (const item of card.actions || []) {
          const badge = document.createElement('b');
          badge.textContent = item;
          actionsEl.append(badge);
        }

        const tagsEl = document.createElement('div');
        tagsEl.className = 'knowledge-tags-buttons';
        for (const item of (card.tags || []).slice(0, 6)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '#' + item;
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            tag.value = item;
            renderGrid();
          });
          tagsEl.append(button);
        }

        const footer = document.createElement('footer');
        const updated = document.createElement('span');
        updated.textContent = card.updated_at ? '更新 ' + card.updated_at : '';
        const open = document.createElement('b');
        open.textContent = '查看分析 →';
        footer.append(updated, open);

        tile.append(top, h2, summary, categoriesEl, actionsEl, tagsEl, footer);
        grid.append(tile);
      }
    }

    const update = () => renderGrid();
    query.addEventListener('input', update);
    resource.addEventListener('change', update);
    action.addEventListener('change', update);
    tag.addEventListener('change', update);
    status.addEventListener('change', update);
    sort.addEventListener('change', update);
    reset.addEventListener('click', () => {
      query.value = '';
      resource.value = 'ALL';
      action.value = 'ALL';
      tag.value = 'ALL';
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

  async function renderGraph(options = {}) {
    setView('graph');
    renderLoading('正在建立 Knowledge Graph', '準備節點、關聯與語意鄰居…');
    const payload = await api('/api/graph');
    renderLegacyGraph(payload, options);
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
      await api('/api/auth/session');
      header.hidden = false;
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

  bootstrap();
})();
</script>
</body>
</html>`;
}
