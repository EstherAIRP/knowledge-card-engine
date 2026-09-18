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

1. `npm run check`：檢查必要骨架、Workspace synthetic fixture、current-only 文件政策。
2. `npm test`：驗證模組 entrypoint 與 Workspace v1 正向／失敗案例。

指定 Workspace 可使用：

```bash
npm run workspace:validate -- /path/to/workspace
```

GitHub Actions：

- `.github/workflows/validate.yml`：engine PR / main validation。
- `.github/workflows/validate-workspace.yml`：提供私人 workspace 以完整 engine SHA 呼叫的 reusable workflow。

## 文件原則

正式 engine 文件只描述現在實際存在的行為與介面。開發 Roadmap、Phase、任務計畫與歷史決策不存放於本倉庫。
