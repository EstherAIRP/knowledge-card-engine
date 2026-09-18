# 開發與驗證

## 工具鏈

- Node.js 24
- npm workspaces
- ESM
- `package-lock.json` 納入版本控制

```bash
npm ci
npm run validate
```

`validate` 目前包含 repository check 與 Node tests，涵蓋 Workspace、Card、Taxonomy、GitHub ingestion、ownership 與失敗案例。

指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
```

GitHub 收錄：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo --analysis-file=analysis.json
```

可用 `--evidence-file=accepted-evidence.json` 注入已取得且仍需驗證的 evidence；否則 CLI 透過 GitHub API 即時取得 metadata + README。需要授權時使用環境變數 `GITHUB_TOKEN`，不可提交 token。

GitHub Actions：

- `.github/workflows/validate.yml`：engine PR / main validation。
- `.github/workflows/validate-workspace.yml`：私人 Workspace 以固定 engine SHA 驗 Workspace、Taxonomy、Cards 與 accepted source state。

## 文件原則

正式 engine 文件只描述現在實際存在的行為與介面。開發 Roadmap、Phase、任務計畫與歷史決策不存放於本倉庫。
