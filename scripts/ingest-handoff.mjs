import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  assertAcceptedEvidenceMatchesRequest,
  createGitHubResearchProgress,
  discoverGitHubResearchCandidates,
  fetchAcceptedEvidence,
  fetchGitHubResearchExpansion,
  validateAcceptedEvidence,
  validateGitHubResearchDiscovery,
  validateGitHubResearchProgress,
  validateIngestionRequest
} from '../packages/ingestion/src/index.js';
import { validateResearchPlan } from '../packages/analysis/src/index.js';
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
  researchPlan: 'research-plan.json',
  researchEvidence: 'research-evidence.json',
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

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
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

function exactObjectKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', `${label} must contain exactly: ${wanted.join(', ')}.`);
  }
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

function validateResearchHandoff(value, evidence) {
  exactObjectKeys(
    value,
    ['schema_version', 'provider', 'discovery', 'progress', 'bundle'],
    'GitHub research evidence handoff'
  );
  if (value.schema_version !== 1 || value.provider !== 'github') {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'GitHub research evidence handoff schema/provider is invalid.');
  }
  const discovery = validateGitHubResearchDiscovery(value.discovery, evidence);
  const bundle = value.bundle == null ? null : value.bundle;
  const progress = validateGitHubResearchProgress(value.progress, evidence, discovery, bundle);
  return {
    schema_version: 1,
    provider: 'github',
    discovery,
    progress,
    bundle
  };
}

function validateResearchPlanHandoff(value, evidence) {
  exactObjectKeys(
    value,
    ['schema_version', 'provider', 'plan', 'selected_paths'],
    'GitHub research plan handoff'
  );
  if (value.schema_version !== 1 || value.provider !== 'github') {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'GitHub research plan handoff schema/provider is invalid.');
  }
  const plan = validateResearchPlan(value.plan, evidence);
  if (
    !Array.isArray(value.selected_paths)
    || value.selected_paths.length === 0
    || value.selected_paths.some((item) => typeof item !== 'string' || !item)
    || new Set(value.selected_paths).size !== value.selected_paths.length
  ) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'GitHub research plan selected_paths must be a non-empty unique array.');
  }
  return {
    schema_version: 1,
    provider: 'github',
    plan,
    selected_paths: value.selected_paths
  };
}

function researchBudgetAvailable(researchHandoff) {
  const limits = researchHandoff.discovery.discovery.limits;
  const progress = researchHandoff.progress;
  return (
    progress.completed_rounds < limits.max_expansion_rounds
    && progress.total_items < limits.max_selected_items
    && progress.total_bytes < limits.max_total_bytes
  );
}

