# Knowledge Card Engine

Knowledge Card V2 的公開核心引擎倉庫。

本倉庫負責共用程式、資料契約、驗證規則、網站程式、通用自動化與合成測試資料；真實私人知識資料放在私人工作區：

- https://github.com/EstherAIRP/knowledge-card-workspace

## 目前狀態

目前只有專案治理與安全邊界的最小基線，尚未實作收錄、Schema、網站、搜尋、圖譜或發布流程。後續功能完成時，文件只描述當下有效的系統行為。

## 資料邊界

本公開倉庫不得包含：

- 真實私人知識卡、個人背景或非公開專案資料。
- 真實來源快照、私人向量／索引或發布紀錄。
- API Key、Token、Cookie、Session Secret 或其他密鑰。
- 從私人聊天、記憶或私人工作區複製出的測試內容。

需要範例或測試資料時，只能使用合成資料。

## 文件原則

正式文件只保存目前有效的規格、架構與操作方式，不保存開發 Roadmap、Phase、任務計畫、過期設計或開發歷史。

Agent 或開發者修改本倉庫前，先讀取 [AGENTS.md](./AGENTS.md)。
