import assert from 'node:assert/strict';
import test from 'node:test';

const modules = [
  ['web', '../apps/web/src/index.js', 'app'],
  ['server', '../apps/server/src/index.js', 'app'],
  ['core', '../packages/core/src/index.js', 'package'],
  ['ingestion', '../packages/ingestion/src/index.js', 'package'],
  ['analysis', '../packages/analysis/src/index.js', 'package'],
  ['graph', '../packages/graph/src/index.js', 'package'],
  ['workspace', '../packages/workspace/src/index.js', 'package'],
  ['release', '../packages/release/src/index.js', 'package']
];

test('all declared engine module boundaries are importable and uniquely identified', async () => {
  const ids = new Set();
  for (const [expectedId, specifier, expectedKind] of modules) {
    const loaded = await import(specifier);
    assert.equal(loaded.moduleId, expectedId);
    assert.equal(loaded.moduleKind, expectedKind);
    assert.equal(ids.has(loaded.moduleId), false, `duplicate moduleId: ${loaded.moduleId}`);
    ids.add(loaded.moduleId);
  }
  assert.equal(ids.size, modules.length);
});
