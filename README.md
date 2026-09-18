# Knowledge Card Engine

Knowledge Card V2 的公開核心引擎倉庫。真實私人知識資料存放於私人 `knowledge-card-workspace`，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前狀態

目前已建立：

- Node.js 24 / npm workspace 骨架。
- Workspace v1 契約與固定 engine SHA 驗證。
- **Knowledge Card v1 / Taxonomy v1 契約**。
- AI/user ownership、12 段正文、Card collection 唯一性與穩定路徑驗證。
- 可重用 Workspace CI，可驗 workspace、taxonomy 與 Cards。

目前尚未實作 URL canonicalization／來源 provider、登入授權、搜尋／圖譜或發布流程。

## 模組

- `apps/web`：私人閱覽前端邊界。
- `apps/server`：登入、授權與讀取 API 邊界。
- `packages/core`：已實作 Card v1、Taxonomy v1、ownership 與 collection validation。
- `packages/ingestion`：來源識別、擷取與完整性邊界；provider 尚未建立。
- `packages/analysis`：個人化分析與模型介面邊界。
- `packages/graph`：搜尋、向量、關聯與 Concept 邊界。
- `packages/workspace`：Workspace v1 載入、路徑安全與 engine pin 驗證。
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
```

正式文件入口：[docs/index.md](./docs/index.md)。Card 契約：[docs/card-contract.md](./docs/card-contract.md)。Workspace 契約：[docs/workspace.md](./docs/workspace.md)。

## 資料邊界

公開範例與測試只能使用合成資料。`examples/synthetic-workspace/` 含 synthetic Workspace / Taxonomy / Card，並明確標記不含私人資料。
