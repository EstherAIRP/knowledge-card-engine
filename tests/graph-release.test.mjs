import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneratedArtifacts,
  searchGeneratedIndex,
  validateGeneratedArtifacts
} from '../packages/graph/src/index.js';
import {
  GENERATED_ARTIFACT_PATHS,
  createManifest,
  createReleaseDescription,
  createReleasePointer,
  serializeJson,
  validatePublishedCommit,
  validateReleaseBundle
} from '../packages/release/src/index.js';

const ENGINE_SHA = 'a'.repeat(40);
const SOURCE_SHA = 'b'.repeat(40);
const PUBLISHED_SHA = 'c'.repeat(40);
const GENERATED_AT = '2026-09-19T00:00:00.000Z';

function card(id, {
  title = id,
  summary = '',
  categories = [],
  tags = [],
  navigation = ['Agent / Harness'],
  bodyText = 'shared body text'
} = {}) {
  const data = {
    id,
    title,
    summary,
    canonical_url: 'https://example.test/' + id,
    source: { type: 'github', url: 'https://example.test/' + id, identity: 'github:example/' + id },
    resource_kind: { ai: 'project', user: null },
    created_at: '2026-09-19',
    updated_at: '2026-09-19',
    last_checked_at: '2026-09-19',
    navigation: { categories: { ai: navigation, user: null } },
    classification: {
      categories: { ai: categories, user: null },
      tags: { ai: tags, user: null }
    },
    relevance: { ai: { overall: 3 }, user: {} },
    actions: { ai: ['LEARN'], user: null },
    status: { ai: 'active', user: null }
  };
  const body = [
    '# ' + title,
    '',
    '## 一句話介紹',
    '',
    bodyText,
    '',
    '## 它解決什麼問題',
    '',
    bodyText,
    '',
    '## 核心概念',
    '',
    bodyText,
    '',
    '## 架構與技術',
    '',
    bodyText,
    '',
    '## 主要功能',
    '',
    bodyText,
    '',
    '## 技術亮點',
    '',
    bodyText,
    '',
    '## 限制與風險',
    '',
    bodyText,
    '',
    '## 與你的相關性',
    '',
    bodyText,
    '',
    '## 建議怎麼使用',
    '',
    bodyText,
    '',
    '## 與其他收藏的關聯',
    '',
    bodyText,
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

function build(cards, options = {}) {
  return buildGeneratedArtifacts(cards, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    generatedAt: GENERATED_AT,
    relationConfig: {
      min_score: 0.1,
      top_k: 8,
      taxonomy_weight: 0.4,
      vector_weight: 0.6
    },
    conceptConfig: {
      extraction: {
        minimum_tag_support: 2,
        concept_relation_min_support: 2,
        concept_relation_top_k: 8
      },
      promoted_concepts: [{
        id: 'agent-memory',
        label: 'Agent Memory',
        type: 'architecture',
        description: 'Memory architecture',
        match: {
          categories_any: ['RAG / Memory / Knowledge'],
          tags_any: ['agent-memory']
        }
      }]
    },
    ...options
  });
}

test('full rebuild is deterministic for fixed E S config and source timestamp', () => {
  const cards = [
    card('alpha', { title: 'Alpha Agent', categories: ['Agent'], tags: ['memory', 'agent-memory'] }),
    card('beta', { title: 'Beta Memory', categories: ['Agent', 'RAG / Memory / Knowledge'], tags: ['memory', 'agent-memory'] })
  ];
  assert.deepEqual(build(cards, { fullRebuild: true }), build(cards, { fullRebuild: true }));
});

test('incremental vector/search builders reuse unchanged Card records', () => {
  const firstCards = [
    card('alpha', { summary: 'first alpha', categories: ['Agent'], tags: ['memory'] }),
    card('beta', { summary: 'first beta', categories: ['Agent'], tags: ['memory'] })
  ];
  const first = build(firstCards);
  const secondCards = [
    firstCards[0],
    card('beta', { summary: 'changed beta', categories: ['Agent'], tags: ['memory'], bodyText: 'changed semantic body' })
  ];
  const second = build(secondCards, { previous: first });

  assert.equal(second.vectors.stats.reused, 1);
  assert.equal(second.vectors.stats.rebuilt, 1);
  assert.equal(second.search.stats.reused, 1);
  assert.equal(second.search.stats.rebuilt, 1);
});

test('navigation-only changes do not alter semantic relation or Concept payloads', () => {
  const base = [
    card('alpha', { categories: ['Agent'], tags: ['memory'] }),
    card('beta', { categories: ['Agent'], tags: ['memory'] })
  ];
  const changed = [
    card('alpha', { categories: ['Agent'], tags: ['memory'], navigation: ['Research / Science'] }),
    base[1]
  ];
  const before = build(base);
  const after = build(changed, { previous: before });

  assert.deepEqual(after.relations.edges, before.relations.edges);
  assert.deepEqual(after.concepts.concepts, before.concepts.concepts);
  assert.deepEqual(after.concepts.card_concepts, before.concepts.card_concepts);
  assert.deepEqual(after.concepts.concept_relations, before.concepts.concept_relations);
  assert.equal(after.vectors.stats.reused, 2);
});

test('manual blocked relation wins and pinned directional relation preserves direction', () => {
  const cards = [
    card('alpha', { categories: ['Agent'], tags: ['memory'] }),
    card('beta', { categories: ['Agent'], tags: ['memory'] }),
    card('gamma', { categories: ['Agent'], tags: ['memory'] })
  ];
  const artifacts = build(cards, {
    relationOverrides: {
      blocked: [{ source: 'alpha', target: 'beta' }],
      pinned: [{
        source: 'gamma',
        target: 'alpha',
        type: 'depends_on',
        direction: 'source_to_target',
        note: 'fixture'
      }]
    }
  });

  assert.equal(artifacts.relations.edges.some((edge) => edge.pair_id === 'alpha::beta'), false);
  const pinned = artifacts.relations.edges.find((edge) => edge.pair_id === 'alpha::gamma');
  assert.equal(pinned.source, 'gamma');
  assert.equal(pinned.target, 'alpha');
  assert.equal(pinned.type, 'depends_on');
  assert.equal(pinned.direction, 'source_to_target');
  assert.equal(pinned.method, 'manual_pinned');
});

test('Concept membership carries evidence and Concept relations never imply hierarchy or causality', () => {
  const cards = [
    card('alpha', { categories: ['RAG / Memory / Knowledge'], tags: ['agent-memory', 'memory'] }),
    card('beta', { categories: ['RAG / Memory / Knowledge'], tags: ['agent-memory', 'memory'] })
  ];
  const artifacts = build(cards);
  const promoted = artifacts.concepts.card_concepts.find((edge) => edge.concept_id === 'agent-memory');
  assert.ok(promoted);
  assert.ok(promoted.evidence.length > 0);
  assert.ok(artifacts.concepts.concept_relations.every((edge) => edge.type === 'co_occurs_with'));
});

test('private search index returns weighted matches without requiring public static assets', () => {
  const cards = [
    card('alpha', { title: 'Memory Agent', summary: 'long term memory', categories: ['Agent'], tags: ['memory'] }),
    card('beta', { title: 'Image Tool', summary: 'diffusion image workflow', categories: ['Image Generation'], tags: ['diffusion'] })
  ];
  const artifacts = build(cards);
  const results = searchGeneratedIndex(artifacts.search, 'memory agent', { limit: 10 });
  assert.equal(results[0].id, 'alpha');
  assert.ok(results[0].score > 0);
  assert.ok(results[0].matched_fields.includes('title'));
});

test('generated artifact validation enforces shared provenance and references', () => {
  const cards = [
    card('alpha', { categories: ['Agent'], tags: ['memory'] }),
    card('beta', { categories: ['Agent'], tags: ['memory'] })
  ];
  const artifacts = build(cards);
  assert.deepEqual(validateGeneratedArtifacts(artifacts, cards), []);

  const broken = structuredClone(artifacts);
  broken.graph.edges.push({
    id: 'broken',
    kind: 'card-card',
    source: 'card:missing',
    target: 'card:alpha'
  });
  assert.ok(validateGeneratedArtifacts(broken, cards).some((issue) => issue.includes('unknown node')));
});

test('release manifest freezes five artifacts and fails closed after byte mutation', () => {
  const cards = [
    card('alpha', { categories: ['Agent'], tags: ['memory'] }),
    card('beta', { categories: ['Agent'], tags: ['memory'] })
  ];
  const artifacts = build(cards);
  const artifactTexts = Object.fromEntries([
    ['data/search.json', serializeJson(artifacts.search)],
    ['data/vectors.json', serializeJson(artifacts.vectors)],
    ['data/relations.json', serializeJson(artifacts.relations)],
    ['data/concepts.json', serializeJson(artifacts.concepts)],
    ['data/graph.json', serializeJson(artifacts.graph)]
  ]);
  assert.deepEqual(Object.keys(artifactTexts), GENERATED_ARTIFACT_PATHS);

  const manifest = createManifest(artifactTexts, {
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    createdAt: GENERATED_AT
  });
  const release = createReleaseDescription({
    releaseId: 'release-fixture',
    engineSha: ENGINE_SHA,
    sourceSha: SOURCE_SHA,
    publishedSha: PUBLISHED_SHA,
    manifest,
    buildMode: 'incremental',
    createdAt: GENERATED_AT
  });
  const pointer = createReleasePointer({
    releaseId: 'release-fixture',
    updatedAt: GENERATED_AT
  });
  assert.equal(validateReleaseBundle({ pointer, release, artifactTexts }), true);

  const changed = { ...artifactTexts, 'data/search.json': artifactTexts['data/search.json'] + ' ' };
  assert.throws(
    () => validateReleaseBundle({ pointer, release, artifactTexts: changed }),
    /byte-size mismatch|SHA-256 mismatch/u
  );
});

test('P must equal S or be a direct S child containing only generated artifact paths', () => {
  assert.equal(validatePublishedCommit({
    sourceSha: SOURCE_SHA,
    publishedSha: SOURCE_SHA,
    changedPaths: []
  }).mode, 'source');

  assert.equal(validatePublishedCommit({
    sourceSha: SOURCE_SHA,
    publishedSha: PUBLISHED_SHA,
    parentSha: SOURCE_SHA,
    changedPaths: ['data/search.json', 'data/vectors.json']
  }).mode, 'generated-child');

  assert.throws(() => validatePublishedCommit({
    sourceSha: SOURCE_SHA,
    publishedSha: PUBLISHED_SHA,
    parentSha: 'd'.repeat(40),
    changedPaths: ['data/search.json']
  }), /parent must equal source_sha/u);

  assert.throws(() => validatePublishedCommit({
    sourceSha: SOURCE_SHA,
    publishedSha: PUBLISHED_SHA,
    parentSha: SOURCE_SHA,
    changedPaths: ['README.md']
  }), /outside the allowlist/u);
});
