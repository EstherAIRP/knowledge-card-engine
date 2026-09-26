import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const promptUrl = new URL('../prompts/KNOWLEDGE_EDITOR.md', import.meta.url);

test('Knowledge Editor prompt requires final evidence reread before analysis', async () => {
  const prompt = await readFile(promptUrl, 'utf8');

  for (const required of [
    '重新閱讀目前的 `evidence.json`',
    '重新閱讀目前 `research-evidence.json` 最終 bundle',
    '不能取代重新閱讀最終來源證據',
    '最後才產生 `analysis.json`',
    '本輪最終來源／研究證據',
    '既有 Card 的舊 AI 正文不是本輪事實來源'
  ]) {
    assert.ok(prompt.includes(required), `missing prompt invariant: ${required}`);
  }
});

test('Knowledge Editor prompt keeps synthesis before card classification', async () => {
  const prompt = await readFile(promptUrl, 'utf8');

  assert.ok(prompt.includes('卡片章節是最後的輸出格式，不是閱讀來源或研究時的思考順序'));
  assert.ok(prompt.includes('完成正文後，才決定 Relevance、Action、Category、Tag 與 Relation'));
  assert.ok(prompt.includes('不需要輸出完整內部推理過程'));
});
