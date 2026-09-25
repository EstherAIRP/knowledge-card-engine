# Knowledge Card Runtime 契約

> **角色：** Knowledge Card 任務的執行編排契約  
> **文件導航：** [`../docs/index.md`](../docs/index.md)  
> **工程與資料安全：** [`../AGENTS.md`](../AGENTS.md)

本文件定義 Agent 收到任務後的執行順序、倉庫 邊界、失敗處理與完成回報。資料結構、來源 來源類型、所有權、生成資料、發布、私人網站與其他領域細節由對應 結構規格、驗證器 與正式文件維護；本文件不複製其實作細節。

## 語言與術語

- 一般中文回覆、Knowledge Card 的 AI 可更新 自然語言內容、文件與任務完成回報，預設以自然繁體中文為主。
- 工作區 若有明確的分析語言政策，Agent 在產生或重新分析 卡片 前必須讀取並遵守；語言政策只控制 AI 可更新 敘述，不擴張私人背景的可用範圍或寫入權限。
- 目標語言為中文時，不模仿來源的中英夾雜語體，也不因來源本身是英文或技術文件，就把已有成熟中文譯名的一般概念大量保留為英文。
- 已有成熟中文譯名的一般技術概念優先使用中文。
- 官方專案／產品名稱、程式碼、指令、API、函式／參數／欄位名稱、識別字、檔案路徑、縮寫、錯誤碼、狀態值與不宜硬譯的標準名稱保留原文。
- 重要術語需要中英對照時，首次可使用「中文（English）」格式，後續優先使用中文。
- 已接受的證據、直接引用與程式碼保持來源原文；語言整理發生在 分析 / 卡片 敘述層，不改寫來源證據。
- 語言整理不得改寫任何 使用者覆寫 或完整 `## 使用者備註`。

## 1. 任務判定

以下輸入預設視為 Knowledge Card 收錄／更新意圖，不需再次詢問：

- 技術文章、GitHub、論文、官方文件、工具或產品 URL。
- 使用者要求重新分析既有 卡片。
- 使用者要求修改 卡片 的人工狀態、分類、標籤、評分、動作、備註或關聯設定。

「視為收錄／更新意圖」不代表來源一定受目前 engine 支援。來源 來源類型、完整性與寫入能力仍必須通過正式契約；不支援或未通過驗證時保持 驗證失敗即拒絕，不得改用模型記憶或手工寫入繞過。

若使用者明確要求說明、審查、規劃、比較或其他不寫入 倉庫 的工作，依該要求處理，不應自動造成資料修改。

## 2. 先確定目標 倉庫 與有效 Engine

Knowledge Card 使用公開 Engine 與私人 工作區 分離架構。

### Engine 任務

程式、結構規格、共用規則、來源 來源類型、網站、可重用 工作流程、正式公開文件與合成測試資料屬於：

```text
EstherAIRP/knowledge-card-engine
```

Engine 任務以目標分支目前內容為準。開工前至少讀取：

1. `README.md`
2. `AGENTS.md`
3. `prompts/RUNTIME.md`
4. `docs/index.md`
5. 本次任務相關的正式規格、結構規格、程式與測試

### 工作區 任務

私人背景、專案資料、Knowledge Cards、人工設定、accepted 來源狀態、研究追溯狀態、生成資料 與 發布 紀錄屬於私人 工作區。

工作區 任務開工前至少讀取：

1. 工作區 `README.md`
2. 工作區 `AGENTS.md`
3. `workspace.yaml`
4. `engine.lock.json`
5. 本次任務需要的 工作區 設定、`profile/` 分析政策與既有資料
6. `engine.lock.json.engine_commit` 指定 提交 的 Engine 正式契約與實作

工作區 不追隨 Engine `main`。任何會影響實際寫入、驗證、來源 來源類型、結構規格、CLI 或 發布 的能力，都必須存在於 工作區 鎖定的完整 Engine SHA。不能因 Engine `main` 已有某功能，就假設目前 工作區 可以使用。

