# 開發與驗證

## 工具鏈

- Node.js 24
- npm workspaces
- ESM
- `package-lock.json` 納入版本控制

安裝依賴：

```bash
npm ci
```

完整驗證：

```bash
npm run validate
```

`validate` 目前包含：

1. `npm run check`：檢查必要骨架、current-only 文件與 synthetic fixture。
2. `npm test`：確認所有 app/package entrypoint 可載入且模組識別唯一。

GitHub Actions 在 pull request 與 `main` push 使用 Node 24 執行相同的 `npm ci` 與 `npm run validate`。

## 文件原則

正式 engine 文件只描述現在實際存在的行為與介面。開發 Roadmap、Phase、任務計畫與歷史決策不存放於本倉庫。
