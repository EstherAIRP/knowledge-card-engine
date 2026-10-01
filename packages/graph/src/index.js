import { createHash } from 'node:crypto';
import {
  effectiveOwnershipValue,
  effectiveRelevance
} from '../../core/src/index.js';
import {
  classifyRelationWithOpenAICompatible,
  createLocalTransformerEmbeddings
} from './model-clients.js';
import {
  DIRECTIONAL_TYPES,
  RELATION_TYPES
} from './relation-types.js';
import {
  buildEmbeddingText,
  buildSemanticCandidates,
  degreeLimitedPairs,
  embeddingContentHash,
  fallbackClassifyCandidate,
  materializeClassifiedRelation,
  relationPairKey,
  validateClassifierOutput
} from './semantic-relations.js';

export const moduleId = 'graph';
export const moduleKind = 'package';

export const GENERATED_SCHEMA_VERSION = 1;
export const VECTOR_METHOD = 'local-transformers-embedding-v1';
export const TOKEN_HASH_VECTOR_METHOD = 'deterministic-token-hash-v1';
export const LAYOUT_METHOD = 'deterministic-vector-projection-v1';
export const RELATION_METHOD = 'taxonomy-semantic-classifier-v1';
export const CONCEPT_METHOD = 'deterministic-taxonomy-tag-v1';
export const SEARCH_METHOD = 'weighted-token-search-v1';
export const VECTOR_DIMENSIONS = 384;
export const TOKEN_HASH_VECTOR_DIMENSIONS = 64;
export const DEFAULT_VECTOR_PROVIDER = 'local-transformers';
export const DEFAULT_VECTOR_MODEL = 'Xenova/multilingual-e5-small';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256Text(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function hashValue(value) {
  return sha256Text(stableStringify(value));
}

function effectiveList(wrapper) {
  const value = effectiveOwnershipValue(wrapper);
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function tokenize(value) {
  const normalized = normalizeSearchText(value);
  const tokens = normalized.match(/[\p{L}\p{N}]+(?:[-_+.][\p{L}\p{N}]+)*/gu) || [];
  return tokens.filter((token) => token.length > 1 || /\p{N}/u.test(token));
}

function countTerms(tokens) {
  const counts = {};
  for (const token of tokens) counts[token] = (counts[token] || 0) + 1;
  return counts;
}

function searchDocument(card) {
  const categories = effectiveList(card.data?.classification?.categories);
  const tags = effectiveList(card.data?.classification?.tags);
  const navigation = effectiveList(card.data?.navigation?.categories);
  const actions = effectiveList(card.data?.actions);
  const resourceKind = effectiveOwnershipValue(card.data?.resource_kind);
  const status = effectiveOwnershipValue(card.data?.status);
  const relevance = effectiveRelevance(card.data?.relevance);

  const inputs = {
    title: normalizeSearchText(card.data?.title),
    summary: normalizeSearchText(card.data?.summary),
    metadata: normalizeSearchText([
      ...categories,
      ...tags,
      ...navigation,
      ...actions,
      resourceKind,
      status,
      ...Object.keys(relevance || {})
    ].filter(Boolean).join(' ')),
    body: normalizeSearchText(card.body)
  };

  return {
    id: card.data.id,
    title: card.data.title,
    summary: card.data.summary,
    canonical_url: card.data.canonical_url,
    resource_kind: resourceKind,
    navigation_categories: navigation,
    status,
    updated_at: card.data.updated_at,
    input_hash: hashValue(inputs),
    fields: Object.fromEntries(
      Object.entries(inputs).map(([key, text]) => [key, {
        text,
        terms: countTerms(tokenize(text))
      }])
    )
  };
}

function commonMeta({ engineSha, sourceSha, generatedAt, generator, inputHash, configHash }) {
  return {
    schema_version: GENERATED_SCHEMA_VERSION,
    engine_sha: engineSha,
    source_sha: sourceSha,
    generated_at: generatedAt,
    generator,
    input_hash: inputHash,
    config_hash: configHash
  };
}

function validateSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new TypeError(label + ' must be a lowercase 40-character Git SHA.');
  }
  return value;
}

function validateGeneratedAt(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('generatedAt must be an ISO-compatible timestamp.');
  }
  return value;
}

function cardsFingerprint(cards) {
  return hashValue(cards.map((card) => ({
    id: card.data?.id,
    raw: card.raw
  })));
}

export function buildSearchIndex(cards, {
  engineSha,
  sourceSha,
  generatedAt,
  previous = null
}) {
  validateSha(engineSha, 'engineSha');
  validateSha(sourceSha, 'sourceSha');
  validateGeneratedAt(generatedAt);

  const previousById = new Map((previous?.documents || []).map((item) => [item.id, item]));
  let reused = 0;
  let rebuilt = 0;
  const documents = cards.map((card) => {
    const next = searchDocument(card);
    const prior = previousById.get(next.id);
    if (prior?.input_hash === next.input_hash && prior?.fields) {
      reused += 1;
      return prior;
    }
    rebuilt += 1;
    return next;
  }).sort((a, b) => a.id.localeCompare(b.id));

  const configHash = hashValue({ method: SEARCH_METHOD, weights: { title: 5, summary: 3, metadata: 2, body: 1 } });
  return {
    ...commonMeta({
      engineSha,
      sourceSha,
      generatedAt,
      generator: SEARCH_METHOD,
      inputHash: cardsFingerprint(cards),
      configHash
    }),
    stats: { documents: documents.length, reused, rebuilt },
    documents
  };
}

