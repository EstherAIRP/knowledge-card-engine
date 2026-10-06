import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorUrl = new URL('../prompts/KNOWLEDGE_EDITOR.md', import.meta.url);
const styleUrl = new URL('../prompts/CARD_STYLE.md', import.meta.url);
const runtimeUrl = new URL('../prompts/RUNTIME.md', import.meta.url);
const analysisDocUrl = new URL('../docs/specs/analysis.md', import.meta.url);
const cardContractUrl = new URL('../docs/specs/card.md', import.meta.url);

test('Knowledge Editor requires final evidence reread before loading card style', async () => {
  const prompt = await readFile(editorUrl, 'utf8');

  for (const required of [
    '只有本輪要用來分析的證據已經固定後，才開始這一步',
    '依目前結果逐一讀取',
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

  const getSection = (heading, nextHeading) => {
    const start = style.indexOf(heading);
    const end = style.indexOf(nextHeading, start + heading.length);
    assert.ok(start >= 0 && end > start, `missing card style section: ${heading}`);
    return style.slice(start, end);
  };

  const coreConcepts = getSection('## 核心概念', '## 架構與技術');
  assert.ok(coreConcepts.includes('2～3'), 'core concepts must select 2–3 topics');
  assert.ok(coreConcepts.includes('`###`'), 'core concepts must use ### topic headings');

  const architecture = getSection('## 架構與技術', '## 主要功能');
  assert.ok(architecture.includes('條列'), 'architecture must support structured bullet explanation');
  assert.ok(architecture.includes('元件或階段'), 'architecture must describe component or stage responsibilities');

  const capabilities = getSection('## 主要功能', '## 技術亮點');
  assert.ok(capabilities.includes('條列'), 'main capabilities must use a scannable list');
  assert.ok(capabilities.includes('主要能力'), 'main capabilities must describe useful capabilities');

  const highlights = getSection('## 技術亮點', '## 限制與風險');
  assert.ok(highlights.includes('2～3'), 'technical highlights must select 2–3 mechanisms');
  assert.ok(highlights.includes('`###`'), 'technical highlights must use ### topic headings');

  const limitations = getSection('## 限制與風險', '## 與你的相關性');
  assert.ok(limitations.includes('條列'), 'limitations must use a scannable list');
  assert.ok(limitations.includes('限制'), 'limitations must describe adoption-relevant constraints');
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

  assert.ok(analysisDoc.includes('形成整體理解以前，不先載入 [Knowledge Card 寫作樣式](../../prompts/CARD_STYLE.md)'));
  assert.ok(analysisDoc.includes('Card 的十個正文段落與寫作樣式都只在整體理解形成後才套用'));

  assert.ok(cardContract.includes('完成理解後才讀 [Knowledge Card 寫作樣式](../../prompts/CARD_STYLE.md)'));
  assert.ok(cardContract.includes('本契約只固定 H1、頂層段落順序與所有權'));
  assert.ok(cardContract.includes('`CARD_STYLE.md` 為權威來源'));
  assert.ok(cardContract.includes('`packages/core` 驗證器仍負責 H1、頂層段落順序'));
  assert.ok(!cardContract.includes('「核心概念」選 2～3 個真正重要的主題'));
  assert.ok(!cardContract.includes('「技術亮點」選 2～3 個有辨識度、值得記住的設計或機制'));
});

test('Deferred card style does not change analysis schema or require persistent synthesis state', async () => {
  const [analysisDoc, cardContract] = await Promise.all([
    readFile(analysisDocUrl, 'utf8'),
    readFile(cardContractUrl, 'utf8')
  ]);

  assert.ok(analysisDoc.includes('不新增 `analysis_version`、不新增持久化欄位'));
  assert.ok(cardContract.includes('寫作樣式不改變前置中繼資料 Schema，也不新增或刪除頂層正文段落'));
});

test('Prompt roles do not duplicate source or data contracts', async () => {
  const [runtime, editor, style] = await Promise.all([
    readFile(runtimeUrl, 'utf8'),
    readFile(editorUrl, 'utf8'),
    readFile(styleUrl, 'utf8')
  ]);

  assert.ok(runtime.includes('本文件只描述它們應以什麼順序銜接，不建立第二套領域規格'));
  assert.ok(runtime.includes('Runtime 不再重複欄位或版本規則'));
  assert.ok(editor.includes('本提示只負責「拿到最終證據之後，應如何閱讀與形成理解」'));
  assert.ok(style.includes('本文件只負責最終內容的表達方式'));

  for (const duplicatedDetail of [
    'completed_rounds: 0',
    'max_expansion_rounds',
    'confidence >= 0.90'
  ]) {
    assert.ok(!runtime.includes(duplicatedDetail), `runtime duplicated domain detail: ${duplicatedDetail}`);
    assert.ok(!editor.includes(duplicatedDetail), `editor duplicated domain detail: ${duplicatedDetail}`);
    assert.ok(!style.includes(duplicatedDetail), `style duplicated domain detail: ${duplicatedDetail}`);
  }
});
