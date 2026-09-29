# AGENTS.md

本檔定義 `knowledge-card-engine` 目前有效的開發與資料規則。規則採漸進式揭露：先判定任務類型，再讀取該任務必要契約；不得為保險而預先掃描整個倉庫、全部正式文件、所有分支或 PR。

## 倉庫責任

- 保存核心程式、網站程式邊界、Schema、通用規則、共用 GitHub Actions、正式現行文件與合成測試資料。
- 真實私人背景、專案、Knowledge Card、人工設定、來源狀態、生成索引與發布紀錄只屬於私人 Knowledge Card Workspace，不得複製到本公開倉庫。
- 密鑰不得提交，也不得出現在測試、PR、日誌或建置產物。

## 開工前：漸進式揭露

1. 先讀本檔與 [`prompts/RUNTIME.md`](./prompts/RUNTIME.md) 的任務路由；只有 Knowledge Card Engine 開發或需要理解倉庫能力時才額外讀 `README.md`。
2. 依任務類型從 [`docs/index.md`](./docs/index.md) 只讀相關正式契約、Schema、程式與測試，不把索引中的全部文件當成必讀清單。
3. 單張 Knowledge Card 收錄／更新屬於 Knowledge Card Workspace 的日常資料任務，不應因此掃描 Knowledge Card Engine 的全部程式、文件、分支或 PR；只讀 Workspace 鎖定之 Engine 版本中，來源收錄、分析、Knowledge Card 與寫入器所需的契約。
4. 只有會修改 `knowledge-card-engine` 倉庫的任務，才確認 `main`、相關既有分支、未合併 PR 與工作範圍；搜尋應以本次任務關鍵字或預定分支名稱為界，不預設列出全部分支或 PR。
5. 以目前 Schema、執行契約、測試與本次相關正式規格交叉確認行為；若彼此衝突，先把衝突視為缺陷處理，不自行猜測。

## 資料與修改規則

- 只修改本次任務必要範圍；保留與本次任務無關的既有修改。
- Knowledge Card 必須遵守 [docs/card-contract.md](./docs/card-contract.md)。
- GitHub／Threads 收錄必須遵守 [docs/ingestion.md](./docs/ingestion.md)；不得以 URL 路徑代稱、分享 token、時間接近、倉庫名稱或模型記憶取代已接受證據。Threads 未證明完整串文時必須驗證失敗即拒絕。
- 一般重新分析不得修改穩定 `id`、`created_at`、任何 `*.user` 覆寫或完整 `## 使用者備註`。
- 相同來源應解析為既有 Knowledge Card 更新；來源識別或標準網址發生衝突時必須驗證失敗即拒絕。
- 已接受來源狀態只能在證據、分析綁定、所有權與完整 Card 集合驗證成功後推進。綁定 GitHub 研究證據的分析，其研究追溯狀態必須和 Card／已接受來源狀態在同一交易中推進；不得永久保存已選來源原文。
- Remote Ingest 交接只能在專用 `chore/ingest-*` Workspace 分支執行；`state/ingestion/` 的請求、已接受證據、Threads 語意交接、GitHub 研究證據、必要時的 GitHub 研究計畫與分析都是暫存交換資料，正式套用成功後必須移除，不得進入 Workspace `main`。GitHub 準備階段只固定倉庫版本、建立受限探索與空的第 0 輪研究狀態；Agent 必須先提交與摘要值綁定的研究計畫及選定路徑，執行器才擷取第一輪已驗證研究證據。第一輪證據包形成後，Agent 可提交分析，或在剩餘額度內再提交一次與摘要值綁定的研究計畫。選定路徑不以探索候選集合當作允許清單，但必須是同一固定版本中可驗證的安全倉庫相對文字檔，且不得位於 Engine 排除目錄。Agent 的請求、判定、研究計畫與分析提交仍必須遵守單一輸入檔與執行器父提交版本鏈結守門，不得修改由執行器管理的證據狀態。GitHub 研究證據交接可暫存已選來源原文供分析，但正式研究狀態只能保留精簡追溯資訊。
- 私人 API 必須在讀取伺服器端 Workspace／發布快取前重新驗證使用者的 Workspace 資格；前端 AuthGate 不能作為唯一授權邊界。
- 搜尋、向量、關聯、Concept、圖譜與發布中繼資料都屬於生成／私人資料；真實產物不得進入公開引擎、PR、測試、日誌或建置產物。
- 導覽分類體系與語意關聯不得混為同一維度；人工關聯的 `block`／`pin`／`override` 規則必須優先於生成結果。
- 發布讀取器必須驗證 E／S／P 版本鏈結、manifest 雜湊／大小與目前發布指標；發布不完整時必須驗證失敗即拒絕，不能混讀最新 Card 與舊索引。
- GitHub user access token、installation token、App private key、client secret 不得回傳到瀏覽器；瀏覽器的工作階段 Cookie 只保存不可推導憑證的識別值。
- 公開範例與測試只能使用合成資料。

## 正式文件規則

- 正式文件只描述目前有效的架構、契約、操作方式與限制。
- 正式文件必須自足：不得要求讀者先理解其他產品代際、開發任務、舊 PR、聊天紀錄或外部開發管理倉庫才能正確操作目前系統。
- 產品代際、遷移比較、開發 Roadmap、開發階段文件、task plan、archive 與過期設計不得放入正式文件。
- 一般敘述使用自然繁體中文；已有成熟中文譯名的一般技術概念優先使用中文，不因來源或程式本身是英文就沿用中英夾雜句型。
- 官方專案／產品名稱、倉庫名稱、程式碼、API、函式、參數、欄位、識別字、指令、檔案路徑、縮寫、錯誤碼、狀態值，以及不宜硬譯的標準名稱保留原文。
- `Workspace` 必須先判斷指涉再決定寫法：泛指檔案系統或執行位置時寫「工作區」，例如「工作區根目錄」；指 Knowledge Card 的正式私人資料元件時寫 `Knowledge Card Workspace`，上下文明確時可簡稱 `Workspace`；指 GitHub 倉庫名稱時使用實際名稱 `knowledge-card-workspace`，不得翻譯。
- `Engine` 同樣依指涉處理：正式產品名稱使用 `Knowledge Card Engine`，倉庫名稱使用 `knowledge-card-engine`；僅在泛指一般引擎概念時使用「引擎」。
- 重要術語首次需要中英對照時，可使用「中文（English）」格式；後續優先使用中文。不得以單字表機械替換整份文件，應以整句重寫維持技術語意。
- `schema_version`、`analysis_version`、API／通訊協定／資料格式版本等可由機器驗證的版本屬於現行契約，可以保留並必須說明其驗證行為。
- 文件與執行行為不一致視為缺陷；不能以歷史敘事或「沿用既有行為」代替完整現行定義。

## 分支與交付

- `main` 是唯一長期分支，不 force push。
- 一項任務使用一個短期分支：`feat/`、`fix/`、`docs/`、`chore/` 或 `migration/`。
- 正常變更透過 PR，原則採 Squash merge；合併後刪除工作分支。
- 執行與變更相關的測試、格式檢查、建置與資料驗證。
- 未執行或失敗的檢查必須明確回報，不得刪除測試、放寬規則或以假資料冒充成功。
