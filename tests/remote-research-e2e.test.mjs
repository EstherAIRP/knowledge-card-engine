import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  ANALYSIS_SECTIONS,
  RESEARCH_QUESTION_IDS,
  bindResearchAnalysisToEvidence
} from '../packages/analysis/src/index.js';
import { loadCardDocuments, parseCardDocument } from '../packages/core/src/index.js';
import { validateResearchState } from '../packages/workspace/src/research-state.js';

const HANDOFF_SCRIPT = path.resolve('scripts/ingest-handoff.mjs');
const FETCH_HOOK = pathToFileURL(path.resolve('tests/fixtures/github-research-handoff-fetch.mjs')).href;
let resultCounter = 0;

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-research-e2e-'));
  await fs.cp(path.resolve('examples/synthetic-workspace'), root, { recursive: true });
  return root;
}

function handoffDir(root) {
  return path.join(root, 'state', 'ingestion');
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeRequest(root) {
  await writeJson(path.join(handoffDir(root), 'request.json'), {
    schema_version: 1,
    provider: 'github',
    source_url: 'https://github.com/example/research-handoff'
  });
}

function runHandoff(root, variant, { expectSuccess = true } = {}) {
  resultCounter += 1;
  const resultFile = path.join(
    os.tmpdir(),
    `knowledge-card-research-result-${process.pid}-${resultCounter}.json`
  );
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      FETCH_HOOK,
      HANDOFF_SCRIPT,
      root,
      `--result-file=${resultFile}`
    ],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_ACTIONS: 'false',
        KC_RESEARCH_FIXTURE_VARIANT: String(variant)
      }
    }
  );

  if (expectSuccess) {
    assert.equal(run.status, 0, run.stderr || run.stdout);
  } else {
    assert.notEqual(run.status, 0, 'Expected Remote Ingest handoff to fail.');
  }

  const result = JSON.parse(
    spawnSync(process.execPath, ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1], "utf8"))', resultFile], {
      encoding: 'utf8'
    }).stdout
  );
  fs.rm(resultFile, { force: true }).catch(() => {});
  return { run, result };
}

function researchPlan(evidence) {
  const requests = {
    problem: { evidence_kinds: ['readme'], path_hints: ['README.md'] },
    core_model: { evidence_kinds: ['documentation'], path_hints: ['docs/architecture.md'] },
    architecture: { evidence_kinds: ['documentation'], path_hints: ['docs/architecture.md'] },
    flow: { evidence_kinds: ['background_job'], path_hints: ['src/jobs.js'] },
    implementation_support: { evidence_kinds: ['auth', 'source'], path_hints: ['src/auth.js'] },
    technical_mechanisms: { evidence_kinds: ['background_job', 'source'], path_hints: ['src/jobs.js'] },
    tradeoffs: { evidence_kinds: ['documentation', 'security'], path_hints: ['SECURITY.md'] },
    implementation_status: { evidence_kinds: ['auth', 'background_job'], path_hints: ['src/auth.js', 'src/jobs.js'] },
    operational_boundaries: { evidence_kinds: ['security', 'license', 'manifest'], path_hints: ['SECURITY.md', 'LICENSE', 'package.json'] },
    material_unknowns: { evidence_kinds: ['documentation', 'security'], path_hints: ['docs/architecture.md', 'SECURITY.md'] }
  };

  return {
    schema_version: 1,
    provider: 'github',
    plan: {
      research_version: 1,
      provider: 'github',
      source_identity: evidence.source_identity,
      source_evidence_digest: evidence.evidence_digest,
      questions: Object.fromEntries(RESEARCH_QUESTION_IDS.map((questionId) => [
        questionId,
        {
          status: 'needs_evidence',
          rationale: `Synthetic E2E requires primary-source evidence for ${questionId}.`,
          evidence_kinds: requests[questionId].evidence_kinds,
          path_hints: requests[questionId].path_hints
        }
      ]))
    },
    selected_paths: [
      'README.md',
      'package.json',
      'docs/architecture.md',
      'src/auth.js',
      'src/jobs.js',
      'SECURITY.md',
      'LICENSE'
    ]
  };
}

