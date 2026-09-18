import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { assertWorkflowPin, loadWorkspace } from '../packages/workspace/src/index.js';

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [name, ...parts] = arg.slice(2).split('=');
      flags.set(name, parts.join('='));
    } else {
      positional.push(arg);
    }
  }
  return {
    workspaceRoot: positional[0] || null,
    engineRepository: flags.get('engine-repository') || null,
    engineCommit: flags.get('engine-commit') || null,
    workflowFile: flags.get('workflow-file') || null
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.workspaceRoot) {
  console.error('Usage: npm run workspace:validate -- <workspace-root> [--engine-repository=owner/repo] [--engine-commit=<40-sha>] [--workflow-file=.github/workflows/validate.yml]');
  process.exit(2);
}

try {
  const loaded = await loadWorkspace(args.workspaceRoot, {
    expectedEngineRepository: args.engineRepository,
    expectedEngineCommit: args.engineCommit
  });

  if (args.workflowFile) {
    const workflowPath = path.resolve(args.workspaceRoot, args.workflowFile);
    const workflowText = await fs.readFile(workflowPath, 'utf8');
    assertWorkflowPin(workflowText, loaded.engineLock);
  }

  console.log(JSON.stringify({
    status: 'ok',
    workspace_schema_version: loaded.config.schema_version,
    engine_repository: loaded.engineLock.engine_repository,
    engine_commit: loaded.engineLock.engine_commit,
    workflow_pin_verified: Boolean(args.workflowFile)
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error?.code || 'WORKSPACE_VALIDATION_FAILED',
    message: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exit(1);
}
