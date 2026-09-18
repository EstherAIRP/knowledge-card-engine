import path from 'node:path';
import process from 'node:process';
import { loadWorkspace } from '../packages/workspace/src/index.js';
import {
  loadCardDocuments,
  loadTaxonomyFile,
  validateCardCollection
} from '../packages/core/src/index.js';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('Usage: npm run cards:validate -- <workspace-root>');
  process.exit(2);
}

try {
  const workspace = await loadWorkspace(workspaceRoot);
  const taxonomyPath = path.join(workspace.paths.config, 'taxonomy.yaml');
  const taxonomy = await loadTaxonomyFile(taxonomyPath);
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const issues = await validateCardCollection(cards, taxonomy);

  if (issues.length) {
    console.error('Card validation failed (' + issues.length + ' issue(s)):');
    for (const item of issues) {
      const prefix = item.filePath ? item.filePath + ': ' : '';
      console.error('- [' + item.code + '] ' + prefix + item.path + ': ' + item.message);
    }
    process.exit(1);
  }

  console.log('Card validation passed: ' + cards.length + ' card(s), taxonomy schema v' + taxonomy.schema_version + ', no duplicate IDs/source identities/canonical URLs.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (Array.isArray(error?.issues)) {
    for (const item of error.issues) console.error('- [' + item.code + '] ' + item.path + ': ' + item.message);
  }
  process.exit(1);
}
