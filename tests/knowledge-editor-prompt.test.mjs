import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorUrl = new URL('../prompts/KNOWLEDGE_EDITOR.md', import.meta.url);
const styleUrl = new URL('../prompts/CARD_STYLE.md', import.meta.url);
const runtimeUrl = new URL('../prompts/RUNTIME.md', import.meta.url);
const analysisDocUrl = new URL('../docs/analysis.md', import.meta.url);
const cardContractUrl = new URL('../docs/card-contract.md', import.meta.url);

test('Knowledge Editor requires final evidence reread before loading card style', async () => {
  const prompt = await readFile(editorUrl, 'utf8');

  for (const required of [
    '重新閱讀目前的 `evidence.json`',
    '重新閱讀目前 `research-evidence.json` 最終 bundle',
    '先形成新的整體理解',
    '完成理解後，才讀 `CARD_STYLE.md`',
    '既有 Card 的舊 AI 正文不是本輪事實來源',
    '不要一邊讀一邊替內容找卡片位置'
  ]) {
    assert.ok(prompt.includes(required), `missing editor invariant: ${required}`);
  }

  for (const deferredHeading of [
    '## 一句話介紹',
    '## 核心概念',
    '## 架構與技術',
    '## 技術亮點',
    '## 限制與風險'
  ]) {
    assert.ok(!prompt.includes(deferredHeading), `editor leaked deferred card template: ${deferredHeading}`);
  }
});

test('Card Style defines the required editorial layout', async () => {
  const style = await readFile(styleUrl, 'utf8');

  for (const required of [
    '## 核心概念',
    '選 2～3 個真正重要',
    '用 `###` 標示主題並描述概念內容',
    '## 架構與技術',
    '用條列方式詳述主要架構',
    '## 主要功能',
    '用條列整理主要能力',
    '## 技術亮點',
    '選 2～3 個真正有辨識度',
    '## 限制與風險',
    '用條列方式詳述真正會影響使用或判斷的限制與風險'
  ]) {
    assert.ok(style.includes(required), `missing card style instruction: ${required}`);
  }
});

test('Runtime and formal contracts defer Card Style until after synthesis', async () => {
  const [runtime, analysisDoc, cardContract] = await Promise.all([
    readFile(runtimeUrl, 'utf8'),
    readFile(analysisDocUrl, 'utf8'),
    readFile(cardContractUrl, 'utf8')
  ]);

  assert.ok(runtime.includes('在整體理解形成以前，不得先讀 `CARD_STYLE.md`'));
  assert.ok(runtime.includes('整體理解形成後，才讀 [Knowledge Card 寫作樣式](./CARD_STYLE.md)'));
  assert.ok(runtime.includes('不能取代重新閱讀來源文字，也不能直接當成卡片大綱'));

  assert.ok(analysisDoc.includes('形成整體理解以前，不先載入 [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md)'));
  assert.ok(analysisDoc.includes('Card 的十個正文段落與寫作樣式都只在整體理解形成後才套用'));

  assert.ok(cardContract.includes('完成理解後才讀 [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md)'));
  assert.ok(cardContract.includes('「核心概念」選 2～3 個真正重要的主題'));
  assert.ok(cardContract.includes('「技術亮點」選 2～3 個有辨識度、值得記住的設計或機制'));
  assert.ok(cardContract.includes('現有 Core 驗證器仍負責 H1、頂層 section 順序'));
});

test('Deferred card style does not change analysis schema or require persistent synthesis state', async () => {
  const [analysisDoc, cardContract] = await Promise.all([
    readFile(analysisDocUrl, 'utf8'),
    readFile(cardContractUrl, 'utf8')
  ]);

  assert.ok(analysisDoc.includes('不新增 `analysis_version`、不新增持久化欄位'));
  assert.ok(cardContract.includes('不改變前置中繼資料 Schema，也不新增正文 section'));
});