function vectorForTokens(tokens, dimensions = TOKEN_HASH_VECTOR_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const counts = countTerms(tokens);
  for (const [token, count] of Object.entries(counts)) {
    const digest = createHash('sha256').update(token, 'utf8').digest();
    const index = digest.readUInt16BE(0) % dimensions;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.log(count);
    vector[index] += sign * weight;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (norm === 0) return vector;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}

function vectorDefaults(config = {}) {
  const semantic = config.semantic || {};
  const provider = String(semantic.provider || DEFAULT_VECTOR_PROVIDER);
  if (provider === DEFAULT_VECTOR_PROVIDER) {
    return {
      provider,
      model: String(semantic.model || DEFAULT_VECTOR_MODEL),
      method: VECTOR_METHOD,
      dimensions: Number.isInteger(semantic.dimensions) ? semantic.dimensions : VECTOR_DIMENSIONS,
      batchSize: Math.max(1, Number(semantic.batch_size ?? 16))
    };
  }
  if (provider === 'deterministic-token-hash') {
    return {
      provider,
      model: null,
      method: TOKEN_HASH_VECTOR_METHOD,
      dimensions: Number.isInteger(semantic.dimensions) ? semantic.dimensions : TOKEN_HASH_VECTOR_DIMENSIONS,
      batchSize: Math.max(1, Number(semantic.batch_size ?? 64))
    };
  }
  throw new TypeError('Unsupported semantic provider: ' + provider);
}

async function embedVectorBatch(texts, defaults, embedTexts = null) {
  if (typeof embedTexts === 'function') {
    return embedTexts(texts, {
      provider: defaults.provider,
      model: defaults.model,
      dimensions: defaults.dimensions
    });
  }
  if (defaults.provider === DEFAULT_VECTOR_PROVIDER) {
    return createLocalTransformerEmbeddings(texts, { model: defaults.model });
  }
  if (defaults.provider === 'deterministic-token-hash') {
    return texts.map((text) => vectorForTokens(tokenize(text), defaults.dimensions));
  }
  throw new TypeError('Unsupported semantic provider: ' + defaults.provider);
}

export async function buildVectorIndex(cards, {
  engineSha,
  sourceSha,
  generatedAt,
  config = {},
  previous = null,
  fullRebuild = false,
  embedTexts = null
}) {
  validateSha(engineSha, 'engineSha');
  validateSha(sourceSha, 'sourceSha');
  validateGeneratedAt(generatedAt);

  const defaults = vectorDefaults(config);
  const previousById = new Map((previous?.entries || []).map((entry) => [entry.card_id, entry]));
  const inputs = cards.map((card) => {
    const text = buildEmbeddingText(card);
    return {
      card_id: card.data.id,
      text,
      input_hash: embeddingContentHash(text, {
        provider: defaults.provider,
        model: defaults.model,
        method: defaults.method
      })
    };
  });

  const entries = [];
  const stale = [];
  let reused = 0;
  for (const input of inputs) {
    const prior = previousById.get(input.card_id);
    const reusable = !fullRebuild
      && previous?.method === defaults.method
      && previous?.provider === defaults.provider
      && (previous?.model ?? null) === defaults.model
      && previous?.dimensions === defaults.dimensions
      && prior?.input_hash === input.input_hash
      && Array.isArray(prior.vector)
      && prior.vector.length === defaults.dimensions;
    if (reusable) {
      reused += 1;
      entries.push(prior);
    } else {
      stale.push(input);
    }
  }

  for (let start = 0; start < stale.length; start += defaults.batchSize) {
    const batch = stale.slice(start, start + defaults.batchSize);
    const vectors = await embedVectorBatch(batch.map((item) => item.text), defaults, embedTexts);
    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new Error('Embedding provider returned ' + (vectors?.length ?? 0) + ' vectors for ' + batch.length + ' inputs.');
    }
    for (let index = 0; index < batch.length; index += 1) {
      const vector = vectors[index];
      if (
        !Array.isArray(vector)
        || vector.length !== defaults.dimensions
        || vector.some((value) => !Number.isFinite(Number(value)))
      ) {
        throw new Error('Invalid ' + defaults.dimensions + '-dimension embedding returned for ' + batch[index].card_id + '.');
      }
      entries.push({
        card_id: batch[index].card_id,
        input_hash: batch[index].input_hash,
        provider: defaults.provider,
        model: defaults.model,
        dimensions: defaults.dimensions,
        vector: vector.map((value) => Number(value))
      });
    }
  }

  entries.sort((a, b) => a.card_id.localeCompare(b.card_id));
  const configHash = hashValue({
    method: defaults.method,
    provider: defaults.provider,
    model: defaults.model,
    dimensions: defaults.dimensions,
    batch_size: defaults.batchSize,
    input_contract: 'v1-selected-card-fields'
  });
  const inputHash = hashValue({
    method: defaults.method,
    provider: defaults.provider,
    model: defaults.model,
    entries: entries.map((entry) => [entry.card_id, entry.input_hash])
  });

  return {
    ...commonMeta({
      engineSha,
      sourceSha,
      generatedAt,
      generator: 'knowledge-card-vector-builder-v2',
      inputHash,
      configHash
    }),
    method: defaults.method,
    provider: defaults.provider,
    model: defaults.model,
    dimensions: defaults.dimensions,
    stats: {
      entries: entries.length,
      reused,
      rebuilt: stale.length,
      full_rebuild: Boolean(fullRebuild)
    },
    entries
  };
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}

