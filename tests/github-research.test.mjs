import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGitHubResearchProgress,
  discoverGitHubResearchCandidates,
  evaluateGitHubResearchContinuation,
  fetchGitHubEvidence,
  fetchGitHubResearchEvidence,
  fetchGitHubResearchExpansion,
  validateGitHubResearchDiscovery,
  validateGitHubResearchProgress
} from '../packages/ingestion/src/index.js';
import {
  RESEARCH_QUESTION_IDS,
  validateAnalysisEvidenceBundle
} from '../packages/analysis/src/index.js';

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    async json() { return body; }
  };
}

const REVISION = 'a'.repeat(40);
const ROOT_TREE = 'b'.repeat(40);
const DOCS_TREE = 'c'.repeat(40);
const SRC_TREE = 'd'.repeat(40);
const VENDOR_TREE = 'e'.repeat(40);

const files = {
  'README.md': { sha: '1'.repeat(40), text: '# Research Project\n\nREADME describes the product but not its internal architecture.' },
  'package.json': { sha: '2'.repeat(40), text: '{"name":"research-project","scripts":{"start":"node src/index.js"}}\n' },
  LICENSE: { sha: '3'.repeat(40), text: 'Synthetic license text.\n' },
  'docs/architecture.md': { sha: '4'.repeat(40), text: '# Architecture\n\nRequests enter the API layer, then enqueue background jobs.\n' },
  'src/auth.js': { sha: '5'.repeat(40), text: 'export function authorize(session) { return Boolean(session?.user); }\n' },
  'src/jobs.js': { sha: '6'.repeat(40), text: 'export async function runJob(queue, payload) { return queue.add(payload); }\n' },
  'src/session-store.js': { sha: '8'.repeat(40), text: 'export function readSession(store, id) { return store.get(id); }\n' },
  'skills/core/SKILL.md': { sha: '9'.repeat(40), text: '# Core Skill\n\nThis primary-source skill defines the repository workflow model.\n' }
};

function fileEntry(path, type = 'blob') {
  const file = files[path];
  return {
    path: path.split('/').at(-1),
    type,
    sha: type === 'blob' ? file.sha : null,
    size: type === 'blob' ? Buffer.byteLength(file.text, 'utf8') : undefined
  };
}

function treeEntry(path, sha) {
  return { path, type: 'tree', sha };
}

function githubResearchFetch({ researchReadmeSha = files['README.md'].sha } = {}) {
  const metadata = {
    full_name: 'example/research-project',
    html_url: 'https://github.com/example/research-project',
    description: 'Synthetic repository for research evidence tests.',
    homepage: null,
    default_branch: 'main',
    language: 'JavaScript',
    license: { spdx_id: 'MIT' },
    topics: ['synthetic', 'research'],
    archived: false,
    disabled: false,
    fork: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-23T00:00:00Z',
    pushed_at: '2026-09-23T00:00:00Z'
  };

  const acceptedReadme = {
    type: 'file',
    encoding: 'base64',
    sha: files['README.md'].sha,
    content: Buffer.from(files['README.md'].text, 'utf8').toString('base64')
  };

  const rootTree = {
    truncated: false,
    tree: [
      { ...fileEntry('README.md'), path: 'README.md' },
      { ...fileEntry('package.json'), path: 'package.json' },
      { ...fileEntry('LICENSE'), path: 'LICENSE' },
      treeEntry('docs', DOCS_TREE),
      treeEntry('src', SRC_TREE),
      treeEntry('vendor', VENDOR_TREE),
      { path: 'logo.png', type: 'blob', sha: '7'.repeat(40), size: 2048 }
    ]
  };
  const docsTree = {
    truncated: false,
    tree: [
      { ...fileEntry('docs/architecture.md'), path: 'architecture.md' }
    ]
  };
  const srcTree = {
    truncated: false,
    tree: [
      { ...fileEntry('src/auth.js'), path: 'auth.js' },
      { ...fileEntry('src/jobs.js'), path: 'jobs.js' },
      { ...fileEntry('src/session-store.js'), path: 'session-store.js' }
    ]
  };

  const bySha = new Map(Object.values(files).map((file) => [file.sha, file]));

  return async (url) => {
    const value = String(url);
    if (value.endsWith('/commits/main')) {
      return response(200, {
        sha: REVISION,
        commit: { tree: { sha: ROOT_TREE } }
      });
    }
    if (value.includes('/readme?ref=')) {
      return response(200, {
        ...acceptedReadme,
        sha: researchReadmeSha
      });
    }
    if (value.endsWith('/readme')) return response(200, acceptedReadme);
    if (value.endsWith('/git/trees/' + ROOT_TREE)) return response(200, rootTree);
    if (value.endsWith('/git/trees/' + DOCS_TREE)) return response(200, docsTree);
    if (value.endsWith('/git/trees/' + SRC_TREE)) return response(200, srcTree);
    if (value.includes('/git/trees/' + VENDOR_TREE)) throw new Error('vendor directory should not be traversed');
    const contentsMatch = /\/contents\/(.+)\?ref=[^&]+$/u.exec(value);
    if (contentsMatch) {
      const filePath = contentsMatch[1]
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');
      const file = files[filePath];
      if (!file) return response(404, {});
      return response(200, {
        type: 'file',
        path: filePath,
        sha: file.sha,
        size: Buffer.byteLength(file.text, 'utf8')
      });
    }
    const blobMatch = /\/git\/blobs\/([0-9a-f]{40})$/u.exec(value);
    if (blobMatch) {
      const file = bySha.get(blobMatch[1]);
      if (!file) return response(404, {});
      return response(200, {
        sha: file.sha,
        encoding: 'base64',
        size: Buffer.byteLength(file.text, 'utf8'),
        content: Buffer.from(file.text, 'utf8').toString('base64')
      });
    }
    if (value.endsWith('/repos/example/research-project')) return response(200, metadata);
    throw new Error('Unexpected GitHub test URL: ' + value);
  };
}