function analysisFrom(evidence, bundle, variant) {
  const refByPath = new Map(bundle.items.map((item) => [item.path, item.evidence_id]));
  const ref = (filePath) => {
    const value = refByPath.get(filePath);
    assert.ok(value, `Missing E2E evidence ref for ${filePath}.`);
    return value;
  };

  const coverage = {
    problem: {
      status: 'supported',
      evidence_refs: [ref('README.md')],
      note: 'README identifies the synthetic bounded-research service.'
    },
    core_model: {
      status: 'supported',
      evidence_refs: [ref('docs/architecture.md')],
      note: 'Architecture evidence defines request handling and durable worker dispatch.'
    },
    architecture: {
      status: 'supported',
      evidence_refs: [ref('docs/architecture.md')],
      note: 'Architecture evidence identifies the API, queue boundary, and worker responsibility.'
    },
    flow: {
      status: 'supported',
      evidence_refs: [ref('src/jobs.js')],
      note: 'Job source provides the request-to-queue execution flow.'
    },
    implementation_vs_claim: {
      status: 'supported',
      evidence_refs: [ref('src/auth.js'), ref('src/jobs.js')],
      note: 'Source files provide implementation evidence for authorization and dispatch.'
    },
    technical_mechanisms: {
      status: 'supported',
      evidence_refs: [ref('src/jobs.js')],
      note: 'The queue-backed dispatch boundary is visible in implementation evidence.'
    },
    limitations: {
      status: 'supported',
      evidence_refs: [ref('SECURITY.md')],
      note: 'Security documentation states a concrete queue-payload boundary.'
    },
    security: {
      status: 'supported',
      evidence_refs: [ref('SECURITY.md'), ref('src/auth.js')],
      note: 'Security and authorization boundaries have primary-source support.'
    },
    license: {
      status: 'supported',
      evidence_refs: [ref('LICENSE')],
      note: 'The synthetic license file provides license evidence.'
    },
    deployment: {
      status: 'unavailable',
      evidence_refs: [],
      unavailable_reason: 'not_found',
      note: 'No deployment-specific primary source exists in the synthetic repository.'
    }
  };

  const research = {
    research_version: 1,
    provider: 'github',
    coverage,
    findings: {
      core_models: [{
        name: 'Request and durable-job separation',
        description: 'The request path hands longer work to a queue-backed worker boundary.',
        evidence_refs: [ref('docs/architecture.md')]
      }],
      architecture_components: [{
        name: 'API and worker boundary',
        responsibility: 'The API accepts and validates work; a worker executes durable queued jobs.',
        evidence_refs: [ref('docs/architecture.md'), ref('src/jobs.js')]
      }],
      flows: [{
        name: 'Accepted request to durable job',
        steps: variant === 1
          ? ['Authorize the request', 'Dispatch the payload to the durable queue']
          : ['Authorize and validate the request', 'Dispatch the validated payload to the durable queue'],
        evidence_refs: [ref('src/auth.js'), ref('src/jobs.js')]
      }],
      implementation_checks: [{
        claim: 'Requests are authorized before durable work is dispatched.',
        status: 'implemented',
        assessment: 'The selected auth and job modules provide implementation evidence for this boundary.',
        evidence_refs: [ref('src/auth.js'), ref('src/jobs.js')]
      }],
      technical_mechanisms: [{
        name: 'Queue-backed dispatch',
        mechanism: variant === 1
          ? 'The dispatcher places work onto a durable queue.'
          : 'The dispatcher validates the payload before placing work onto a durable queue.',
        why_it_matters: 'Request latency is separated from durable background execution.',
        tradeoff: 'The queue boundary adds retry, observability, and failure-recovery responsibilities.',
        evidence_refs: [ref('src/jobs.js')]
      }],
      limitations: [{
        limitation: 'Queue payloads must not carry credentials.',
        impact: 'Callers need a separate credential or identity boundary instead of embedding secrets in jobs.',
        evidence_refs: [ref('SECURITY.md')]
      }]
    },
    unknowns: ['Deployment topology is not provided by the selected repository evidence.']
  };

  return bindResearchAnalysisToEvidence({
    title: 'Research Handoff',
    summary: variant === 1
      ? 'Synthetic research-bound analysis proving Remote Ingest expansion and writer persistence.'
      : 'Updated synthetic research-bound analysis proving request validation and ownership-safe refresh.',
    resource_kind: 'project',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'research', 'remote-ingest'],
    relevance: { overall: 4, engineering: 5 },
    actions: ['LEARN'],
    status: 'active',
    sections: Object.fromEntries(ANALYSIS_SECTIONS.map((heading) => [
      heading,
      variant === 1
        ? `Synthetic evidence-backed analysis for ${heading}; the service separates requests from durable queue work.`
        : `Updated synthetic evidence-backed analysis for ${heading}; requests are validated before durable queue dispatch.`
    ])),
    research
  }, evidence, bundle);
}

