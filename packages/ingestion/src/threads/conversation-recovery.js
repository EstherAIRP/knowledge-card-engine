import {
  assembleThreadsConversation,
  extractResolvedThreadsConversation
} from './conversation.js';
import { normalizeThreadsPost } from './normalize.js';
import { recoverThreadsContinuation } from './continuation-recovery.js';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function extractAdapterPosts(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  for (const value of [result.posts, result.data, result.replies, result.conversation]) {
    if (Array.isArray(value)) return value;
  }
  return result.post && typeof result.post === 'object' ? [result.post] : [];
}

function normalizedPost(raw, method) {
  if (raw?.provider === 'threads' && raw?.shortcode && raw?.extraction) return raw;
  try {
    return normalizeThreadsPost(raw, { method, confidence: 'high' });
  } catch {
    return null;
  }
}

function dedupePosts(posts) {
  const byKey = new Map();
  for (const post of posts || []) {
    if (!post) continue;
    const key = post.id ? `id:${post.id}` : post.shortcode ? `shortcode:${post.shortcode}` : null;
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || (!existing.text && post.text)) byKey.set(key, post);
  }
  return [...byKey.values()];
}

function rootPostFromSource(source) {
  if (!source?.shortcode && !source?.id) return null;
  return {
    provider: 'threads',
    canonical_url: source.canonical_url || null,
    id: source.id || source.root_post_id || null,
    shortcode: source.shortcode || source.root_shortcode || null,
    username: source.username || source.author || null,
    text: source.text || null,
    timestamp: source.timestamp || null,
    media: source.media || [],
    is_reply: source.is_reply ?? false,
    reply_to: source.reply_to || null,
    root_post: source.root_post || null,
    has_replies: source.has_replies ?? null,
    quoted_post: source.quoted_post || null,
    reposted_post: source.reposted_post || null,
    link_attachment_url: source.link_attachment_url || null,
    alt_text: source.alt_text || null,
    extraction: source.extraction || {
      method: 'source_document',
      confidence: 'high',
      single_post_complete: true,
      conversation_complete: false
    }
  };
}

export function isThreadsSinglePostCoverageUnverified(source) {
  return Boolean(
    source?.thread?.status === 'SINGLE_POST'
    && source?.thread?.complete === true
    && source?.has_replies === true
    && source?.extraction?.conversation_coverage_complete !== true
  );
}

function eligibleForInference(source) {
  if (isThreadsSinglePostCoverageUnverified(source)) return true;
  return Boolean(
    source?.thread?.status === 'INCOMPLETE_THREAD'
    && source?.thread?.indicator == null
    && ['conversation_coverage_unverified', 'input_not_in_author_chain'].includes(source?.thread?.reason)
  );
}

function incompleteSource(source, reason, recovery = null) {
  return {
    ...source,
    thread: {
      ...(source?.thread || {}),
      status: 'INCOMPLETE_THREAD',
      total: null,
      complete: false,
      confidence: 'low',
      reason,
      verification: 'unverified',
      recovery: recovery ? {
        accepted: false,
        reason: recovery.reason || null,
        candidates_considered: recovery.candidates?.length || 0
      } : null
    },
    extraction: {
      ...(source?.extraction || {}),
      conversation_complete: false,
      inferred: false
    }
  };
}

function inferredSource(source, rootPost, recovery) {
  const rootOnly = recovery.root_only === true;
  const selectedPosts = rootOnly ? [] : recovery.selected.map((candidate) => candidate.post);
  const parts = [rootPost, ...selectedPosts].map((post, index) => ({ index: index + 1, ...post }));
  const rootShortcode = rootPost.shortcode || source.root_shortcode || null;
  const selectedShortcodes = selectedPosts.map((post) => post.shortcode).filter(Boolean);

  return {
    ...source,
    canonical_url: rootPost.canonical_url || source.canonical_url,
    source_identity: rootShortcode ? `threads:${rootShortcode}` : source.source_identity,
    id: rootPost.id || source.id || null,
    shortcode: rootPost.shortcode || source.shortcode || null,
    username: rootPost.username || source.username || null,
    text: rootPost.text || source.text || null,
    timestamp: rootPost.timestamp || source.timestamp || null,
    media: rootPost.media || source.media || [],
    root_post_id: rootPost.id || source.root_post_id || null,
    root_shortcode: rootShortcode,
    author: rootPost.username || source.author || null,
    input_post: {
      ...(source.input_post || {}),
      index: 1
    },
    thread: {
      status: rootOnly ? 'INFERRED_SINGLE_POST_HIGH_CONFIDENCE' : 'INFERRED_THREAD_HIGH_CONFIDENCE',
      total: parts.length,
      detected_parts: parts.length,
      input_index: 1,
      complete: true,
      confidence: 'high',
      indicator: null,
      reason: null,
      verification: 'llm_assisted',
      recovery: {
        confidence: recovery.confidence,
        rationale: recovery.rationale || null,
        candidates_considered: recovery.candidates?.length || 0,
        selected_shortcodes: selectedShortcodes,
        root_only: rootOnly,
        candidate_labels: recovery.candidate_labels || [],
        ranker: recovery.ranker || null
      }
    },
    parts,
    combined_text: parts.map((part) => part.text).filter(Boolean).join('\n\n'),
    extraction: {
      ...(source.extraction || {}),
      method: rootOnly ? 'llm_assisted_root_only' : 'llm_assisted_continuation',
      conversation_complete: true,
      conversation_coverage_complete: false,
      inferred: true
    }
  };
}