function canonicalPair(source, target) {
  return relationPairKey(source, target);
}

function classificationCandidateHash(candidate, vectorIndex, config) {
  const vectorEntries = new Map((vectorIndex?.entries || []).map((entry) => [entry.card_id, entry]));
  return hashValue({
    source: candidate.source,
    target: candidate.target,
    source_hash: vectorEntries.get(candidate.source)?.input_hash ?? null,
    target_hash: vectorEntries.get(candidate.target)?.input_hash ?? null,
    taxonomy_score: candidate.taxonomy_score,
    semantic_score: candidate.semantic_score,
    semantic_raw_score: candidate.semantic_raw_score,
    combined_score: candidate.combined_score,
    fallback_publishable: candidate.fallback_publishable,
    classifier_model: config.classifier?.model ?? null,
    relation_types: config.relations?.allowed_types ?? []
  });
}

function actualClassifierMode(classifications) {
  const values = Object.values(classifications || {});
  const llmCount = values.filter((item) => item?.classifier === 'llm').length;
  const fallbackCount = values.filter((item) => item?.classifier !== 'llm').length;
  if (llmCount && fallbackCount) return 'llm-with-fallback';
  if (llmCount) return 'llm';
  return 'semantic-fallback';
}

function assertRelationSpec(entry, cardIds, label) {
  if (!entry || typeof entry !== 'object') throw new TypeError(label + ' relation entry must be an object.');
  if (!cardIds.has(entry.source) || !cardIds.has(entry.target) || entry.source === entry.target) {
    throw new TypeError(label + ' relation references invalid Card ids.');
  }
  if (entry.type != null && !RELATION_TYPES.has(entry.type)) {
    throw new TypeError(label + ' relation type is unsupported: ' + entry.type);
  }
  if (entry.type && DIRECTIONAL_TYPES.has(entry.type)) {
    if (!['source_to_target', 'target_to_source'].includes(entry.direction)) {
      throw new TypeError(label + ' directional relation requires source_to_target or target_to_source.');
    }
  } else if (entry.direction != null && entry.direction !== 'undirected') {
    throw new TypeError(label + ' undirected relation must use direction=undirected.');
  }
}

function applyRelationOverrides(generated, overrides, cardIds) {
  const blocked = Array.isArray(overrides?.blocked) ? overrides.blocked : [];
  const pinned = Array.isArray(overrides?.pinned) ? overrides.pinned : [];
  const replacements = Array.isArray(overrides?.overrides) ? overrides.overrides : [];

  const blockedPairs = new Set();
  for (const entry of blocked) {
    if (!entry || typeof entry !== 'object' || !cardIds.has(entry.source) || !cardIds.has(entry.target) || entry.source === entry.target) {
      throw new TypeError('blocked relation references invalid Card ids.');
    }
    blockedPairs.add(canonicalPair(entry.source, entry.target));
  }

  const replacementByPair = new Map();
  for (const entry of replacements) {
    assertRelationSpec(entry, cardIds, 'override');
    replacementByPair.set(canonicalPair(entry.source, entry.target), entry);
  }

  const byPair = new Map();
  for (const edge of generated) {
    if (blockedPairs.has(edge.pair_id)) continue;
    const replacement = replacementByPair.get(edge.pair_id);
    if (replacement) {
      byPair.set(edge.pair_id, {
        ...edge,
        source: replacement.source,
        target: replacement.target,
        type: replacement.type,
        direction: replacement.direction || 'undirected',
        score: Number.isFinite(replacement.score) ? replacement.score : edge.score,
        method: 'manual_override',
        classifier: 'human',
        manual: true,
        note: typeof replacement.note === 'string' ? replacement.note : null
      });
    } else {
      byPair.set(edge.pair_id, edge);
    }
  }

  for (const entry of pinned) {
    assertRelationSpec(entry, cardIds, 'pinned');
    const pairId = canonicalPair(entry.source, entry.target);
    if (blockedPairs.has(pairId)) continue;
    byPair.set(pairId, {
      pair_id: pairId,
      source: entry.source,
      target: entry.target,
      type: entry.type || 'similar_to',
      direction: entry.direction || 'undirected',
      score: Number.isFinite(entry.score) ? Math.max(0, Math.min(1, entry.score)) : 1,
      method: 'manual_pinned',
      classifier: 'human',
      manual: true,
      note: typeof entry.note === 'string' ? entry.note : null,
      evidence: { manual: true },
      signals: ['manual:pinned']
    });
  }

  return [...byPair.values()].sort((a, b) => a.pair_id.localeCompare(b.pair_id));
}

