import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import {
  loadCardDocuments,
  loadTaxonomyFile,
  validateCardCollection
} from '../packages/core/src/index.js';
import {
  buildGeneratedArtifacts,
  validateGeneratedArtifacts
} from '../packages/graph/src/index.js';
import {
  GENERATED_ARTIFACT_PATHS,
  RELEASE_POINTER_PATH,
  createManifest,
  createReleaseDescription,
  createReleasePointer,
  releaseDescriptionPath,
  serializeJson,
  validateReleaseBundle,
  validateReleaseDescription,
  validateReleasePointer
} from '../packages/release/src/index.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';

const ARTIFACT_KEYS = Object.freeze({
  'data/search.json': 'search',
  'data/vectors.json': 'vectors',
  'data/relations.json': 'relations',
  'data/concepts.json': 'concepts',
  'data/graph.json': 'graph'
});

function usage() {
  return [
    'Usage:',
    '  node scripts/release-workspace.mjs build <workspace> --engine-sha=<sha> --source-sha=<sha> --generated-at=<iso> [--mode=incremental|full]',
    '  node scripts/release-workspace.mjs finalize <workspace> --engine-sha=<sha> --source-sha=<sha> --published-sha=<sha> --release-id=<id> --created-at=<iso> --mode=incremental|full',
    '  node scripts/release-workspace.mjs validate <workspace>'
  ].join('\n');
}

function parseArgs(argv) {
  const [command, workspaceRoot, ...rest] = argv;
  const flags = new Map();
  for (const token of rest) {
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const equal = token.indexOf('=');
    if (equal === -1) throw new Error('Expected --name=value argument: ' + token);
    flags.set(token.slice(2, equal), token.slice(equal + 1));
  }
  return { command, workspaceRoot, flags };
}

function requiredFlag(flags, name) {
  const value = flags.get(name);
  if (!value) throw new Error('--' + name + ' is required.');
  return value;
}

async function readYamlOptional(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const value = parseYaml(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeJson(value), 'utf8');
}

async function loadValidatedWorkspace(workspaceRoot, expectedEngineCommit = null) {
  const workspace = await loadWorkspace(workspaceRoot, {
    expectedEngineRepository: 'EstherAIRP/knowledge-card-engine',
    expectedEngineCommit
  });
  const taxonomy = await loadTaxonomyFile(path.join(workspace.paths.config, 'taxonomy.yaml'));
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const issues = await validateCardCollection(cards, taxonomy);
  if (issues.length) {
    const error = new Error('Workspace Card collection validation failed with ' + issues.length + ' issue(s).');
    error.code = 'CARD_VALIDATION_FAILED';
    error.issues = issues;
    throw error;
  }
  return { workspace, taxonomy, cards };
}

async function commandBuild(workspaceRoot, flags) {
  const engineSha = requiredFlag(flags, 'engine-sha');
  const sourceSha = requiredFlag(flags, 'source-sha');
  const generatedAt = requiredFlag(flags, 'generated-at');
  const mode = flags.get('mode') || 'incremental';
  if (!['incremental', 'full'].includes(mode)) throw new Error('--mode must be incremental or full.');

  const { workspace, cards } = await loadValidatedWorkspace(workspaceRoot, engineSha);
  const [relationConfig, relationOverrides, conceptConfig] = await Promise.all([
    readYamlOptional(path.join(workspace.paths.config, 'relation-config.yaml')),
    readYamlOptional(path.join(workspace.paths.config, 'relation-overrides.yaml')),
    readYamlOptional(path.join(workspace.paths.config, 'concept-config.yaml'))
  ]);

  const previous = {};
  for (const [artifactPath, key] of Object.entries(ARTIFACT_KEYS)) {
    previous[key] = await readJsonOptional(path.join(workspace.root, artifactPath));
  }

  const artifacts = buildGeneratedArtifacts(cards, {
    engineSha,
    sourceSha,
    generatedAt,
    relationConfig,
    relationOverrides,
    conceptConfig,
    previous,
    fullRebuild: mode === 'full'
  });
  const issues = validateGeneratedArtifacts(artifacts, cards);
  if (issues.length) {
    const error = new Error('Generated artifact validation failed with ' + issues.length + ' issue(s).');
    error.code = 'GENERATED_DATA_INVALID';
    error.issues = issues;
    throw error;
  }

  for (const [artifactPath, key] of Object.entries(ARTIFACT_KEYS)) {
    await writeJson(path.join(workspace.root, artifactPath), artifacts[key]);
  }

  console.log(JSON.stringify({
    status: 'ok',
    mode,
    source_sha: sourceSha,
    engine_sha: engineSha,
    cards: cards.length,
    vector_stats: artifacts.vectors.stats,
    search_stats: artifacts.search.stats,
    artifacts: GENERATED_ARTIFACT_PATHS
  }, null, 2));
}

