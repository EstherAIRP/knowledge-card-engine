# Knowledge Card Engine

Knowledge Card Engine 是 Knowledge Card 的公開核心程式倉庫。它提供 Workspace、Knowledge Card、來源收錄、分析資料契約、驗證與共用自動化；真實私人知識資料保存在私人 Workspace，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前可用能力

目前已實作：

- Node.js 24 / npm workspaces 工具鏈。
- Workspace 契約、目錄安全檢查與固定 engine commit 驗證。
- Knowledge Card 結構、Taxonomy、AI/user ownership、正文、集合唯一性與穩定路徑驗證。
- GitHub Repository canonicalization、repository metadata + README accepted evidence，以及固定 default-branch commit 的 bounded research candidate discovery / selected primary-source evidence bundle。
- Threads post/share URL resolution、公開 browser fallback、根貼文 identity，以及結構完整或受控高信心語意復原的 accepted evidence。
- 與 accepted source evidence 綁定的 analysis version 1，以及 GitHub revision-pinned research evidence、structured findings / coverage quality gate 可使用的 analysis version 2；Workspace writer 可一致寫入 GitHub v2 Card、accepted source state 與 compact research provenance。
- 依 source identity / canonical URL 判斷 create 或 update。
- 保護 user/stable-owned state 的 Workspace writer。
- GitHub / Threads accepted source state 與 Card 對應驗證；Threads state 只保存來源指紋，不保存原文。
- reusable Workspace CI，可驗 Workspace pin、Taxonomy、Cards、accepted source state 與 research provenance state。
- Provider-aware Remote Ingest handoff，可在 `chore/ingest-*` Workspace 分支以 pinned Engine、Node.js 24 取得 GitHub 或 Threads accepted evidence；Threads 需要語意 continuation 判定時先建立 digest-bound handoff，再於 evidence-bound analysis 回填後由正式 writer 完成 Card/source-state 寫入。
- GitHub App state + PKCE 登入、server-side session、每 request Workspace 資格重查。
- GitHub App installation token 私人 Card list/detail API 與唯讀 web shell。
- Deterministic search、lexical vector、typed relation、Concept 與 graph generated artifacts。
- E／S／P + manifest 一致發布、stale guard、release-pinned private reader 與 rollback pointer model。
- Authenticated `/api/search`、`/api/graph`、`/api/release` 與對應 UI。
- Portable Node HTTP adapter，以及 Vercel Node Function adapter；Vercel 需 shared REST session store。

目前尚未實作 GitHub / Threads 之外的來源 provider、外部 embedding / model provider、非 Redis REST 的 shared durable session backend，以及 Vercel 之外的 hosting-specific adapter；這些邊界不能視為可用功能。

## 模組責任

- `apps/web`：私人 Card list/detail、搜尋、關聯／Concept 與 graph UI shell。
- `apps/server`：GitHub App 登入、session、authorization、release-pinned Workspace reader 與 Card/search/graph/release API。
- `packages/core`：Card / Taxonomy parsing、結構與受控值驗證、ownership、正文契約、collection uniqueness 與 stable path。
- `packages/ingestion`：來源 canonicalization、GitHub / Threads accepted evidence、GitHub revision-pinned research candidate / selected evidence capture、create/update resolution 與 provider-specific source-state contract。
- `packages/analysis`：provider-neutral analysis result、research plan、analysis evidence bundle 與 structured research report contract。
- `packages/graph`：deterministic search、lexical vector、typed relation、Concept 與 graph generated-data builder / validator。
- `packages/workspace`：Workspace loader、engine pin 與經驗證的 Card / source-state / research-state transactional 寫入。
- `packages/release`：E／S／P、manifest、release pointer / description 與 published lineage 驗證。

架構與責任邊界詳見 [docs/architecture.md](./docs/architecture.md)。

## Workspace 與資料契約

Workspace root 必須明確指定，並包含 `workspace.yaml`、`engine.lock.json` 與契約要求的標準目錄。Workspace 不自動追隨 engine `main`；核准 engine 由完整 40 位 commit SHA 固定。

Knowledge Card 的 frontmatter 結構由公開 Schema 定義；Workspace 的 `config/taxonomy.yaml` 定義受控詞彙。一般重新分析可以更新 AI-owned 內容，但不得修改穩定 `id`、`created_at`、任何 user override 或完整 `## 使用者備註`。

完整契約：

- [Runtime 執行契約](./prompts/RUNTIME.md)
- [Workspace 契約](./docs/workspace.md)
- [Knowledge Card 契約](./docs/card-contract.md)
- [來源收錄契約](./docs/ingestion.md)
- [Analysis 與 Research 契約](./docs/analysis.md)
- [生成資料、搜尋與圖譜契約](./docs/generated-data.md)
- [一致發布契約](./docs/release.md)
- [私人網站與授權契約](./docs/private-site.md)
- [Web UI 與 Layout](./docs/web-ui.md)

## 開發與驗證

需求：Node.js 24。

```bash
npm ci
npm run validate
```

`npm run validate` 會執行 repository policy check 與 Node tests。Web UI layout contract 可另外用 `npm run ui:verify` 單獨執行。Generated data / release CLI 另提供 `npm run generated:build`、`npm run release:finalize` 與 `npm run release:validate`；Workspace automation 使用 reusable `release-workspace.yml`。

驗證指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

來源 ingestion CLI：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo --analysis-file=analysis.json
npm run ingest:threads -- /path/to/workspace https://threads.com/share/token --analysis-file=analysis.json
```

CLI 可即時取得 provider-specific evidence，或用 `--evidence-file` 注入已取得、仍會再次驗證的 accepted evidence。GitHub 需要授權時使用環境變數 `GITHUB_TOKEN`；Threads 必須通過 strict structural verification，或在限定 continuation uncertainty 下通過受控語意 judgement 與 deterministic acceptance gates。密鑰不得寫入 repository。

啟動私人 Node HTTP adapter：

```bash
npm run site:serve
```

正式部署需要設定 GitHub App / Workspace environment；多 instance 或 serverless 平台必須使用 shared server-side session store。Vercel adapter 使用 `KC_SESSION_STORE_REST_URL` / `KC_SESSION_STORE_REST_TOKEN`。完整契約見 [docs/private-site.md](./docs/private-site.md)。

完整開發說明見 [docs/development.md](./docs/development.md)，正式文件入口見 [docs/index.md](./docs/index.md)。

## 公私資料邊界

公開測試、範例與 fixture 只能使用明確標示的合成資料。`examples/synthetic-workspace/` 用來驗證 Workspace、Taxonomy、Card、source-state 與 research-state 契約，不得放入真實私人 Card、profile、project、來源快照、向量或其他衍生私人資料。
