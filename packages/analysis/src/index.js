import crypto from 'node:crypto';

export const moduleId = 'analysis';
export const moduleKind = 'package';

export const ANALYSIS_SECTIONS = Object.freeze([
  '一句話介紹',
  '它解決什麼問題',
  '核心概念',
  '架構與技術',
  '主要功能',
  '技術亮點',
  '限制與風險',
  '與你的相關性',
  '建議怎麼使用',
  '與其他收藏的關聯'
]);

export const ANALYSIS_RESEARCH_VERSION = 1;

export const RESEARCH_QUESTION_IDS = Object.freeze([
  'problem',
  'core_model',
  'architecture',
  'flow',
  'implementation_support',
  'technical_mechanisms',
  'tradeoffs',
  'implementation_status',
  'operational_boundaries',
  'material_unknowns'
]);

export const RESEARCH_PLAN_STATUSES = Object.freeze([
  'not_material',
  'already_supported',
  'needs_evidence'
]);

export const RESEARCH_EVIDENCE_KINDS = Object.freeze([
  'readme',
  'documentation',
  'manifest',
  'configuration',
  'entrypoint',
  'api',
  'data_model',
  'auth',
  'security',
  'background_job',
  'deployment',
  'license',
  'source',
  'test',
  'other'
]);

export const RESEARCH_COVERAGE_DIMENSIONS = Object.freeze([
  'problem',
  'core_model',
  'architecture',
  'flow',
  'implementation_vs_claim',
  'technical_mechanisms',
  'limitations',
  'security',
  'license',
  'deployment'
]);

export const RESEARCH_COVERAGE_STATUSES = Object.freeze([
  'supported',
  'partial',
  'unavailable',
  'not_applicable'
]);

export const RESEARCH_UNAVAILABLE_REASONS = Object.freeze([
  'not_found',
  'budget_exhausted',
  'source_limited'
]);

export class AnalysisContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnalysisContractError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AnalysisContractError(code, message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value, field, code = 'ANALYSIS_INVALID') {
  if (typeof value !== 'string' || !value.trim()) fail(code, `${field} must be a non-empty string.`);
}

function stringArray(value, field, { nonEmpty = true, unique = false, code = 'ANALYSIS_INVALID' } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(code, `${field} must be ${nonEmpty ? 'a non-empty ' : 'an '}array of non-empty strings.`);
  }
  if (unique && new Set(value).size !== value.length) fail(code, `${field} must not contain duplicate values.`);
}

