import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  loadCardDocuments,
  loadTaxonomyFile,
  parseCardDocument,
  resolveControlledTag,
  validateCardCollection
} from '../../core/src/index.js';
import { loadWorkspace } from './index.js';

export class TagMigrationError extends Error {
  constructor(code, message, issues = []) {
    super(message);
    this.name = 'TagMigrationError';
    this.code = code;
    this.issues = issues;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected, field) {
  if (!isPlainObject(value)) {
    throw new TagMigrationError('TAG_MIGRATION_PLAN_INVALID', field + ' must be an object.');
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TagMigrationError(
      'TAG_MIGRATION_PLAN_INVALID',
      field + ' must contain exactly: ' + wanted.join(', ') + '.'
    );
  }
}

function validateTagList(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TagMigrationError('TAG_MIGRATION_PLAN_INVALID', field + ' must be an array of non-empty strings' + (nullable ? ' or null.' : '.'));
  }
  if (new Set(value).size !== value.length) {
    throw new TagMigrationError('TAG_MIGRATION_PLAN_INVALID', field + ' must not contain duplicates.');
  }
}

function validateTagState(value, field) {
  exactKeys(value, ['ai', 'user'], field);
  validateTagList(value.ai, field + '.ai');
  validateTagList(value.user, field + '.user', { nullable: true });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function currentTagState(card) {
  return {
    ai: card.data?.classification?.tags?.ai ?? [],
    user: card.data?.classification?.tags?.user ?? null
  };
}

function resolveTargetState(taxonomy, value, field) {
  const resolveList = (items, listField) => items.map((item) => {
    const resolved = resolveControlledTag(taxonomy, item);
    if (!resolved) {
      throw new TagMigrationError(
        'TAG_MIGRATION_TAG_UNKNOWN',
        listField + ' contains unregistered tag or alias: ' + item + '.'
      );
    }
    return resolved;
  });

  const ai = resolveList(value.ai, field + '.ai');
  const user = value.user === null ? null : resolveList(value.user, field + '.user');
  if (new Set(ai).size !== ai.length || (Array.isArray(user) && new Set(user).size !== user.length)) {
    throw new TagMigrationError(
      'TAG_MIGRATION_PLAN_INVALID',
      field + ' resolves multiple values to the same canonical tag.'
    );
  }
  return {
    ai: ai.sort((left, right) => left.localeCompare(right, 'en')),
    user: user?.sort((left, right) => left.localeCompare(right, 'en')) ?? null
  };
}

function renderCard(card, data) {
  return `---\n${stringifyYaml(data, { lineWidth: 0 }).trimEnd()}\n---\n${card.body}`;
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function rollbackFile(filePath, prior) {
  if (prior == null) await fs.rm(filePath, { force: true });
  else await fs.writeFile(filePath, prior, 'utf8');
}

async function commitMigration(entries) {
  const nonce = crypto.randomUUID();
  const prepared = [];
  try {
    for (const entry of entries) {
      const prior = await readIfExists(entry.filePath);
      const tmpPath = `${entry.filePath}.tmp-${nonce}`;
      await fs.writeFile(tmpPath, entry.content, 'utf8');
      prepared.push({ ...entry, prior, tmpPath });
    }

    const committed = [];
    try {
      for (const entry of prepared) {
        await fs.rename(entry.tmpPath, entry.filePath);
        committed.push(entry);
      }
    } catch (error) {
      const rollbackErrors = [];
      for (const entry of [...committed].reverse()) {
        try {
          await rollbackFile(entry.filePath, entry.prior);
        } catch (rollbackError) {
          rollbackErrors.push({
            file_path: entry.filePath,
            message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          });
        }
      }
      if (rollbackErrors.length) error.rollback_errors = rollbackErrors;
      throw error;
    }
  } finally {
    for (const entry of prepared) {
      await fs.rm(entry.tmpPath, { force: true }).catch(() => {});
    }
  }
}

export async function applyTagMigrationPlan(workspaceRoot, plan, { write = false } = {}) {
  exactKeys(plan, ['schema_version', 'cards'], 'tag migration plan');
  if (plan.schema_version !== 1) {
    throw new TagMigrationError('TAG_MIGRATION_PLAN_INVALID', 'tag migration plan.schema_version must be 1.');
  }
  if (!isPlainObject(plan.cards) || Object.keys(plan.cards).length === 0) {
    throw new TagMigrationError('TAG_MIGRATION_PLAN_INVALID', 'tag migration plan.cards must be a non-empty object.');
  }

  const workspace = await loadWorkspace(workspaceRoot);
  const taxonomy = await loadTaxonomyFile(path.join(workspace.paths.config, 'taxonomy.yaml'));
  if (!isPlainObject(taxonomy.tag_policy)) {
    throw new TagMigrationError('TAG_POLICY_REQUIRED', 'Workspace taxonomy must define tag_policy before migration.');
  }

  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const byId = new Map(cards.map((card) => [card.data.id, card]));
  const replacements = new Map();

  for (const [cardId, migration] of Object.entries(plan.cards)) {
    exactKeys(migration, ['from', 'to'], `tag migration plan.cards.${cardId}`);
    validateTagState(migration.from, `tag migration plan.cards.${cardId}.from`);
    validateTagState(migration.to, `tag migration plan.cards.${cardId}.to`);
    const card = byId.get(cardId);
    if (!card) {
      throw new TagMigrationError('TAG_MIGRATION_CARD_NOT_FOUND', 'Unknown Card id in tag migration plan: ' + cardId + '.');
    }
    const current = currentTagState(card);
    if (!sameJson(current, migration.from)) {
      throw new TagMigrationError(
        'TAG_MIGRATION_STALE',
        'Tag migration plan no longer matches current tags for Card ' + cardId + '.'
      );
    }

    const target = resolveTargetState(taxonomy, migration.to, `tag migration plan.cards.${cardId}.to`);
    if (sameJson(current, target)) continue;
    const data = structuredClone(card.data);
    data.classification.tags = target;
    const raw = renderCard(card, data);
    replacements.set(cardId, {
      card: parseCardDocument(raw, card.filePath),
      raw
    });
  }

  const candidates = cards.map((card) => replacements.get(card.data.id)?.card || card);
  const issues = await validateCardCollection(candidates, taxonomy);
  if (issues.length) {
    throw new TagMigrationError(
      'TAG_MIGRATION_VALIDATION_FAILED',
      'Tag migration candidate collection failed validation.',
      issues
    );
  }

  const entries = [...replacements.values()].map(({ card, raw }) => ({
    filePath: card.filePath,
    content: raw
  }));
  if (write && entries.length) await commitMigration(entries);

  return {
    mode: write ? 'write' : 'dry-run',
    card_count: cards.length,
    planned_count: Object.keys(plan.cards).length,
    changed_count: entries.length
  };
}