export async function buildRelationIndex(cards, vectorIndex, {
  engineSha,
  sourceSha,
  generatedAt,
  config = {},
  overrides = {},
  previous = null,
  fullRebuild = false,
  classifyRelation = null
}) {
  const cardIds = new Set(cards.map((card) => card.data.id));
  const cardMap = new Map(cards.map((card) => [card.data.id, card]));
  const candidates = buildSemanticCandidates(cards, vectorIndex, config, cosineSimilarity);
  const candidateConfig = config.candidate || {};
  const classifierConfig = config.classifier || {};
  const fallbackTopK = Math.max(1, Number(candidateConfig.fallback_top_k ?? 3));
  const llmTopK = Math.max(1, Number(classifierConfig.max_candidates_per_card ?? 6));
  const eligibleForFallback = degreeLimitedPairs(candidates, fallbackTopK);
  const eligibleForLlm = degreeLimitedPairs(candidates, llmTopK);
  const existingClassifications = previous?.classifications || {};
  const classifications = {};
  const generated = [];

  const classifierKeyEnv = classifierConfig.api_key_env || 'OPENAI_API_KEY';
  const classifierApiKey = process.env[classifierKeyEnv] || '';
  const canUseLlm = classifierConfig.enabled === true
    && classifierConfig.provider === 'openai-compatible'
    && Boolean(classifierConfig.base_url)
    && Boolean(classifierConfig.model)
    && (typeof classifyRelation === 'function' || Boolean(classifierApiKey));
  const classify = typeof classifyRelation === 'function'
    ? classifyRelation
    : classifyRelationWithOpenAICompatible;

  for (const candidate of candidates) {
    const pairId = relationPairKey(candidate.source, candidate.target);
    const effectiveCandidate = {
      ...candidate,
      fallback_publishable: candidate.fallback_publishable && eligibleForFallback.has(pairId)
    };
    const wantsLlm = canUseLlm && eligibleForLlm.has(pairId);
    const candidateHash = classificationCandidateHash(effectiveCandidate, vectorIndex, config);
    const cached = existingClassifications[pairId];
    const cachedValid = cached?.candidate_hash === candidateHash
      && validateClassifierOutput(cached).length === 0;
    const preserveLlmWithoutApi = fullRebuild
      && !canUseLlm
      && cachedValid
      && cached.classifier === 'llm';
    const cacheMatches = cachedValid
      && ((!fullRebuild || preserveLlmWithoutApi) && (!wantsLlm || cached.classifier === 'llm'));

    let decision;
    if (cacheMatches) {
      decision = cached;
    } else if (wantsLlm) {
      try {
        decision = await classify({
          left: buildEmbeddingText(cardMap.get(candidate.source)),
          right: buildEmbeddingText(cardMap.get(candidate.target)),
          candidate: effectiveCandidate,
          baseUrl: classifierConfig.base_url,
          model: classifierConfig.model,
          apiKey: classifierApiKey,
          timeoutMs: Number(classifierConfig.timeout_ms ?? 45000),
          retries: Number(classifierConfig.retries ?? 2)
        });
        const errors = validateClassifierOutput(decision);
        if (errors.length) throw new Error(errors.join(' '));
      } catch (error) {
        if (cachedValid && cached.classifier === 'llm') decision = cached;
        else decision = fallbackClassifyCandidate(effectiveCandidate);
      }
    } else {
      decision = fallbackClassifyCandidate(effectiveCandidate);
    }

    classifications[pairId] = {
      candidate_hash: candidateHash,
      related: decision.related,
      type: decision.type,
      direction: decision.direction,
      confidence: Number(decision.confidence),
      reason: decision.reason,
      classifier: decision.classifier ?? 'heuristic-fallback'
    };

    const edge = materializeClassifiedRelation(effectiveCandidate, classifications[pairId], config);
    if (edge) generated.push({ ...edge, candidate_hash: candidateHash });
  }

  const edges = applyRelationOverrides(generated, overrides, cardIds);
  const classifierMode = actualClassifierMode(classifications);
  const hasLlmClassifications = Object.values(classifications).some((item) => item?.classifier === 'llm');
  const configHash = hashValue({ config, overrides });

  return {
    ...commonMeta({
      engineSha,
      sourceSha,
      generatedAt,
      generator: 'knowledge-card-relation-builder-v2',
      inputHash: hashValue({
        vectors: vectorIndex.input_hash,
        config,
        overrides,
        candidates: Object.entries(classifications)
          .map(([key, value]) => [key, value.candidate_hash])
          .sort((a, b) => a[0].localeCompare(b[0]))
      }),
      configHash
    }),
    method: RELATION_METHOD,
    precedence: ['blocked', 'manual_override_or_pinned', 'llm', 'semantic_fallback'],
    pipeline: {
      semantic: true,
      semantic_provider: vectorIndex.provider ?? null,
      semantic_model: vectorIndex.model ?? null,
      classifier_mode: classifierMode,
      classifier_model: hasLlmClassifications ? classifierConfig.model ?? null : null,
      candidate_count: candidates.length
    },
    config: {
      candidate: config.candidate ?? null,
      semantic: {
        provider: vectorIndex.provider ?? null,
        model: vectorIndex.model ?? null,
        normalization_floor: config.semantic?.normalization_floor ?? 0.70,
        normalization_ceiling: config.semantic?.normalization_ceiling ?? 0.95,
        min_score: config.semantic?.min_score ?? 0.20
      },
      scoring: config.scoring ?? null,
      relation_types: config.relations?.allowed_types ?? []
    },
    classifications,
    edges
  };
}

