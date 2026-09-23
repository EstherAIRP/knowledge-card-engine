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
2. `npm test`：Node tests，涵蓋 Workspace、Card、Taxonomy、analysis / research contract、GitHub accepted / research evidence、research provenance persistence / ownership / state binding、Threads ingestion、source-state atomicity、private login / authorization、Web UI layout contract，以及 generated-data / release / release-reader 一致性案例。

Web UI layout contract 可單獨執行：

```bash
npm run ui:verify
```

此檢查驗 design token、style ownership、page / reading width、主要 responsive breakpoint、Graph presentation / runtime 邊界與 shell style composition。完整 UI 架構見 [web-ui.md](./web-ui.md)。

## Workspace 驗證

指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

若要同時驗證 engine pin 與薄層 workflow：

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

兩者都可用 `--evidence-file=accepted-evidence.json` 注入已取得且仍需驗證的 evidence。GitHub CLI 否則透過 GitHub API 即時取得 metadata + README；需要授權時使用環境變數 `GITHUB_TOKEN`。Threads CLI 只有在結構證據可證明來源完整時接受，不提供語意續篇猜測。密鑰不可提交。

來源 writer 的資料與 ownership 前置條件見 [ingestion.md](./ingestion.md) 與 [card-contract.md](./card-contract.md)。

受控 Remote Ingest runner 使用：

```bash
npm run ingest:handoff -- /path/to/workspace --result-file=/tmp/ingest-result.json
```

`npm run ingest:github:handoff` 保留為相容 alias。

此 CLI 固定讀取 configured state root 下的 `ingestion/request.json`、`evidence.json`、`analysis.json`，不接受任意 handoff 路徑。沒有 evidence 時只準備 accepted evidence；已有 evidence 與 analysis 時才呼叫正式 writer。完整 handoff 契約見 [ingestion.md](./ingestion.md)。

## 私人網站

使用 `apps/server/.env.example` 建立 server-side environment 後，可啟動 Node adapter：

```bash
npm run site:serve
```

完整 login/session/data boundary 見 [private-site.md](./private-site.md)。`createPrivateSiteApp` 可注入 `sessionStore`；預設 memory store 只提供單 process reference runtime。Vercel deployment 由 `api/site.js` + `vercel.json` 提供，並要求 `KC_SESSION_STORE_REST_URL` / `KC_SESSION_STORE_REST_TOKEN` shared REST session store；缺少它們時 deployment 保持 unconfigured。

## Generated data 與 release

本機或受控 runner 可執行：

```bash
npm run generated:build -- /path/to/workspace --engine-sha=<E> --source-sha=<S> --generated-at=<iso> --mode=incremental
npm run release:finalize -- /path/to/workspace --engine-sha=<E> --source-sha=<S> --published-sha=<P> --release-id=<id> --created-at=<iso> --mode=incremental
npm run release:validate -- /path/to/workspace
```

Generated-data 契約見 [generated-data.md](./generated-data.md)，E／S／P、manifest、pointer、stale guard 與 rollback 見 [release.md](./release.md)。

## GitHub Actions

- `.github/workflows/validate.yml`：engine pull request、`main` push 與手動執行；Node 24 + `npm ci` + `npm run validate`。
- `.github/workflows/validate-workspace.yml`：Workspace 以固定 engine SHA 呼叫的 reusable workflow；驗 Workspace pin、Taxonomy / Cards、accepted source state 與 research provenance state。
- `.github/workflows/release-workspace.yml`：Workspace 以固定 engine SHA 呼叫的 reusable release workflow；固定 E/S、建立 generated artifacts、建立 generated-only P、執行 stale/lineage guards、finalize release 並更新 current pointer。
- `.github/workflows/ingest-workspace.yml`：Workspace `chore/ingest-*` 分支呼叫的 reusable Remote Ingest workflow；Node.js 24 依 request provider 執行 GitHub / Threads accepted-evidence prepare 或 writer apply，並以 stale guard 與 changed-path allowlist 限制寫入。

Workspace 的 validation、release 與 ingestion 薄層 workflow 都必須用完整 SHA pin 同一個 `engine.lock.json.engine_commit`。Validation workflow 會逐一驗證三個 reusable workflow pin；release / ingestion runner 也會在執行時再次驗自己的 caller pin。

## 正式文件政策

正式 engine 文件必須能在不依賴開發歷史的情況下描述目前系統：

- 只寫現在有效的架構、契約、操作與限制。
- 不保存 Roadmap、開發階段文件、task plan、archive、產品代際比較或過期設計。
- 不引用外部開發管理 repository、舊 PR 或聊天紀錄作為理解目前 runtime 的前置條件。
- 真正的機器契約版本（例如 `schema_version: 1`、`analysis_version: 1`）必須保留並說明 fail-closed 行為。
- 文件與 Schema/runtime/tests 不一致時，視為缺陷並修正，不用歷史敘事補足缺口。

Repository check 會掃描正式 Markdown 入口，阻擋已知產品代際、任務／開發階段歷史與外部開發歷史依賴重新進入正式文件。
