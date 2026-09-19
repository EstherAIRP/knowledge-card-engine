import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorkspace } from '../packages/workspace/src/index.js';
import { loadCardDocuments, loadTaxonomyFile, validateCardCollection, parseCardDocument } from '../packages/core/src/index.js';
import { validateGitHubSourceState } from '../packages/ingestion/src/index.js';
import { findCurrentOnlyDocumentationIssues } from './documentation-policy.mjs';

const root = process.cwd();
const requiredFiles = [
  'README.md',
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  'docs/index.md',
  'docs/architecture.md',
  'docs/development.md',
  'docs/workspace.md',
  'docs/card-contract.md',
  'docs/ingestion.md',
  'docs/generated-data.md',
  'docs/release.md',
  'docs/private-site.md',
  'schema/workspace.schema.json',
  'schema/engine-lock.schema.json',
  'schema/knowledge-card.schema.json',
  'schema/taxonomy.schema.json',
  '.github/workflows/validate.yml',
  '.github/workflows/validate-workspace.yml',
  '.github/workflows/release-workspace.yml',
  'scripts/ingest-github.mjs',
  'scripts/validate-source-state.mjs',
  'scripts/release-workspace.mjs',
  'scripts/documentation-policy.mjs',
  'tests/documentation-policy.test.mjs',
  'examples/synthetic-workspace/fixture.json',
  'examples/synthetic-workspace/workspace.yaml',
  'examples/synthetic-workspace/engine.lock.json',
  'examples/synthetic-workspace/config/taxonomy.yaml',
  'examples/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md',
  'examples/synthetic-workspace/state/sources/github/example--synthetic-example.json',
  ...['profile', 'projects', 'config', 'state', 'data', 'releases'].map((name) => 'examples/synthetic-workspace/' + name + '/README.md'),
  'examples/synthetic-workspace/content/knowledge/README.md',
  ...['web', 'server'].flatMap((name) => ['apps/' + name + '/package.json', 'apps/' + name + '/src/index.js']),
  ...['core', 'ingestion', 'analysis', 'graph', 'workspace', 'release'].flatMap((name) => [
    'packages/' + name + '/package.json',
    'packages/' + name + '/src/index.js'
  ]),
  'packages/workspace/src/card-store.js',
  'apps/server/.env.example',
  'apps/server/src/auth.js',
  'apps/server/src/config.js',
  'apps/server/src/github.js',
  'apps/server/src/http.js',
  'apps/server/src/session-store.js',
  'apps/server/src/workspace-reader.js',
  'apps/server/src/node-server.js',
  'tests/private-site.test.mjs',
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

const documentationFiles = [
  'README.md',
  'AGENTS.md',
  ...fs.readdirSync(path.join(root, 'docs'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => 'docs/' + entry.name),
  'schema/README.md',
  'prompts/README.md',
  'defaults/README.md',
  ...['README.md', 'config/README.md', 'content/knowledge/README.md', 'profile/README.md', 'projects/README.md', 'state/README.md', 'data/README.md', 'releases/README.md']
    .map((relative) => 'examples/synthetic-workspace/' + relative)
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

try {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'examples/synthetic-workspace/fixture.json'), 'utf8'));
  if (fixture.synthetic !== true) errors.push('Synthetic workspace fixture must declare synthetic=true.');
  if (fixture.contains_private_data !== false) errors.push('Synthetic workspace fixture must declare contains_private_data=false.');
} catch (error) {
  errors.push('Synthetic workspace fixture is invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
}

try {
  const workspace = await loadWorkspace(path.join(root, 'examples/synthetic-workspace'));
  const taxonomy = await loadTaxonomyFile(path.join(workspace.paths.config, 'taxonomy.yaml'));
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const issues = await validateCardCollection(cards, taxonomy);
  for (const item of issues) {
    errors.push('Synthetic Card validation [' + item.code + '] ' + item.path + ': ' + item.message);
  }

  const statePath = path.join(workspace.paths.state, 'sources/github/example--synthetic-example.json');
  const state = validateGitHubSourceState(JSON.parse(fs.readFileSync(statePath, 'utf8')));
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
  ' required files, Workspace/Card/Taxonomy contracts, GitHub ingestion, generated/release contracts, private site authorization, source state, and current-only documentation policy verified.'
);
