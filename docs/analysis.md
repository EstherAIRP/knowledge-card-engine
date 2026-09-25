# 分析與研究契約

`packages/analysis` 定義與來源類型無關的分析結果欄位，以及研究型分析使用的研究計畫、分析證據與研究覆蓋契約。此模組只驗證資料契約；不自行擷取來源、不操作 Workspace 檔案系統，也不指定特定模型供應商。

## 分析版本

目前驗證器支援兩種可由機器辨識的分析格式：

| `analysis_version` | 綁定 | 用途 |
| --- | --- | --- |
| `1` | `source_identity + evidence_digest` | 現行 GitHub / Threads 收錄寫入器使用的已接受來源分析。 |
| `2` | `source_identity + source_evidence_digest + analysis_evidence_digest` | 需要獨立研究證據包的研究型分析契約。 |

`analysis_version: 1` 與 `2` 的摘要值欄位不可混用。版本 1 不接受 `research`、`source_evidence_digest` 或 `analysis_evidence_digest`；版本 2 不使用 `evidence_digest`。

兩個版本都必須提供相同的卡片 AI 可更新中繼資料與十個正文段落，並維持 `summary` 長度、相關性分數與段落契約。

## 輸出語言與術語

分析產生的卡片 AI 可更新中繼資料、十個正文段落，以及會進入卡片敘述的自由文字，必須符合 [Knowledge Card 契約](./card-contract.md) 的 AI 文字語言規則與 Workspace 明確的分析語言政策。研究報告中會供卡片分析使用的敘述性研究結果，也應遵守同一政策；證據引用、程式識別字與受控狀態值則維持原契約。

語言整理不得：

- 改寫已接受來源證據或分析證據包內的來源文字。
- 為了中文化而翻譯直接引用、程式碼或官方識別字。
- 因來源為英文，就讓卡片敘述大量沿用可自然翻成中文的一般概念。
- 修改使用者覆寫、使用者備註或其他受所有權契約保護的狀態。

目前分析驗證器會驗證版本、欄位、摘要值綁定、研究覆蓋與研究結果，以及品質門檻，但不使用自然語言分類器判斷中英夾雜程度。因此輸出語言仍由執行契約、Workspace 政策與執行 Agent 共同約束；通過結構與資料驗證，不代表已自動通過語言品質檢測。

## 來源接受與分析證據

來源接受與研究證據是不同責任：

~~~text
已接受來源證據
  └─ 證明來源身分、標準網址、完整性與來源證據摘要值

分析證據包
  └─ 證明本次研究實際使用哪些第一手來源項目
~~~

研究契約不降低已接受來源證據的來源類型專屬驗證。研究證據包必須綁定已接受來源的：

- `provider`
- `source_identity`
- `source_evidence_digest`

目前分析證據包只定義 GitHub Repository 形式；其他來源類型若沒有正式研究證據包契約，驗證器會拒絕繼續處理。

GitHub 研究證據由收錄層的受控擷取 API 產生：先固定預設分支提交並建立受限探索，再由 Agent 提交關鍵研究問題計畫與選定的倉庫相對路徑；執行器會在同一版本重新驗證選定路徑，再讀取對應 blob。探索候選項目可以提供導覽與已知 blob 快取，但不是選定證據的允許清單。完整的版本鎖定、目錄樹上限、路徑防護，以及 binary / UTF-8 規則見 [來源收錄契約](./ingestion.md)。

## 研究計畫

`validateResearchPlan(plan, evidence)` 驗證研究問題與後續證據需求。

研究計畫使用 `research_version: 1`，並固定十個研究問題欄位：

- `problem`
- `core_model`
- `architecture`
- `flow`
- `implementation_support`
- `technical_mechanisms`
- `tradeoffs`
- `implementation_status`
- `operational_boundaries`
- `material_unknowns`

每個問題只能使用下列狀態：

- `not_material`
- `already_supported`
- `needs_evidence`

只有 `needs_evidence` 可要求 `evidence_kinds` 或 `path_hints`。路徑提示必須是安全的倉庫相對路徑；它只是研究提示，不是可直接執行的外部 URL、shell 指令或擷取權限。

