import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  assertAcceptedEvidenceMatchesRequest,
  assertGitHubEvidenceMatchesRequest,
  fetchAcceptedEvidence,
  fetchGitHubEvidence,
  validateGitHubIngestionRequest,
  validateIngestionRequest
} from '../packages/ingestion/src/index.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() { return body; }
  };
}

function githubFetch() {
  const metadata = {
    full_name: 'example/remote-ingest',
    html_url: 'https://github.com/example/remote-ingest',
    description: 'Synthetic remote ingestion repository.',
    homepage: null,
    default_branch: 'main',
    language: 'JavaScript',
    license: { spdx_id: 'MIT' },
    topics: ['synthetic'],
    archived: false,
    disabled: false,
    fork: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    pushed_at: '2026-09-22T00:00:00Z'
  };
  const readme = {
    type: 'file',
    encoding: 'base64',
    sha: 'abc123',
    content: Buffer.from('# Remote Ingest\n\nSynthetic accepted evidence.', 'utf8').toString('base64')
  };
  return async (url) => url.endsWith('/readme') ? response(200, readme) : response(200, metadata);
}

test('remote ingestion request accepts only the exact GitHub request contract', () => {
  const request = validateGitHubIngestionRequest({
    schema_version: 1,
    provider: 'github',
    source_url: 'https://github.com/Example/Remote-Ingest/tree/main/docs'
  });
  assert.equal(request.source_url, 'https://github.com/Example/Remote-Ingest');
  assert.equal(request.source_identity, 'github:example/remote-ingest');

  assert.throws(
    () => validateGitHubIngestionRequest({
      schema_version: 1,
      provider: 'github',
      source_url: 'https://example.com/article'
    }),
    (error) => error.code === 'SOURCE_PROVIDER_UNSUPPORTED'
  );
  assert.throws(
    () => validateGitHubIngestionRequest({
      schema_version: 1,
      provider: 'github',
      source_url: 'https://github.com/example/remote-ingest',
      command: 'rm -rf /'
    }),
    (error) => error.code === 'REMOTE_INGEST_REQUEST_INVALID'
  );
});



test('remote ingestion request also accepts Threads share and post URLs without assigning share-token identity', () => {
  const share = validateIngestionRequest({
    schema_version: 1,
    provider: 'threads',
    source_url: 'https://www.threads.net/share/token123?utm_source=test#top'
  });
  assert.deepEqual(share, {
    schema_version: 1,
    provider: 'threads',
    source_url: 'https://threads.com/share/token123'
  });

  const post = validateIngestionRequest({
    schema_version: 1,
    provider: 'threads',
    source_url: 'https://threads.net/@alice/post/ROOT123?utm_source=test#top'
  });
  assert.equal(post.source_url, 'https://threads.com/@alice/post/ROOT123');
});

test('accepted evidence must match the normalized remote ingestion request', async () => {
  const request = validateGitHubIngestionRequest({
    schema_version: 1,
    provider: 'github',
    source_url: 'https://github.com/example/remote-ingest'
  });
  const evidence = await fetchGitHubEvidence(request.source_url, {
    fetchImpl: githubFetch(),
    capturedAt: '2026-09-22T01:00:00Z'
  });
  assert.equal(assertGitHubEvidenceMatchesRequest(request, evidence), evidence);
  assert.equal(assertAcceptedEvidenceMatchesRequest(request, evidence), evidence);

  const fetchedFromNormalizedRequest = await fetchAcceptedEvidence(request, {
    fetchImpl: githubFetch(),
    capturedAt: '2026-09-22T01:00:00Z'
  });
  assert.equal(fetchedFromNormalizedRequest.source_identity, request.source_identity);
  assert.equal(fetchedFromNormalizedRequest.evidence_digest, evidence.evidence_digest);

  const other = validateGitHubIngestionRequest({
    schema_version: 1,
    provider: 'github',
    source_url: 'https://github.com/example/other'
  });
  assert.throws(
    () => assertGitHubEvidenceMatchesRequest(other, evidence),
    (error) => error.code === 'SOURCE_IDENTITY_MISMATCH'
  );
});

test('remote ingestion reusable workflow is branch-scoped and persists only explicit handoff stages', async () => {
  const workflow = await fs.readFile('.github/workflows/ingest-workspace.yml', 'utf8');
  assert.match(workflow, /case "\$GITHUB_REF_NAME" in[\s\S]*chore\/ingest-\*/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /--reusable-workflow=ingest-workspace\.yml/);
  assert.match(workflow, /scripts\/ingest-handoff\.mjs/);
  assert.match(workflow, /startsWith\(steps\.handoff\.outputs\.stage, 'waiting-'\)/);
  assert.match(workflow, /research-prepared\)[\s\S]*prepare source research handoff/);
  assert.match(workflow, /research-expanded\)[\s\S]*expand source research evidence/);
  assert.equal((workflow.match(/validate-research-state\.mjs workspace/g) || []).length, 2);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
});

test('remote ingestion handoff contract includes bounded GitHub research files and writer binding', async () => {
  const syntax = spawnSync(process.execPath, ['--check', 'scripts/ingest-handoff.mjs'], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  const script = await fs.readFile('scripts/ingest-handoff.mjs', 'utf8');
  assert.match(script, /researchPlan:\s*'research-plan\.json'/);
  assert.match(script, /researchEvidence:\s*'research-evidence\.json'/);
  assert.match(script, /discoverGitHubResearchCandidates/);
  assert.match(script, /createGitHubResearchProgress/);
  assert.match(script, /bundle:\s*null/);
  assert.match(script, /waiting_for:\s*'research-plan'/);
  assert.match(script, /createAnalysisHandoff/);
  assert.match(script, /reread_required:\s*true/);
  assert.match(script, /input_paths:\s*inputPaths/);
  assert.match(script, /output_path:\s*handoffPaths\.analysis/);
  assert.doesNotMatch(script, /selectGitHubInitialResearchPaths/);
  assert.match(script, /fetchGitHubResearchExpansion/);
  assert.match(script, /analysisEvidenceBundle:\s*researchHandoff\.bundle/);
  assert.match(script, /applied\.research_state_path/);
  assert.match(script, /handoffPaths\.research_plan/);
  assert.match(script, /handoffPaths\.research_evidence/);
  assert.match(script, /Research handoff files are only valid for GitHub ingestion/);
  assert.match(script, /research-plan\.json and analysis\.json cannot exist at the same time/);
  assert.match(script, /REMOTE_INGEST_INPUT_COMMIT_INVALID/);
  assert.match(script, /diff-tree/);
  assert.match(script, /41898282\+github-actions\[bot\]@users\.noreply\.github\.com/);
  assert.match(script, /must directly follow the last runner-managed handoff commit/);
});
