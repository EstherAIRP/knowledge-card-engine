import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const moduleId = 'core';
export const moduleKind = 'package';

export const REQUIRED_SECTIONS = Object.freeze([
  '一句話介紹',
  '它解決什麼問題',
  '核心概念',
  '架構與技術',
  '主要功能',
  '技術亮點',
  '限制與風險',
  '與你的相關性',
  '建議怎麼使用',
  '與其他收藏的關聯',
  '使用者備註',
  '更新紀錄'
]);

const CARD_SCHEMA_URL = new URL('../../../schema/knowledge-card.schema.json', import.meta.url);
const TAXONOMY_SCHEMA_URL = new URL('../../../schema/taxonomy.schema.json', import.meta.url);

export class CardContractError extends Error {
  constructor(code, message, issues = []) {
    super(message);
    this.name = 'CardContractError';
    this.code = code;
    this.issues = issues;
  }
}

function makeIssue(code, valuePath, message, filePath = null) {
  return { code, path: valuePath, message, filePath };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodeRefSegment(value) {
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

function resolveLocalRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) return null;
  return ref.slice(2).split('/').map(decodeRefSegment).reduce((current, key) => current?.[key], rootSchema);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function isValidUri(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

export function validateJsonSchema(value, schema, rootSchema = schema, valuePath = '$') {
  const errors = [];

  function visit(current, node, currentPath) {
    if (!node || typeof node !== 'object') return;

    if (node.$ref) {
      const target = resolveLocalRef(rootSchema, node.$ref);
      if (!target) {
        errors.push(makeIssue('SCHEMA_REF_INVALID', currentPath, 'Unknown schema ref: ' + node.$ref));
        return;
      }
      visit(current, target, currentPath);
      return;
    }

    if (Array.isArray(node.oneOf)) {
      let matches = 0;
      for (const candidate of node.oneOf) {
        if (validateJsonSchema(current, candidate, rootSchema, currentPath).length === 0) matches += 1;
      }
      if (matches !== 1) {
        errors.push(makeIssue('SCHEMA_ONE_OF', currentPath, 'Expected exactly one schema branch to match; matched ' + matches + '.'));
      }
      return;
    }

    if (Object.hasOwn(node, 'const') && current !== node.const) {
      errors.push(makeIssue('SCHEMA_CONST', currentPath, 'Expected constant value ' + JSON.stringify(node.const) + '.'));
      return;
    }

    if (Array.isArray(node.enum) && !node.enum.some((candidate) => Object.is(candidate, current))) {
      errors.push(makeIssue('SCHEMA_ENUM', currentPath, 'Value is not one of the allowed enum values.'));
      return;
    }

    if (node.type) {
      let matchesType = true;
      if (node.type === 'null') matchesType = current === null;
      else if (node.type === 'string') matchesType = typeof current === 'string';
      else if (node.type === 'integer') matchesType = Number.isInteger(current);
      else if (node.type === 'number') matchesType = typeof current === 'number' && Number.isFinite(current);
      else if (node.type === 'array') matchesType = Array.isArray(current);
      else if (node.type === 'object') matchesType = isPlainObject(current);
      else if (node.type === 'boolean') matchesType = typeof current === 'boolean';
      if (!matchesType) {
        errors.push(makeIssue('SCHEMA_TYPE', currentPath, 'Expected type ' + node.type + '.'));
        return;
      }
    }

    if (typeof current === 'string') {
      if (Number.isInteger(node.minLength) && current.length < node.minLength) {
        errors.push(makeIssue('SCHEMA_MIN_LENGTH', currentPath, 'String is shorter than ' + node.minLength + '.'));
      }
      if (Number.isInteger(node.maxLength) && current.length > node.maxLength) {
        errors.push(makeIssue('SCHEMA_MAX_LENGTH', currentPath, 'String is longer than ' + node.maxLength + '.'));
      }
      if (node.pattern && !new RegExp(node.pattern).test(current)) {
        errors.push(makeIssue('SCHEMA_PATTERN', currentPath, 'String does not match required pattern.'));
      }
      if (node.format === 'date' && !isValidDateString(current)) {
        errors.push(makeIssue('SCHEMA_FORMAT_DATE', currentPath, 'Value must be a valid YYYY-MM-DD date.'));
      }
      if (node.format === 'uri' && !isValidUri(current)) {
        errors.push(makeIssue('SCHEMA_FORMAT_URI', currentPath, 'Value must be a valid URI.'));
      }
    }

    if (typeof current === 'number') {
      if (typeof node.minimum === 'number' && current < node.minimum) {
        errors.push(makeIssue('SCHEMA_MINIMUM', currentPath, 'Value must be >= ' + node.minimum + '.'));
      }
      if (typeof node.maximum === 'number' && current > node.maximum) {
        errors.push(makeIssue('SCHEMA_MAXIMUM', currentPath, 'Value must be <= ' + node.maximum + '.'));
      }
    }

    if (Array.isArray(current)) {
      if (Number.isInteger(node.minItems) && current.length < node.minItems) {
        errors.push(makeIssue('SCHEMA_MIN_ITEMS', currentPath, 'Array requires at least ' + node.minItems + ' item(s).'));
      }
      if (node.uniqueItems) {
        const seen = new Set();
        for (const item of current) {
          const key = JSON.stringify(item);
          if (seen.has(key)) {
            errors.push(makeIssue('SCHEMA_UNIQUE_ITEMS', currentPath, 'Array items must be unique.'));
            break;
          }
          seen.add(key);
        }
      }
      if (node.items) current.forEach((itemValue, index) => visit(itemValue, node.items, currentPath + '[' + index + ']'));
    }

    if (isPlainObject(current)) {
      if (Number.isInteger(node.minProperties) && Object.keys(current).length < node.minProperties) {
        errors.push(makeIssue('SCHEMA_MIN_PROPERTIES', currentPath, 'Object requires at least ' + node.minProperties + ' properties.'));
      }
      for (const key of node.required || []) {
        if (!Object.hasOwn(current, key)) errors.push(makeIssue('SCHEMA_REQUIRED', currentPath + '.' + key, 'Required property is missing.'));
      }
      const properties = node.properties || {};
      for (const [key, child] of Object.entries(properties)) {
        if (Object.hasOwn(current, key)) visit(current[key], child, currentPath + '.' + key);
      }
      for (const [key, childValue] of Object.entries(current)) {
        if (Object.hasOwn(properties, key)) continue;
        if (node.additionalProperties === false) {
          errors.push(makeIssue('SCHEMA_ADDITIONAL_PROPERTY', currentPath + '.' + key, 'Additional property is not allowed.'));
        } else if (isPlainObject(node.additionalProperties)) {
          visit(childValue, node.additionalProperties, currentPath + '.' + key);
        }
      }
    }
  }

  visit(value, schema, valuePath);
  return errors;
}

async function readBundledJson(url) {
  return JSON.parse(await fs.readFile(url, 'utf8'));
}

export async function loadCardSchema() {
  return readBundledJson(CARD_SCHEMA_URL);
}

export async function loadTaxonomySchema() {
  return readBundledJson(TAXONOMY_SCHEMA_URL);
}

export function parseCardDocument(text, filePath = '<memory>') {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) throw new CardContractError('CARD_FRONTMATTER_MISSING', filePath + ': missing YAML frontmatter opening delimiter.');
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) throw new CardContractError('CARD_FRONTMATTER_MISSING', filePath + ': missing YAML frontmatter closing delimiter.');

  const frontmatterText = normalized.slice(4, end);
  let data;
  try {
    data = parseYaml(frontmatterText);
  } catch (cause) {
    const error = new CardContractError('CARD_FRONTMATTER_INVALID', filePath + ': frontmatter is invalid YAML.');
    error.cause = cause;
    throw error;
  }
  if (!isPlainObject(data)) throw new CardContractError('CARD_FRONTMATTER_INVALID', filePath + ': frontmatter must parse to an object.');

  return {
    filePath,
    raw: normalized,
    data,
    body: normalized.slice(end + 5),
    frontmatterText
  };
}

