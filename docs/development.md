# 開發與驗證

## 工具鏈

- Node.js 24
- npm workspaces
- ESM
- `package-lock.json` 納入版本控制

安裝並執行 engine 全套驗證：

```bash
npm ci
npm run validate
```

`npm run validate` 目前等於：

1. `npm run check`：必要檔案、合成 fixture、current-only 文件政策與 repository-level contract check。
2. `npm test`：Node tests，涵蓋 Workspace、Card、Taxonomy、GitHub ingestion、ownership、source-state atomicity、private login / authorization，以及 generated-data / release / release-reader 一致性案例。

## Workspace 驗證

指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
```

若要同時驗證 engine pin 與薄層 workflow：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/validate.yml
```

## GitHub 收錄

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo \
  --analysis-file=analysis.json
```

可用 `--evidence-file=accepted-evidence.json` 注入已取得且仍需驗證的 evidence；否則 CLI 透過 GitHub API 即時取得 metadata + README。需要授權時使用環境變數 `GITHUB_TOKEN`，不可提交 token。

GitHub writer 的資料與 ownership 前置條件見 [ingestion.md](./ingestion.md) 與 [card-contract.md](./card-contract.md)。

## 私人網站

使用 `apps/server/.env.example` 建立 server-side environment 後，可啟動 Node adapter：

```bash
npm run site:serve
```

完整 login/session/data boundary 見 [private-site.md](./private-site.md)。`createPrivateSiteApp` 可注入 `sessionStore`；預設 memory store 只提供單 process reference runtime。Vercel deployment 由 `api/site.js` + `vercel.json` 提供，並要求 `KC_SESSION_STORE_REST_URL` / `KC_SESSION_STORE_REST_TOKEN` shared REST session store；缺少它們時 deployment 保持 unconfigured。

## GitHub Actions

- `.github/workflows/validate.yml`：engine pull request、`main` push 與手動執行；Node 24 + `npm ci` + `npm run validate`。
- `.github/workflows/validate-workspace.yml`：Workspace 以固定 engine SHA 呼叫的 reusable workflow；驗 Workspace pin、Taxonomy / Cards 與 accepted source state。

Reusable workflow 只需要 `contents: read`，並 checkout Workspace 與指定 engine SHA；私人 Workspace 的 workflow pin 必須和 `engine.lock.json` 一致。

## 正式文件政策

正式 engine 文件必須能在不依賴開發歷史的情況下描述目前系統：

- 只寫現在有效的架構、契約、操作與限制。
- 不保存 Roadmap、開發階段文件、task plan、archive、產品代際比較或過期設計。
- 不引用外部開發管理 repository、舊 PR 或聊天紀錄作為理解目前 runtime 的前置條件。
- 真正的機器契約版本（例如 `schema_version: 1`、`analysis_version: 1`）必須保留並說明 fail-closed 行為。
- 文件與 Schema/runtime/tests 不一致時，視為缺陷並修正，不用歷史敘事補足缺口。

Repository check 會掃描正式 Markdown 入口，阻擋已知產品代際、任務／開發階段歷史與外部開發歷史依賴重新進入正式文件。
