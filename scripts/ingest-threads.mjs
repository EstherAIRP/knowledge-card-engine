import fs from 'node:fs/promises';
import process from 'node:process';
import {
  assertThreadsEvidenceMatchesRequest,
  fetchThreadsEvidence,
  validateThreadsEvidence
} from '../packages/ingestion/src/index.js';
import { applyAcceptedThreadsAnalysis } from '../packages/workspace/src/card-store.js';

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
  console.error('Usage: npm run ingest:threads -- <workspace-root> <threads-url> --analysis-file=<analysis.json> [--evidence-file=<accepted-evidence.json>] [--captured-at=<iso>]');
  process.exit(2);
}

try {
  const request = { schema_version: 1, provider: 'threads', source_url: args.sourceUrl };
  const evidence = args.evidenceFile
    ? validateThreadsEvidence(JSON.parse(await fs.readFile(args.evidenceFile, 'utf8')))
    : await fetchThreadsEvidence(args.sourceUrl, {
        capturedAt: args.capturedAt || new Date().toISOString()
      });
  assertThreadsEvidenceMatchesRequest(request, evidence);
  const analysis = JSON.parse(await fs.readFile(args.analysisFile, 'utf8'));
  const result = await applyAcceptedThreadsAnalysis(args.workspaceRoot, evidence, analysis);
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
