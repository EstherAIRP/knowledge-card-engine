import { createHash } from 'node:crypto';
import {
  effectiveOwnershipValue,
  effectiveRelevance,
  parseCardDocument,
  parseTaxonomyDocument,
  validateCardCollection
} from '../../../packages/core/src/index.js';
import {
  cosineSimilarity,
  searchGeneratedIndex,
  validateGeneratedArtifacts
} from '../../../packages/graph/src/index.js';
import {
  GENERATED_ARTIFACT_PATHS,
  RELEASE_POINTER_PATH,
  releasePublicProjection,
  validatePublishedCommit,
  validateReleaseBundle,
  validateReleaseDescription,
  validateReleasePointer
} from '../../../packages/release/src/index.js';
import { createInstallationTokenProvider, githubInstallationJson } from './github.js';
import { HttpError } from './http.js';

const CARD_PATH = /^content\/knowledge\/(\d{4})\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
const CARD_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TAXONOMY_PATH = 'config/taxonomy.yaml';
const MAX_CARD_BYTES = 1024 * 1024;
const MAX_TAXONOMY_BYTES = 512 * 1024;
const MAX_RELEASE_BYTES = 512 * 1024;
const MAX_INDEX_BYTES = 8 * 1024 * 1024;

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

function safeLimit(value, fallback = 50) {
  if (value == null || value === '') return fallback;
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

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(503, 'WORKSPACE_DATA_INVALID', label + ' is invalid JSON.');
  }
}

function cardSummary(card) {
  return {
    id: card.data.id,
    title: card.data.title,
    summary: card.data.summary,
    canonical_url: card.data.canonical_url,
    source_type: card.data.source.type,
    resource_kind: effectiveOwnershipValue(card.data.resource_kind),
    navigation_categories: effectiveOwnershipValue(card.data.navigation?.categories) || [],
    tags: effectiveOwnershipValue(card.data.classification?.tags) || [],
    relevance: effectiveRelevance(card.data.relevance),
    actions: effectiveOwnershipValue(card.data.actions) || [],
    status: effectiveOwnershipValue(card.data.status),
    created_at: card.data.created_at,
    updated_at: card.data.updated_at,
    last_checked_at: card.data.last_checked_at
  };
}

function relationProjection(cardId, snapshot) {
  if (!snapshot.artifacts) return [];
  const byId = snapshot.byId;
  return (snapshot.artifacts.relations?.edges || [])
    .filter((edge) => edge.source === cardId || edge.target === cardId)
    .map((edge) => {
      const otherId = edge.source === cardId ? edge.target : edge.source;
      const other = byId.get(otherId);
      return {
        other_id: otherId,
        other_title: other?.data?.title || otherId,
        type: edge.type,
        direction: edge.direction,
        score: edge.score,
        method: edge.method,
        source: edge.source,
        target: edge.target
      };
    });
}

function conceptProjection(cardId, snapshot) {
  if (!snapshot.artifacts) return [];
  const concepts = new Map((snapshot.artifacts.concepts?.concepts || []).map((concept) => [concept.id, concept]));
  return (snapshot.artifacts.concepts?.card_concepts || [])
    .filter((edge) => edge.card_id === cardId)
    .map((edge) => ({
      ...concepts.get(edge.concept_id),
      strength: edge.strength,
      origin: edge.origin,
      evidence: edge.evidence
    }))
    .filter((value) => value.id);
}

function cardDetail(card, snapshot) {
  return {
    release_id: snapshot.release?.release_id || null,
    revision: snapshot.revision,
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
    relations: relationProjection(card.data.id, snapshot),
    concepts: conceptProjection(card.data.id, snapshot),
    body: card.body
  };
}


function relationPairKey(left, right) {
  return [left, right].sort((a, b) => a.localeCompare(b)).join('::');
}

function roundedMetric(value) {
  return Number(Number(value).toFixed(6));
}

