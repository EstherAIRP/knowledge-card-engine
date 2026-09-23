# Knowledge Card Runtime 契約

> **角色：** Knowledge Card 任務的執行編排契約  
> **文件導航：** [`../docs/index.md`](../docs/index.md)  
> **工程與資料安全：** [`../AGENTS.md`](../AGENTS.md)

本文件定義 Agent 收到任務後的執行順序、Repository 邊界、失敗處理與完成回報。資料結構、來源 provider、ownership、generated data、release、私人網站與其他領域細節由對應 Schema、validator 與正式文件維護；本文件不複製其實作細節。

## 語言與術語

- 一般中文回覆、Knowledge Card 正文、文件與任務完成回報，以自然繁體中文為主。
- 已有成熟中文譯名的一般技術概念優先使用中文。
- 官方專案／產品名稱、程式碼、指令、API、函式／參數／欄位名稱、識別字、檔案路徑、縮寫、錯誤碼與狀態值保留原文。
- 重要術語需要中英對照時，首次可使用「中文（English）」格式，後續優先使用中文。

## 1. 任務判定

以下輸入預設視為 Knowledge Card 收錄／更新意圖，不需再次詢問：

- 技術文章、GitHub、論文、官方文件、工具或產品 URL。
- 使用者要求重新分析既有 Card。
- 使用者要求修改 Card 的人工狀態、分類、標籤、評分、動作、備註或關聯設定。

「視為收錄／更新意圖」不代表來源一定受目前 engine 支援。來源 provider、完整性與寫入能力仍必須通過正式契約；不支援或未通過驗證時保持 fail closed，不得改用模型記憶或手工寫入繞過。

若使用者明確要求說明、審查、規劃、比較或其他不寫入 Repository 的工作，依該要求處理，不應自動造成資料修改。

## 2. 先確定目標 Repository 與有效 Engine

Knowledge Card 使用公開 Engine 與私人 Workspace 分離架構。

### Engine 任務

程式、Schema、共用規則、來源 provider、網站、可重用 workflow、正式公開文件與合成測試資料屬於：

```text
EstherAIRP/knowledge-card-engine
```

Engine 任務以目標分支目前內容為準。開工前至少讀取：

1. `README.md`
2. `AGENTS.md`
3. `prompts/RUNTIME.md`
4. `docs/index.md`
5. 本次任務相關的正式規格、Schema、程式與測試

### Workspace 任務

私人背景、專案資料、Knowledge Cards、人工設定、accepted source state、research provenance state、generated data 與 release 紀錄屬於私人 Workspace。

Workspace 任務開工前至少讀取：

1. Workspace `README.md`
2. Workspace `AGENTS.md`
3. `workspace.yaml`
4. `engine.lock.json`
5. 本次任務需要的 Workspace 設定與既有資料
6. `engine.lock.json.engine_commit` 指定 commit 的 Engine 正式契約與實作

Workspace 不追隨 Engine `main`。任何會影響實際寫入、驗證、來源 provider、Schema、CLI 或 release 的能力，都必須存在於 Workspace 鎖定的完整 Engine SHA。不能因 Engine `main` 已有某功能，就假設目前 Workspace 可以使用。

若目前 Runtime 描述的能力與 Workspace 鎖定 Engine 不一致，以鎖定 Engine 可驗證的契約為執行邊界；需要新能力時應走正式 Engine 升級流程，不得臨時混用不同 revision 的程式與資料契約。

## 3. 開工前狀態檢查

任何會修改 Repository 的任務，先確認：

- 目標 Repository、目前分支與工作樹。
- `main` 的目前狀態。
- 既有相關短期分支與 open PR。
- 是否已有同一來源、同一 Card 或同一任務的進行中成果。
- Workspace 任務使用的 Engine repository 與完整 commit SHA。

不得因換對話、重試、標題差異或 URL 形式差異建立重複 Card、重複分支或重複 PR。