若目前 Runtime 描述的能力與 工作區 鎖定 Engine 不一致，以鎖定 Engine 可驗證的契約為執行邊界；需要新能力時應走正式 Engine 升級流程，不得臨時混用不同 版本 的程式與資料契約。

## 3. 開工前狀態檢查

任何會修改 倉庫 的任務，先確認：

- 目標 倉庫、目前分支與工作樹。
- `main` 的目前狀態。
- 既有相關短期分支與 未合併 PR。
- 是否已有同一來源、同一 卡片 或同一任務的進行中成果。
- 工作區 任務使用的 Engine 倉庫 與完整 提交 SHA。

不得因換對話、重試、標題差異或 URL 形式差異建立重複 卡片、重複分支或重複 PR。

若偵測到與本次任務相關但尚未整合的既有修改，先保留並判定能否接續；不得用 重設、強制推送、重寫或清理方式消除不屬於本次任務的內容。

## 4. 公私資料邊界

核心不變量：

```text
Engine = 公開程式、契約與合成資料
Workspace = 私人權威資料與私人衍生資料
```

必須遵守：

- 真實私人背景、專案、卡片、人工設定、來源狀態、向量、關聯、Concept、圖譜、搜尋索引與 發布 中繼資料 不得寫入公開 Engine。
- 公開 Engine 的 PR、Issue、測試、測試樣本、日誌與建置產物只能使用公開資訊或明確合成資料。
- 密鑰、權杖、私鑰 與其他 憑證 不得提交至任何 倉庫。
- 私人背景只能從 工作區 中目前規則明確允許的資料取得。
- 聊天記憶、未授權個人資訊或 Agent 自行推測的背景，不得補入 卡片 或公開輸出。
- 「允許供分析使用」與「允許寫入 卡片 正文」是不同權限；沒有明確允許時不得把私人背景直接寫入正文。

## 5. 來源收錄

目前正式支援的收錄 來源類型 以 [來源收錄契約](../docs/ingestion.md) 為準，目前包含 GitHub Repository 與 Threads。若來源不屬於已實作 來源類型，應回報不支援並停止正式寫入；一般網址 網址正規化 不能視為已有 通用擷取器。

支援來源共用的高階資料流是：

```text
URL
→ provider-specific resolution / canonical identity
→ provider-specific accepted evidence
→ optional provider-specific research evidence
→ evidence-bound analysis result
→ create / update resolution
→ ownership-safe Card candidate
→ full collection validation
→ Card + accepted source state + optional research provenance persistence
```

GitHub 以 倉庫 中繼資料 + README 為 已接受的證據；需要超出 README 的研究型分析時，可另外固定同一 倉庫版本，由 Agent 先提出 material-question 研究計畫 與 選定的第一手來源路徑，再由 Engine 驗證並擷取成獨立 分析證據包。Discovery candidate catalog 提供 導覽提示，不限制 Agent 只能選 candidate；candidate 之外的 path 仍必須是同一 版本 可驗證的安全文字檔。研究 expansion 由 Engine 的 progress / continuation contract 控制：預設最多兩輪，item / byte budget 累計計算；第二輪 plan 必須綁定上一輪 `analysis_evidence_digest`，不得重複已讀 path 或選取與 `needs_evidence` 無關的 evidence。Threads 必須先解析到具體貼文，再收斂到根貼文 identity；分享權杖 或串文中間篇不能直接當成正式來源身分。Threads 先以 strict structural reconstruction 判定完整性；只有在結構資料不足但屬於可受控的 continuation uncertainty 時，才允許 綁定摘要值的 semantic judgement，且必須再通過 deterministic acceptance gates。語意判定不能覆蓋已知缺篇、結構歧義或來源身分衝突。

### 來源證據

