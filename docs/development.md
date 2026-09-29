# 開發與驗證

## 工具鏈

- Node.js 24
- npm workspaces
- ESM
- `package-lock.json` 納入版本控制

安裝依賴並執行 Knowledge Card Engine 全套驗證：

```bash
npm ci
npm run validate
```

`npm run validate` 目前等於：

1. `npm run check`：檢查必要檔案、合成測試資料、只描述目前狀態的文件政策與倉庫層級契約。
2. `npm test`：執行 Node 測試，涵蓋 Workspace、Card、分類體系、分析／研究契約、GitHub 已接受／研究證據、多輪研究上限、Remote Ingest 合成研究端到端流程、研究追溯資訊持久化／所有權／狀態綁定、Threads 收錄、來源狀態交易一致性、私人登入／授權、Web UI 版面契約，以及生成資料／發布／發布讀取器一致性案例。

共用完整 Workspace 合成測試資料位於 `tests/fixtures/synthetic-workspace/`。它只保留目前契約測試需要的合成內容，不作為使用者範例或 Knowledge Card Workspace 範本；必須存在但沒有內容的 Workspace 目錄，使用該測試資料內的 README 保留在 Git。

Web UI 版面契約可單獨執行：

```bash
npm run ui:verify
```

此檢查會驗證設計變數、樣式責任歸屬、頁面／閱讀寬度、主要響應式斷點、圖譜呈現／執行程式邊界，以及介面外殼的樣式組合。完整 UI 架構見 [web-ui.md](./web-ui.md)。

## Workspace 驗證

驗證指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

若要同時驗證 Engine 版本鎖定與薄層工作流程：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/validate.yml
```

## 來源收錄

GitHub：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo \
  --analysis-file=analysis.json
```

Threads：

```bash
npm run ingest:threads -- /path/to/workspace https://threads.com/share/token \
  --analysis-file=analysis.json
```

兩者都可用 `--evidence-file=accepted-evidence.json` 注入已取得、仍需重新驗證的證據。GitHub CLI 否則透過 GitHub API 即時取得中繼資料與 README；需要授權時使用環境變數 `GITHUB_TOKEN`。Threads CLI 只有在結構證據可證明來源完整時接受，不提供語意續篇猜測。密鑰不得提交。

來源寫入器的資料與所有權前置條件見 [ingestion.md](./ingestion.md) 與 [card-contract.md](./card-contract.md)。

受控 Remote Ingest 執行器使用：

```bash
npm run ingest:handoff -- /path/to/workspace --result-file=/tmp/ingest-result.json
```

`npm run ingest:github:handoff` 保留為相容別名。

此 CLI 只讀取設定狀態根目錄下的固定交接檔名，不接受任意交接路徑。GitHub 流程使用 `request.json`、`evidence.json`、`research-evidence.json`、`research-plan.json` 與最終 `analysis.json`；第一次準備階段只建立固定倉庫版本的探索結果與空的第 0 輪研究狀態，必須由 Agent 先提交關鍵研究問題計畫與選定路徑。執行器會在同一倉庫版本驗證選定的安全文字路徑並形成第一輪證據包；之後可直接提交分析，或在剩餘輪次／項目數／位元組上限及先前摘要值守門下，再做一次由 Agent 指定的擴充。Threads 流程保留 `semantic-handoff.json`／`semantic-judgement.json`，形成已接受證據後直接等待版本 1 分析。

當分析已是合法下一步時，執行器結果會提供 `analysis_handoff`，列出本輪必須重新閱讀的 `input_paths`、要寫入的 `analysis.json` 路徑，以及目前證據摘要值。這個提示不是新的持久化狀態；新的 Agent 工作階段直接從目前分支上的交接檔案接手即可。GitHub 若再完成第二輪研究，必須使用更新後的 `analysis_evidence_digest` 重新整合，舊分析會被過期防護拒絕。完整交接契約見 [ingestion.md](./ingestion.md)。

