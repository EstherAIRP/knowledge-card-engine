import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  ANALYSIS_SECTIONS,
  RESEARCH_COVERAGE_DIMENSIONS,
  RESEARCH_QUESTION_IDS,
  bindAnalysisToEvidence,
  bindResearchAnalysisToEvidence,
  computeAnalysisEvidenceDigest,
  validateAnalysisEvidenceBundle,
  validateAnalysisResult,
  validateResearchPlan,
  validateResearchReport
} from '../packages/analysis/src/index.js';

const sourceEvidence = Object.freeze({
  provider: 'github',
  source_identity: 'github:example/research-project',
  evidence_digest: 'a'.repeat(64)
});

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function researchPlan() {
  return {
    research_version: 1,
    provider: 'github',
    source_identity: sourceEvidence.source_identity,
    source_evidence_digest: sourceEvidence.evidence_digest,
    questions: Object.fromEntries(RESEARCH_QUESTION_IDS.map((id) => [id, {
      status: id === 'architecture' ? 'needs_evidence' : 'already_supported',
      rationale: id === 'architecture'
        ? 'README names components but does not explain their responsibilities.'
        : 'Accepted source evidence already supports this planning decision.',
      evidence_kinds: id === 'architecture' ? ['documentation', 'source'] : [],
      path_hints: id === 'architecture' ? ['docs/architecture.md', 'src/index.js'] : []
    }]))
  };
}

function evidenceItem({
  evidenceId = 'architecture-doc',
  path = 'docs/architecture.md',
  kind = 'documentation',
  blobSha = 'b'.repeat(40),
  text = '# Architecture\n\nWeb requests enter the API layer and then call the job service.'
} = {}) {
  return {
    evidence_id: evidenceId,
    path,
    kind,
    blob_sha: blobSha,
    content_sha256: sha256(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    text
  };
}

function analysisEvidenceBundle(items = [evidenceItem()]) {
  const bundle = {
    research_version: 1,
    provider: 'github',
    source_identity: sourceEvidence.source_identity,
    source_evidence_digest: sourceEvidence.evidence_digest,
    repository_revision: 'c'.repeat(40),
    items
  };
  return {
    ...bundle,
    analysis_evidence_digest: computeAnalysisEvidenceDigest(bundle)
  };
}

function researchReport(bundle) {
  const firstEvidenceId = bundle.items[0].evidence_id;
  const coverage = Object.fromEntries(RESEARCH_COVERAGE_DIMENSIONS.map((dimension) => [dimension, {
    status: 'supported',
    evidence_refs: [firstEvidenceId],
    note: `Synthetic evidence supports ${dimension}.`
  }]));
  coverage.security = {
    status: 'unavailable',
    evidence_refs: [],
    unavailable_reason: 'not_found',
    note: 'No security-specific primary source is present in this evidence bundle.'
  };
  coverage.license = {
    status: 'not_applicable',
    evidence_refs: [],
    note: 'License analysis is not material to this synthetic research result.'
  };
  return {
    research_version: 1,
    provider: 'github',
    coverage,
    findings: {
      core_models: [{
        name: 'Request pipeline',
        description: 'The project separates request handling from queued background work.',
        evidence_refs: [firstEvidenceId]
      }],
      architecture_components: [{
        name: 'API layer',
        responsibility: 'Accepts web requests and dispatches work to the job service.',
        evidence_refs: [firstEvidenceId]
      }],
      flows: [{
        name: 'Request to background job',
        steps: ['Accept request in API layer', 'Enqueue work in job service'],
        evidence_refs: [firstEvidenceId]
      }],
      implementation_checks: [{
        claim: 'Requests are forwarded to a background job service.',
        status: 'implemented',
        assessment: 'The synthetic architecture evidence explicitly describes the API-to-job flow.',
        evidence_refs: [firstEvidenceId]
      }],
      technical_mechanisms: [{
        name: 'API/job separation',
        mechanism: 'Synchronous request handling delegates longer work to a background job service.',
        why_it_matters: 'It separates user-facing latency from asynchronous work execution.',
        tradeoff: 'The queue boundary adds operational complexity and requires failure handling.',
        evidence_refs: [firstEvidenceId]
      }],
      limitations: [{
        limitation: 'The available evidence does not describe authentication implementation.',
        impact: 'Authorization behavior cannot be treated as verified.',
        evidence_refs: [firstEvidenceId]
      }]
    },
    unknowns: ['Authentication details remain unknown.']
  };
}

function analysisTemplate() {
  return {
    title: 'Research Project',
    summary: 'Synthetic analysis used to validate research-bound Knowledge Card analysis contracts.',
    resource_kind: 'project',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'research'],
    relevance: { overall: 4, engineering: 5 },
    actions: ['LEARN'],
    status: 'active',
    sections: Object.fromEntries(ANALYSIS_SECTIONS.map((heading) => [
      heading,
      `Synthetic section for ${heading}.`
    ]))
  };
}

