import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoverGitHubResearchCandidates,
  fetchGitHubEvidence,
  fetchGitHubResearchEvidence,
  validateGitHubResearchDiscovery
} from '../packages/ingestion/src/index.js';
import { validateAnalysisEvidenceBundle } from '../packages/analysis/src/index.js';

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
  'src/jobs.js': { sha: '6'.repeat(40), text: 'export async function runJob(queue, payload) { return queue.add(payload); }\n' }
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
      { ...fileEntry('src/jobs.js'), path: 'jobs.js' }
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
  assert.equal(candidates.has('logo.png'), false);
  assert.equal([...candidates.keys()].some((path) => path.startsWith('vendor/')), false);
  assert.equal(validateGitHubResearchDiscovery(discovery, evidence), discovery);
});

test('GitHub research evidence only fetches approved candidates and produces a valid analysis evidence bundle', async () => {
  const fetchImpl = githubResearchFetch();
  const evidence = await acceptedEvidence(fetchImpl);
  const discovery = await discoverGitHubResearchCandidates(evidence, { fetchImpl });
  const bundle = await fetchGitHubResearchEvidence(
    evidence,
    discovery,
    ['src/auth.js', 'docs/architecture.md'],
    { fetchImpl }
  );

  assert.equal(bundle.repository_revision, REVISION);
  assert.equal(bundle.items.length, 2);
  assert.deepEqual(bundle.items.map((item) => item.path), ['docs/architecture.md', 'src/auth.js']);
  assert.equal(validateAnalysisEvidenceBundle(bundle, evidence), bundle);
  assert.match(bundle.analysis_evidence_digest, /^[0-9a-f]{64}$/u);

  await assert.rejects(
    fetchGitHubResearchEvidence(evidence, discovery, ['vendor/secret.js'], { fetchImpl }),
    (error) => error.code === 'GITHUB_RESEARCH_PATH_NOT_CANDIDATE'
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
