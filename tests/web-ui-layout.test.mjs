import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { renderPrivateSiteShell } from '../apps/web/src/index.js';
import { siteCss, styleFragments } from '../apps/web/src/styles/index.js';

const root = new URL('../', import.meta.url);

function read(relative) {
  return fs.readFileSync(new URL(relative, root), 'utf8');
}

test('web UI styles have explicit ownership and preserve ordered composition', () => {
  const orders = styleFragments.map((fragment) => fragment.order);
  assert.deepEqual(orders, Array.from({ length: orders.length }, (_, index) => index));
  assert.equal(new Set(orders).size, orders.length);

  const expectations = [
    ['apps/web/src/styles/tokens.js', /--kc-page-max: 1440px/u],
    ['apps/web/src/styles/base.js', /box-sizing: border-box/u],
    ['apps/web/src/styles/layout.js', /\.page-shell/u],
    ['apps/web/src/styles/shared.js', /\.search-form/u],
    ['apps/web/src/styles/radar.js', /\.radar-grid/u],
    ['apps/web/src/styles/detail.js', /\.knowledge-reading/u],
    ['apps/web/src/styles/search.js', /\.result-button/u],
    ['apps/web/src/styles/graph.js', /\.knowledge-graph-shell/u]
  ];

  for (const [relative, pattern] of expectations) {
    assert.match(read(relative), pattern, relative);
  }

  const indexSource = read('apps/web/src/index.js');
  const graphBehaviorSource = read('apps/web/src/graph-runtime.js');
  assert.doesNotMatch(indexSource, /--kc-page-max/u);
  assert.doesNotMatch(graphBehaviorSource, /legacyGraphCss/u);
  assert.doesNotMatch(graphBehaviorSource, /\.knowledge-graph-shell/u);

  const html = renderPrivateSiteShell();
  assert.ok(html.includes(siteCss));
});

test('web UI layout contract retains shared frame, reading width, responsive grid, outline, and graph inspector rules', () => {
  assert.match(siteCss, /--kc-page-max:\s*1440px/u);
  assert.match(siteCss, /--kc-reading-max:\s*920px/u);
  assert.match(siteCss, /--kc-page-gutter:\s*clamp\(16px, 3vw, 32px\)/u);
  assert.match(siteCss, /\.page-shell\s*\{[\s\S]*?var\(--kc-page-max\)/u);
  assert.match(siteCss, /\.knowledge-reading\s*\{[\s\S]*?width:\s*100%/u);
  assert.match(siteCss, /\.knowledge-reading > p,[\s\S]*?max-width:\s*var\(--kc-reading-max\)/u);
  assert.match(siteCss, /\.radar-grid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(siteCss, /@media \(max-width: 1080px\)[\s\S]*?\.radar-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(siteCss, /@media \(max-width: 680px\)[\s\S]*?\.radar-grid\s*\{\s*grid-template-columns:\s*1fr/u);
  assert.match(siteCss, /@media \(min-width: 1120px\)[\s\S]*?\.knowledge-outline\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*84px/u);
  assert.match(siteCss, /@media \(max-width: 1119px\)[\s\S]*?header\.detail-outline-active \.brand\s*\{\s*display:\s*none/u);
  assert.match(siteCss, /header\.detail-outline-active \.detail-outline-header-toggle\s*\{\s*display:\s*flex/u);
  assert.match(siteCss, /\.knowledge-outline\.is-open\s*\{[\s\S]*?position:\s*fixed[\s\S]*?top:\s*64px/u);
  assert.doesNotMatch(siteCss, /scroll-margin-top:\s*128px/u);
  const indexSource = read('apps/web/src/index.js');
  assert.match(indexSource, /id="detail-outline-toggle"/u);
  assert.match(indexSource, /detail-outline-header-chevron[\s\S]*?<svg viewBox="0 0 12 12"/u);
  assert.doesNotMatch(indexSource, /⌄/u);
  assert.match(siteCss, /\.detail-outline-header-chevron\s*\{[\s\S]*?width:\s*12px[\s\S]*?height:\s*12px[\s\S]*?flex:\s*0 0 12px[\s\S]*?transform-origin:\s*50% 50%/u);
  assert.match(siteCss, /\.detail-outline-header-toggle\[aria-expanded="true"\] \.detail-outline-header-chevron\s*\{[\s\S]*?transform:\s*rotate\(-90deg\)/u);
  assert.match(indexSource, /detailOutlineToggle\.hidden = !compact/u);
  assert.match(indexSource, /header\.classList\.toggle\('detail-outline-active', compact\)/u);
  assert.match(indexSource, /classList\.toggle\('is-open'\)/u);
  assert.match(indexSource, /activeOffset = isCompactOutline\(\) \? 88 : 120/u);
  assert.match(siteCss, /@media \(max-width: 900px\)[\s\S]*?\.graph-inspector\s*\{[\s\S]*?bottom:\s*0/u);
  assert.match(siteCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important/u);
});
