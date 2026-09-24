export const THREADS_CONTINUATION_JUDGEMENT_SCHEMA_PATH = 'schema/threads-continuation-judgement.schema.json';

export const THREADS_CONTINUATION_JUDGEMENT_REQUIRED_FIELDS = Object.freeze([
  'selected_shortcodes',
  'root_only',
  'confidence',
  'complete',
  'rationale'
]);

export const THREADS_CONTINUATION_JUDGEMENT_ALLOWED_LABELS = Object.freeze([
  'continuation',
  'followup',
  'unrelated',
  'uncertain'
]);

const REQUIRED = new Set(THREADS_CONTINUATION_JUDGEMENT_REQUIRED_FIELDS);
const ALLOWED_FIELDS = new Set([...REQUIRED, 'candidate_labels']);
const ALLOWED_TOP_LEVEL = new Set([...ALLOWED_FIELDS, '_ranker']);
const ALLOWED_LABELS = new Set(THREADS_CONTINUATION_JUDGEMENT_ALLOWED_LABELS);

function isShortcode(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128;
}

function isConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateThreadsContinuationJudgementShape(value, options = {}) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['/ must be an object'] };
  }

  const allowed = options.allowRankerMetadata === true ? ALLOWED_TOP_LEVEL : ALLOWED_FIELDS;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`/${key} is not allowed`);
  }
  for (const key of REQUIRED) {
    if (!(key in value)) errors.push(`/${key} is required`);
  }

  if (!Array.isArray(value.selected_shortcodes) || value.selected_shortcodes.length > 8) {
    errors.push('/selected_shortcodes must be an array with at most 8 items');
  } else {
    const seen = new Set();
    for (const shortcode of value.selected_shortcodes) {
      if (!isShortcode(shortcode)) errors.push('/selected_shortcodes contains an invalid shortcode');
      if (seen.has(shortcode)) errors.push('/selected_shortcodes must contain unique items');
      seen.add(shortcode);
    }
  }

  if (typeof value.root_only !== 'boolean') errors.push('/root_only must be a boolean');
  if (!isConfidence(value.confidence)) errors.push('/confidence must be between 0 and 1');
  if (typeof value.complete !== 'boolean') errors.push('/complete must be a boolean');
  if (typeof value.rationale !== 'string' || value.rationale.length > 1000) {
    errors.push('/rationale must be a string with at most 1000 characters');
  }

  if (value.candidate_labels !== undefined && (!Array.isArray(value.candidate_labels) || value.candidate_labels.length > 8)) {
    errors.push('/candidate_labels must be an array with at most 8 items');
  } else if (Array.isArray(value.candidate_labels)) {
    for (const [index, item] of value.candidate_labels.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`/candidate_labels/${index} must be an object`);
        continue;
      }
      const keys = Object.keys(item);
      if (keys.length !== 3 || !keys.includes('shortcode') || !keys.includes('label') || !keys.includes('confidence')) {
        errors.push(`/candidate_labels/${index} has invalid fields`);
      }
      if (!isShortcode(item.shortcode)) errors.push(`/candidate_labels/${index}/shortcode is invalid`);
      if (!ALLOWED_LABELS.has(item.label)) errors.push(`/candidate_labels/${index}/label is invalid`);
      if (!isConfidence(item.confidence)) errors.push(`/candidate_labels/${index}/confidence must be between 0 and 1`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertThreadsContinuationJudgementShape(value, options = {}) {
  const result = validateThreadsContinuationJudgementShape(value, options);
  if (result.valid) return value;
  const error = new Error(
    `Threads continuation judgement does not match ${THREADS_CONTINUATION_JUDGEMENT_SCHEMA_PATH}: ${result.errors.join('; ')}`
  );
  error.code = 'THREADS_CONTINUATION_JUDGEMENT_SCHEMA_INVALID';
  error.validation_errors = result.errors;
  throw error;
}