export function parseTaxonomyDocument(text, filePath = '<taxonomy>') {
  let value;
  try {
    value = parseYaml(String(text));
  } catch (cause) {
    const error = new CardContractError('TAXONOMY_YAML_INVALID', filePath + ': taxonomy is invalid YAML.');
    error.cause = cause;
    throw error;
  }
  if (!isPlainObject(value)) throw new CardContractError('TAXONOMY_INVALID', filePath + ': taxonomy must parse to an object.');
  return value;
}

function exactSetErrors(actual, expected, field, filePath) {
  const actualKeys = [...actual].sort();
  const expectedKeys = [...expected].sort();
  if (JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)) return [];
  return [makeIssue('TAXONOMY_DIMENSIONS_MISMATCH', field, 'Expected dimensions [' + expectedKeys.join(', ') + '], received [' + actualKeys.join(', ') + '].', filePath)];
}

function membershipErrors(values, allowed, field, filePath) {
  const result = [];
  for (const value of values) {
    if (!allowed.has(value)) result.push(makeIssue('TAXONOMY_VALUE_INVALID', field, 'Value "' + value + '" is not allowed by taxonomy.', filePath));
  }
  return result;
}

export async function validateTaxonomy(taxonomy, filePath = '<taxonomy>') {
  const schema = await loadTaxonomySchema();
  const errors = validateJsonSchema(taxonomy, schema).map((entry) => ({ ...entry, filePath }));
  if (!isPlainObject(taxonomy)) return errors;
  if (!Object.hasOwn(taxonomy.relevance_dimensions || {}, 'overall')) {
    errors.push(makeIssue('TAXONOMY_OVERALL_REQUIRED', '$.relevance_dimensions.overall', 'Taxonomy must define the overall relevance dimension.', filePath));
  }
  const scaleKeys = Object.keys(taxonomy.relevance_scale || {}).map(String).sort();
  if (JSON.stringify(scaleKeys) !== JSON.stringify(['1', '2', '3', '4', '5'])) {
    errors.push(makeIssue('TAXONOMY_SCALE_INVALID', '$.relevance_scale', 'Relevance scale must define exactly scores 1 through 5.', filePath));
  }
  return errors;
}