async function acceptedEvidence(fetchImpl = githubResearchFetch()) {
  return fetchGitHubEvidence('https://github.com/example/research-project', {
    fetchImpl,
    capturedAt: '2026-09-23T05:00:00Z'
  });
}

function researchPlan({
  priorAnalysisEvidenceDigest = null,
  needs = {
    architecture: {
      evidence_kinds: ['documentation', 'source'],
      path_hints: ['docs/architecture.md']
    }
  }
} = {}) {
  const plan = {
    research_version: 1,
    provider: 'github',
    source_identity: 'github:example/research-project',
    source_evidence_digest: null,
    questions: Object.fromEntries(RESEARCH_QUESTION_IDS.map((questionId) => {
      const request = needs[questionId];
      return [questionId, {
        status: request ? 'needs_evidence' : 'already_supported',
        rationale: request
          ? `Additional primary-source evidence is required for ${questionId}.`
          : `Accepted or accumulated evidence already supports ${questionId}.`,
        evidence_kinds: request?.evidence_kinds || [],
        path_hints: request?.path_hints || []
      }];
    }))
  };
  if (priorAnalysisEvidenceDigest != null) {
    plan.prior_analysis_evidence_digest = priorAnalysisEvidenceDigest;
  }
  return plan;
}

function bindPlan(plan, evidence) {
  return {
    ...plan,
    source_identity: evidence.source_identity,
    source_evidence_digest: evidence.evidence_digest
  };
}

test('GitHub research discovery pins one revision and prioritizes bounded primary-source candidates', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });

  assert.equal(discovery.repository_revision, REVISION);
  assert.equal(discovery.root_tree_sha, ROOT_TREE);
  assert.equal(discovery.source_evidence_digest, evidence.evidence_digest);
  assert.equal(discovery.discovery.exhaustive, true);
  assert.deepEqual(discovery.discovery.stop_reasons, []);
  assert.ok(discovery.discovery.excluded_directories >= 1);

  const candidates = new Map(discovery.candidates.map((candidate) => [candidate.path, candidate]));
  assert.equal(candidates.get('README.md')?.kind, 'readme');
  assert.equal(candidates.get('package.json')?.kind, 'manifest');
  assert.equal(candidates.get('docs/architecture.md')?.kind, 'documentation');
  assert.equal(candidates.get('src/auth.js')?.kind, 'auth');
  assert.equal(candidates.get('src/jobs.js')?.kind, 'background_job');
  assert.equal(candidates.get('src/session-store.js')?.kind, 'source');
  assert.equal(candidates.has('logo.png'), false);
  assert.equal([...candidates.keys()].some((path) => path.startsWith('vendor/')), false);
  assert.equal(validateGitHubResearchDiscovery(discovery, evidence), discovery);
});

test('GitHub research evidence resolves agent-selected safe paths at the pinned revision', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  assert.equal(discovery.candidates.some((candidate) => candidate.path === 'skills/core/SKILL.md'), false);

  const bundle = await fetchGitHubResearchEvidence(
    evidence,
    discovery,
    ['src/auth.js', 'skills/core/SKILL.md'],
    { fetchImpl }
  );

  assert.equal(bundle.repository_revision, REVISION);
  assert.equal(bundle.items.length, 2);
  assert.deepEqual(bundle.items.map((item) => item.path), ['skills/core/SKILL.md', 'src/auth.js']);
  assert.equal(bundle.items.find((item) => item.path === 'skills/core/SKILL.md')?.kind, 'documentation');
  assert.equal(validateAnalysisEvidenceBundle(bundle, evidence), bundle);
  assert.match(bundle.analysis_evidence_digest, /^[0-9a-f]{64}$/u);

  await assert.rejects(
    fetchGitHubResearchEvidence(evidence, discovery, ['vendor/secret.js'], { fetchImpl }),
    (error) => error.code === 'GITHUB_RESEARCH_PATH_EXCLUDED'
  );
});

