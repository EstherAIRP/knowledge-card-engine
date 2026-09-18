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

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail('ANALYSIS_INVALID', `${field} must be a non-empty string.`);
}

function stringArray(value, field, { nonEmpty = true } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail('ANALYSIS_INVALID', `${field} must be ${nonEmpty ? 'a non-empty ' : 'an '}array of non-empty strings.`);
  }
}

export function validateAnalysisResult(result, evidence) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('ANALYSIS_INVALID', 'Analysis result must be an object.');
  if (result.analysis_version !== 1) fail('ANALYSIS_INVALID', 'analysis_version must be 1.');
  if (result.source_identity !== evidence?.source_identity) fail('ANALYSIS_SOURCE_MISMATCH', 'Analysis source_identity does not match accepted evidence.');
  if (result.evidence_digest !== evidence?.evidence_digest) fail('ANALYSIS_EVIDENCE_STALE', 'Analysis evidence_digest does not match accepted evidence.');
  nonEmptyString(result.title, 'title');
  nonEmptyString(result.summary, 'summary');
  if (result.summary.length > 600) fail('ANALYSIS_INVALID', 'summary must be at most 600 characters.');
  nonEmptyString(result.resource_kind, 'resource_kind');
  stringArray(result.navigation_categories, 'navigation_categories');
  stringArray(result.classification_categories, 'classification_categories');
  stringArray(result.tags, 'tags', { nonEmpty: false });
  if (!result.relevance || typeof result.relevance !== 'object' || Array.isArray(result.relevance) || Object.keys(result.relevance).length === 0) fail('ANALYSIS_INVALID', 'relevance must be a non-empty object.');
  for (const [key, score] of Object.entries(result.relevance)) {
    if (!key || !Number.isInteger(score) || score < 1 || score > 5) fail('ANALYSIS_INVALID', `relevance.${key} must be an integer from 1 to 5.`);
  }
  stringArray(result.actions, 'actions');
  nonEmptyString(result.status, 'status');
  if (!result.sections || typeof result.sections !== 'object' || Array.isArray(result.sections)) fail('ANALYSIS_INVALID', 'sections must be an object.');
  for (const heading of ANALYSIS_SECTIONS) nonEmptyString(result.sections[heading], `sections.${heading}`);
  const extras = Object.keys(result.sections).filter((heading) => !ANALYSIS_SECTIONS.includes(heading));
  if (extras.length) fail('ANALYSIS_INVALID', `sections contains unsupported headings: ${extras.join(', ')}.`);
  return result;
}

export function bindAnalysisToEvidence(template, evidence) {
  return validateAnalysisResult({
    ...template,
    analysis_version: 1,
    source_identity: evidence.source_identity,
    evidence_digest: evidence.evidence_digest
  }, evidence);
}
