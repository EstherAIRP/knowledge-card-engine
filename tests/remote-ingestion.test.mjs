import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  assertGitHubEvidenceMatchesRequest,
  fetchGitHubEvidence,
  validateGitHubIngestionRequest
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

test('remote ingestion reusable workflow is branch-scoped and runs Node.js 24', async () => {
  const workflow = await fs.readFile('.github/workflows/ingest-workspace.yml', 'utf8');
  assert.match(workflow, /case "\$GITHUB_REF_NAME" in[\s\S]*chore\/ingest-\*/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /--reusable-workflow=ingest-workspace\.yml/);
  assert.match(workflow, /scripts\/ingest-github-handoff\.mjs/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
});
