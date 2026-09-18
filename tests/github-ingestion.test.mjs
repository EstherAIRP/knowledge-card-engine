import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalizeSource,
  fetchGitHubEvidence,
  resolveIngestionTarget
} from '../packages/ingestion/src/index.js';
import { bindAnalysisToEvidence } from '../packages/analysis/src/index.js';
import { loadCardDocuments, parseCardDocument } from '../packages/core/src/index.js';
import { applyAcceptedGitHubAnalysis } from '../packages/workspace/src/card-store.js';

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    async json() { return body; }
  };
}

function githubFetch({ metadata, readme, metadataStatus = 200, readmeStatus = 200, throwStage = null }) {
  return async (url) => {
    if (throwStage === 'repository' && !url.endsWith('/readme')) throw new Error('network');
    if (throwStage === 'readme' && url.endsWith('/readme')) throw new Error('network');
    if (url.endsWith('/readme')) return response(readmeStatus, readme);
    return response(metadataStatus, metadata);
  };
}

function metadata(overrides = {}) {
  return {
    full_name: 'example/new-project',
    html_url: 'https://github.com/example/new-project',
    description: 'Synthetic repository for ingestion tests.',
    homepage: null,
    default_branch: 'main',
    language: 'JavaScript',
    license: { spdx_id: 'MIT' },
    topics: ['synthetic'],
    archived: false,
    disabled: false,
    fork: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    pushed_at: '2026-09-18T00:00:00Z',
    ...overrides
  };
}

function readme(text = '# New Project\n\nSynthetic evidence.') {
  return {
    type: 'file',
    encoding: 'base64',
    sha: 'abc123',
    content: Buffer.from(text, 'utf8').toString('base64')
  };
}

function analysisTemplate(evidence, overrides = {}) {
  return bindAnalysisToEvidence({
    title: 'New Project',
    summary: 'Synthetic repository analysis produced from accepted metadata and README evidence.',
    resource_kind: 'project',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'github'],
    relevance: { overall: 3, engineering: 4 },
    actions: ['LEARN'],
    status: 'active',
    sections: {
      '一句話介紹': 'Synthetic GitHub repository used to test the T05 ingestion path.',
      '它解決什麼問題': 'Validates provider evidence, deduplication, analysis binding, safe writes, and state advancement.',
      '核心概念': 'Accepted evidence is separated from analysis and from Workspace persistence.',
      '架構與技術': 'The fixture models a GitHub repository with metadata and README evidence.',
      '主要功能': 'Exercises create and update through the same validated write path.',
      '技術亮點': 'Analysis is cryptographically bound to the accepted evidence digest.',
      '限制與風險': 'This is synthetic test content and is not a real external project.',
      '與你的相關性': 'The synthetic taxonomy marks it as a developer-tool engineering reference.',
      '建議怎麼使用': 'Use only for automated contract testing.',
      '與其他收藏的關聯': 'It coexists with the existing synthetic example without sharing source identity.'
    },
    ...overrides
  }, evidence);
}

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-t05-'));
  await fs.cp(path.resolve('examples/synthetic-workspace'), root, { recursive: true });
  return root;
}

test('GitHub repository URL variants and subpaths collapse to one identity', () => {
  const variants = [
    'https://github.com/Example/New-Project',
    'https://www.github.com/Example/New-Project/',
    'https://github.com/Example/New-Project.git',
    'https://github.com/Example/New-Project?tab=readme-ov-file#readme',
    'https://github.com/Example/New-Project/tree/main/docs',
    'https://github.com/Example/New-Project/blob/main/README.md'
  ];
  const resolved = variants.map(canonicalizeSource);
  for (const item of resolved) {
    assert.equal(item.identity, 'github:example/new-project');
    assert.equal(item.canonicalUrl.toLowerCase(), 'https://github.com/example/new-project');
    assert.equal(item.suggestedId, 'github-example-new-project');
  }
});

test('generic canonicalization removes tracking and fragment but keeps meaningful query', () => {
  const item = canonicalizeSource('https://www.example.com/article/?id=42&utm_source=threads&fbclid=abc#part');
  assert.equal(item.canonicalUrl, 'https://example.com/article?id=42');
  assert.equal(item.identity, 'url:https://example.com/article?id=42');
});

test('GitHub provider accepts metadata + non-empty README and binds a digest', async () => {
  const evidence = await fetchGitHubEvidence('https://github.com/example/new-project/tree/main/docs', {
    fetchImpl: githubFetch({ metadata: metadata(), readme: readme() }),
    capturedAt: '2026-09-18T12:00:00Z'
  });
  assert.equal(evidence.accepted, true);
  assert.equal(evidence.source_identity, 'github:example/new-project');
  assert.match(evidence.readme.content_sha256, /^[0-9a-f]{64}$/);
  assert.match(evidence.evidence_digest, /^[0-9a-f]{64}$/);
  assert.equal(evidence.readme.text.includes('Synthetic evidence'), true);
});