function legacyGraphProjection(snapshot) {
  const graph = snapshot.artifacts?.graph;
  const concepts = snapshot.artifacts?.concepts;
  const relations = snapshot.artifacts?.relations;
  const vectors = snapshot.artifacts?.vectors;
  if (!graph || !concepts || !relations || !vectors) {
    throw new HttpError(503, 'RELEASE_REQUIRED', 'Graph requires one validated generated release.');
  }

  const generatedNodeById = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const conceptById = new Map((concepts.concepts || []).map((concept) => [concept.id, concept]));
  const cardConceptDegree = new Map();
  for (const edge of concepts.card_concepts || []) {
    cardConceptDegree.set(edge.card_id, (cardConceptDegree.get(edge.card_id) || 0) + 1);
  }

  const nodes = [
    ...snapshot.cards.map((card) => {
      const position = generatedNodeById.get('card:' + card.data.id) || {};
      return {
        id: 'card:' + card.data.id,
        entityId: card.data.id,
        kind: 'card',
        label: card.data.title,
        description: card.data.summary,
        route: '/knowledge/' + card.data.id,
        degree: cardConceptDegree.get(card.data.id) || 0,
        categories: effectiveOwnershipValue(card.data.navigation?.categories) || [],
        semanticCategories: effectiveOwnershipValue(card.data.classification?.categories) || [],
        tags: effectiveOwnershipValue(card.data.classification?.tags) || [],
        actions: effectiveOwnershipValue(card.data.actions) || [],
        sourceType: card.data.source?.type || null,
        resourceKind: effectiveOwnershipValue(card.data.resource_kind),
        relevance: effectiveRelevance(card.data.relevance),
        status: effectiveOwnershipValue(card.data.status),
        x: Number(position.x),
        y: Number(position.y)
      };
    }),
    ...(concepts.concepts || []).map((concept) => {
      const position = generatedNodeById.get('concept:' + concept.id) || {};
      return {
        id: 'concept:' + concept.id,
        entityId: concept.id,
        kind: 'concept',
        conceptType: concept.type,
        label: concept.label,
        description: concept.description,
        route: '/concepts/' + concept.id,
        degree: concept.card_count,
        x: Number(position.x),
        y: Number(position.y)
      };
    })
  ];

  const edges = (graph.edges || []).map((edge) => ({
    ...edge,
    type: edge.relation_type || edge.type || null
  }));

  const relationByPair = new Map(
    (relations.edges || []).map((edge) => [relationPairKey(edge.source, edge.target), edge])
  );
  const vectorById = new Map(
    (vectors.entries || []).map((entry) => [entry.card_id, entry.vector])
  );
  const neighborsByCard = {};
  const distancesByCard = {};
  const neighborLimit = 12;

  for (const card of snapshot.cards) {
    const cardId = card.data.id;
    const sourceVector = vectorById.get(cardId);
    const neighbors = [];
    if (Array.isArray(sourceVector)) {
      for (const targetCard of snapshot.cards) {
        const targetId = targetCard.data.id;
        if (targetId === cardId) continue;
        const targetVector = vectorById.get(targetId);
        if (!Array.isArray(targetVector)) continue;
        const similarity = roundedMetric(cosineSimilarity(sourceVector, targetVector));
        const distance = roundedMetric(Math.max(0, Math.min(2, 1 - similarity)));
        const relation = relationByPair.get(relationPairKey(cardId, targetId));
        neighbors.push({
          cardId: targetId,
          nodeId: 'card:' + targetId,
          label: targetCard.data.title,
          route: '/knowledge/' + targetId,
          similarity,
          distance,
          relation: relation ? {
            type: relation.type,
            direction: relation.direction || 'undirected',
            source: relation.source,
            target: relation.target,
            score: Number.isFinite(Number(relation.score)) ? Number(relation.score) : null,
            confidence: Number.isFinite(Number(relation.confidence)) ? Number(relation.confidence) : null
          } : null
        });
      }
    }
    neighbors.sort((left, right) =>
      right.similarity - left.similarity || left.cardId.localeCompare(right.cardId)
    );
    neighborsByCard[cardId] = neighbors.slice(0, neighborLimit);
    distancesByCard[cardId] = neighbors.map(({ cardId: targetId, similarity, distance }) => ({
      cardId: targetId,
      similarity,
      distance
    }));
  }

  return {
    layout_method: graph.layout_method,
    semantic_neighbors: graph.semantic_neighbors,
    generatedAt: graph.generated_at || concepts.generated_at || null,
    semantic: {
      metric: 'cosine-distance',
      embeddingProvider: null,
      embeddingModel: vectors.method || null,
      neighborLimit,
      neighborsByCard,
      distancesByCard
    },
    layout: {
      generatedAt: graph.generated_at || null,
      method: graph.layout_method || null,
      metric: 'cosine-distance',
      stress: null,
      embeddingModel: vectors.method || null,
      embeddingInputHash: vectors.input_hash || null
    },
    stats: {
      cards: snapshot.cards.length,
      concepts: (concepts.concepts || []).length,
      cardConceptEdges: (concepts.card_concepts || []).length,
      conceptRelations: (concepts.concept_relations || []).length,
      cardRelations: (relations.edges || []).length
    },
    nodes,
    edges
  };
}

