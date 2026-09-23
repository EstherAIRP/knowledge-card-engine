import { tokenStyles } from './tokens.js';
import { baseStyles } from './base.js';
import { layoutStyles } from './layout.js';
import { sharedStyles } from './shared.js';
import { radarStyles } from './radar.js';
import { detailStyles } from './detail.js';
import { searchStyles } from './search.js';
import { graphStyles } from './graph.js';

export const styleFragments = [
  ...tokenStyles,
  ...baseStyles,
  ...layoutStyles,
  ...sharedStyles,
  ...radarStyles,
  ...detailStyles,
  ...searchStyles,
  ...graphStyles
].sort((left, right) => left.order - right.order);

export const siteCss = styleFragments.map((fragment) => fragment.css).join('\n\n');