async function artifactTexts(workspace) {
  return Object.fromEntries(await Promise.all(
    GENERATED_ARTIFACT_PATHS.map(async (artifactPath) => [
      artifactPath,
      await fs.readFile(path.join(workspace.root, artifactPath), 'utf8')
    ])
  ));
}

async function commandFinalize(workspaceRoot, flags) {
  const engineSha = requiredFlag(flags, 'engine-sha');
  const sourceSha = requiredFlag(flags, 'source-sha');
  const publishedSha = requiredFlag(flags, 'published-sha');
  const releaseId = requiredFlag(flags, 'release-id');
  const createdAt = requiredFlag(flags, 'created-at');
  const buildMode = flags.get('mode') || 'incremental';
  const { workspace } = await loadValidatedWorkspace(workspaceRoot, engineSha);
  const texts = await artifactTexts(workspace);
  const manifest = createManifest(texts, {
    engineSha,
    sourceSha,
    createdAt
  });
  const release = createReleaseDescription({
    releaseId,
    engineSha,
    sourceSha,
    publishedSha,
    manifest,
    buildMode,
    createdAt
  });
  const pointer = createReleasePointer({
    releaseId,
    updatedAt: createdAt
  });
  validateReleaseBundle({ pointer, release, artifactTexts: texts });

  const descriptionRelative = releaseDescriptionPath(releaseId);
  await writeJson(path.join(workspace.root, descriptionRelative), release);
  await writeJson(path.join(workspace.root, RELEASE_POINTER_PATH), pointer);

  console.log(JSON.stringify({
    status: 'ok',
    release_id: releaseId,
    release_path: descriptionRelative,
    pointer_path: RELEASE_POINTER_PATH,
    engine_sha: engineSha,
    source_sha: sourceSha,
    published_sha: publishedSha,
    build_mode: buildMode
  }, null, 2));
}

async function commandValidate(workspaceRoot) {
  const { workspace } = await loadValidatedWorkspace(workspaceRoot);
  const pointerPath = path.join(workspace.root, RELEASE_POINTER_PATH);
  let pointer;
  try {
    pointer = JSON.parse(await fs.readFile(pointerPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(JSON.stringify({ status: 'ok', release: 'not-created' }, null, 2));
      return;
    }
    throw error;
  }
  validateReleasePointer(pointer);
  const release = JSON.parse(await fs.readFile(path.join(workspace.root, pointer.release_path), 'utf8'));
  validateReleaseDescription(release);
  const texts = await artifactTexts(workspace);
  validateReleaseBundle({ pointer, release, artifactTexts: texts });

  console.log(JSON.stringify({
    status: 'ok',
    release_id: release.release_id,
    engine_sha: release.engine_sha,
    source_sha: release.source_sha,
    published_sha: release.published_sha
  }, null, 2));
}

async function main() {
  const { command, workspaceRoot, flags } = parseArgs(process.argv.slice(2));
  if (!workspaceRoot || !['build', 'finalize', 'validate'].includes(command)) {
    console.error(usage());
    process.exit(2);
  }

  try {
    if (command === 'build') await commandBuild(workspaceRoot, flags);
    else if (command === 'finalize') await commandFinalize(workspaceRoot, flags);
    else await commandValidate(workspaceRoot);
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      code: error?.code || 'RELEASE_WORKSPACE_FAILED',
      message: error instanceof Error ? error.message : String(error),
      issues: Array.isArray(error?.issues) ? error.issues : undefined
    }, null, 2));
    process.exit(1);
  }
}

await main();
