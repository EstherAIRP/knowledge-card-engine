# Knowledge Card Engine

## Knowledge Card 是什麼

Knowledge Card 是一套由 AI 協助維護的個人技術知識系統。

它把 GitHub、Threads 等公開來源整理成結構化的 Knowledge Card，保留使用者的人工判斷與備註，並從累積的知識內容建立搜尋、語意關聯、Concept 與知識圖譜，最後透過私人網站提供瀏覽與查詢。

Knowledge Card 將**共用程式**與**私人知識資料**分開管理：

- **Knowledge Card Engine**：公開的核心程式、資料契約、收錄能力、驗證、生成與網站服務。
- **Knowledge Card Workspace**：私人的個人背景、專案、Knowledge Card、人工設定、來源狀態、生成索引與發布資料。

本 repository 是公開的 **Knowledge Card Engine**。

---

## Engine / Workspace 關係

Knowledge Card 由 Engine 與 Workspace 共同組成：

```text
Knowledge Card
├─ Knowledge Card Engine
│  └─ 公開、共用、可重用的程式、契約與自動化
│
└─ Knowledge Card Workspace
   └─ 私人、個人化的 Knowledge Card 與相關資料
```

兩者的責任可以簡化成一句話：

> **Engine 負責系統行為與共用契約；Workspace 是私人資料的權威來源。**

Engine 不保存真正的私人 Knowledge Card，也不把私人索引或知識資料打包進公開網站資產。

Workspace 則透過 `engine.lock.json` 固定核准使用的 Engine 版本，避免 Engine 持續開發時直接改變既有 Workspace 的處理行為。

---

## 目錄架構

Knowledge Card Engine 是 Node.js monorepo，主要結構如下：

```text
knowledge-card-engine/
├─ apps/
│  ├─ web/
│  └─ server/
│
├─ packages/
│  ├─ core/
│  ├─ ingestion/
│  ├─ analysis/
│  ├─ graph/
│  ├─ workspace/
│  └─ release/
│
├─ docs/
├─ prompts/
├─ tests/
└─ .github/
```

主要責任：

| 位置 | 用途 |
| --- | --- |
| `apps/web` | 私人 Knowledge Card 網站介面 |
| `apps/server` | 登入、授權、Workspace 讀取與私人 API |
| `packages/core` | Knowledge Card、分類體系、所有權與核心驗證 |
| `packages/ingestion` | GitHub／Threads 來源解析與已接受來源證據 |
| `packages/analysis` | AI 分析、研究與證據資料契約 |
| `packages/graph` | 搜尋、向量、語意關聯、Concept 與 Graph |
| `packages/workspace` | Workspace 載入、Engine 版本鎖定與安全寫入 |
| `packages/release` | 一致發布與發布驗證 |
| `prompts` | Runtime、Knowledge Editor 與 Knowledge Card 寫作規則 |
| `tests` | Engine 測試與合成 Workspace 測試資料 |

完整架構與責任邊界見 [Architecture](./docs/architecture.md)。

---

## Engine 提供什麼

Knowledge Card Engine 提供整套 Knowledge Card 共用能力：

- **來源收錄**：解析與正規化來源，建立可驗證的來源證據。目前正式支援 GitHub repository 與 Threads。
- **研究與分析**：在來源需要更多脈絡時進行受限研究，再將最終證據整理成結構化分析。
- **Knowledge Card 建立與更新**：判定來源應建立新卡片或更新既有卡片，並保護穩定欄位、使用者覆寫與備註。
- **Workspace 驗證**：驗證 Workspace 結構、Knowledge Card、分類體系、來源狀態與其他正式資料。
- **搜尋與知識關聯**：從 Knowledge Card 建立搜尋資料、向量、Card ↔ Card 關聯、Concept 與 Graph。
- **一致發布**：把 Knowledge Card 與生成資料組成完整且可驗證的發布版本。
- **私人網站與 API**：提供 GitHub App 登入、Workspace 授權、Knowledge Card、搜尋、圖譜與發布 API，以及對應 Web UI。
- **自動化**：提供 Workspace 可重用的驗證、來源收錄與發布工作流程。

實際資料形狀、驗證規則與執行細節以 `docs/` 中的正式契約為準。

---

## 系統如何運作

從一個來源到最後可以在私人網站查詢，大致經過以下流程：

```text
公開來源 URL
   ↓
來源解析
   ↓
建立已接受來源證據
   ↓
必要時進行受限研究
   ↓
AI 分析
   ↓
建立或更新 Knowledge Card
   ↓
寫入私人 Workspace
   ↓
Workspace 驗證
   ↓
建立搜尋、向量、關聯、Concept 與 Graph
   ↓
建立一致發布版本
   ↓
私人 Web / API
```

同一來源再次收錄時，系統會辨識既有 Knowledge Card 並進行更新，而不是建立重複資料。

Knowledge Card 中由使用者管理的內容與由 AI 管理的內容也會分開處理，使重新分析可以更新知識內容，而不覆蓋使用者明確保留的判斷與備註。

---

## 公開與私人資料邊界

本 repository 是**公開 repository**。

真實 Workspace 資料及其衍生資料不得進入 Knowledge Card Engine，包括：

- 私人 Knowledge Card
- 私人背景與專案資料
- 非公開來源內容
- 真實來源與研究狀態
- 私人搜尋索引、向量、關聯、Concept 與 Graph
- 私人發布資料

這些資料不得出現在公開 repository、Pull Request、測試資料、執行日誌或建置產物。

Engine 的公開測試只能使用明確標示的合成資料。

`tests/fixtures/synthetic-workspace/` 是用於驗證共用契約的合成 Workspace，不是真實 Workspace 範本，也不得加入私人資料。

密鑰與憑證不得提交到 Git。

---

## 文件入口

如果是第一次閱讀 Knowledge Card Engine，建議從以下文件開始：

- [Architecture](./docs/architecture.md) — 系統與模組如何組成
- [Workspace](./docs/workspace.md) — Engine 與私人 Workspace 如何配合
- [Development](./docs/development.md) — 如何開發與驗證 Engine

正式功能契約：

- [Card Contract](./docs/card-contract.md) — Knowledge Card 結構與所有權
- [Ingestion](./docs/ingestion.md) — 來源收錄
- [Analysis](./docs/analysis.md) — 分析與研究
- [Generated Data](./docs/generated-data.md) — 搜尋、向量、關聯、Concept 與 Graph
- [Release](./docs/release.md) — 一致發布
- [Private Site](./docs/private-site.md) — 登入、授權與私人網站
- [Web UI](./docs/web-ui.md) — Web UI 與版面

完整文件導航見 [docs/index.md](./docs/index.md)。
