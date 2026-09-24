import { canonicalizeSource, resolveIngestionTarget } from './index.js';

export function resolveIngestionPreflightTarget(cards, rawUrl) {
  const canonical = canonicalizeSource(rawUrl);

  if (!['github', 'threads'].includes(canonical.provider)) {
    const error = new Error(`Unsupported ingestion provider for preflight: ${canonical.provider}.`);
    error.code = 'SOURCE_PROVIDER_UNSUPPORTED';
    throw error;
  }

  if (!canonical.identity) {
    return {
      provider: canonical.provider,
      resolved: false,
      mode: 'unresolved',
      source_identity: null,
      canonical_url: canonical.canonicalUrl,
      card_id: null,
      card_path: null
    };
  }

  const source = {
    source_identity: canonical.identity,
    canonical_url: canonical.canonicalUrl,
    suggested_id: canonical.suggestedId
  };
  const target = resolveIngestionTarget(cards, source);

  return {
    provider: canonical.provider,
    resolved: true,
    mode: target.mode,
    source_identity: canonical.identity,
    canonical_url: canonical.canonicalUrl,
    card_id: target.id,
    card_path: target.existingCard?.filePath || null
  };
}
