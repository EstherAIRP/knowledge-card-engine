import crypto from 'node:crypto';
import {
  THREADS_CONTINUATION_JUDGEMENT_ALLOWED_LABELS,
  THREADS_CONTINUATION_JUDGEMENT_REQUIRED_FIELDS,
  THREADS_CONTINUATION_JUDGEMENT_SCHEMA_PATH,
  assertThreadsContinuationJudgementShape
} from './continuation-judgement.js';

export const THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION = 1;
export const THREADS_SEMANTIC_HANDOFF_PRODUCER = 'knowledge_card_agent';
export const THREADS_SEMANTIC_HANDOFF_KIND = 'threads_continuation_judgement';

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ALLOWED_LABELS = new Set(THREADS_CONTINUATION_JUDGEMENT_ALLOWED_LABELS);

function normalizeText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function compactRoot(post) {
  return {
    id: post?.id || null,
    shortcode: post?.shortcode || null,
    username: post?.username ? String(post.username).toLowerCase() : null,
    timestamp: post?.timestamp || null,
    is_reply: post?.is_reply ?? null,
    has_replies: post?.has_replies ?? null,
    text: normalizeText(post?.text)
  };
}

function compactCandidate(candidate) {
  const post = candidate?.post || candidate || {};
  return {
    id: post?.id || candidate?.id || null,
    shortcode: post?.shortcode || candidate?.shortcode || null,
    username: (post?.username || candidate?.username)
      ? String(post?.username || candidate?.username).toLowerCase()
      : null,
    timestamp: post?.timestamp || candidate?.timestamp || null,
    is_reply: post?.is_reply ?? candidate?.is_reply ?? null,
    has_replies: post?.has_replies ?? candidate?.has_replies ?? null,
    delta_seconds: Number.isFinite(candidate?.delta_seconds) ? candidate.delta_seconds : null,
    metadata_score: Number.isFinite(candidate?.metadata_score)
      ? Number(candidate.metadata_score.toFixed(3))
      : null,
    text: normalizeText(post?.text ?? candidate?.text)
  };
}

export function buildThreadsSemanticHandoffEvidence(rootPost, candidates) {
  return {
    root: compactRoot(rootPost),
    candidates: (candidates || []).map(compactCandidate)
  };
}

export function digestThreadsSemanticHandoffEvidence(rootPost, candidates) {
  const evidence = buildThreadsSemanticHandoffEvidence(rootPost, candidates);
  const digest = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  return `sha256:${digest}`;
}

export function createThreadsSemanticHandoff(rootPost, candidates) {
  const evidence = buildThreadsSemanticHandoffEvidence(rootPost, candidates);
  const evidenceDigest = digestThreadsSemanticHandoffEvidence(rootPost, candidates);
  return {
    schema_version: THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION,
    kind: THREADS_SEMANTIC_HANDOFF_KIND,
    producer_required: THREADS_SEMANTIC_HANDOFF_PRODUCER,
    evidence_digest: evidenceDigest,
    evidence,
    judgement_contract: {
      schema: THREADS_CONTINUATION_JUDGEMENT_SCHEMA_PATH,
      required_fields: [...THREADS_CONTINUATION_JUDGEMENT_REQUIRED_FIELDS],
      allowed_labels: [...THREADS_CONTINUATION_JUDGEMENT_ALLOWED_LABELS]
    }
  };
}

function normalizeShortcodes(value) {
  if (!Array.isArray(value) || value.length > 8) {
    throw new Error('semantic_handoff judgement selected_shortcodes must be an array with at most 8 items.');
  }
  return value.map((item) => {
    const shortcode = String(item || '').trim();
    if (!shortcode || shortcode.length > 128) {
      throw new Error('semantic_handoff judgement contains an invalid shortcode.');
    }
    return shortcode;
  });
}

