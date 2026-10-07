import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createWorkspaceRepositoryReader } from '../apps/server/src/workspace-reader.js';

const REVISION = '1'.repeat(40);
const TREE_SHA = '2'.repeat(40);
const SIZES = [10, 50, 100, 200];
const BLOB_DELAY_MS = 2;

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

function rounded(value) {
  return Math.round(Number(value) * 10) / 10;
}

function syntheticCard(template, index) {
  const suffix = String(index + 1).padStart(4, '0');
  const id = `synthetic-card-${suffix}`;
  const title = `Synthetic Card ${suffix}`;
  const url = `https://github.com/example/${id}`;
  const identity = `github:example/${id}`;
  return template
    .replaceAll('synthetic-example-project', id)
    .replaceAll('Synthetic Example Project', title)
    .replaceAll('https://github.com/example/synthetic-example', url)
    .replaceAll('github:example/synthetic-example', identity);
}

async function benchmark(cardCount) {
  const taxonomyText = await fs.readFile(
    new URL('../tests/fixtures/synthetic-workspace/config/taxonomy.yaml', import.meta.url),
    'utf8'
  );
  const template = await fs.readFile(
    new URL('../tests/fixtures/synthetic-workspace/content/knowledge/2026/synthetic-example-project.md', import.meta.url),
    'utf8'
  );
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
  const stats = { calls: 0, blobReads: 0 };
  function addBlob(text) {
    const sha = (++blobCounter).toString(16).padStart(40, '0');
    blobs.set(sha, text);
    return sha;
  }

  const taxonomySha = addBlob(taxonomyText);
  const cardEntries = Array.from({ length: cardCount }, (_, index) => ({
    path: `content/knowledge/2026/synthetic-card-${String(index + 1).padStart(4, '0')}.md`,
    type: 'blob',
    sha: addBlob(syntheticCard(template, index))
  }));

  async function fetchImpl(input, options = {}) {
    stats.calls += 1;
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
        sha: REVISION,
        commit: { tree: { sha: TREE_SHA } },
        parents: []
      });
    }
    if (pathname === '/repos/example-owner/example-workspace/git/trees/' + TREE_SHA) {
      return response(200, {
        truncated: false,
        tree: [
          { path: 'config/taxonomy.yaml', type: 'blob', sha: taxonomySha },
          ...cardEntries
        ]
      });
    }

    const match = pathname.match(/\/git\/blobs\/([0-9a-f]{40})$/u);
    if (match && blobs.has(match[1])) {
      stats.blobReads += 1;
      if (BLOB_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, BLOB_DELAY_MS));
      }
      return response(200, blob(blobs.get(match[1])));
    }

    throw new Error('Unexpected benchmark route: ' + pathname + ' ' + (options.method || 'GET'));
  }

  const reader = createWorkspaceRepositoryReader({ config, fetchImpl });

  const coldCallsBefore = stats.calls;
  const coldBlobsBefore = stats.blobReads;
  const coldStarted = performance.now();
  const cold = await reader.listCards({ limit: 100 });
  const coldMs = performance.now() - coldStarted;
  const coldCalls = stats.calls - coldCallsBefore;
  const coldBlobReads = stats.blobReads - coldBlobsBefore;

  const warmCallsBefore = stats.calls;
  const warmBlobsBefore = stats.blobReads;
  const warmStarted = performance.now();
  const warm = await reader.listCards({ limit: 100 });
  const warmMs = performance.now() - warmStarted;

  return {
    card_count: cardCount,
    blob_delay_ms: BLOB_DELAY_MS,
    cold_ms: rounded(coldMs),
    warm_ms: rounded(warmMs),
    cold_upstream_calls: coldCalls,
    warm_upstream_calls: stats.calls - warmCallsBefore,
    cold_blob_reads: coldBlobReads,
    warm_blob_reads: stats.blobReads - warmBlobsBefore,
    returned_items: cold.items.length,
    warm_returned_items: warm.items.length,
    has_next_cursor: Boolean(cold.next_cursor)
  };
}

console.log('SITE_PERFORMANCE_BASELINE_BEGIN');
for (const size of SIZES) {
  console.log(JSON.stringify(await benchmark(size)));
}
console.log('SITE_PERFORMANCE_BASELINE_END');
