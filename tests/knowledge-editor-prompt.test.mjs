import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const promptUrl = new URL('../prompts/KNOWLEDGE_EDITOR.md', import.meta.url);
const runtimeUrl = new URL('../prompts/RUNTIME.md', import.meta.url);
const analysisDocUrl = new URL('../docs/analysis.md', import.meta.url);
const cardContractUrl = new URL('../docs/card-contract.md', import.meta.url);

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


test('Runtime and formal contracts keep final reread before Card mapping', async () => {
  const [runtime, analysisDoc, cardContract] = await Promise.all([
    readFile(runtimeUrl, 'utf8'),
    readFile(analysisDocUrl, 'utf8'),
    readFile(cardContractUrl, 'utf8')
  ]);

  assert.ok(runtime.includes('重新閱讀本輪最終有效證據，再形成整體理解'));
  assert.ok(runtime.includes('先依本輪最終證據形成新的整體理解，再讀既有卡片'));
  assert.ok(runtime.includes('不能取代重新閱讀來源文字，也不能直接當成卡片大綱'));

  assert.ok(analysisDoc.includes('不能直接取代最終來源閱讀'));
  assert.ok(analysisDoc.includes('Card 的十個正文段落是在整體理解形成後才映射的輸出結構'));

  assert.ok(cardContract.includes('前 10 段是最終呈現結構，不是研究計畫或閱讀來源的順序'));
  assert.ok(cardContract.includes('不得把 research question、structured findings 或 README 章節逐項改寫成正文'));
});

test('Knowledge Editor quality contract avoids brittle length and item-count gates', async () => {
  const [prompt, analysisDoc, cardContract] = await Promise.all([
    readFile(promptUrl, 'utf8'),
    readFile(analysisDocUrl, 'utf8'),
    readFile(cardContractUrl, 'utf8')
  ]);

  assert.ok(prompt.includes('不要為了形式完整而強迫每個來源都有同樣多的洞見'));
  assert.ok(analysisDoc.includes('不要求固定字數、固定段落長度或固定項目數'));
  assert.ok(cardContract.includes('各段不要求固定字數或固定項目數'));
});
