import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ANALYSIS_SECTIONS,
  RESEARCH_COVERAGE_DIMENSIONS,
  bindAnalysisToEvidence,
  bindResearchAnalysisToEvidence,
  computeAnalysisEvidenceDigest
} from '../packages/analysis/src/index.js';
import { fetchGitHubEvidence } from '../packages/ingestion/src/index.js';
import { loadCardDocuments, parseCardDocument } from '../packages/core/src/index.js';
import { applyAcceptedGitHubAnalysis } from '../packages/workspace/src/card-store.js';
import {
  validateResearchState,
  validateResearchStateLinks
} from '../packages/workspace/src/research-state.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() { return body; }
  };
}

function metadata(overrides = {}) {
  return {
    full_name: 'example/research-project',
    html_url: 'https://github.com/example/research-project',
    description: 'Synthetic repository for research provenance tests.',
    homepage: null,
    default_branch: 'main',
    language: 'JavaScript',
    license: { spdx_id: 'MIT' },
    topics: ['synthetic', 'research'],
    archived: false,
    disabled: false,
    fork: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    pushed_at: '2026-09-18T00:00:00Z',
    ...overrides
  };
}

function readme(text = '# Research Project\n\nSynthetic accepted source evidence.') {
  return {
    type: 'file',
    encoding: 'base64',
    sha: 'readme-sha',
    content: Buffer.from(text, 'utf8').toString('base64')
  };
}

function githubFetch({ metadataValue = metadata(), readmeValue = readme() } = {}) {
  return async (url) => url.endsWith('/readme')
    ? response(200, readmeValue)
    : response(200, metadataValue);
}

async function acceptedEvidence({
  capturedAt = '2026-09-18T12:00:00Z',
  metadataValue = metadata(),
  readmeValue = readme()
} = {}) {
  return fetchGitHubEvidence('https://github.com/example/research-project', {
    fetchImpl: githubFetch({ metadataValue, readmeValue }),
    capturedAt
  });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function analysisEvidenceBundle(evidence, {
  revision = 'c'.repeat(40),
  text = '# Architecture\n\nThe API layer dispatches durable jobs to a worker service.'
} = {}) {
  const item = {
    evidence_id: 'architecture-doc',
    path: 'docs/architecture.md',
    kind: 'documentation',
    blob_sha: revision === 'c'.repeat(40) ? 'b'.repeat(40) : 'e'.repeat(40),
    content_sha256: sha256(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    text
  };
  const bundle = {
    research_version: 1,
    provider: 'github',
    source_identity: evidence.source_identity,
    source_evidence_digest: evidence.evidence_digest,
    repository_revision: revision,
    items: [item]
  };
  return {
    ...bundle,
    analysis_evidence_digest: computeAnalysisEvidenceDigest(bundle)
  };
}

function researchReport(bundle) {
  const evidenceRef = bundle.items[0].evidence_id;
  const coverage = Object.fromEntries(RESEARCH_COVERAGE_DIMENSIONS.map((dimension) => [dimension, {
    status: 'supported',
    evidence_refs: [evidenceRef],
    note: `Synthetic primary-source evidence supports ${dimension}.`
  }]));
  coverage.security = {
    status: 'unavailable',
    evidence_refs: [],
    unavailable_reason: 'not_found',
    note: 'No security-specific primary source was selected.'
  };
  coverage.license = {
    status: 'not_applicable',
    evidence_refs: [],
    note: 'License details are not material to this synthetic analysis.'
  };
  coverage.deployment = {
    status: 'unavailable',
    evidence_refs: [],
    unavailable_reason: 'source_limited',
    note: 'Deployment details are not present in the selected synthetic evidence.'
  };

  return {
    research_version: 1,
    provider: 'github',
    coverage,
    findings: {
      core_models: [{
        name: 'Request/job separation',
        description: 'Request handling is separated from durable background execution.',
        evidence_refs: [evidenceRef]
      }],
      architecture_components: [{
        name: 'API layer',
        responsibility: 'Accepts requests and dispatches durable work to the worker service.',
        evidence_refs: [evidenceRef]
      }],
      flows: [{
        name: 'Request to durable job',
        steps: ['Accept the API request', 'Dispatch a durable job to the worker service'],
        evidence_refs: [evidenceRef]
      }],
      implementation_checks: [{
        claim: 'Long-running work is dispatched to a worker service.',
        status: 'implemented',
        assessment: 'The selected architecture document explicitly describes this flow.',
        evidence_refs: [evidenceRef]
      }],
      technical_mechanisms: [{
        name: 'Durable job dispatch',
        mechanism: 'The API layer delegates longer work to a worker service through a durable job boundary.',
        why_it_matters: 'User-facing request latency is decoupled from background execution.',
        tradeoff: 'The job boundary adds retry, observability, and failure-recovery complexity.',
        evidence_refs: [evidenceRef]
      }],
      limitations: [{
        limitation: 'Authentication implementation is not described by the selected evidence.',
        impact: 'Authorization behavior cannot be treated as verified from this research bundle.',
        evidence_refs: [evidenceRef]
      }]
    },
    unknowns: ['Authentication implementation remains unknown.']
  };
}

function analysisTemplate({ title = 'Research Project', summary = 'Synthetic research-bound Knowledge Card analysis.' } = {}) {
  return {
    title,
    summary,
    resource_kind: 'project',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'research'],
    relevance: { overall: 4, engineering: 5 },
    actions: ['LEARN'],
    status: 'active',
    sections: Object.fromEntries(ANALYSIS_SECTIONS.map((heading) => [
      heading,
      `Synthetic research-bound section for ${heading}.`
    ]))
  };
}

function researchAnalysis(evidence, bundle, overrides = {}) {
  return bindResearchAnalysisToEvidence({
    ...analysisTemplate(overrides),
    research: researchReport(bundle)
  }, evidence, bundle);
}

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-research-state-'));
  await fs.cp(path.resolve('examples/synthetic-workspace'), root, { recursive: true });
  return root;
}