function strictAssemblyFromAdapter(source, browserResult, method) {
  const rootPost = rootPostFromSource(source);
  if (!rootPost || rootPost.is_reply === true) return null;
  const posts = dedupePosts([
    rootPost,
    ...extractAdapterPosts(browserResult).map((raw) => normalizedPost(raw, method)).filter(Boolean)
  ]);
  const records = posts.map((post) => ({ post, hint: null, raw: post }));
  return assembleThreadsConversation({
    targetPost: rootPost,
    records,
    adapterIndicator: firstDefined(browserResult?.thread_indicator, browserResult?.indicator, browserResult?.ui_indicator),
    coverageComplete: Boolean(firstDefined(browserResult?.complete, browserResult?.conversation_complete, false)),
    extractionMethod: method
  });
}

async function runConversationAdapter(adapter, source) {
  if (typeof adapter !== 'function') return null;
  const input = source?.input_post || {};
  return adapter({
    provider: 'threads',
    canonical_url: input.canonical_url || source.canonical_url,
    id: input.id || source.id,
    shortcode: input.shortcode || source.shortcode,
    root_post: source.root_post || null,
    reply_to: source.reply_to || null,
    partial: source
  });
}

function throwIncomplete(source, cause = null) {
  const error = new Error(`Threads conversation is not complete: ${source?.thread?.status || 'INCOMPLETE_THREAD'}${source?.thread?.reason ? ` (${source.thread.reason})` : ''}.`);
  error.code = source?.thread?.status === 'AMBIGUOUS_THREAD'
    ? 'THREADS_CONVERSATION_AMBIGUOUS'
    : 'THREADS_CONVERSATION_INCOMPLETE';
  error.partial = source;
  error.cause = cause;
  throw error;
}

export async function extractResolvedThreadsConversationWithRecovery(canonicalUrl, options = {}) {
  const requireComplete = options.requireComplete ?? true;
  let source = await extractResolvedThreadsConversation(canonicalUrl, {
    ...options,
    requireComplete: false
  });

  if (source.thread?.complete && !isThreadsSinglePostCoverageUnverified(source)) return source;
  if (!eligibleForInference(source)) {
    if (requireComplete && !source.thread?.complete) throwIncomplete(source);
    return source;
  }

  let adapterResult = null;
  let adapterError = null;
  if (typeof options.browserConversationExtractor === 'function') {
    try {
      adapterResult = await runConversationAdapter(options.browserConversationExtractor, source);
      if (adapterResult) {
        const strict = strictAssemblyFromAdapter(source, adapterResult, 'browser_conversation');
        if (strict?.thread?.complete && !isThreadsSinglePostCoverageUnverified(strict)) return strict;
      }
    } catch (error) {
      adapterError = error;
    }
  }

  const rootPost = rootPostFromSource(source);
  if (!rootPost || rootPost.is_reply === true) {
    source = incompleteSource(source, 'continuation_recovery_requires_root_target');
    if (requireComplete) throwIncomplete(source, adapterError);
    return source;
  }

  const evidencePosts = dedupePosts([
    rootPost,
    ...(adapterResult ? extractAdapterPosts(adapterResult).map((raw) => normalizedPost(raw, 'continuation_evidence')).filter(Boolean) : []),
    ...(Array.isArray(options.continuationCandidates) ? options.continuationCandidates.map((raw) => normalizedPost(raw, 'continuation_evidence')).filter(Boolean) : [])
  ]);

  let recovery;
  try {
    recovery = await recoverThreadsContinuation(rootPost, evidencePosts, options);
  } catch (error) {
    source = incompleteSource(source, 'continuation_ranker_failed');
    if (requireComplete) throwIncomplete(source, error);
    return source;
  }

  if (recovery.accepted) return inferredSource(source, rootPost, recovery);

  source = incompleteSource(source, `continuation_recovery_${recovery.reason || 'rejected'}`, recovery);
  if (requireComplete) throwIncomplete(source, adapterError);
  return source;
}
