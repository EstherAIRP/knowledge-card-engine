import {
  effectiveOwnershipValue,
  effectiveRelevance,
  parseCardDocument,
  parseTaxonomyDocument,
  validateCardCollection
} from '../../../packages/core/src/index.js';
import { createInstallationTokenProvider, githubInstallationJson } from './github.js';
import { HttpError } from './http.js';

const CARD_PATH = /^content\/knowledge\/(\d{4})\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
const CARD_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TAXONOMY_PATH = 'config/taxonomy.yaml';
const MAX_CARD_BYTES = 1024 * 1024;
const MAX_TAXONOMY_BYTES = 512 * 1024;

function encodeCursor(revision, offset) {
  return Buffer.from(JSON.stringify({ revision, offset }), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !parsed
      || typeof parsed.revision !== 'string'
      || !/^[0-9a-f]{40}$/u.test(parsed.revision)
      || !Number.isInteger(parsed.offset)
      || parsed.offset < 0
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeLimit(value) {
  if (value == null || value === '') return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, 'PAGINATION_INVALID', 'limit must be an integer between 1 and 100.');
  }
  return parsed;
}

function blobText(payload, maxBytes, label) {
  if (
    !payload
    || payload.encoding !== 'base64'
    || typeof payload.content !== 'string'
    || !Number.isInteger(payload.size)
    || payload.size < 0
  ) {
    throw new HttpError(503, 'WORKSPACE_DATA_INVALID', `${label} blob response is invalid.`);
  }
  if (payload.size > maxBytes) {
    throw new HttpError(503, 'WORKSPACE_DATA_TOO_LARGE', `${label} exceeds the private reader size limit.`);
  }
  const text = Buffer.from(payload.content.replace(/\s+/gu, ''), 'base64').toString('utf8');
  if (Buffer.byteLength(text, 'utf8') !== payload.size) {
    throw new HttpError(503, 'WORKSPACE_DATA_INVALID', `${label} blob size does not match decoded content.`);
  }
  return text;
}

function cardSummary(card) {
  return {
    id: card.data.id,
    title: card.data.title,
    summary: card.data.summary,
    canonical_url: card.data.canonical_url,
    resource_kind: effectiveOwnershipValue(card.data.resource_kind),
    navigation_categories: effectiveOwnershipValue(card.data.navigation?.categories) || [],
    status: effectiveOwnershipValue(card.data.status),
    updated_at: card.data.updated_at,
    last_checked_at: card.data.last_checked_at
  };
}

function cardDetail(card, revision) {
  return {
    revision,
    id: card.data.id,
    title: card.data.title,
    summary: card.data.summary,
    canonical_url: card.data.canonical_url,
    source: {
      type: card.data.source.type,
      url: card.data.source.url,
      identity: card.data.source.identity
    },
    resource_kind: effectiveOwnershipValue(card.data.resource_kind),
    navigation_categories: effectiveOwnershipValue(card.data.navigation?.categories) || [],
    classification_categories: effectiveOwnershipValue(card.data.classification?.categories) || [],
    tags: effectiveOwnershipValue(card.data.classification?.tags) || [],
    relevance: effectiveRelevance(card.data.relevance),
    actions: effectiveOwnershipValue(card.data.actions) || [],
    status: effectiveOwnershipValue(card.data.status),
    created_at: card.data.created_at,
    updated_at: card.data.updated_at,
    last_checked_at: card.data.last_checked_at,
    body: card.body
  };
}

