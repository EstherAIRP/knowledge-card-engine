import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const moduleId = 'workspace';
export const moduleKind = 'package';

export const WORKSPACE_CONFIG_FILE = 'workspace.yaml';
export const ENGINE_LOCK_FILE = 'engine.lock.json';
export const SUPPORTED_WORKSPACE_SCHEMA_VERSIONS = Object.freeze([1]);
export const SUPPORTED_ENGINE_LOCK_SCHEMA_VERSIONS = Object.freeze([1]);
export const WORKSPACE_PATH_KEYS = Object.freeze([
  'profile',
  'projects',
  'knowledge',
  'config',
  'state',
  'data',
  'releases'
]);

const WORKSPACE_KEYS = new Set(['schema_version', 'workspace_id', 'paths']);
const ENGINE_LOCK_KEYS = new Set([
  'schema_version',
  'engine_repository',
  'engine_commit',
  'workspace_schema_version'
]);
const WORKSPACE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ENGINE_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ENGINE_SHA_PATTERN = /^[0-9a-f]{40}$/;

export class WorkspaceContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkspaceContractError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkspaceContractError(code, message);
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('WORKSPACE_CONTRACT_INVALID', `${name} must be an object.`);
  }
}

function assertExactKeys(value, allowed, required, name) {
  assertObject(value, name);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('WORKSPACE_CONTRACT_INVALID', `${name} contains unsupported key "${key}".`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      fail('WORKSPACE_CONTRACT_INVALID', `${name} is missing required key "${key}".`);
    }
  }
}

function normalizeRelativeWorkspacePath(value, key) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" must be a non-empty string.`);
  }
  if (value !== value.trim()) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" must not have surrounding whitespace.`);
  }
  if (value.includes('\\')) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" must use forward slashes.`);
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" must be relative.`);
  }
  const parts = value.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" contains an empty, "." or ".." segment.`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized.startsWith('../')) {
    fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" is not canonical.`);
  }
  return normalized;
}

export function validateWorkspaceConfig(value) {
  assertExactKeys(value, WORKSPACE_KEYS, WORKSPACE_KEYS, WORKSPACE_CONFIG_FILE);

  if (!Number.isInteger(value.schema_version) || !SUPPORTED_WORKSPACE_SCHEMA_VERSIONS.includes(value.schema_version)) {
    fail(
      'WORKSPACE_SCHEMA_UNSUPPORTED',
      `Unsupported workspace schema_version: ${value.schema_version ?? 'missing'}.`
    );
  }

  if (typeof value.workspace_id !== 'string' || !WORKSPACE_ID_PATTERN.test(value.workspace_id)) {
    fail(
      'WORKSPACE_ID_INVALID',
      'workspace_id must be 1-64 lowercase alphanumeric/hyphen characters and start with alphanumeric.'
    );
  }

  assertExactKeys(value.paths, new Set(WORKSPACE_PATH_KEYS), new Set(WORKSPACE_PATH_KEYS), 'workspace paths');
  const paths = {};
  const seen = new Set();
  for (const key of WORKSPACE_PATH_KEYS) {
    const relative = normalizeRelativeWorkspacePath(value.paths[key], key);
    if (seen.has(relative)) {
      fail('WORKSPACE_PATH_INVALID', `workspace path "${relative}" is assigned more than once.`);
    }
    seen.add(relative);
    paths[key] = relative;
  }

  return {
    schema_version: value.schema_version,
    workspace_id: value.workspace_id,
    paths
  };
}

export function validateEngineLock(value) {
  assertExactKeys(value, ENGINE_LOCK_KEYS, ENGINE_LOCK_KEYS, ENGINE_LOCK_FILE);

  if (!Number.isInteger(value.schema_version) || !SUPPORTED_ENGINE_LOCK_SCHEMA_VERSIONS.includes(value.schema_version)) {
    fail(
      'ENGINE_LOCK_SCHEMA_UNSUPPORTED',
      `Unsupported engine lock schema_version: ${value.schema_version ?? 'missing'}.`
    );
  }
  if (typeof value.engine_repository !== 'string' || !ENGINE_REPOSITORY_PATTERN.test(value.engine_repository)) {
    fail('ENGINE_LOCK_REPOSITORY_INVALID', 'engine_repository must use owner/repository form.');
  }
  if (typeof value.engine_commit !== 'string' || !ENGINE_SHA_PATTERN.test(value.engine_commit)) {
    fail('ENGINE_LOCK_COMMIT_INVALID', 'engine_commit must be a complete lowercase 40-character Git SHA.');
  }
  if (!Number.isInteger(value.workspace_schema_version) || value.workspace_schema_version < 1) {
    fail('ENGINE_LOCK_WORKSPACE_SCHEMA_INVALID', 'workspace_schema_version must be a positive integer.');
  }

  return {
    schema_version: value.schema_version,
    engine_repository: value.engine_repository,
    engine_commit: value.engine_commit,
    workspace_schema_version: value.workspace_schema_version
  };
}

function resolveWorkspacePaths(root, config) {
  const resolvedRoot = path.resolve(root);
  const result = {};
  for (const key of WORKSPACE_PATH_KEYS) {
    const absolute = path.resolve(resolvedRoot, config.paths[key]);
    const insideRoot = absolute.startsWith(`${resolvedRoot}${path.sep}`);
    if (!insideRoot) {
      fail('WORKSPACE_PATH_ESCAPE', `workspace path "${key}" escapes the workspace root.`);
    }
    result[key] = absolute;
  }
  return { root: resolvedRoot, paths: result };
}

