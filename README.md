# Knowledge Card Engine

Knowledge Card Engine 是 Knowledge Card 的公開核心程式倉庫。它提供 Knowledge Card Workspace 所需的共用程式、來源收錄、分析資料契約、驗證與自動化；真實私人知識資料保存在私人 Knowledge Card Workspace，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前可用能力

目前已實作：

- Node.js 24 與 npm workspaces 工具鏈。
- Knowledge Card Workspace 契約、目錄安全檢查與固定 Knowledge Card Engine 提交版本驗證。
- Knowledge Card 結構、分類體系、AI／使用者所有權、正文、集合唯一性與穩定路徑驗證。
- GitHub 倉庫網址正規化、倉庫中繼資料與 README 已接受證據，以及固定預設分支提交的受限研究探索、Agent 選定安全倉庫路徑、最多兩輪與摘要值綁定的證據擴充，以及累積第一手來源證據包。
- Threads 貼文／分享網址解析、公開瀏覽器備援、根貼文來源識別，以及結構完整或受控高信心語意復原的已接受證據。
- 與已接受來源證據綁定的 `analysis_version: 1`，以及固定 GitHub 倉庫版本的研究證據、結構化研究結果與覆蓋品質門檻所使用的 `analysis_version: 2`；Knowledge Card Workspace 寫入器可一致寫入 GitHub `analysis_version: 2` Knowledge Card、已接受來源狀態與精簡研究追溯資訊。
- 依來源識別與標準網址判定新建或更新。
- 保護使用者管理狀態與穩定狀態的 Knowledge Card Workspace 寫入器。
- GitHub／Threads 已接受來源狀態與 Knowledge Card 對應驗證；Threads 狀態只保存來源指紋，不保存原文。
- 可重用的 Knowledge Card Workspace 驗證工作流程，可驗證工作區版本鎖定、分類體系、Knowledge Card、已接受來源狀態與研究追溯狀態。
- 依來源供應者分流的 Remote Ingest 交接，可在 `chore/ingest-*` Knowledge Card Workspace 分支以固定 Knowledge Card Engine、Node.js 24 執行 GitHub／Threads 已接受證據流程。GitHub 會固定倉庫版本、建立受限探索與第 0 輪研究狀態，先等待 Agent 提交與摘要值綁定的 `research-plan.json` 及選定路徑；執行器只在同一版本擷取經驗證的安全第一手文字來源。第一輪證據包形成後，Agent 可提交 `analysis_version: 2`，或在剩餘額度內再做一次由 Agent 指定的擴充，最後交給正式寫入器寫入 Knowledge Card、來源狀態與研究狀態；Threads 保留與摘要值綁定的語意續篇交接及版本 1 寫入流程。
- GitHub App `state` 與 PKCE 登入、伺服器端工作階段，以及每次請求重新驗證 Knowledge Card Workspace 資格。
- GitHub App 安裝存取權杖、私人 Knowledge Card 列表／詳細資料 API 與唯讀網頁外殼。
- 搜尋、向量、具型別關聯、Concept 與圖譜生成產物；實際向量／關聯方法由生成產物的 provenance 與正式 generated-data 契約辨識，不把特定 fallback 實作當成永久能力定義。
- E／S／P 與資訊清單的一致發布、過期防護、固定於發布版本的私人讀取器，以及回復指標模型。
- 需授權的 `/api/search`、`/api/graph`、`/api/release` 與對應 UI。
- 可移植的 Node HTTP 轉接器，以及 Vercel Node Function 轉接器；Vercel 需要共用 REST 工作階段儲存區。

目前尚未實作 GitHub／Threads 以外的來源供應者、非 Redis REST 的共用持久工作階段後端，以及 Vercel 以外的託管平台專用轉接器；這些邊界不能視為可用功能。向量／關聯的實際 provider、method 與能力邊界以生成產物 provenance 與正式 generated-data 契約為準。

## 模組責任