function treeMap(tree) {
  return new Map(
    tree.tree
      .filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string' && typeof entry.sha === 'string')
      .map((entry) => [entry.path, entry])
  );
}

function artifactObject(texts) {
  return {
    search: parseJson(texts['data/search.json'], 'Search index'),
    vectors: parseJson(texts['data/vectors.json'], 'Vector index'),
    relations: parseJson(texts['data/relations.json'], 'Relation index'),
    concepts: parseJson(texts['data/concepts.json'], 'Concept index'),
    graph: parseJson(texts['data/graph.json'], 'Graph projection')
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

  async function resolveCommit(ref) {
    const commit = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/commits/${encodeURIComponent(ref)}`
    );
    const revision = typeof commit.sha === 'string' ? commit.sha.toLowerCase() : '';
    const treeSha = typeof commit.commit?.tree?.sha === 'string' ? commit.commit.tree.sha.toLowerCase() : '';
    if (!/^[0-9a-f]{40}$/u.test(revision) || !/^[0-9a-f]{40}$/u.test(treeSha)) {
      throw new HttpError(503, 'WORKSPACE_REVISION_INVALID', 'Workspace repository revision could not be resolved.');
    }
    return {
      revision,
      treeSha,
      parents: Array.isArray(commit.parents)
        ? commit.parents.map((parent) => String(parent?.sha || '').toLowerCase()).filter((sha) => /^[0-9a-f]{40}$/u.test(sha))
        : []
    };
  }

  async function loadTree(treeSha) {
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
    return tree;
  }

  async function readEntry(entry, maxBytes, label) {
    if (!entry || typeof entry.sha !== 'string') {
      throw new HttpError(503, 'WORKSPACE_DATA_INVALID', label + ' is missing.');
    }
    const payload = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/git/blobs/${encodeURIComponent(entry.sha)}`
    );
    return blobText(payload, maxBytes, label);
  }

  async function loadCardsAtTree(tree, revision) {
    const entries = treeMap(tree);
    const taxonomyEntry = entries.get(TAXONOMY_PATH);
    if (!taxonomyEntry) {
      throw new HttpError(503, 'WORKSPACE_TAXONOMY_MISSING', 'Workspace taxonomy is missing.');
    }
    const taxonomyText = await readEntry(taxonomyEntry, MAX_TAXONOMY_BYTES, 'Workspace taxonomy');
    let taxonomy;
    try {
      taxonomy = parseTaxonomyDocument(taxonomyText, TAXONOMY_PATH);
    } catch {
      throw new HttpError(503, 'WORKSPACE_TAXONOMY_INVALID', 'Workspace taxonomy cannot be parsed.');
    }

    const cardEntries = [...entries.values()]
      .filter((entry) => CARD_PATH.test(entry.path))
      .sort((a, b) => a.path.localeCompare(b.path));

    const cards = [];
    for (const entry of cardEntries) {
      const text = await readEntry(entry, MAX_CARD_BYTES, `Knowledge Card ${entry.path}`);
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
    return { revision, cards: ordered, byId, entries };
  }

  async function verifyPublishedLineage(release, publishedCommit) {
    if (release.published_sha === release.source_sha) {
      validatePublishedCommit({
        sourceSha: release.source_sha,
        publishedSha: release.published_sha,
        changedPaths: []
      });
      return;
    }
    const parentSha = publishedCommit.parents?.[0] || null;
    const comparison = await api(
      `/repos/${encodeURIComponent(config.workspaceOwner)}/${encodeURIComponent(config.workspaceRepo)}/compare/${release.source_sha}...${release.published_sha}`
    );
    const changedPaths = Array.isArray(comparison.files)
      ? comparison.files.map((file) => file?.filename).filter((value) => typeof value === 'string')
      : [];
    try {
      validatePublishedCommit({
        sourceSha: release.source_sha,
        publishedSha: release.published_sha,
        parentSha,
        changedPaths
      });
    } catch {
      throw new HttpError(503, 'RELEASE_LINEAGE_INVALID', 'Published release commit is not a direct generated-only child of its source.');
    }
  }

  async function loadReleaseSnapshot(refRevision, refTree) {
    const refEntries = treeMap(refTree);
    const pointerEntry = refEntries.get(RELEASE_POINTER_PATH);
    const hasGeneratedData = GENERATED_ARTIFACT_PATHS.some((artifactPath) => refEntries.has(artifactPath));

    if (!pointerEntry) {
      if (hasGeneratedData) {
        throw new HttpError(503, 'RELEASE_POINTER_MISSING', 'Generated data exists without a current release pointer.');
      }
      return null;
    }

    const pointerText = await readEntry(pointerEntry, MAX_RELEASE_BYTES, 'Current release pointer');
    const pointer = parseJson(pointerText, 'Current release pointer');
    try {
      validateReleasePointer(pointer);
    } catch {
      throw new HttpError(503, 'RELEASE_POINTER_INVALID', 'Current release pointer is invalid.');
    }

    const releaseEntry = refEntries.get(pointer.release_path);
    if (!releaseEntry) {
      throw new HttpError(503, 'RELEASE_DESCRIPTION_MISSING', 'Current release description is missing.');
    }
    const releaseText = await readEntry(releaseEntry, MAX_RELEASE_BYTES, 'Release description');
    const release = parseJson(releaseText, 'Release description');
    try {
      validateReleaseDescription(release);
    } catch {
      throw new HttpError(503, 'RELEASE_DESCRIPTION_INVALID', 'Current release description is invalid.');
    }
    if (release.release_id !== pointer.release_id) {
      throw new HttpError(503, 'RELEASE_POINTER_INVALID', 'Current release pointer does not match its release description.');
    }

    const cacheKey = release.release_id + ':' + release.published_sha;
    if (snapshots.has(cacheKey)) return snapshots.get(cacheKey);

    const publishedCommit = await resolveCommit(release.published_sha);
    if (publishedCommit.revision !== release.published_sha) {
      throw new HttpError(503, 'RELEASE_REVISION_INVALID', 'Published release revision could not be resolved exactly.');
    }
    await verifyPublishedLineage(release, publishedCommit);
    const publishedTree = await loadTree(publishedCommit.treeSha);
    const base = await loadCardsAtTree(publishedTree, release.published_sha);

    const artifactTexts = {};
    for (const artifactPath of GENERATED_ARTIFACT_PATHS) {
      const entry = base.entries.get(artifactPath);
      artifactTexts[artifactPath] = await readEntry(entry, MAX_INDEX_BYTES, 'Generated artifact ' + artifactPath);
    }

    try {
      validateReleaseBundle({ pointer, release, artifactTexts });
    } catch {
      throw new HttpError(503, 'RELEASE_MANIFEST_INVALID', 'Current release manifest does not match generated artifacts.');
    }
    const artifacts = artifactObject(artifactTexts);
    const generatedIssues = validateGeneratedArtifacts(artifacts, base.cards);
    if (generatedIssues.length) {
      throw new HttpError(503, 'RELEASE_GENERATED_DATA_INVALID', 'Current release generated data validation failed.');
    }

    const snapshot = Object.freeze({
      ...base,
      mode: 'release',
      release,
      pointer_revision: refRevision,
      artifacts
    });
    snapshots.set(cacheKey, snapshot);
    while (snapshots.size > 3) snapshots.delete(snapshots.keys().next().value);
    return snapshot;
  }

  async function loadSnapshot() {
    const configuredCommit = await resolveCommit(config.workspaceRef);
    const refTree = await loadTree(configuredCommit.treeSha);
    const released = await loadReleaseSnapshot(configuredCommit.revision, refTree);
    if (released) return released;

    const cacheKey = 'bootstrap:' + configuredCommit.revision;
    if (snapshots.has(cacheKey)) return snapshots.get(cacheKey);
    const base = await loadCardsAtTree(refTree, configuredCommit.revision);
    const snapshot = Object.freeze({
      ...base,
      mode: 'bootstrap',
      release: null,
      pointer_revision: configuredCommit.revision,
      artifacts: null
    });
    snapshots.set(cacheKey, snapshot);
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
        throw new HttpError(409, 'DATA_VERSION_CHANGED', 'Published revision changed; restart pagination from the first page.');
      }
      const offset = decoded?.offset || 0;
      if (offset > snapshot.cards.length) {
        throw new HttpError(400, 'PAGINATION_INVALID', 'cursor offset is outside the current collection.');
      }

      const page = snapshot.cards.slice(offset, offset + size);
      const nextOffset = offset + page.length;
      return {
        release_id: snapshot.release?.release_id || null,
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
      return cardDetail(card, snapshot);
    },

    async search({ query, limit } = {}) {
      const q = String(query || '').trim();
      if (!q) throw new HttpError(400, 'SEARCH_QUERY_REQUIRED', 'q is required.');
      if (q.length > 300) throw new HttpError(400, 'SEARCH_QUERY_INVALID', 'q must be at most 300 characters.');
      const snapshot = await loadSnapshot();
      if (!snapshot.release || !snapshot.artifacts?.search) {
        throw new HttpError(503, 'RELEASE_REQUIRED', 'Search is unavailable before the first validated release.');
      }
      const size = safeLimit(limit, 20);
      let results;
      try {
        results = searchGeneratedIndex(snapshot.artifacts.search, q, { limit: size });
      } catch {
        throw new HttpError(400, 'SEARCH_QUERY_INVALID', 'Search request is invalid.');
      }
      return {
        release_id: snapshot.release.release_id,
        revision: snapshot.revision,
        query: q,
        items: results
      };
    },

    async graph() {
      const snapshot = await loadSnapshot();
      if (!snapshot.release || !snapshot.artifacts?.graph) {
        throw new HttpError(503, 'RELEASE_REQUIRED', 'Graph is unavailable before the first validated release.');
      }
      return {
        release_id: snapshot.release.release_id,
        revision: snapshot.revision,
        ...legacyGraphProjection(snapshot)
      };
    },

    async release() {
      const snapshot = await loadSnapshot();
      if (!snapshot.release) {
        return {
          release_id: null,
          revision: snapshot.revision,
          mode: 'bootstrap'
        };
      }
      return {
        ...releasePublicProjection(snapshot.release),
        revision: snapshot.revision,
        pointer_revision: snapshot.pointer_revision,
        mode: 'release'
      };
    }
  };
}