function bodyContractErrors(card) {
  const errors = [];
  let previous = -1;
  for (const heading of REQUIRED_SECTIONS) {
    const escaped = heading.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    const match = new RegExp('^## ' + escaped + '\\s*$', 'm').exec(card.body);
    if (!match) {
      errors.push(makeIssue('CARD_SECTION_MISSING', '$body', 'Missing required section "## ' + heading + '".', card.filePath));
      continue;
    }
    if (match.index <= previous) errors.push(makeIssue('CARD_SECTION_ORDER', '$body', 'Section "## ' + heading + '" is out of canonical order.', card.filePath));
    previous = match.index;
  }

  const titleMatch = /^#\s+(.+)$/m.exec(card.body);
  const h1 = titleMatch ? titleMatch[1].trim() : null;
  if (!h1) errors.push(makeIssue('CARD_H1_MISSING', '$body', 'Missing H1 title.', card.filePath));
  else if (h1 !== card.data.title) errors.push(makeIssue('CARD_H1_TITLE_MISMATCH', '$body', 'H1 "' + h1 + '" does not match frontmatter title "' + card.data.title + '".', card.filePath));
  return errors;
}

function dateContractErrors(card) {
  const errors = [];
  const created = card.data.created_at;
  const updated = card.data.updated_at;
  const checked = card.data.last_checked_at;
  if (typeof created === 'string' && typeof updated === 'string' && updated < created) errors.push(makeIssue('CARD_DATE_ORDER', '$.updated_at', 'updated_at must be >= created_at.', card.filePath));
  if (typeof created === 'string' && typeof checked === 'string' && checked < created) errors.push(makeIssue('CARD_DATE_ORDER', '$.last_checked_at', 'last_checked_at must be >= created_at.', card.filePath));
  return errors;
}

