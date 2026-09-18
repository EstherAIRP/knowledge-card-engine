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

`validate` 目前包含：

1. `npm run check`：檢查必要骨架、synthetic Workspace / Taxonomy / Card 與 current-only 文件政策。
2. `npm test`：驗證模組、Workspace v1、Card v1、Taxonomy v1、ownership 與失敗案例。

指定 Workspace：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
```

GitHub Actions：

- `.github/workflows/validate.yml`：engine PR / main validation。
- `.github/workflows/validate-workspace.yml`：私人 Workspace 以固定 engine SHA 驗證 Workspace、Taxonomy 與 Cards。

## 文件原則

正式 engine 文件只描述現在實際存在的行為與介面。開發 Roadmap、Phase、任務計畫與歷史決策不存放於本倉庫。
