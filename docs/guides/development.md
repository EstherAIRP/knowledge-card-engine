# 開發與驗證

本指南整理 Knowledge Card Engine 的常用開發、驗證與執行方式。功能規則、資料契約與安全邊界仍以對應的正式規格為準；這裡只說明如何執行目前已有的工具與工作流程。

## 工具鏈

- Node.js 24
- npm workspaces
- ESM
- `package-lock.json` 納入版本控制

安裝依賴：

```bash
npm ci
```

執行 Engine 全套驗證：

```bash
npm run validate
```

`npm run validate` 會先執行倉庫檢查，再執行完整 Node 測試。倉庫檢查涵蓋必要檔案、合成測試資料與正式文件政策；測試則涵蓋 Workspace、Knowledge Card、來源收錄、分析與研究、私人網站、網頁介面、生成資料與發布等目前契約。

共用合成 Workspace 位於 `tests/fixtures/synthetic-workspace/`。它只供自動化測試使用，不是使用者範本，也不得加入私人資料。

## 單獨執行常用驗證

驗證網頁介面版面契約：

```bash
npm run ui:verify
```

驗證指定 Knowledge Card Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

若要連同 Engine 版本鎖定與 Workspace 的薄層工作流程一起驗證：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/validate.yml
```

Workspace 結構與版本鎖定見 [Knowledge Card Workspace 契約](../specs/workspace.md)；Card 結構與所有權見 [Knowledge Card 契約](../specs/card.md)。

## 來源收錄

直接收錄 GitHub：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo \
  --analysis-file=analysis.json
```

直接收錄 Threads：

```bash
npm run ingest:threads -- /path/to/workspace https://threads.com/share/token \
  --analysis-file=analysis.json
```

兩者都可用 `--evidence-file=accepted-evidence.json` 提供已取得、但仍需由 Engine 重新驗證的來源證據。GitHub 即時擷取需要授權時使用 `GITHUB_TOKEN`；密鑰不得提交到 Git。

受控 Remote Ingest 使用：

```bash
npm run ingest:handoff -- /path/to/workspace --result-file=/tmp/ingest-result.json
```

`npm run ingest:github:handoff` 保留為相容別名。

Remote Ingest 只讀取 Workspace 狀態目錄中的固定交接檔，並依執行結果指出下一個合法步驟。Agent 應直接依目前分支上的交接資料接手，不自行建立另一套收錄或寫入流程。

來源支援範圍、已接受證據、GitHub 受控擷取、Threads 完整性與交接規則見 [來源收錄契約](../specs/ingestion.md)；研究計畫、分析證據與分析版本見 [分析與研究契約](../specs/analysis.md)。

## 私人網站

使用 `apps/server/.env.example` 建立本機伺服器設定後，啟動 Node HTTP 轉接器：

```bash
npm run site:serve
```

登入、工作階段、私人 API、Workspace 資格與正式部署限制見 [私人網站與授權契約](../specs/private-site.md)；介面與版面契約見 [網頁介面與版面配置](../specs/web-ui.md)。

## 生成資料與發布

建立生成資料：

```bash
npm run generated:build -- /path/to/workspace \
  --engine-sha=<E> \
  --source-sha=<S> \
  --generated-at=<iso> \
  --mode=incremental
```

完成發布：

```bash
npm run release:finalize -- /path/to/workspace \
  --engine-sha=<E> \
  --source-sha=<S> \
  --published-sha=<P> \
  --release-id=<id> \
  --created-at=<iso> \
  --mode=incremental
```

驗證目前發布資料：

```bash
npm run release:validate -- /path/to/workspace
```

搜尋、向量、關聯、Concept 與 Graph 的資料契約見 [生成資料、搜尋與圖譜契約](../specs/generated-data.md)；E／S／P、資訊清單、發布指標與回復規則見 [一致發布契約](../specs/release.md)。

## GitHub Actions

| Workflow | 用途 |
| --- | --- |
| `.github/workflows/validate.yml` | Engine PR、`main` 推送與手動執行的完整驗證。 |
| `.github/workflows/validate-workspace.yml` | Workspace 以固定 Engine SHA 呼叫的可重用驗證流程。 |
| `.github/workflows/release-workspace.yml` | Workspace 以固定 Engine SHA 建立生成資料並完成一致發布。 |
| `.github/workflows/ingest-workspace.yml` | Workspace `chore/ingest-*` 分支使用的受控 Remote Ingest。 |

Workspace 的驗證、收錄與發布流程都必須使用 `engine.lock.json.engine_commit` 指定的完整 Engine SHA。不要從其他 Engine 版本混用 CLI、Schema 或工作流程。

## 遇到失敗時

先依失敗發生的層級查閱對應規格與測試：

- Workspace 或 Card 驗證：`docs/specs/workspace.md`、`docs/specs/card.md`。
- 來源取得或交接：`docs/specs/ingestion.md`。
- 研究、分析或證據綁定：`docs/specs/analysis.md`。
- 搜尋、關聯或圖譜資料：`docs/specs/generated-data.md`。
- 發布版本：`docs/specs/release.md`。
- 登入、私人 API 或伺服器讀取：`docs/specs/private-site.md`。
- 網頁介面：`docs/specs/web-ui.md`。

倉庫修改、分支、PR 與文件治理規則見 [`AGENTS.md`](../../AGENTS.md)；完整文件導航見 [`docs/index.md`](../index.md)。
