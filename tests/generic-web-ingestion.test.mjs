import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertAcceptedEvidenceMatchesRequest,
  buildAcceptedSourceState,
  canonicalizeSource,
  fetchAcceptedEvidence,
  fetchGenericWebEvidence,
  validateAcceptedEvidence,
  validateAcceptedSourceState,
  validateIngestionRequest,
  acceptedSourceStatePath
} from '../packages/ingestion/src/index.js';
import {
  assertSafePublicWebUrl,
  extractPublicHtml,
  isPublicWebAddress,
  resolvePublicWebAddress
} from '../packages/ingestion/src/web/public-html.js';
import { bindAnalysisToEvidence } from '../packages/analysis/src/index.js';
import { loadCardDocuments } from '../packages/core/src/index.js';
import { applyAcceptedSourceAnalysis } from '../packages/workspace/src/card-store.js';
import { resolveIngestionPreflightTarget } from '../packages/ingestion/src/preflight.js';

const url = 'https://public.example.org/blog/safe-guide';
const text = '這是一篇完全合成的技術文件，描述公開資料來源如何進入知識卡系統。'.repeat(18);
const html = '<!doctype html><html><head><title>合成網頁測試</title>'
  + '<script>const hidden = "SECRET_SCRIPT_TEXT";</script></head>'
  + '<body><nav>Navigation only</nav><article><h1>合成網頁測試</h1>'
  + '<p>' + text + '</p></article></body></html>';

function request(sourceUrl = url) {
  return { schema_version: 1, provider: 'generic', source_url: sourceUrl };
}

async function accepted(sourceUrl = url, finalUrl = sourceUrl, page = html) {
  return fetchAcceptedEvidence(request(sourceUrl), {
    capturedAt: '2026-10-25T09:00:00Z',
    fetchHtmlImpl: async () => ({ finalUrl, html: page })
  });
}

function analysis(evidence) {
  return bindAnalysisToEvidence({
    title: '合成網頁測試',
    summary: '使用合成網頁驗證一般公開 HTML 的正式收錄契約。',
    resource_kind: 'article',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['remote-ingest', 'synthetic'],
    relevance: { overall: 3, engineering: 4 },
    actions: ['LEARN'],
    status: 'active',
    sections: {
      '一句話介紹': '一般公開網頁在驗證後可進入知識卡流程。',
      '它解決什麼問題': '過去只有 GitHub 與 Threads 可以正式收錄。',
      '核心概念': '以穩定網址與文章正文摘要值綁定證據。',
      '架構與技術': '網頁擷取、正文辨識、分析與寫入分層執行。',
      '主要功能': '識別來源、保留已接受正文並完成來源狀態驗證。',
      '技術亮點': '在進入分析階段以前驗證來源完整性。',
      '限制與風險': '動態頁面、登入限制與二進位文件不在範圍內。',
      '與你的相關性': '驗證合成來源能安全寫入而不攜帶私人資料。',
      '建議怎麼使用': '將它作為固定的來源收錄回歸測試。',
      '與其他收藏的關聯': '與既有來源類型使用相同的卡片寫入器。'
    }
  }, evidence);
}

test('generic request is normalized and refuses private endpoints or provider impersonation', () => {
  assert.equal(validateIngestionRequest(request(url)).source_url, url);
  assert.equal(canonicalizeSource(url).sourceType, 'article');
  assert.equal(canonicalizeSource('https://docs.example.org/docs/api').sourceType, 'documentation');
  assert.throws(() => validateIngestionRequest(request('http://127.0.0.1/admin')), (e) => e.code === 'SOURCE_URL_INVALID');
  assert.throws(() => validateIngestionRequest(request('http://localhost/secrets')), (e) => e.code === 'SOURCE_URL_INVALID');
  assert.throws(() => validateIngestionRequest(request('https://user:pass@example.org/')), (e) => e.code === 'SOURCE_URL_INVALID');
  assert.throws(() => validateIngestionRequest(request('https://github.com/o/r')), (e) => e.code === 'SOURCE_PROVIDER_UNSUPPORTED');
  assert.throws(() => validateIngestionRequest({ ...request(), command: 'delete' }), (e) => e.code === 'REMOTE_INGEST_REQUEST_INVALID');
});