GitHub 多輪擴充在收錄層另有重試綁定：Remote Ingest 從第 0 輪開始，第一份 Agent 研究計畫不帶 `prior_analysis_evidence_digest`；第一輪已驗證證據包形成後，若 Agent 還需要第二輪證據，新計畫必須把 `prior_analysis_evidence_digest` 設為目前證據包的 `analysis_evidence_digest`。這個欄位用來證明新的關鍵研究問題判定是基於目前研究證據，而不是較舊的證據包。

目前可表達的 `kind` 包含 `README`、`documentation`、`manifest`、`configuration`、`entrypoint`、`API`、`data model`、`auth`、`security`、`background job`、`deployment`、`license`、`source`、`test` 與 `other`。

## GitHub 分析證據包

`validateAnalysisEvidenceBundle(bundle, acceptedEvidence)` 驗證一組固定 Git 版本的研究證據。

必要欄位：

~~~text
research_version
provider
source_identity
source_evidence_digest
repository_revision
items[]
analysis_evidence_digest
~~~

`repository_revision` 必須是小寫 40 字元 Git 提交 SHA。

每個項目必須包含：

~~~text
evidence_id
path
kind
blob_sha
content_sha256
bytes
text
~~~

驗證器會確認：

- `evidence_id` 與 `path` 不重複。
- `path` 是安全的倉庫相對路徑。
- `blob_sha` 為 40 字元 Git blob SHA。
- `bytes` 等於 `text` 的 UTF-8 位元組數。
- `content_sha256` 與 `text` 一致。
- 證據包綁定本次已接受來源的識別與摘要值。
- `analysis_evidence_digest` 與倉庫版本及全部證據項目的中繼資料／內容雜湊一致。

摘要值計算會對證據項目做穩定排序，因此相同版本與相同項目集合，不會因輸入陣列順序不同而改變。

GitHub 的受限擴充每次成功取得新證據後，都把既有項目與新項目合併成新的累積證據包，再重算 `analysis_evidence_digest`。輪次上限、累計項目數／位元組上限、重複路徑與研究計畫重試摘要值由收錄契約驗證；分析套件不自行取得下一輪來源。

## 結構化研究報告

研究型分析必須附上結構化 `research` 報告。固定覆蓋維度為：

- `problem`
- `core_model`
- `architecture`
- `flow`
- `implementation_vs_claim`
- `technical_mechanisms`
- `limitations`
- `security`
- `license`
- `deployment`

每個維度的狀態只能是：

- `supported`
- `partial`
- `unavailable`
- `not_applicable`

`supported` 與 `partial` 必須引用證據包內存在的 `evidence_id`。

`unavailable` 不可冒充已有證據，且必須明確標示原因：

- `not_found`
- `budget_exhausted`
- `source_limited`

`not_applicable` 不引用證據，也不使用不可用原因。

`unknowns` 是可為空的唯一字串陣列，用來保留研究完成後仍不能由目前第一手來源證據驗證的關鍵未知事項。

### 結構化研究結果與品質門檻

覆蓋狀態只回答「證據是否足夠」，不能單獨證明分析已把證據整理成可用知識。因此研究報告另外必須提供固定的 `findings` 群組：

- `core_models`：核心抽象或模型，包含名稱、描述與證據引用。
- `architecture_components`：主要元件及其責任。
- `flows`：具名稱、至少兩個有順序步驟的資料／控制／工作流程。
- `implementation_checks`：文件或產品宣稱的實作判定；`status` 為 `implemented`、`partial`、`planned` 或 `unclear`，並附判定說明。
- `technical_mechanisms`：每一項同時描述 `mechanism`、`why_it_matters` 與 `tradeoff`。
- `limitations`：專案特定限制與實際影響。

每一項研究結果都必須引用分析證據包內存在的 `evidence_id`。這個門檻驗證的是結構化知識與證據的關聯，不要求固定字數、固定段落長度或固定項目數。

GitHub 研究的下列覆蓋維度不能用 `not_applicable` 直接略過：

- `problem`
- `core_model`
- `architecture`
- `flow`
- `implementation_vs_claim`
- `technical_mechanisms`
- `limitations`