async function prepareInitialResearch(root, variant) {
  const evidencePath = path.join(handoffDir(root), 'evidence.json');
  const researchEvidencePath = path.join(handoffDir(root), 'research-evidence.json');
  const researchPlanPath = path.join(handoffDir(root), 'research-plan.json');

  const prepared = runHandoff(root, variant);
  assert.equal(prepared.result.stage, 'research-prepared');
  assert.equal(prepared.result.waiting_for, 'research-plan');
  assert.equal(prepared.result.analysis_evidence_digest, null);

  const evidence = await readJson(evidencePath);
  let researchEvidence = await readJson(researchEvidencePath);
  assert.equal(researchEvidence.progress.completed_rounds, 0);
  assert.equal(researchEvidence.progress.analysis_evidence_digest, null);
  assert.equal(researchEvidence.bundle, null);

  await writeJson(researchPlanPath, researchPlan(evidence));
  const expanded = runHandoff(root, variant);
  assert.equal(expanded.result.stage, 'research-expanded');
  assert.equal(expanded.result.research_round, 1);
  assert.equal(expanded.result.waiting_for, 'research-plan-or-analysis');

  researchEvidence = await readJson(researchEvidencePath);
  assert.equal(researchEvidence.progress.completed_rounds, 1);
  assert.ok(researchEvidence.bundle);
  assert.equal(
    researchEvidence.progress.analysis_evidence_digest,
    researchEvidence.bundle.analysis_evidence_digest
  );
  assert.ok(researchEvidence.bundle.items.some((item) => item.path === 'docs/architecture.md'));
  assert.ok(researchEvidence.bundle.items.some((item) => item.path === 'src/jobs.js'));
  assert.ok(researchEvidence.bundle.items.length > 1);
  await assert.rejects(
    fs.access(researchPlanPath),
    (error) => error.code === 'ENOENT'
  );

  return {
    evidence,
    researchEvidence
  };
}

