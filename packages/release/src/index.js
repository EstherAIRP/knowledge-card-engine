import { createHash } from 'node:crypto';

export const moduleId = 'release';
export const moduleKind = 'package';

export const RELEASE_SCHEMA_VERSION = 1;
export const GENERATED_ARTIFACT_PATHS = Object.freeze([
  'data/search.json',
  'data/vectors.json',
  'data/relations.json',
  'data/concepts.json',
  'data/graph.json'
]);
export const RELEASE_POINTER_PATH = 'releases/current.json';
export const RELEASE_DESCRIPTION_DIR = 'releases/by-id';

const RELEASE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function fail(message) {
  throw new TypeError(message);
}

function requireSha(value, label) {
  if (typeof value !== 'string' || !SHA40.test(value)) fail(label + ' must be a lowercase 40-character Git SHA.');
  return value;
}

function requireReleaseId(value) {
  if (typeof value !== 'string' || !RELEASE_ID.test(value)) fail('release_id is invalid.');
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(label + ' must be an ISO-compatible timestamp.');
  return value;
}

function parseArtifact(text, path) {
  let value;
  try {
    value = JSON.parse(String(text));
  } catch {
    fail('Release artifact is not valid JSON: ' + path);
  }
  if (!value || value.schema_version !== 1) fail('Release artifact schema_version must be 1: ' + path);
  return value;
}

export function sha256Bytes(value) {
  return createHash('sha256').update(Buffer.from(value)).digest('hex');
}

export function serializeJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

export function releaseDescriptionPath(releaseId) {
  return RELEASE_DESCRIPTION_DIR + '/' + requireReleaseId(releaseId) + '.json';
}

export function createManifest(artifactTexts, {
  engineSha,
  sourceSha,
  createdAt
}) {
  requireSha(engineSha, 'engine_sha');
  requireSha(sourceSha, 'source_sha');
  requireTimestamp(createdAt, 'created_at');

  const files = {};
  for (const path of GENERATED_ARTIFACT_PATHS) {
    const text = artifactTexts?.[path];
    if (typeof text !== 'string' || !text.length) fail('Missing release artifact: ' + path);
    const parsed = parseArtifact(text, path);
    if (parsed.engine_sha !== engineSha) fail('Artifact engine_sha mismatch: ' + path);
    if (parsed.source_sha !== sourceSha) fail('Artifact source_sha mismatch: ' + path);
    files[path] = {
      sha256: sha256Bytes(text),
      bytes: Buffer.byteLength(text, 'utf8'),
      schema_version: parsed.schema_version
    };
  }

  return {
    schema_version: RELEASE_SCHEMA_VERSION,
    engine_sha: engineSha,
    source_sha: sourceSha,
    created_at: createdAt,
    files
  };
}

