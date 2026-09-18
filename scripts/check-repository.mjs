import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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
  'examples/synthetic-workspace/fixture.json',
  ...['web', 'server'].flatMap((name) => [`apps/${name}/package.json`, `apps/${name}/src/index.js`]),
  ...['core', 'ingestion', 'analysis', 'graph', 'workspace', 'release'].flatMap((name) => [
    `packages/${name}/package.json`,
    `packages/${name}/src/index.js`
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
  if (!fs.existsSync(path.join(root, relative))) errors.push(`Missing required file: ${relative}`);
}
for (const relative of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relative))) errors.push(`Historical/planning path is not allowed in engine: ${relative}`);
}

try {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'examples/synthetic-workspace/fixture.json'), 'utf8'));
  if (fixture.synthetic !== true) errors.push('Synthetic workspace fixture must declare synthetic=true.');
} catch (error) {
  errors.push(`Synthetic workspace fixture is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (errors.length) {
  console.error(`Repository check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Repository check passed: ${requiredFiles.length} required files and current-only documentation policy verified.`);
