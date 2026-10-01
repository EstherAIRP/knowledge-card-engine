import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOKEN_HASH_VECTOR_METHOD,
  buildRelationIndex,
  buildVectorIndex,
  cosineSimilarity
} from '../packages/graph/src/index.js';
import {
  buildEmbeddingText,
  normalizeSemanticSimilarity,
  scoreTaxonomyPair
} from '../packages/graph/src/semantic-relations.js';

const ENGINE_SHA = 'a'.repeat(40);
const SOURCE_SHA = 'b'.repeat(40);
const GENERATED_AT = '2026-10-01T00:00:00.000Z';

function card(id, {
  title = id,
  summary = '',
  categories = [],
  tags = [],
  navigation = ['Agent / Harness'],
  actions = ['LEARN'],
  relevance = {},
  sections = {}
} = {}) {
  const data = {
    id,
    title,
    summary,
    canonical_url: 'https://example.test/' + id,
    source: { type: 'github', url: 'https://example.test/' + id, identity: 'github:example/' + id },
    resource_kind: { ai: 'project', user: null },
    created_at: '2026-10-01',
    updated_at: '2026-10-01',
    last_checked_at: '2026-10-01',
    navigation: { categories: { ai: navigation, user: null } },
    classification: {
      categories: { ai: categories, user: null },
      tags: { ai: tags, user: null }
    },
    relevance: { ai: relevance, user: {} },
    actions: { ai: actions, user: null },
    status: { ai: 'active', user: null }
  };
  const text = (heading, fallback) => sections[heading] ?? fallback;
  const body = [
    '# ' + title,
    '',
    '## 一句話介紹',
    '',
    text('一句話介紹', summary || title),
    '',
    '## 它解決什麼問題',
    '',
    text('它解決什麼問題', 'problem'),
    '',
    '## 核心概念',
    '',
    text('核心概念', 'core'),
    '',
    '## 架構與技術',
    '',
    text('架構與技術', 'architecture'),
    '',
    '## 主要功能',
    '',
    text('主要功能', 'features'),
    '',
    '## 技術亮點',
    '',
    text('技術亮點', 'highlights'),
    '',
    '## 限制與風險',
    '',
    text('限制與風險', 'risks'),
    '',
    '## 與你的相關性',
    '',
    text('與你的相關性', 'relevance'),
    '',
    '## 建議怎麼使用',
    '',
    text('建議怎麼使用', 'usage'),
    '',
    '## 與其他收藏的關聯',
    '',
    text('與其他收藏的關聯', 'relations'),
    '',
    '## 使用者備註',
    '',
    'private note',
    '',
    '## 更新紀錄',
    '',
    '- fixture'
  ].join('\n');
  return { data, body, raw: JSON.stringify(data) + '\n' + body };
}

function localConfig(model = 'Xenova/multilingual-e5-small') {
  return {
    candidate: {
      min_taxonomy_score: 0.08,
      top_k: 12,
      fallback_top_k: 3
    },
    semantic: {
      enabled: true,
      provider: 'local-transformers',
      model,
      dimensions: 384,
      batch_size: 16,
      normalization_floor: 0.70,
      normalization_ceiling: 0.95,
      min_score: 0.20
    },
    classifier: {
      enabled: false
    },
    scoring: {
      taxonomy_weight: 0.40,
      semantic_weight: 0.60,
      llm_weight: 0.35,
      min_combined_score: 0.30,
      fallback_min_combined_score: 0.48
    }
  };
}

function unitVector(dimensions, index) {
  const vector = Array.from({ length: dimensions }, () => 0);
  vector[index] = 1;
  return vector;
}