test('GitHub research limits can be lowered by callers but cannot be bypassed through selection', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, {
    fetchImpl,
    limits: { max_tree_requests: 1 }
  });

  assert.equal(discovery.discovery.exhaustive, false);
  assert.ok(discovery.discovery.stop_reasons.includes('tree_request_budget_exhausted'));
  assert.equal(discovery.candidates.some((candidate) => candidate.path === 'package.json'), true);
  assert.equal(discovery.candidates.some((candidate) => candidate.path === 'docs/architecture.md'), false);

  const fullDiscovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  await assert.rejects(
    fetchGitHubResearchEvidence(
      evidence,
      fullDiscovery,
      ['docs/architecture.md', 'src/auth.js'],
      { fetchImpl, limits: { max_selected_items: 1 } }
    ),
    (error) => error.code === 'GITHUB_RESEARCH_BUDGET_EXCEEDED'
  );
});

test('GitHub research fails closed when README changed after accepted source evidence', async () => {
  const fetchImpl = githubResearchFetch({ researchReadmeSha: 'f'.repeat(40) });
  const evidence = await acceptedEvidence(fetchImpl);

  await assert.rejects(
    discoverGitHubResearchCandidates(evidence, { fetchImpl }),
    (error) => error.code === 'SOURCE_RESEARCH_STALE'
  );
});


test('GitHub bounded research expansion accumulates evidence across at most two digest-bound rounds', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  const initialProgress = createGitHubResearchProgress(evidence, discovery);

  const firstPlan = bindPlan(researchPlan({
    needs: {
      core_model: {
        evidence_kinds: ['documentation'],
        path_hints: ['skills/core/SKILL.md']
      }
    }
  }), evidence);
  const firstDecision = evaluateGitHubResearchContinuation(
    firstPlan,
    evidence,
    discovery,
    initialProgress
  );
  assert.equal(firstDecision.action, 'expand');
  assert.equal(firstDecision.reason, 'needs_evidence');
  assert.equal(firstDecision.next_round, 1);
  assert.equal(firstDecision.remaining.rounds, 2);

  const first = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    firstPlan,
    initialProgress,
    ['skills/core/SKILL.md'],
    { fetchImpl }
  );
  assert.equal(first.round, 1);
  assert.equal(first.progress.completed_rounds, 1);
  assert.deepEqual(first.progress.selected_paths, ['skills/core/SKILL.md']);
  assert.equal(first.bundle.items.length, 1);
  assert.equal(validateGitHubResearchProgress(first.progress, evidence, discovery, first.bundle), first.progress);

  const secondPlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: first.bundle.analysis_evidence_digest,
    needs: {
      implementation_support: {
        evidence_kinds: ['auth', 'source'],
        path_hints: ['src/auth.js']
      }
    }
  }), evidence);
  const secondDecision = evaluateGitHubResearchContinuation(
    secondPlan,
    evidence,
    discovery,
    first.progress,
    first.bundle
  );
  assert.equal(secondDecision.action, 'expand');
  assert.equal(secondDecision.next_round, 2);

  const second = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    secondPlan,
    first.progress,
    ['src/auth.js'],
    { previousBundle: first.bundle, fetchImpl }
  );
  assert.equal(second.progress.completed_rounds, 2);
  assert.deepEqual(second.progress.selected_paths, ['skills/core/SKILL.md', 'src/auth.js']);
  assert.deepEqual(second.bundle.items.map((item) => item.path), ['skills/core/SKILL.md', 'src/auth.js']);
  assert.notEqual(second.bundle.analysis_evidence_digest, first.bundle.analysis_evidence_digest);

  const stillNeedsEvidence = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: second.bundle.analysis_evidence_digest,
    needs: {
      flow: {
        evidence_kinds: ['background_job'],
        path_hints: ['src/jobs.js']
      }
    }
  }), evidence);
  const stopped = evaluateGitHubResearchContinuation(
    stillNeedsEvidence,
    evidence,
    discovery,
    second.progress,
    second.bundle
  );
  assert.equal(stopped.action, 'stop');
  assert.equal(stopped.reason, 'round_budget_exhausted');
  assert.equal(stopped.remaining.rounds, 0);
});