若偵測到與本次任務相關但尚未整合的既有修改，先保留並判定能否接續；不得用 reset、force push、重寫或清理方式消除不屬於本次任務的內容。

## 4. 公私資料邊界

核心不變量：

```text
Engine = 公開程式、契約與合成資料
Workspace = 私人權威資料與私人衍生資料
```

必須遵守：

- 真實私人背景、專案、Card、人工設定、來源狀態、向量、relations、Concept、graph、搜尋索引與 release metadata 不得寫入公開 Engine。
- 公開 Engine 的 PR、Issue、測試、fixture、日誌與建置產物只能使用公開資訊或明確合成資料。
- 密鑰、token、private key 與其他 credential 不得提交至任何 Repository。
- 私人背景只能從 Workspace 中目前規則明確允許的資料取得。
- 聊天記憶、未授權個人資訊或 Agent 自行推測的背景，不得補入 Card 或公開輸出。
- 「允許供分析使用」與「允許寫入 Card 正文」是不同權限；沒有明確允許時不得把私人背景直接寫入正文。

## 5. 來源收錄

目前正式支援的收錄 provider 以 [來源收錄契約](../docs/ingestion.md) 為準，目前包含 GitHub Repository 與 Threads。若來源不屬於已實作 provider，應回報不支援並停止正式寫入；generic URL canonicalization 不能視為已有 generic extractor。

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

GitHub 以 repository metadata + README 為 accepted evidence；需要超出 README 的研究型分析時，可另外固定同一 repository revision、從 bounded candidate set 擷取 selected primary-source evidence，形成獨立 Analysis Evidence Bundle。Threads 必須先解析到具體貼文，再收斂到根貼文 identity；share token 或串文中間篇不能直接當成正式來源身分。Threads 先以 strict structural reconstruction 判定完整性；只有在結構資料不足但屬於可受控的 continuation uncertainty 時，才允許 digest-bound semantic judgement，且必須再通過 deterministic acceptance gates。語意判定不能覆蓋已知缺篇、結構歧義或來源身分衝突。

### 來源證據

不得只根據 URL slug、Repository 名稱、Threads share token、搜尋摘要、README／貼文片段或模型記憶產生正式分析。

GitHub 與 Threads 正式收錄都必須取得並驗證 provider-specific accepted evidence。來源身分、canonical URL、內容完整性與 evidence digest 的條件由 `docs/ingestion.md` 與 ingestion validator 定義。

核心不變量：

```text
執行環境失敗 != 來源不存在或來源不完整
```

網路、GitHub API、Threads 頁面取得、rate limit、授權或執行環境問題必須和明確的來源失敗分開回報。無法完成 accepted evidence 驗證時，不得建立／更新正式 Card，也不得推進 accepted source state。

### 執行環境與 Remote Ingest

若目前互動環境無法 checkout 私人 Workspace、無法執行 Workspace 鎖定 Engine 所要求的 Node.js 版本，或缺少其他必要 runtime 能力，不得因此手工建立／更新來源 Card，也不得把限制描述成來源不可用。

當目前 Workspace 已配置核准的 Remote Ingest workflow 時，改走 Repository-defined handoff：

```text
chore/ingest-* branch + request
→ pinned Engine / Node.js 24 source verification
→ optional Threads semantic handoff / digest-bound judgement
→ accepted evidence
→ Agent 依 accepted evidence 產生 analysis
→ 同 branch 提交 analysis
→ pinned Engine writer apply + full validation
→ 清除 handoff 暫存資料
→ PR
```

Threads 需要語意 continuation 判定時，runner 先把公開 root/candidate evidence 與 digest 寫入受控 handoff；Agent 只回填固定 contract 的 judgement。後續 run 必須重新取得 live source、重建候選並確認 digest 未變，再由 Engine 的 deterministic gate 決定能否形成 accepted evidence。

