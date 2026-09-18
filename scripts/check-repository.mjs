import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorkspace } from '../packages/workspace/src/index.js';
import { loadCardDocuments, loadTaxonomyFile, validateCardCollection } from '../packages/core/src/index.js';

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
  'schema/workspace.schema.json',
  'schema/engine-lock.schema.json',
  'schema/knowledge-card.schema.json',
  'schema/taxonomy.schema.json',
  '.github/workflows/validate.yml',
  '.github/workflows/validate-workspace.yml',
  'examples/synthetic-workspace/fixture.json',
  'examples/synthetic-workspace/workspace.yaml',
  'examples/synthetic-workspace/engine.lock.json',
  'examples/synthetic-workspace/config/taxonomy.yaml',
  'examples/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md',
  ...['profile', 'projects', 'config', 'state', 'data', 'releases'].map((name) => 'examples/synthetic-workspace/' + name + '/README.md'),
  'examples/synthetic-workspace/content/knowledge/README.md',
  ...['web', 'server'].flatMap((name) => ['apps/' + name + '/package.json', 'apps/' + name + '/src/index.js']),
  ...['core', 'ingestion', 'analysis', 'graph', 'workspace', 'release'].flatMap((name) => [
    'packages/' + name + '/package.json',
    'packages/' + name + '/src/index.js'
  ])
];
const forbiddenPaths = [
  'docs/plans',
  'docs/archive',
  'docs/phases',
  'docs/roadmap.md',
  'ROADMAP.md',
  'CHANGELOG.md'
];

const errors = [];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) errors.push('Missing required file: ' + relative);
}
for (const relative of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relative))) errors.push('Historical/planning path is not allowed in engine: ' + relative);
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
  for (const item of issues) errors.push('Synthetic Card validation [' + item.code + '] ' + item.path + ': ' + item.message);
} catch (error) {
  errors.push('Synthetic workspace/Card validation failed: ' + (error?.code || 'UNKNOWN') + ' ' + (error instanceof Error ? error.message : String(error)));
}

if (errors.length) {
  console.error('Repository check failed (' + errors.length + '):');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log('Repository check passed: ' + requiredFiles.length + ' required files, Workspace v1, Card v1, Taxonomy v1, and current-only documentation policy verified.');
