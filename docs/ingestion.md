# GitHub 收錄契約

目前正式支援的來源收錄 provider 是 GitHub Repository。其他 HTTP(S) URL 只有 generic canonicalization helper，沒有 generic extractor；目前也沒有 Threads provider。

## 完整資料流

```text
GitHub URL
→ canonical repository identity
→ repository metadata + README accepted evidence
→ evidence-bound analysis result
→ create / update resolution
→ ownership-safe Card candidate
→ full collection validation
→ Card + accepted source state persistence
```

Ingestion、analysis 與 Workspace persistence 是不同責任層：ingestion 驗來源；analysis 只產生與 accepted evidence 綁定的 AI-owned 結果；Workspace writer 才能把合法結果合併進 Card 與 source state。

## URL canonicalization 與 identity

GitHub Repository 的下列輸入形式都解析到 Repository root：

- `github.com/owner/repo`
- `www.github.com/owner/repo/`
- `github.com/owner/repo.git`
- 帶 query / fragment 的 Repository URL
- `/tree/...`、`/blob/...` 等 Repository 子路徑

Canonicalization 產生：

- provider：`github`
- source type：`github`
- canonical URL：Repository root URL
- identity：`github:{owner-lower}/{repo-lower}`
- suggested id：`github-{owner-lower}-{repo-lower}`

Accepted evidence 最終的 canonical URL 使用 GitHub metadata 的 `full_name` 組成；identity 一律使用小寫 owner/repo。

Generic HTTP(S) URL canonicalization 會：

- 移除 fragment。
- 小寫 hostname，並移除 `www.`。
- 移除已知 tracking query。
- 保留其他 meaningful query。
- 產生 `url:{canonical-url}` identity。

Generic canonicalization 不代表該來源可以被正式擷取或寫入 Workspace。

## GitHub accepted evidence

正式 GitHub evidence 必須通過 `validateGitHubEvidence`，至少包含：

- `provider: github` 與 `accepted: true`。
- canonical URL 與 `source_identity` 一致。
- 合法 captured timestamp。
- Repository `full_name`、`default_branch` 與其他 accepted metadata。
- requested identity、metadata `html_url` / `full_name` identity 一致。
- Repository 未 disabled。
- 非空 README。
- README SHA、UTF-8 byte count、內容 SHA-256。
- 由 accepted repository metadata 與 README digest metadata 計算的 `evidence_digest`。

Provider 取得 README 時會解碼全文並驗證內容 hash / byte count。README 全文只存在於 analysis input 的 evidence；accepted source state 不保存 README 全文。

常見 fail-closed 錯誤：

| Code | 意義 |
| --- | --- |
| `SOURCE_URL_INVALID` | URL 不是合法支援格式。 |
| `SOURCE_PROVIDER_UNSUPPORTED` | 正式 GitHub provider 收到非 GitHub Repository URL。 |
| `INGESTION_EXECUTION_FAILED` | 網路、GitHub API rate limit、5xx/429 或執行環境使驗證無法完成。 |
| `SOURCE_NOT_FOUND` | Repository 明確 404。 |
| `SOURCE_ACCESS_DENIED` | GitHub 明確拒絕授權。 |
| `SOURCE_FETCH_FAILED` | 其他不能分類為上述狀態的 HTTP 失敗。 |
| `SOURCE_INCOMPLETE` | metadata、README 或 evidence 欄位／digest 不完整。 |
| `SOURCE_IDENTITY_MISMATCH` | requested、canonical、metadata 或 evidence identity 不一致。 |
| `SOURCE_CAPTURE_TIME_INVALID` | captured timestamp 無效。 |
| `INGESTION_IDENTITY_CONFLICT` | Workspace 內 identity / canonical URL 的對應互相衝突或已有重複資料。 |

執行環境失敗不能冒充來源不存在或來源不完整。

## Remote Ingest handoff

當互動環境不能安全執行目前 Workspace 鎖定的 Engine 時，Workspace 可使用 Engine 提供的 reusable `.github/workflows/ingest-workspace.yml` 作為受控遠端執行入口。Remote Ingest 不建立第二套 writer；最終 apply 仍呼叫 `applyAcceptedGitHubAnalysis(...)`。

每個收錄任務使用獨立的 `chore/ingest-*` Workspace 分支，並在 configured state root 下使用暫存目錄：

```text
state/ingestion/request.json
state/ingestion/evidence.json
state/ingestion/analysis.json
```

`request.json` 必須且只能包含：

```json
{
  "schema_version": 1,
  "provider": "github",
  "source_url": "https://github.com/owner/repo"
}
```

執行順序：

