import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  compareUserOwnedState,
  extractSection,
  loadCardDocuments,
  loadTaxonomyFile,
  parseCardDocument,
  resolveCardWritePath,
  validateCardCollection
} from '../../core/src/index.js';
import { validateAnalysisResult, ANALYSIS_SECTIONS } from '../../analysis/src/index.js';
import {
  buildGitHubSourceState,
  githubSourceStatePath,
  resolveIngestionTarget,
  validateGitHubEvidence,
  validateGitHubSourceState
} from '../../ingestion/src/index.js';
import { loadWorkspace } from './index.js';

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sectionText(card, heading) {
  const raw = extractSection(card.body, heading);
  return raw == null ? null : raw.trim();
}

function normalizedAnalysisState(card) {
  return {
    title: card.data.title,
    canonical_url: card.data.canonical_url,
    source: card.data.source,
    summary: card.data.summary,
    resource_kind: card.data.resource_kind?.ai ?? null,
    navigation_categories: card.data.navigation?.categories?.ai ?? [],
    classification_categories: card.data.classification?.categories?.ai ?? [],
    tags: card.data.classification?.tags?.ai ?? [],
    relevance: card.data.relevance?.ai ?? {},
    actions: card.data.actions?.ai ?? [],
    status: card.data.status?.ai ?? null,
    sections: Object.fromEntries(ANALYSIS_SECTIONS.map((heading) => [heading, sectionText(card, heading)]))
  };
}

function desiredAnalysisState(evidence, analysis) {
  return {
    title: analysis.title,
    canonical_url: evidence.canonical_url,
    source: {
      type: 'github',
      url: evidence.canonical_url,
      identity: evidence.source_identity
    },
    summary: analysis.summary,
    resource_kind: analysis.resource_kind,
    navigation_categories: analysis.navigation_categories,
    classification_categories: analysis.classification_categories,
    tags: analysis.tags,
    relevance: analysis.relevance,
    actions: analysis.actions,
    status: analysis.status,
    sections: analysis.sections
  };
}

function normalizeSectionPayload(value) {
  return String(value).trim();
}

function appendUpdateLog(existingRaw, date, message) {
  const entry = `\n### ${date}\n\n- ${message}\n`;
  if (typeof existingRaw !== 'string') return `\n${entry}`;
  if (existingRaw.includes(`### ${date}`) && existingRaw.includes(message)) return existingRaw;
  return existingRaw.replace(/\s*$/, '') + '\n' + entry;
}

function renderBody(title, sections, notesRaw, updateLogRaw) {
  const chunks = [`# ${title}\n`];
  for (const heading of ANALYSIS_SECTIONS) {
    chunks.push(`## ${heading}\n\n${normalizeSectionPayload(sections[heading])}\n`);
  }
  chunks.push('## 使用者備註');
  chunks.push(notesRaw ?? '\n\n');
  chunks.push('## 更新紀錄');
  chunks.push(updateLogRaw ?? '\n\n');
  return chunks.join('\n');
}

function preserveUserWrapper(existingWrapper, aiValue, emptyUser) {
  return {
    ai: aiValue,
    user: existingWrapper && Object.hasOwn(existingWrapper, 'user') ? existingWrapper.user : emptyUser
  };
}

function buildCardDocument({ evidence, analysis, target, capturedDate }) {
  const existing = target.existingCard;
  const substantiveChange = !existing || !sameJson(normalizedAnalysisState(existing), desiredAnalysisState(evidence, analysis));
  const createdAt = existing?.data?.created_at || capturedDate;
  const updatedAt = existing && !substantiveChange ? existing.data.updated_at : capturedDate;

  const data = {
    schema_version: 1,
    id: existing?.data?.id || target.id,
    title: analysis.title,
    canonical_url: evidence.canonical_url,
    source: {
      type: 'github',
      url: evidence.canonical_url,
      identity: evidence.source_identity
    },
    resource_kind: preserveUserWrapper(existing?.data?.resource_kind, analysis.resource_kind, null),
    created_at: createdAt,
    updated_at: updatedAt,
    last_checked_at: capturedDate,
    summary: analysis.summary,
    navigation: {
      categories: preserveUserWrapper(existing?.data?.navigation?.categories, analysis.navigation_categories, null)
    },
    classification: {
      categories: preserveUserWrapper(existing?.data?.classification?.categories, analysis.classification_categories, null),
      tags: preserveUserWrapper(existing?.data?.classification?.tags, analysis.tags, null)
    },
    relevance: {
      ai: analysis.relevance,
      user: existing?.data?.relevance?.user ?? {}
    },
    actions: preserveUserWrapper(existing?.data?.actions, analysis.actions, null),
    status: preserveUserWrapper(existing?.data?.status, analysis.status, null)
  };

  const notesRaw = existing ? extractSection(existing.body, '使用者備註') : '\n\n';
  let updateLogRaw = existing ? extractSection(existing.body, '更新紀錄') : null;
  if (!existing) {
    updateLogRaw = appendUpdateLog(updateLogRaw, capturedDate, '建立自 GitHub accepted evidence。');
  } else if (substantiveChange) {
    updateLogRaw = appendUpdateLog(updateLogRaw, capturedDate, '依 GitHub accepted evidence 更新 AI 分析。');
  }

  const body = renderBody(analysis.title, analysis.sections, notesRaw, updateLogRaw);
  const raw = `---\n${stringifyYaml(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${body}`;
  const card = parseCardDocument(raw, existing?.filePath || '<new-card>');
  return { card, raw, substantiveChange };
}