test('DNS guard rejects mixed public/private answers and transition addresses', async () => {
  assertSafePublicWebUrl(url);
  assert.equal(isPublicWebAddress('8.8.8.8', 4), true);
  assert.equal(isPublicWebAddress('169.254.169.254', 4), false);
  assert.equal(isPublicWebAddress('10.1.2.3', 4), false);
  assert.equal(isPublicWebAddress('::ffff:127.0.0.1', 6), false);
  await assert.rejects(
    resolvePublicWebAddress('public.example.org', async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '192.168.1.1', family: 4 }
    ]),
    (e) => e.code === 'SOURCE_ACCESS_DENIED'
  );
  const found = await resolvePublicWebAddress('public.example.org', async () => [
    { address: '8.8.8.8', family: 4 }
  ]);
  assert.equal(found.address, '8.8.8.8');
});

test('HTML extraction removes scripts and requires actual article content', () => {
  const result = extractPublicHtml(html);
  assert.equal(result.title, '合成網頁測試');
  assert.match(result.text, /合成的技術文件/);
  assert.doesNotMatch(result.text, /SECRET_SCRIPT_TEXT|Navigation only/);
  assert.throws(() => extractPublicHtml('<html><title>Login</title><body>Sign in</body></html>'),
    (e) => e.code === 'SOURCE_INCOMPLETE');
});

test('accepted web evidence binds requested URL, final identity, full body fingerprint and compact state', async () => {
  const requested = 'https://public.example.org/old?utm_source=test';
  const evidence = await accepted(requested, url);
  const normalized = validateIngestionRequest(request(requested));
  assert.equal(evidence.provider, 'generic');
  assert.equal(evidence.requested_url, normalized.source_url);
  assert.equal(evidence.canonical_url, url);
  assert.equal(evidence.source_identity, 'url:' + url);
  assert.equal(validateAcceptedEvidence(evidence), evidence);
  assert.equal(assertAcceptedEvidenceMatchesRequest(normalized, evidence), evidence);
  assert.equal(evidence.document.text, extractPublicHtml(html).text);
  assert.match(evidence.document.text_sha256, /^[a-f0-9]{64}$/);
  const corrupt = structuredClone(evidence);
  corrupt.document.text += 'tampered';
  assert.throws(() => validateAcceptedEvidence(corrupt), (e) => e.code === 'SOURCE_INCOMPLETE');
  const state = buildAcceptedSourceState(evidence, {
    cardId: evidence.suggested_id,
    cardPath: 'content/knowledge/2026/' + evidence.suggested_id + '.md'
  });
  assert.equal(validateAcceptedSourceState(state), state);
  assert.ok(!JSON.stringify(state).includes(text));
  assert.match(acceptedSourceStatePath(evidence), /^sources\/web\/[a-f0-9]{64}\.json$/);
});

test('web provider uses the existing Workspace writer and preserves the stable Card on update', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-public-web-'));
  try {
    await fs.cp(path.resolve('tests/fixtures/synthetic-workspace'), workspace, { recursive: true });
    const first = await accepted();
    const initial = await applyAcceptedSourceAnalysis(workspace, first, analysis(first));
    assert.equal(initial.mode, 'create');
    assert.match(initial.card_path, /content\/knowledge\/2026\/.+\.md/);
    assert.match(initial.source_state_path, /state\/sources\/web\//);
    const same = await accepted(url, url, html.replace('一篇完全合成', '一份完全合成'));
    const updated = await applyAcceptedSourceAnalysis(workspace, same, analysis(same));
    assert.equal(updated.mode, 'update');
    assert.equal(updated.card_id, initial.card_id);
    assert.equal(updated.card_path, initial.card_path);
    const cards = await loadCardDocuments(path.join(workspace, 'content/knowledge'));
    assert.equal(cards.filter((c) => c.data.source?.identity === first.source_identity).length, 1);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
