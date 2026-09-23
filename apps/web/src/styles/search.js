export const searchStyles = [
  {
    order: 18,
    css: String.raw`.result-button {
      width: 100%;
      padding: 16px;
      border: 1px solid var(--kc-border);
      border-radius: 14px;
      background: var(--kc-bg);
      color: var(--kc-text);
      text-align: left;
    }

.result-button:hover { border-color: var(--kc-brand); }

.result-button strong { display: block; margin-bottom: 6px; }`
  },
  {
    order: 20,
    css: String.raw`.search-view h1,
    .graph-view h1 {
      margin: 0 0 18px;
      font-size: clamp(32px, 5vw, 52px);
      letter-spacing: -.035em;
    }`
  }
];
