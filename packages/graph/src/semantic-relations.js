import { createHash } from 'node:crypto';
import {
  effectiveOwnershipValue,
  effectiveRelevance,
  extractSection
} from '../../core/src/index.js';
import {
  DIRECTIONAL_TYPES,
  RELATION_DIRECTIONS,
  RELATION_TYPES
} from './relation-types.js';

const EMBEDDING_SECTIONS = Object.freeze([
  '一句話介紹',
  '核心概念',
  '架構與技術',
  '技術亮點'
]);

const RELEVANCE_DIMENSIONS = Object.freeze([
  'ai_rd',
  'aoi_ai',
  'llm_agent',
  'sillytavern_ai_rpg',
  'image_gen'
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

function tokenMap(values) {
  return new Map(
    asArray(values)
      .map((value) => [normalizeToken(value), String(value).trim()])
      .filter(([key]) => key)
  );
}

function compactWhitespace(value) {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[#>*_~|]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function canonicalPair(source, target) {
  return source.localeCompare(target) <= 0
    ? [source, target]
    : [target, source];
}

export function relationPairKey(source, target) {
  const [left, right] = canonicalPair(source, target);
  return left + '::' + right;
}

function jaccard(leftValues, rightValues) {
  const left = new Set(asArray(leftValues).map(normalizeToken).filter(Boolean));
  const right = new Set(asArray(rightValues).map(normalizeToken).filter(Boolean));
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / union.size;
}

function sharedValues(leftValues, rightValues) {
  const left = tokenMap(leftValues);
  const right = tokenMap(rightValues);
  return [...left.keys()]
    .filter((key) => right.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => left.get(key));
}

function highRelevanceDimensions(card) {
  const relevance = effectiveRelevance(card?.data?.relevance);
  return RELEVANCE_DIMENSIONS.filter((key) => Number(relevance?.[key] ?? 0) >= 4);
}

export function buildEmbeddingText(card, { maxChars = 12000 } = {}) {
  const data = card?.data ?? {};
  const categories = effectiveOwnershipValue(data.classification?.categories) ?? [];
  const tags = effectiveOwnershipValue(data.classification?.tags) ?? [];
  const relevance = effectiveRelevance(data.relevance);
  const actions = effectiveOwnershipValue(data.actions) ?? [];
  const sections = EMBEDDING_SECTIONS
    .map((heading) => {
      const content = extractSection(card?.body ?? '', heading);
      return content ? heading + ': ' + compactWhitespace(content) : null;
    })
    .filter(Boolean);

  const text = [
    'Title: ' + (data.title ?? data.id ?? ''),
    'Summary: ' + (data.summary ?? ''),
    'Categories: ' + asArray(categories).join(', '),
    'Tags: ' + asArray(tags).join(', '),
    'Actions: ' + asArray(actions).join(', '),
    'Relevance: ' + Object.entries(relevance || {}).map(([key, value]) => key + '=' + value).join(', '),
    ...sections
  ]
    .map(compactWhitespace)
    .filter(Boolean)
    .join('\n');

  return text.slice(0, maxChars);
}

export function embeddingContentHash(text, { provider, model, method } = {}) {
  return createHash('sha256')
    .update(JSON.stringify({
      provider: provider ?? null,
      model: model ?? null,
      method: method ?? null,
      text
    }))
    .digest('hex');
}

export function scoreTaxonomyPair(leftCard, rightCard) {
  const leftId = leftCard?.data?.id;
  const rightId = rightCard?.data?.id;
  if (!leftId || !rightId || leftId === rightId) return null;

  const leftCategories = effectiveOwnershipValue(leftCard.data?.classification?.categories) ?? [];
  const rightCategories = effectiveOwnershipValue(rightCard.data?.classification?.categories) ?? [];
  const leftTags = effectiveOwnershipValue(leftCard.data?.classification?.tags) ?? [];
  const rightTags = effectiveOwnershipValue(rightCard.data?.classification?.tags) ?? [];
  const leftActions = effectiveOwnershipValue(leftCard.data?.actions) ?? [];
  const rightActions = effectiveOwnershipValue(rightCard.data?.actions) ?? [];
  const leftHighRelevance = highRelevanceDimensions(leftCard);
  const rightHighRelevance = highRelevanceDimensions(rightCard);

  const metrics = {
    categories: jaccard(leftCategories, rightCategories),
    tags: jaccard(leftTags, rightTags),
    relevance: jaccard(leftHighRelevance, rightHighRelevance),
    actions: jaccard(leftActions, rightActions)
  };

  const score = Number((
    metrics.categories * 0.45
    + metrics.tags * 0.30
    + metrics.relevance * 0.20
    + metrics.actions * 0.05
  ).toFixed(4));

  const shared = {
    categories: sharedValues(leftCategories, rightCategories),
    tags: sharedValues(leftTags, rightTags),
    relevance: sharedValues(leftHighRelevance, rightHighRelevance),
    actions: sharedValues(leftActions, rightActions)
  };
  const signals = [
    ...shared.categories.map((value) => 'category:' + value),
    ...shared.tags.map((value) => 'tag:' + value),
    ...shared.relevance.map((value) => 'relevance:' + value),
    ...shared.actions.map((value) => 'action:' + value)
  ];

  const [source, target] = canonicalPair(leftId, rightId);
  return { source, target, score, metrics, shared, signals };
}

export function normalizeSemanticSimilarity(rawScore, config = {}) {
  if (!Number.isFinite(rawScore)) return null;
  const semantic = config.semantic ?? {};
  const floor = Number(semantic.normalization_floor ?? 0.70);
  const ceiling = Number(semantic.normalization_ceiling ?? 0.95);
  if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling <= floor) {
    return Number(Math.max(0, Math.min(1, rawScore)).toFixed(4));
  }
  const normalized = (Number(rawScore) - floor) / (ceiling - floor);
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(4));
}

function scoringDefaults(config = {}) {
  const scoring = config.scoring ?? {};
  return {
    taxonomyWeight: Number(scoring.taxonomy_weight ?? 0.40),
    semanticWeight: Number(scoring.semantic_weight ?? 0.60),
    llmWeight: Number(scoring.llm_weight ?? 0.35),
    minCombinedScore: Number(scoring.min_combined_score ?? 0.30),
    fallbackMinCombinedScore: Number(scoring.fallback_min_combined_score ?? 0.48)
  };
}

export function combineTaxonomySemantic(taxonomyScore, semanticScore, config = {}) {
  const { taxonomyWeight, semanticWeight } = scoringDefaults(config);
  const taxonomy = Number(taxonomyScore ?? 0);
  if (!Number.isFinite(semanticScore)) return Number(taxonomy.toFixed(4));

  const semantic = Number(semanticScore);
  const weightSum = taxonomyWeight + semanticWeight;
  if (weightSum <= 0) return Number(((taxonomy + semantic) / 2).toFixed(4));
  return Number(((taxonomy * taxonomyWeight + semantic * semanticWeight) / weightSum).toFixed(4));
}

export function buildSemanticCandidates(cards, vectorIndex, config, cosineSimilarity) {
  const vectorById = new Map(
    (vectorIndex?.entries || [])
      .filter((entry) => entry?.card_id && Array.isArray(entry.vector))
      .map((entry) => [entry.card_id, entry.vector])
  );
  const candidateConfig = config?.candidate ?? {};
  const semanticConfig = config?.semantic ?? {};
  const minTaxonomy = Number(candidateConfig.min_taxonomy_score ?? 0.08);
  const minSemantic = Number(semanticConfig.min_score ?? 0.20);
  const topK = Math.max(1, Number(candidateConfig.top_k ?? 12));
  const { minCombinedScore, fallbackMinCombinedScore } = scoringDefaults(config);

  const candidates = [];
  for (let left = 0; left < cards.length; left += 1) {
    for (let right = left + 1; right < cards.length; right += 1) {
      const taxonomy = scoreTaxonomyPair(cards[left], cards[right]);
      if (!taxonomy) continue;

      const leftVector = vectorById.get(taxonomy.source);
      const rightVector = vectorById.get(taxonomy.target);
      const semanticRaw = Array.isArray(leftVector) && Array.isArray(rightVector)
        ? cosineSimilarity(leftVector, rightVector)
        : null;
      const semantic = normalizeSemanticSimilarity(semanticRaw, config);
      const combined = combineTaxonomySemantic(taxonomy.score, semantic, config);

      const passesSignalGate = taxonomy.score >= minTaxonomy
        || (semantic !== null && semantic >= minSemantic);
      if (!passesSignalGate || combined < minCombinedScore) continue;

      candidates.push({
        source: taxonomy.source,
        target: taxonomy.target,
        taxonomy_score: taxonomy.score,
        semantic_score: semantic,
        semantic_raw_score: Number.isFinite(semanticRaw) ? Number(semanticRaw.toFixed(4)) : null,
        combined_score: combined,
        fallback_publishable: combined >= fallbackMinCombinedScore,
        metrics: taxonomy.metrics,
        shared: taxonomy.shared,
        signals: taxonomy.signals
      });
    }
  }

  candidates.sort((a, b) =>
    b.combined_score - a.combined_score
    || relationPairKey(a.source, a.target).localeCompare(relationPairKey(b.source, b.target))
  );

  const degree = new Map();
  const accepted = [];
  for (const candidate of candidates) {
    const sourceDegree = degree.get(candidate.source) ?? 0;
    const targetDegree = degree.get(candidate.target) ?? 0;
    if (sourceDegree >= topK || targetDegree >= topK) continue;
    accepted.push(candidate);
    degree.set(candidate.source, sourceDegree + 1);
    degree.set(candidate.target, targetDegree + 1);
  }

  return accepted.sort((a, b) =>
    a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
  );
}

export function degreeLimitedPairs(candidates, maxPerCard) {
  const degree = new Map();
  const allowed = new Set();
  const sorted = [...candidates].sort((a, b) =>
    b.combined_score - a.combined_score
    || relationPairKey(a.source, a.target).localeCompare(relationPairKey(b.source, b.target))
  );
  for (const candidate of sorted) {
    const sourceDegree = degree.get(candidate.source) ?? 0;
    const targetDegree = degree.get(candidate.target) ?? 0;
    if (sourceDegree >= maxPerCard || targetDegree >= maxPerCard) continue;
    allowed.add(relationPairKey(candidate.source, candidate.target));
    degree.set(candidate.source, sourceDegree + 1);
    degree.set(candidate.target, targetDegree + 1);
  }
  return allowed;
}

export function validateClassifierOutput(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['classifier output must be an object.'];
  }
  for (const key of ['related', 'type', 'direction', 'confidence', 'reason']) {
    if (!(key in value)) errors.push('classifier output missing ' + key + '.');
  }
  if (typeof value.related !== 'boolean') errors.push('classifier related must be boolean.');
  if (!RELATION_TYPES.has(value.type)) errors.push('classifier type is unsupported: ' + value.type);
  if (!RELATION_DIRECTIONS.has(value.direction)) errors.push('classifier direction is unsupported: ' + value.direction);
  if (DIRECTIONAL_TYPES.has(value.type) && value.direction === 'undirected') {
    errors.push('classifier direction must be directional for ' + value.type + '.');
  }
  if (!DIRECTIONAL_TYPES.has(value.type) && value.direction !== 'undirected') {
    errors.push('classifier direction must be undirected for ' + value.type + '.');
  }
  if (!Number.isFinite(Number(value.confidence)) || Number(value.confidence) < 0 || Number(value.confidence) > 1) {
    errors.push('classifier confidence must be between 0 and 1.');
  }
  if (typeof value.reason !== 'string' || value.reason.trim().length === 0 || value.reason.length > 600) {
    errors.push('classifier reason must be a non-empty string up to 600 characters.');
  }
  return errors;
}

