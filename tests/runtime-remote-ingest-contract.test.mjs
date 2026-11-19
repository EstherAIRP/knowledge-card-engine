import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtime = readFileSync(new URL('../prompts/RUNTIME.md', import.meta.url), 'utf8');
const routing = runtime.split('### 執行入口選擇與失敗分流\n')[1]?.split('\n## ')[0];

test('Runtime distinguishes interactive fetch failure from formal ingestion failure', () => {
  assert.ok(routing, 'Remote Ingest routing section must exist');
  assert.match(routing, /DisabledError/);
  assert.match(routing, /不得據此判定來源不存在、不完整或不受支援/);
  assert.match(routing, /不得把一般網頁工具失敗回報為正式來源擷取失敗/);
});

test('Runtime requires approved, pinned Remote Ingest and fail-closed guards', () => {
  assert.ok(routing, 'Remote Ingest routing section must exist');
  assert.match(routing, /Workspace 是否已有與鎖定版本一致且獲核准的 Remote Ingest/);
  assert.match(routing, /來源、分支、PR、版本鎖定及權限檢查/);
  assert.match(routing, /交接流程提交原始來源 URL/);
  assert.match(routing, /若未進入任何正式收錄入口，失敗回報必須說明未啟動的具體原因/);
});
