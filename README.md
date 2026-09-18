# Knowledge Card Engine

Knowledge Card V2 的公開核心引擎倉庫。真實私人知識資料存放於私人 `knowledge-card-workspace`，不得進入本公開倉庫、PR、測試、日誌或建置產物。

## 目前狀態

目前已建立可執行的 engine skeleton：Node.js 24、npm workspaces、模組邊界、合成 workspace fixture、repository check、Node tests 與 GitHub Actions validation。

目前**尚未**實作 Card Schema、Workspace 契約、來源收錄、登入授權、搜尋／圖譜或發布流程；正式文件不把尚未完成的功能描述成可用。

## 模組

- `apps/web`：私人閱覽前端邊界。
- `apps/server`：登入、授權與讀取 API 邊界。
- `packages/core`：Card 模型、驗證與所有權邊界。
- `packages/ingestion`：來源識別、擷取與完整性邊界。
- `packages/analysis`：個人化分析與模型介面邊界。
- `packages/graph`：搜尋、向量、關聯與 Concept 邊界。
- `packages/workspace`：工作區讀寫與版本解析邊界。
- `packages/release`：manifest 與一致發布邊界。

這些 entrypoint 目前只用來固定責任邊界，尚未承載領域行為。

## 開發

需求：Node.js 24。

```bash
npm ci
npm run validate
```

`validate` 會執行 repository policy check 與 Node tests。GitHub Actions 在 pull request 與 `main` push 執行相同驗證。

正式文件入口：[docs/index.md](./docs/index.md)。開發規則：[AGENTS.md](./AGENTS.md)。

## 資料邊界

公開範例與測試只能使用合成資料。`examples/synthetic-workspace/` 明確標記為 synthetic，且不是正式 Workspace Schema；正式 workspace contract 會在後續實作時定義。
