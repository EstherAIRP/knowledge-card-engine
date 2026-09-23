import crypto from 'node:crypto';
import {
  ANALYSIS_RESEARCH_VERSION,
  RESEARCH_EVIDENCE_KINDS,
  computeAnalysisEvidenceDigest,
  validateAnalysisEvidenceBundle
} from '../../analysis/src/index.js';
import { classifyThreadsUrl, normalizeThreadsPostUrl, resolveThreadsUrl } from './threads/resolve-url.js';
import { extractResolvedThreadsConversationWithRecovery } from './threads/conversation-recovery.js';
import { extractThreadsViaBrowser, resolveThreadsUrlViaBrowser } from './threads/browser-adapter.js';

export const moduleId = 'ingestion';
export const moduleKind = 'package';

const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref_src', 'ref_url']);
const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;

export class IngestionError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'IngestionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = null) {
  throw new IngestionError(code, message, details);
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function cleanTrackingParams(url) {
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_KEYS.has(lower)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
}

function inferSourceType(url) {
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  if (host === 'arxiv.org' || host.endsWith('.arxiv.org')) return 'paper';
  if (host === 'youtube.com' || host === 'youtu.be') return 'video';
  if (pathname.includes('/docs/') || host.startsWith('docs.')) return 'documentation';
  return 'article';
}

export function canonicalizeSource(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl).trim());
  } catch {
    fail('SOURCE_URL_INVALID', 'Source URL is not a valid absolute URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) fail('SOURCE_URL_INVALID', 'Source URL must use http or https.');

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.hostname === 'www.github.com') parsed.hostname = 'github.com';

  if (parsed.hostname === 'github.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) fail('SOURCE_URL_INVALID', 'GitHub URL must identify a repository as /owner/repo.');
    const owner = decodeURIComponent(parts[0]);
    const repo = decodeURIComponent(parts[1]).replace(/\.git$/i, '');
    if (!owner || !repo || !GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
      fail('SOURCE_URL_INVALID', 'GitHub repository owner/repo is invalid.');
    }
    const ownerLower = owner.toLowerCase();
    const repoLower = repo.toLowerCase();
    return {
      provider: 'github',
      sourceType: 'github',
      owner,
      repo,
      ownerLower,
      repoLower,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
      identity: `github:${ownerLower}/${repoLower}`,
      suggestedId: slugify(`github-${ownerLower}-${repoLower}`)
    };
  }

  const threadsUrl = classifyThreadsUrl(parsed.toString());
  if (threadsUrl.isThreads) {
    if (!['post', 'share', 'short'].includes(threadsUrl.kind)) {
      fail('SOURCE_URL_INVALID', 'Threads URL must identify a post, share link, or short link.');
    }
    if (threadsUrl.kind === 'post') {
      const canonicalUrl = normalizeThreadsPostUrl(parsed.toString());
      return {
        provider: 'threads',
        sourceType: 'article',
        canonicalUrl,
        identity: `threads:${threadsUrl.shortcode}`,
        suggestedId: slugify(`threads-${threadsUrl.shortcode}`),
        inputKind: 'post',
        shortcode: threadsUrl.shortcode
      };
    }
    const segment = threadsUrl.kind === 'share' ? 'share' : 't';
    let token = String(threadsUrl.token || '');
    try { token = decodeURIComponent(token); } catch {}
    const canonicalUrl = `https://threads.com/${segment}/${encodeURIComponent(token)}`;
    return {
      provider: 'threads',
      sourceType: 'article',
      canonicalUrl,
      identity: null,
      suggestedId: null,
      inputKind: threadsUrl.kind,
      token
    };
  }

  if (parsed.hostname.startsWith('www.')) parsed.hostname = parsed.hostname.slice(4);
  cleanTrackingParams(parsed);
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  const canonicalUrl = parsed.toString();
  const identity = `url:${canonicalUrl}`;
  const lastSegment = parsed.pathname.split('/').filter(Boolean).at(-1) || 'root';
  const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 8);
  return {
    provider: 'generic',
    sourceType: inferSourceType(parsed),
    canonicalUrl,
    identity,
    suggestedId: `${slugify(`${parsed.hostname}-${lastSegment}`) || 'source'}-${digest}`
  };
}

function responseHeader(response, name) {
  try {
    return response?.headers?.get?.(name) ?? null;
  } catch {
    return null;
  }
}

function classifyHttpFailure(response, stage) {
  const status = Number(response?.status || 0);
  if (status === 404) {
    if (stage === 'repository') {
      return new IngestionError('SOURCE_NOT_FOUND', 'GitHub repository was not found.', { status, stage });
    }
    if (stage === 'readme') {
      return new IngestionError('SOURCE_INCOMPLETE', 'GitHub repository does not provide an accepted README.', { status, stage });
    }
    return new IngestionError('SOURCE_INCOMPLETE', `GitHub ${stage} resource was not found.`, { status, stage });
  }
  if (status === 401) return new IngestionError('SOURCE_ACCESS_DENIED', 'GitHub source requires authorization.', { status, stage });
  if (status === 403) {
    if (responseHeader(response, 'x-ratelimit-remaining') === '0') {
      return new IngestionError('INGESTION_EXECUTION_FAILED', 'GitHub API rate limit prevented source verification.', { status, stage });
    }
    return new IngestionError('SOURCE_ACCESS_DENIED', 'GitHub denied access to the source.', { status, stage });
  }
  if (status === 429 || status >= 500) {
    return new IngestionError('INGESTION_EXECUTION_FAILED', 'GitHub API could not be used in the current execution environment.', { status, stage });
  }
  return new IngestionError('SOURCE_FETCH_FAILED', `GitHub ${stage} request failed with HTTP ${status}.`, { status, stage });
}

async function fetchJson(fetchImpl, url, headers, stage) {
  let response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (cause) {
    const error = new IngestionError('INGESTION_EXECUTION_FAILED', `GitHub ${stage} request could not execute.`, { stage });
    error.cause = cause;
    throw error;
  }
  if (!response?.ok) throw classifyHttpFailure(response, stage);
  try {
    return await response.json();
  } catch (cause) {
    const error = new IngestionError('SOURCE_INCOMPLETE', `GitHub ${stage} response was not valid JSON.`, { stage });
    error.cause = cause;
    throw error;
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function acceptedRepositoryMetadata(metadata) {
  return {
    full_name: metadata.full_name,
    html_url: metadata.html_url,
    description: metadata.description ?? null,
    homepage: metadata.homepage ?? null,
    default_branch: metadata.default_branch,
    language: metadata.language ?? null,
    license: metadata.license?.spdx_id ?? null,
    topics: Array.isArray(metadata.topics) ? [...metadata.topics].sort() : [],
    archived: Boolean(metadata.archived),
    disabled: Boolean(metadata.disabled),
    fork: Boolean(metadata.fork),
    created_at: metadata.created_at ?? null,
    updated_at: metadata.updated_at ?? null,
    pushed_at: metadata.pushed_at ?? null
  };
}

function digestEvidencePayload(repository, readme) {
  return sha256(JSON.stringify({
    repository,
    readme: {
      sha: readme.sha,
      content_sha256: readme.content_sha256,
      bytes: readme.bytes
    }
  }));
}

export function validateGitHubEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) fail('SOURCE_INCOMPLETE', 'GitHub evidence must be an object.');
  if (evidence.provider !== 'github' || evidence.accepted !== true) fail('SOURCE_INCOMPLETE', 'GitHub evidence is not accepted.');
  const resolved = canonicalizeSource(evidence.canonical_url);
  if (resolved.provider !== 'github') fail('SOURCE_IDENTITY_MISMATCH', 'GitHub evidence canonical URL is not a GitHub repository URL.');
  if (resolved.identity !== evidence.source_identity) fail('SOURCE_IDENTITY_MISMATCH', 'GitHub evidence identity does not match its canonical URL.');
  if (Number.isNaN(Date.parse(evidence.captured_at || ''))) fail('SOURCE_CAPTURE_TIME_INVALID', 'GitHub evidence captured_at is invalid.');
  if (typeof evidence.readme?.text !== 'string' || !evidence.readme.text.trim()) fail('SOURCE_INCOMPLETE', 'GitHub evidence README is empty.');
  if (!evidence.readme?.sha) fail('SOURCE_INCOMPLETE', 'GitHub evidence README SHA is missing.');
  if (!Number.isInteger(evidence.readme?.bytes) || evidence.readme.bytes < 1) fail('SOURCE_INCOMPLETE', 'GitHub evidence README byte count is invalid.');
  const actualReadmeHash = sha256(evidence.readme.text);
  if (evidence.readme.content_sha256 !== actualReadmeHash) fail('SOURCE_INCOMPLETE', 'GitHub evidence README hash does not match README content.');
  if (evidence.readme.bytes !== Buffer.byteLength(evidence.readme.text, 'utf8')) fail('SOURCE_INCOMPLETE', 'GitHub evidence README byte count does not match README content.');
  if (!evidence.repository?.full_name || !evidence.repository?.default_branch) fail('SOURCE_INCOMPLETE', 'GitHub repository metadata is incomplete.');
  const repoIdentity = `github:${String(evidence.repository.full_name).toLowerCase()}`;
  if (repoIdentity !== evidence.source_identity) fail('SOURCE_IDENTITY_MISMATCH', 'GitHub repository metadata identity does not match requested identity.');
  if (evidence.repository.disabled) fail('SOURCE_INCOMPLETE', 'GitHub repository is disabled.');
  const expectedDigest = digestEvidencePayload(evidence.repository, evidence.readme);
  if (evidence.evidence_digest !== expectedDigest) fail('SOURCE_INCOMPLETE', 'GitHub evidence digest does not match accepted metadata and README.');
  return evidence;
}

