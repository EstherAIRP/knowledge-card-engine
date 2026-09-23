import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseCardDocument } from '../packages/core/src/index.js';
import { githubSourceStatePath } from '../packages/ingestion/src/index.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';
import {
  researchStatePath,
  validateResearchState,
  validateResearchStateLinks
} from '../packages/workspace/src/research-state.js';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('Usage: npm run research-state:validate -- <workspace-root>');
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

function assertInside(root, target, code, message) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

try {
  const workspace = await loadWorkspace(workspaceRoot);
  const researchRoot = path.join(workspace.paths.state, 'research');
  const files = await jsonFiles(researchRoot);

  for (const file of files) {
    const state = validateResearchState(JSON.parse(await fs.readFile(file, 'utf8')));
    const expectedRelative = researchStatePath(state);
    const actualRelative = path.relative(workspace.paths.state, file).split(path.sep).join('/');
    if (actualRelative !== expectedRelative) {
      const error = new Error(`Research state path mismatch: expected ${expectedRelative}, received ${actualRelative}.`);
      error.code = 'RESEARCH_STATE_PATH_MISMATCH';
      throw error;
    }

    const cardPath = path.resolve(workspace.root, state.card_path);
    assertInside(
      workspace.paths.knowledge,
      cardPath,
      'RESEARCH_STATE_CARD_PATH_INVALID',
      'Research state card_path must remain inside the configured knowledge directory.'
    );

    const sourcePath = path.join(workspace.paths.state, ...githubSourceStatePath(state.source_identity).split('/'));
    assertInside(
      workspace.paths.state,
      sourcePath,
      'RESEARCH_STATE_SOURCE_PATH_INVALID',
      'Research state source path must remain inside the configured state directory.'
    );

    const [cardRaw, sourceRaw] = await Promise.all([
      fs.readFile(cardPath, 'utf8'),
      fs.readFile(sourcePath, 'utf8')
    ]);
    const card = parseCardDocument(cardRaw, cardPath);
    const sourceState = JSON.parse(sourceRaw);
    validateResearchStateLinks(state, { card, sourceState });
  }

  console.log(`Research state validation passed: ${files.length} research provenance state file(s).`);
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error?.code || 'RESEARCH_STATE_VALIDATION_FAILED',
    message: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exit(1);
}