export function createWorkspaceRepositoryReader({ config, fetchImpl = fetch, now = () => Date.now() }) {
  const installationToken = createInstallationTokenProvider({ config, fetchImpl, now });
  const snapshots = new Map();

  async function api(path, query = '') {
    return githubInstallationJson({
      config,
      installationToken,
      fetchImpl,
      path,
      query
    });
  }

  async function resolveRevision() {
    const commit = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/commits/${encodeURIComponent(config.workspaceRef)}`
    );
    const revision = typeof commit.sha === 'string' ? commit.sha.toLowerCase() : '';
    const treeSha = typeof commit.commit?.tree?.sha === 'string' ? commit.commit.tree.sha.toLowerCase() : '';
    if (!/^[0-9a-f]{40}$/u.test(revision) || !/^[0-9a-f]{40}$/u.test(treeSha)) {
      throw new HttpError(503, 'WORKSPACE_REVISION_INVALID', 'Workspace repository revision could not be resolved.');
    }
    return { revision, treeSha };
  }

  async function loadSnapshot() {
    const { revision, treeSha } = await resolveRevision();
    if (snapshots.has(revision)) return snapshots.get(revision);

    const tree = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/git/trees/${treeSha}`,
      '?recursive=1'
    );
    if (tree.truncated === true) {
      throw new HttpError(503, 'WORKSPACE_TREE_TRUNCATED', 'Workspace repository tree is truncated; private content will not be served.');
    }
    if (!Array.isArray(tree.tree)) {
      throw new HttpError(503, 'WORKSPACE_DATA_INVALID', 'Workspace repository tree response is invalid.');
    }

    const taxonomyEntry = tree.tree.find((entry) => entry?.type === 'blob' && entry.path === TAXONOMY_PATH);
    if (!taxonomyEntry || typeof taxonomyEntry.sha !== 'string') {
      throw new HttpError(503, 'WORKSPACE_TAXONOMY_MISSING', 'Workspace taxonomy is missing.');
    }

    const cardEntries = tree.tree
      .filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string' && CARD_PATH.test(entry.path))
      .sort((a, b) => a.path.localeCompare(b.path));

    const taxonomyPayload = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/git/blobs/${encodeURIComponent(taxonomyEntry.sha)}`
    );
    const taxonomyText = blobText(taxonomyPayload, MAX_TAXONOMY_BYTES, 'Workspace taxonomy');
    let taxonomy;
    try {
      taxonomy = parseTaxonomyDocument(taxonomyText, TAXONOMY_PATH);
    } catch {
      throw new HttpError(503, 'WORKSPACE_TAXONOMY_INVALID', 'Workspace taxonomy cannot be parsed.');
    }

    const cards = [];
    for (const entry of cardEntries) {
      const payload = await api(
        `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/git/blobs/${encodeURIComponent(entry.sha)}`
      );
      const text = blobText(payload, MAX_CARD_BYTES, `Knowledge Card ${entry.path}`);
      try {
        cards.push(parseCardDocument(text, entry.path));
      } catch {
        throw new HttpError(503, 'WORKSPACE_CARD_INVALID', 'Workspace contains an unreadable Knowledge Card.');
      }
    }

    const issues = await validateCardCollection(cards, taxonomy);
    if (issues.length) {
      throw new HttpError(503, 'WORKSPACE_CARD_INVALID', 'Workspace Knowledge Card collection validation failed.');
    }

    const byId = new Map(cards.map((card) => [card.data.id, card]));
    const ordered = [...cards].sort((a, b) => {
      const date = String(b.data.updated_at).localeCompare(String(a.data.updated_at));
      if (date !== 0) return date;
      return String(a.data.title).localeCompare(String(b.data.title));
    });

    const snapshot = Object.freeze({ revision, cards: ordered, byId });
    snapshots.set(revision, snapshot);
    while (snapshots.size > 3) snapshots.delete(snapshots.keys().next().value);
    return snapshot;
  }

  return {
    async listCards({ limit, cursor } = {}) {
      const snapshot = await loadSnapshot();
      const size = safeLimit(limit);
      const decoded = decodeCursor(cursor);
      if (cursor && !decoded) {
        throw new HttpError(400, 'PAGINATION_INVALID', 'cursor is invalid.');
      }
      if (decoded && decoded.revision !== snapshot.revision) {
        throw new HttpError(409, 'DATA_VERSION_CHANGED', 'Workspace revision changed; restart pagination from the first page.');
      }
      const offset = decoded?.offset || 0;
      if (offset > snapshot.cards.length) {
        throw new HttpError(400, 'PAGINATION_INVALID', 'cursor offset is outside the current collection.');
      }

      const page = snapshot.cards.slice(offset, offset + size);
      const nextOffset = offset + page.length;
      return {
        revision: snapshot.revision,
        items: page.map(cardSummary),
        next_cursor: nextOffset < snapshot.cards.length ? encodeCursor(snapshot.revision, nextOffset) : null
      };
    },

    async getCard(id) {
      if (!CARD_ID.test(String(id || ''))) {
        throw new HttpError(400, 'CARD_ID_INVALID', 'Card id is invalid.');
      }
      const snapshot = await loadSnapshot();
      const card = snapshot.byId.get(id);
      if (!card) throw new HttpError(404, 'CARD_NOT_FOUND', 'Knowledge Card not found.');
      return cardDetail(card, snapshot.revision);
    }
  };
}