export function normalizeConceptToken(value) {
  return normalizeSearchText(value)
    .replace(/&/gu, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-+/gu, '-');
}

function conceptDefaults(config = {}) {
  const extraction = config.extraction || {};
  return {
    include_categories: extraction.include_categories !== false,
    include_shared_tags: extraction.include_shared_tags !== false,
    minimum_tag_support: Number.isInteger(extraction.minimum_tag_support) ? extraction.minimum_tag_support : 2,
    concept_relation_min_support: Number.isInteger(extraction.concept_relation_min_support) ? extraction.concept_relation_min_support : 2,
    concept_relation_top_k: Number.isInteger(extraction.concept_relation_top_k) ? extraction.concept_relation_top_k : 8
  };
}

function conceptId(prefix, value) {
  const normalized = normalizeConceptToken(value);
  return normalized ? prefix + '-' + normalized : null;
}

export function buildConceptIndex(cards, {
  engineSha,
  sourceSha,
  generatedAt,
  config = {}
}) {
  const defaults = conceptDefaults(config);
  const promoted = Array.isArray(config.promoted_concepts) ? config.promoted_concepts : [];
  const concepts = new Map();
  const memberships = new Map();
  const tagSupport = new Map();

  for (const card of cards) {
    for (const tag of uniqueSorted(effectiveList(card.data?.classification?.tags).map(normalizeConceptToken).filter(Boolean))) {
      if (!tagSupport.has(tag)) tagSupport.set(tag, new Set());
      tagSupport.get(tag).add(card.data.id);
    }
  }

  function ensureConcept(id, value) {
    if (!concepts.has(id)) concepts.set(id, { ...value, id, card_ids: new Set() });
    return concepts.get(id);
  }

  function addMembership(cardId, concept, origin, strength, evidence) {
    const key = cardId + '::' + concept.id;
    if (memberships.has(key)) return;
    memberships.set(key, {
      card_id: cardId,
      concept_id: concept.id,
      origin,
      strength,
      evidence
    });
    concept.card_ids.add(cardId);
  }

  for (const card of cards) {
    const categories = uniqueSorted(effectiveList(card.data?.classification?.categories));
    const tags = uniqueSorted(effectiveList(card.data?.classification?.tags));
    if (defaults.include_categories) {
      for (const category of categories) {
        const id = conceptId('category', category);
        if (!id) continue;
        const concept = ensureConcept(id, {
          label: category,
          type: 'category',
          description: 'Controlled classification category.'
        });
        addMembership(card.data.id, concept, 'category', 1, [{ kind: 'category', value: category }]);
      }
    }
    if (defaults.include_shared_tags) {
      for (const tag of tags) {
        const normalized = normalizeConceptToken(tag);
        if ((tagSupport.get(normalized)?.size || 0) < defaults.minimum_tag_support) continue;
        const id = conceptId('tag', tag);
        if (!id) continue;
        const concept = ensureConcept(id, {
          label: tag,
          type: 'tag',
          description: 'Shared normalized classification tag.'
        });
        addMembership(card.data.id, concept, 'tag', 0.8, [{ kind: 'tag', value: tag }]);
      }
    }

    for (const rule of promoted) {
      if (!rule || typeof rule.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(rule.id)) {
        throw new TypeError('promoted concept id must be a stable lowercase slug.');
      }
      const match = rule.match || {};
      const categoryMatches = (match.categories_any || []).filter((value) => categories.includes(value));
      const tagMatches = (match.tags_any || []).filter((value) => tags.some((tag) => normalizeConceptToken(tag) === normalizeConceptToken(value)));
      if (!categoryMatches.length && !tagMatches.length) continue;
      const concept = ensureConcept(rule.id, {
        label: String(rule.label || rule.id),
        type: String(rule.type || 'promoted'),
        description: String(rule.description || '')
      });
      const evidence = [
        ...categoryMatches.map((value) => ({ kind: 'category', value })),
        ...tagMatches.map((value) => ({ kind: 'tag', value }))
      ];
      addMembership(card.data.id, concept, 'promoted', Math.min(1, 0.75 + (0.05 * evidence.length)), evidence);
    }
  }

  const conceptList = [...concepts.values()].map((concept) => ({
    id: concept.id,
    label: concept.label,
    type: concept.type,
    description: concept.description,
    card_count: concept.card_ids.size
  })).sort((a, b) => a.id.localeCompare(b.id));

  const cardConcepts = [...memberships.values()].sort((a, b) =>
    a.card_id.localeCompare(b.card_id) || a.concept_id.localeCompare(b.concept_id)
  );

  const conceptById = new Map(conceptList.map((item) => [item.id, item]));
  const supports = new Map();
  const byCard = new Map();
  for (const edge of cardConcepts) {
    if (!byCard.has(edge.card_id)) byCard.set(edge.card_id, []);
    byCard.get(edge.card_id).push(edge.concept_id);
  }
  for (const ids of byCard.values()) {
    const sorted = uniqueSorted(ids);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const key = sorted[i] + '::' + sorted[j];
        supports.set(key, (supports.get(key) || 0) + 1);
      }
    }
  }

  const candidates = [];
  for (const [key, support] of supports) {
    if (support < defaults.concept_relation_min_support) continue;
    const [source, target] = key.split('::');
    const denominator = Math.min(conceptById.get(source)?.card_count || 0, conceptById.get(target)?.card_count || 0);
    if (!denominator) continue;
    candidates.push({
      source,
      target,
      type: 'co_occurs_with',
      support,
      weight: Number((support / denominator).toFixed(6))
    });
  }
  candidates.sort((a, b) => b.weight - a.weight || b.support - a.support || (a.source + a.target).localeCompare(b.source + b.target));
  const degree = new Map();
  const conceptRelations = [];
  for (const edge of candidates) {
    const left = degree.get(edge.source) || 0;
    const right = degree.get(edge.target) || 0;
    if (left >= defaults.concept_relation_top_k || right >= defaults.concept_relation_top_k) continue;
    conceptRelations.push(edge);
    degree.set(edge.source, left + 1);
    degree.set(edge.target, right + 1);
  }
  conceptRelations.sort((a, b) => (a.source + a.target).localeCompare(b.source + b.target));

  const configHash = hashValue({ extraction: defaults, promoted_concepts: promoted });
  return {
    ...commonMeta({
      engineSha,
      sourceSha,
      generatedAt,
      generator: 'knowledge-card-concept-builder-v1',
      inputHash: hashValue(cards.map((card) => ({
        id: card.data.id,
        categories: effectiveList(card.data?.classification?.categories),
        tags: effectiveList(card.data?.classification?.tags)
      }))),
      configHash
    }),
    method: CONCEPT_METHOD,
    concepts: conceptList,
    card_concepts: cardConcepts,
    concept_relations: conceptRelations,
    stats: {
      concepts: conceptList.length,
      card_concepts: cardConcepts.length,
      concept_relations: conceptRelations.length
    }
  };
}