- `apps/web`：私人 Knowledge Card 列表／詳細資料、搜尋、關聯／Concept 與圖譜介面外殼。
- `apps/server`：GitHub App 登入、工作階段、授權、固定於發布版本的 Knowledge Card Workspace 讀取器，以及 Knowledge Card／搜尋／圖譜／發布 API。
- `packages/core`：Knowledge Card／分類體系解析、結構與受控值驗證、所有權、正文契約、集合唯一性與穩定路徑。
- `packages/ingestion`：來源網址正規化、GitHub／Threads 已接受證據、固定 GitHub 倉庫版本的研究探索、Agent 選定安全路徑後的證據擷取與受限擴充、新建／更新解析，以及來源供應者專屬的來源狀態契約。
- `packages/analysis`：與來源供應者無關的分析結果、研究計畫、分析證據包與結構化研究報告契約。
- `packages/graph`：搜尋、向量、具型別關聯、Concept，以及圖譜生成資料的建立器與驗證器；具體 relation／vector 方法不是 README 的永久契約。
- `packages/workspace`：Knowledge Card Workspace 載入器、Knowledge Card Engine 版本鎖定，以及經驗證的 Knowledge Card／來源狀態／研究狀態交易式寫入。
- `packages/release`：E／S／P、資訊清單、發布指標／描述與已發布版本鏈結驗證。

架構與責任邊界詳見 [docs/architecture.md](./docs/architecture.md)。

## Knowledge Card Workspace 與資料契約

工作區根目錄必須明確指定，並包含 `workspace.yaml`、`engine.lock.json` 與契約要求的標準目錄。Knowledge Card Workspace 不會自動追隨 Knowledge Card Engine 的 `main`；核准的 Knowledge Card Engine 由完整 40 位提交 SHA 固定。

Knowledge Card 的前置中繼資料（frontmatter）結構由公開結構規格定義；Knowledge Card Workspace 的 `config/taxonomy.yaml` 定義受控詞彙。一般重新分析可以更新 AI 管理內容，但不得修改穩定 `id`、`created_at`、任何使用者覆寫或完整 `## 使用者備註`。

完整契約：

- [執行契約](./prompts/RUNTIME.md)
- [Knowledge Card 知識編輯提示](./prompts/KNOWLEDGE_EDITOR.md)
- [Knowledge Card 寫作樣式](./prompts/CARD_STYLE.md)
- [Knowledge Card Workspace 契約](./docs/workspace.md)
- [Knowledge Card 契約](./docs/card-contract.md)
- [來源收錄契約](./docs/ingestion.md)
- [分析與研究契約](./docs/analysis.md)
- [生成資料、搜尋與圖譜契約](./docs/generated-data.md)
- [一致發布契約](./docs/release.md)
- [私人網站與授權契約](./docs/private-site.md)
- [Web UI 與版面配置](./docs/web-ui.md)

## 開發與驗證

需求：Node.js 24。

```bash
npm ci
npm run validate
```

`npm run validate` 會執行倉庫政策檢查與 Node 測試。網頁介面版面契約可另外用 `npm run ui:verify` 單獨執行。生成資料／發布命令列工具另提供 `npm run generated:build`、`npm run release:finalize` 與 `npm run release:validate`；Knowledge Card Workspace 自動化使用可重用的 `release-workspace.yml`。

驗證指定 Knowledge Card Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

來源收錄命令列工具：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo --analysis-file=analysis.json
npm run ingest:threads -- /path/to/workspace https://threads.com/share/token --analysis-file=analysis.json
```

命令列工具可即時取得來源類型專屬證據，或用 `--evidence-file` 注入已取得、仍會再次驗證的已接受證據。GitHub 需要授權時使用環境變數 `GITHUB_TOKEN`；Threads 必須通過嚴格結構驗證，或在限定的續篇不確定性下通過受控語意判定與確定性接受門檻。密鑰不得寫入倉庫。

啟動私人 Node HTTP 轉接器：

```bash
npm run site:serve
```

正式部署需要設定 GitHub App／Knowledge Card Workspace 環境變數；多執行個體或無伺服器平台必須使用共用伺服器端工作階段儲存區。Vercel 轉接器使用 `KC_SESSION_STORE_REST_URL`／`KC_SESSION_STORE_REST_TOKEN`。完整契約見 [docs/private-site.md](./docs/private-site.md)。

完整開發說明見 [docs/development.md](./docs/development.md)，正式文件入口見 [docs/index.md](./docs/index.md)。

## 公私資料邊界

公開測試與合成測試資料只能使用明確標示的合成內容。`tests/fixtures/synthetic-workspace/` 是共用 Knowledge Card Workspace 契約測試樣本，不是使用者範例或 Knowledge Card Workspace 範本；用來驗證工作區、分類體系、Knowledge Card、來源狀態與研究狀態契約，不得放入真實私人 Knowledge Card、`profile/`、`projects/`、來源快照、向量或其他衍生私人資料。
