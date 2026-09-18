# AGENTS.md

本檔定義 `knowledge-card-engine` 目前有效的開發規則。

## 倉庫責任
- 只放核心程式、網站、Schema、通用規則、共用 Actions、正式現行文件與合成測試資料。
- 真實私人資料只屬於 `knowledge-card-workspace`，不得複製到本公開倉庫。
- 密鑰不得提交，也不得出現在測試、PR、日誌或建置產物。

## 開工前
1. 先讀 README、AGENTS、現行規格及本次相關程式。
2. 確認 `main`、既有分支、PR 與相關修改，避免覆蓋或重複開發。
3. 實作與正式規格衝突時先釐清，不自行猜測。

## 修改規則
- 只修改本次任務必要範圍。
- 不以重寫、重置或清理方式處理與本次任務無關的內容。
- Knowledge Card 修改必須遵守 [docs/card-contract.md](./docs/card-contract.md)。
- GitHub 收錄必須遵守 [docs/ingestion.md](./docs/ingestion.md)；不得以 URL slug、repo 名稱或模型記憶取代 accepted evidence。
- 一般重新分析不得修改穩定 ID、建立日期、任何 user override 或 `## 使用者備註`。
- accepted source state 只能在 Card 與 collection 驗證成功後推進。
- 公開範例與測試只能使用合成資料。
- 正式文件只描述目前有效的行為；不加入 Roadmap、Phase、task plan、archive 或過期設計。

## 分支與交付
- `main` 是唯一長期分支，不 force push。
- 一項任務使用一個短期分支：`feat/`、`fix/`、`docs/`、`chore/` 或 `migration/`。
- 正常變更透過 PR，原則採 Squash merge；合併後刪除工作分支。
- 執行與變更相關的測試、格式檢查、建置與資料驗證。
- 未執行或失敗的檢查必須明確回報，不得刪除測試、放寬規則或以假資料冒充成功。
