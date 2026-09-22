import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalizeSource,
  fetchThreadsEvidence,
  validateThreadsEvidence
} from '../packages/ingestion/src/index.js';
import { bindAnalysisToEvidence } from '../packages/analysis/src/index.js';
import { loadCardDocuments, parseCardDocument } from '../packages/core/src/index.js';
import { applyAcceptedThreadsAnalysis } from '../packages/workspace/src/card-store.js';

function response({ status = 200, url, location = null, body = '' }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (name) => String(name).toLowerCase() === 'location' ? location : null },
    async text() { return body; }
  };
}

function jsonHtml(payload, visible = '') {
  return `<!doctype html><html><body>${visible}<script type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}

function post({ id, code, username = 'alice', text, replyTo = null, root = null, hasReplies = null }) {
  return {
    pk: id,
    code,
    user: { username },
    caption: { text },
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

function fixture({ version = 'one', input = 'middle', incomplete = false } = {}) {
  const shareUrl = 'https://www.threads.net/share/phase4token?utm_source=test#top';
  const rootUrl = 'https://threads.com/@alice/post/ROOTP4';
  const middleUrl = 'https://threads.com/@alice/post/PART2P4';
  const finalUrl = 'https://threads.com/@alice/post/PART3P4';
  const targetUrl = input === 'root' ? rootUrl : input === 'final' ? finalUrl : middleUrl;
  const posts = [
    post({ id: '700', code: 'ROOTP4', text: `第一篇完整內容 ${version}`, hasReplies: true }),
    post({ id: '701', code: 'PART2P4', text: '第二篇完整內容', replyTo: '700', root: '700', hasReplies: true }),
    ...(!incomplete ? [post({ id: '702', code: 'PART3P4', text: '第三篇完整內容', replyTo: '701', root: '700', hasReplies: false })] : [])
  ];
  const indicator = input === 'root' ? '1 / 3' : input === 'final' ? '3 / 3' : '2 / 3';
  const html = jsonHtml({ posts }, `<div>${indicator}</div>`);
  const fetchImpl = async (url) => {
    if (String(url).includes('/share/')) return response({ status: 302, url, location: targetUrl });
    if ([rootUrl, middleUrl, finalUrl].includes(String(url))) return response({ status: 200, url: String(url), body: html });
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { shareUrl, rootUrl, middleUrl, finalUrl, fetchImpl };
}

function analysisTemplate(evidence, overrides = {}) {
  return bindAnalysisToEvidence({
    title: 'Synthetic Threads Thread',
    summary: 'Synthetic Threads analysis produced only from structurally accepted conversation evidence.',
    resource_kind: 'article',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'threads'],
    relevance: { overall: 3, engineering: 4 },
    actions: ['LEARN'],
    status: 'active',
    sections: {
      '一句話介紹': 'Synthetic Threads source used to validate accepted evidence and safe persistence.',
      '它解決什麼問題': 'Validates root-level identity, complete conversation evidence, deduplication, and state advancement.',
      '核心概念': 'A transient share or any thread part resolves to one verified root source identity.',
      '架構與技術': 'The fixture uses embedded public Threads post data and structural reply relationships.',
      '主要功能': 'Exercises accepted evidence validation and create/update through the common writer.',
      '技術亮點': 'Analysis is bound to a digest of ordered, structurally complete source evidence.',
      '限制與風險': 'This fixture covers structural evidence only and does not emulate semantic continuation recovery.',
      '與你的相關性': 'It validates a provider contract without exposing private Workspace data.',
      '建議怎麼使用': 'Use as a deterministic regression fixture.',
      '與其他收藏的關聯': 'It coexists with GitHub ingestion through provider-neutral writer and state validation.'
    },
    ...overrides
  }, evidence);
}

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-threads-'));
  await fs.cp(path.resolve('examples/synthetic-workspace'), root, { recursive: true });
  return root;
}

test('Threads post and transient URL variants are recognized without treating share token as source identity', () => {
  const postSource = canonicalizeSource('https://www.threads.net/@Alice/post/ROOTP4?utm_source=x#top');
  assert.equal(postSource.provider, 'threads');
  assert.equal(postSource.canonicalUrl, 'https://threads.com/@Alice/post/ROOTP4');
  assert.equal(postSource.identity, 'threads:ROOTP4');

  const shareSource = canonicalizeSource('https://threads.net/share/token123?utm_source=x#top');
  assert.equal(shareSource.provider, 'threads');
  assert.equal(shareSource.canonicalUrl, 'https://threads.com/share/token123');
  assert.equal(shareSource.identity, null);
});

test('Threads provider resolves a share to root identity and accepts only the complete ordered conversation', async () => {
  const f = fixture();
  const evidence = await fetchThreadsEvidence(f.shareUrl, {
    fetchImpl: f.fetchImpl,
    capturedAt: '2026-09-22T08:00:00Z'
  });
  assert.equal(evidence.accepted, true);
  assert.equal(evidence.source_identity, 'threads:ROOTP4');
  assert.equal(evidence.canonical_url, f.rootUrl);
  assert.equal(evidence.requested_url, 'https://threads.com/share/phase4token');
  assert.equal(evidence.resolved_input_url, f.middleUrl);
  assert.equal(evidence.thread.status, 'COMPLETE_THREAD');
  assert.equal(evidence.thread.verification, 'structural');
  assert.equal(evidence.parts.length, 3);
  assert.equal(evidence.combined_text, '第一篇完整內容 one\n\n第二篇完整內容\n\n第三篇完整內容');
  assert.match(evidence.evidence_digest, /^[0-9a-f]{64}$/);
});

test('Threads provider fails closed when known thread coverage is incomplete', async () => {
  const f = fixture({ incomplete: true });
  await assert.rejects(
    fetchThreadsEvidence(f.shareUrl, {
      fetchImpl: f.fetchImpl,
      capturedAt: '2026-09-22T08:00:00Z'
    }),
    (error) => error.code === 'SOURCE_INCOMPLETE'
  );
});

test('Threads provider rejects root-only evidence when the root reports replies but coverage is unverified', async () => {
  const rootUrl = 'https://threads.com/@alice/post/ROOTONLY';
  const html = jsonHtml({
    posts: [post({ id: '900', code: 'ROOTONLY', text: 'Root with visible reply signal.', hasReplies: true })]
  });
  await assert.rejects(
    fetchThreadsEvidence(rootUrl, {
      fetchImpl: async (url) => response({ status: 200, url: String(url), body: html }),
      capturedAt: '2026-09-22T08:00:00Z'
    }),
    (error) => error.code === 'SOURCE_INCOMPLETE'
  );
});

test('Threads evidence validator rejects content tampering', async () => {
  const f = fixture();
  const evidence = await fetchThreadsEvidence(f.shareUrl, {
    fetchImpl: f.fetchImpl,
    capturedAt: '2026-09-22T08:00:00Z'
  });
  const tampered = structuredClone(evidence);
  tampered.parts[1].text = 'tampered';
  assert.throws(() => validateThreadsEvidence(tampered), (error) => error.code === 'SOURCE_INCOMPLETE');
});

test('Threads create then URL-variant update preserves stable Card state and stores only source fingerprints', async () => {
  const root = await tempWorkspace();
  try {
    const firstFixture = fixture({ version: 'one', input: 'middle' });
    const firstEvidence = await fetchThreadsEvidence(firstFixture.shareUrl, {
      fetchImpl: firstFixture.fetchImpl,
      capturedAt: '2026-09-22T08:00:00Z'
    });
    const first = await applyAcceptedThreadsAnalysis(root, firstEvidence, analysisTemplate(firstEvidence));
    assert.equal(first.mode, 'create');

    const firstCardPath = path.join(root, ...first.card_path.split('/'));
    let raw = await fs.readFile(firstCardPath, 'utf8');
    const original = parseCardDocument(raw, firstCardPath);
    raw = raw
      .replace('resource_kind:\n  ai: article\n  user: null', 'resource_kind:\n  ai: article\n  user: project')
      .replace(/## 使用者備註[\s\S]*?## 更新紀錄/, '## 使用者備註\n\nKeep this Threads note exactly.\n\n## 更新紀錄');
    await fs.writeFile(firstCardPath, raw, 'utf8');

    const secondFixture = fixture({ version: 'two', input: 'final' });
    const secondEvidence = await fetchThreadsEvidence('https://www.threads.net/@alice/post/PART3P4?utm_source=x#top', {
      fetchImpl: secondFixture.fetchImpl,
      capturedAt: '2026-09-23T08:00:00Z'
    });
    const second = await applyAcceptedThreadsAnalysis(
      root,
      secondEvidence,
      analysisTemplate(secondEvidence, { summary: 'Updated synthetic Threads analysis from the second accepted evidence.' })
    );
    assert.equal(second.mode, 'update');
    assert.equal(second.card_path, first.card_path);
    assert.equal(second.card_id, first.card_id);

    const cards = await loadCardDocuments(path.join(root, 'content/knowledge'));
    const matches = cards.filter((card) => card.data.source.identity === 'threads:ROOTP4');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].data.id, original.data.id);
    assert.equal(matches[0].data.created_at, original.data.created_at);
    assert.equal(matches[0].data.resource_kind.user, 'project');
    assert.equal(matches[0].data.source.type, 'article');
    assert.match(matches[0].body, /Keep this Threads note exactly\./);

    const statePath = path.join(root, ...second.source_state_path.split('/'));
    const stateRaw = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(stateRaw);
    assert.equal(state.provider, 'threads');
    assert.equal(state.evidence_digest, secondEvidence.evidence_digest);
    assert.equal(state.card_path, second.card_path);
    assert.doesNotMatch(stateRaw, /第一篇完整內容|第二篇完整內容|第三篇完整內容/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
