import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  assertAcceptedEvidenceMatchesRequest,
  fetchAcceptedEvidence,
  validateAcceptedEvidence,
  validateIngestionRequest
} from '../packages/ingestion/src/index.js';
import { applyAcceptedSourceAnalysis } from '../packages/workspace/src/card-store.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';

const HANDOFF_FILES = Object.freeze({
  request: 'request.json',
  evidence: 'evidence.json',
  analysis: 'analysis.json'
});
const ALLOWED_HANDOFF_FILES = new Set(Object.values(HANDOFF_FILES));

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

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
    resultFile: flags.get('result-file') || null
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(filePath, code) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') fail(code, `Required handoff file is missing: ${path.basename(filePath)}.`);
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail('REMOTE_INGEST_HANDOFF_INVALID', `Handoff file is not valid JSON: ${path.basename(filePath)}.`);
  }
}

async function assertHandoffDirectory(handoffDir) {
  let entries;
  try {
    entries = await fs.readdir(handoffDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') fail('REMOTE_INGEST_REQUEST_MISSING', 'Source ingestion handoff directory does not exist.');
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !ALLOWED_HANDOFF_FILES.has(entry.name)) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', `Unsupported ingestion handoff entry: ${entry.name}.`);
    }
  }
}

function relative(workspaceRoot, filePath) {
  return path.relative(workspaceRoot, filePath).split(path.sep).join('/');
}

async function writeResult(resultFile, result) {
  if (!resultFile) return;
  await fs.writeFile(path.resolve(resultFile), JSON.stringify(result, null, 2) + '\n', 'utf8');
}

const args = parseArgs(process.argv.slice(2));
if (!args.workspaceRoot) {
  console.error('Usage: npm run ingest:handoff -- <workspace-root> [--result-file=<path>]');
  process.exit(2);
}

try {
  const workspace = await loadWorkspace(args.workspaceRoot);
  const handoffDir = path.join(workspace.paths.state, 'ingestion');
  await assertHandoffDirectory(handoffDir);

  const requestPath = path.join(handoffDir, HANDOFF_FILES.request);
  const evidencePath = path.join(handoffDir, HANDOFF_FILES.evidence);
  const analysisPath = path.join(handoffDir, HANDOFF_FILES.analysis);
  const request = validateIngestionRequest(
    await readJson(requestPath, 'REMOTE_INGEST_REQUEST_MISSING')
  );

  const hasEvidence = await exists(evidencePath);
  const hasAnalysis = await exists(analysisPath);
  const handoffPaths = {
    request: relative(workspace.root, requestPath),
    evidence: relative(workspace.root, evidencePath),
    analysis: relative(workspace.root, analysisPath)
  };

  let result;
  if (!hasEvidence) {
    if (hasAnalysis) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'analysis.json cannot exist before accepted evidence is prepared.');
    }
    const evidence = await fetchAcceptedEvidence(request, {
      token: process.env.GITHUB_TOKEN || null
    });
    assertAcceptedEvidenceMatchesRequest(request, evidence);
    await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    result = {
      status: 'ok',
      stage: 'prepared',
      source_identity: evidence.source_identity,
      evidence_digest: evidence.evidence_digest,
      handoff_paths: handoffPaths,
      allowed_changed_paths: [handoffPaths.evidence]
    };
  } else {
    const evidence = validateAcceptedEvidence(
      await readJson(evidencePath, 'REMOTE_INGEST_EVIDENCE_MISSING')
    );
    assertAcceptedEvidenceMatchesRequest(request, evidence);

    if (!hasAnalysis) {
      result = {
        status: 'ok',
        stage: 'waiting-for-analysis',
        source_identity: evidence.source_identity,
        evidence_digest: evidence.evidence_digest,
        handoff_paths: handoffPaths,
        allowed_changed_paths: []
      };
    } else {
      const analysis = await readJson(analysisPath, 'REMOTE_INGEST_ANALYSIS_MISSING');
      const applied = await applyAcceptedSourceAnalysis(workspace.root, evidence, analysis);
      await Promise.all([
        fs.rm(requestPath, { force: true }),
        fs.rm(evidencePath, { force: true }),
        fs.rm(analysisPath, { force: true })
      ]);
      await fs.rmdir(handoffDir).catch((error) => {
        if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error;
      });
      result = {
        status: 'ok',
        stage: 'applied',
        ...applied,
        handoff_paths: handoffPaths,
        allowed_changed_paths: [
          applied.card_path,
          applied.source_state_path,
          handoffPaths.request,
          handoffPaths.evidence,
          handoffPaths.analysis
        ]
      };
    }
  }

  await writeResult(args.resultFile, result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    status: 'error',
    code: error?.code || 'REMOTE_INGEST_FAILED',
    message: error instanceof Error ? error.message : String(error),
    issues: Array.isArray(error?.issues) ? error.issues : undefined
  };
  await writeResult(args.resultFile, result).catch(() => {});
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
