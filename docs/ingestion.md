# GitHub 收錄契約

## 目前支援範圍

目前正式支援 GitHub Repository URL 的單一卡片收錄流程：

```text
GitHub URL
→ canonical repository identity
→ repository metadata + README evidence
→ analysis result bound to evidence digest
→ create / update resolution
→ ownership-safe Card write
→ Card collection validation
→ accepted source state
```

GitHub 以外目前只有 generic URL canonicalization；沒有 generic extractor，也沒有 Threads provider。

## Canonical identity

Repository URL 變體與子路徑都收斂為 Repository root：

- `github.com/owner/repo`
- `www.github.com/owner/repo/`
- `github.com/owner/repo.git`
- query / fragment
- `/tree/...`、`/blob/...` 等 Repository 子路徑

輸出：

- canonical URL：`https://github.com/{owner}/{repo}`
- identity：`github:{owner-lower}/{repo-lower}`
- suggested id：`github-{owner-lower}-{repo-lower}`

一般 URL 會移除 fragment 與已知 tracking query，但保留其他有意義 query。

## GitHub evidence

正式 accepted evidence 至少包含：

- Repository metadata。
- 非空 README。
- requested identity 與 GitHub metadata identity 一致。
- Repository 未 disabled。
- captured timestamp。
- README SHA、README content SHA-256。
- evidence digest。

README 全文只存在 analysis input；accepted source state 不保存 README 全文。

錯誤狀態區分：

- `INGESTION_EXECUTION_FAILED`
- `SOURCE_NOT_FOUND`
- `SOURCE_ACCESS_DENIED`
- `SOURCE_INCOMPLETE`
- `SOURCE_IDENTITY_MISMATCH`
- `INGESTION_IDENTITY_CONFLICT`

執行環境失敗不可冒充來源不存在。

## Analysis contract

Analysis provider 不屬於 ingestion。正式 analysis result 必須包含：

- `analysis_version: 1`
- `source_identity`
- `evidence_digest`
- Card AI-owned metadata
- 10 個 AI 產生正文段落

`source_identity` 與 `evidence_digest` 必須和 accepted evidence 完全一致；舊 evidence 的 analysis 不得套用到新 evidence。

目前 engine 不固定 OpenAI、Anthropic、Copilot 或其他模型供應商。

## Create / update

Workspace resolver 依序：

1. `source.identity`
2. canonical URL

若兩者指向不同既有 Card，或 Workspace 已有重複 identity/canonical URL，直接 `INGESTION_IDENTITY_CONFLICT`。

Create 使用 Card contract 的 stable path；Update 保留既有 path、`id`、`created_at`、所有 user override 與完整 `## 使用者備註`。

## 寫入與 source state

Writer 在寫檔前先驗證：

- accepted GitHub evidence
- analysis/evidence binding
- ownership
- 完整 Card collection

Card 成功寫入後才推進：

`state/sources/github/{owner-lower}--{repo-lower}.json`

source state 只保存 metadata 摘要、README SHA/hash、evidence digest 與 Card 對應，不保存 README 全文。

若 Card validation、ownership 或 analysis binding 失敗，source state 不前進。