test('analysis version 1 remains source-evidence bound and does not accept research-bound fields', () => {
  const v1 = bindAnalysisToEvidence(analysisTemplate(), sourceEvidence);
  assert.equal(validateAnalysisResult(v1, sourceEvidence), v1);

  assert.throws(
    () => validateAnalysisResult({ ...v1, evidence_digest: 'f'.repeat(64) }, sourceEvidence),
    (error) => error.code === 'ANALYSIS_EVIDENCE_STALE'
  );
  assert.throws(
    () => validateAnalysisResult({ ...v1, research: {} }, sourceEvidence),
    (error) => error.code === 'ANALYSIS_INVALID'
  );
});

test('research plan requires explicit material questions and safe evidence requests', () => {
  const plan = researchPlan();
  assert.equal(validateResearchPlan(plan, sourceEvidence), plan);

  const traversal = structuredClone(plan);
  traversal.questions.architecture.path_hints = ['../secrets.txt'];
  assert.throws(
    () => validateResearchPlan(traversal, sourceEvidence),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );

  const unsupportedRequest = structuredClone(plan);
  unsupportedRequest.questions.problem.evidence_kinds = ['source'];
  assert.throws(
    () => validateResearchPlan(unsupportedRequest, sourceEvidence),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );
});

test('analysis evidence bundle is revision pinned, content hashed, and digest stable across item ordering', () => {
  const first = evidenceItem({ evidenceId: 'doc', path: 'docs/architecture.md', blobSha: '1'.repeat(40) });
  const second = evidenceItem({
    evidenceId: 'auth',
    path: 'src/auth.js',
    kind: 'auth',
    blobSha: '2'.repeat(40),
    text: 'export function authorize(session) { return Boolean(session?.user); }'
  });
  const bundle = analysisEvidenceBundle([first, second]);
  assert.equal(validateAnalysisEvidenceBundle(bundle, sourceEvidence), bundle);

  const reorderedBase = {
    ...bundle,
    items: [second, first]
  };
  delete reorderedBase.analysis_evidence_digest;
  assert.equal(computeAnalysisEvidenceDigest(reorderedBase), bundle.analysis_evidence_digest);

  const changedItem = evidenceItem({
    evidenceId: 'auth',
    path: 'src/auth.js',
    kind: 'auth',
    blobSha: '3'.repeat(40),
    text: 'export function authorize(session) { return session?.role === "member"; }'
  });
  const changed = analysisEvidenceBundle([first, changedItem]);
  assert.notEqual(changed.analysis_evidence_digest, bundle.analysis_evidence_digest);

  const corrupted = structuredClone(bundle);
  corrupted.items[0].text += '\ncorrupted';
  assert.throws(
    () => validateAnalysisEvidenceBundle(corrupted, sourceEvidence),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );
});

