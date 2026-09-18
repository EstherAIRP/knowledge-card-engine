import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  WorkspaceContractError,
  assertWorkflowPin,
  loadWorkspace,
  validateWorkspaceConfig
} from '../packages/workspace/src/index.js';

const fixtureRoot = path.resolve('examples/synthetic-workspace');

async function tempFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-workspace-'));
  await fs.cp(fixtureRoot, root, { recursive: true });
  return root;
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof WorkspaceContractError);
    assert.equal(error.code, code);
    return true;
  });
}

test('synthetic workspace loads from an explicit root', async () => {
  const loaded = await loadWorkspace(fixtureRoot);
  assert.equal(loaded.config.schema_version, 1);
  assert.equal(loaded.config.workspace_id, 'synthetic-example');
  assert.equal(loaded.engineLock.workspace_schema_version, 1);
  assert.equal(path.basename(loaded.paths.profile), 'profile');
});

test('workspace root is mandatory and never inferred from cwd', async () => {
  await expectCode(loadWorkspace(null), 'WORKSPACE_ROOT_REQUIRED');
});

test('unsupported workspace schema fails closed', async () => {
  const root = await tempFixture();
  try {
    const file = path.join(root, 'workspace.yaml');
    const text = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, text.replace('schema_version: 1', 'schema_version: 99'));
    await expectCode(loadWorkspace(root), 'WORKSPACE_SCHEMA_UNSUPPORTED');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('invalid engine commit fails closed', async () => {
  const root = await tempFixture();
  try {
    const file = path.join(root, 'engine.lock.json');
    const lock = JSON.parse(await fs.readFile(file, 'utf8'));
    lock.engine_commit = 'abc123';
    await fs.writeFile(file, JSON.stringify(lock, null, 2));
    await expectCode(loadWorkspace(root), 'ENGINE_LOCK_COMMIT_INVALID');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('engine lock workspace version must match workspace.yaml', async () => {
  const root = await tempFixture();
  try {
    const file = path.join(root, 'engine.lock.json');
    const lock = JSON.parse(await fs.readFile(file, 'utf8'));
    lock.workspace_schema_version = 2;
    await fs.writeFile(file, JSON.stringify(lock, null, 2));
    await expectCode(loadWorkspace(root), 'ENGINE_LOCK_WORKSPACE_SCHEMA_MISMATCH');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('workspace paths reject absolute, traversal and duplicate locations', () => {
  const base = {
    schema_version: 1,
    workspace_id: 'synthetic-example',
    paths: {
      profile: 'profile',
      projects: 'projects',
      knowledge: 'content/knowledge',
      config: 'config',
      state: 'state',
      data: 'data',
      releases: 'releases'
    }
  };
  assert.throws(
    () => validateWorkspaceConfig({ ...base, paths: { ...base.paths, profile: '/tmp/profile' } }),
    (error) => error.code === 'WORKSPACE_PATH_INVALID'
  );
  assert.throws(
    () => validateWorkspaceConfig({ ...base, paths: { ...base.paths, profile: '../profile' } }),
    (error) => error.code === 'WORKSPACE_PATH_INVALID'
  );
  assert.throws(
    () => validateWorkspaceConfig({ ...base, paths: { ...base.paths, projects: 'profile' } }),
    (error) => error.code === 'WORKSPACE_PATH_INVALID'
  );
});

test('expected engine pin must match the lock', async () => {
  await expectCode(
    loadWorkspace(fixtureRoot, {
      expectedEngineRepository: 'EstherAIRP/knowledge-card-engine',
      expectedEngineCommit: '2222222222222222222222222222222222222222'
    }),
    'ENGINE_LOCK_COMMIT_MISMATCH'
  );
});

test('workflow reusable pin must match engine.lock.json', async () => {
  const lock = {
    schema_version: 1,
    engine_repository: 'EstherAIRP/knowledge-card-engine',
    engine_commit: '1111111111111111111111111111111111111111',
    workspace_schema_version: 1
  };
  const valid = `jobs:
  validate:
    uses: EstherAIRP/knowledge-card-engine/.github/workflows/validate-workspace.yml@1111111111111111111111111111111111111111
`;
  assert.deepEqual(assertWorkflowPin(valid, lock), {
    repository: 'EstherAIRP/knowledge-card-engine',
    commit: lock.engine_commit
  });
  const invalid = valid.replace(/1{40}/, '2222222222222222222222222222222222222222');
  assert.throws(
    () => assertWorkflowPin(invalid, lock),
    (error) => error.code === 'WORKFLOW_PIN_COMMIT_MISMATCH'
  );
});

test('missing configured directory fails closed', async () => {
  const root = await tempFixture();
  try {
    await fs.rm(path.join(root, 'projects'), { recursive: true, force: true });
    await expectCode(loadWorkspace(root), 'WORKSPACE_PATH_MISSING');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
