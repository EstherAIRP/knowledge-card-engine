import assert from 'node:assert/strict';
import test from 'node:test';
import { findCurrentOnlyDocumentationIssues } from '../scripts/documentation-policy.mjs';

test('current-only documentation policy catches product generations and development history', () => {
  const samples = [
    'Knowledge Card V2 的公開 engine。',
    'Workspace v1 契約。',
    'V1 相容欄位會保留。',
    '詳見 T05。',
    'Phase 4.7',
    '請參考舊版設計。',
    '規格依賴 knowledge-card-development。',
    '來源是 EstherAIRP/Knowledge-Card。'
  ];
  for (const sample of samples) {
    assert.ok(findCurrentOnlyDocumentationIssues('README.md', sample).length > 0, sample);
  }
});

test('current-only documentation policy allows real machine and protocol versions', () => {
  const text = [
    '目前接受 schema_version: 1。',
    'analysis_version 必須是 1。',
    '此 API v1 是目前公開 protocol 名稱。',
    'GitHub API version 使用 2022-11-28。'
  ].join('\n');
  assert.deepEqual(findCurrentOnlyDocumentationIssues('docs/example.md', text), []);
});
