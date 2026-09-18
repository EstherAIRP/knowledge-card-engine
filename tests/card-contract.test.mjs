import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  compareUserOwnedState,
  effectiveOwnershipValue,
  effectiveRelevance,
  loadCardDocuments,
  loadTaxonomyFile,
  parseCardDocument,
  resolveCardWritePath,
  suggestedCardPath,
  validateCard,
  validateCardCollection,
  validateTaxonomy
} from '../packages/core/src/index.js';

const fixtureRoot = path.resolve('examples/synthetic-workspace');
const taxonomyPath = path.join(fixtureRoot, 'config/taxonomy.yaml');
const cardsRoot = path.join(fixtureRoot, 'content/knowledge');

async function fixture() {
  const taxonomy = await loadTaxonomyFile(taxonomyPath);
  const cards = await loadCardDocuments(cardsRoot);
  return { taxonomy, cards, card: cards[0] };
}

test('synthetic taxonomy and Card collection pass', async () => {
  const current = await fixture();
  assert.deepEqual(await validateTaxonomy(current.taxonomy), []);
  assert.deepEqual(await validateCardCollection(current.cards, current.taxonomy), []);
  assert.equal(current.cards.length, 1);
});

test('effective ownership uses user ?? ai and relevance overrides per dimension', () => {
  assert.equal(effectiveOwnershipValue({ ai: 'project', user: null }), 'project');
  assert.equal(effectiveOwnershipValue({ ai: 'project', user: 'article' }), 'article');
  assert.deepEqual(
    effectiveRelevance({ ai: { overall: 3, engineering: 4 }, user: { overall: 5 } }),
    { overall: 5, engineering: 4 }
  );
});

test('ownership comparison allows AI fields but protects stable fields, overrides, and notes', async () => {
  const current = await fixture();
  const card = current.card;

  const aiOnly = structuredClone(card);
  aiOnly.filePath = '<ai-update>';
  aiOnly.data = structuredClone(card.data);
  aiOnly.data.summary = 'Updated synthetic AI summary.';
  assert.deepEqual(compareUserOwnedState(card, aiOnly), []);

  const changedId = structuredClone(card);
  changedId.filePath = '<changed-id>';
  changedId.data = structuredClone(card.data);
  changedId.data.id = 'changed-id';
  assert.ok(compareUserOwnedState(card, changedId).some((item) => item.path === 'id'));

  const changedOverride = structuredClone(card);
  changedOverride.filePath = '<changed-override>';
  changedOverride.data = structuredClone(card.data);
  changedOverride.data.resource_kind.user = 'article';
  assert.ok(compareUserOwnedState(card, changedOverride).some((item) => item.path === 'resource_kind.user'));

  const changedNotes = parseCardDocument(
    card.raw.replace('Synthetic user-owned note. Tests must preserve this text.', 'Changed user note.'),
    '<changed-notes>'
  );
  assert.ok(compareUserOwnedState(card, changedNotes).some((item) => item.code === 'CARD_USER_NOTES_CHANGED'));
});

test('taxonomy rejects controlled values and relevance dimension drift', async () => {
  const current = await fixture();

  const invalidKind = structuredClone(current.card);
  invalidKind.data = structuredClone(current.card.data);
  invalidKind.data.resource_kind.ai = 'not-allowed';
  assert.ok((await validateCard(invalidKind, current.taxonomy)).some((item) => item.code === 'TAXONOMY_VALUE_INVALID'));

  const missingDimension = structuredClone(current.card);
  missingDimension.data = structuredClone(current.card.data);
  missingDimension.data.relevance.ai = { overall: 3 };
  assert.ok((await validateCard(missingDimension, current.taxonomy)).some((item) => item.code === 'TAXONOMY_DIMENSIONS_MISMATCH'));

  const unknownUserDimension = structuredClone(current.card);
  unknownUserDimension.data = structuredClone(current.card.data);
  unknownUserDimension.data.relevance.user = { secret: 5 };
  assert.ok((await validateCard(unknownUserDimension, current.taxonomy)).some((item) => item.code === 'TAXONOMY_DIMENSION_INVALID'));
});

test('Card structural schema rejects missing required fields', async () => {
  const current = await fixture();
  const invalid = structuredClone(current.card);
  invalid.data = structuredClone(current.card.data);
  delete invalid.data.summary;
  assert.ok((await validateCard(invalid, current.taxonomy)).some((item) => item.code === 'SCHEMA_REQUIRED'));
});

test('body contract rejects missing sections and H1 mismatch', async () => {
  const current = await fixture();
  const missing = parseCardDocument(current.card.raw.replace('## 技術亮點', '## Removed'), '<missing-section>');
  assert.ok((await validateCard(missing, current.taxonomy)).some((item) => item.code === 'CARD_SECTION_MISSING'));

  const titleMismatch = parseCardDocument(current.card.raw.replace('# Synthetic Example Project', '# Different Title'), '<title-mismatch>');
  assert.ok((await validateCard(titleMismatch, current.taxonomy)).some((item) => item.code === 'CARD_H1_TITLE_MISMATCH'));
});

test('body contract rejects canonical section order changes', async () => {
  const current = await fixture();
  const marker = '## 它解決什麼問題';
  const next = '## 核心概念';
  let raw = current.card.raw.replace(marker, '## TEMP-SECTION');
  raw = raw.replace(next, marker);
  raw = raw.replace('## TEMP-SECTION', next);
  const wrongOrder = parseCardDocument(raw, '<wrong-order>');
  assert.ok((await validateCard(wrongOrder, current.taxonomy)).some((item) => item.code === 'CARD_SECTION_ORDER'));
});

test('collection validation rejects duplicate id, source identity, and canonical URL', async () => {
  const current = await fixture();
  const copy = structuredClone(current.card);
  copy.filePath = '<copy>';
  const issues = await validateCardCollection([current.card, copy], current.taxonomy);
  assert.equal(issues.filter((item) => item.code === 'CARD_DUPLICATE').length, 3);
});

test('date ordering is enforced', async () => {
  const current = await fixture();
  const invalid = structuredClone(current.card);
  invalid.data = structuredClone(current.card.data);
  invalid.data.updated_at = '2026-09-17';
  invalid.data.last_checked_at = '2026-09-17';
  const issues = await validateCard(invalid, current.taxonomy);
  assert.equal(issues.filter((item) => item.code === 'CARD_DATE_ORDER').length, 2);
});

test('stable path helper uses created year and preserves an existing path', async () => {
  const current = await fixture();
  assert.equal(suggestedCardPath(current.card.data), 'content/knowledge/2026/synthetic-example-project.md');
  assert.equal(resolveCardWritePath('content/knowledge/2025/original.md', current.card.data), 'content/knowledge/2025/original.md');
});