function taxonomyContractErrors(card, taxonomy) {
  const errors = [];
  const sourceTypes = new Set(taxonomy.source_types || []);
  const resourceKinds = new Set(taxonomy.resource_kinds || []);
  const categories = new Set(taxonomy.categories || []);
  const navigation = new Set(taxonomy.navigation_categories || []);
  const actions = new Set(Object.keys(taxonomy.actions || {}));
  const statuses = new Set(taxonomy.statuses || []);
  const dimensions = new Set(Object.keys(taxonomy.relevance_dimensions || {}));

  if (card.data?.source?.type) errors.push(...membershipErrors([card.data.source.type], sourceTypes, '$.source.type', card.filePath));

  const scalarWrappers = [
    ['$.resource_kind', card.data?.resource_kind, resourceKinds],
    ['$.status', card.data?.status, statuses]
  ];
  for (const [field, wrapper, allowed] of scalarWrappers) {
    if (wrapper?.ai != null) errors.push(...membershipErrors([wrapper.ai], allowed, field + '.ai', card.filePath));
    if (wrapper?.user != null) errors.push(...membershipErrors([wrapper.user], allowed, field + '.user', card.filePath));
  }

  const listWrappers = [
    ['$.navigation.categories', card.data?.navigation?.categories, navigation],
    ['$.classification.categories', card.data?.classification?.categories, categories],
    ['$.actions', card.data?.actions, actions]
  ];
  for (const [field, wrapper, allowed] of listWrappers) {
    if (Array.isArray(wrapper?.ai)) errors.push(...membershipErrors(wrapper.ai, allowed, field + '.ai', card.filePath));
    if (Array.isArray(wrapper?.user)) errors.push(...membershipErrors(wrapper.user, allowed, field + '.user', card.filePath));
  }

  const aiDimensions = new Set(Object.keys(card.data?.relevance?.ai || {}));
  errors.push(...exactSetErrors(aiDimensions, dimensions, '$.relevance.ai', card.filePath));
  for (const key of Object.keys(card.data?.relevance?.user || {})) {
    if (!dimensions.has(key)) errors.push(makeIssue('TAXONOMY_DIMENSION_INVALID', '$.relevance.user.' + key, 'Unknown relevance dimension "' + key + '".', card.filePath));
  }
  return errors;
}

export async function validateCard(card, taxonomy) {
  const schema = await loadCardSchema();
  const errors = validateJsonSchema(card.data, schema).map((entry) => ({ ...entry, filePath: card.filePath }));
  errors.push(...bodyContractErrors(card));
  errors.push(...dateContractErrors(card));
  errors.push(...taxonomyContractErrors(card, taxonomy));
  return errors;
}

export async function validateCardCollection(cards, taxonomy) {
  const errors = [...await validateTaxonomy(taxonomy)];
  const seen = { id: new Map(), identity: new Map(), canonical: new Map() };

  for (const card of cards) {
    errors.push(...await validateCard(card, taxonomy));
    const values = [
      ['id', card.data?.id],
      ['identity', card.data?.source?.identity],
      ['canonical', card.data?.canonical_url]
    ];
    for (const [kind, value] of values) {
      if (!value) continue;
      if (seen[kind].has(value)) {
        errors.push(makeIssue('CARD_DUPLICATE', kind, 'Duplicate ' + kind + ' "' + value + '" also used by ' + seen[kind].get(value) + '.', card.filePath));
      } else {
        seen[kind].set(value, card.filePath);
      }
    }
  }
  return errors;
}

