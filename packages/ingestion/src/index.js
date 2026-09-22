import crypto from 'node:crypto';
import { classifyThreadsUrl, normalizeThreadsPostUrl, resolveThreadsUrl } from './threads/resolve-url.js';
import { extractResolvedThreadsConversation } from './threads/conversation.js';

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
  return sha256(JSON.stringify({
    source_identity: evidence.source_identity,
    canonical_url: evidence.canonical_url,
    author: evidence.author,
    thread: {
      status: evidence.thread?.status,
      total: evidence.thread?.total,
      detected_parts: evidence.thread?.detected_parts,
      verification: evidence.thread?.verification
    },
    parts: evidence.parts.map(threadsDigestPart),
    combined_text: evidence.combined_text
  }));
}

function mapThreadsProviderError(error) {
  if (error instanceof IngestionError) return error;
  const code = String(error?.code || '');
  if (code.includes('INCOMPLETE') || code.includes('AMBIGUOUS')) {
    return new IngestionError('SOURCE_INCOMPLETE', 'Threads source could not be proven complete from structural evidence.', { provider_code: code || null });
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
  if (!Array.isArray(evidence.parts) || evidence.parts.length < 1) fail('SOURCE_INCOMPLETE', 'Threads evidence must contain at least one post.');
  if (evidence.thread?.complete !== true || evidence.thread?.verification !== 'structural') fail('SOURCE_INCOMPLETE', 'Threads evidence is not structurally complete.');
  if (!['SINGLE_POST', 'COMPLETE_THREAD'].includes(evidence.thread?.status)) fail('SOURCE_INCOMPLETE', 'Threads evidence thread status is not accepted.');
  if (!Number.isInteger(evidence.thread?.total) || evidence.thread.total !== evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence thread total does not match parts.');
  if (!Number.isInteger(evidence.thread?.detected_parts) || evidence.thread.detected_parts !== evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence detected part count does not match parts.');
  if (!Number.isInteger(evidence.thread?.input_index) || evidence.thread.input_index < 1 || evidence.thread.input_index > evidence.parts.length) fail('SOURCE_INCOMPLETE', 'Threads evidence input index is invalid.');
  if (evidence.extraction?.conversation_complete !== true) fail('SOURCE_INCOMPLETE', 'Threads evidence extraction did not prove complete conversation coverage.');
  if (typeof evidence.author !== 'string' || !evidence.author.trim()) fail('SOURCE_INCOMPLETE', 'Threads evidence author is missing.');

  const root = evidence.parts[0];
  if (evidence.parts.length === 1 && root?.has_replies === true && evidence.extraction?.conversation_coverage_complete !== true) {
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
  browserConversationExtractor = null
} = {}) {
  if (typeof fetchImpl !== 'function') fail('INGESTION_EXECUTION_FAILED', 'No fetch implementation is available for Threads source verification.');
  if (Number.isNaN(Date.parse(capturedAt))) fail('SOURCE_CAPTURE_TIME_INVALID', 'capturedAt must be a valid ISO timestamp.');
  const requested = canonicalizeSource(rawUrl);
  if (requested.provider !== 'threads') fail('SOURCE_PROVIDER_UNSUPPORTED', 'Threads provider only accepts threads.com or threads.net URLs.');

  try {
    const resolved = await resolveThreadsUrl(requested.canonicalUrl, {
      fetchImpl,
      timeoutMs,
      maxRedirects,
      browserResolver: urlBrowserResolver
    });
    const source = await extractResolvedThreadsConversation(resolved.canonical_url, {
      fetchImpl,
      timeoutMs,
      apiExtractor,
      browserExtractor,
      apiConversationExtractor,
      browserConversationExtractor,
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
        verification: 'structural'
      },
      parts,
      combined_text: parts.map((part) => part.text).filter(Boolean).join('\n\n'),
      extraction: {
        method: source.extraction?.method || 'unknown',
        conversation_complete: true,
        conversation_coverage_complete: Boolean(source.extraction?.conversation_coverage_complete)
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
    media_sha256: sha256(JSON.stringify(part.media)),
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
      verification: evidence.thread.verification
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
  if (!['SINGLE_POST', 'COMPLETE_THREAD'].includes(state.thread?.status) || state.thread?.verification !== 'structural') fail('SOURCE_STATE_INVALID', 'Threads source state thread verification is invalid.');
  if (!Number.isInteger(state.thread?.total) || state.thread.total < 1 || !Array.isArray(state.parts) || state.parts.length !== state.thread.total) fail('SOURCE_STATE_INVALID', 'Threads source state part count is invalid.');
  for (let index = 0; index < state.parts.length; index += 1) {
    const part = state.parts[index];
    if (part?.index !== index + 1 || !part?.shortcode || !part?.canonical_url) fail('SOURCE_STATE_INVALID', 'Threads source state part metadata is invalid.');
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