## 私人網站

使用 `apps/server/.env.example` 建立伺服器端環境設定後，可啟動 Node 轉接器：

```bash
npm run site:serve
```

完整登入／工作階段／資料邊界見 [private-site.md](./private-site.md)。`createPrivateSiteApp` 可注入 `sessionStore`；預設記憶體儲存區只提供單一處理程序的參考執行環境。Vercel 部署由 `api/site.js` 與 `vercel.json` 提供，並要求 `KC_SESSION_STORE_REST_URL`／`KC_SESSION_STORE_REST_TOKEN` 共用 REST 工作階段儲存區；缺少它們時，部署維持 `unconfigured`。

## 生成資料與發布

本機或受控執行器可執行：

```bash
npm run generated:build -- /path/to/workspace --engine-sha=<E> --source-sha=<S> --generated-at=<iso> --mode=incremental
npm run release:finalize -- /path/to/workspace --engine-sha=<E> --source-sha=<S> --published-sha=<P> --release-id=<id> --created-at=<iso> --mode=incremental
npm run release:validate -- /path/to/workspace
```

生成資料契約見 [generated-data.md](./generated-data.md)；E／S／P、manifest、發布指標、過期防護與回復見 [release.md](./release.md)。

## GitHub Actions

- `.github/workflows/validate.yml`：Knowledge Card Engine pull request、`main` push 與手動執行；Node 24 + `npm ci` + `npm run validate`。
- `.github/workflows/validate-workspace.yml`：Knowledge Card Workspace 以固定 Engine SHA 呼叫的可重用工作流程；驗證 Workspace 版本鎖定、分類體系／Cards、已接受來源狀態與研究追溯狀態。
- `.github/workflows/release-workspace.yml`：Knowledge Card Workspace 以固定 Engine SHA 呼叫的可重用發布工作流程；固定 E／S、建立生成產物、建立僅含生成資料的 P、執行過期／版本鏈結守門、完成發布並更新目前發布指標。
- `.github/workflows/ingest-workspace.yml`：Workspace `chore/ingest-*` 分支呼叫的可重用 Remote Ingest 工作流程；Node.js 24 依請求來源供應者執行 GitHub 已接受證據加上 Agent 主導的受限研究擴充，或 Threads 已接受證據加上語意交接，並以過期防護、階段專屬允許變更路徑、Card／來源／研究狀態驗證限制正式寫入。

Knowledge Card Workspace 的驗證、發布與收錄薄層工作流程都必須用完整 SHA 固定同一個 `engine.lock.json.engine_commit`。驗證工作流程會逐一驗證三個可重用工作流程的版本鎖定；發布／收錄執行器也會在執行時再次驗證自己的呼叫端版本鎖定。

## 正式文件政策

正式 Knowledge Card Engine 文件必須在不依賴開發歷史的情況下完整描述目前系統：

- 只寫目前有效的架構、契約、操作與限制。
- 一般敘述使用自然繁體中文；官方專案／產品名稱、倉庫名稱、程式識別字、欄位、指令、路徑、錯誤碼、狀態值與不宜硬譯的標準名稱保留原文。
- `Workspace`、`Engine` 等詞必須先判斷是否指正式元件、倉庫名稱或一般概念，再決定保留原文或使用中文，不做機械式全文替換。
- 不保存 Roadmap、開發階段文件、task plan、archive、產品代際比較或過期設計。
- 不引用外部開發管理倉庫、舊 PR 或聊天紀錄作為理解目前執行行為的前置條件。
- 真正的機器契約版本，例如 `schema_version: 1`、`analysis_version: 1`，必須保留並說明驗證失敗即拒絕的行為。
- 文件與 Schema／執行行為／測試不一致時，視為缺陷並修正，不使用歷史敘事補足缺口。

倉庫檢查會掃描正式 Markdown 入口，阻擋已知產品代際、任務／開發階段歷史與外部開發歷史依賴重新進入正式文件。