Agent 只負責建立受控 request、必要時產生 digest-bound semantic judgement、讀取 accepted evidence、產生 evidence-bound analysis 與後續 PR 編排；正式 Card/source-state 寫入仍由 runner 內的 Engine writer 完成。現行 Remote Ingest 尚未交換 GitHub research plan / Analysis Evidence Bundle，因此仍使用 analysis version 1；不得把 writer 已支援 version 2 誤認為 Remote Ingest 已支援深度研究流程。若 Remote Ingest 本身不可用或失敗，應回報 execution backend failure，不得繞過 writer。

## 6. 分析結果

Analysis 與 ingestion 是不同責任層。Engine 不固定特定模型供應商，但正式 analysis result 必須符合目前鎖定 Engine 的 analysis contract。

Analysis 必須：

- 綁定本次 accepted evidence 的 `source_identity`。
- Version 1 綁定 accepted evidence 的 `evidence_digest`。
- GitHub Version 2 同時綁定 `source_evidence_digest` 與 validated Analysis Evidence Bundle 的 `analysis_evidence_digest`，並通過 structured research quality gate。
- 使用 Workspace Taxonomy 中有效的受控值。
- 提供 Card contract 要求的 AI-owned metadata 與正文段落。
- 區分來源可驗證事實與分析推論。
- 不臆造功能、架構、授權、相容性、成熟度、基準測試或維護狀態。

舊 source evidence 或舊 research bundle 產生的 analysis 不得套用到新的 digest。Version 2 缺 bundle、digest stale、coverage / finding evidence 不成立時必須停止寫入。Threads 目前只使用 version 1。

## 7. Create / Update 與 Ownership

正式寫入前，必須依 accepted source identity 與 canonical URL 判定 create 或 update。

- 相同 `source.identity` 或 canonical URL 應解析到同一張既有 Card。
- identity / canonical URL 指向不同 Card、出現重複或其他對應衝突時，fail closed。
- create 使用正式 writer 建立 stable path。
- update 保留既有 stable path。

一般重新分析可以更新 AI-owned 狀態，但不得修改：

- 穩定 `id`
- `created_at`
- 任何 `*.user` override
- 完整 `## 使用者備註`

有效值遵守：

```text
effective = user ?? ai
```

Relevance 等逐欄位 ownership 依 [Knowledge Card 契約](../docs/card-contract.md) 與 validator 執行。使用者明確要求修改人工狀態時，只修改該要求涵蓋的 user-owned 欄位，不藉此重寫其他人工內容。

## 8. 寫入與驗證

GitHub / Threads Card 必須經正式 Workspace writer 寫入，不得手工繞過 writer 模擬成功。

Writer 在 persistence 前必須完成：

1. accepted evidence 驗證
2. analysis/evidence binding 驗證
3. GitHub version 2 的 Analysis Evidence Bundle、structured research report 與 quality gate 驗證
4. Workspace 與 Taxonomy 載入
5. create/update resolution
6. ownership-safe merge
7. 完整 Card collection 驗證
8. accepted source state 驗證
9. GitHub version 2 research provenance state 驗證

Card、accepted source state 與 research provenance 必須維持一致。GitHub version 2 三者在同一檔案交易推進；後續 version 1 更新會同交易清除既有 research state。任一驗證失敗不得推進其中任何正式狀態。

指定 Workspace 的基礎驗證命令由目前鎖定 Engine 提供，例如：

```bash
npm run workspace:validate -- /path/to/workspace
npm run cards:validate -- /path/to/workspace
npm run source-state:validate -- /path/to/workspace
npm run research-state:validate -- /path/to/workspace
```

實際可用命令與參數以鎖定 Engine 的 `docs/development.md` 為準，不得從其他 revision 混用 CLI。

## 9. Generated Data 與 Release

`data/**` 與 `releases/**` 是機器管理的私人衍生資料。不得手工修改 generated artifacts 或 current release pointer 表達使用者意圖。

權威資料變更進入 Workspace `main` 後，依 Workspace 現行 workflow 觸發 generated-data / release 流程。Release 必須遵守 [一致發布契約](../docs/release.md) 的 E／S／P、manifest、lineage 與 stale guard。

