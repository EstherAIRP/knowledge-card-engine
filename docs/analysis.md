# Analysis 與 Research 契約

`packages/analysis` 定義 來源類型-neutral 的分析結果欄位，以及 research-bound 分析 使用的研究計畫、分析證據與研究覆蓋契約。此模組只驗證資料契約；不自行擷取來源、不操作 工作區 filesystem，也不指定特定模型供應商。

## Analysis version

目前 驗證器 支援兩種可機器辨識的 分析 format：

| `analysis_version` | Binding | 用途 |
| --- | --- | --- |
| `1` | `source_identity + evidence_digest` | 現行 GitHub / Threads ingestion 寫入器 使用的 accepted-source 分析。 |
| `2` | `source_identity + source_evidence_digest + analysis_evidence_digest` | 需要獨立 研究證據 bundle 的研究型分析契約。 |

`analysis_version: 1` 與 `2` 的 摘要值 欄位不可混用。Version 1 不接受 `research`、`source_evidence_digest` 或 `analysis_evidence_digest`；version 2 不使用 `evidence_digest`。

兩個版本都必須提供相同的 卡片 AI 可更新 中繼資料 與十個正文段落，並維持 summary 長度、relevance score 與 section contract。

## 輸出語言與術語

Analysis 產生的 卡片 AI 可更新 中繼資料、十個正文段落，以及會進入 卡片 敘述的自由文字，必須符合 [Knowledge Card 契約](./card-contract.md) 的 AI 文字語言規則與 工作區 明確的分析語言政策。Research report 的敘述性 研究結果 若會供 卡片 分析 使用，也應遵守同一政策，但 evidence reference、程式識別字與受控狀態值維持原 contract。

語言整理不得：

- 改寫 已接受的來源證據 或 分析證據包 內的來源文字。
- 把直接引用、程式碼或官方識別字為了中文化而翻譯。
- 因來源為英文就讓 卡片 敘述大量沿用英文一般概念。
- 修改 使用者覆寫、使用者備註或其他受 所有權 保護的狀態。

目前 分析驗證器 驗證 version、欄位、摘要值 binding、research 覆蓋狀態 / 研究結果s 與品質守門，但不以自然語言分類器判斷中英夾雜程度；因此輸出語言仍由 Runtime、工作區 policy 與執行 Agent 共同約束，不能把通過 結構規格 / 驗證器 誤稱為已通過語言品質檢測。

## Source acceptance 與 分析 evidence

Source acceptance 與 研究證據 是不同責任：

~~~text
accepted source evidence
  └─ 證明來源身分、canonical URL、完整性與 source evidence digest

analysis evidence bundle
  └─ 證明本次研究實際使用哪些 primary-source items
~~~

Research contract 不降低 已接受的來源證據 的 來源類型專屬 驗證。Research bundle 必須綁定已接受來源的：

- `provider`
- `source_identity`
- `source_evidence_digest`

目前 分析 證據包 只定義 GitHub Repository 形式；其他 來源類型 若沒有正式 研究證據包 contract，驗證器 會 驗證失敗即拒絕。

GitHub 研究證據 由 ingestion 層的受控 capture API 產生：先固定 default-branch 提交 並建立 受限探索，再由 Agent 提交 material-question plan 與 selected 倉庫相對 paths；執行器 在同一 版本 重新驗證 選定路徑 並讀取對應 blob。Discovery candidates 可提供導航與已知 blob 快取，但不是 selected evidence 允許清單。完整 版本 版本鎖定、tree budget、path guard 與 binary / UTF-8 規則見 [來源收錄契約](./ingestion.md)。

## Research plan

`validateResearchPlan(plan, evidence)` 驗證研究問題與後續證據需求。

Research plan 使用 `research_version: 1`，並固定十個 research question：

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

每個問題只能是：

- `not_material`
- `already_supported`
- `needs_evidence`

只有 `needs_evidence` 可要求 `evidence_kinds` 或 `path_hints`。Path hint 必須是安全的 倉庫相對 path；它只是研究提示，不是可直接執行的外部 URL、shell command 或 fetch 權限。