function githubWaitingResult(evidence, researchHandoff, handoffPaths) {
  const hasBundle = Boolean(researchHandoff.bundle);
  const canExpand = researchBudgetAvailable(researchHandoff);
  return {
    status: 'ok',
    stage: hasBundle && !canExpand ? 'waiting-for-analysis' : 'waiting-for-research',
    waiting_for: hasBundle
      ? (canExpand ? 'research-plan-or-analysis' : 'analysis')
      : 'research-plan',
    source_identity: evidence.source_identity,
    evidence_digest: evidence.evidence_digest,
    repository_revision: researchHandoff.discovery.repository_revision,
    analysis_evidence_digest: researchHandoff.bundle?.analysis_evidence_digest || null,
    research_progress: researchHandoff.progress,
    handoff_paths: handoffPaths,
    allowed_changed_paths: []
  };
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
  const researchPlanPath = path.join(handoffDir, HANDOFF_FILES.researchPlan);
  const researchEvidencePath = path.join(handoffDir, HANDOFF_FILES.researchEvidence);
  const analysisPath = path.join(handoffDir, HANDOFF_FILES.analysis);
  const request = validateIngestionRequest(
    await readJson(requestPath, 'REMOTE_INGEST_REQUEST_MISSING')
  );

  const hasSemanticHandoff = await exists(semanticHandoffPath);
  const hasSemanticJudgement = await exists(semanticJudgementPath);
  const hasEvidence = await exists(evidencePath);
  const hasResearchPlan = await exists(researchPlanPath);
  const hasResearchEvidence = await exists(researchEvidencePath);
  const hasAnalysis = await exists(analysisPath);
  const handoffPaths = {
    request: relative(workspace.root, requestPath),
    semantic_handoff: relative(workspace.root, semanticHandoffPath),
    semantic_judgement: relative(workspace.root, semanticJudgementPath),
    evidence: relative(workspace.root, evidencePath),
    research_plan: relative(workspace.root, researchPlanPath),
    research_evidence: relative(workspace.root, researchEvidencePath),
    analysis: relative(workspace.root, analysisPath)
  };

  if (request.provider !== 'threads' && (hasSemanticHandoff || hasSemanticJudgement)) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Semantic continuation handoff is only valid for Threads ingestion.');
  }
  if (request.provider !== 'github' && (hasResearchPlan || hasResearchEvidence)) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'Research handoff files are only valid for GitHub ingestion.');
  }
  if (hasResearchPlan && hasAnalysis) {
    fail('REMOTE_INGEST_HANDOFF_INVALID', 'research-plan.json and analysis.json cannot exist at the same time.');
  }

  let result;
  if (!hasEvidence) {
    if (hasAnalysis || hasResearchPlan || hasResearchEvidence) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'Research or analysis handoff files cannot exist before accepted evidence is prepared.');
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
          stage: 'waiting-for-analysis',
          waiting_for: 'semantic-judgement',
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
          await writeJson(semanticHandoffPath, error.semantic_handoff);
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

        const allowed = [handoffPaths.evidence];
        if (request.provider === 'github') {
          const discovery = await discoverGitHubResearchCandidates(evidence, {
            token: process.env.GITHUB_TOKEN || null
          });
          const researchHandoff = {
            schema_version: 1,
            provider: 'github',
            discovery,
            progress: createGitHubResearchProgress(evidence, discovery),
            bundle: null
          };
          await Promise.all([
            writeJson(evidencePath, evidence),
            writeJson(researchEvidencePath, researchHandoff)
          ]);
          allowed.push(handoffPaths.research_evidence);
          result = {
            status: 'ok',
            stage: 'research-prepared',
            waiting_for: 'research-plan',
            source_identity: evidence.source_identity,
            evidence_digest: evidence.evidence_digest,
            repository_revision: discovery.repository_revision,
            research_candidate_count: discovery.candidates.length,
            handoff_paths: handoffPaths,
            allowed_changed_paths: allowed
          };
        } else {
          await writeJson(evidencePath, evidence);
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
    }
  } else {
    if (hasSemanticHandoff || hasSemanticJudgement) {
      fail('REMOTE_INGEST_HANDOFF_INVALID', 'Semantic handoff files must be cleared once accepted evidence exists.');
    }
    const evidence = validateAcceptedEvidence(
      await readJson(evidencePath, 'REMOTE_INGEST_EVIDENCE_MISSING')
    );
    assertAcceptedEvidenceMatchesRequest(request, evidence);

    if (request.provider === 'github') {
      if (!hasResearchEvidence) {
        fail('REMOTE_INGEST_RESEARCH_MISSING', 'GitHub accepted evidence requires research-evidence.json before analysis can be applied.');
      }
      let researchHandoff = validateResearchHandoff(
        await readJson(researchEvidencePath, 'REMOTE_INGEST_RESEARCH_MISSING'),
        evidence
      );

      if (hasAnalysis) {
        if (!researchHandoff.bundle || researchHandoff.progress.completed_rounds < 1) {
          fail('REMOTE_INGEST_RESEARCH_REQUIRED', 'GitHub analysis requires at least one validated research expansion round.');
        }
        const analysis = await readJson(analysisPath, 'REMOTE_INGEST_ANALYSIS_MISSING');
        const applied = await applyAcceptedSourceAnalysis(
          workspace.root,
          evidence,
          analysis,
          { analysisEvidenceBundle: researchHandoff.bundle }
        );
        await Promise.all([
          fs.rm(requestPath, { force: true }),
          fs.rm(evidencePath, { force: true }),
          fs.rm(researchPlanPath, { force: true }),
          fs.rm(researchEvidencePath, { force: true }),
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
            applied.research_state_path,
            handoffPaths.request,
            handoffPaths.evidence,
            handoffPaths.research_plan,
            handoffPaths.research_evidence,
            handoffPaths.analysis
          ].filter(Boolean)
        };
      } else if (hasResearchPlan) {
        const submission = validateResearchPlanHandoff(
          await readJson(researchPlanPath, 'REMOTE_INGEST_RESEARCH_PLAN_MISSING'),
          evidence
        );
        const expansion = await fetchGitHubResearchExpansion(
          evidence,
          researchHandoff.discovery,
          submission.plan,
          researchHandoff.progress,
          submission.selected_paths,
          {
            previousBundle: researchHandoff.bundle,
            token: process.env.GITHUB_TOKEN || null
          }
        );
        researchHandoff = {
          ...researchHandoff,
          progress: expansion.progress,
          bundle: expansion.bundle
        };
        await writeJson(researchEvidencePath, researchHandoff);
        await fs.rm(researchPlanPath, { force: true });
        result = {
          status: 'ok',
          stage: 'research-expanded',
          waiting_for: researchBudgetAvailable(researchHandoff)
            ? 'research-plan-or-analysis'
            : 'analysis',
          source_identity: evidence.source_identity,
          evidence_digest: evidence.evidence_digest,
          repository_revision: researchHandoff.discovery.repository_revision,
          research_round: expansion.round,
          analysis_evidence_digest: expansion.bundle.analysis_evidence_digest,
          research_progress: expansion.progress,
          handoff_paths: handoffPaths,
          allowed_changed_paths: [
            handoffPaths.research_plan,
            handoffPaths.research_evidence
          ]
        };
      } else {
        result = githubWaitingResult(evidence, researchHandoff, handoffPaths);
      }
    } else {
      if (hasResearchPlan || hasResearchEvidence) {
        fail('REMOTE_INGEST_HANDOFF_INVALID', 'Research handoff files are not valid for Threads ingestion.');
      }
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
