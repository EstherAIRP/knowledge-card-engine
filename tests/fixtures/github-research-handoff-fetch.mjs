import crypto from 'node:crypto';

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() { return body; }
  };
}

const variant = process.env.KC_RESEARCH_FIXTURE_VARIANT === '2' ? 2 : 1;
const revision = variant === 1 ? 'a'.repeat(40) : 'f'.repeat(40);
const rootTreeSha = sha1(`root-tree-${variant}`);
const docsTreeSha = sha1(`docs-tree-${variant}`);
const srcTreeSha = sha1(`src-tree-${variant}`);

const files = {
  'README.md': variant === 1
    ? '# Research Handoff\n\nSynthetic service for validating bounded research ingestion.\n'
    : '# Research Handoff\n\nSynthetic service for validating bounded research ingestion with request validation.\n',
  'package.json': JSON.stringify({
    name: 'research-handoff',
    scripts: { start: 'node src/jobs.js' },
    dependencies: { synthetic_queue: '1.0.0' }
  }) + '\n',
  'docs/architecture.md': variant === 1
    ? '# Architecture\n\nThe API accepts work and dispatches durable jobs to a queue-backed worker.\n'
    : '# Architecture\n\nThe API validates incoming work before dispatching durable jobs to a queue-backed worker.\n',
  'src/auth.js': variant === 1
    ? 'export function authorize(session) { return Boolean(session?.user); }\n'
    : 'export function authorize(session) { return session?.role === "member"; }\n',
  'src/jobs.js': variant === 1
    ? 'export async function dispatch(queue, payload) { return queue.add(payload); }\n'
    : 'export async function dispatch(queue, payload) { validate(payload); return queue.add(payload); }\nfunction validate(payload) { if (!payload) throw new Error("payload required"); }\n',
  'SECURITY.md': '# Security\n\nAuthentication is enforced before queue dispatch; queue payloads must not contain credentials.\n',
  'DEPLOYMENT.md': '# Deployment\n\nThe synthetic service runs as an API process plus a separately deployed queue worker.\n',
  LICENSE: 'Synthetic permissive license for public test fixtures.\n'
};

const fileRecords = new Map(
  Object.entries(files).map(([filePath, text]) => [
    filePath,
    {
      text,
      sha: sha1(`${variant}:${filePath}:${text}`),
      bytes: Buffer.byteLength(text, 'utf8')
    }
  ])
);

function fileEntry(filePath, displayPath = filePath.split('/').at(-1)) {
  const file = fileRecords.get(filePath);
  return {
    path: displayPath,
    type: 'blob',
    sha: file.sha,
    size: file.bytes
  };
}

const metadata = {
  full_name: 'example/research-handoff',
  html_url: 'https://github.com/example/research-handoff',
  description: 'Synthetic repository for Remote Ingest research E2E tests.',
  homepage: null,
  default_branch: 'main',
  language: 'JavaScript',
  license: { spdx_id: 'MIT' },
  topics: ['synthetic', 'research'],
  archived: false,
  disabled: false,
  fork: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: variant === 1 ? '2026-09-23T00:00:00Z' : '2026-09-24T00:00:00Z',
  pushed_at: variant === 1 ? '2026-09-23T00:00:00Z' : '2026-09-24T00:00:00Z'
};

const acceptedReadme = {
  type: 'file',
  encoding: 'base64',
  sha: fileRecords.get('README.md').sha,
  content: Buffer.from(files['README.md'], 'utf8').toString('base64')
};

const rootTree = {
  truncated: false,
  tree: [
    fileEntry('README.md', 'README.md'),
    fileEntry('package.json', 'package.json'),
    fileEntry('SECURITY.md', 'SECURITY.md'),
    fileEntry('DEPLOYMENT.md', 'DEPLOYMENT.md'),
    fileEntry('LICENSE', 'LICENSE'),
    { path: 'docs', type: 'tree', sha: docsTreeSha },
    { path: 'src', type: 'tree', sha: srcTreeSha }
  ]
};

const docsTree = {
  truncated: false,
  tree: [fileEntry('docs/architecture.md', 'architecture.md')]
};

const srcTree = {
  truncated: false,
  tree: [
    fileEntry('src/auth.js', 'auth.js'),
    fileEntry('src/jobs.js', 'jobs.js')
  ]
};

const bySha = new Map([...fileRecords.entries()].map(([filePath, record]) => [record.sha, { filePath, ...record }]));

globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.endsWith('/repos/example/research-handoff')) return response(200, metadata);
  if (value.endsWith('/readme')) return response(200, acceptedReadme);
  if (value.endsWith('/commits/main')) {
    return response(200, {
      sha: revision,
      commit: { tree: { sha: rootTreeSha } }
    });
  }
  if (value.includes('/readme?ref=')) return response(200, acceptedReadme);
  if (value.endsWith('/git/trees/' + rootTreeSha)) return response(200, rootTree);
  if (value.endsWith('/git/trees/' + docsTreeSha)) return response(200, docsTree);
  if (value.endsWith('/git/trees/' + srcTreeSha)) return response(200, srcTree);

  const blobMatch = /\/git\/blobs\/([0-9a-f]{40})$/u.exec(value);
  if (blobMatch) {
    const file = bySha.get(blobMatch[1]);
    if (!file) return response(404, {});
    return response(200, {
      sha: file.sha,
      encoding: 'base64',
      size: file.bytes,
      content: Buffer.from(file.text, 'utf8').toString('base64')
    });
  }

  throw new Error('Unexpected synthetic GitHub URL: ' + value);
};
