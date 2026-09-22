import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchThreadsEvidence } from '../packages/ingestion/src/index.js';
import {
  extractThreadsViaBrowser,
  resolveThreadsUrlViaBrowser
} from '../packages/ingestion/src/threads/browser-adapter.js';
import {
  createThreadsSemanticHandoffCaptureRanker,
  createThreadsSemanticHandoffRanker
} from '../packages/ingestion/src/threads/semantic-handoff.js';

function rawPost({
  id,
  code,
  username = 'alice',
  text,
  timestamp = null,
  isReply = false,
  replyTo = null,
  root = null,
  hasReplies = null
}) {
  return {
    pk: id,
    code,
    user: { username },
    caption: { text },
    ...(timestamp ? { timestamp } : {}),
    is_reply: isReply,
    ...(hasReplies === null ? {} : { has_replies: hasReplies }),
    ...(replyTo || root ? {
      text_post_app_info: {
        is_reply: Boolean(replyTo),
        ...(replyTo ? { replied_to_post: { pk: replyTo } } : {}),
        ...(root ? { root_post: { pk: root } } : {})
      }
    } : {})
  };
}

function httpResponse({ status = 200, url, body = '', location = null }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'location' ? location : null;
      }
    },
    async text() { return body; }
  };
}

function browserSessionFactory({ finalUrl, html = '<html><body></body></html>', payloads = [] }) {
  return async () => {
    let currentUrl = finalUrl;
    const listeners = new Map();
    const page = {
      on(event, handler) { listeners.set(event, handler); },
      off(event) { listeners.delete(event); },
      async goto(url) {
        currentUrl = finalUrl || url;
        const handler = listeners.get('response');
        if (handler) {
          for (const payload of payloads) {
            handler({
              url: () => 'https://www.threads.com/api/graphql',
              headerValue: async () => 'application/json; charset=utf-8',
              json: async () => payload
            });
          }
        }
      },
      async waitForLoadState() {},
      async evaluate() {},
      async waitForTimeout() {},
      url() { return currentUrl; },
      async content() { return html; }
    };
    return {
      page,
      context: { async close() {} },
      browser: { async close() {} },
      launch_method: 'fixture'
    };
  };
}

const root = rawPost({
  id: '1000',
  code: 'ROOTB',
  text: '第一段',
  timestamp: '2026-09-22T00:00:00Z',
  hasReplies: true
});
const middle = rawPost({
  id: '1001',
  code: 'MIDB',
  text: '第二段',
  timestamp: '2026-09-22T00:01:00Z',
  isReply: true,
  replyTo: '1000',
  root: '1000',
  hasReplies: true
});
const last = rawPost({
  id: '1002',
  code: 'LASTB',
  text: '第三段',
  timestamp: '2026-09-22T00:02:00Z',
  isReply: true,
  replyTo: '1001',
  root: '1000',
  hasReplies: false
});

test('Threads browser adapter captures public JSON evidence and canonical navigation', async () => {
  const browserSession = browserSessionFactory({
    finalUrl: 'https://threads.com/@alice/post/MIDB',
    html: '<html><body><div>2 / 3</div></body></html>',
    payloads: [{ data: { conversation: [root, middle, last] } }]
  });

  const resolved = await resolveThreadsUrlViaBrowser('https://threads.com/share/browser-token', {
    browserSessionFactory: browserSession,
    scrollRounds: 0
  });
  assert.equal(resolved.canonical_url, 'https://threads.com/@alice/post/MIDB');

  const extracted = await extractThreadsViaBrowser('https://threads.com/@alice/post/MIDB', {
    browserSessionFactory: browserSession,
    scrollRounds: 0
  });
  assert.deepEqual(extracted.posts.map((post) => post.shortcode), ['ROOTB', 'MIDB', 'LASTB']);
  assert.deepEqual(extracted.thread_indicator, { index: 2, total: 3, source: 'html_ui_text' });
});

