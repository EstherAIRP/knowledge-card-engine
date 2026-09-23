import {
  RESEARCH_COVERAGE_DIMENSIONS,
  RESEARCH_COVERAGE_STATUSES,
  RESEARCH_EVIDENCE_KINDS,
  RESEARCH_UNAVAILABLE_REASONS,
  validateAnalysisEvidenceBundle,
  validateAnalysisResult
} from '../../analysis/src/index.js';
import { canonicalizeSource, validateAcceptedEvidence } from '../../ingestion/src/index.js';

export const RESEARCH_STATE_SCHEMA_VERSION = 1;

const RESEARCH_STATE_KEYS = Object.freeze([
  'schema_version',
  'provider',
  'source_identity',
  'canonical_url',
  'analyzed_at',
  'analysis_version',
  'source_evidence_digest',
  'repository_revision',
  'analysis_evidence_digest',
  'evidence_items',
  'coverage',
  'card_id',
  'card_path'
]);

const RESEARCH_STATE_ITEM_KEYS = Object.freeze([
  'evidence_id',
  'path',
  'kind',
  'blob_sha',
  'content_sha256',
  'bytes'
]);

const RESEARCH_STATE_COVERAGE_KEYS = Object.freeze([
  'status',
  'unavailable_reason'
]);

export class ResearchStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ResearchStateError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ResearchStateError(code, message);
}

function exactKeys(value, keys, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RESEARCH_STATE_INVALID', `${field} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('RESEARCH_STATE_INVALID', `${field} must contain exactly: ${expected.join(', ')}.`);
  }
}

function digest64(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail('RESEARCH_STATE_INVALID', `${field} must be a lowercase SHA-256 digest.`);
  }
}

function safeRelativePath(value, field) {
  if (
    typeof value !== 'string'
    || !value
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('\0')
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('RESEARCH_STATE_INVALID', `${field} must be a safe relative path.`);
  }
}

function compactCoverage(research) {
  return Object.fromEntries(RESEARCH_COVERAGE_DIMENSIONS.map((dimension) => {
    const entry = research.coverage[dimension];
    return [dimension, {
      status: entry.status,
      unavailable_reason: entry.status === 'unavailable' ? entry.unavailable_reason : null
    }];
  }));
}

export function researchStatePath(evidence) {
  if (evidence?.provider !== 'github') {
    fail('RESEARCH_STATE_PROVIDER_UNSUPPORTED', 'Research provenance state currently supports GitHub repositories only.');
  }
  const match = /^github:([^/]+)\/(.+)$/u.exec(evidence.source_identity || '');
  if (!match) fail('RESEARCH_STATE_INVALID', 'GitHub source identity is invalid for research state.');
  return `research/github/${match[1]}--${match[2]}.json`;
}

export function buildResearchState(evidence, analysisEvidenceBundle, analysis, { cardId, cardPath }) {
  const accepted = validateAcceptedEvidence(evidence);
  if (accepted.provider !== 'github') {
    fail('RESEARCH_STATE_PROVIDER_UNSUPPORTED', 'Research provenance state currently supports GitHub repositories only.');
  }
  const bundle = validateAnalysisEvidenceBundle(analysisEvidenceBundle, accepted);
  validateAnalysisResult(analysis, accepted, bundle);
  if (analysis.analysis_version !== 2) {
    fail('RESEARCH_STATE_INVALID', 'Research provenance state requires analysis_version 2.');
  }
  if (typeof cardId !== 'string' || !cardId) fail('RESEARCH_STATE_INVALID', 'Research state cardId is required.');
  safeRelativePath(cardPath, 'research state cardPath');

  const state = {
    schema_version: RESEARCH_STATE_SCHEMA_VERSION,
    provider: 'github',
    source_identity: accepted.source_identity,
    canonical_url: accepted.canonical_url,
    analyzed_at: accepted.captured_at,
    analysis_version: 2,
    source_evidence_digest: accepted.evidence_digest,
    repository_revision: bundle.repository_revision,
    analysis_evidence_digest: bundle.analysis_evidence_digest,
    evidence_items: bundle.items.map((item) => ({
      evidence_id: item.evidence_id,
      path: item.path,
      kind: item.kind,
      blob_sha: item.blob_sha,
      content_sha256: item.content_sha256,
      bytes: item.bytes
    })),
    coverage: compactCoverage(analysis.research),
    card_id: cardId,
    card_path: cardPath
  };
  return validateResearchState(state);
}

