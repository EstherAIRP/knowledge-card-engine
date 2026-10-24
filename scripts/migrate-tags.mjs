import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import { applyTagMigrationPlan } from '../packages/workspace/src/tag-migration.js';

const args = process.argv.slice(2);
const write = args.includes('--write');
const positional = args.filter((value) => value !== '--write');
const [workspaceRoot, planPath] = positional;

if (!workspaceRoot || !planPath || positional.length !== 2) {
  console.error('Usage: npm run tags:migrate -- <workspace-root> <plan.yaml> [--write]');
  process.exit(2);
}

try {
  const raw = await fs.readFile(path.resolve(planPath), 'utf8');
  const plan = parseYaml(raw);
  const result = await applyTagMigrationPlan(workspaceRoot, plan, { write });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? `[${error.code || 'TAG_MIGRATION_FAILED'}] ${error.message}` : String(error));
  if (Array.isArray(error?.issues)) {
    for (const item of error.issues) {
      const prefix = item.filePath ? item.filePath + ': ' : '';
      console.error('- [' + item.code + '] ' + prefix + item.path + ': ' + item.message);
    }
  }
  process.exit(1);
}
