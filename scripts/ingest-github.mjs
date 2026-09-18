import fs from 'node:fs/promises';
import process from 'node:process';
import { fetchGitHubEvidence, validateGitHubEvidence } from '../packages/ingestion/src/index.js';
import { applyAcceptedGitHubAnalysis } from '../packages/workspace/src/card-store.js';

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [name, ...parts] = arg.slice(2).split('=');
      flags.set(name, parts.join('='));
    } else positional.push(arg);
  }
  return {
    workspaceRoot: positional[0] || null,
    sourceUrl: positional[1] || null,
    analysisFile: flags.get('analysis-file') || null,
    evidenceFile: flags.get('evidence-file') || null,
    capturedAt: flags.get('captured-at') || null
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.workspaceRoot || !args.sourceUrl || !args.analysisFile) {
  console.error('Usage: npm run ingest:github -- <workspace-root> <github-url> --analysis-file=<analysis.json> [--evidence-file=<accepted-evidence.json>] [--captured-at=<iso>]');
  process.exit(2);
}

try {
  const evidence = args.evidenceFile
    ? validateGitHubEvidence(JSON.parse(await fs.readFile(args.evidenceFile, 'utf8')))
    : await fetchGitHubEvidence(args.sourceUrl, {
        token: process.env.GITHUB_TOKEN || null,
        capturedAt: args.capturedAt || new Date().toISOString()
      });
  const analysis = JSON.parse(await fs.readFile(args.analysisFile, 'utf8'));
  const result = await applyAcceptedGitHubAnalysis(args.workspaceRoot, evidence, analysis);
  console.log(JSON.stringify({ status: 'ok', ...result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error?.code || 'INGESTION_FAILED',
    message: error instanceof Error ? error.message : String(error),
    issues: Array.isArray(error?.issues) ? error.issues : undefined
  }, null, 2));
  process.exit(1);
}