export async function fetchGitHubEvidence(rawUrl, {
  fetchImpl = globalThis.fetch,
  token = null,
  capturedAt = new Date().toISOString()
} = {}) {
  if (typeof fetchImpl !== 'function') fail('INGESTION_EXECUTION_FAILED', 'No fetch implementation is available for GitHub source verification.');
  const requested = canonicalizeSource(rawUrl);
  if (requested.provider !== 'github') fail('SOURCE_PROVIDER_UNSUPPORTED', 'T05 GitHub provider only accepts GitHub repository URLs.');
  if (Number.isNaN(Date.parse(capturedAt))) fail('SOURCE_CAPTURE_TIME_INVALID', 'capturedAt must be a valid ISO timestamp.');

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'knowledge-card-engine'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const apiBase = `https://api.github.com/repos/${encodeURIComponent(requested.owner)}/${encodeURIComponent(requested.repo)}`;
  const metadata = await fetchJson(fetchImpl, apiBase, headers, 'repository');
  if (!metadata?.full_name || !metadata?.html_url || !metadata?.default_branch) fail('SOURCE_INCOMPLETE', 'GitHub repository metadata is incomplete.');
  const actual = canonicalizeSource(metadata.html_url);
  if (actual.identity !== requested.identity || `github:${String(metadata.full_name).toLowerCase()}` !== requested.identity) {
    fail('SOURCE_IDENTITY_MISMATCH', 'GitHub repository metadata does not match the requested repository identity.', {
      requested: requested.identity,
      received: metadata.full_name
    });
  }
  if (metadata.disabled) fail('SOURCE_INCOMPLETE', 'GitHub repository is disabled.');

  const readmePayload = await fetchJson(fetchImpl, `${apiBase}/readme`, headers, 'readme');
  if (readmePayload?.type !== 'file' || readmePayload?.encoding !== 'base64' || typeof readmePayload?.content !== 'string') {
    fail('SOURCE_INCOMPLETE', 'GitHub README response is incomplete.');
  }
  let readmeText;
  try {
    readmeText = Buffer.from(readmePayload.content.replace(/\s/g, ''), 'base64').toString('utf8');
  } catch (cause) {
    const error = new IngestionError('SOURCE_INCOMPLETE', 'GitHub README could not be decoded.');
    error.cause = cause;
    throw error;
  }
  if (!readmeText.trim()) fail('SOURCE_INCOMPLETE', 'GitHub README is empty.');

  const repository = acceptedRepositoryMetadata(metadata);
  const readme = {
    sha: String(readmePayload.sha || ''),
    text: readmeText,
    content_sha256: sha256(readmeText),
    bytes: Buffer.byteLength(readmeText, 'utf8')
  };
  const evidence = {
    provider: 'github',
    accepted: true,
    source_type: 'github',
    source_identity: requested.identity,
    canonical_url: `https://github.com/${metadata.full_name}`,
    suggested_id: requested.suggestedId,
    captured_at: new Date(capturedAt).toISOString(),
    repository,
    readme,
    evidence_digest: digestEvidencePayload(repository, readme)
  };
  return validateGitHubEvidence(evidence);
}


export const GITHUB_RESEARCH_LIMITS = Object.freeze({
  max_tree_requests: 64,
  max_tree_entries: 4000,
  max_candidates: 500,
  max_depth: 5,
  max_selected_items: 20,
  max_item_bytes: 163840,
  max_total_bytes: 786432
});

export const GITHUB_RESEARCH_STOP_REASONS = Object.freeze([
  'tree_request_budget_exhausted',
  'tree_entry_budget_exhausted',
  'candidate_budget_exhausted',
  'depth_budget_exhausted',
  'github_tree_truncated'
]);

const GITHUB_RESEARCH_SKIP_DIRECTORIES = new Set([
  '.git',
  '.cache',
  '.next',
  '.nuxt',
  'node_modules',
  'vendor',
  'vendors',
  'dist',
  'build',
  'out',
  'coverage',
  'target',
  'obj',
  'generated',
  'tmp',
  'temp'
]);

const GITHUB_RESEARCH_LOCKFILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'poetry.lock',
  'cargo.lock',
  'go.sum'
]);

const GITHUB_RESEARCH_SOURCE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.py', '.go', '.rs', '.java', '.kt', '.kts',
  '.rb', '.php', '.cs', '.swift', '.sh', '.bash',
  '.zsh', '.sql', '.graphql', '.gql', '.proto'
]);

const GITHUB_RESEARCH_TEXT_EXTENSIONS = new Set([
  ...GITHUB_RESEARCH_SOURCE_EXTENSIONS,
  '.md', '.mdx', '.txt', '.json', '.jsonc', '.yaml', '.yml',
  '.toml', '.xml', '.ini', '.cfg', '.conf', '.env'
]);

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'knowledge-card-engine'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function normalizeGitHubResearchLimits(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    fail('GITHUB_RESEARCH_LIMIT_INVALID', 'GitHub research limits must be an object.');
  }
  const allowed = Object.keys(GITHUB_RESEARCH_LIMITS);
  for (const key of Object.keys(overrides)) {
    if (!allowed.includes(key)) fail('GITHUB_RESEARCH_LIMIT_INVALID', `Unsupported GitHub research limit: ${key}.`);
  }
  const result = {};
  for (const key of allowed) {
    const requested = overrides[key];
    if (requested == null) {
      result[key] = GITHUB_RESEARCH_LIMITS[key];
      continue;
    }
    if (!Number.isInteger(requested) || requested < 1) {
      fail('GITHUB_RESEARCH_LIMIT_INVALID', `GitHub research limit ${key} must be a positive integer.`);
    }
    result[key] = Math.min(requested, GITHUB_RESEARCH_LIMITS[key]);
  }
  return result;
}

