# Knowledge Card Engine

Knowledge Card V2 的公開核心引擎倉庫。真實私人知識資料存放於私人 `knowledge-card-workspace`，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前狀態

目前已建立：

- Node.js 24 / npm workspace 骨架。
- Workspace v1 契約與固定 engine SHA 驗證。
- Knowledge Card v1 / Taxonomy v1 契約。
- Card ownership、正文、collection uniqueness 與 stable path 驗證。
- GitHub Repository canonicalization、metadata + README evidence provider。
- evidence-bound analysis contract。
- create/update resolver、ownership-safe Workspace writer 與 accepted source state。
- reusable Workspace CI，可驗 workspace、taxonomy、Cards 與 source state。

目前尚未實作其他來源 provider、登入授權、搜尋／圖譜或發布流程。

## 模組

- `apps/web`：私人閱覽前端邊界。
- `apps/server`：登入、授權與讀取 API 邊界。
- `packages/core`：Card v1、Taxonomy v1、ownership 與 collection validation。
- `packages/ingestion`：GitHub canonicalization、provider evidence、create/update resolution、source state contract。
- `packages/analysis`：provider-neutral evidence-bound analysis result contract。
- `packages/graph`：搜尋、向量、關聯與 Concept 邊界。
- `packages/workspace`：Workspace loader、engine pin 與 ownership-safe Card persistence。
- `packages/release`：manifest 與一致發布邊界。

## 開發

需求：Node.js 24。

```bash
npm ci
npm run validate
```

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

正式文件入口：[docs/index.md](./docs/index.md)。

## 資料邊界

公開範例與測試只能使用合成資料。`examples/synthetic-workspace/` 僅含 synthetic Workspace / Taxonomy / Card / source state。
