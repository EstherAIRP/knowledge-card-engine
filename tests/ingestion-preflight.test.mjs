import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveIngestionPreflightTarget } from '../packages/ingestion/src/preflight.js';

function card(filePath, { id, identity, canonicalUrl }) {
  return {
    filePath,
    data: {
      id,
      source: { identity },
      canonical_url: canonicalUrl
    }
  };
}

test('GitHub preflight resolves an existing Card by deterministic source identity before research', () => {
  const cards = [card('/workspace/content/knowledge/2026/github-example-tool.md', {
    id: 'github-example-tool',
    identity: 'github:example/tool',
    canonicalUrl: 'https://github.com/Example/Tool'
  })];

  const target = resolveIngestionPreflightTarget(cards, 'https://github.com/example/tool/tree/main/docs');
  assert.equal(target.resolved, true);
  assert.equal(target.mode, 'update');
  assert.equal(target.source_identity, 'github:example/tool');
  assert.equal(target.card_id, 'github-example-tool');
  assert.equal(target.card_path, '/workspace/content/knowledge/2026/github-example-tool.md');
});

test('GitHub preflight returns create when no identity or canonical URL exists', () => {
  const target = resolveIngestionPreflightTarget([], 'https://github.com/example/new-tool');
  assert.equal(target.resolved, true);
  assert.equal(target.mode, 'create');
  assert.equal(target.card_id, 'github-example-new-tool');
  assert.equal(target.card_path, null);
});

test('preflight fails closed when identity and canonical URL point at different Cards', () => {
  const cards = [
    card('/a.md', {
      id: 'a',
      identity: 'github:example/tool',
      canonicalUrl: 'https://github.com/other/a'
    }),
    card('/b.md', {
      id: 'b',
      identity: 'github:other/b',
      canonicalUrl: 'https://github.com/example/tool'
    })
  ];

  assert.throws(
    () => resolveIngestionPreflightTarget(cards, 'https://github.com/example/tool'),
    (error) => error.code === 'INGESTION_IDENTITY_CONFLICT'
  );
});

test('Threads share preflight stays unresolved until provider evidence resolves the root post', () => {
  const target = resolveIngestionPreflightTarget([], 'https://www.threads.com/share/ABC123/');
  assert.equal(target.provider, 'threads');
  assert.equal(target.resolved, false);
  assert.equal(target.mode, 'unresolved');
  assert.equal(target.source_identity, null);
});
