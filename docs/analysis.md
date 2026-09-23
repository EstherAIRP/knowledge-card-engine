# Analysis 與 Research 契約

`packages/analysis` 定義 provider-neutral 的分析結果欄位，以及 research-bound analysis 使用的研究計畫、分析證據與研究覆蓋契約。此模組只驗證資料契約；不自行擷取來源、不操作 Workspace filesystem，也不指定特定模型供應商。

## Analysis version

目前 validator 支援兩種可機器辨識的 analysis format：

| `analysis_version` | Binding | 用途 |
| --- | --- | --- |
| `1` | `source_identity + evidence_digest` | 現行 GitHub / Threads ingestion writer 使用的 accepted-source analysis。 |
| `2` | `source_identity + source_evidence_digest + analysis_evidence_digest` | 需要獨立 research evidence bundle 的研究型分析契約。 |

`analysis_version: 1` 與 `2` 的 digest 欄位不可混用。Version 1 不接受 `research`、`source_evidence_digest` 或 `analysis_evidence_digest`；version 2 不使用 `evidence_digest`。

兩個版本都必須提供相同的 Card AI-owned metadata 與十個正文段落，並維持 summary 長度、relevance score 與 section contract。

## Source acceptance 與 analysis evidence

Source acceptance 與 research evidence 是不同責任：

~~~text
accepted source evidence
  └─ 證明來源身分、canonical URL、完整性與 source evidence digest

analysis evidence bundle
  └─ 證明本次研究實際使用哪些 primary-source items
~~~

Research contract 不降低 accepted source evidence 的 provider-specific 驗證。Research bundle 必須綁定已接受來源的：

- `provider`
- `source_identity`
- `source_evidence_digest`

目前 analysis evidence bundle 只定義 GitHub Repository 形式；其他 provider 若沒有正式 research bundle contract，validator 會 fail closed。

GitHub research evidence 由 ingestion 層的受控 capture API 產生：先固定 default-branch commit 並建立 bounded candidate set，再只讀取被選定的 candidate blob。完整 revision pin、tree budget、path guard 與 binary / UTF-8 規則見 [來源收錄契約](./ingestion.md)。

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

只有 `needs_evidence` 可要求 `evidence_kinds` 或 `path_hints`。Path hint 必須是安全的 repository-relative path；它只是研究提示，不是可直接執行的外部 URL、shell command 或 fetch 權限。

GitHub multi-round expansion 在 ingestion 層另有 retry binding：第一輪 plan 不帶 `prior_analysis_evidence_digest`；已取得一輪 cumulative bundle 後，下一份 plan 必須把 `prior_analysis_evidence_digest` 設為目前 bundle 的 `analysis_evidence_digest`。這個欄位用來證明新的 material-question 判定是基於目前研究證據，而不是較舊 bundle。

目前可表達的 evidence kind 包含 README、documentation、manifest、configuration、entrypoint、API、data model、auth、security、background job、deployment、license、source、test 與 other。

## GitHub Analysis Evidence Bundle

`validateAnalysisEvidenceBundle(bundle, acceptedEvidence)` 驗證一組固定 Git revision 的研究證據。

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

`repository_revision` 必須是小寫 40 字元 Git commit SHA。

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
- path 是安全 repository-relative path。
- `blob_sha` 為 40 字元 Git blob SHA。
- `bytes` 等於 text 的 UTF-8 byte count。
- `content_sha256` 與 text 一致。
- bundle 綁定本次 accepted source identity / digest。
- `analysis_evidence_digest` 與 repository revision 及全部 evidence item metadata / content hash 一致。

Digest 計算會對 evidence item 做穩定排序，因此相同 revision 與相同 item 集合不因輸入陣列順序不同而改變。

GitHub bounded expansion 每次成功取得新 evidence 後，都把既有 items 與新 items 合併成新的 cumulative bundle，再重算 `analysis_evidence_digest`。Round budget、累計 item/byte budget、重複 path 與 plan retry digest 由 ingestion contract 驗證；analysis package 不自行抓下一輪來源。

## Structured Research Report

Research-bound analysis 必須附結構化 `research` report。固定 coverage dimensions：

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

`unknowns` 是可為空的唯一字串陣列，用來保留研究完成後仍不能由目前 primary-source evidence 驗證的 material unknown。

### Structured findings 與品質守門

Coverage 只回答「證據是否足夠」，不能單獨證明分析有把證據拆成可用知識。因此 research report 另外必須提供固定 `findings` 群組：