以下狀態必須分開：

```text
Card 寫入／合併成功
!= generated data 建立成功
!= release pointer 推進成功
!= 部署成功
!= 線上 readback 驗證成功
```

沒有實際驗證後續狀態時，不得籠統回報「發布完成」。

Generated-only 或 pointer-only 的機器提交不應形成 release loop；人工 relation / Concept 意圖應寫入正式 `config/` 設定，而不是直接修改 generated artifact。

## 10. 分支、提交與 PR

- `main` 是長期分支，不 force push。
- Engine 的功能、修正、Schema、正式文件與共用 workflow 變更使用短期分支與 PR。
- Workspace 的人工資料變更、批次修改、結構調整與 Engine 升級依 Workspace `AGENTS.md` 的現行提交政策執行。
- 分支使用 `feat/`、`fix/`、`docs/`、`chore/` 或 `migration/` 前綴。
- 一項任務使用一個可驗收的短期分支。
- 合併前執行與變更相關的測試、格式檢查、建置與資料驗證。
- 不得刪除測試、放寬規則或使用假資料讓驗證看似成功。
- 合併後依 Repository 政策刪除工作分支。

## 11. 失敗處理

以下狀況一律 fail closed，不得用推測補完正式結果：

- 必要 Repository、Workspace 或 Engine pin 無法讀取。
- Workspace 鎖定 Engine 與 workflow pin 不一致。
- 來源 provider 未支援。
- accepted evidence 不完整或 identity 衝突。
- analysis 與 evidence binding 不一致。
- Schema、Taxonomy、ownership、collection uniqueness、source-state 或 research-state 驗證失敗。
- release manifest、lineage、stale guard 或 current pointer 驗證失敗。
- 任何會造成私人資料進入公開 Engine 的情況。

失敗回報應說明實際阻礙層級，例如執行環境、來源、analysis contract、Card validation、Repository 提交、release 或部署；不要以模糊的「來源不可用」或「發布失敗」取代可確認的原因。

## 12. 完成回報

完成回報只陳述已實際完成或已驗證的狀態，至少包含：

- 修改的 Repository。
- 建立或更新的 Card／程式／文件。
- 主要變更內容。
- 執行的驗證與結果。
- commit、PR 或 merge 狀態。
- release／部署／線上 readback 狀態（僅在本次任務涉及且已實際確認時）。
- 尚未完成或無法驗證的事項。

Knowledge Card 收錄／更新時，可再包含 Card 名稱、有效分類、整體 relevance、action、主要技術價值與 Workspace 路徑；人工 override 應回報 effective 值，不把 AI 值誤稱為最終值。

## 13. 權威來源與衝突處理

不同領域由不同權威來源負責：

- 資料形狀：JSON Schema。
- 受控詞彙：Workspace `config/taxonomy.yaml`。
- Card ownership、正文、唯一性與 stable path：`docs/card-contract.md` 與 Core validator。
- Workspace 結構與 Engine pin：`docs/workspace.md` 與 Workspace loader。
- 來源 identity、accepted evidence、GitHub research capture 與 source state：`docs/ingestion.md` 與 ingestion validator。
- Analysis version、research bundle、structured quality gate 與 research provenance binding：`docs/analysis.md`、analysis validator 與 Workspace research-state validator。
- Generated data：`docs/generated-data.md` 與 graph/generated-data validator。
- E／S／P 與發布一致性：`docs/release.md` 與 release validator。
- 登入、授權與私人讀取：`docs/private-site.md` 與 server implementation/tests。
- 執行順序與跨領域編排：本文件。
- Repository 工程與修改安全：`AGENTS.md`。

文件、Schema、validator、tests 或實際行為互相衝突時，把衝突視為缺陷；不得自行挑選較方便的規則或降低驗證標準。

本文件只維護跨領域執行不變量。來源專屬演算法、欄位列舉、API 細節與實作流程應留在各自的正式契約與程式中，避免形成第二份規格。
