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

## Current writer boundary

目前 `packages/workspace` 的正式 `applyAcceptedSourceAnalysis(...)` 仍只收到 accepted source evidence 與 analysis result，沒有 analysis evidence bundle / research-state persistence 參數。因此正式 GitHub / Threads Card ingestion 仍使用 `analysis_version: 1`。

`analysis_version: 2` 現在已可搭配 ingestion 層產生的 revision-pinned GitHub Analysis Evidence Bundle 做完整 contract validation；但在 Workspace writer、research provenance state 與 Remote Ingest handoff 明確接入前，仍不得以 version 2 繞過現行 writer 或手工寫 Card。

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

## 驗證

Repository 的 `npm test` 會執行 analysis contract tests，包含：

- version 1 compatibility 與 stale source evidence。
- research plan path / evidence request guard。
- revision-pinned evidence bundle hash / byte / digest 驗證。
- research coverage evidence refs 與 unavailable reason。
- version 2 source + research digest binding。
- 尚未支援 provider 的 fail-closed 行為。