test('GitHub provider separates execution, not-found, access, incomplete, and identity failures', async () => {
  await assert.rejects(
    fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: metadata(), readme: readme(), throwStage: 'repository' })
    }),
    (error) => error.code === 'INGESTION_EXECUTION_FAILED'
  );
  await assert.rejects(
    fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: {}, readme: readme(), metadataStatus: 404 })
    }),
    (error) => error.code === 'SOURCE_NOT_FOUND'
  );
  await assert.rejects(
    fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: {}, readme: readme(), metadataStatus: 401 })
    }),
    (error) => error.code === 'SOURCE_ACCESS_DENIED'
  );
  await assert.rejects(
    fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: metadata(), readme: {}, readmeStatus: 404 })
    }),
    (error) => error.code === 'SOURCE_INCOMPLETE'
  );
  await assert.rejects(
    fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: metadata({ full_name: 'other/repo', html_url: 'https://github.com/other/repo' }), readme: readme() })
    }),
    (error) => error.code === 'SOURCE_IDENTITY_MISMATCH'
  );
});

test('resolver prefers identity, then canonical URL, and fails on conflicts', () => {
  const source = {
    source_identity: 'github:example/new-project',
    canonical_url: 'https://github.com/example/new-project',
    suggested_id: 'github-example-new-project'
  };
  const a = { filePath: '/a.md', data: { source: { identity: source.source_identity }, canonical_url: 'https://github.com/a/a', id: 'a' } };
  const b = { filePath: '/b.md', data: { source: { identity: 'github:b/b' }, canonical_url: source.canonical_url, id: 'b' } };
  assert.throws(() => resolveIngestionTarget([a, b], source), (error) => error.code === 'INGESTION_IDENTITY_CONFLICT');
});

test('create then URL-variant update preserves stable path/id/date, user state, notes, and advances source state only after success', async () => {
  const root = await tempWorkspace();
  try {
    const firstEvidence = await fetchGitHubEvidence('https://github.com/example/new-project', {
      fetchImpl: githubFetch({ metadata: metadata(), readme: readme('# New Project\n\nVersion one.') }),
      capturedAt: '2026-09-18T12:00:00Z'
    });
    const first = await applyAcceptedGitHubAnalysis(root, firstEvidence, analysisTemplate(firstEvidence));
    assert.equal(first.mode, 'create');

    const firstCardPath = path.join(root, ...first.card_path.split('/'));
    let raw = await fs.readFile(firstCardPath, 'utf8');
    const original = parseCardDocument(raw, firstCardPath);
    raw = raw
      .replace('resource_kind:\n  ai: project\n  user: null', 'resource_kind:\n  ai: project\n  user: article')
      .replace(/## 使用者備註[\s\S]*?## 更新紀錄/, '## 使用者備註\n\nKeep this user note exactly.\n\n## 更新紀錄');
    await fs.writeFile(firstCardPath, raw, 'utf8');

    const secondEvidence = await fetchGitHubEvidence('https://www.github.com/example/new-project.git?tab=readme#top', {
      fetchImpl: githubFetch({ metadata: metadata({ updated_at: '2026-09-19T00:00:00Z', pushed_at: '2026-09-19T00:00:00Z' }), readme: readme('# New Project\n\nVersion two.') }),
      capturedAt: '2026-09-19T12:00:00Z'
    });
    const second = await applyAcceptedGitHubAnalysis(
      root,
      secondEvidence,
      analysisTemplate(secondEvidence, {
        summary: 'Updated synthetic analysis based on the second accepted README evidence.'
      })
    );
    assert.equal(second.mode, 'update');
    assert.equal(second.card_path, first.card_path);
    assert.equal(second.card_id, first.card_id);

    const cards = await loadCardDocuments(path.join(root, 'content/knowledge'));
    const matches = cards.filter((card) => card.data.source.identity === 'github:example/new-project');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].data.id, original.data.id);
    assert.equal(matches[0].data.created_at, original.data.created_at);
    assert.equal(matches[0].data.resource_kind.user, 'article');
    assert.match(matches[0].body, /Keep this user note exactly\./);

    const statePath = path.join(root, ...second.source_state_path.split('/'));
    const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
    assert.equal(state.evidence_digest, secondEvidence.evidence_digest);
    assert.equal(state.card_path, second.card_path);

    const priorState = await fs.readFile(statePath, 'utf8');
    const staleAnalysis = analysisTemplate(firstEvidence);
    await assert.rejects(
      applyAcceptedGitHubAnalysis(root, secondEvidence, staleAnalysis),
      (error) => error.code === 'ANALYSIS_EVIDENCE_STALE'
    );
    assert.equal(await fs.readFile(statePath, 'utf8'), priorState);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
