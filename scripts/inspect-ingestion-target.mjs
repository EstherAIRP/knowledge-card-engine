import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { loadCardDocuments } from '../packages/core/src/index.js';
import { validateIngestionRequest } from '../packages/ingestion/src/index.js';
import { resolveIngestionPreflightTarget } from '../packages/ingestion/src/preflight.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('Usage: node scripts/inspect-ingestion-target.mjs <workspace-root>');
  process.exit(2);
}

try {
  const workspace = await loadWorkspace(workspaceRoot);
  const requestPath = path.join(workspace.paths.state, 'ingestion', 'request.json');
  const request = validateIngestionRequest(JSON.parse(await fs.readFile(requestPath, 'utf8')));
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const target = resolveIngestionPreflightTarget(cards, request.source_url);
  console.log(JSON.stringify(target, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error?.code || 'INGESTION_PREFLIGHT_FAILED',
    message: error instanceof Error ? error.message : String(error),
    issues: Array.isArray(error?.issues) ? error.issues : undefined
  }, null, 2));
  process.exit(1);
}