1. Agent 在 `chore/ingest-*` 分支提交 `request.json`。
2. Workspace 薄層 workflow 呼叫 pinned Engine 的 reusable ingestion workflow；runner 使用 Node.js 24、驗證 Workspace 與 workflow pin，取得 accepted evidence，並只寫入 `evidence.json`。
3. Agent 讀取該 accepted evidence，依目前 Workspace Taxonomy 與允許的私人背景產生 evidence-bound `analysis.json`，再提交至同一分支。
4. 第二次 workflow 驗證 request/evidence/analysis binding，呼叫正式 writer，執行完整 collection / ownership / source-state validation。
5. apply 成功後移除三個 handoff 暫存檔，只留下正式 Card 與 accepted source state；之後才建立或更新 PR。

Remote Ingest workflow 必須執行 stale branch guard 與 changed-path allowlist。它不得接受任意 shell command、任意輸出路徑或未定義 provider。accepted evidence 內的 README 全文只存在私人 handoff 分支供分析使用，不寫入 accepted source state、不輸出到公開 Engine，也不得在 Actions log 展開。

`state/ingestion/**` 不得合併到 Workspace `main`。如果 evidence 尚未產生、analysis 與 evidence 不匹配、workflow pin 不一致、runner 被阻擋或 writer 驗證失敗，正式 Card/source state 都不得以手工檔案寫入補救。

## Analysis result contract

Analysis provider 不屬於 ingestion。Engine 目前不固定任何特定 LLM 供應商。

正式 analysis result 必須：

- 使用 `analysis_version: 1`。
- `source_identity` 與 accepted evidence 完全一致。
- `evidence_digest` 與 accepted evidence 完全一致。
- 提供 title、summary、resource kind、navigation categories、classification categories、tags、relevance、actions、status。
- 提供 Card 契約要求的 10 個 AI 分析段落。
- summary 不超過 600 字元；relevance score 為 1–5 整數。

舊 evidence 產生的 analysis 不能套用到不同 digest 的新 evidence；不一致時回報 `ANALYSIS_EVIDENCE_STALE` 或其他 analysis contract error，且不得寫入 Card/source state。

## Create / update resolution

Workspace writer 載入完整 Card collection 後依序解析：

1. `source.identity`
2. canonical URL

規則：

- identity 或 canonical URL 有多張 Card：fail closed。
- identity 與 canonical URL 分別指向不同 Card：fail closed。
- 任一方式解析到同一張既有 Card：`update`。
- 兩者都沒有既有 Card：`create`，使用 source suggested id。

Create 依 Card contract 建立 stable path。Update 保留原 path、`id`、`created_at`、所有 user override 與完整「使用者備註」。

## Writer 驗證與 persistence

`applyAcceptedGitHubAnalysis(workspaceRoot, evidence, analysis)` 在任何正式寫入前會：

1. 驗證 GitHub accepted evidence。
2. 驗證 analysis 與 evidence identity/digest binding。
3. 載入 Workspace、Taxonomy 與完整 Card collection。
4. 解析 create / update target。
5. 建立合併後 Card candidate。
6. update 時比較 user/stable-owned state。
7. 對候選的完整 collection 執行 Card / Taxonomy / uniqueness 驗證。
8. 建立並驗證 GitHub source state。

只有全部通過後才進入檔案替換。

Writer 會先把 Card 與 source state 寫到 temp file，再依序替換正式檔案。若 Card replacement 成功但 source-state replacement 失敗，writer 會把 Card 回復成寫入前內容。驗證在 temp write 前失敗時，既有 accepted source state 不前進。

## Accepted source state

GitHub source state 路徑：

```text
state/sources/github/{owner-lower}--{repo-lower}.json
```

目前 state `schema_version` 是 `1`，保存：

- provider。
- `source_identity`、canonical URL。
- `captured_at`、`evidence_digest`。
- Repository `full_name`、`default_branch`、push/update time、archived/disabled 摘要。
- README SHA、content SHA-256、bytes。
- 對應 `card_id`、`card_path`。

Source-state validator 會確認 identity、canonical URL、digest/hash 形狀與 Repository identity。Workspace 的 `source-state:validate` 還會確認 `card_path` 位於 configured knowledge root，且 state 的 Card id / identity / canonical URL 與實際 Card 相同。

## CLI

完整 GitHub ingestion CLI：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo \
  --analysis-file=analysis.json
```

可選：

- `--evidence-file=accepted-evidence.json`：使用已取得的 evidence；CLI 仍會再次驗證 evidence 並確認它與 requested URL 相符。
- `--captured-at=<iso>`：指定即時 fetch evidence 的 captured time。
- `GITHUB_TOKEN`：需要 GitHub API 授權時由環境變數提供，不得提交到 repository。

Analysis JSON 必須已綁定本次 accepted evidence；CLI 不會動態載入任意 analyzer 程式。