test('GitHub research retry rejects stale plans, repeated paths, and evidence unrelated to needs_evidence questions', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  const initial = createGitHubResearchProgress(evidence, discovery);
  const firstPlan = bindPlan(researchPlan(), evidence);
  const first = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    firstPlan,
    initial,
    ['docs/architecture.md'],
    { fetchImpl }
  );

  const stalePlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: 'f'.repeat(64),
    needs: {
      implementation_support: {
        evidence_kinds: ['auth'],
        path_hints: ['src/auth.js']
      }
    }
  }), evidence);
  assert.throws(
    () => evaluateGitHubResearchContinuation(
      stalePlan,
      evidence,
      discovery,
      first.progress,
      first.bundle
    ),
    (error) => error.code === 'GITHUB_RESEARCH_PLAN_STALE'
  );

  const unrelatedPlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: first.bundle.analysis_evidence_digest,
    needs: {
      architecture: {
        evidence_kinds: ['documentation'],
        path_hints: ['docs/architecture.md']
      }
    }
  }), evidence);
  await assert.rejects(
    fetchGitHubResearchExpansion(
      evidence,
      discovery,
      unrelatedPlan,
      first.progress,
      ['src/auth.js'],
      { previousBundle: first.bundle, fetchImpl }
    ),
    (error) => error.code === 'GITHUB_RESEARCH_SELECTION_NOT_REQUESTED'
  );

  const repeatPlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: first.bundle.analysis_evidence_digest,
    needs: {
      architecture: {
        evidence_kinds: ['documentation'],
        path_hints: ['docs/architecture.md']
      }
    }
  }), evidence);
  await assert.rejects(
    fetchGitHubResearchExpansion(
      evidence,
      discovery,
      repeatPlan,
      first.progress,
      ['docs/architecture.md'],
      { previousBundle: first.bundle, fetchImpl }
    ),
    (error) => error.code === 'GITHUB_RESEARCH_SELECTION_REPEATED'
  );
});

test('GitHub research continuation stops deterministically for complete plans and cumulative budgets', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, {
    fetchImpl,
    limits: { max_selected_items: 1 }
  });
  const initial = createGitHubResearchProgress(evidence, discovery);

  const completePlan = bindPlan(researchPlan({ needs: {} }), evidence);
  const complete = evaluateGitHubResearchContinuation(
    completePlan,
    evidence,
    discovery,
    initial
  );
  assert.equal(complete.action, 'stop');
  assert.equal(complete.reason, 'plan_complete');

  const firstPlan = bindPlan(researchPlan(), evidence);
  const first = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    firstPlan,
    initial,
    ['docs/architecture.md'],
    { fetchImpl }
  );
  const retryPlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: first.bundle.analysis_evidence_digest,
    needs: {
      implementation_support: {
        evidence_kinds: ['auth'],
        path_hints: ['src/auth.js']
      }
    }
  }), evidence);
  const exhausted = evaluateGitHubResearchContinuation(
    retryPlan,
    evidence,
    discovery,
    first.progress,
    first.bundle
  );
  assert.equal(exhausted.action, 'stop');
  assert.equal(exhausted.reason, 'item_budget_exhausted');
  assert.equal(exhausted.remaining.items, 0);
});

test('GitHub research expansion enforces the remaining cumulative item budget after Agent path selection', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, {
    fetchImpl,
    limits: { max_selected_items: 2 }
  });
  const initial = createGitHubResearchProgress(evidence, discovery);
  const firstPlan = bindPlan(researchPlan(), evidence);
  const first = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    firstPlan,
    initial,
    ['docs/architecture.md'],
    { fetchImpl }
  );

  const secondPlan = bindPlan(researchPlan({
    priorAnalysisEvidenceDigest: first.bundle.analysis_evidence_digest,
    needs: {
      implementation_support: {
        evidence_kinds: ['auth', 'background_job'],
        path_hints: ['src/auth.js', 'src/jobs.js']
      }
    }
  }), evidence);

  await assert.rejects(
    fetchGitHubResearchExpansion(
      evidence,
      discovery,
      secondPlan,
      first.progress,
      ['src/auth.js', 'src/jobs.js'],
      { previousBundle: first.bundle, fetchImpl }
    ),
    (error) => error.code === 'GITHUB_RESEARCH_BUDGET_EXCEEDED'
  );
});

test('GitHub research progress is derived from the current cumulative bundle and fails closed on tampering', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  const initial = createGitHubResearchProgress(evidence, discovery);
  const plan = bindPlan(researchPlan(), evidence);
  const first = await fetchGitHubResearchExpansion(
    evidence,
    discovery,
    plan,
    initial,
    ['docs/architecture.md'],
    { fetchImpl }
  );

  const tampered = {
    ...first.progress,
    total_bytes: first.progress.total_bytes + 1
  };
  assert.throws(
    () => validateGitHubResearchProgress(tampered, evidence, discovery, first.bundle),
    (error) => error.code === 'GITHUB_RESEARCH_PROGRESS_INVALID'
  );
});