function exactObjectKeys(value, expected, field, code) {
  if (!isPlainObject(value)) fail(code, `${field} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(code, `${field} must contain exactly: ${wanted.join(', ')}.`);
  }
}

function digest64(value, field, code = 'ANALYSIS_RESEARCH_INVALID') {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail(code, `${field} must be a lowercase SHA-256 hex digest.`);
}

function repoRelativePath(value, field) {
  nonEmptyString(value, field, 'ANALYSIS_RESEARCH_INVALID');
  if (
    value.startsWith('/')
    || value.includes('\\')
    || value.includes('\0')
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('ANALYSIS_RESEARCH_INVALID', `${field} must be a safe repository-relative path.`);
  }
}

function validateSourceResearchBinding(value, evidence, field = 'research') {
  if (value.research_version !== ANALYSIS_RESEARCH_VERSION) {
    fail('ANALYSIS_RESEARCH_INVALID', `${field}.research_version must be ${ANALYSIS_RESEARCH_VERSION}.`);
  }
  if (value.provider !== evidence?.provider) {
    fail('ANALYSIS_RESEARCH_INVALID', `${field}.provider does not match accepted evidence.`);
  }
  if (value.source_identity !== evidence?.source_identity) {
    fail('ANALYSIS_SOURCE_MISMATCH', `${field}.source_identity does not match accepted evidence.`);
  }
  if (value.source_evidence_digest !== evidence?.evidence_digest) {
    fail('ANALYSIS_EVIDENCE_STALE', `${field}.source_evidence_digest does not match accepted evidence.`);
  }
}

export function validateResearchPlan(plan, evidence) {
  if (!isPlainObject(plan)) fail('ANALYSIS_RESEARCH_INVALID', 'Research plan must be an object.');
  validateSourceResearchBinding(plan, evidence, 'research plan');
  if (plan.provider !== 'github') {
    fail('ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED', 'Research planning currently supports GitHub repository evidence only.');
  }
  exactObjectKeys(plan.questions, RESEARCH_QUESTION_IDS, 'research plan.questions', 'ANALYSIS_RESEARCH_INVALID');

  for (const questionId of RESEARCH_QUESTION_IDS) {
    const question = plan.questions[questionId];
    if (!isPlainObject(question)) {
      fail('ANALYSIS_RESEARCH_INVALID', `research plan.questions.${questionId} must be an object.`);
    }
    if (!RESEARCH_PLAN_STATUSES.includes(question.status)) {
      fail('ANALYSIS_RESEARCH_INVALID', `research plan.questions.${questionId}.status is invalid.`);
    }
    nonEmptyString(question.rationale, `research plan.questions.${questionId}.rationale`, 'ANALYSIS_RESEARCH_INVALID');
    stringArray(question.evidence_kinds, `research plan.questions.${questionId}.evidence_kinds`, {
      nonEmpty: false,
      unique: true,
      code: 'ANALYSIS_RESEARCH_INVALID'
    });
    for (const kind of question.evidence_kinds) {
      if (!RESEARCH_EVIDENCE_KINDS.includes(kind)) {
        fail('ANALYSIS_RESEARCH_INVALID', `research plan.questions.${questionId}.evidence_kinds contains unsupported kind: ${kind}.`);
      }
    }
    stringArray(question.path_hints, `research plan.questions.${questionId}.path_hints`, {
      nonEmpty: false,
      unique: true,
      code: 'ANALYSIS_RESEARCH_INVALID'
    });
    for (let index = 0; index < question.path_hints.length; index += 1) {
      repoRelativePath(question.path_hints[index], `research plan.questions.${questionId}.path_hints[${index}]`);
    }

    if (question.status === 'needs_evidence' && question.evidence_kinds.length === 0) {
      fail('ANALYSIS_RESEARCH_INVALID', `research plan.questions.${questionId} needs at least one requested evidence kind.`);
    }
    if (question.status !== 'needs_evidence' && (question.evidence_kinds.length || question.path_hints.length)) {
      fail('ANALYSIS_RESEARCH_INVALID', `research plan.questions.${questionId} may request evidence only when status is needs_evidence.`);
    }
  }
  return plan;
}

function normalizedEvidenceItems(items) {
  return [...items]
    .map((item) => ({
      evidence_id: item.evidence_id,
      path: item.path,
      kind: item.kind,
      blob_sha: item.blob_sha,
      content_sha256: item.content_sha256,
      bytes: item.bytes
    }))
    .sort((a, b) => a.evidence_id.localeCompare(b.evidence_id) || a.path.localeCompare(b.path));
}

function digestAnalysisEvidencePayload(bundle) {
  return crypto.createHash('sha256').update(JSON.stringify({
    research_version: bundle.research_version,
    provider: bundle.provider,
    source_identity: bundle.source_identity,
    source_evidence_digest: bundle.source_evidence_digest,
    repository_revision: bundle.repository_revision,
    items: normalizedEvidenceItems(bundle.items)
  })).digest('hex');
}

export function computeAnalysisEvidenceDigest(bundle) {
  if (!isPlainObject(bundle)) fail('ANALYSIS_RESEARCH_INVALID', 'Analysis evidence bundle must be an object.');
  if (!Array.isArray(bundle.items)) fail('ANALYSIS_RESEARCH_INVALID', 'Analysis evidence bundle items must be an array.');
  return digestAnalysisEvidencePayload(bundle);
}

export function validateAnalysisEvidenceBundle(bundle, evidence) {
  if (!isPlainObject(bundle)) fail('ANALYSIS_RESEARCH_INVALID', 'Analysis evidence bundle must be an object.');
  validateSourceResearchBinding(bundle, evidence, 'analysis evidence bundle');
  if (bundle.provider !== 'github') {
    fail('ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED', 'Analysis evidence bundles currently support GitHub repository evidence only.');
  }
  if (typeof bundle.repository_revision !== 'string' || !/^[0-9a-f]{40}$/u.test(bundle.repository_revision)) {
    fail('ANALYSIS_RESEARCH_INVALID', 'analysis evidence bundle.repository_revision must be a lowercase 40-character Git commit SHA.');
  }
  if (!Array.isArray(bundle.items) || bundle.items.length === 0) {
    fail('ANALYSIS_RESEARCH_INVALID', 'analysis evidence bundle.items must be a non-empty array.');
  }

  const evidenceIds = new Set();
  const paths = new Set();
  for (let index = 0; index < bundle.items.length; index += 1) {
    const item = bundle.items[index];
    const field = `analysis evidence bundle.items[${index}]`;
    if (!isPlainObject(item)) fail('ANALYSIS_RESEARCH_INVALID', `${field} must be an object.`);
    if (typeof item.evidence_id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(item.evidence_id)) {
      fail('ANALYSIS_RESEARCH_INVALID', `${field}.evidence_id is invalid.`);
    }
    if (evidenceIds.has(item.evidence_id)) fail('ANALYSIS_RESEARCH_INVALID', `Duplicate evidence_id: ${item.evidence_id}.`);
    evidenceIds.add(item.evidence_id);

    repoRelativePath(item.path, `${field}.path`);
    if (paths.has(item.path)) fail('ANALYSIS_RESEARCH_INVALID', `Duplicate evidence path: ${item.path}.`);
    paths.add(item.path);

    if (!RESEARCH_EVIDENCE_KINDS.includes(item.kind)) {
      fail('ANALYSIS_RESEARCH_INVALID', `${field}.kind is unsupported: ${item.kind}.`);
    }
    if (typeof item.blob_sha !== 'string' || !/^[0-9a-f]{40}$/u.test(item.blob_sha)) {
      fail('ANALYSIS_RESEARCH_INVALID', `${field}.blob_sha must be a lowercase 40-character Git blob SHA.`);
    }
    digest64(item.content_sha256, `${field}.content_sha256`);
    if (!Number.isInteger(item.bytes) || item.bytes < 0) {
      fail('ANALYSIS_RESEARCH_INVALID', `${field}.bytes must be a non-negative integer.`);
    }
    if (typeof item.text !== 'string') fail('ANALYSIS_RESEARCH_INVALID', `${field}.text must be a string.`);
    const actualBytes = Buffer.byteLength(item.text, 'utf8');
    if (actualBytes !== item.bytes) fail('ANALYSIS_RESEARCH_INVALID', `${field}.bytes does not match UTF-8 content length.`);
    const actualHash = crypto.createHash('sha256').update(item.text).digest('hex');
    if (actualHash !== item.content_sha256) fail('ANALYSIS_RESEARCH_INVALID', `${field}.content_sha256 does not match text content.`);
  }

  digest64(bundle.analysis_evidence_digest, 'analysis evidence bundle.analysis_evidence_digest');
  const expectedDigest = digestAnalysisEvidencePayload(bundle);
  if (bundle.analysis_evidence_digest !== expectedDigest) {
    fail('ANALYSIS_RESEARCH_EVIDENCE_STALE', 'Analysis evidence bundle digest does not match its revision and evidence items.');
  }
  return bundle;
}

export function validateResearchReport(report, bundle) {
  if (!isPlainObject(report)) fail('ANALYSIS_RESEARCH_INVALID', 'Research report must be an object.');
  if (report.research_version !== ANALYSIS_RESEARCH_VERSION) {
    fail('ANALYSIS_RESEARCH_INVALID', `research report.research_version must be ${ANALYSIS_RESEARCH_VERSION}.`);
  }
  if (report.provider !== bundle?.provider) {
    fail('ANALYSIS_RESEARCH_INVALID', 'research report.provider does not match analysis evidence bundle.');
  }
  exactObjectKeys(report.coverage, RESEARCH_COVERAGE_DIMENSIONS, 'research report.coverage', 'ANALYSIS_RESEARCH_INVALID');
  const evidenceIds = new Set((bundle?.items || []).map((item) => item.evidence_id));

  for (const dimension of RESEARCH_COVERAGE_DIMENSIONS) {
    const entry = report.coverage[dimension];
    const field = `research report.coverage.${dimension}`;
    if (!isPlainObject(entry)) fail('ANALYSIS_RESEARCH_INVALID', `${field} must be an object.`);
    if (!RESEARCH_COVERAGE_STATUSES.includes(entry.status)) {
      fail('ANALYSIS_RESEARCH_INVALID', `${field}.status is invalid.`);
    }
    nonEmptyString(entry.note, `${field}.note`, 'ANALYSIS_RESEARCH_INVALID');
    stringArray(entry.evidence_refs, `${field}.evidence_refs`, {
      nonEmpty: false,
      unique: true,
      code: 'ANALYSIS_RESEARCH_INVALID'
    });
    for (const evidenceRef of entry.evidence_refs) {
      if (!evidenceIds.has(evidenceRef)) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field}.evidence_refs contains unknown evidence id: ${evidenceRef}.`);
      }
    }

    if (entry.status === 'supported' || entry.status === 'partial') {
      if (entry.evidence_refs.length === 0) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field} requires evidence_refs when status is ${entry.status}.`);
      }
      if (entry.unavailable_reason != null) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field}.unavailable_reason is only valid for unavailable coverage.`);
      }
    } else if (entry.status === 'unavailable') {
      if (entry.evidence_refs.length !== 0) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field} cannot cite evidence when status is unavailable.`);
      }
      if (!RESEARCH_UNAVAILABLE_REASONS.includes(entry.unavailable_reason)) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field}.unavailable_reason is invalid.`);
      }
    } else {
      if (entry.evidence_refs.length !== 0) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field} cannot cite evidence when status is not_applicable.`);
      }
      if (entry.unavailable_reason != null) {
        fail('ANALYSIS_RESEARCH_INVALID', `${field}.unavailable_reason is not valid for not_applicable coverage.`);
      }
    }
  }

  stringArray(report.unknowns, 'research report.unknowns', {
    nonEmpty: false,
    unique: true,
    code: 'ANALYSIS_RESEARCH_INVALID'
  });
  return report;
}

function validateCommonAnalysisFields(result) {
  nonEmptyString(result.title, 'title');
  nonEmptyString(result.summary, 'summary');
  if (result.summary.length > 600) fail('ANALYSIS_INVALID', 'summary must be at most 600 characters.');
  nonEmptyString(result.resource_kind, 'resource_kind');
  stringArray(result.navigation_categories, 'navigation_categories');
  stringArray(result.classification_categories, 'classification_categories');
  stringArray(result.tags, 'tags', { nonEmpty: false });
  if (!isPlainObject(result.relevance) || Object.keys(result.relevance).length === 0) fail('ANALYSIS_INVALID', 'relevance must be a non-empty object.');
  for (const [key, score] of Object.entries(result.relevance)) {
    if (!key || !Number.isInteger(score) || score < 1 || score > 5) fail('ANALYSIS_INVALID', `relevance.${key} must be an integer from 1 to 5.`);
  }
  stringArray(result.actions, 'actions');
  nonEmptyString(result.status, 'status');
  if (!isPlainObject(result.sections)) fail('ANALYSIS_INVALID', 'sections must be an object.');
  for (const heading of ANALYSIS_SECTIONS) nonEmptyString(result.sections[heading], `sections.${heading}`);
  const extras = Object.keys(result.sections).filter((heading) => !ANALYSIS_SECTIONS.includes(heading));
  if (extras.length) fail('ANALYSIS_INVALID', `sections contains unsupported headings: ${extras.join(', ')}.`);
}

function validateAnalysisResultV1(result, evidence) {
  if (result.source_identity !== evidence?.source_identity) fail('ANALYSIS_SOURCE_MISMATCH', 'Analysis source_identity does not match accepted evidence.');
  if (result.evidence_digest !== evidence?.evidence_digest) fail('ANALYSIS_EVIDENCE_STALE', 'Analysis evidence_digest does not match accepted evidence.');
  if (
    Object.hasOwn(result, 'source_evidence_digest')
    || Object.hasOwn(result, 'analysis_evidence_digest')
    || Object.hasOwn(result, 'research')
  ) {
    fail('ANALYSIS_INVALID', 'analysis_version 1 cannot contain research-bound analysis fields.');
  }
  validateCommonAnalysisFields(result);
  return result;
}

function validateAnalysisResultV2(result, evidence, analysisEvidenceBundle) {
  if (!analysisEvidenceBundle) {
    fail('ANALYSIS_RESEARCH_INVALID', 'analysis_version 2 requires an analysis evidence bundle.');
  }
  const bundle = validateAnalysisEvidenceBundle(analysisEvidenceBundle, evidence);
  if (result.source_identity !== evidence?.source_identity) fail('ANALYSIS_SOURCE_MISMATCH', 'Analysis source_identity does not match accepted evidence.');
  if (result.source_evidence_digest !== evidence?.evidence_digest) {
    fail('ANALYSIS_EVIDENCE_STALE', 'Analysis source_evidence_digest does not match accepted evidence.');
  }
  if (result.analysis_evidence_digest !== bundle.analysis_evidence_digest) {
    fail('ANALYSIS_RESEARCH_EVIDENCE_STALE', 'Analysis analysis_evidence_digest does not match analysis evidence bundle.');
  }
  if (Object.hasOwn(result, 'evidence_digest')) {
    fail('ANALYSIS_INVALID', 'analysis_version 2 must use source_evidence_digest instead of evidence_digest.');
  }
  validateResearchReport(result.research, bundle);
  validateCommonAnalysisFields(result);
  return result;
}

export function validateAnalysisResult(result, evidence, analysisEvidenceBundle = null) {
  if (!isPlainObject(result)) fail('ANALYSIS_INVALID', 'Analysis result must be an object.');
  if (result.analysis_version === 1) return validateAnalysisResultV1(result, evidence);
  if (result.analysis_version === 2) return validateAnalysisResultV2(result, evidence, analysisEvidenceBundle);
  fail('ANALYSIS_INVALID', 'analysis_version must be 1 or 2.');
}

export function bindAnalysisToEvidence(template, evidence) {
  return validateAnalysisResult({
    ...template,
    analysis_version: 1,
    source_identity: evidence.source_identity,
    evidence_digest: evidence.evidence_digest
  }, evidence);
}

export function bindResearchAnalysisToEvidence(template, evidence, analysisEvidenceBundle) {
  const bundle = validateAnalysisEvidenceBundle(analysisEvidenceBundle, evidence);
  return validateAnalysisResult({
    ...template,
    analysis_version: 2,
    source_identity: evidence.source_identity,
    source_evidence_digest: evidence.evidence_digest,
    analysis_evidence_digest: bundle.analysis_evidence_digest
  }, evidence, bundle);
}