GitHub multi-round expansion 在 ingestion 層另有 retry binding：Remote Ingest 從 round 0 開始，第一份 Agent 研究計畫 不帶 `prior_analysis_evidence_digest`；第一輪 validated bundle 形成後，若 Agent 還需要第二輪 evidence，新的 plan 必須把 `prior_analysis_evidence_digest` 設為目前 bundle 的 `analysis_evidence_digest`。這個欄位用來證明新的 material-question 判定是基於目前研究證據，而不是較舊 bundle。

目前可表達的 evidence kind 包含 README、documentation、資訊清單、configuration、entrypoint、API、data model、auth、security、background job、deployment、license、source、test 與 other。

## GitHub 分析證據包

`validateAnalysisEvidenceBundle(bundle, acceptedEvidence)` 驗證一組固定 Git 版本 的研究證據。

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

每個 item 必須包含：

~~~text
evidence_id
path
kind
blob_sha
content_sha256
bytes
text
~~~

Validator 會確認：

- `evidence_id` 與 path 不重複。
- path 是安全 倉庫相對 path。
- `blob_sha` 為 40 字元 Git blob SHA。
- `bytes` 等於 text 的 UTF-8 byte count。
- `content_sha256` 與 text 一致。
- bundle 綁定本次 accepted source identity / 摘要值。
- `analysis_evidence_digest` 與 倉庫版本 及全部 evidence item 中繼資料 / content hash 一致。

Digest 計算會對 evidence item 做穩定排序，因此相同 版本 與相同 item 集合不因輸入陣列順序不同而改變。

GitHub bounded expansion 每次成功取得新 evidence 後，都把既有 items 與新 items 合併成新的 cumulative bundle，再重算 `analysis_evidence_digest`。Round budget、累計 item/byte budget、重複 path 與 plan retry 摘要值 由 ingestion contract 驗證；分析 package 不自行抓下一輪來源。

## Structured Research Report

Research-bound 分析 必須附結構化 `research` report。固定 覆蓋狀態 dimensions：

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

每一個 dimension 的狀態只能是：

- `supported`
- `partial`
- `unavailable`
- `not_applicable`

`supported` 與 `partial` 必須引用 bundle 內存在的 `evidence_id`。

`unavailable` 不可冒充已有證據，且必須明確標示原因：

- `not_found`
- `budget_exhausted`
- `source_limited`

`not_applicable` 不引用 evidence，也不使用 unavailable reason。

`unknowns` 是可為空的唯一字串陣列，用來保留研究完成後仍不能由目前 primary-來源證據 驗證的 關鍵未知事項。

### Structured 研究結果s 與品質守門

Coverage 只回答「證據是否足夠」，不能單獨證明分析有把證據拆成可用知識。因此 research report 另外必須提供固定 `findings` 群組：

- `core_models`：核心 abstraction / model，包含名稱、描述與 evidence refs。
- `architecture_components`：主要元件及其責任。
- `flows`：具名稱、至少兩個 ordered steps 的資料／控制／工作流程。
- `implementation_checks`：文件或產品 claim 的實作判定；status 為 `implemented`、`partial`、`planned` 或 `unclear`，並附 assessment。
- `technical_mechanisms`：每一項同時描述 `mechanism`、`why_it_matters` 與 `tradeoff`。
- `limitations`：project-specific limitation 與實際 impact。

每一個 研究結果 都必須引用存在於 分析證據包 的 `evidence_id`。這個守門驗的是結構化知識與證據關聯，不要求固定字數、固定段落長度或固定 bullet 數。

GitHub research 的下列 覆蓋狀態 維度不能用 `not_applicable` 直接略過：

- `problem`
- `core_model`
- `architecture`
- `flow`
- `implementation_vs_claim`
- `technical_mechanisms`
- `limitations`

若 bounded research 仍找不到，必須用 `unavailable` 加明確原因。若上述維度是 `supported` 或 `partial`，對應的 結構化研究結果 群組不得為空。這可阻止只有「用了哪些技術」的 stack inventory 在 architecture / mechanism 已宣稱有證據時通過 品質門檻。

