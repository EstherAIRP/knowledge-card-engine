export const tokenStyles = [
  {
    order: 0,
    css: String.raw`:root {
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
    }`
  }
];