test('V1 embedding text ignores navigation and only includes selected semantic sections', () => {
  const first = card('alpha', {
    title: 'Alpha',
    summary: 'summary',
    categories: ['Agent'],
    tags: ['memory'],
    navigation: ['Agent / Harness'],
    actions: ['LEARN'],
    relevance: { ai_rd: 5 },
    sections: {
      '一句話介紹': 'intro',
      '核心概念': 'core',
      '架構與技術': 'architecture',
      '技術亮點': 'highlight',
      '主要功能': 'must-not-be-in-embedding'
    }
  });
  const changedNavigation = card('alpha', {
    title: 'Alpha',
    summary: 'summary',
    categories: ['Agent'],
    tags: ['memory'],
    navigation: ['Research / Science'],
    actions: ['LEARN'],
    relevance: { ai_rd: 5 },
    sections: {
      '一句話介紹': 'intro',
      '核心概念': 'core',
      '架構與技術': 'architecture',
      '技術亮點': 'highlight',
      '主要功能': 'different-but-still-not-in-embedding'
    }
  });

  const text = buildEmbeddingText(first);
  assert.match(text, /Title: Alpha/u);
  assert.match(text, /Categories: Agent/u);
  assert.match(text, /Relevance: ai_rd=5/u);
  assert.match(text, /核心概念: core/u);
  assert.doesNotMatch(text, /Agent \/ Harness/u);
  assert.doesNotMatch(text, /must-not-be-in-embedding/u);
  assert.equal(buildEmbeddingText(changedNavigation), text);
});

test('V1 taxonomy score restores category tag relevance and action weights', () => {
  const left = card('left', {
    categories: ['Agent'],
    tags: ['memory'],
    actions: ['LEARN'],
    relevance: { ai_rd: 5 }
  });
  const right = card('right', {
    categories: ['Agent'],
    tags: ['memory'],
    actions: ['LEARN'],
    relevance: { ai_rd: 4 }
  });
  const score = scoreTaxonomyPair(left, right);
  assert.equal(score.score, 1);
  assert.deepEqual(score.metrics, {
    categories: 1,
    tags: 1,
    relevance: 1,
    actions: 1
  });

  const categoryOnly = scoreTaxonomyPair(
    card('a', { categories: ['Agent'], actions: [] }),
    card('b', { categories: ['Agent'], actions: [] })
  );
  assert.equal(categoryOnly.score, 0.45);
});

test('multilingual E5 cosine normalization preserves the V1 0.70 to 0.95 range', () => {
  const config = localConfig();
  assert.equal(normalizeSemanticSimilarity(0.70, config), 0);
  assert.equal(normalizeSemanticSimilarity(0.825, config), 0.5);
  assert.equal(normalizeSemanticSimilarity(0.95, config), 1);
  assert.equal(normalizeSemanticSimilarity(0.99, config), 1);
  assert.equal(normalizeSemanticSimilarity(0.5, config), 0);
});

test('local vector cache reuses unchanged semantic inputs and invalidates on model change', async () => {
  const cards = [
    card('alpha', { summary: 'alpha' }),
    card('beta', { summary: 'beta' })
  ];
  let embedded = 0;
  const embedTexts = async (texts, { dimensions }) => {
    embedded += texts.length;
    return texts.map((_, index) => unitVector(dimensions, index));
  };

  const first = await buildVectorIndex(cards, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config: localConfig('model-a'),
    fullRebuild: true,
    embedTexts
  });
  assert.equal(first.provider, 'local-transformers');
  assert.equal(first.model, 'model-a');
  assert.equal(first.dimensions, 384);
  assert.equal(first.stats.rebuilt, 2);
  assert.equal(embedded, 2);

  const unchanged = await buildVectorIndex(cards, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config: localConfig('model-a'),
    previous: first,
    embedTexts: async () => {
      throw new Error('unchanged vectors should be reused');
    }
  });
  assert.equal(unchanged.stats.reused, 2);
  assert.equal(unchanged.stats.rebuilt, 0);

  let modelRebuilds = 0;
  const changedModel = await buildVectorIndex(cards, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config: localConfig('model-b'),
    previous: first,
    embedTexts: async (texts, { dimensions }) => {
      modelRebuilds += texts.length;
      return texts.map((_, index) => unitVector(dimensions, index + 2));
    }
  });
  assert.equal(changedModel.stats.reused, 0);
  assert.equal(changedModel.stats.rebuilt, 2);
  assert.equal(modelRebuilds, 2);
});

