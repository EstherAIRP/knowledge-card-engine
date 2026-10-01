export const RELATION_TYPE_LIST = Object.freeze([
  'similar_to',
  'alternative_to',
  'complements',
  'integrates_with',
  'depends_on',
  'extends',
  'contrasts_with'
]);

export const RELATION_TYPES = new Set(RELATION_TYPE_LIST);
export const RELATION_DIRECTIONS = new Set(['undirected', 'source_to_target', 'target_to_source']);
export const DIRECTIONAL_TYPES = new Set(['depends_on', 'extends']);
