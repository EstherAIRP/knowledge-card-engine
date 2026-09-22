import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  parseCardDocument,
  parseTaxonomyDocument
} from '../packages/core/src/index.js';
import { buildGeneratedArtifacts } from '../packages/graph/src/index.js';
import {
  GENERATED_ARTIFACT_PATHS,
  createManifest,
  createReleaseDescription,
  createReleasePointer,
  releaseDescriptionPath,
  serializeJson
} from '../packages/release/src/index.js';
import { createWorkspaceRepositoryReader } from '../apps/server/src/workspace-reader.js';

const E = 'a'.repeat(40);
const S = 'b'.repeat(40);
const P = 'c'.repeat(40);
const Q = 'd'.repeat(40);
const P_TREE = 'e'.repeat(40);
const Q_TREE = 'f'.repeat(40);
const AT = '2026-09-19T00:00:00.000Z';
const RELEASE_ID = 'release-reader-fixture';

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function blob(text) {
  return {
    encoding: 'base64',
    size: Buffer.byteLength(text, 'utf8'),
    content: Buffer.from(text, 'utf8').toString('base64')
  };
}

async function fixture() {
  const taxonomyText = await fs.readFile(new URL('../examples/synthetic-workspace/config/taxonomy.yaml', import.meta.url), 'utf8');
  const firstText = await fs.readFile(new URL('../examples/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md', import.meta.url), 'utf8');
  const secondText = firstText
    .replaceAll('synthetic-example-project', 'synthetic-second-project')
    .replaceAll('Synthetic Example Project', 'Synthetic Second Project')
    .replaceAll('https://github.com/example/synthetic-example', 'https://github.com/example/synthetic-second')
    .replaceAll('github:example/synthetic-example', 'github:example/synthetic-second')
    .replaceAll('contract-test', 'shared-tag');

  const first = parseCardDocument(firstText, 'content/knowledge/2026/synthetic-example-project.md');
  const second = parseCardDocument(secondText, 'content/knowledge/2026/synthetic-second-project.md');
  parseTaxonomyDocument(taxonomyText);

  const artifacts = buildGeneratedArtifacts([first, second], {
    engineSha: E,
    sourceSha: S,
    generatedAt: AT,
    relationConfig: { min_score: 0.01, top_k: 8 },
    conceptConfig: {
      extraction: {
        minimum_tag_support: 2,
        concept_relation_min_support: 2,
        concept_relation_top_k: 8
      }
    }
  });

  const artifactTexts = {
    'data/search.json': serializeJson(artifacts.search),
    'data/vectors.json': serializeJson(artifacts.vectors),
    'data/relations.json': serializeJson(artifacts.relations),
    'data/concepts.json': serializeJson(artifacts.concepts),
    'data/graph.json': serializeJson(artifacts.graph)
  };
  const manifest = createManifest(artifactTexts, {
    engineSha: E,
    sourceSha: S,
    createdAt: AT
  });
  const release = createReleaseDescription({
    releaseId: RELEASE_ID,
    engineSha: E,
    sourceSha: S,
    publishedSha: P,
    manifest,
    buildMode: 'incremental',
    createdAt: AT
  });
  const pointer = createReleasePointer({
    releaseId: RELEASE_ID,
    updatedAt: AT
  });

  return {
    taxonomyText,
    cards: {
      'content/knowledge/2026/synthetic-example-project.md': firstText,
      'content/knowledge/2026/synthetic-second-project.md': secondText
    },
    artifactTexts,
    release,
    pointer
  };
}

