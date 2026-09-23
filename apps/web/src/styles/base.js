export const baseStyles = [
  {
    order: 1,
    css: String.raw`* { box-sizing: border-box; }

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

[hidden] { display: none !important; }`
  },
  {
    order: 24,
    css: String.raw`@media (prefers-reduced-motion: reduce) {
      .loading-orbit,
      .loading-orbit::before,
      .loading-orbit::after,
      .loading-core,
      .loading-progress span,
      .loading-line {
        animation: none !important;
      }
    }`
  }
];