function projectVector(vector) {
  let x = 0;
  let y = 0;
  for (let index = 0; index < vector.length; index += 1) {
    x += vector[index] * Math.sin((index + 1) * 12.9898);
    y += vector[index] * Math.cos((index + 1) * 78.233);
  }
  return { x, y };
}

function normalizePositions(raw) {
  let max = 0;
  for (const item of raw.values()) max = Math.max(max, Math.abs(item.x), Math.abs(item.y));
  const scale = max || 1;
  return new Map([...raw].map(([id, value]) => [id, {
    x: Number((value.x / scale).toFixed(6)),
    y: Number((value.y / scale).toFixed(6))
  }]));
}

function nearestNeighbors(vectorIndex, limit = 5) {
  const result = {};
  for (const entry of vectorIndex.entries || []) {
    const values = [];
    for (const other of vectorIndex.entries || []) {
      if (entry.card_id === other.card_id) continue;
      const similarity = cosineSimilarity(entry.vector, other.vector);
      values.push({
        card_id: other.card_id,
        similarity: Number(similarity.toFixed(6)),
        distance: Number((1 - similarity).toFixed(6))
      });
    }
    values.sort((a, b) => b.similarity - a.similarity || a.card_id.localeCompare(b.card_id));
    result[entry.card_id] = values.slice(0, limit);
  }
  return result;
}

export function buildGraphProjection(cards, vectorIndex, relationIndex, conceptIndex, {
  engineSha,
  sourceSha,
  generatedAt
}) {
  const rawCardPositions = new Map((vectorIndex.entries || []).map((entry) => [entry.card_id, projectVector(entry.vector)]));
  const cardPositions = normalizePositions(rawCardPositions);
  const cardById = new Map(cards.map((card) => [card.data.id, card]));
  const conceptMemberships = new Map();
  for (const edge of conceptIndex.card_concepts || []) {
    if (!conceptMemberships.has(edge.concept_id)) conceptMemberships.set(edge.concept_id, []);
    conceptMemberships.get(edge.concept_id).push(edge);
  }

  const nodes = [];
  for (const [id, position] of [...cardPositions].sort(([a], [b]) => a.localeCompare(b))) {
    const card = cardById.get(id);
    nodes.push({
      id: 'card:' + id,
      entity_id: id,
      kind: 'card',
      label: card?.data?.title || id,
      x: position.x,
      y: position.y
    });
  }
  for (const concept of conceptIndex.concepts || []) {
    const memberships = conceptMemberships.get(concept.id) || [];
    let x = 0;
    let y = 0;
    let weight = 0;
    for (const membership of memberships) {
      const position = cardPositions.get(membership.card_id);
      if (!position) continue;
      x += position.x * membership.strength;
      y += position.y * membership.strength;
      weight += membership.strength;
    }
    nodes.push({
      id: 'concept:' + concept.id,
      entity_id: concept.id,
      kind: 'concept',
      label: concept.label,
      x: Number(((weight ? x / weight : 0)).toFixed(6)),
      y: Number(((weight ? y / weight : 0)).toFixed(6))
    });
  }

  const edges = [
    ...(relationIndex.edges || []).map((edge) => ({
      id: 'card-card:' + edge.pair_id,
      kind: 'card-card',
      source: 'card:' + edge.source,
      target: 'card:' + edge.target,
      relation_type: edge.type,
      direction: edge.direction,
      weight: edge.score,
      method: edge.method
    })),
    ...(conceptIndex.card_concepts || []).map((edge) => ({
      id: 'card-concept:' + edge.card_id + '::' + edge.concept_id,
      kind: 'card-concept',
      source: 'card:' + edge.card_id,
      target: 'concept:' + edge.concept_id,
      relation_type: 'supports',
      direction: 'source_to_target',
      weight: edge.strength,
      origin: edge.origin
    })),
    ...(conceptIndex.concept_relations || []).map((edge) => ({
      id: 'concept-concept:' + edge.source + '::' + edge.target,
      kind: 'concept-concept',
      source: 'concept:' + edge.source,
      target: 'concept:' + edge.target,
      relation_type: 'co_occurs_with',
      direction: 'undirected',
      weight: edge.weight,
      support: edge.support
    }))
  ].sort((a, b) => a.id.localeCompare(b.id));

  const configHash = hashValue({ layout: LAYOUT_METHOD, neighbor_limit: 5 });
  return {
    ...commonMeta({
      engineSha,
      sourceSha,
      generatedAt,
      generator: 'knowledge-card-graph-projection-v1',
      inputHash: hashValue({
        vectors: vectorIndex.input_hash,
        relations: relationIndex.input_hash,
        concepts: conceptIndex.input_hash
      }),
      configHash
    }),
    layout_method: LAYOUT_METHOD,
    nodes,
    edges,
    semantic_neighbors: nearestNeighbors(vectorIndex, 5)
  };
}

