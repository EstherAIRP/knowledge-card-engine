const DEFAULT_INITIAL_RESEARCH_MAX_ITEMS = 14;
const DEFAULT_INITIAL_RESEARCH_MAX_BYTES = 524288;

const INITIAL_KIND_ORDER = Object.freeze([
  'readme',
  'documentation',
  'manifest',
  'entrypoint',
  'source',
  'api',
  'data_model',
  'auth',
  'background_job',
  'security',
  'deployment',
  'license',
  'configuration',
  'test',
  'other'
]);

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function compareCandidate(a, b) {
  return a.priority - b.priority || a.path.localeCompare(b.path);
}

function candidateKey(candidate) {
  return `${candidate.kind}\u0000${candidate.path}`;
}

export function selectGitHubInitialResearchPaths(discovery, options = {}) {
  if (!discovery || typeof discovery !== 'object' || !Array.isArray(discovery.candidates)) {
    throw new TypeError('GitHub research discovery with candidates is required.');
  }
  const limits = discovery.discovery?.limits || {};
  const maxItems = Math.min(
    positiveInteger(options.max_items, DEFAULT_INITIAL_RESEARCH_MAX_ITEMS),
    positiveInteger(limits.max_selected_items, DEFAULT_INITIAL_RESEARCH_MAX_ITEMS)
  );
  const maxBytes = Math.min(
    positiveInteger(options.max_bytes, DEFAULT_INITIAL_RESEARCH_MAX_BYTES),
    positiveInteger(limits.max_total_bytes, DEFAULT_INITIAL_RESEARCH_MAX_BYTES)
  );

  const candidates = [...discovery.candidates]
    .filter((candidate) => (
      candidate
      && typeof candidate.path === 'string'
      && typeof candidate.kind === 'string'
      && Number.isInteger(candidate.priority)
      && Number.isInteger(candidate.bytes)
      && candidate.bytes >= 0
    ))
    .sort(compareCandidate);

  const selected = [];
  const selectedKeys = new Set();
  let totalBytes = 0;

  const trySelect = (candidate) => {
    if (selected.length >= maxItems) return false;
    const key = candidateKey(candidate);
    if (selectedKeys.has(key)) return false;
    if (totalBytes + candidate.bytes > maxBytes) return false;
    selected.push(candidate);
    selectedKeys.add(key);
    totalBytes += candidate.bytes;
    return true;
  };

  for (const kind of INITIAL_KIND_ORDER) {
    const candidate = candidates.find((item) => item.kind === kind && !selectedKeys.has(candidateKey(item)));
    if (candidate) trySelect(candidate);
    if (selected.length >= maxItems) break;
  }

  if (selected.length < maxItems) {
    for (const candidate of candidates) {
      trySelect(candidate);
      if (selected.length >= maxItems) break;
    }
  }

  return selected
    .sort(compareCandidate)
    .map((candidate) => candidate.path);
}