export function validateResearchState(state) {
  exactKeys(state, RESEARCH_STATE_KEYS, 'research state');
  if (state.schema_version !== RESEARCH_STATE_SCHEMA_VERSION) {
    fail('RESEARCH_STATE_INVALID', `research state schema_version must be ${RESEARCH_STATE_SCHEMA_VERSION}.`);
  }
  if (state.provider !== 'github') {
    fail('RESEARCH_STATE_PROVIDER_UNSUPPORTED', 'Research provenance state currently supports GitHub repositories only.');
  }
  const source = canonicalizeSource(state.canonical_url);
  if (source.provider !== 'github' || source.identity !== state.source_identity) {
    fail('RESEARCH_STATE_INVALID', 'Research state canonical_url does not match source_identity.');
  }
  if (Number.isNaN(Date.parse(state.analyzed_at || ''))) {
    fail('RESEARCH_STATE_INVALID', 'Research state analyzed_at is invalid.');
  }
  if (state.analysis_version !== 2) {
    fail('RESEARCH_STATE_INVALID', 'Research state analysis_version must be 2.');
  }
  digest64(state.source_evidence_digest, 'research state.source_evidence_digest');
  if (typeof state.repository_revision !== 'string' || !/^[0-9a-f]{40}$/u.test(state.repository_revision)) {
    fail('RESEARCH_STATE_INVALID', 'Research state repository_revision must be a lowercase 40-character Git SHA.');
  }
  digest64(state.analysis_evidence_digest, 'research state.analysis_evidence_digest');

  if (!Array.isArray(state.evidence_items) || state.evidence_items.length === 0) {
    fail('RESEARCH_STATE_INVALID', 'Research state evidence_items must be a non-empty array.');
  }
  const evidenceIds = new Set();
  const paths = new Set();
  for (let index = 0; index < state.evidence_items.length; index += 1) {
    const item = state.evidence_items[index];
    const field = `research state.evidence_items[${index}]`;
    exactKeys(item, RESEARCH_STATE_ITEM_KEYS, field);
    if (typeof item.evidence_id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(item.evidence_id)) {
      fail('RESEARCH_STATE_INVALID', `${field}.evidence_id is invalid.`);
    }
    if (evidenceIds.has(item.evidence_id)) fail('RESEARCH_STATE_INVALID', `Duplicate research evidence_id: ${item.evidence_id}.`);
    evidenceIds.add(item.evidence_id);
    safeRelativePath(item.path, `${field}.path`);
    if (paths.has(item.path)) fail('RESEARCH_STATE_INVALID', `Duplicate research evidence path: ${item.path}.`);
    paths.add(item.path);
    if (!RESEARCH_EVIDENCE_KINDS.includes(item.kind)) {
      fail('RESEARCH_STATE_INVALID', `${field}.kind is invalid.`);
    }
    if (typeof item.blob_sha !== 'string' || !/^[0-9a-f]{40}$/u.test(item.blob_sha)) {
      fail('RESEARCH_STATE_INVALID', `${field}.blob_sha is invalid.`);
    }
    digest64(item.content_sha256, `${field}.content_sha256`);
    if (!Number.isInteger(item.bytes) || item.bytes < 0) {
      fail('RESEARCH_STATE_INVALID', `${field}.bytes must be a non-negative integer.`);
    }
  }

  exactKeys(state.coverage, RESEARCH_COVERAGE_DIMENSIONS, 'research state.coverage');
  for (const dimension of RESEARCH_COVERAGE_DIMENSIONS) {
    const entry = state.coverage[dimension];
    const field = `research state.coverage.${dimension}`;
    exactKeys(entry, RESEARCH_STATE_COVERAGE_KEYS, field);
    if (!RESEARCH_COVERAGE_STATUSES.includes(entry.status)) {
      fail('RESEARCH_STATE_INVALID', `${field}.status is invalid.`);
    }
    if (entry.status === 'unavailable') {
      if (!RESEARCH_UNAVAILABLE_REASONS.includes(entry.unavailable_reason)) {
        fail('RESEARCH_STATE_INVALID', `${field}.unavailable_reason is invalid.`);
      }
    } else if (entry.unavailable_reason !== null) {
      fail('RESEARCH_STATE_INVALID', `${field}.unavailable_reason must be null unless status is unavailable.`);
    }
  }

  if (typeof state.card_id !== 'string' || !state.card_id) fail('RESEARCH_STATE_INVALID', 'Research state card_id is required.');
  safeRelativePath(state.card_path, 'research state.card_path');
  return state;
}