- `core_models`：核心 abstraction / model，包含名稱、描述與 evidence refs。
- `architecture_components`：主要元件及其責任。
- `flows`：具名稱、至少兩個 ordered steps 的資料／控制／工作流程。
- `implementation_checks`：文件或產品 claim 的實作判定；status 為 `implemented`、`partial`、`planned` 或 `unclear`，並附 assessment。
- `technical_mechanisms`：每一項同時描述 `mechanism`、`why_it_matters` 與 `tradeoff`。
- `limitations`：project-specific limitation 與實際 impact。

每一個 finding 都必須引用存在於 Analysis Evidence Bundle 的 `evidence_id`。這個守門驗的是結構化知識與證據關聯，不要求固定字數、固定段落長度或固定 bullet 數。

GitHub research 的下列 coverage 維度不能用 `not_applicable` 直接略過：

- `problem`
- `core_model`
- `architecture`
- `flow`
- `implementation_vs_claim`
- `technical_mechanisms`
- `limitations`

若 bounded research 仍找不到，必須用 `unavailable` 加明確原因。若上述維度是 `supported` 或 `partial`，對應的 structured finding 群組不得為空。這可阻止只有「用了哪些技術」的 stack inventory 在 architecture / mechanism 已宣稱有證據時通過 quality gate。

`security`、`license`、`deployment` 仍可依專案實際情況使用 `not_applicable`；不能為了填滿 Card 臆造內容。

## Analysis version 2

Version 2 必須同時符合：

~~~text
source_identity == accepted evidence.source_identity
source_evidence_digest == accepted evidence.evidence_digest
analysis_evidence_digest == validated analysis evidence bundle.analysis_evidence_digest
research == validated structured research report
~~~

任何 source digest、research digest、coverage evidence ref 或 research provider 不一致都 fail closed。

`bindResearchAnalysisToEvidence(...)` 可建立上述 binding；`validateAnalysisResult(...)` 在 version 2 時必須同時取得 validated-compatible analysis evidence bundle。

## Workspace writer boundary

`packages/workspace` 的 `applyAcceptedSourceAnalysis(...)` 可接受可選的 `analysisEvidenceBundle`：

- `analysis_version: 1` 不得傳入 analysis evidence bundle；writer 維持既有 accepted-source analysis 行為。
- GitHub `analysis_version: 2` 必須傳入與 accepted evidence 綁定的 Analysis Evidence Bundle；writer 重新執行 analysis / bundle contract 驗證後，才可建立 Card 與 research provenance state。
- Threads 目前沒有 research evidence bundle contract，因此正式 writer 仍只接受其 version 1 analysis。

GitHub version 2 成功寫入時，Workspace 只保存 compact research provenance，不永久保存 evidence item 的 `text`、structured findings 或 unknowns。若之後同一 GitHub Card 以 version 1 成功更新，舊 research provenance state 會在同一寫入交易中移除，避免過期 provenance 繼續被視為目前 Card 的研究依據。

Remote Ingest 的 GitHub handoff 會先建立 revision-pinned discovery / progress，再由 Agent 回填受控 research plan 與 selected candidate paths。每輪 expansion 更新 cumulative Analysis Evidence Bundle；最終 `analysis_version: 2` 必須綁定該 bundle，runner 再把 bundle 一併交給正式 writer。Threads 目前沒有 research evidence bundle contract，因此 Remote Ingest 仍使用 version 1。任何 provider 都不得以手工 Card 寫入繞過 writer。

## 錯誤語意

Research contract 使用既有 analysis fail-closed 原則，主要錯誤包含：

| Code | 意義 |
| --- | --- |
| `ANALYSIS_INVALID` | Analysis version、metadata 或正文欄位無效。 |
| `ANALYSIS_SOURCE_MISMATCH` | Analysis / research source identity 與 accepted evidence 不一致。 |
| `ANALYSIS_EVIDENCE_STALE` | Source evidence digest 已不相符。 |
| `ANALYSIS_RESEARCH_INVALID` | Research plan、bundle、report 或其欄位無效。 |
| `ANALYSIS_RESEARCH_PROVIDER_UNSUPPORTED` | Provider 尚未定義 research evidence contract。 |
| `ANALYSIS_RESEARCH_EVIDENCE_STALE` | Analysis evidence bundle digest 或 analysis research digest 已不相符。 |
| `ANALYSIS_QUALITY_GATE_FAILED` | Research coverage 宣稱有材料，但缺少對應 structured findings，或 GitHub material coverage 被不當標成 not_applicable。 |

## 驗證

Repository 的 `npm test` 會執行 analysis contract tests，包含：

- version 1 compatibility 與 stale source evidence。
- research plan path / evidence request guard。
- revision-pinned evidence bundle hash / byte / digest 驗證。
- research coverage evidence refs 與 unavailable reason。
- structured core model / architecture / flow / implementation / mechanism / limitation findings 與 GitHub quality gate。
- version 2 source + research digest binding。
- 尚未支援 provider 的 fail-closed 行為。
