import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  assertAcceptedEvidenceMatchesRequest,
  fetchAcceptedEvidence,
  validateAcceptedEvidence,
  validateIngestionRequest
} from '../packages/ingestion/src/index.js';
import {
  THREADS_SEMANTIC_HANDOFF_KIND,
  THREADS_SEMANTIC_HANDOFF_PRODUCER,
  THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION,
  createThreadsSemanticHandoffCaptureRanker,
  createThreadsSemanticHandoffRanker,
  digestThreadsSemanticHandoffEvidence,
  normalizeThreadsSemanticHandoffRequest
} from '../packages/ingestion/src/threads/semantic-handoff.js';
import { applyAcceptedSourceAnalysis } from '../packages/workspace/src/card-store.js';
import { loadWorkspace } from '../packages/workspace/src/index.js';

const HANDOFF_FILES = Object.freeze({
  request: 'request.json',
  semanticHandoff: 'semantic-handoff.json',
  semanticJudgement: 'semantic-judgement.json',
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

function validateSemanticHandoff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Threads semantic handoff must be an object.');
  }
  if (value.schema_version !== THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION || value.kind !== THREADS_SEMANTIC_HANDOFF_KIND) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Threads semantic handoff schema or kind is invalid.');
  }
  if (value.producer_required !== THREADS_SEMANTIC_HANDOFF_PRODUCER || !value.evidence?.root || !Array.isArray(value.evidence?.candidates)) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Threads semantic handoff evidence or producer is invalid.');
  }
  const expectedDigest = digestThreadsSemanticHandoffEvidence(value.evidence.root, value.evidence.candidates);
  if (expectedDigest !== value.evidence_digest) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Threads semantic handoff evidence digest is invalid.');
  }
  return value;
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
  const semanticHandoffPath = path.join(handoffDir, HANDOFF_FILES.semanticHandoff);
  const semanticJudgementPath = path.join(handoffDir, HANDOFF_FILES.semanticJudgement);
  const evidencePath = path.join(handoffDir, HANDOFF_FILES.evidence);
  const analysisPath = path.join(handoffDir, HANDOFF_FILES.analysis);
  const request = validateIngestionRequest(
    await readJson(requestPath, 'REMOTE_INGEST_REQUEST_MISSING')
  );

  const hasSemanticHandoff = await exists(semanticHandoffPath);
  const hasSemanticJudgement = await exists(semanticJudgementPath);
  const hasEvidence = await exists(evidencePath);
  const hasAnalysis = await exists(analysisPath);
  const handoffPaths = {
    request: relative(workspace.root, requestPath),
    semantic_handoff: relative(workspace.root, semanticHandoffPath),
    semantic_judgement: relative(workspace.root, semanticJudgementPath),
    evidence: relative(workspace.root, evidencePath),
    analysis: relative(workspace.root, analysisPath)
  };

  let result;
  if (!hasEvidence) {
    if (hasAnalysis) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'analysis.json cannot exist before accepted evidence is prepared.');
    }
    if (request.provider !== 'threads' && (hasSemanticHandoff || hasSemanticJudgement)) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'Semantic continuation handoff is only valid for Threads ingestion.');
    }
    if (hasSemanticJudgement && !hasSemanticHandoff) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'semantic-judgement.json requires semantic-handoff.json.');
    }

    let continuationRanker = request.provider === 'threads'
      ? createThreadsSemanticHandoffCaptureRanker()
      : null;

    if (hasSemanticHandoff) {
      const semanticHandoff = validateSemanticHandoff(
        await readJson(semanticHandoffPath, 'REMOTE_INGEST_HANDOFF_INVALID')
      );
      if (!hasSemanticJudgement) {
        result = {
          status: 'ok',
          stage: 'waiting-for-semantic-judgement',
          semantic_handoff: semanticHandoff,
          handoff_paths: handoffPaths,
          allowed_changed_paths: []
        };
      } else {
        const submission = normalizeThreadsSemanticHandoffRequest(
          await readJson(semanticJudgementPath, 'REMOTE_INGEST_HANDOFF_INVALID')
        );
        if (submission.evidence_digest !== semanticHandoff.evidence_digest) {
          fail('THREADS_CONTINUATION_HANDOFF_EVIDENCE_MISMATCH', 'Threads semantic judgement does not match the pending handoff evidence digest.');
        }
        continuationRanker = createThreadsSemanticHandoffRanker(submission);
      }
    }

    if (!result) {
      let evidence;
      try {
        evidence = await fetchAcceptedEvidence(request, {
          token: process.env.GITHUB_TOKEN || null,
          browserFallback: request.provider === 'threads',
          continuationRanker
        });
      } catch (error) {
        if (
          request.provider === 'threads'
          && !hasSemanticHandoff
          && error?.code === 'THREADS_SEMANTIC_HANDOFF_REQUIRED'
          && error?.semantic_handoff
        ) {
          await fs.writeFile(semanticHandoffPath, JSON.stringify(error.semantic_handoff, null, 2) + '\n', 'utf8');
          result = {
            status: 'ok',
            stage: 'semantic-handoff',
            semantic_handoff: error.semantic_handoff,
            handoff_paths: handoffPaths,
            allowed_changed_paths: [handoffPaths.semantic_handoff]
          };
        } else {
          throw error;
        }
      }

      if (evidence) {
        assertAcceptedEvidenceMatchesRequest(request, evidence);
        await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
        const allowed = [handoffPaths.evidence];
        if (hasSemanticHandoff) {
          await fs.rm(semanticHandoffPath, { force: true });
          allowed.push(handoffPaths.semantic_handoff);
        }
        if (hasSemanticJudgement) {
          await fs.rm(semanticJudgementPath, { force: true });
          allowed.push(handoffPaths.semantic_judgement);
        }
        result = {
          status: 'ok',
          stage: 'prepared',
          source_identity: evidence.source_identity,
          evidence_digest: evidence.evidence_digest,
          handoff_paths: handoffPaths,
          allowed_changed_paths: allowed
        };
      }
    }
  } else {
    if (hasSemanticHandoff || hasSemanticJudgement) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'Semantic handoff files must be cleared once accepted evidence exists.');
    }
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
