import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadCardDocuments } from '../packages/core/src/index.js';
import { applyTagMigrationPlan } from '../packages/workspace/src/tag-migration.js';

async function temporaryWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-tag-migration-'));
  await fs.cp(path.resolve('tests/fixtures/synthetic-workspace'), root, { recursive: true });
  return root;
}

function plan(from = ['contract-test', 'synthetic']) {
  return {
    schema_version: 1,
    cards: {
      'synthetic-example-project': {
        from: { ai: from, user: null },
        to: { ai: ['contract-test', 'tag-governance'], user: null }
      }
    }
  };
}

test('tag migration dry-run resolves aliases without changing the Workspace', async (t) => {
  const root = await temporaryWorkspace();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const before = await loadCardDocuments(path.join(root, 'content/knowledge'));
  const result = await applyTagMigrationPlan(root, plan());
  const after = await loadCardDocuments(path.join(root, 'content/knowledge'));

  assert.deepEqual(result, {
    mode: 'dry-run',
    card_count: 1,
    planned_count: 1,
    changed_count: 1
  });
  assert.deepEqual(after[0].data.classification.tags, before[0].data.classification.tags);
});

test('tag migration writes only a fully validated canonical tag state', async (t) => {
  const root = await temporaryWorkspace();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await applyTagMigrationPlan(root, plan(), { write: true });
  const cards = await loadCardDocuments(path.join(root, 'content/knowledge'));

  assert.equal(result.changed_count, 1);
  assert.deepEqual(cards[0].data.classification.tags, {
    ai: ['contract-test', 'tag-governance'],
    user: null
  });
});

test('tag migration rejects stale plans and incomplete candidate collections', async (t) => {
  const root = await temporaryWorkspace();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    applyTagMigrationPlan(root, plan(['stale-tag'])),
    (error) => error.code === 'TAG_MIGRATION_STALE'
  );

  const invalid = plan();
  invalid.cards['synthetic-example-project'].to.ai = ['contract-testing'];
  await assert.rejects(
    applyTagMigrationPlan(root, invalid),
    (error) => error.code === 'TAG_MIGRATION_VALIDATION_FAILED'
  );
});
