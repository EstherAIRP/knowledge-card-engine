import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorkspace } from '../packages/workspace/src/index.js';
import { loadCardDocuments, loadTaxonomyFile, validateCardCollection, parseCardDocument } from '../packages/core/src/index.js';
import { validateAcceptedSourceState } from '../packages/ingestion/src/index.js';
import { findCurrentOnlyDocumentationIssues } from './documentation-policy.mjs';

const root = process.cwd();
const requiredFiles = [
  'README.md',
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  'docs/index.md',
  'docs/architecture/overview.md',
  'docs/guides/development.md',
  'docs/guides/deployment.md',
  'docs/specs/workspace.md',
  'docs/specs/card.md',
  'docs/specs/ingestion.md',
  'docs/specs/analysis.md',
  'docs/specs/generated-data.md',
  'docs/specs/release.md',
  'docs/specs/private-site.md',
  'docs/specs/web-ui.md',
  'prompts/RUNTIME.md',
  'schema/workspace.schema.json',
  'schema/engine-lock.schema.json',
  'schema/knowledge-card.schema.json',
  'schema/taxonomy.schema.json',
  'schema/threads-continuation-judgement.schema.json',
  '.github/workflows/validate.yml',
  '.github/workflows/validate-workspace.yml',
  '.github/workflows/release-workspace.yml',
  '.github/workflows/ingest-workspace.yml',
  'scripts/ingest-github.mjs',
  'scripts/ingest-threads.mjs',
  'scripts/ingest-handoff.mjs',
  'scripts/ingest-github-handoff.mjs',
  'packages/ingestion/src/threads/resolve-url.js',
  'packages/ingestion/src/threads/normalize.js',
  'packages/ingestion/src/threads/extract-post.js',
  'packages/ingestion/src/threads/conversation.js',
  'packages/ingestion/src/github/research-pack.js',
  'scripts/validate-source-state.mjs',
  'scripts/validate-research-state.mjs',
  'scripts/release-workspace.mjs',
  'scripts/documentation-policy.mjs',
  'tests/documentation-policy.test.mjs',
  'tests/fixtures/synthetic-workspace/fixture.json',
  'tests/fixtures/synthetic-workspace/workspace.yaml',
  'tests/fixtures/synthetic-workspace/engine.lock.json',
  'tests/fixtures/synthetic-workspace/config/taxonomy.yaml',
  'tests/fixtures/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md',
  'tests/fixtures/synthetic-workspace/state/sources/github/example--synthetic-example.json',
  'tests/fixtures/synthetic-workspace/README.md',
  ...['profile', 'projects', 'data', 'releases'].map((name) => 'tests/fixtures/synthetic-workspace/' + name + '/README.md'),
  ...['web', 'server'].flatMap((name) => ['apps/' + name + '/package.json', 'apps/' + name + '/src/index.js']),
  'apps/web/src/graph-runtime.js',
  ...['index', 'tokens', 'base', 'layout', 'shared', 'radar', 'detail', 'search', 'graph'].map((name) => 'apps/web/src/styles/' + name + '.js'),
  ...['core', 'ingestion', 'analysis', 'graph', 'workspace', 'release'].flatMap((name) => [
    'packages/' + name + '/package.json',
    'packages/' + name + '/src/index.js'
  ]),
  'packages/workspace/src/card-store.js',
  'packages/workspace/src/research-state.js',
  'apps/server/.env.example',
  'apps/server/src/auth.js',
  'apps/server/src/config.js',
  'apps/server/src/github.js',
  'apps/server/src/http.js',
  'apps/server/src/session-store.js',
  'apps/server/src/workspace-reader.js',
  'apps/server/src/node-server.js',
  'tests/analysis-contract.test.mjs',
  'tests/github-research.test.mjs',
  'tests/github-research-pack.test.mjs',
  'tests/research-state.test.mjs',
  'tests/remote-ingestion.test.mjs',
  'tests/remote-research-e2e.test.mjs',
  'tests/fixtures/github-research-handoff-fetch.mjs',
  'tests/threads-ingestion.test.mjs',
  'tests/private-site.test.mjs',
  'tests/web-ui-layout.test.mjs',
  'tests/session-store.test.mjs',
  'tests/graph-release.test.mjs',
  'tests/release-reader.test.mjs',
  'api/site.js',
  'vercel.json'
];

const forbiddenPaths = [
  'docs/plans',
  'docs/archive',
  'docs/phases',
  'docs/roadmap.md',
  'ROADMAP.md',
  'CHANGELOG.md'
];

