import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseCardDocument } from '../packages/core/src/index.js';
import { validateGitHubSourceState } from '../packages/ingestion/src/index.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('Usage: npm run source-state:validate -- <workspace-root>');
  process.exit(2);
}

async function jsonFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) result.push(full);
    }
  }
  return result.sort();
}

try {
  const workspace = await loadWorkspace(workspaceRoot);
  const sourceRoot = path.join(workspace.paths.state, 'sources', 'github');
  const files = await jsonFiles(sourceRoot);
  for (const file of files) {
    const state = validateGitHubSourceState(JSON.parse(await fs.readFile(file, 'utf8')));
    const cardPath = path.resolve(workspace.root, state.card_path);
    const knowledgeRoot = path.resolve(workspace.paths.knowledge) + path.sep;
    if (!cardPath.startsWith(knowledgeRoot)) {
      const error = new Error('Source state card_path must remain inside the configured knowledge directory.');
      error.code = 'SOURCE_STATE_INVALID';
      throw error;
    }
    const card = parseCardDocument(await fs.readFile(cardPath, 'utf8'), cardPath);
    if (card.data.id !== state.card_id || card.data.source?.identity !== state.source_identity || card.data.canonical_url !== state.canonical_url) {
      const error = new Error('Source state does not match its referenced Knowledge Card.');
      error.code = 'SOURCE_STATE_CARD_MISMATCH';
      throw error;
    }
  }
  console.log(`Source state validation passed: ${files.length} GitHub state file(s).`);
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error?.code || 'SOURCE_STATE_VALIDATION_FAILED',
    message: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exit(1);
}
