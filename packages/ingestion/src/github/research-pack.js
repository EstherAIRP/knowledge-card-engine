const DEFAULT_INITIAL_RESEARCH_MAX_ITEMS = 14;
const DEFAULT_INITIAL_RESEARCH_MAX_BYTES = 524288;

const INITIAL_KIND_CAPS = Object.freeze({
  readme: 1,
  documentation: 4,
  manifest: 1,
  entrypoint: 3,
  source: 2,
  api: 2,
  data_model: 2,
  auth: 2,
  background_job: 2,
  security: 1,
  deployment: 1,
  license: 1,
  configuration: 2,
  test: 2,
  other: 1
});

const MECHANISM_KINDS = Object.freeze([
  'api',
  'data_model',
  'auth',
  'background_job',
  'source'
]);

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function preferenceAdjustment(candidate) {
  const lower = candidate.path.toLowerCase();
  const base = lower.split('/').at(-1) || '';

  if (candidate.kind === 'documentation') {
    if (/architecture|design|internals|overview/u.test(lower)) return -700;
    if (/introduction|concepts?|core[-_. ]?model/u.test(lower)) return -600;
    if (/methodology|workflow|data[-_. ]?flow|control[-_. ]?flow/u.test(lower)) return -550;
    if (/plugins?|extensions?|custom[-_. ]?commands?/u.test(lower)) return -525;
    if (/^docs?\/(?:index|readme)\.(?:md|mdx)$/u.test(lower)) return -500;
    if (/usage|guide|getting[-_. ]?started/u.test(lower)) return -350;
    if (/contributing|code[-_. ]?of[-_. ]?conduct|changelog|release[-_. ]?notes/u.test(lower)) return 700;
  }

  if (candidate.kind === 'deployment') {
    if (
      base === 'dockerfile'
      || base.startsWith('docker-compose')
      || /(?:^|\/)(?:deploy|deployment|k8s|kubernetes|helm|terraform)(?:\/|$)/u.test(lower)
    ) return -600;
    if (/(?:publish|release|deploy)/u.test(base)) return -350;
    if (/(?:test|mypy|ruff|lint|issue|dependabot)/u.test(base)) return 700;
  }

  if (candidate.kind === 'configuration') {
    if (/dependabot|readthedocs/u.test(lower)) return 500;
    if (/example|sample|default/u.test(lower)) return -150;
  }

  if (candidate.kind === 'source' || candidate.kind === 'test') {
    if (/^__init__\.[^/]+$/u.test(base) || /(?:^|[._-])index\.[^/]+$/u.test(base)) return 800;
    if (/base|types?|constants?/u.test(base)) return 150;
  }

  if (candidate.kind === 'auth') {
    if (/auth|oauth|permission|authorization/u.test(lower)) return -400;
    return 300;
  }

  if (candidate.kind === 'license') {
    if (/^docs?\//u.test(lower)) return -150;
  }

  return 0;
}

function candidateScore(candidate) {
  return candidate.priority * 1000 + preferenceAdjustment(candidate);
}

function compareCandidate(a, b) {
  return candidateScore(a) - candidateScore(b) || a.path.localeCompare(b.path);
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
  const kindCounts = new Map();
  let totalBytes = 0;

  const trySelect = (candidate) => {
    if (!candidate || selected.length >= maxItems) return false;
    const key = candidateKey(candidate);
    if (selectedKeys.has(key)) return false;
    if (totalBytes + candidate.bytes > maxBytes) return false;
    const cap = INITIAL_KIND_CAPS[candidate.kind] ?? 1;
    if ((kindCounts.get(candidate.kind) || 0) >= cap) return false;
    selected.push(candidate);
    selectedKeys.add(key);
    kindCounts.set(candidate.kind, (kindCounts.get(candidate.kind) || 0) + 1);
    totalBytes += candidate.bytes;
    return true;
  };

  const selectKind = (kind, count) => {
    for (const candidate of candidates) {
      if (candidate.kind !== kind) continue;
      trySelect(candidate);
      if ((kindCounts.get(kind) || 0) >= count || selected.length >= maxItems) break;
    }
  };

  selectKind('readme', 1);
  selectKind('documentation', 3);
  selectKind('manifest', 1);
  selectKind('entrypoint', 2);
  selectKind('security', 1);
  selectKind('license', 1);

  const mechanismRepresentatives = MECHANISM_KINDS
    .map((kind) => candidates.find((candidate) => candidate.kind === kind))
    .filter(Boolean)
    .sort(compareCandidate);
  for (const candidate of mechanismRepresentatives.slice(0, 4)) {
    trySelect(candidate);
  }

  selectKind('deployment', 1);

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