export async function buildGeneratedArtifacts(cards, {
  engineSha,
  sourceSha,
  generatedAt,
  relationConfig = {},
  relationOverrides = {},
  conceptConfig = {},
  previous = {},
  fullRebuild = false,
  embedTexts = null,
  classifyRelation = null
}) {
  const search = buildSearchIndex(cards, {
    engineSha,
    sourceSha,
    generatedAt,
    previous: fullRebuild ? null : previous.search
  });
  const vectors = await buildVectorIndex(cards, {
    engineSha,
    sourceSha,
    generatedAt,
    config: relationConfig,
    previous: fullRebuild ? null : previous.vectors,
    fullRebuild,
    embedTexts
  });
  const relations = await buildRelationIndex(cards, vectors, {
    engineSha,
    sourceSha,
    generatedAt,
    config: relationConfig,
    overrides: relationOverrides,
    previous: fullRebuild ? previous.relations : previous.relations,
    fullRebuild,
    classifyRelation
  });
  const concepts = buildConceptIndex(cards, {
    engineSha,
    sourceSha,
    generatedAt,
    config: conceptConfig
  });
  const graph = buildGraphProjection(cards, vectors, relations, concepts, {
    engineSha,
    sourceSha,
    generatedAt
  });
  return { search, vectors, relations, concepts, graph };
}

function assertCommonIndex(index, cards, label) {
  const errors = [];
  if (!index || index.schema_version !== GENERATED_SCHEMA_VERSION) errors.push(label + ' schema_version must be 1.');
  if (!/^[0-9a-f]{40}$/u.test(index?.engine_sha || '')) errors.push(label + ' engine_sha is invalid.');
  if (!/^[0-9a-f]{40}$/u.test(index?.source_sha || '')) errors.push(label + ' source_sha is invalid.');
  if (typeof index?.input_hash !== 'string' || !/^[0-9a-f]{64}$/u.test(index.input_hash)) errors.push(label + ' input_hash is invalid.');
  if (typeof index?.config_hash !== 'string' || !/^[0-9a-f]{64}$/u.test(index.config_hash)) errors.push(label + ' config_hash is invalid.');
  const cardIds = new Set(cards.map((card) => card.data.id));
  return { errors, cardIds };
}