不得只根據 網址路徑代稱、倉庫 名稱、Threads 分享權杖、搜尋摘要、README／貼文片段或模型記憶產生正式分析。

GitHub 與 Threads 正式收錄都必須取得並驗證 來源類型專屬 已接受的證據。來源身分、標準網址、內容完整性與 evidence 摘要值 的條件由 `docs/ingestion.md` 與 ingestion 驗證器 定義。

核心不變量：

```text
執行環境失敗 != 來源不存在或來源不完整
```

網路、GitHub API、Threads 頁面取得、速率限制、授權或執行環境問題必須和明確的來源失敗分開回報。無法完成 已接受的證據 驗證時，不得建立／更新正式 卡片，也不得推進 accepted 來源狀態。

### 執行環境與 Remote Ingest

若目前互動環境無法 簽出 私人 工作區、無法執行 工作區 鎖定 Engine 所要求的 Node.js 版本，或缺少其他必要 執行環境 能力，不得因此手工建立／更新來源 卡片，也不得把限制描述成來源不可用。

當目前 工作區 已配置核准的 Remote Ingest 工作流程 時，改走 由倉庫定義的 交接：

```text
chore/ingest-* branch + request
→ pinned Engine / Node.js 24 source verification
→ optional Threads semantic handoff / digest-bound judgement
→ accepted evidence
→ GitHub: revision-pinned discovery + empty round-0 research state
→ GitHub: Agent material-question research plan + selected paths
→ GitHub: validated first research bundle，必要時再做一次 digest-bound Agent-directed expansion
→ GitHub: Agent analysis
→ GitHub analysis_version: 2 / Threads analysis_version: 1
→ pinned Engine writer apply + full validation
→ 清除 handoff 暫存資料
→ PR
```

Threads 需要語意 continuation 判定時，執行器 先把公開 根/candidate evidence 與 摘要值 寫入受控 交接；Agent 只回填固定 contract 的 judgement。後續 run 必須重新取得 live source、重建候選並確認 摘要值 未變，再由 Engine 的 deterministic gate 決定能否形成 已接受的證據。

GitHub 已接受的證據 建立後，執行器 固定 倉庫版本、產生 受限探索，並建立 `completed_rounds: 0`、`bundle: null` 的 `research-evidence.json`。Agent 必須先根據 關鍵研究問題 提交 `research-plan.json` 與 選定路徑；執行器 在同一 固定版本 驗證安全 倉庫相對 text path、排除目錄、item / byte budget 與 research-plan relevance 後，才擷取第一輪 validated bundle。Selected path 可以是 探索候選項目，也可以是 candidate catalog 之外但能在 固定版本 驗證存在的文字 第一手來源，因此 探索 只作為 導覽提示，不是 允許清單。第一輪後 Agent 可提交 version 2 分析；若仍缺 material evidence，可再提交綁定目前 `analysis_evidence_digest` 的第二份 研究計畫。第二輪後只能進入分析，不得增加第三輪或繞過 版本 / path / budget 守門。

Agent 只負責建立受控 request、必要時產生 Threads 綁定摘要值的 semantic judgement、判斷 GitHub 關鍵研究問題 與 selected evidence paths、讀取 validated accepted / 研究證據、產生 evidence-bound 分析，並在第一輪 GitHub bundle 不足時產生第二份 綁定摘要值的 研究計畫 / 選定路徑；正式 卡片/來源狀態/研究狀態 寫入仍由 執行器 內的 Engine 寫入器 完成。若 Remote Ingest 本身不可用或失敗，應回報 execution backend failure，不得繞過 寫入器。

## 6. 分析結果

Analysis 與 ingestion 是不同責任層。Engine 不固定特定模型供應商，但正式 分析結果 必須符合目前鎖定 Engine 的 分析契約。

Analysis 必須：