test('token hash remains available only as an explicit vector provider', async () => {
  const index = await buildVectorIndex([card('alpha')], {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config: {
      semantic: {
        provider: 'deterministic-token-hash',
        dimensions: 64
      }
    },
    fullRebuild: true
  });
  assert.equal(index.provider, 'deterministic-token-hash');
  assert.equal(index.method, TOKEN_HASH_VECTOR_METHOD);
  assert.equal(index.dimensions, 64);
  assert.equal(index.entries[0].vector.length, 64);
});

test('candidate discovery and fallback publication remain separate gates', async () => {
  const cards = [
    card('alpha', { actions: [] }),
    card('beta', { actions: [] }),
    card('gamma', { actions: [] })
  ];
  const betaAngle = Math.acos(0.90);
  const gammaAngle = Math.acos(0.85);
  const vectorIndex = {
    input_hash: '1'.repeat(64),
    provider: 'fixture',
    model: 'fixture',
    entries: [
      { card_id: 'alpha', input_hash: 'a'.repeat(64), vector: [1, 0] },
      { card_id: 'beta', input_hash: 'b'.repeat(64), vector: [Math.cos(betaAngle), Math.sin(betaAngle)] },
      { card_id: 'gamma', input_hash: 'c'.repeat(64), vector: [Math.cos(gammaAngle), Math.sin(gammaAngle)] }
    ]
  };
  const config = localConfig();
  const relations = await buildRelationIndex(cards, vectorIndex, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config
  });

  const alphaBeta = relations.classifications['alpha::beta'];
  const alphaGamma = relations.classifications['alpha::gamma'];
  assert.equal(alphaBeta.related, true);
  assert.equal(alphaGamma.related, false);
  assert.ok(relations.edges.some((edge) => edge.pair_id === 'alpha::beta'));
  assert.equal(relations.edges.some((edge) => edge.pair_id === 'alpha::gamma'), false);

  const betaEdge = relations.edges.find((edge) => edge.pair_id === 'alpha::beta');
  assert.equal(betaEdge.classifier, 'heuristic-fallback');
  assert.equal(betaEdge.type, 'complements');
  assert.equal(betaEdge.scores.semantic, 0.8);
  assert.equal(betaEdge.scores.combined, 0.48);
});

test('LLM classification cache is keyed by candidate evidence and reused', async () => {
  const cards = [
    card('alpha', { categories: ['Agent'], tags: ['memory'], relevance: { ai_rd: 5 } }),
    card('beta', { categories: ['Agent'], tags: ['memory'], relevance: { ai_rd: 5 } })
  ];
  const vectorIndex = {
    input_hash: '2'.repeat(64),
    provider: 'fixture',
    model: 'fixture',
    entries: [
      { card_id: 'alpha', input_hash: 'd'.repeat(64), vector: [1, 0] },
      { card_id: 'beta', input_hash: 'e'.repeat(64), vector: [1, 0] }
    ]
  };
  const config = localConfig();
  config.classifier = {
    enabled: true,
    provider: 'openai-compatible',
    base_url: 'https://example.invalid/v1',
    model: 'fixture-classifier',
    max_candidates_per_card: 6
  };

  let calls = 0;
  const classifyRelation = async () => {
    calls += 1;
    return {
      related: true,
      type: 'similar_to',
      direction: 'undirected',
      confidence: 0.91,
      reason: 'fixture relation',
      classifier: 'llm'
    };
  };

  const first = await buildRelationIndex(cards, vectorIndex, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config,
    classifyRelation
  });
  assert.equal(calls, 1);
  assert.equal(first.edges[0].classifier, 'llm');

  const second = await buildRelationIndex(cards, vectorIndex, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    config,
    previous: first,
    classifyRelation
  });
  assert.equal(calls, 1);
  assert.deepEqual(second.classifications, first.classifications);
});

test('cosine similarity remains dimension-agnostic for graph projection', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
});