export function validateGeneratedArtifacts(artifacts, cards) {
  const errors = [];
  for (const [name, index] of Object.entries(artifacts || {})) {
    errors.push(...assertCommonIndex(index, cards, name).errors);
  }
  const cardIds = new Set(cards.map((card) => card.data.id));

  const searchIds = new Set();
  for (const doc of artifacts?.search?.documents || []) {
    if (!cardIds.has(doc.id)) errors.push('search references unknown Card: ' + doc.id);
    if (searchIds.has(doc.id)) errors.push('search duplicates Card: ' + doc.id);
    searchIds.add(doc.id);
  }
  if (searchIds.size !== cardIds.size) errors.push('search must contain exactly one document per Card.');

  const vectorIds = new Set();
  const vectorDimensions = Number(artifacts?.vectors?.dimensions);
  if (!Number.isInteger(vectorDimensions) || vectorDimensions < 1) {
    errors.push('vectors dimensions must be a positive integer.');
  }
  if (typeof artifacts?.vectors?.provider !== 'string' || !artifacts.vectors.provider) {
    errors.push('vectors provider is required.');
  }
  for (const entry of artifacts?.vectors?.entries || []) {
    if (!cardIds.has(entry.card_id)) errors.push('vectors reference unknown Card: ' + entry.card_id);
    if (vectorIds.has(entry.card_id)) errors.push('vectors duplicate Card: ' + entry.card_id);
    if (!Array.isArray(entry.vector) || entry.vector.length !== vectorDimensions) {
      errors.push('vector dimensions invalid for Card: ' + entry.card_id);
    }
    vectorIds.add(entry.card_id);
  }
  if (vectorIds.size !== cardIds.size) errors.push('vectors must contain exactly one entry per Card.');

  const relationPairs = new Set();
  for (const edge of artifacts?.relations?.edges || []) {
    if (!cardIds.has(edge.source) || !cardIds.has(edge.target)) errors.push('relation references unknown Card.');
    if (edge.source === edge.target) errors.push('relation cannot self-reference: ' + edge.source);
    if (!RELATION_TYPES.has(edge.type)) errors.push('relation type is unsupported: ' + edge.type);
    if (relationPairs.has(edge.pair_id)) errors.push('relation pair is duplicated: ' + edge.pair_id);
    relationPairs.add(edge.pair_id);
    if (DIRECTIONAL_TYPES.has(edge.type) && !['source_to_target', 'target_to_source'].includes(edge.direction)) {
      errors.push('directional relation has invalid direction: ' + edge.pair_id);
    }
    if (!DIRECTIONAL_TYPES.has(edge.type) && edge.direction !== 'undirected') {
      errors.push('undirected relation has invalid direction: ' + edge.pair_id);
    }
    if (typeof edge.method !== 'string' || !edge.method) errors.push('relation method is required: ' + edge.pair_id);
    if (edge.classifier !== undefined && typeof edge.classifier !== 'string') {
      errors.push('relation classifier is invalid: ' + edge.pair_id);
    }
  }

  const conceptIds = new Set((artifacts?.concepts?.concepts || []).map((concept) => concept.id));
  for (const edge of artifacts?.concepts?.card_concepts || []) {
    if (!cardIds.has(edge.card_id)) errors.push('concept membership references unknown Card.');
    if (!conceptIds.has(edge.concept_id)) errors.push('concept membership references unknown Concept.');
    if (!Array.isArray(edge.evidence) || !edge.evidence.length) errors.push('concept membership must include evidence.');
    if (!(edge.strength >= 0 && edge.strength <= 1)) errors.push('concept membership strength must be between 0 and 1.');
  }
  for (const edge of artifacts?.concepts?.concept_relations || []) {
    if (edge.type !== 'co_occurs_with') errors.push('Concept relation must use co_occurs_with.');
    if (edge.source === edge.target) errors.push('Concept relation cannot self-reference.');
    if (!conceptIds.has(edge.source) || !conceptIds.has(edge.target)) errors.push('Concept relation references unknown Concept.');
    if (!Number.isInteger(edge.support) || edge.support < 1) errors.push('Concept relation support must be a positive integer.');
    if (!(edge.weight >= 0 && edge.weight <= 1)) errors.push('Concept relation weight must be between 0 and 1.');
  }

  const graphNodeIds = new Set((artifacts?.graph?.nodes || []).map((node) => node.id));
  for (const edge of artifacts?.graph?.edges || []) {
    if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)) errors.push('graph edge references unknown node: ' + edge.id);
  }

  const sourceShas = new Set(Object.values(artifacts || {}).map((value) => value?.source_sha));
  const engineShas = new Set(Object.values(artifacts || {}).map((value) => value?.engine_sha));
  if (sourceShas.size !== 1) errors.push('generated artifacts do not share one source_sha.');
  if (engineShas.size !== 1) errors.push('generated artifacts do not share one engine_sha.');

  return errors;
}

function fieldScore(field, queryTokens) {
  let score = 0;
  let matched = false;
  for (const token of queryTokens) {
    const count = field?.terms?.[token] || 0;
    if (count) {
      score += 1 + Math.log(count);
      matched = true;
    } else if (field?.text?.includes(token)) {
      score += 0.35;
      matched = true;
    }
  }
  return { score, matched };
}

export function searchGeneratedIndex(index, query, { limit = 20 } = {}) {
  const safeLimit = Number(limit);
  if (!Number.isInteger(safeLimit) || safeLimit < 1 || safeLimit > 100) {
    throw new TypeError('search limit must be an integer between 1 and 100.');
  }
  const normalized = normalizeSearchText(query);
  const queryTokens = uniqueSorted(tokenize(normalized));
  if (!queryTokens.length) return [];

  const weights = { title: 5, summary: 3, metadata: 2, body: 1 };
  const results = [];
  for (const doc of index?.documents || []) {
    let score = 0;
    const matchedFields = [];
    for (const [fieldName, weight] of Object.entries(weights)) {
      const result = fieldScore(doc.fields?.[fieldName], queryTokens);
      if (result.matched) matchedFields.push(fieldName);
      score += result.score * weight;
    }
    if (doc.fields?.title?.text?.includes(normalized)) score += 4;
    if (doc.fields?.summary?.text?.includes(normalized)) score += 2;
    if (score <= 0) continue;
    results.push({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      canonical_url: doc.canonical_url,
      resource_kind: doc.resource_kind,
      navigation_categories: doc.navigation_categories,
      status: doc.status,
      updated_at: doc.updated_at,
      score: Number(score.toFixed(6)),
      matched_fields: matchedFields
    });
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return results.slice(0, safeLimit);
}