test('research report requires evidence refs for supported coverage and explicit reasons for unavailable coverage', () => {
  const bundle = analysisEvidenceBundle();
  const report = researchReport(bundle);
  assert.equal(validateResearchReport(report, bundle), report);

  const missingRef = structuredClone(report);
  missingRef.coverage.architecture.evidence_refs = [];
  assert.throws(
    () => validateResearchReport(missingRef, bundle),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );

  const unavailableWithoutReason = structuredClone(report);
  delete unavailableWithoutReason.coverage.security.unavailable_reason;
  assert.throws(
    () => validateResearchReport(unavailableWithoutReason, bundle),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );
});

test('GitHub quality gate requires structured findings instead of prose-only coverage notes', () => {
  const bundle = analysisEvidenceBundle();
  const report = researchReport(bundle);

  const noArchitectureFinding = structuredClone(report);
  noArchitectureFinding.findings.architecture_components = [];
  assert.throws(
    () => validateResearchReport(noArchitectureFinding, bundle),
    (error) => error.code === 'ANALYSIS_QUALITY_GATE_FAILED'
  );

  const weakMechanism = structuredClone(report);
  weakMechanism.findings.technical_mechanisms[0].tradeoff = '';
  assert.throws(
    () => validateResearchReport(weakMechanism, bundle),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );

  const singleStepFlow = structuredClone(report);
  singleStepFlow.findings.flows[0].steps = ['Only one step'];
  assert.throws(
    () => validateResearchReport(singleStepFlow, bundle),
    (error) => error.code === 'ANALYSIS_RESEARCH_INVALID'
  );
});

test('GitHub quality gate allows explicit unavailable material coverage but rejects not_applicable shortcuts', () => {
  const bundle = analysisEvidenceBundle();
  const unavailable = researchReport(bundle);
  unavailable.coverage.architecture = {
    status: 'unavailable',
    evidence_refs: [],
    unavailable_reason: 'not_found',
    note: 'No architecture evidence was found within the bounded research scope.'
  };
  unavailable.findings.architecture_components = [];
  assert.equal(validateResearchReport(unavailable, bundle), unavailable);

  const shortcut = researchReport(bundle);
  shortcut.coverage.architecture = {
    status: 'not_applicable',
    evidence_refs: [],
    note: 'Architecture omitted.'
  };
  shortcut.findings.architecture_components = [];
  assert.throws(
    () => validateResearchReport(shortcut, bundle),
    (error) => error.code === 'ANALYSIS_QUALITY_GATE_FAILED'
  );
});

test('analysis version 2 binds source evidence, analysis evidence, and structured research coverage', () => {
  const bundle = analysisEvidenceBundle();
  const v2 = bindResearchAnalysisToEvidence({
    ...analysisTemplate(),
    research: researchReport(bundle)
  }, sourceEvidence, bundle);

  assert.equal(v2.analysis_version, 2);
  assert.equal(v2.source_evidence_digest, sourceEvidence.evidence_digest);
  assert.equal(v2.analysis_evidence_digest, bundle.analysis_evidence_digest);
  assert.equal(validateAnalysisResult(v2, sourceEvidence, bundle), v2);

  assert.throws(
    () => validateAnalysisResult(
      { ...v2, analysis_evidence_digest: 'f'.repeat(64) },
      sourceEvidence,
      bundle
    ),
    (error) => error.code === 'ANALYSIS_RESEARCH_EVIDENCE_STALE'
  );

  const staleSource = { ...sourceEvidence, evidence_digest: 'd'.repeat(64) };
  assert.throws(
    () => validateAnalysisResult(v2, staleSource, bundle),
    (error) => ['ANALYSIS_EVIDENCE_STALE', 'ANALYSIS_RESEARCH_EVIDENCE_STALE'].includes(error.code)
  );
});

test('research contracts currently fail closed for providers without a research evidence contract', () => {
  const threadsEvidence = {
    provider: 'threads',
    source_identity: 'threads:ROOT123',
    evidence_digest: 'e'.repeat(64)
  };
  const plan = {
    ...researchPlan(),
    provider: 'threads',
    source_identity: threadsEvidence.source_identity,
    source_evidence_digest: threadsEvidence.evidence_digest
  };
  assert.throws(
    () => validateResearchPlan(plan, threadsEvidence),
    (error) => error.code === 'ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED'
  );
});