function normalizeCandidateLabels(value) {
  if (!Array.isArray(value) || value.length > 8) {
    throw new Error('semantic_handoff judgement candidate_labels must be an array with at most 8 items.');
  }
  return value.map((item) => {
    const shortcode = String(item?.shortcode || '').trim();
    const label = String(item?.label || '').trim().toLowerCase();
    const confidence = Number(item?.confidence);
    if (!shortcode || shortcode.length > 128 || !ALLOWED_LABELS.has(label)) {
      throw new Error('semantic_handoff judgement contains an invalid candidate label.');
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('semantic_handoff candidate label confidence must be between 0 and 1.');
    }
    return { shortcode, label, confidence };
  });
}

export function normalizeThreadsSemanticHandoffRequest(value) {
  if (!value || typeof value !== 'object') {
    const error = new Error('semantic_handoff must be an object.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  if (value.schema_version !== THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION) {
    const error = new Error(`Unsupported semantic_handoff schema_version: ${value.schema_version ?? 'missing'}.`);
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  if (value.producer !== THREADS_SEMANTIC_HANDOFF_PRODUCER) {
    const error = new Error(`semantic_handoff producer must be ${THREADS_SEMANTIC_HANDOFF_PRODUCER}.`);
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  const evidenceDigest = String(value.evidence_digest || '').trim().toLowerCase();
  if (!DIGEST_PATTERN.test(evidenceDigest)) {
    const error = new Error('semantic_handoff evidence_digest must be a sha256 digest.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  const judgement = value.judgement;
  if (!judgement || typeof judgement !== 'object') {
    const error = new Error('semantic_handoff judgement must be an object.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  const confidence = Number(judgement.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    const error = new Error('semantic_handoff judgement confidence must be between 0 and 1.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  if (typeof judgement.root_only !== 'boolean' || typeof judgement.complete !== 'boolean') {
    const error = new Error('semantic_handoff judgement root_only and complete must be booleans.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }
  const rationale = String(judgement.rationale || '').trim();
  if (rationale.length > 1000) {
    const error = new Error('semantic_handoff judgement rationale is too long.');
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    throw error;
  }

  try {
    const normalizedJudgement = {
      selected_shortcodes: normalizeShortcodes(judgement.selected_shortcodes || []),
      root_only: judgement.root_only,
      confidence,
      complete: judgement.complete,
      rationale,
      candidate_labels: normalizeCandidateLabels(judgement.candidate_labels || [])
    };
    assertThreadsContinuationJudgementShape(normalizedJudgement);

    return {
      schema_version: THREADS_SEMANTIC_HANDOFF_SCHEMA_VERSION,
      producer: THREADS_SEMANTIC_HANDOFF_PRODUCER,
      evidence_digest: evidenceDigest,
      judgement: normalizedJudgement
    };
  } catch (cause) {
    const error = new Error(cause instanceof Error ? cause.message : String(cause));
    error.code = 'REMOTE_INGEST_REQUEST_INVALID_HANDOFF';
    error.cause = cause;
    throw error;
  }
}

export function createThreadsSemanticHandoffCaptureRanker() {
  return async ({ rootPost, candidates }) => {
    const error = new Error('Threads continuation evidence captured for semantic handoff.');
    error.code = 'THREADS_CONTINUATION_HANDOFF_CAPTURED';
    error.semantic_handoff = createThreadsSemanticHandoff(rootPost, candidates);
    throw error;
  };
}

export function createThreadsSemanticHandoffRanker(handoffInput) {
  const handoff = normalizeThreadsSemanticHandoffRequest(handoffInput);
  return async ({ rootPost, candidates }) => {
    const currentDigest = digestThreadsSemanticHandoffEvidence(rootPost, candidates);
    if (currentDigest !== handoff.evidence_digest) {
      const error = new Error('Threads continuation evidence changed after semantic handoff; restart the handoff from fresh evidence.');
      error.code = 'THREADS_CONTINUATION_HANDOFF_EVIDENCE_MISMATCH';
      throw error;
    }
    return {
      ...handoff.judgement,
      _ranker: {
        method: 'agent_semantic_handoff',
        provider: THREADS_SEMANTIC_HANDOFF_PRODUCER,
        evidence_digest: handoff.evidence_digest
      }
    };
  };
}