export function validateManifest(manifest, artifactTexts, {
  engineSha = manifest?.engine_sha,
  sourceSha = manifest?.source_sha
} = {}) {
  if (!manifest || manifest.schema_version !== RELEASE_SCHEMA_VERSION) fail('Release manifest schema_version must be 1.');
  requireSha(manifest.engine_sha, 'manifest.engine_sha');
  requireSha(manifest.source_sha, 'manifest.source_sha');
  requireTimestamp(manifest.created_at, 'manifest.created_at');
  if (manifest.engine_sha !== engineSha) fail('Release manifest engine_sha mismatch.');
  if (manifest.source_sha !== sourceSha) fail('Release manifest source_sha mismatch.');

  const keys = Object.keys(manifest.files || {}).sort();
  const expected = [...GENERATED_ARTIFACT_PATHS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('Release manifest file set is invalid.');

  for (const path of GENERATED_ARTIFACT_PATHS) {
    const entry = manifest.files[path];
    if (!entry || !SHA256.test(entry.sha256 || '') || !Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.schema_version !== 1) {
      fail('Release manifest entry is invalid: ' + path);
    }
    const text = artifactTexts?.[path];
    if (typeof text !== 'string') fail('Missing release artifact for verification: ' + path);
    if (Buffer.byteLength(text, 'utf8') !== entry.bytes) fail('Release manifest byte-size mismatch: ' + path);
    if (sha256Bytes(text) !== entry.sha256) fail('Release manifest SHA-256 mismatch: ' + path);
    const parsed = parseArtifact(text, path);
    if (parsed.engine_sha !== manifest.engine_sha || parsed.source_sha !== manifest.source_sha) {
      fail('Release artifact provenance mismatch: ' + path);
    }
  }
  return true;
}

export function validatePublishedCommit({
  sourceSha,
  publishedSha,
  parentSha = null,
  changedPaths = []
}) {
  requireSha(sourceSha, 'source_sha');
  requireSha(publishedSha, 'published_sha');

  if (publishedSha === sourceSha) {
    if (changedPaths.length) fail('P = S requires no generated commit changes.');
    return { mode: 'source', source_sha: sourceSha, published_sha: publishedSha };
  }

  requireSha(parentSha, 'published parent_sha');
  if (parentSha !== sourceSha) fail('Published generated commit parent must equal source_sha.');
  if (!Array.isArray(changedPaths) || !changedPaths.length) fail('Generated commit must contain at least one changed artifact.');

  const allowed = new Set(GENERATED_ARTIFACT_PATHS);
  for (const path of changedPaths) {
    if (!allowed.has(path)) fail('Published generated commit changed a path outside the allowlist: ' + path);
  }

  return {
    mode: 'generated-child',
    source_sha: sourceSha,
    published_sha: publishedSha,
    changed_paths: [...changedPaths].sort()
  };
}

export function createReleaseDescription({
  releaseId,
  engineSha,
  sourceSha,
  publishedSha,
  manifest,
  buildMode,
  createdAt
}) {
  requireReleaseId(releaseId);
  requireSha(engineSha, 'engine_sha');
  requireSha(sourceSha, 'source_sha');
  requireSha(publishedSha, 'published_sha');
  requireTimestamp(createdAt, 'created_at');
  if (!['incremental', 'full'].includes(buildMode)) fail('build_mode must be incremental or full.');
  if (!manifest || manifest.engine_sha !== engineSha || manifest.source_sha !== sourceSha) {
    fail('Release manifest provenance does not match release description.');
  }

  return {
    schema_version: RELEASE_SCHEMA_VERSION,
    release_id: releaseId,
    engine_sha: engineSha,
    source_sha: sourceSha,
    published_sha: publishedSha,
    build_mode: buildMode,
    created_at: createdAt,
    manifest
  };
}

export function validateReleaseDescription(value) {
  if (!value || value.schema_version !== RELEASE_SCHEMA_VERSION) fail('Release description schema_version must be 1.');
  requireReleaseId(value.release_id);
  requireSha(value.engine_sha, 'release.engine_sha');
  requireSha(value.source_sha, 'release.source_sha');
  requireSha(value.published_sha, 'release.published_sha');
  requireTimestamp(value.created_at, 'release.created_at');
  if (!['incremental', 'full'].includes(value.build_mode)) fail('release.build_mode must be incremental or full.');
  if (!value.manifest || value.manifest.engine_sha !== value.engine_sha || value.manifest.source_sha !== value.source_sha) {
    fail('Release description manifest provenance mismatch.');
  }
  validateManifestShape(value.manifest);
  return value;
}

function validateManifestShape(manifest) {
  if (!manifest || manifest.schema_version !== 1) fail('Release manifest schema_version must be 1.');
  requireSha(manifest.engine_sha, 'manifest.engine_sha');
  requireSha(manifest.source_sha, 'manifest.source_sha');
  requireTimestamp(manifest.created_at, 'manifest.created_at');
  const keys = Object.keys(manifest.files || {}).sort();
  const expected = [...GENERATED_ARTIFACT_PATHS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('Release manifest file set is invalid.');
  for (const path of GENERATED_ARTIFACT_PATHS) {
    const entry = manifest.files[path];
    if (!entry || !SHA256.test(entry.sha256 || '') || !Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.schema_version !== 1) {
      fail('Release manifest entry is invalid: ' + path);
    }
  }
}

export function createReleasePointer({
  releaseId,
  updatedAt
}) {
  requireReleaseId(releaseId);
  requireTimestamp(updatedAt, 'updated_at');
  return {
    schema_version: RELEASE_SCHEMA_VERSION,
    release_id: releaseId,
    release_path: releaseDescriptionPath(releaseId),
    updated_at: updatedAt
  };
}

export function validateReleasePointer(value) {
  if (!value || value.schema_version !== RELEASE_SCHEMA_VERSION) fail('Release pointer schema_version must be 1.');
  requireReleaseId(value.release_id);
  requireTimestamp(value.updated_at, 'pointer.updated_at');
  const expected = releaseDescriptionPath(value.release_id);
  if (value.release_path !== expected) fail('Release pointer path does not match release_id.');
  return value;
}

export function validateReleaseBundle({
  pointer,
  release,
  artifactTexts
}) {
  validateReleasePointer(pointer);
  validateReleaseDescription(release);
  if (pointer.release_id !== release.release_id || pointer.release_path !== releaseDescriptionPath(release.release_id)) {
    fail('Release pointer does not identify the supplied release description.');
  }
  validateManifest(release.manifest, artifactTexts, {
    engineSha: release.engine_sha,
    sourceSha: release.source_sha
  });
  return true;
}

export function releasePublicProjection(release) {
  validateReleaseDescription(release);
  return {
    release_id: release.release_id,
    engine_sha: release.engine_sha,
    source_sha: release.source_sha,
    published_sha: release.published_sha,
    build_mode: release.build_mode,
    created_at: release.created_at,
    manifest: {
      schema_version: release.manifest.schema_version,
      files: Object.fromEntries(
        GENERATED_ARTIFACT_PATHS.map((path) => [path, {
          sha256: release.manifest.files[path].sha256,
          bytes: release.manifest.files[path].bytes,
          schema_version: release.manifest.files[path].schema_version
        }])
      )
    }
  };
}