- 綁定本次 已接受的證據 的 `source_identity`。
- Version 1 綁定 已接受的證據 的 `evidence_digest`。
- GitHub Version 2 同時綁定 `source_evidence_digest` 與 validated 分析證據包 的 `analysis_evidence_digest`，並通過 結構化研究品質門檻。
- 使用 工作區 分類體系 中有效的受控值。
- 提供 卡片契約 要求的 AI 可更新 中繼資料 與正文段落。
- 遵守 工作區 明確的輸出語言政策；沒有額外政策時遵守本 Runtime 的語言與術語規則。
- 區分來源可驗證事實與分析推論。
- 不臆造功能、架構、授權、相容性、成熟度、基準測試或維護狀態。

舊 來源證據 或舊 研究證據包 產生的 分析 不得套用到新的 摘要值。GitHub research 若已達 round / item / byte budget，即使仍有 關鍵未知事項 也必須停止 expansion，並在 結構化研究報告 明確保留 unavailable / budget-exhausted 狀態；不得以額外自由瀏覽繞過 budget。Version 2 缺 bundle、摘要值過期、覆蓋狀態 / 研究結果 evidence 不成立時必須停止寫入。Threads 目前只使用 version 1。

## 7. Create / Update 與 Ownership

正式寫入前，必須依 accepted source identity 與 標準網址 判定 新建 或 更新。

- 相同 `source.identity` 或 標準網址 應解析到同一張既有 卡片。
- identity / 標準網址 指向不同 卡片、出現重複或其他對應衝突時，驗證失敗即拒絕。
- 新建 使用正式 寫入器 建立 穩定路徑。
- 更新 保留既有 穩定路徑。

一般重新分析可以更新 AI 可更新 狀態，但不得修改：

- 穩定 `id`
- `created_at`
- 任何 `*.user` override
- 完整 `## 使用者備註`

有效值遵守：

```text
effective = user ?? ai
```

Relevance 等逐欄位 所有權 依 [Knowledge Card 契約](../docs/card-contract.md) 與 驗證器 執行。使用者明確要求修改人工狀態時，只修改該要求涵蓋的 使用者擁有 欄位，不藉此重寫其他人工內容。

## 8. 寫入與驗證

GitHub / Threads 卡片 必須經正式 工作區 寫入器 寫入，不得手工繞過 寫入器 模擬成功。

Writer 在 持久化寫入 前必須完成：

1. 已接受的證據 驗證
2. 分析/證據綁定 驗證
3. GitHub version 2 的 分析證據包、結構化研究報告 與 品質門檻 驗證
4. 工作區 與 分類體系 載入
5. 新建／更新 resolution
6. 遵守所有權規則的 合併
7. 完整 卡片集合 驗證
8. accepted 來源狀態 驗證
9. GitHub version 2 研究追溯狀態 驗證

卡片、accepted 來源狀態 與 研究追溯資訊 必須維持一致。GitHub version 2 三者在同一檔案交易推進；後續 version 1 更新會同交易清除既有 研究狀態。任一驗證失敗不得推進其中任何正式狀態。

指定 工作區 的基礎驗證命令由目前鎖定 Engine 提供，例如：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

實際可用命令與參數以鎖定 Engine 的 `docs/development.md` 為準，不得從其他 版本 混用 CLI。

## 9. 生成資料 與 Release

`data/**` 與 `releases/**` 是機器管理的私人衍生資料。不得手工修改 生成產物 或 目前發布指標 表達使用者意圖。

權威資料變更進入 工作區 `main` 後，依 工作區 現行 工作流程 觸發 generated-data / 發布 流程。Release 必須遵守 [一致發布契約](../docs/發布.md) 的 E／S／P、資訊清單、版本鏈結 與 過期防護。

以下狀態必須分開：

```text
Card 寫入／合併成功
!= generated data 建立成功
!= release pointer 推進成功
!= 部署成功
!= 線上 readback 驗證成功
```

沒有實際驗證後續狀態時，不得籠統回報「發布完成」。