async function harness({ tamper = null, removePointer = false, blobDelayMs = 0 } = {}) {
  const data = await fixture();
  if (tamper) data.artifactTexts[tamper] += ' ';

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = {
    githubAppId: '123',
    githubPrivateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    githubInstallationId: '42',
    workspaceOwner: 'example-owner',
    workspaceRepo: 'example-workspace',
    workspaceRef: 'main'
  };

  let blobCounter = 0;
  const blobs = new Map();
  let activeBlobReads = 0;
  let maxActiveBlobReads = 0;
  function addBlob(text) {
    const sha = (++blobCounter).toString(16).padStart(40, '0');
    blobs.set(sha, text);
    return sha;
  }

  const pointerSha = addBlob(serializeJson(data.pointer));
  const releaseSha = addBlob(serializeJson(data.release));
  const taxonomySha = addBlob(data.taxonomyText);
  const cardEntries = Object.entries(data.cards).map(([path, text]) => ({ path, type: 'blob', sha: addBlob(text) }));
  const artifactEntries = GENERATED_ARTIFACT_PATHS.map((path) => ({ path, type: 'blob', sha: addBlob(data.artifactTexts[path]) }));

  const qEntries = [
    ...(removePointer ? [] : [{ path: 'releases/current.json', type: 'blob', sha: pointerSha }]),
    { path: releaseDescriptionPath(RELEASE_ID), type: 'blob', sha: releaseSha },
    ...artifactEntries
  ];
  const pEntries = [
    { path: 'config/taxonomy.yaml', type: 'blob', sha: taxonomySha },
    ...cardEntries,
    ...artifactEntries
  ];

  async function fetchImpl(input, options = {}) {
    const url = new URL(String(input));
    const pathname = url.pathname;

    if (pathname === '/app/installations/42/access_tokens') {
      return response(201, {
        token: 'fixture-installation-token',
        expires_at: '2099-01-01T00:00:00Z'
      });
    }

    if (pathname === '/repos/example-owner/example-workspace/commits/main') {
      return response(200, {
        sha: Q,
        commit: { tree: { sha: Q_TREE } },
        parents: [{ sha: P }]
      });
    }

    if (pathname === '/repos/example-owner/example-workspace/commits/' + P) {
      return response(200, {
        sha: P,
        commit: { tree: { sha: P_TREE } },
        parents: [{ sha: S }]
      });
    }

    if (pathname === '/repos/example-owner/example-workspace/git/trees/' + Q_TREE) {
      return response(200, { truncated: false, tree: qEntries });
    }

    if (pathname === '/repos/example-owner/example-workspace/git/trees/' + P_TREE) {
      return response(200, { truncated: false, tree: pEntries });
    }

    if (pathname === '/repos/example-owner/example-workspace/compare/' + S + '...' + P) {
      return response(200, {
        status: 'ahead',
        ahead_by: 1,
        total_commits: 1,
        files: GENERATED_ARTIFACT_PATHS.map((filename) => ({ filename }))
      });
    }

    const blobMatch = pathname.match(/\/repos\/example-owner\/example-workspace\/git\/blobs\/([0-9a-f]{40})$/u);
    if (blobMatch && blobs.has(blobMatch[1])) {
      activeBlobReads += 1;
      maxActiveBlobReads = Math.max(maxActiveBlobReads, activeBlobReads);
      try {
        if (blobDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, blobDelayMs));
        }
        return response(200, blob(blobs.get(blobMatch[1])));
      } finally {
        activeBlobReads -= 1;
      }
    }

    throw new Error('Unexpected GitHub route: ' + pathname + ' ' + (options.method || 'GET'));
  }

  return {
    reader: createWorkspaceRepositoryReader({ config, fetchImpl }),
    data,
    maxActiveBlobReads: () => maxActiveBlobReads
  };
}

test('release-pinned reader keeps cards search graph and release on one published P', async () => {
  const h = await harness();
  const list = await h.reader.listCards();
  const search = await h.reader.search({ query: 'synthetic', limit: 10 });
  const graph = await h.reader.graph();
  const release = await h.reader.release();
  const detail = await h.reader.getCard('synthetic-example-project');

  assert.equal(list.release_id, RELEASE_ID);
  assert.equal(list.revision, P);
  assert.equal(search.release_id, RELEASE_ID);
  assert.equal(search.revision, P);
  assert.equal(graph.release_id, RELEASE_ID);
  assert.equal(graph.revision, P);
  assert.equal(graph.stats.cards, 2);
  assert.equal(graph.stats.concepts > 0, true);
  const graphCard = graph.nodes.find((node) => node.id === 'card:synthetic-example-project');
  assert.equal(graphCard.entityId, 'synthetic-example-project');
  assert.equal(graphCard.kind, 'card');
  assert.equal(graphCard.sourceType, 'github');
  assert.deepEqual(graphCard.actions, ['LEARN', 'REFERENCE']);
  assert.equal(graphCard.relevance.overall, 3);
  assert.equal(Array.isArray(graph.semantic.neighborsByCard['synthetic-example-project']), true);
  assert.equal(graph.semantic.neighborsByCard['synthetic-example-project'][0].cardId, 'synthetic-second-project');
  assert.equal(Array.isArray(graph.semantic.distancesByCard['synthetic-example-project']), true);
  assert.equal(graph.semantic.distancesByCard['synthetic-example-project'].length, 1);
  assert.equal(graph.edges.every((edge) => edge.type), true);
  assert.equal(release.release_id, RELEASE_ID);
  assert.equal(release.source_sha, S);
  assert.equal(release.published_sha, P);
  assert.equal(release.pointer_revision, Q);
  assert.equal(detail.release_id, RELEASE_ID);
  assert.equal(detail.revision, P);
  assert.ok(Array.isArray(detail.relations));
  assert.ok(Array.isArray(detail.concepts));
});

test('release reader bounds blob concurrency instead of serializing every private file read', async () => {
  const h = await harness({ blobDelayMs: 5 });
  await h.reader.listCards();
  assert.ok(h.maxActiveBlobReads() > 1);
  assert.ok(h.maxActiveBlobReads() <= 8);
});

test('manifest mismatch fails closed instead of mixing current Cards with stale indexes', async () => {
  const h = await harness({ tamper: 'data/search.json' });
  await assert.rejects(
    () => h.reader.listCards(),
    (error) => error?.code === 'RELEASE_MANIFEST_INVALID'
  );
});

test('generated data without a current release pointer fails closed', async () => {
  const h = await harness({ removePointer: true });
  await assert.rejects(
    () => h.reader.listCards(),
    (error) => error?.code === 'RELEASE_POINTER_MISSING'
  );
});
