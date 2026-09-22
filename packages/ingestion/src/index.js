import crypto from 'node:crypto';

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
    return stage === 'repository'
      ? new IngestionError('SOURCE_NOT_FOUND', 'GitHub repository was not found.', { status, stage })
      : new IngestionError('SOURCE_INCOMPLETE', 'GitHub repository does not provide an accepted README.', { status, stage });
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