test('synthetic GitHub Remote Ingest requires Agent-selected research before analysis, rejects stale analysis, and preserves ownership on update', async () => {
  const root = await tempWorkspace();
  try {
    await writeRequest(root);
    const firstResearch = await prepareInitialResearch(root, 1);
    const firstAnalysis = analysisFrom(
      firstResearch.evidence,
      firstResearch.researchEvidence.bundle,
      1
    );
    await writeJson(path.join(handoffDir(root), 'analysis.json'), firstAnalysis);

    const firstApplied = runHandoff(root, 1);
    assert.equal(firstApplied.result.stage, 'applied');
    assert.equal(firstApplied.result.analysis_version, 2);
    assert.ok(firstApplied.result.research_state_path);

    const firstCardPath = path.join(root, ...firstApplied.result.card_path.split('/'));
    const firstSourcePath = path.join(root, ...firstApplied.result.source_state_path.split('/'));
    const firstResearchPath = path.join(root, ...firstApplied.result.research_state_path.split('/'));
    const originalCard = parseCardDocument(await fs.readFile(firstCardPath, 'utf8'), firstCardPath);
    const firstSourceState = await fs.readFile(firstSourcePath, 'utf8');
    const firstResearchStateRaw = await fs.readFile(firstResearchPath, 'utf8');
    const firstResearchState = validateResearchState(JSON.parse(firstResearchStateRaw));

    assert.equal(firstResearchState.repository_revision, 'a'.repeat(40));
    assert.equal(
      firstResearchState.analysis_evidence_digest,
      firstResearch.researchEvidence.bundle.analysis_evidence_digest
    );
    assert.doesNotMatch(firstResearchStateRaw, /"text"\s*:/u);
    await assert.rejects(fs.access(handoffDir(root)), (error) => error.code === 'ENOENT');

    let editedRaw = await fs.readFile(firstCardPath, 'utf8');
    const beforeOverride = editedRaw;
    editedRaw = editedRaw
      .replace(
        'resource_kind:\n  ai: project\n  user: null',
        'resource_kind:\n  ai: project\n  user: article'
      )
      .replace(
        /## 使用者備註[\s\S]*?## 更新紀錄/u,
        '## 使用者備註\n\nPreserve this E2E user note exactly.\n\n## 更新紀錄'
      );
    assert.notEqual(editedRaw, beforeOverride);
    await fs.writeFile(firstCardPath, editedRaw, 'utf8');

    await writeRequest(root);
    const secondResearch = await prepareInitialResearch(root, 2);
    assert.notEqual(
      secondResearch.researchEvidence.bundle.analysis_evidence_digest,
      firstResearch.researchEvidence.bundle.analysis_evidence_digest
    );

    const beforeStaleCard = await fs.readFile(firstCardPath, 'utf8');
    const beforeStaleSource = await fs.readFile(firstSourcePath, 'utf8');
    const beforeStaleResearch = await fs.readFile(firstResearchPath, 'utf8');
    await writeJson(path.join(handoffDir(root), 'analysis.json'), firstAnalysis);

    const stale = runHandoff(root, 2, { expectSuccess: false });
    assert.equal(stale.result.status, 'error');
    assert.equal(stale.result.code, 'ANALYSIS_EVIDENCE_STALE');
    assert.equal(await fs.readFile(firstCardPath, 'utf8'), beforeStaleCard);
    assert.equal(await fs.readFile(firstSourcePath, 'utf8'), beforeStaleSource);
    assert.equal(await fs.readFile(firstResearchPath, 'utf8'), beforeStaleResearch);

    const secondAnalysis = analysisFrom(
      secondResearch.evidence,
      secondResearch.researchEvidence.bundle,
      2
    );
    await writeJson(path.join(handoffDir(root), 'analysis.json'), secondAnalysis);
    const secondApplied = runHandoff(root, 2);

    assert.equal(secondApplied.result.stage, 'applied');
    assert.equal(secondApplied.result.mode, 'update');
    assert.equal(secondApplied.result.card_path, firstApplied.result.card_path);
    assert.equal(secondApplied.result.card_id, firstApplied.result.card_id);

    const cards = await loadCardDocuments(path.join(root, 'content', 'knowledge'));
    const matches = cards.filter((card) => card.data.source.identity === 'github:example/research-handoff');
    assert.equal(matches.length, 1);
    const updatedCard = matches[0];
    assert.equal(updatedCard.data.id, originalCard.data.id);
    assert.equal(updatedCard.data.created_at, originalCard.data.created_at);
    assert.equal(updatedCard.data.resource_kind.user, 'article');
    assert.match(updatedCard.body, /Preserve this E2E user note exactly\./u);
    assert.match(updatedCard.body, /validated before durable queue dispatch/u);

    const secondSourceState = JSON.parse(await fs.readFile(firstSourcePath, 'utf8'));
    const secondResearchStateRaw = await fs.readFile(firstResearchPath, 'utf8');
    const secondResearchState = validateResearchState(JSON.parse(secondResearchStateRaw));
    assert.equal(secondSourceState.evidence_digest, secondResearch.evidence.evidence_digest);
    assert.equal(secondResearchState.repository_revision, 'f'.repeat(40));
    assert.equal(
      secondResearchState.analysis_evidence_digest,
      secondResearch.researchEvidence.bundle.analysis_evidence_digest
    );
    assert.doesNotMatch(secondResearchStateRaw, /"text"\s*:/u);
    await assert.rejects(fs.access(handoffDir(root)), (error) => error.code === 'ENOENT');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