Generated-only 或 pointer-only 的機器提交不應形成 發布循環；人工 關聯 / Concept 意圖應寫入正式 `config/` 設定，而不是直接修改 生成產物。

## 10. 分支、提交與 PR

- `main` 是長期分支，不 強制推送。
- Engine 的功能、修正、結構規格、正式文件與共用 工作流程 變更使用短期分支與 PR。
- 工作區 的人工資料變更、批次修改、結構調整與 Engine 升級依 工作區 `AGENTS.md` 的現行提交政策執行。
- 分支使用 `feat/`、`fix/`、`docs/`、`chore/` 或 `migration/` 前綴。
- 一項任務使用一個可驗收的短期分支。
- 合併前執行與變更相關的測試、格式檢查、建置與資料驗證。
- 不得刪除測試、放寬規則或使用假資料讓驗證看似成功。
- 合併後依 倉庫 政策刪除工作分支。

## 11. 失敗處理

以下狀況一律 驗證失敗即拒絕，不得用推測補完正式結果：

- 必要 倉庫、工作區 或 Engine 版本鎖定 無法讀取。
- 工作區 鎖定 Engine 與 工作流程版本鎖定 不一致。
- 來源 來源類型 未支援。
- 已接受的證據 不完整或 identity 衝突。
- 分析 與 證據綁定 不一致。
- 結構規格、分類體系、所有權、集合唯一性、來源狀態 或 研究狀態 驗證失敗。
- 發布 資訊清單、版本鏈結、過期防護 或 目前指標 驗證失敗。
- 任何會造成私人資料進入公開 Engine 的情況。

失敗回報應說明實際阻礙層級，例如執行環境、來源、分析契約、卡片驗證、倉庫 提交、發布 或部署；不要以模糊的「來源不可用」或「發布失敗」取代可確認的原因。

## 12. 完成回報

完成回報只陳述已實際完成或已驗證的狀態，至少包含：

- 修改的 倉庫。
- 建立或更新的 卡片／程式／文件。
- 主要變更內容。
- 執行的驗證與結果。
- 提交、PR 或 合併 狀態。
- 發布／部署／線上 讀回驗證 狀態（僅在本次任務涉及且已實際確認時）。
- 尚未完成或無法驗證的事項。

Knowledge Card 收錄／更新時，可再包含 卡片 名稱、有效分類、整體 relevance、action、主要技術價值與 工作區 路徑；人工 override 應回報 effective 值，不把 AI 值誤稱為最終值。

## 13. 權威來源與衝突處理

不同領域由不同權威來源負責：

- 資料形狀：JSON Schema。
- 受控詞彙：工作區 `config/taxonomy.yaml`。
- 卡片 所有權、正文、唯一性與 穩定路徑：`docs/card-contract.md` 與 Core 驗證器。
- 工作區 結構與 Engine 版本鎖定：`docs/workspace.md` 與 工作區 載入er。
- 來源 identity、已接受的證據、GitHub research capture 與 來源狀態：`docs/ingestion.md` 與 ingestion 驗證器。
- Analysis version、研究證據包、structured 品質門檻 與 研究追溯資訊 binding：`docs/analysis.md`、分析驗證器 與 工作區 研究狀態 驗證器。
- Generated data：`docs/generated-data.md` 與 圖譜/generated-data 驗證器。
- E／S／P 與發布一致性：`docs/release.md` 與 發布 驗證器。
- 登入、授權與私人讀取：`docs/private-site.md` 與 server implementation/tests。
- 執行順序與跨領域編排：本文件。
- 倉庫 工程與修改安全：`AGENTS.md`。

文件、結構規格、驗證器、tests 或實際行為互相衝突時，把衝突視為缺陷；不得自行挑選較方便的規則或降低驗證標準。

本文件只維護跨領域執行不變量。來源專屬演算法、欄位列舉、API 細節與實作流程應留在各自的正式契約與程式中，避免形成第二份規格。