test('Threads accepted evidence can use browser structural fallback without lowering completeness checks', async () => {
  const shareUrl = 'https://threads.com/share/browser-structural';
  const targetUrl = 'https://threads.com/@alice/post/MIDB';
  const evidence = await fetchThreadsEvidence(shareUrl, {
    fetchImpl: async (url) => String(url).includes('/share/')
      ? httpResponse({ status: 200, url: String(url), body: '<html><body>SPA shell</body></html>' })
      : httpResponse({ status: 200, url: String(url), body: '<html><body>no embedded post data</body></html>' }),
    browserFallback: true,
    browserOptions: {
      browserSessionFactory: browserSessionFactory({
        finalUrl: targetUrl,
        html: '<html><body><div>2 / 3</div></body></html>',
        payloads: [{ data: { thread: [root, middle, last] } }]
      }),
      scrollRounds: 0
    },
    capturedAt: '2026-09-22T01:00:00Z'
  });

  assert.equal(evidence.source_identity, 'threads:ROOTB');
  assert.equal(evidence.resolved_input_url, targetUrl);
  assert.equal(evidence.thread.verification, 'structural');
  assert.equal(evidence.thread.status, 'COMPLETE_THREAD');
  assert.equal(evidence.parts.length, 3);
});

test('semantic handoff is digest-bound and accepted only through deterministic recovery gates', async () => {
  const semanticRoot = {
    provider: 'threads',
    canonical_url: 'https://threads.com/@alice/post/SEMROOT',
    id: '2000',
    shortcode: 'SEMROOT',
    username: 'alice',
    text: '完整內容在留言',
    timestamp: '2026-09-22T02:00:00Z',
    media: [],
    is_reply: false,
    reply_to: null,
    root_post: null,
    has_replies: true,
    quoted_post: null,
    reposted_post: null,
    link_attachment_url: null,
    alt_text: null,
    extraction: { method: 'fixture', confidence: 'high', single_post_complete: true, conversation_complete: false }
  };
  const continuation = {
    ...semanticRoot,
    canonical_url: 'https://threads.com/@alice/post/SEMCONT',
    id: '2001',
    shortcode: 'SEMCONT',
    text: '這是接續的正文。',
    timestamp: '2026-09-22T02:01:00Z',
    is_reply: true,
    has_replies: false
  };
  const followup = {
    ...semanticRoot,
    canonical_url: 'https://threads.com/@alice/post/SEMFOLLOW',
    id: '2002',
    shortcode: 'SEMFOLLOW',
    text: '補充說明。',
    timestamp: '2026-09-22T03:00:00Z',
    is_reply: true,
    has_replies: false
  };

  let captured = null;
  const captureRanker = createThreadsSemanticHandoffCaptureRanker();
  await assert.rejects(
    () => captureRanker({
      rootPost: semanticRoot,
      candidates: [
        { post: continuation, shortcode: 'SEMCONT', delta_seconds: 60, metadata_score: 0.83 },
        { post: followup, shortcode: 'SEMFOLLOW', delta_seconds: 3600, metadata_score: 0.68 }
      ]
    }),
    (error) => {
      captured = error.semantic_handoff;
      return error.code === 'THREADS_CONTINUATION_HANDOFF_CAPTURED';
    }
  );

  assert.equal(captured.kind, 'threads_continuation_judgement');
  const ranker = createThreadsSemanticHandoffRanker({
    schema_version: 1,
    producer: 'knowledge_card_agent',
    evidence_digest: captured.evidence_digest,
    judgement: {
      selected_shortcodes: ['SEMCONT'],
      root_only: false,
      confidence: 0.98,
      complete: true,
      rationale: 'The first reply fulfills the root promise; the later reply is follow-up.',
      candidate_labels: [
        { shortcode: 'SEMCONT', label: 'continuation', confidence: 0.99 },
        { shortcode: 'SEMFOLLOW', label: 'followup', confidence: 0.97 }
      ]
    }
  });

  const replay = await ranker({
    rootPost: semanticRoot,
    candidates: [
      { post: continuation, shortcode: 'SEMCONT', delta_seconds: 60, metadata_score: 0.83 },
      { post: followup, shortcode: 'SEMFOLLOW', delta_seconds: 3600, metadata_score: 0.68 }
    ]
  });
  assert.equal(replay._ranker.method, 'agent_semantic_handoff');

  await assert.rejects(
    () => ranker({
      rootPost: { ...semanticRoot, text: 'source changed' },
      candidates: [
        { post: continuation, shortcode: 'SEMCONT', delta_seconds: 60, metadata_score: 0.83 },
        { post: followup, shortcode: 'SEMFOLLOW', delta_seconds: 3600, metadata_score: 0.68 }
      ]
    }),
    (error) => error.code === 'THREADS_CONTINUATION_HANDOFF_EVIDENCE_MISMATCH'
  );
});