export function effectiveOwnershipValue(wrapper) {
  return wrapper?.user ?? wrapper?.ai ?? null;
}

export function effectiveRelevance(relevance) {
  const ai = isPlainObject(relevance?.ai) ? relevance.ai : {};
  const user = isPlainObject(relevance?.user) ? relevance.user : {};
  return Object.fromEntries(Object.entries(ai).map(([key, value]) => [key, Object.hasOwn(user, key) ? user[key] : value]));
}

export function extractSection(body, heading) {
  const escaped = heading.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  const match = new RegExp('^## ' + escaped + '\\s*$', 'm').exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const tail = body.slice(start);
  const next = /^##\s+/m.exec(tail);
  const end = next ? start + next.index : body.length;
  return body.slice(start, end);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function compareUserOwnedState(before, after) {
  const checks = [
    ['id', before.data?.id, after.data?.id],
    ['created_at', before.data?.created_at, after.data?.created_at],
    ['resource_kind.user', before.data?.resource_kind?.user ?? null, after.data?.resource_kind?.user ?? null],
    ['navigation.categories.user', before.data?.navigation?.categories?.user ?? null, after.data?.navigation?.categories?.user ?? null],
    ['classification.categories.user', before.data?.classification?.categories?.user ?? null, after.data?.classification?.categories?.user ?? null],
    ['classification.tags.user', before.data?.classification?.tags?.user ?? null, after.data?.classification?.tags?.user ?? null],
    ['relevance.user', before.data?.relevance?.user ?? {}, after.data?.relevance?.user ?? {}],
    ['actions.user', before.data?.actions?.user ?? null, after.data?.actions?.user ?? null],
    ['status.user', before.data?.status?.user ?? null, after.data?.status?.user ?? null]
  ];

  const errors = [];
  for (const [name, oldValue, newValue] of checks) {
    if (!sameJson(oldValue, newValue)) errors.push(makeIssue('CARD_USER_OWNERSHIP_CHANGED', name, name + ' changed but is user/stable-owned.', after.filePath));
  }

  if (extractSection(before.body, '使用者備註') !== extractSection(after.body, '使用者備註')) {
    errors.push(makeIssue('CARD_USER_NOTES_CHANGED', '$body.使用者備註', '## 使用者備註 changed but is user-owned.', after.filePath));
  }
  return errors;
}

export function suggestedCardPath(cardData) {
  const year = String(cardData?.created_at || '').slice(0, 4);
  if (!/^\d{4}$/.test(year)) throw new CardContractError('CARD_PATH_DATE_INVALID', 'created_at must provide a four-digit year for a new Card path.');
  if (typeof cardData?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cardData.id)) throw new CardContractError('CARD_PATH_ID_INVALID', 'Card id is invalid for a stable path.');
  return 'content/knowledge/' + year + '/' + cardData.id + '.md';
}

export function resolveCardWritePath(existingPath, cardData) {
  return existingPath || suggestedCardPath(cardData);
}

export async function walkCardFiles(contentRoot) {
  const result = [];
  const stack = [contentRoot];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (cause) {
      if (cause?.code === 'ENOENT') return [];
      throw cause;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') result.push(full);
    }
  }
  return result.sort();
}

export async function loadCardDocuments(contentRoot) {
  const files = await walkCardFiles(contentRoot);
  const cards = [];
  for (const filePath of files) cards.push(parseCardDocument(await fs.readFile(filePath, 'utf8'), filePath));
  return cards;
}

export async function loadTaxonomyFile(filePath) {
  return parseTaxonomyDocument(await fs.readFile(filePath, 'utf8'), filePath);
}

export function assertNoValidationIssues(issues, code = 'CARD_VALIDATION_FAILED') {
  if (issues.length) throw new CardContractError(code, 'Validation failed with ' + issues.length + ' issue(s).', issues);
}