function githubResearchApiBase(evidence) {
  const fullName = String(evidence.repository?.full_name || '');
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail('SOURCE_IDENTITY_MISMATCH', 'GitHub research repository full_name is invalid.');
  return `https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
}

function safeResearchPath(value) {
  if (
    typeof value !== 'string'
    || !value
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('\0')
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('GITHUB_RESEARCH_PATH_INVALID', 'GitHub research path must be a safe repository-relative path.');
  }
  return value;
}

function pathExtension(pathValue) {
  const base = pathValue.split('/').at(-1) || '';
  const index = base.lastIndexOf('.');
  return index > 0 ? base.slice(index).toLowerCase() : '';
}

function isResearchTextPath(pathValue) {
  const base = (pathValue.split('/').at(-1) || '').toLowerCase();
  if (
    base === 'dockerfile'
    || base === 'makefile'
    || base === 'procfile'
    || base === 'gemfile'
    || base === 'license'
    || base === 'copying'
  ) return true;
  return GITHUB_RESEARCH_TEXT_EXTENSIONS.has(pathExtension(pathValue));
}

function shouldSkipResearchDirectory(pathValue) {
  return pathValue
    .toLowerCase()
    .split('/')
    .some((segment) => GITHUB_RESEARCH_SKIP_DIRECTORIES.has(segment));
}

function researchDirectoryPriority(pathValue) {
  const lower = pathValue.toLowerCase();
  const segments = lower.split('/');
  if (segments.some((segment) => ['docs', 'doc', 'documentation'].includes(segment))) return 0;
  if (segments.some((segment) => ['src', 'app', 'apps', 'packages', 'server', 'api', 'lib', 'core'].includes(segment))) return 1;
  if (segments.some((segment) => ['config', 'configs', 'schema', 'schemas', 'migration', 'migrations', '.github'].includes(segment))) return 2;
  if (segments.some((segment) => ['test', 'tests', '__tests__', 'spec'].includes(segment))) return 4;
  return 8;
}

function classifyGitHubResearchCandidate(pathValue) {
  const lower = pathValue.toLowerCase();
  const base = lower.split('/').at(-1) || '';
  const ext = pathExtension(lower);
  const segments = lower.split('/');

  if (GITHUB_RESEARCH_LOCKFILES.has(base) || base.endsWith('.min.js') || base.endsWith('.min.css')) return null;
  if (!isResearchTextPath(pathValue)) return null;

  if (/^readme(?:\.[^.]+)?$/u.test(base)) return { kind: 'readme', priority: 0 };
  if (/^(security|security-policy)(?:\.[^.]+)?$/u.test(base)) return { kind: 'security', priority: 0 };
  if (/^(license|licence|copying)(?:\.[^.]+)?$/u.test(base)) return { kind: 'license', priority: 1 };

  const manifestNames = new Set([
    'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'cargo.toml',
    'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json', 'gemfile',
    'mix.exs', 'deno.json', 'deno.jsonc', 'package.swift'
  ]);
  if (manifestNames.has(base)) return { kind: 'manifest', priority: 1 };

  if (
    base === 'dockerfile'
    || base.startsWith('docker-compose')
    || base.startsWith('vercel.')
    || base.startsWith('netlify.')
    || base.startsWith('render.')
    || base.startsWith('railway.')
    || base.startsWith('fly.')
    || segments.some((segment) => ['deploy', 'deployment', 'k8s', 'kubernetes', 'helm', 'terraform'].includes(segment))
    || (segments[0] === '.github' && segments[1] === 'workflows')
  ) return { kind: 'deployment', priority: 2 };

  if (segments.some((segment) => ['docs', 'doc', 'documentation'].includes(segment)) || ['.md', '.mdx'].includes(ext)) {
    return { kind: 'documentation', priority: /architecture|design|internals|overview/u.test(lower) ? 1 : 3 };
  }

  if (/auth|oauth|session|permission|authorization/u.test(lower)) return { kind: 'auth', priority: 2 };
  if (/security|threat|trust|attest|secret/u.test(lower)) return { kind: 'security', priority: 2 };
  if (/job|queue|worker|inngest|scheduler|cron|background/u.test(lower)) return { kind: 'background_job', priority: 3 };
  if (/schema|model|migration|prisma|drizzle|database|(^|\/)db([./]|$)/u.test(lower)) return { kind: 'data_model', priority: 3 };
  if (/api|route|router|controller|handler|endpoint|server[-_.]?action|(^|\/)actions?([./]|$)/u.test(lower)) return { kind: 'api', priority: 4 };
  if (/config|settings|\.env(?:\.example|\.sample)?$/u.test(lower) || ['.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'].includes(ext)) {
    return { kind: 'configuration', priority: 5 };
  }

  if (/(^|\/)(index|main|app|server|cli)\.[^/]+$/u.test(lower) && GITHUB_RESEARCH_SOURCE_EXTENSIONS.has(ext)) {
    return { kind: 'entrypoint', priority: 4 };
  }
  if (segments.some((segment) => ['test', 'tests', '__tests__', 'spec'].includes(segment)) || /\.(test|spec)\.[^.]+$/u.test(lower)) {
    return { kind: 'test', priority: 8 };
  }
  if (
    GITHUB_RESEARCH_SOURCE_EXTENSIONS.has(ext)
    && segments.some((segment) => ['src', 'app', 'apps', 'packages', 'server', 'client', 'lib', 'core'].includes(segment))
  ) return { kind: 'source', priority: 7 };

  return null;
}

function addStopReason(stopReasons, reason) {
  if (!stopReasons.includes(reason)) stopReasons.push(reason);
}

function sortResearchQueue(queue) {
  queue.sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path));
}

function validateGitHubResearchCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research candidate must be an object.');
  }
  safeResearchPath(candidate.path);
  if (!RESEARCH_EVIDENCE_KINDS.includes(candidate.kind)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', `GitHub research candidate kind is invalid: ${candidate.kind}.`);
  }
  if (typeof candidate.blob_sha !== 'string' || !/^[0-9a-f]{40}$/u.test(candidate.blob_sha)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research candidate blob_sha is invalid.');
  }
  if (!Number.isInteger(candidate.bytes) || candidate.bytes < 0) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research candidate bytes is invalid.');
  }
  if (!Number.isInteger(candidate.priority) || candidate.priority < 0) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research candidate priority is invalid.');
  }
  return candidate;
}

export function validateGitHubResearchDiscovery(discovery, evidence) {
  validateGitHubEvidence(evidence);
  if (!discovery || typeof discovery !== 'object' || Array.isArray(discovery)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery must be an object.');
  }
  if (discovery.research_version !== ANALYSIS_RESEARCH_VERSION || discovery.provider !== 'github') {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery schema/provider is invalid.');
  }
  if (discovery.source_identity !== evidence.source_identity) {
    fail('SOURCE_IDENTITY_MISMATCH', 'GitHub research discovery source identity does not match accepted evidence.');
  }
  if (discovery.source_evidence_digest !== evidence.evidence_digest) {
    fail('ANALYSIS_EVIDENCE_STALE', 'GitHub research discovery source evidence digest does not match accepted evidence.');
  }
  if (!/^[0-9a-f]{40}$/u.test(discovery.repository_revision || '')) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery repository_revision is invalid.');
  }
  if (!/^[0-9a-f]{40}$/u.test(discovery.root_tree_sha || '')) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery root_tree_sha is invalid.');
  }
  if (!Array.isArray(discovery.candidates)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery candidates must be an array.');
  }
  const paths = new Set();
  for (const candidate of discovery.candidates) {
    validateGitHubResearchCandidate(candidate);
    if (paths.has(candidate.path)) fail('GITHUB_RESEARCH_DISCOVERY_INVALID', `Duplicate GitHub research candidate path: ${candidate.path}.`);
    paths.add(candidate.path);
  }
  if (!discovery.discovery || typeof discovery.discovery !== 'object' || Array.isArray(discovery.discovery)) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery metadata is missing.');
  }
  if (!Array.isArray(discovery.discovery.stop_reasons) || discovery.discovery.stop_reasons.some((reason) => !GITHUB_RESEARCH_STOP_REASONS.includes(reason))) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery stop_reasons are invalid.');
  }
  for (const field of ['tree_requests', 'tree_entries', 'candidate_count', 'excluded_directories', 'excluded_files']) {
    if (!Number.isInteger(discovery.discovery[field]) || discovery.discovery[field] < 0) {
      fail('GITHUB_RESEARCH_DISCOVERY_INVALID', `GitHub research discovery ${field} is invalid.`);
    }
  }
  if (discovery.discovery.candidate_count !== discovery.candidates.length) {
    fail('GITHUB_RESEARCH_DISCOVERY_INVALID', 'GitHub research discovery candidate_count does not match candidates.');
  }
  return discovery;
}

export async function discoverGitHubResearchCandidates(evidence, {
  fetchImpl = globalThis.fetch,
  token = null,
  limits = {}
} = {}) {
  const accepted = validateGitHubEvidence(evidence);
  if (typeof fetchImpl !== 'function') fail('INGESTION_EXECUTION_FAILED', 'No fetch implementation is available for GitHub research discovery.');
  const appliedLimits = normalizeGitHubResearchLimits(limits);
  const headers = githubHeaders(token);
  const apiBase = githubResearchApiBase(accepted);

  const revisionPayload = await fetchJson(
    fetchImpl,
    `${apiBase}/commits/${encodeURIComponent(accepted.repository.default_branch)}`,
    headers,
    'research-revision'
  );
  const repositoryRevision = String(revisionPayload?.sha || '').toLowerCase();
  const rootTreeSha = String(revisionPayload?.commit?.tree?.sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(repositoryRevision) || !/^[0-9a-f]{40}$/u.test(rootTreeSha)) {
    fail('SOURCE_INCOMPLETE', 'GitHub research revision response is incomplete.');
  }

  const readmeAtRevision = await fetchJson(
    fetchImpl,
    `${apiBase}/readme?ref=${encodeURIComponent(repositoryRevision)}`,
    headers,
    'research-readme'
  );
  if (String(readmeAtRevision?.sha || '').toLowerCase() !== String(accepted.readme.sha || '').toLowerCase()) {
    fail('SOURCE_RESEARCH_STALE', 'GitHub README changed between source acceptance and research revision pin.');
  }

  const queue = [{ sha: rootTreeSha, path: '', depth: 0, priority: 0 }];
  const stopReasons = [];
  const candidates = [];
  let treeRequests = 0;
  let treeEntries = 0;
  let excludedDirectories = 0;
  let excludedFiles = 0;
  let hardStop = false;

  while (queue.length && !hardStop) {
    if (treeRequests >= appliedLimits.max_tree_requests) {
      addStopReason(stopReasons, 'tree_request_budget_exhausted');
      break;
    }
    sortResearchQueue(queue);
    const current = queue.shift();
    treeRequests += 1;
    const treePayload = await fetchJson(
      fetchImpl,
      `${apiBase}/git/trees/${encodeURIComponent(current.sha)}`,
      headers,
      'research-tree'
    );
    if (!Array.isArray(treePayload?.tree)) fail('SOURCE_INCOMPLETE', 'GitHub research tree response is incomplete.');
    if (treePayload.truncated === true) addStopReason(stopReasons, 'github_tree_truncated');

    const entries = [...treePayload.tree].sort((a, b) => String(a?.path || '').localeCompare(String(b?.path || '')));
    for (const entry of entries) {
      treeEntries += 1;
      if (treeEntries > appliedLimits.max_tree_entries) {
        addStopReason(stopReasons, 'tree_entry_budget_exhausted');
        hardStop = true;
        break;
      }
      if (!entry?.path || !entry?.type || !entry?.sha) {
        excludedFiles += 1;
        continue;
      }
      const fullPath = current.path ? `${current.path}/${entry.path}` : String(entry.path);
      safeResearchPath(fullPath);

      if (entry.type === 'tree') {
        if (shouldSkipResearchDirectory(fullPath)) {
          excludedDirectories += 1;
          continue;
        }
        const nextDepth = current.depth + 1;
        if (nextDepth > appliedLimits.max_depth) {
          excludedDirectories += 1;
          addStopReason(stopReasons, 'depth_budget_exhausted');
          continue;
        }
        if (/^[0-9a-f]{40}$/u.test(String(entry.sha).toLowerCase())) {
          queue.push({
            sha: String(entry.sha).toLowerCase(),
            path: fullPath,
            depth: nextDepth,
            priority: researchDirectoryPriority(fullPath)
          });
        } else {
          excludedDirectories += 1;
        }
        continue;
      }

      if (entry.type !== 'blob') {
        excludedFiles += 1;
        continue;
      }
      const descriptor = classifyGitHubResearchCandidate(fullPath);
      const size = Number(entry.size);
      if (
        !descriptor
        || !Number.isInteger(size)
        || size < 0
        || size > appliedLimits.max_item_bytes
        || !/^[0-9a-f]{40}$/u.test(String(entry.sha).toLowerCase())
      ) {
        excludedFiles += 1;
        continue;
      }
      candidates.push({
        path: fullPath,
        kind: descriptor.kind,
        blob_sha: String(entry.sha).toLowerCase(),
        bytes: size,
        priority: descriptor.priority
      });
      if (candidates.length >= appliedLimits.max_candidates) {
        addStopReason(stopReasons, 'candidate_budget_exhausted');
        hardStop = true;
        break;
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path));
  const discovery = {
    research_version: ANALYSIS_RESEARCH_VERSION,
    provider: 'github',
    source_identity: accepted.source_identity,
    source_evidence_digest: accepted.evidence_digest,
    repository_revision: repositoryRevision,
    root_tree_sha: rootTreeSha,
    candidates,
    discovery: {
      exhaustive: stopReasons.length === 0,
      stop_reasons: stopReasons,
      tree_requests: treeRequests,
      tree_entries: Math.min(treeEntries, appliedLimits.max_tree_entries),
      candidate_count: candidates.length,
      excluded_directories: excludedDirectories,
      excluded_files: excludedFiles,
      limits: appliedLimits
    }
  };
  return validateGitHubResearchDiscovery(discovery, accepted);
}

function decodeGitHubResearchBlob(payload, candidate, limits) {
  if (
    payload?.encoding !== 'base64'
    || typeof payload?.content !== 'string'
    || String(payload?.sha || '').toLowerCase() !== candidate.blob_sha
  ) {
    fail('SOURCE_INCOMPLETE', `GitHub research blob response is incomplete for ${candidate.path}.`);
  }
  let buffer;
  try {
    buffer = Buffer.from(payload.content.replace(/\s/gu, ''), 'base64');
  } catch (cause) {
    const error = new IngestionError('SOURCE_INCOMPLETE', `GitHub research blob could not be decoded for ${candidate.path}.`);
    error.cause = cause;
    throw error;
  }
  if (buffer.length > limits.max_item_bytes) {
    fail('GITHUB_RESEARCH_BUDGET_EXCEEDED', `GitHub research item exceeds max_item_bytes: ${candidate.path}.`);
  }
  if (buffer.includes(0)) fail('GITHUB_RESEARCH_BINARY_UNSUPPORTED', `GitHub research item is binary: ${candidate.path}.`);
  const text = buffer.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(buffer)) {
    fail('GITHUB_RESEARCH_BINARY_UNSUPPORTED', `GitHub research item is not valid UTF-8 text: ${candidate.path}.`);
  }
  return { buffer, text };
}

export async function fetchGitHubResearchEvidence(evidence, discovery, selectedPaths, {
  fetchImpl = globalThis.fetch,
  token = null,
  limits = {}
} = {}) {
  const accepted = validateGitHubEvidence(evidence);
  const validatedDiscovery = validateGitHubResearchDiscovery(discovery, accepted);
  if (typeof fetchImpl !== 'function') fail('INGESTION_EXECUTION_FAILED', 'No fetch implementation is available for GitHub research evidence.');
  const appliedLimits = normalizeGitHubResearchLimits(limits);
  if (!Array.isArray(selectedPaths) || selectedPaths.length === 0 || selectedPaths.some((item) => typeof item !== 'string' || !item)) {
    fail('GITHUB_RESEARCH_SELECTION_INVALID', 'GitHub research selectedPaths must be a non-empty array of paths.');
  }
  if (new Set(selectedPaths).size !== selectedPaths.length) {
    fail('GITHUB_RESEARCH_SELECTION_INVALID', 'GitHub research selectedPaths must not contain duplicates.');
  }
  if (selectedPaths.length > appliedLimits.max_selected_items) {
    fail('GITHUB_RESEARCH_BUDGET_EXCEEDED', 'GitHub research selection exceeds max_selected_items.');
  }

  const candidateByPath = new Map(validatedDiscovery.candidates.map((candidate) => [candidate.path, candidate]));
  const selected = [...selectedPaths].sort().map((pathValue) => {
    safeResearchPath(pathValue);
    const candidate = candidateByPath.get(pathValue);
    if (!candidate) fail('GITHUB_RESEARCH_PATH_NOT_CANDIDATE', `GitHub research path is not an approved discovery candidate: ${pathValue}.`);
    return candidate;
  });
  const estimatedTotal = selected.reduce((sum, candidate) => sum + candidate.bytes, 0);
  if (estimatedTotal > appliedLimits.max_total_bytes) {
    fail('GITHUB_RESEARCH_BUDGET_EXCEEDED', 'GitHub research selection exceeds max_total_bytes.');
  }

  const headers = githubHeaders(token);
  const apiBase = githubResearchApiBase(accepted);
  const items = [];
  let totalBytes = 0;
  for (const candidate of selected) {
    const blobPayload = await fetchJson(
      fetchImpl,
      `${apiBase}/git/blobs/${encodeURIComponent(candidate.blob_sha)}`,
      headers,
      'research-blob'
    );
    const { buffer, text } = decodeGitHubResearchBlob(blobPayload, candidate, appliedLimits);
    totalBytes += buffer.length;
    if (totalBytes > appliedLimits.max_total_bytes) {
      fail('GITHUB_RESEARCH_BUDGET_EXCEEDED', 'GitHub research evidence exceeds max_total_bytes.');
    }
    items.push({
      evidence_id: `file-${sha256(candidate.path).slice(0, 16)}`,
      path: candidate.path,
      kind: candidate.kind,
      blob_sha: candidate.blob_sha,
      content_sha256: sha256(buffer),
      bytes: buffer.length,
      text
    });
  }

  const bundleBase = {
    research_version: ANALYSIS_RESEARCH_VERSION,
    provider: 'github',
    source_identity: accepted.source_identity,
    source_evidence_digest: accepted.evidence_digest,
    repository_revision: validatedDiscovery.repository_revision,
    items
  };
  const bundle = {
    ...bundleBase,
    analysis_evidence_digest: computeAnalysisEvidenceDigest(bundleBase)
  };
  return validateAnalysisEvidenceBundle(bundle, accepted);
}

export function validateGitHubIngestionRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('REMOTE_INGEST_REQUEST_INVALID', 'GitHub ingestion request must be an object.');
  }
  const keys = Object.keys(value).sort();
  const expected = ['provider', 'schema_version', 'source_url'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail('REMOTE_INGEST_REQUEST_INVALID', 'GitHub ingestion request contains unsupported or missing fields.');
  }
  if (value.schema_version !== 1) {
    fail('REMOTE_INGEST_REQUEST_INVALID', 'GitHub ingestion request schema_version must be 1.');
  }
  if (value.provider !== 'github') {
    fail('REMOTE_INGEST_REQUEST_INVALID', 'GitHub ingestion request provider must be github.');
  }
  const source = canonicalizeSource(value.source_url);
  if (source.provider !== 'github') {
    fail('SOURCE_PROVIDER_UNSUPPORTED', 'Remote GitHub ingestion only accepts GitHub repository URLs.');
  }
  return {
    schema_version: 1,
    provider: 'github',
    source_url: source.canonicalUrl,
    source_identity: source.identity
  };
}

export function assertGitHubEvidenceMatchesRequest(request, evidence) {
  const normalized = validateGitHubIngestionRequest({
    schema_version: request?.schema_version,
    provider: request?.provider,
    source_url: request?.source_url
  });
  const accepted = validateGitHubEvidence(evidence);
  if (accepted.source_identity !== normalized.source_identity) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Accepted GitHub evidence does not match the ingestion request identity.');
  }
  return accepted;
}

function sameCard(a, b) {
  return a?.filePath === b?.filePath;
}

export function resolveIngestionTarget(cards, source) {
  const identityMatches = cards.filter((card) => card.data?.source?.identity === source.source_identity);
  const canonicalMatches = cards.filter((card) => {
    try {
      return canonicalizeSource(card.data?.canonical_url).canonicalUrl.toLowerCase() === canonicalizeSource(source.canonical_url).canonicalUrl.toLowerCase();
    } catch {
      return card.data?.canonical_url === source.canonical_url;
    }
  });

  if (identityMatches.length > 1 || canonicalMatches.length > 1) {
    fail('INGESTION_IDENTITY_CONFLICT', 'Workspace contains duplicate cards for the same source identity or canonical URL.');
  }
  const identityCard = identityMatches[0] || null;
  const canonicalCard = canonicalMatches[0] || null;
  if (identityCard && canonicalCard && !sameCard(identityCard, canonicalCard)) {
    fail('INGESTION_IDENTITY_CONFLICT', 'Source identity and canonical URL resolve to different existing Cards.');
  }
  const existing = identityCard || canonicalCard;
  return {
    mode: existing ? 'update' : 'create',
    existingCard: existing,
    id: existing?.data?.id || source.suggested_id
  };
}

export function githubSourceStatePath(sourceIdentity) {
  const match = /^github:([^/]+)\/(.+)$/.exec(sourceIdentity || '');
  if (!match) fail('SOURCE_IDENTITY_MISMATCH', 'GitHub source identity is invalid.');
  return `sources/github/${match[1]}--${match[2]}.json`;
}

export function buildGitHubSourceState(evidence, { cardId, cardPath }) {
  validateGitHubEvidence(evidence);
  return {
    schema_version: 1,
    provider: 'github',
    source_identity: evidence.source_identity,
    canonical_url: evidence.canonical_url,
    captured_at: evidence.captured_at,
    evidence_digest: evidence.evidence_digest,
    repository: {
      full_name: evidence.repository.full_name,
      default_branch: evidence.repository.default_branch,
      pushed_at: evidence.repository.pushed_at,
      updated_at: evidence.repository.updated_at,
      archived: evidence.repository.archived,
      disabled: evidence.repository.disabled
    },
    readme: {
      sha: evidence.readme.sha,
      content_sha256: evidence.readme.content_sha256,
      bytes: evidence.readme.bytes
    },
    card_id: cardId,
    card_path: cardPath
  };
}

export function validateGitHubSourceState(state) {
  if (!state || state.schema_version !== 1 || state.provider !== 'github') fail('SOURCE_STATE_INVALID', 'GitHub source state schema/provider is invalid.');
  if (!/^github:[^/]+\/.+$/.test(state.source_identity || '')) fail('SOURCE_STATE_INVALID', 'GitHub source state identity is invalid.');
  const canonical = canonicalizeSource(state.canonical_url);
  if (canonical.provider !== 'github' || canonical.identity !== state.source_identity) fail('SOURCE_STATE_INVALID', 'GitHub source state canonical URL does not match source identity.');
  if (Number.isNaN(Date.parse(state.captured_at || ''))) fail('SOURCE_STATE_INVALID', 'GitHub source state captured_at is invalid.');
  if (!/^[0-9a-f]{64}$/.test(state.evidence_digest || '')) fail('SOURCE_STATE_INVALID', 'GitHub source state evidence digest is invalid.');
  if (!/^[0-9a-f]{64}$/.test(state.readme?.content_sha256 || '')) fail('SOURCE_STATE_INVALID', 'GitHub source state README hash is invalid.');
  if (!state.readme?.sha || !Number.isInteger(state.readme?.bytes) || state.readme.bytes < 1) fail('SOURCE_STATE_INVALID', 'GitHub source state README metadata is incomplete.');
  if (!state.card_id || !state.card_path || !state.repository?.full_name || !state.repository?.default_branch) fail('SOURCE_STATE_INVALID', 'GitHub source state is incomplete.');
  if (`github:${String(state.repository.full_name).toLowerCase()}` !== state.source_identity) fail('SOURCE_STATE_INVALID', 'GitHub source state repository identity does not match source identity.');
  return state;
}

function acceptedThreadsReference(reference) {
  if (!reference || typeof reference !== 'object') return null;
  return {
    id: reference.id ? String(reference.id) : null,
    shortcode: reference.shortcode ? String(reference.shortcode) : null,
    username: reference.username ? String(reference.username) : null,
    text: typeof reference.text === 'string' ? reference.text : null,
    permalink: reference.permalink ? String(reference.permalink) : null
  };
}

function acceptedThreadsMedia(media) {
  return (Array.isArray(media) ? media : []).map((item) => ({
    id: item?.id ? String(item.id) : null,
    type: item?.type ? String(item.type) : 'unknown',
    url: item?.url ? String(item.url) : null,
    thumbnail_url: item?.thumbnail_url ? String(item.thumbnail_url) : null,
    width: Number.isFinite(Number(item?.width)) ? Number(item.width) : null,
    height: Number.isFinite(Number(item?.height)) ? Number(item.height) : null
  }));
}

function acceptedThreadsPart(part, index) {
  return {
    index: index + 1,
    id: part?.id ? String(part.id) : null,
    shortcode: part?.shortcode ? String(part.shortcode) : null,
    canonical_url: part?.canonical_url ? String(part.canonical_url) : null,
    username: part?.username ? String(part.username) : null,
    text: typeof part?.text === 'string' ? part.text : '',
    timestamp: part?.timestamp || null,
    media: acceptedThreadsMedia(part?.media),
    is_reply: typeof part?.is_reply === 'boolean' ? part.is_reply : null,
    reply_to: part?.reply_to ? String(part.reply_to) : null,
    root_post: part?.root_post ? String(part.root_post) : null,
    has_replies: typeof part?.has_replies === 'boolean' ? part.has_replies : null,
    quoted_post: acceptedThreadsReference(part?.quoted_post),
    reposted_post: acceptedThreadsReference(part?.reposted_post),
    link_attachment_url: part?.link_attachment_url ? String(part.link_attachment_url) : null,
    alt_text: part?.alt_text ? String(part.alt_text) : null
  };
}

function stableThreadsMediaUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return String(value);
  }
}

function threadsDigestPart(part) {
  return {
    ...part,
    media: (part.media || []).map((item) => ({
      ...item,
      url: stableThreadsMediaUrl(item.url),
      thumbnail_url: stableThreadsMediaUrl(item.thumbnail_url)
    }))
  };
}

function threadsEvidenceDigest(evidence) {
  const thread = {
    status: evidence.thread?.status,
    total: evidence.thread?.total,
    detected_parts: evidence.thread?.detected_parts,
    verification: evidence.thread?.verification
  };
  if (evidence.thread?.verification === 'llm_assisted') {
    thread.recovery = {
      confidence: evidence.thread?.recovery?.confidence ?? null,
      selected_shortcodes: evidence.thread?.recovery?.selected_shortcodes || [],
      root_only: evidence.thread?.recovery?.root_only === true,
      candidate_labels: evidence.thread?.recovery?.candidate_labels || [],
      ranker: evidence.thread?.recovery?.ranker || null
    };
  }
  return sha256(JSON.stringify({
    source_identity: evidence.source_identity,
    canonical_url: evidence.canonical_url,
    author: evidence.author,
    thread,
    parts: evidence.parts.map(threadsDigestPart),
    combined_text: evidence.combined_text
  }));
}

function findThreadsSemanticHandoff(error) {
  let current = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (current.semantic_handoff) return current.semantic_handoff;
    if (!current.cause || current.cause === current) break;
    current = current.cause;
  }
  return null;
}

function mapThreadsProviderError(error) {
  if (error instanceof IngestionError) return error;
  const code = String(error?.code || '');
  const semanticHandoff = findThreadsSemanticHandoff(error);
  if (semanticHandoff) {
    const wrapped = new IngestionError(
      'THREADS_SEMANTIC_HANDOFF_REQUIRED',
      'Threads structural evidence requires a semantic continuation judgement before accepted evidence can be produced.',
      { provider_code: code || null }
    );
    wrapped.semantic_handoff = semanticHandoff;
    wrapped.cause = error;
    return wrapped;
  }
  if (code.includes('INCOMPLETE') || code.includes('AMBIGUOUS')) {
    return new IngestionError('SOURCE_INCOMPLETE', 'Threads source could not be proven complete from accepted structural or semantic evidence.', { provider_code: code || null });
  }
  if (code.includes('MISMATCH') || code.includes('UNSAFE_REDIRECT')) {
    return new IngestionError('SOURCE_IDENTITY_MISMATCH', 'Threads source identity changed or left the trusted Threads origin.', { provider_code: code || null });
  }
  if (code.includes('UNSUPPORTED_URL')) {
    return new IngestionError('SOURCE_URL_INVALID', 'Threads URL path is not supported.', { provider_code: code });
  }
  const wrapped = new IngestionError('INGESTION_EXECUTION_FAILED', 'Threads source verification could not complete in the current execution environment.', { provider_code: code || null });
  wrapped.cause = error;
  return wrapped;
}

export function validateThreadsEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) fail('SOURCE_INCOMPLETE', 'Threads evidence must be an object.');
  if (evidence.provider !== 'threads' || evidence.accepted !== true || evidence.source_type !== 'article') {
    fail('SOURCE_INCOMPLETE', 'Threads evidence is not accepted.');
  }
  if (Number.isNaN(Date.parse(evidence.captured_at || ''))) fail('SOURCE_CAPTURE_TIME_INVALID', 'Threads evidence captured_at is invalid.');
  const canonical = canonicalizeSource(evidence.canonical_url);
  if (canonical.provider !== 'threads' || canonical.inputKind !== 'post' || !canonical.identity) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence canonical URL must identify a concrete Threads post.');
  }
  if (canonical.identity !== evidence.source_identity || !/^threads:[A-Za-z0-9_-]+$/.test(evidence.source_identity || '')) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence identity does not match its canonical root URL.');
  }
  const requested = canonicalizeSource(evidence.requested_url);
  if (requested.provider !== 'threads') fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence requested_url is invalid.');
  const resolvedInput = canonicalizeSource(evidence.resolved_input_url);
  if (resolvedInput.provider !== 'threads' || resolvedInput.inputKind !== 'post' || !resolvedInput.identity) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence resolved_input_url is invalid.');
  }
  if (evidence.input_shortcode !== resolvedInput.shortcode) fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence input shortcode does not match resolved input URL.');
  if (requested.inputKind === 'post' && requested.shortcode !== resolvedInput.shortcode) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads direct post request does not match the resolved input post.');
  }
  if (!Array.isArray(evidence.parts) || evidence.parts.length < 1) fail('SOURCE_INCOMPLETE', 'Threads evidence must contain at least one post.');
  const verification = evidence.thread?.verification;
  const structural = verification === 'structural';
  const inferred = verification === 'llm_assisted';
  if (evidence.thread?.complete !== true || (!structural && !inferred)) fail('SOURCE_INCOMPLETE', 'Threads evidence is not complete under an accepted verification method.');
  const acceptedStatuses = structural
    ? ['SINGLE_POST', 'COMPLETE_THREAD']
    : ['INFERRED_SINGLE_POST_HIGH_CONFIDENCE', 'INFERRED_THREAD_HIGH_CONFIDENCE'];
  if (!acceptedStatuses.includes(evidence.thread?.status)) fail('SOURCE_INCOMPLETE', 'Threads evidence thread status is not accepted for its verification method.');
  if (inferred) {
    const recovery = evidence.thread?.recovery;
    if (!recovery || !Number.isFinite(recovery.confidence) || recovery.confidence < 0.9 || recovery.confidence > 1) {
      fail('SOURCE_INCOMPLETE', 'Threads semantic recovery confidence is invalid or below the acceptance threshold.');
    }
    if (typeof recovery.root_only !== 'boolean' || !Array.isArray(recovery.selected_shortcodes) || !Array.isArray(recovery.candidate_labels)) {
      fail('SOURCE_INCOMPLETE', 'Threads semantic recovery metadata is incomplete.');
    }
    if (!recovery.ranker || !['agent_semantic_handoff', 'openai_compatible_chat'].includes(recovery.ranker.method)) {
      fail('SOURCE_INCOMPLETE', 'Threads semantic recovery ranker provenance is invalid.');
    }
    if (evidence.extraction?.inferred !== true) fail('SOURCE_INCOMPLETE', 'Threads semantic evidence must be marked as inferred.');
    if (recovery.root_only) {
      if (evidence.thread.status !== 'INFERRED_SINGLE_POST_HIGH_CONFIDENCE' || evidence.parts.length !== 1 || recovery.selected_shortcodes.length !== 0) {
        fail('SOURCE_INCOMPLETE', 'Threads root-only semantic recovery is inconsistent.');
      }
    } else {
      const selected = evidence.parts.slice(1).map((part) => part.shortcode);
      if (evidence.thread.status !== 'INFERRED_THREAD_HIGH_CONFIDENCE' || selected.length < 1 || JSON.stringify(selected) !== JSON.stringify(recovery.selected_shortcodes)) {
        fail('SOURCE_INCOMPLETE', 'Threads semantic continuation selection does not match accepted parts.');
      }
    }
  }
  if (!Number.isInteger(evidence.thread?.total) || evidence.thread.total !== evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence thread total does not match parts.');
  if (!Number.isInteger(evidence.thread?.detected_parts) || evidence.thread.detected_parts !== evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence detected part count does not match parts.');
  if (!Number.isInteger(evidence.thread?.input_index) || evidence.thread.input_index < 1 || evidence.thread.input_index > evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence input index is invalid.');
  if (evidence.extraction?.conversation_complete !== true) fail('SOURCE_INCOMPLETE', 'Threads evidence extraction did not prove complete conversation coverage.');
  if (typeof evidence.author !== 'string' || !evidence.author.trim()) fail('SOURCE_INCOMPLETE', 'Threads evidence author is missing.');

  const root = evidence.parts[0];
  if (structural && evidence.parts.length === 1 && root?.has_replies === true && evidence.extraction?.conversation_coverage_complete !== true) {
    fail('SOURCE_INCOMPLETE', 'Threads root post reports replies but conversation coverage is not proven complete.');
  }
  for (let index = 0; index < evidence.parts.length; index += 1) {
    const part = evidence.parts[index];
    if (!part || part.index !== index + 1 || !part.shortcode || !part.canonical_url || !part.username) {
      fail('SOURCE_INCOMPLETE', 'Threads evidence part metadata is incomplete.');
    }
    const partCanonical = canonicalizeSource(part.canonical_url);
    if (partCanonical.provider !== 'threads' || partCanonical.inputKind !== 'post' || partCanonical.shortcode !== part.shortcode) {
      fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence part canonical URL does not match its shortcode.');
    }
    if (part.username.toLowerCase() !== evidence.author.toLowerCase()) {
      fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence contains a post from a different author.');
    }
    if (typeof part.text !== 'string' || !Array.isArray(part.media)) fail('SOURCE_INCOMPLETE', 'Threads evidence part content is invalid.');
  }
  if (`threads:${root.shortcode}` !== evidence.source_identity || root.canonical_url !== evidence.canonical_url) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence root post does not match source identity.');
  }
  const inputMatches = evidence.parts
    .map((part, index) => part.shortcode === evidence.input_shortcode ? index + 1 : null)
    .filter(Boolean);
  if (inputMatches.length !== 1) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence resolved input post must appear exactly once in the accepted conversation.');
  }
  if (evidence.thread.input_index !== inputMatches[0]) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence input_index does not match the resolved input post position.');
  }
  const combinedText = evidence.parts.map((part) => part.text).filter(Boolean).join('\n\n');
  if (evidence.combined_text !== combinedText) fail('SOURCE_INCOMPLETE', 'Threads evidence combined_text does not match ordered parts.');
  const hasContent = Boolean(combinedText.trim()) || evidence.parts.some((part) => part.media.length > 0);
  if (!hasContent) fail('SOURCE_INCOMPLETE', 'Threads evidence contains no analyzable text or media.');
  if (evidence.suggested_id !== canonical.suggestedId) fail('SOURCE_IDENTITY_MISMATCH', 'Threads evidence suggested id does not match root identity.');
  const expectedDigest = threadsEvidenceDigest(evidence);
  if (evidence.evidence_digest !== expectedDigest) fail('SOURCE_INCOMPLETE', 'Threads evidence digest does not match accepted conversation content.');
  return evidence;
}

export async function fetchThreadsEvidence(rawUrl, {
  fetchImpl = globalThis.fetch,
  capturedAt = new Date().toISOString(),
  timeoutMs = 10000,
  maxRedirects = 5,
  urlBrowserResolver = null,
  apiExtractor = null,
  browserExtractor = null,
  apiConversationExtractor = null,
  browserConversationExtractor = null,
  browserFallback = false,
  browserOptions = {},
  continuationRanker = null,
  continuationCandidates = null
} = {}) {
  if (typeof fetchImpl !== 'function') fail('INGESTION_EXECUTION_FAILED', 'No fetch implementation is available for Threads source verification.');
  if (Number.isNaN(Date.parse(capturedAt))) fail('SOURCE_CAPTURE_TIME_INVALID', 'capturedAt must be a valid ISO timestamp.');
  const requested = canonicalizeSource(rawUrl);
  if (requested.provider !== 'threads') fail('SOURCE_PROVIDER_UNSUPPORTED', 'Threads provider only accepts threads.com or threads.net URLs.');

  try {
    const effectiveUrlBrowserResolver = urlBrowserResolver || (browserFallback
      ? async (url) => resolveThreadsUrlViaBrowser(url, browserOptions)
      : null);
    const resolved = await resolveThreadsUrl(requested.canonicalUrl, {
      fetchImpl,
      timeoutMs,
      maxRedirects,
      browserResolver: effectiveUrlBrowserResolver
    });

    const browserCache = new Map();
    const getBrowserResult = async (url) => {
      if (!browserCache.has(url)) {
        browserCache.set(url, extractThreadsViaBrowser(url, browserOptions));
      }
      return browserCache.get(url);
    };
    const effectiveBrowserExtractor = browserExtractor || (browserFallback
      ? async ({ canonical_url: canonicalUrl, shortcode }) => {
          const result = await getBrowserResult(canonicalUrl);
          return result.posts.find((post) => post?.shortcode === shortcode) || null;
        }
      : null);
    const effectiveBrowserConversationExtractor = browserConversationExtractor || (browserFallback
      ? async ({ canonical_url: canonicalUrl }) => getBrowserResult(canonicalUrl)
      : null);

    const source = await extractResolvedThreadsConversationWithRecovery(resolved.canonical_url, {
      fetchImpl,
      timeoutMs,
      apiExtractor,
      browserExtractor: effectiveBrowserExtractor,
      apiConversationExtractor,
      browserConversationExtractor: effectiveBrowserConversationExtractor,
      continuationRanker,
      continuationCandidates,
      requireComplete: true
    });
    if (!source?.source_identity?.startsWith('threads:') || source.source_identity.startsWith('threads-id:') || !source.root_shortcode) {
      fail('SOURCE_IDENTITY_MISMATCH', 'Threads accepted evidence requires a stable root shortcode.');
    }
    const rootCanonical = canonicalizeSource(source.canonical_url);
    if (rootCanonical.provider !== 'threads' || rootCanonical.inputKind !== 'post' || rootCanonical.identity !== source.source_identity) {
      fail('SOURCE_IDENTITY_MISMATCH', 'Threads reconstructed root does not match its canonical URL.');
    }
    const parts = source.parts.map(acceptedThreadsPart);
    const evidence = {
      provider: 'threads',
      accepted: true,
      source_type: 'article',
      source_identity: source.source_identity,
      canonical_url: rootCanonical.canonicalUrl,
      suggested_id: rootCanonical.suggestedId,
      requested_url: requested.canonicalUrl,
      resolved_input_url: normalizeThreadsPostUrl(resolved.canonical_url),
      input_shortcode: source.input_post?.shortcode || canonicalizeSource(resolved.canonical_url).shortcode,
      captured_at: new Date(capturedAt).toISOString(),
      author: source.author,
      thread: {
        status: source.thread.status,
        total: source.thread.total,
        detected_parts: source.thread.detected_parts,
        input_index: source.thread.input_index,
        complete: true,
        confidence: source.thread.confidence,
        indicator: source.thread.indicator || null,
        verification: source.thread.verification || 'structural',
        ...(source.thread.recovery ? { recovery: source.thread.recovery } : {})
      },
      parts,
      combined_text: parts.map((part) => part.text).filter(Boolean).join('\n\n'),
      extraction: {
        method: source.extraction?.method || 'unknown',
        conversation_complete: true,
        conversation_coverage_complete: Boolean(source.extraction?.conversation_coverage_complete),
        inferred: Boolean(source.extraction?.inferred)
      }
    };
    evidence.evidence_digest = threadsEvidenceDigest(evidence);
    return validateThreadsEvidence(evidence);
  } catch (error) {
    throw mapThreadsProviderError(error);
  }
}

export function validateThreadsIngestionRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('REMOTE_INGEST_REQUEST_INVALID', 'Threads ingestion request must be an object.');
  const keys = Object.keys(value).sort();
  const expected = ['provider', 'schema_version', 'source_url'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail('REMOTE_INGEST_REQUEST_INVALID', 'Threads ingestion request contains unsupported or missing fields.');
  }
  if (value.schema_version !== 1 || value.provider !== 'threads') fail('REMOTE_INGEST_REQUEST_INVALID', 'Threads ingestion request schema/provider is invalid.');
  const source = canonicalizeSource(value.source_url);
  if (source.provider !== 'threads') fail('SOURCE_PROVIDER_UNSUPPORTED', 'Remote Threads ingestion only accepts Threads URLs.');
  return { schema_version: 1, provider: 'threads', source_url: source.canonicalUrl };
}

export function assertThreadsEvidenceMatchesRequest(request, evidence) {
  const normalized = validateThreadsIngestionRequest({
    schema_version: request?.schema_version,
    provider: request?.provider,
    source_url: request?.source_url
  });
  const accepted = validateThreadsEvidence(evidence);
  if (accepted.requested_url !== normalized.source_url) {
    fail('SOURCE_IDENTITY_MISMATCH', 'Accepted Threads evidence does not match the ingestion request URL.');
  }
  return accepted;
}

export function threadsSourceStatePath(sourceIdentity) {
  const match = /^threads:([A-Za-z0-9_-]+)$/.exec(sourceIdentity || '');
  if (!match) fail('SOURCE_IDENTITY_MISMATCH', 'Threads source identity is invalid.');
  const label = slugify(match[1]) || 'thread';
  return `sources/threads/${label}-${sha256(sourceIdentity).slice(0, 8)}.json`;
}

function threadsStatePart(part) {
  return {
    index: part.index,
    id: part.id,
    shortcode: part.shortcode,
    canonical_url: part.canonical_url,
    timestamp: part.timestamp,
    reply_to: part.reply_to,
    root_post: part.root_post,
    text_sha256: sha256(part.text),
    text_bytes: Buffer.byteLength(part.text, 'utf8'),
    media_sha256: sha256(JSON.stringify(threadsDigestPart(part).media)),
    references_sha256: sha256(JSON.stringify({
      quoted_post: part.quoted_post,
      reposted_post: part.reposted_post,
      link_attachment_url: part.link_attachment_url,
      alt_text: part.alt_text
    }))
  };
}

export function buildThreadsSourceState(evidence, { cardId, cardPath }) {
  validateThreadsEvidence(evidence);
  return {
    schema_version: 1,
    provider: 'threads',
    source_identity: evidence.source_identity,
    canonical_url: evidence.canonical_url,
    captured_at: evidence.captured_at,
    evidence_digest: evidence.evidence_digest,
    author: evidence.author,
    thread: {
      status: evidence.thread.status,
      total: evidence.thread.total,
      verification: evidence.thread.verification,
      ...(evidence.thread.recovery ? {
        recovery: {
          confidence: evidence.thread.recovery.confidence,
          selected_shortcodes: evidence.thread.recovery.selected_shortcodes || [],
          root_only: evidence.thread.recovery.root_only === true,
          candidate_labels: evidence.thread.recovery.candidate_labels || [],
          ranker: evidence.thread.recovery.ranker || null
        }
      } : {})
    },
    parts: evidence.parts.map(threadsStatePart),
    card_id: cardId,
    card_path: cardPath
  };
}

export function validateThreadsSourceState(state) {
  if (!state || state.schema_version !== 1 || state.provider !== 'threads') fail('SOURCE_STATE_INVALID', 'Threads source state schema/provider is invalid.');
  const canonical = canonicalizeSource(state.canonical_url);
  if (canonical.provider !== 'threads' || canonical.inputKind !== 'post' || canonical.identity !== state.source_identity) fail('SOURCE_STATE_INVALID', 'Threads source state canonical URL does not match source identity.');
  if (Number.isNaN(Date.parse(state.captured_at || ''))) fail('SOURCE_STATE_INVALID', 'Threads source state captured_at is invalid.');
  if (!/^[0-9a-f]{64}$/.test(state.evidence_digest || '')) fail('SOURCE_STATE_INVALID', 'Threads source state evidence digest is invalid.');
  if (!state.author || !state.card_id || !state.card_path) fail('SOURCE_STATE_INVALID', 'Threads source state is incomplete.');
  const structuralState = state.thread?.verification === 'structural' && ['SINGLE_POST', 'COMPLETE_THREAD'].includes(state.thread?.status);
  const inferredState = state.thread?.verification === 'llm_assisted' && ['INFERRED_SINGLE_POST_HIGH_CONFIDENCE', 'INFERRED_THREAD_HIGH_CONFIDENCE'].includes(state.thread?.status);
  if (!structuralState && !inferredState) fail('SOURCE_STATE_INVALID', 'Threads source state thread verification is invalid.');
  if (inferredState) {
    const recovery = state.thread?.recovery;
    if (!recovery || !Number.isFinite(recovery.confidence) || recovery.confidence < 0.9 || typeof recovery.root_only !== 'boolean' || !Array.isArray(recovery.selected_shortcodes) || !Array.isArray(recovery.candidate_labels) || !recovery.ranker) {
      fail('SOURCE_STATE_INVALID', 'Threads source state semantic recovery provenance is invalid.');
    }
  }
  if (!Number.isInteger(state.thread?.total) || state.thread.total < 1 || !Array.isArray(state.parts) || state.parts.length !== state.thread.total) fail('SOURCE_STATE_INVALID', 'Threads source state part count is invalid.');
  for (let index = 0; index < state.parts.length; index += 1) {
    const part = state.parts[index];
    if (part?.index !== index + 1 || !part?.shortcode || !part?.canonical_url) fail('SOURCE_STATE_INVALID', 'Threads source state part metadata is invalid.');
    const partCanonical = canonicalizeSource(part.canonical_url);
    if (partCanonical.provider !== 'threads' || partCanonical.inputKind !== 'post' || partCanonical.shortcode !== part.shortcode) {
      fail('SOURCE_STATE_INVALID', 'Threads source state part canonical URL does not match its shortcode.');
    }
    if (!/^[0-9a-f]{64}$/.test(part.text_sha256 || '') || !Number.isInteger(part.text_bytes) || part.text_bytes < 0) fail('SOURCE_STATE_INVALID', 'Threads source state text fingerprint is invalid.');
    if (!/^[0-9a-f]{64}$/.test(part.media_sha256 || '') || !/^[0-9a-f]{64}$/.test(part.references_sha256 || '')) fail('SOURCE_STATE_INVALID', 'Threads source state content fingerprint is invalid.');
  }
  if (`threads:${state.parts[0].shortcode}` !== state.source_identity || state.parts[0].canonical_url !== state.canonical_url) fail('SOURCE_STATE_INVALID', 'Threads source state root does not match source identity.');
  return state;
}

export function validateIngestionRequest(value) {
  if (value?.provider === 'github') return validateGitHubIngestionRequest(value);
  if (value?.provider === 'threads') return validateThreadsIngestionRequest(value);
  fail('SOURCE_PROVIDER_UNSUPPORTED', 'Remote ingestion provider is not supported.');
}

export function validateAcceptedEvidence(evidence) {
  if (evidence?.provider === 'github') return validateGitHubEvidence(evidence);
  if (evidence?.provider === 'threads') return validateThreadsEvidence(evidence);
  fail('SOURCE_PROVIDER_UNSUPPORTED', 'Accepted evidence provider is not supported.');
}

export function assertAcceptedEvidenceMatchesRequest(request, evidence) {
  const normalized = validateIngestionRequest(request);
  if (normalized.provider === 'github') return assertGitHubEvidenceMatchesRequest(normalized, evidence);
  return assertThreadsEvidenceMatchesRequest(normalized, evidence);
}

export async function fetchAcceptedEvidence(request, options = {}) {
  const normalized = validateIngestionRequest(request);
  if (normalized.provider === 'github') return fetchGitHubEvidence(normalized.source_url, options);
  return fetchThreadsEvidence(normalized.source_url, options);
}

export function acceptedSourceStatePath(evidence) {
  const accepted = validateAcceptedEvidence(evidence);
  return accepted.provider === 'github'
    ? githubSourceStatePath(accepted.source_identity)
    : threadsSourceStatePath(accepted.source_identity);
}

export function buildAcceptedSourceState(evidence, target) {
  const accepted = validateAcceptedEvidence(evidence);
  return accepted.provider === 'github'
    ? buildGitHubSourceState(accepted, target)
    : buildThreadsSourceState(accepted, target);
}

export function validateAcceptedSourceState(state) {
  if (state?.provider === 'github') return validateGitHubSourceState(state);
  if (state?.provider === 'threads') return validateThreadsSourceState(state);
  fail('SOURCE_STATE_INVALID', 'Accepted source state provider is not supported.');
}