test('semantic recovery produces llm_assisted accepted evidence with provenance', async () => {
  const rootRaw = rawPost({
    id: '3000',
    code: 'SEMROOT2',
    text: '咒語放在留言',
    timestamp: '2026-09-22T04:00:00Z',
    hasReplies: true
  });
  const continuationRaw = rawPost({
    id: '3001',
    code: 'SEMCONT2',
    text: '這是留言中的正文。',
    timestamp: '2026-09-22T04:01:00Z',
    isReply: true,
    hasReplies: false
  });
  const followupRaw = rawPost({
    id: '3002',
    code: 'SEMFOLLOW2',
    text: '後續解釋。',
    timestamp: '2026-09-22T05:00:00Z',
    isReply: true,
    hasReplies: false
  });
  const rootUrl = 'https://threads.com/@alice/post/SEMROOT2';

  const html = `<!doctype html><html><body><script type="application/json">${JSON.stringify({ post: rootRaw })}</script></body></html>`;
  const browserConversationExtractor = async () => ({
    posts: [rootRaw, continuationRaw, followupRaw],
    complete: false
  });

  let semanticHandoff = null;
  await assert.rejects(
    () => fetchThreadsEvidence(rootUrl, {
      fetchImpl: async (url) => httpResponse({ status: 200, url: String(url), body: html }),
      browserConversationExtractor,
      continuationRanker: createThreadsSemanticHandoffCaptureRanker(),
      capturedAt: '2026-09-22T06:00:00Z'
    }),
    (error) => {
      semanticHandoff = error.semantic_handoff;
      return error.code === 'THREADS_SEMANTIC_HANDOFF_REQUIRED' && Boolean(semanticHandoff?.evidence_digest);
    }
  );

  const ranker = createThreadsSemanticHandoffRanker({
    schema_version: 1,
    producer: 'knowledge_card_agent',
    evidence_digest: semanticHandoff.evidence_digest,
    judgement: {
      selected_shortcodes: ['SEMCONT2'],
      root_only: false,
      confidence: 0.98,
      complete: true,
      rationale: 'The immediate reply supplies the content promised by the root.',
      candidate_labels: [
        { shortcode: 'SEMCONT2', label: 'continuation', confidence: 0.99 },
        { shortcode: 'SEMFOLLOW2', label: 'followup', confidence: 0.97 }
      ]
    }
  });

  const evidence = await fetchThreadsEvidence(rootUrl, {
    fetchImpl: async (url) => httpResponse({ status: 200, url: String(url), body: html }),
    browserConversationExtractor,
    continuationRanker: ranker,
    capturedAt: '2026-09-22T06:00:00Z'
  });

  assert.equal(evidence.thread.verification, 'llm_assisted');
  assert.equal(evidence.thread.status, 'INFERRED_THREAD_HIGH_CONFIDENCE');
  assert.deepEqual(evidence.parts.map((part) => part.shortcode), ['SEMROOT2', 'SEMCONT2']);
  assert.equal(evidence.thread.recovery.ranker.method, 'agent_semantic_handoff');
  assert.equal(evidence.extraction.inferred, true);
});