function replaceCard(cards, existing, replacement) {
  if (!existing) return [...cards, replacement];
  return cards.map((card) => card.filePath === existing.filePath ? replacement : card);
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

export async function applyAcceptedGitHubAnalysis(workspaceRoot, evidence, analysis) {
  validateGitHubEvidence(evidence);
  validateAnalysisResult(analysis, evidence);
  const workspace = await loadWorkspace(workspaceRoot);
  const taxonomy = await loadTaxonomyFile(path.join(workspace.paths.config, 'taxonomy.yaml'));
  const cards = await loadCardDocuments(workspace.paths.knowledge);
  const target = resolveIngestionTarget(cards, evidence);
  const capturedDate = evidence.captured_at.slice(0, 10);
  const built = buildCardDocument({ evidence, analysis, target, capturedDate });

  if (target.existingCard) {
    const ownershipIssues = compareUserOwnedState(target.existingCard, built.card);
    if (ownershipIssues.length) {
      const error = new Error('Knowledge Card update would modify user/stable-owned state.');
      error.code = 'INGESTION_OWNERSHIP_VIOLATION';
      error.issues = ownershipIssues;
      throw error;
    }
  }

  const relativeCardPath = target.existingCard
    ? path.relative(workspace.root, target.existingCard.filePath).split(path.sep).join('/')
    : resolveCardWritePath(null, built.card.data);
  const cardPath = target.existingCard?.filePath || path.join(workspace.root, relativeCardPath);
  built.card.filePath = cardPath;

  const nextCards = replaceCard(cards, target.existingCard, built.card);
  const validationIssues = await validateCardCollection(nextCards, taxonomy);
  if (validationIssues.length) {
    const error = new Error('Knowledge Card collection validation failed.');
    error.code = 'CARD_VALIDATION_FAILED';
    error.issues = validationIssues;
    throw error;
  }

  const statePath = path.join(workspace.paths.state, ...githubSourceStatePath(evidence.source_identity).split('/'));
  const stateRelative = path.relative(workspace.root, statePath).split(path.sep).join('/');
  const state = buildGitHubSourceState(evidence, { cardId: built.card.data.id, cardPath: relativeCardPath });
  validateGitHubSourceState(state);

  await fs.mkdir(path.dirname(cardPath), { recursive: true });
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const cardPrior = await readIfExists(cardPath);
  const statePrior = await readIfExists(statePath);
  const nonce = `${process.pid}-${Date.now()}`;
  const cardTmp = `${cardPath}.tmp-${nonce}`;
  const stateTmp = `${statePath}.tmp-${nonce}`;

  try {
    await fs.writeFile(cardTmp, built.raw, 'utf8');
    await fs.writeFile(stateTmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
    await fs.rename(cardTmp, cardPath);
    try {
      await fs.rename(stateTmp, statePath);
    } catch (error) {
      await rollbackFile(cardPath, cardPrior);
      throw error;
    }
  } finally {
    await fs.rm(cardTmp, { force: true }).catch(() => {});
    await fs.rm(stateTmp, { force: true }).catch(() => {});
  }

  return {
    mode: target.mode,
    source_identity: evidence.source_identity,
    evidence_digest: evidence.evidence_digest,
    card_id: built.card.data.id,
    card_path: relativeCardPath,
    source_state_path: stateRelative,
    substantive_change: built.substantiveChange,
    previous_state_digest: statePrior ? (() => {
      try { return JSON.parse(statePrior).evidence_digest || null; } catch { return null; }
    })() : null
  };
}
