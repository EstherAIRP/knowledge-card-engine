# Knowledge Card Engine

Knowledge Card Engine 是 Knowledge Card 的公開核心程式倉庫。它提供 Workspace、Knowledge Card、來源收錄、分析資料契約、驗證與共用自動化；真實私人知識資料保存在私人 Workspace，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前可用能力

目前已實作：

- Node.js 24 / npm workspaces 工具鏈。
- Workspace 契約、目錄安全檢查與固定 engine commit 驗證。
- Knowledge Card 結構、Taxonomy、AI/user ownership、正文、集合唯一性與穩定路徑驗證。
- GitHub Repository URL canonicalization、repository metadata + README accepted evidence。
- 與 accepted evidence digest 綁定的 analysis result 契約。
- 依 source identity / canonical URL 判斷 create 或 update。
- 保護 user/stable-owned state 的 Workspace writer。
- GitHub accepted source state 與 Card 對應驗證。
- reusable Workspace CI，可驗 Workspace pin、Taxonomy、Cards 與 source state。
- GitHub App state + PKCE 登入、server-side session、每 request Workspace 資格重查。
- GitHub App installation token 私人 Card list/detail API 與唯讀 web shell。
- Deterministic search、lexical vector、typed relation、Concept 與 graph generated artifacts。
- E／S／P + manifest 一致發布、stale guard、release-pinned private reader 與 rollback pointer model。
- Authenticated `/api/search`、`/api/graph`、`/api/release` 與對應 UI。
- Portable Node HTTP adapter，以及 Vercel Node Function adapter；Vercel 需 shared REST session store。

目前尚未實作其他來源 provider、外部 embedding / model provider、非 Redis REST 的 shared durable session backend，以及 Vercel 之外的 hosting-specific adapter；這些邊界不能視為可用功能。

## 模組責任

- `apps/web`：目前的私人唯讀 Card list/detail UI shell。
- `apps/server`：GitHub App 登入、session、authorization、私人 Workspace reader 與 Card API。
- `packages/core`：Card / Taxonomy parsing、結構與受控值驗證、ownership、正文契約、collection uniqueness 與 stable path。
- `packages/ingestion`：來源 canonicalization、GitHub evidence、create/update resolution 與 GitHub source-state contract。
- `packages/analysis`：與來源 evidence 綁定的 provider-neutral analysis result contract。
- `packages/graph`：搜尋、向量、關聯與 Concept 的模組邊界；目前未實作演算法。
- `packages/workspace`：Workspace loader、engine pin 與經驗證的 Card / source-state 寫入。
- `packages/release`：manifest 與一致發布的模組邊界；目前未實作發布模型。

架構與責任邊界詳見 [docs/architecture.md](./docs/architecture.md)。

## Workspace 與資料契約

Workspace root 必須明確指定，並包含 `workspace.yaml`、`engine.lock.json` 與契約要求的標準目錄。Workspace 不自動追隨 engine `main`；核准 engine 由完整 40 位 commit SHA 固定。

Knowledge Card 的 frontmatter 結構由公開 Schema 定義；Workspace 的 `config/taxonomy.yaml` 定義受控詞彙。一般重新分析可以更新 AI-owned 內容，但不得修改穩定 `id`、`created_at`、任何 user override 或完整 `## 使用者備註`。

完整契約：

- [Workspace 契約](./docs/workspace.md)
- [Knowledge Card 契約](./docs/card-contract.md)
- [GitHub 收錄契約](./docs/ingestion.md)
- [私人網站與授權契約](./docs/private-site.md)

## 開發與驗證

需求：Node.js 24。

```bash
npm ci
npm run validate
```

`npm run validate` 會執行 repository policy check 與 Node tests。

驗證指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
```

GitHub ingestion CLI：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo --analysis-file=analysis.json
```

CLI 可即時取得 GitHub metadata + README，或用 `--evidence-file` 注入已取得、仍會再次驗證的 accepted evidence。需要 GitHub 授權時使用環境變數 `GITHUB_TOKEN`；密鑰不得寫入 repository。

啟動私人 Node HTTP adapter：

```bash
npm run site:serve
```

正式部署需要設定 GitHub App / Workspace environment；多 instance 或 serverless 平台必須使用 shared server-side session store。Vercel adapter 使用 `KC_SESSION_STORE_REST_URL` / `KC_SESSION_STORE_REST_TOKEN`。完整契約見 [docs/private-site.md](./docs/private-site.md)。

完整開發說明見 [docs/development.md](./docs/development.md)，正式文件入口見 [docs/index.md](./docs/index.md)。

## 公私資料邊界

公開測試、範例與 fixture 只能使用明確標示的合成資料。`examples/synthetic-workspace/` 用來驗證 Workspace、Taxonomy、Card 與 source-state 契約，不得放入真實私人 Card、profile、project、來源快照、向量或其他衍生私人資料。