async function assertWorkspaceDirectories(paths) {
  for (const [key, directory] of Object.entries(paths)) {
    let stat;
    try {
      stat = await fs.stat(directory);
    } catch (cause) {
      const error = new WorkspaceContractError(
        'WORKSPACE_PATH_MISSING',
        `workspace directory "${key}" does not exist.`
      );
      error.cause = cause;
      throw error;
    }
    if (!stat.isDirectory()) {
      fail('WORKSPACE_PATH_INVALID', `workspace path "${key}" must point to a directory.`);
    }
  }
}

export function assertEngineCompatibility(engineLock, {
  expectedEngineRepository = null,
  expectedEngineCommit = null
} = {}) {
  if (expectedEngineRepository !== null && engineLock.engine_repository !== expectedEngineRepository) {
    fail(
      'ENGINE_LOCK_REPOSITORY_MISMATCH',
      `engine repository mismatch: expected ${expectedEngineRepository}, received ${engineLock.engine_repository}.`
    );
  }
  if (expectedEngineCommit !== null && engineLock.engine_commit !== expectedEngineCommit) {
    fail(
      'ENGINE_LOCK_COMMIT_MISMATCH',
      `engine commit mismatch: expected ${expectedEngineCommit}, received ${engineLock.engine_commit}.`
    );
  }
  if (!SUPPORTED_WORKSPACE_SCHEMA_VERSIONS.includes(engineLock.workspace_schema_version)) {
    fail(
      'ENGINE_WORKSPACE_SCHEMA_UNSUPPORTED',
      `Engine does not support workspace schema_version ${engineLock.workspace_schema_version}.`
    );
  }
}

export function assertWorkflowPin(workflowText, engineLock) {
  if (typeof workflowText !== 'string' || !workflowText.trim()) {
    fail('WORKFLOW_PIN_MISSING', 'Workspace workflow content is required to validate the engine pin.');
  }
  const pattern = /^\s*uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/\.github\/workflows\/validate-workspace\.yml@([0-9a-f]{40})\s*$/gm;
  const matches = [...workflowText.matchAll(pattern)];
  if (matches.length !== 1) {
    fail(
      'WORKFLOW_PIN_INVALID',
      `Expected exactly one validate-workspace reusable workflow pin, found ${matches.length}.`
    );
  }
  const [, repository, commit] = matches[0];
  if (repository !== engineLock.engine_repository) {
    fail(
      'WORKFLOW_PIN_REPOSITORY_MISMATCH',
      `workflow engine repository mismatch: expected ${engineLock.engine_repository}, received ${repository}.`
    );
  }
  if (commit !== engineLock.engine_commit) {
    fail(
      'WORKFLOW_PIN_COMMIT_MISMATCH',
      `workflow engine commit mismatch: expected ${engineLock.engine_commit}, received ${commit}.`
    );
  }
  return { repository, commit };
}

export async function loadWorkspace(workspaceRoot, {
  expectedEngineRepository = null,
  expectedEngineCommit = null,
  requireDirectories = true
} = {}) {
  if (typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) {
    fail('WORKSPACE_ROOT_REQUIRED', 'An explicit workspace root path is required.');
  }

  const root = path.resolve(workspaceRoot);
  let workspaceRaw;
  let engineLockRaw;
  try {
    [workspaceRaw, engineLockRaw] = await Promise.all([
      fs.readFile(path.join(root, WORKSPACE_CONFIG_FILE), 'utf8'),
      fs.readFile(path.join(root, ENGINE_LOCK_FILE), 'utf8')
    ]);
  } catch (cause) {
    const error = new WorkspaceContractError(
      'WORKSPACE_FILES_MISSING',
      `Workspace root must contain ${WORKSPACE_CONFIG_FILE} and ${ENGINE_LOCK_FILE}.`
    );
    error.cause = cause;
    throw error;
  }

  let workspaceValue;
  let engineLockValue;
  try {
    workspaceValue = parseYaml(workspaceRaw);
  } catch (cause) {
    const error = new WorkspaceContractError('WORKSPACE_YAML_INVALID', 'workspace.yaml is not valid YAML.');
    error.cause = cause;
    throw error;
  }
  try {
    engineLockValue = JSON.parse(engineLockRaw);
  } catch (cause) {
    const error = new WorkspaceContractError('ENGINE_LOCK_JSON_INVALID', 'engine.lock.json is not valid JSON.');
    error.cause = cause;
    throw error;
  }

  const config = validateWorkspaceConfig(workspaceValue);
  const engineLock = validateEngineLock(engineLockValue);

  if (engineLock.workspace_schema_version !== config.schema_version) {
    fail(
      'ENGINE_LOCK_WORKSPACE_SCHEMA_MISMATCH',
      `engine lock expects workspace schema_version ${engineLock.workspace_schema_version}, received ${config.schema_version}.`
    );
  }

  assertEngineCompatibility(engineLock, { expectedEngineRepository, expectedEngineCommit });

  const resolved = resolveWorkspacePaths(root, config);
  if (requireDirectories) await assertWorkspaceDirectories(resolved.paths);

  return {
    root: resolved.root,
    config,
    engineLock,
    paths: resolved.paths
  };
}
