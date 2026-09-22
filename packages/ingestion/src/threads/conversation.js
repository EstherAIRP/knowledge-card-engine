import {
  extractResolvedThreadsPost,
  extractThreadsJsonPayloads
} from './extract-post.js';
import { classifyThreadsUrl } from './resolve-url.js';
import { normalizeThreadsPost } from './normalize.js';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

function shortcodeFromRaw(raw) {
  const direct = raw?.shortcode || raw?.code;
  if (direct) return String(direct);
  for (const candidate of [raw?.permalink, raw?.url, raw?.canonical_url]) {
    if (!candidate) continue;
    try {
      const classified = classifyThreadsUrl(String(candidate));
      if (classified.kind === 'post') return classified.shortcode;
    } catch {
      // Ignore malformed URLs.
    }
  }
  return null;
}

function walkObjects(root, visitor, maxNodes = 50000) {
  const stack = [root];
  const seen = new Set();
  let visited = 0;
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    visited += 1;
    if (visited > maxNodes) break;
    visitor(value);
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) stack.push(value[i]);
    } else {
      for (const child of Object.values(value)) {
        if (child && typeof child === 'object') stack.push(child);
      }
    }
  }
}

function collectThreadsPostCandidates(payloads) {
  const candidates = [];
  const seen = new Set();
  for (const payload of payloads || []) {
    walkObjects(payload, (raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const shortcode = shortcodeFromRaw(raw);
      const hasAuthor = Boolean(raw?.username || raw?.user?.username || raw?.owner?.username || raw?.author?.username);
      const hasText = typeof raw?.text === 'string'
        || typeof raw?.caption === 'string'
        || typeof raw?.caption?.text === 'string'
        || typeof raw?.body === 'string'
        || typeof raw?.content?.text === 'string';
      const hasId = Boolean(raw?.id || raw?.pk || raw?.post_id || raw?.media_id);
      const hasReplySignal = Boolean(raw?.text_post_app_info || raw?.reply_info || raw?.replied_to || raw?.root_post);
      if (!shortcode || (!hasAuthor && !hasText && !hasId && !hasReplySignal)) return;
      const key = `${shortcode}:${raw?.id || raw?.pk || raw?.post_id || raw?.media_id || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(raw);
    });
  }
  return candidates;
}

async function fetchThreadsHtml(canonicalUrl, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return { html: null, error: null };
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(canonicalUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
    const status = Number(response?.status || 0);
    if (status < 200 || status >= 300) {
      const error = new Error(`Threads conversation HTML request returned HTTP ${status || 'unknown'}.`);
      error.code = 'THREADS_CONVERSATION_HTTP_ERROR';
      return { html: null, error };
    }
    const responseUrl = response?.url || canonicalUrl;
    if (!classifyThreadsUrl(responseUrl).isThreads) {
      const error = new Error(`Threads conversation request left the Threads domain: ${responseUrl}`);
      error.code = 'THREADS_CONVERSATION_UNSAFE_REDIRECT';
      return { html: null, error };
    }
    return { html: typeof response?.text === 'function' ? await response.text() : '', error: null };
  } catch (error) {
    return { html: null, error };
  } finally {
    clearTimeout(timer);
  }
}

function asPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function hintFromRaw(raw) {
  const info = firstDefined(raw?.text_post_app_info, raw?.reply_info, raw?.thread_info, {}) || {};
  const index = asPositiveInteger(firstDefined(
    raw?.thread_index,
    raw?.thread_position,
    raw?.self_thread_index,
    raw?.sequence_index,
    raw?.part_index,
    info?.thread_index,
    info?.thread_position,
    info?.self_thread_index,
    info?.sequence_index,
    info?.part_index
  ));
  const total = asPositiveInteger(firstDefined(
    raw?.thread_total,
    raw?.thread_count,
    raw?.self_thread_count,
    raw?.total_thread_count,
    raw?.sequence_total,
    raw?.part_total,
    info?.thread_total,
    info?.thread_count,
    info?.self_thread_count,
    info?.total_thread_count,
    info?.sequence_total,
    info?.part_total
  ));
  if (!index && !total) return null;
  return { index, total, source: 'structured_hint' };
}

function decodeHtmlText(value) {
  return String(value)
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

export function extractThreadsUiThreadIndicator(html) {
  const withoutScripts = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const text = decodeHtmlText(withoutScripts.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const matches = [];
  const regex = /(?:^|[^\d])(\d{1,3})\s*\/\s*(\d{1,3})(?!\d)/g;
  for (const match of text.matchAll(regex)) {
    const index = asPositiveInteger(match[1]);
    const total = asPositiveInteger(match[2]);
    if (!index || !total || total < 2 || index > total || total > 100) continue;
    matches.push({ index, total });
  }
  const unique = [...new Map(matches.map((item) => [`${item.index}/${item.total}`, item])).values()];
  return unique.length === 1 ? { ...unique[0], source: 'html_ui_text' } : null;
}

function normalizeConversationCandidate(raw, method) {
  if (raw?.provider === 'threads' && raw?.shortcode && raw?.extraction) {
    return { post: raw, hint: hintFromRaw(raw), raw };
  }
  try {
    const post = normalizeThreadsPost(raw, { method, confidence: 'high' });
    return { post, hint: hintFromRaw(raw), raw };
  } catch {
    return null;
  }
}

export function extractThreadsConversationRecordsFromHtml(html) {
  const payloads = extractThreadsJsonPayloads(html);
  const candidates = collectThreadsPostCandidates(payloads);
  const records = [];
  const byKey = new Map();

  for (const raw of candidates) {
    const record = normalizeConversationCandidate(raw, 'html_embedded_json');
    if (!record) continue;
    const key = record.post.id
      ? `id:${record.post.id}`
      : record.post.shortcode
        ? `shortcode:${record.post.shortcode}`
        : null;
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || (!existing.post.text && record.post.text)) byKey.set(key, record);
  }

  records.push(...byKey.values());
  return records;
}

function nodeKeys(post) {
  return [post?.id, post?.shortcode].filter(Boolean).map(String);
}

export function buildThreadsConversationGraph(records) {
  const nodes = [];
  const byKey = new Map();
  for (const record of records || []) {
    if (!record?.post) continue;
    const node = { ...record, children: [] };
    nodes.push(node);
    for (const key of nodeKeys(record.post)) {
      if (!byKey.has(key)) byKey.set(key, node);
    }
  }

  for (const node of nodes) {
    const parentKey = node.post.reply_to ? String(node.post.reply_to) : null;
    if (!parentKey) continue;
    const parent = byKey.get(parentKey);
    if (parent && parent !== node && !parent.children.includes(node)) parent.children.push(node);
  }
  return { nodes, byKey };
}

export function resolveThreadsRootNode(targetPost, graph) {
  if (!targetPost || !graph) return { root: null, reason: 'missing_target' };
  const target = nodeKeys(targetPost).map((key) => graph.byKey.get(key)).find(Boolean) || null;
  if (!target) return { root: null, reason: 'target_not_in_graph' };

  if (targetPost.root_post) {
    const explicitRoot = graph.byKey.get(String(targetPost.root_post));
    if (explicitRoot) return { root: explicitRoot, reason: 'root_post' };
  }

  let current = target;
  const seen = new Set();
  while (current?.post?.reply_to) {
    const currentKey = current.post.id || current.post.shortcode;
    if (seen.has(currentKey)) return { root: null, reason: 'cycle' };
    seen.add(currentKey);
    const parent = graph.byKey.get(String(current.post.reply_to));
    if (!parent) {
      return current === target && !targetPost.is_reply
        ? { root: current, reason: 'target_root' }
        : { root: null, reason: 'missing_parent' };
    }
    current = parent;
  }
  return { root: current, reason: current === target ? 'target_root' : 'walked_parent_chain' };
}

function sameAuthor(post, username) {
  return Boolean(post?.username && username && post.username.toLowerCase() === username.toLowerCase());
}

function belongsToRoot(post, root) {
  if (!post?.root_post) return true;
  return nodeKeys(root.post).includes(String(post.root_post));
}

function chooseContinuation(candidates, expectedIndex) {
  if (candidates.length <= 1) return { node: candidates[0] || null, ambiguous: false };
  const hinted = candidates.filter((candidate) => candidate.hint?.index === expectedIndex);
  return hinted.length === 1
    ? { node: hinted[0], ambiguous: false }
    : { node: null, ambiguous: true };
}

export function buildThreadsAuthorChain(root, graph) {
  if (!root) return { chain: [], ambiguous: false };
  const author = root.post.username;
  const chain = [root];
  const seen = new Set(nodeKeys(root.post));
  let current = root;

  while (current) {
    const candidates = current.children.filter((child) =>
      sameAuthor(child.post, author)
      && belongsToRoot(child.post, root)
      && !nodeKeys(child.post).some((key) => seen.has(key))
    );
    const chosen = chooseContinuation(candidates, chain.length + 1);
    if (chosen.ambiguous) return { chain, ambiguous: true };
    if (!chosen.node) break;
    chain.push(chosen.node);
    for (const key of nodeKeys(chosen.node.post)) seen.add(key);
    current = chosen.node;
  }

  return { chain, ambiguous: false };
}

function normalizeIndicator(value, source = 'adapter') {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(value.trim());
    if (!match) return null;
    value = { index: match[1], total: match[2] };
  }
  const index = asPositiveInteger(firstDefined(value.index, value.current, value.position));
  const total = asPositiveInteger(firstDefined(value.total, value.count, value.length));
  if (!index || !total || total < 1 || index > total) return null;
  return { index, total, source: value.source || source };
}

function deriveStructuredIndicator(chain, targetPost) {
  const totals = [...new Set(chain.map((node) => node.hint?.total).filter(Boolean))];
  if (totals.length !== 1) return null;
  const total = totals[0];
  const targetIndex = chain.findIndex((node) => nodeKeys(node.post).some((key) => nodeKeys(targetPost).includes(key)));
  const targetNode = targetIndex >= 0 ? chain[targetIndex] : null;
  const index = targetNode?.hint?.index || (targetIndex >= 0 ? targetIndex + 1 : null);
  return index ? { index, total, source: 'structured_hint' } : null;
}

function chooseIndicator(indicators) {
  const valid = indicators.filter(Boolean);
  if (!valid.length) return { indicator: null, conflict: false };
  const totals = [...new Set(valid.map((item) => item.total))];
  if (totals.length > 1) return { indicator: null, conflict: true };
  const total = totals[0];
  const preferred = valid.find((item) => item.source === 'adapter')
    || valid.find((item) => item.source === 'html_ui_text')
    || valid[0];
  return { indicator: { ...preferred, total }, conflict: false };
}

function sourceConfidence({ complete, ambiguous, indicator, coverageComplete, chainLength, singlePost }) {
  if (!complete) return ambiguous ? 'low' : 'medium';
  if (indicator || coverageComplete) return 'high';
  if (singlePost || chainLength > 1) return 'medium';
  return 'medium';
}

export function assembleThreadsConversation({
  targetPost,
  records,
  htmlIndicator = null,
  adapterIndicator = null,
  coverageComplete = false,
  extractionMethod = 'html_embedded_json'
}) {
  const graph = buildThreadsConversationGraph(records);
  const rootResult = resolveThreadsRootNode(targetPost, graph);
  if (!rootResult.root) {
    return {
      provider: 'threads',
      canonical_url: targetPost?.canonical_url || null,
      source_identity: null,
      root_post_id: targetPost?.root_post || null,
      root_shortcode: null,
      author: targetPost?.username || null,
      input_post: targetPost || null,
      thread: {
        status: 'INCOMPLETE_THREAD',
        total: null,
        detected_parts: 0,
        input_index: null,
        complete: false,
        confidence: 'low',
        indicator: null,
        reason: rootResult.reason
      },
      parts: [],
      combined_text: '',
      extraction: {
        method: extractionMethod,
        single_post_complete: Boolean(targetPost),
        conversation_complete: false
      }
    };
  }

  const chainResult = buildThreadsAuthorChain(rootResult.root, graph);
  const chain = chainResult.chain;
  const rootPost = rootResult.root.post;
  const inputIndex = chain.findIndex((node) => nodeKeys(node.post).some((key) => nodeKeys(targetPost).includes(key)));
  const structuredIndicator = deriveStructuredIndicator(chain, targetPost);
  const indicatorChoice = chooseIndicator([
    normalizeIndicator(adapterIndicator, 'adapter'),
    normalizeIndicator(htmlIndicator, 'html_ui_text'),
    structuredIndicator
  ]);
  const indicator = indicatorChoice.indicator;
  const detectedParts = chain.length;
  const singlePost = detectedParts === 1 && !targetPost?.is_reply && !targetPost?.root_post;

  let status = 'INCOMPLETE_THREAD';
  let complete = false;
  let reason = null;

  if (chainResult.ambiguous || indicatorChoice.conflict) {
    status = 'AMBIGUOUS_THREAD';
    reason = chainResult.ambiguous ? 'same_author_branch' : 'indicator_conflict';
  } else if (indicator) {
    if (detectedParts === indicator.total && inputIndex >= 0 && inputIndex + 1 === indicator.index) {
      status = indicator.total === 1 ? 'SINGLE_POST' : 'COMPLETE_THREAD';
      complete = true;
    } else if (detectedParts < indicator.total) {
      status = 'INCOMPLETE_THREAD';
      reason = 'missing_parts';
    } else {
      status = 'AMBIGUOUS_THREAD';
      reason = 'indicator_mismatch';
    }
  } else if (coverageComplete && inputIndex >= 0) {
    status = detectedParts === 1 ? 'SINGLE_POST' : 'COMPLETE_THREAD';
    complete = true;
  } else if (singlePost && inputIndex === 0) {
    status = 'SINGLE_POST';
    complete = true;
  } else if (detectedParts > 1 && chain.at(-1)?.post?.has_replies === false && inputIndex >= 0) {
    status = 'COMPLETE_THREAD';
    complete = true;
  } else {
    status = 'INCOMPLETE_THREAD';
    reason = inputIndex < 0 ? 'input_not_in_author_chain' : 'conversation_coverage_unverified';
  }

  const total = indicator?.total || (complete ? detectedParts : null);
  const confidence = sourceConfidence({
    complete,
    ambiguous: status === 'AMBIGUOUS_THREAD',
    indicator,
    coverageComplete,
    chainLength: detectedParts,
    singlePost
  });
  const parts = chain.map((node, index) => ({
    index: index + 1,
    ...node.post
  }));
  const rootShortcode = rootPost.shortcode || null;

  return {
    provider: 'threads',
    canonical_url: rootPost.canonical_url || targetPost?.canonical_url || null,
    source_identity: rootShortcode ? `threads:${rootShortcode}` : (rootPost.id ? `threads-id:${rootPost.id}` : null),
    id: rootPost.id || null,
    shortcode: rootPost.shortcode || null,
    username: rootPost.username || null,
    text: rootPost.text || null,
    timestamp: rootPost.timestamp || null,
    media: rootPost.media || [],
    is_reply: rootPost.is_reply ?? false,
    reply_to: rootPost.reply_to || null,
    root_post: rootPost.root_post || null,
    has_replies: rootPost.has_replies ?? null,
    quoted_post: rootPost.quoted_post || null,
    reposted_post: rootPost.reposted_post || null,
    link_attachment_url: rootPost.link_attachment_url || null,
    alt_text: rootPost.alt_text || null,
    root_post_id: rootPost.id || null,
    root_shortcode: rootShortcode,
    author: rootPost.username || null,
    input_post: {
      id: targetPost?.id || null,
      shortcode: targetPost?.shortcode || null,
      canonical_url: targetPost?.canonical_url || null,
      index: inputIndex >= 0 ? inputIndex + 1 : null
    },
    thread: {
      status,
      total,
      detected_parts: detectedParts,
      input_index: inputIndex >= 0 ? inputIndex + 1 : null,
      complete,
      confidence,
      indicator,
      reason
    },
    parts,
    combined_text: parts.map((part) => part.text).filter(Boolean).join('\n\n'),
    extraction: {
      method: extractionMethod,
      single_post_complete: Boolean(targetPost),
      conversation_complete: complete,
      conversation_coverage_complete: Boolean(coverageComplete)
    }
  };
}

function extractAdapterPosts(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  for (const value of [result.posts, result.data, result.replies, result.conversation]) {
    if (Array.isArray(value)) return value;
  }
  return result.post && typeof result.post === 'object' ? [result.post] : [];
}

function mergeRecords(baseRecords, raws, method) {
  const merged = [...baseRecords];
  const byKey = new Map();
  for (const record of merged) {
    for (const key of nodeKeys(record.post)) byKey.set(key, record);
  }
  for (const raw of raws) {
    const record = normalizeConversationCandidate(raw, method);
    if (!record) continue;
    const keys = nodeKeys(record.post);
    const existing = keys.map((key) => byKey.get(key)).find(Boolean);
    if (existing) {
      if (!existing.post.text && record.post.text) existing.post = record.post;
      if (!existing.hint && record.hint) existing.hint = record.hint;
      continue;
    }
    merged.push(record);
    for (const key of keys) byKey.set(key, record);
  }
  return merged;
}

async function runConversationAdapter(adapter, targetPost, source) {
  if (typeof adapter !== 'function') return null;
  return adapter({
    provider: 'threads',
    canonical_url: targetPost.canonical_url,
    id: targetPost.id,
    shortcode: targetPost.shortcode,
    root_post: targetPost.root_post,
    reply_to: targetPost.reply_to,
    partial: source
  });
}

export async function extractResolvedThreadsConversation(canonicalUrl, options = {}) {
  let html = options.html;
  let htmlFetchError = null;
  if (html === undefined) {
    const fetched = await fetchThreadsHtml(canonicalUrl, options);
    html = fetched.html || '';
    htmlFetchError = fetched.error;
  }

  let targetPost = null;
  try {
    targetPost = await extractResolvedThreadsPost(canonicalUrl, { ...options, html });
  } catch (error) {
    if (!options.apiExtractor && !options.browserExtractor) {
      const wrapped = new Error(`Threads target post extraction failed before conversation reconstruction: ${error.message}`);
      wrapped.code = 'THREADS_CONVERSATION_TARGET_FAILED';
      wrapped.cause = error;
      throw wrapped;
    }
    targetPost = await extractResolvedThreadsPost(canonicalUrl, { ...options, html: '' });
  }

  let records = extractThreadsConversationRecordsFromHtml(html);
  if (!records.some((record) => nodeKeys(record.post).some((key) => nodeKeys(targetPost).includes(key)))) {
    records = mergeRecords(records, [targetPost], 'target_post');
  }

  const htmlIndicator = extractThreadsUiThreadIndicator(html);
  let source = assembleThreadsConversation({
    targetPost,
    records,
    htmlIndicator,
    coverageComplete: false,
    extractionMethod: 'html_embedded_json'
  });

  const adapters = [
    ['api_conversation', options.apiConversationExtractor],
    ['browser_conversation', options.browserConversationExtractor]
  ];

  for (const [method, adapter] of adapters) {
    if (source.thread.complete || typeof adapter !== 'function') continue;
    const result = await runConversationAdapter(adapter, targetPost, source);
    if (!result) continue;
    records = mergeRecords(records, extractAdapterPosts(result), method);
    source = assembleThreadsConversation({
      targetPost,
      records,
      htmlIndicator,
      adapterIndicator: firstDefined(result.thread_indicator, result.indicator, result.ui_indicator),
      coverageComplete: Boolean(firstDefined(result.complete, result.conversation_complete, false)),
      extractionMethod: method
    });
  }

  if (!source.thread.complete && (options.requireComplete ?? true)) {
    const error = new Error(`Threads conversation is not complete: ${source.thread.status}${source.thread.reason ? ` (${source.thread.reason})` : ''}.`);
    error.code = source.thread.status === 'AMBIGUOUS_THREAD'
      ? 'THREADS_CONVERSATION_AMBIGUOUS'
      : 'THREADS_CONVERSATION_INCOMPLETE';
    error.partial = source;
    error.cause = htmlFetchError;
    throw error;
  }

  return source;
}