function listMarkdownFilesRecursively(directory, relativePrefix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const relative = relativePrefix + '/' + entry.name;
    if (entry.isDirectory()) return listMarkdownFilesRecursively(absolute, relative);
    return entry.isFile() && entry.name.endsWith('.md') ? [relative] : [];
  });
}

const documentationFiles = [
  'README.md',
  'AGENTS.md',
  ...listMarkdownFilesRecursively(path.join(root, 'docs'), 'docs'),
  'schema/README.md',
  'prompts/README.md',
  'prompts/RUNTIME.md',
  'defaults/README.md',
  ...['README.md', 'profile/README.md', 'projects/README.md', 'data/README.md', 'releases/README.md']
    .map((relative) => 'tests/fixtures/synthetic-workspace/' + relative)
];

const errors = [];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    errors.push('Missing required file: ' + relative);
  }
}

for (const relative of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relative))) {
    errors.push('Historical/planning path is not allowed in engine: ' + relative);
  }
}

for (const relative of documentationFiles) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const issue of findCurrentOnlyDocumentationIssues(relative, text)) {
    errors.push(
      'Current-only documentation [' + issue.code + '] ' +
      issue.path + ':' + issue.line + ': ' + issue.message +
      ' Matched: ' + JSON.stringify(issue.match)
    );
  }
}

const schemaReadmeText = fs.readFileSync(path.join(root, 'schema/README.md'), 'utf8');
const schemaFiles = fs.readdirSync(path.join(root, 'schema'))
  .filter((name) => name.endsWith('.schema.json'));
for (const schemaFile of schemaFiles) {
  if (!schemaReadmeText.includes('`' + schemaFile + '`')) {
    errors.push('Schema index is missing: ' + schemaFile);
  }
}

const releaseWorkflowText = fs.readFileSync(path.join(root, '.github/workflows/release-workspace.yml'), 'utf8');
const statusProbe = 'git status --porcelain=v1 --untracked-files=all';
const statusProbeCount = releaseWorkflowText.split(statusProbe).length - 1;
if (statusProbeCount < 2) {
  errors.push('Release workflow must detect untracked generated and release files before persistence.');
}
if (releaseWorkflowText.includes('git diff --name-only')) {
  errors.push('Release workflow must not use git diff --name-only as the persistence change detector because it ignores first-run untracked artifacts.');
}

try {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/synthetic-workspace/fixture.json'), 'utf8'));
  if (fixture.synthetic !== true) errors.push('Synthetic workspace fixture must declare synthetic=true.');
  if (fixture.contains_private_data !== false) errors.push('Synthetic workspace fixture must declare contains_private_data=false.');
} catch (error) {
  errors.push('Synthetic workspace fixture is invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
}

try {
  const workspace = await loadWorkspace(path.join(root, 'tests/fixtures/synthetic-workspace'));
  const taxonomy = await loadTaxonomyFile(path.join(workspace.paths.config, 'taxonomy.yaml'));
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const issues = await validateCardCollection(cards, taxonomy);
  for (const item of issues) {
    errors.push('Synthetic Card validation [' + item.code + '] ' + item.path + ': ' + item.message);
  }

  const statePath = path.join(workspace.paths.state, 'sources/github/example--synthetic-example.json');
  const state = validateAcceptedSourceState(JSON.parse(fs.readFileSync(statePath, 'utf8')));
  const cardPath = path.resolve(workspace.root, state.card_path);
  const card = parseCardDocument(fs.readFileSync(cardPath, 'utf8'), cardPath);
  if (card.data.id !== state.card_id) errors.push('Synthetic source state card_id does not match Card.');
  if (card.data.source?.identity !== state.source_identity) errors.push('Synthetic source state identity does not match Card.');
  if (card.data.canonical_url !== state.canonical_url) errors.push('Synthetic source state canonical_url does not match Card.');
} catch (error) {
  errors.push(
    'Synthetic workspace/Card/source-state validation failed: ' +
    (error?.code || 'UNKNOWN') + ' ' +
    (error instanceof Error ? error.message : String(error))
  );
}

if (errors.length) {
  console.error('Repository check failed (' + errors.length + '):');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log(
  'Repository check passed: ' + requiredFiles.length +
  ' required files, Workspace/Card/Taxonomy contracts, GitHub/Threads ingestion, generated/release contracts, private site authorization, source state, and current-only documentation policy verified.'
);