async function readThree(root, applied) {
  const cardPath = path.join(root, ...applied.card_path.split('/'));
  const sourcePath = path.join(root, ...applied.source_state_path.split('/'));
  const researchPath = path.join(root, ...applied.research_state_path.split('/'));
  return {
    cardPath,
    sourcePath,
    researchPath,
    card: await fs.readFile(cardPath, 'utf8'),
    source: await fs.readFile(sourcePath, 'utf8'),
    research: await fs.readFile(researchPath, 'utf8')
  };
}

test('research-bound GitHub writer persists compact provenance without source text', async () => {
  const root = await tempWorkspace();
  try {
    const evidence = await acceptedEvidence();
    const bundle = analysisEvidenceBundle(evidence);
    const analysis = researchAnalysis(evidence, bundle);
    const applied = await applyAcceptedGitHubAnalysis(root, evidence, analysis, {
      analysisEvidenceBundle: bundle
    });

    assert.equal(applied.analysis_version, 2);
    assert.equal(applied.analysis_evidence_digest, bundle.analysis_evidence_digest);
    assert.equal(applied.research_state_path, 'state/research/github/example--research-project.json');

    const researchPath = path.join(root, ...applied.research_state_path.split('/'));
    const state = validateResearchState(JSON.parse(await fs.readFile(researchPath, 'utf8')));
    assert.equal(state.repository_revision, bundle.repository_revision);
    assert.equal(state.analysis_evidence_digest, bundle.analysis_evidence_digest);
    assert.equal(state.source_evidence_digest, evidence.evidence_digest);
    assert.equal(state.evidence_items.length, 1);
    assert.equal(Object.hasOwn(state.evidence_items[0], 'text'), false);
    assert.equal(Object.hasOwn(state, 'findings'), false);
    assert.equal(Object.hasOwn(state, 'unknowns'), false);

    const cardPath = path.join(root, ...applied.card_path.split('/'));
    const sourcePath = path.join(root, ...applied.source_state_path.split('/'));
    const card = parseCardDocument(await fs.readFile(cardPath, 'utf8'), cardPath);
    const sourceState = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    assert.equal(validateResearchStateLinks(state, { card, sourceState }), state);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('research-bound update preserves stable/user-owned Card state and advances all provenance together', async () => {
  const root = await tempWorkspace();
  try {
    const firstEvidence = await acceptedEvidence();
    const firstBundle = analysisEvidenceBundle(firstEvidence);
    const first = await applyAcceptedGitHubAnalysis(
      root,
      firstEvidence,
      researchAnalysis(firstEvidence, firstBundle),
      { analysisEvidenceBundle: firstBundle }
    );

    const cardPath = path.join(root, ...first.card_path.split('/'));
    let raw = await fs.readFile(cardPath, 'utf8');
    const original = parseCardDocument(raw, cardPath);
    raw = raw
      .replace('resource_kind:\n  ai: project\n  user: null', 'resource_kind:\n  ai: project\n  user: article')
      .replace(/## 使用者備註[\s\S]*?## 更新紀錄/u, '## 使用者備註\n\nPreserve this research user note exactly.\n\n## 更新紀錄');
    await fs.writeFile(cardPath, raw, 'utf8');

    const secondEvidence = await acceptedEvidence({
      capturedAt: '2026-09-19T12:00:00Z',
      metadataValue: metadata({
        updated_at: '2026-09-19T00:00:00Z',
        pushed_at: '2026-09-19T00:00:00Z'
      })
    });
    const secondBundle = analysisEvidenceBundle(secondEvidence, {
      revision: 'd'.repeat(40),
      text: '# Architecture\n\nThe API layer validates requests before dispatching durable jobs to the worker service.'
    });
    const second = await applyAcceptedGitHubAnalysis(
      root,
      secondEvidence,
      researchAnalysis(secondEvidence, secondBundle, {
        summary: 'Updated synthetic research-bound analysis with a new revision.'
      }),
      { analysisEvidenceBundle: secondBundle }
    );

    assert.equal(second.mode, 'update');
    assert.equal(second.card_path, first.card_path);
    assert.equal(second.card_id, first.card_id);
    assert.equal(second.research_state_path, first.research_state_path);

    const cards = await loadCardDocuments(path.join(root, 'content/knowledge'));
    const card = cards.find((item) => item.data.source.identity === secondEvidence.source_identity);
    assert.ok(card);
    assert.equal(card.data.id, original.data.id);
    assert.equal(card.data.created_at, original.data.created_at);
    assert.equal(card.data.resource_kind.user, 'article');
    assert.match(card.body, /Preserve this research user note exactly\./u);

    const sourceState = JSON.parse(await fs.readFile(path.join(root, ...second.source_state_path.split('/')), 'utf8'));
    const researchState = validateResearchState(JSON.parse(
      await fs.readFile(path.join(root, ...second.research_state_path.split('/')), 'utf8')
    ));
    assert.equal(sourceState.evidence_digest, secondEvidence.evidence_digest);
    assert.equal(researchState.source_evidence_digest, secondEvidence.evidence_digest);
    assert.equal(researchState.analysis_evidence_digest, secondBundle.analysis_evidence_digest);
    assert.equal(researchState.repository_revision, secondBundle.repository_revision);
    assert.equal(validateResearchStateLinks(researchState, { card, sourceState }), researchState);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('version 1 GitHub update clears obsolete research provenance instead of leaving stale state', async () => {
  const root = await tempWorkspace();
  try {
    const firstEvidence = await acceptedEvidence();
    const firstBundle = analysisEvidenceBundle(firstEvidence);
    const first = await applyAcceptedGitHubAnalysis(
      root,
      firstEvidence,
      researchAnalysis(firstEvidence, firstBundle),
      { analysisEvidenceBundle: firstBundle }
    );
    const researchPath = path.join(root, ...first.research_state_path.split('/'));
    await fs.access(researchPath);

    const secondEvidence = await acceptedEvidence({
      capturedAt: '2026-09-19T12:00:00Z',
      metadataValue: metadata({
        updated_at: '2026-09-19T00:00:00Z',
        pushed_at: '2026-09-19T00:00:00Z'
      })
    });
    const version1 = bindAnalysisToEvidence(
      analysisTemplate({ summary: 'Version 1 fallback analysis without research provenance.' }),
      secondEvidence
    );
    const second = await applyAcceptedGitHubAnalysis(root, secondEvidence, version1);
    assert.equal(second.analysis_version, 1);
    assert.equal(second.research_state_path, null);
    await assert.rejects(fs.access(researchPath), (error) => error.code === 'ENOENT');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('research-bound validation failure leaves Card, source state, and research state unchanged', async () => {
  const root = await tempWorkspace();
  try {
    const firstEvidence = await acceptedEvidence();
    const firstBundle = analysisEvidenceBundle(firstEvidence);
    const first = await applyAcceptedGitHubAnalysis(
      root,
      firstEvidence,
      researchAnalysis(firstEvidence, firstBundle),
      { analysisEvidenceBundle: firstBundle }
    );
    const before = await readThree(root, first);

    const secondEvidence = await acceptedEvidence({
      capturedAt: '2026-09-19T12:00:00Z',
      metadataValue: metadata({
        updated_at: '2026-09-19T00:00:00Z',
        pushed_at: '2026-09-19T00:00:00Z'
      })
    });
    const secondBundle = analysisEvidenceBundle(secondEvidence, {
      revision: 'd'.repeat(40),
      text: '# Architecture\n\nUpdated synthetic architecture evidence.'
    });
    const invalid = researchAnalysis(secondEvidence, secondBundle);
    invalid.navigation_categories = ['NOT-IN-TAXONOMY'];

    await assert.rejects(
      applyAcceptedGitHubAnalysis(root, secondEvidence, invalid, {
        analysisEvidenceBundle: secondBundle
      }),
      (error) => error.code === 'CARD_VALIDATION_FAILED'
    );

    assert.equal(await fs.readFile(before.cardPath, 'utf8'), before.card);
    assert.equal(await fs.readFile(before.sourcePath, 'utf8'), before.source);
    assert.equal(await fs.readFile(before.researchPath, 'utf8'), before.research);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('research state validation rejects material not_applicable coverage and source/Card mismatches', async () => {
  const root = await tempWorkspace();
  try {
    const evidence = await acceptedEvidence();
    const bundle = analysisEvidenceBundle(evidence);
    const applied = await applyAcceptedGitHubAnalysis(
      root,
      evidence,
      researchAnalysis(evidence, bundle),
      { analysisEvidenceBundle: bundle }
    );

    const researchPath = path.join(root, ...applied.research_state_path.split('/'));
    const sourcePath = path.join(root, ...applied.source_state_path.split('/'));
    const cardPath = path.join(root, ...applied.card_path.split('/'));
    const state = JSON.parse(await fs.readFile(researchPath, 'utf8'));
    const sourceState = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    const card = parseCardDocument(await fs.readFile(cardPath, 'utf8'), cardPath);

    const shortcut = structuredClone(state);
    shortcut.coverage.architecture = { status: 'not_applicable', unavailable_reason: null };
    assert.throws(
      () => validateResearchState(shortcut),
      (error) => error.code === 'RESEARCH_STATE_INVALID'
    );

    const staleSource = structuredClone(sourceState);
    staleSource.evidence_digest = 'f'.repeat(64);
    assert.throws(
      () => validateResearchStateLinks(state, { card, sourceState: staleSource }),
      (error) => error.code === 'RESEARCH_STATE_SOURCE_MISMATCH'
    );

    const wrongCard = structuredClone(card);
    wrongCard.data.id = 'different-card';
    assert.throws(
      () => validateResearchStateLinks(state, { card: wrongCard, sourceState }),
      (error) => error.code === 'RESEARCH_STATE_CARD_MISMATCH'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Workspace validation workflow and package scripts include research provenance validation', async () => {
  const [workflow, packageJson] = await Promise.all([
    fs.readFile('.github/workflows/validate-workspace.yml', 'utf8'),
    fs.readFile('package.json', 'utf8')
  ]);
  assert.match(workflow, /validate-research-state\.mjs workspace/u);
  assert.equal(JSON.parse(packageJson).scripts['research-state:validate'], 'node scripts/validate-research-state.mjs');
});