若受限研究仍找不到證據，必須用 `unavailable` 加明確原因。若上述維度是 `supported` 或 `partial`，對應的結構化研究結果群組不得為空。這可阻止只有技術清單、卻在架構或技術機制上宣稱已有證據的分析通過品質門檻。

`security`、`license`、`deployment` 仍可依專案實際情況使用 `not_applicable`；不能為了填滿卡片而臆造內容。

## 分析版本 2

版本 2 必須同時符合：

- `source_identity` 等於已接受來源證據的 `source_identity`。
- `source_evidence_digest` 等於已接受來源證據的 `evidence_digest`。
- `analysis_evidence_digest` 等於已驗證分析證據包的 `analysis_evidence_digest`。
- `research` 等於已驗證的結構化研究報告。

任何來源摘要值、研究摘要值、覆蓋證據引用或研究來源類型不一致，都會拒絕繼續處理。

`bindResearchAnalysisToEvidence(...)` 可建立上述綁定；`validateAnalysisResult(...)` 在版本 2 時必須同時取得相容且已驗證的分析證據包。

## Workspace 寫入器邊界

`packages/workspace` 的 `applyAcceptedSourceAnalysis(...)` 可接受選用的 `analysisEvidenceBundle`：

- `analysis_version: 1` 不得傳入分析證據包；寫入器維持既有已接受來源分析行為。
- GitHub `analysis_version: 2` 必須傳入與已接受證據綁定的分析證據包；寫入器重新執行分析與證據包契約驗證後，才可建立卡片與研究追溯狀態。
- Threads 目前沒有研究證據包契約，因此正式寫入器仍只接受版本 1 分析。

GitHub 版本 2 成功寫入時，Workspace 只保存精簡研究追溯資訊，不永久保存證據項目的 `text`、結構化研究結果或 `unknowns`。若之後同一 GitHub 卡片以版本 1 成功更新，舊研究追溯狀態會在同一寫入交易中移除，避免過期追溯資訊繼續被視為目前卡片的研究依據。

Remote Ingest 的 GitHub 交接會先建立固定版本的探索與空的第 0 輪研究狀態。Agent 必須先回填研究計畫與選定路徑；執行器驗證計畫、路徑、版本與上限後建立第一輪累積分析證據包。Agent 接著可提交綁定該證據包的 `analysis_version: 2`，或再回填一次綁定目前摘要值的研究計畫做第二輪擴充。執行器最後把目前證據包一併交給正式寫入器。Threads 目前沒有研究證據包契約，因此 Remote Ingest 仍使用版本 1。任何來源類型都不得以手工卡片寫入繞過寫入器。

## 錯誤語意

研究契約沿用既有分析的「驗證失敗即拒絕」原則，主要錯誤包含：

| Code | 意義 |
| --- | --- |
| `ANALYSIS_INVALID` | 分析版本、中繼資料或正文欄位無效。 |
| `ANALYSIS_SOURCE_MISMATCH` | 分析／研究的來源識別與已接受證據不一致。 |
| `ANALYSIS_EVIDENCE_STALE` | 來源證據摘要值已不相符。 |
| `ANALYSIS_RESEARCH_INVALID` | 研究計畫、證據包、報告或其欄位無效。 |
| `ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED` | 來源類型尚未定義研究證據契約。 |
| `ANALYSIS_RESEARCH_EVIDENCE_STALE` | 分析證據包摘要值或分析中的研究摘要值已不相符。 |
| `ANALYSIS_QUALITY_GATE_FAILED` | 研究覆蓋宣稱已有材料，但缺少對應的結構化研究結果，或 GitHub 的必要覆蓋維度被不當標成 `not_applicable`。 |

## 驗證

倉庫的 `npm test` 會執行分析契約測試，包含：

- 版本 1 相容性與過期來源證據。
- 研究計畫的路徑與證據要求防護。
- 固定版本證據包的雜湊、位元組數與摘要值驗證。
- 研究覆蓋的證據引用與不可用原因。
- 結構化核心模型、架構、流程、實作判定、技術機制、限制與 GitHub 品質門檻。
- 版本 2 的來源／研究摘要值綁定。
- 尚未支援來源類型的安全拒絕行為。