export function fallbackClassifyCandidate(candidate) {
  const semantic = Number(candidate.semantic_score ?? 0);
  const taxonomy = Number(candidate.taxonomy_score ?? 0);
  const publishable = candidate.fallback_publishable !== false;
  const type = semantic >= 0.62 && taxonomy >= 0.32 ? 'similar_to' : 'complements';
  const confidence = Number(Math.max(0.35, Math.min(0.78, candidate.combined_score)).toFixed(4));

  if (!publishable) {
    return {
      related: false,
      type,
      direction: 'undirected',
      confidence,
      reason: '此配對達到候選門檻，但未達無模型備援的公開門檻；保留候選，不建立自動關聯。',
      classifier: 'heuristic-fallback'
    };
  }

  return {
    related: true,
    type,
    direction: 'undirected',
    confidence,
    reason: type === 'similar_to'
      ? '分類訊號與語意向量都顯示兩張 Card 聚焦高度相近；目前未經外部模型分類，以 similar_to 作為保守備援。'
      : '兩張 Card 具有足夠的分類／語意相近度，但確定性訊號不足以安全推導方向性關係；以 complements 作為保守備援。',
    classifier: 'heuristic-fallback'
  };
}

export function materializeClassifiedRelation(candidate, classification, config = {}) {
  const errors = validateClassifierOutput(classification);
  if (errors.length) throw new Error(errors.join(' '));
  if (!classification.related) return null;

  const { llmWeight } = scoringDefaults(config);
  const base = Number(candidate.combined_score ?? 0);
  const confidence = Number(classification.confidence ?? 0);
  const score = Number((base * (1 - llmWeight) + confidence * llmWeight).toFixed(4));
  const classifier = classification.classifier ?? 'llm';

  return {
    pair_id: relationPairKey(candidate.source, candidate.target),
    source: candidate.source,
    target: candidate.target,
    type: classification.type,
    direction: classification.direction,
    score,
    method: classifier === 'llm' ? 'llm_classifier_v1' : 'semantic_fallback_v1',
    scores: {
      taxonomy: Number(candidate.taxonomy_score ?? 0),
      semantic: Number.isFinite(candidate.semantic_score) ? Number(candidate.semantic_score) : null,
      semantic_raw: Number.isFinite(candidate.semantic_raw_score) ? Number(candidate.semantic_raw_score) : null,
      llm: classifier === 'llm' ? confidence : null,
      combined: base
    },
    evidence: {
      taxonomy: Number(candidate.taxonomy_score ?? 0),
      vector_similarity: Number.isFinite(candidate.semantic_score) ? Number(candidate.semantic_score) : null,
      vector_similarity_raw: Number.isFinite(candidate.semantic_raw_score) ? Number(candidate.semantic_raw_score) : null,
      shared_categories: candidate.shared?.categories ?? [],
      shared_tags: candidate.shared?.tags ?? [],
      shared_relevance: candidate.shared?.relevance ?? [],
      shared_actions: candidate.shared?.actions ?? []
    },
    reason: classification.reason.trim(),
    confidence,
    classifier,
    signals: candidate.signals ?? []
  };
}