`security`、`license`、`deployment` 仍可依專案實際情況使用 `not_applicable`；不能為了填滿 卡片 臆造內容。

## Analysis version 2

Version 2 必須同時符合：

~~~text
source_identity == accepted evidence.source_identity
source_evidence_digest == accepted evidence.evidence_digest
analysis_evidence_digest == validated analysis evidence bundle.analysis_evidence_digest
research == validated structured research report
~~~

任何 source 摘要值、research 摘要值、覆蓋狀態 evidence ref 或 research 來源類型 不一致都 驗證失敗即拒絕。

`bindResearchAnalysisToEvidence(...)` 可建立上述 binding；`validateAnalysisResult(...)` 在 version 2 時必須同時取得 validated-compatible 分析 證據包。

## 工作區 寫入器 boundary

`packages/workspace` 的 `applyAcceptedSourceAnalysis(...)` 可接受可選的 `analysisEvidenceBundle`：

- `analysis_version: 1` 不得傳入 分析 證據包；寫入器 維持既有 accepted-source 分析 行為。
- GitHub `analysis_version: 2` 必須傳入與 已接受的證據 綁定的 分析證據包；寫入器 重新執行 分析 / bundle contract 驗證後，才可建立 卡片 與 研究追溯狀態。
- Threads 目前沒有 研究證據 bundle contract，因此正式 寫入器 仍只接受其 version 1 分析。

GitHub version 2 成功寫入時，工作區 只保存 compact 研究追溯資訊，不永久保存 evidence item 的 `text`、結構化研究結果 或 unknowns。若之後同一 GitHub 卡片 以 version 1 成功更新，舊 研究追溯狀態 會在同一寫入交易中移除，避免過期 provenance 繼續被視為目前 卡片 的研究依據。

Remote Ingest 的 GitHub 交接 會先建立 固定版本 探索 與空的 round-0 研究狀態。Agent 必須先回填 研究計畫 與 選定路徑；執行器 驗證 plan、path、版本 與 budget 後建立第一輪 cumulative 分析證據包。Agent 接著可提交綁定該 bundle 的 `analysis_version: 2`，或再回填一次綁定 current 摘要值 的 研究計畫 做第二輪 expansion。Runner 最終把目前 bundle 一併交給正式 寫入器。Threads 目前沒有 研究證據 bundle contract，因此 Remote Ingest 仍使用 version 1。任何 來源類型 都不得以手工 卡片 寫入繞過 寫入器。

## 錯誤語意

Research contract 使用既有 分析 驗證失敗即拒絕 原則，主要錯誤包含：

| Code | 意義 |
| --- | --- |
| `ANALYSIS_INVALID` | Analysis version、中繼資料 或正文欄位無效。 |
| `ANALYSIS_SOURCE_MISMATCH` | Analysis / research source identity 與 已接受的證據 不一致。 |
| `ANALYSIS_EVIDENCE_STALE` | Source evidence 摘要值 已不相符。 |
| `ANALYSIS_RESEARCH_INVALID` | Research plan、bundle、report 或其欄位無效。 |
| `ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED` | Provider 尚未定義 研究證據 contract。 |
| `ANALYSIS_RESEARCH_EVIDENCE_STALE` | Analysis 證據包 摘要值 或 分析 research 摘要值 已不相符。 |
| `ANALYSIS_QUALITY_GATE_FAILED` | Research 覆蓋狀態 宣稱有材料，但缺少對應 結構化研究結果，或 GitHub material 覆蓋狀態 被不當標成 not_applicable。 |

## 驗證

倉庫 的 `npm test` 會執行 分析契約 tests，包含：

- version 1 compatibility 與 過期 來源證據。
- 研究計畫 path / evidence request guard。
- 固定版本 證據包 hash / byte / 摘要值 驗證。
- research 覆蓋狀態 evidence refs 與 unavailable reason。
- structured core model / architecture / flow / implementation / mechanism / limitation 研究結果s 與 GitHub 品質門檻。
- version 2 source + research 摘要值 binding。
- 尚未支援 來源類型 的 驗證失敗即拒絕 行為。
