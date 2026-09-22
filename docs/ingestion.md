# 來源收錄契約

目前正式支援兩種來源 provider：

| Provider | 可接受輸入 | 穩定來源身分 | Card source type | Accepted evidence |
| --- | --- | --- | --- | --- |
| GitHub Repository | Repository URL 與其子路徑 | `github:{owner-lower}/{repo-lower}` | `github` | Repository metadata + 非空 README |
| Threads | `threads.com` / `threads.net` 的 post、`/share/*`、`/t/*` | `threads:{root_shortcode}` | `article` | 已解析至根貼文且結構上可證明完整的有序貼文集合 |

其他 HTTP(S) URL 只有 generic canonicalization helper，沒有 generic extractor；不能因 URL 可被正規化就視為可正式收錄。

## 共通資料流

```text
source URL
→ provider-specific resolution / canonical identity
→ accepted evidence
→ evidence-bound analysis result
→ create / update resolution
→ ownership-safe Card candidate
→ full collection validation
→ Card + accepted source state persistence
```

Ingestion、analysis 與 Workspace persistence 是不同責任層：ingestion 驗證外部來源並建立 accepted evidence；analysis 只產生與該 evidence 的 identity / digest 綁定的 AI-owned 結果；Workspace writer 才能把合法結果合併進 Card 與 source state。

來源擷取失敗與來源本身不完整必須分開。網路、rate limit、runner 能力或其他執行環境問題不能冒充來源不存在或來源不完整。

## URL canonicalization 與 identity

### GitHub Repository

以下形式都解析到 Repository root：

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

Accepted evidence 最終 canonical URL 使用 GitHub metadata 的 `full_name` 組成；identity 一律使用小寫 owner/repo。

### Threads

支援 Threads 主機名稱 `threads.com` 與 `threads.net`，以及：

- `/@user/post/<shortcode>`
- `/share/<token>`
- `/t/<token>`

直接 post URL 可立即得到該貼文 shortcode identity；`share` / `t` token 只是暫時導向識別，**不得**作為正式 `source.identity`。Provider 必須先解析到具體 Threads post，再依結構證據重建其根貼文；正式 identity 只使用：

```text
threads:{root_shortcode}
```

正式 canonical URL 是根貼文：

```text
https://threads.com/@user/post/{root_shortcode}
```

因此分享連結、中間篇或最後一篇只要能驗證屬於同一完整串文，都應解析成同一來源並更新同一張 Card。

### Generic HTTP(S)

Generic canonicalization 會移除 fragment、移除 `www.`、刪除已知 tracking query、保留其他 meaningful query，並產生 `url:{canonical-url}` identity。這不代表該來源具有 accepted-evidence provider。

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

README 全文只存在於 analysis input 的 accepted evidence；accepted source state 不保存 README 全文。

## Threads accepted evidence

正式 Threads evidence 必須通過 `validateThreadsEvidence`。目前 Engine 只接受**結構驗證（`structural`）完成**的來源；不以時間接近、模型猜測或 share token 補足缺失關係。

Provider 的處理順序是：

```text
Threads input URL
→ transient URL resolution when needed
→ exact target post extraction
→ reply/root graph reconstruction
→ root post identity
→ n/N / structural completeness checks
→ ordered parts[]
→ combined_text
→ accepted evidence digest
```

Accepted evidence 必須符合：

- `provider: threads`、`accepted: true`、`source_type: article`。
- 根貼文 canonical URL 與 `threads:{root_shortcode}` 完全一致。
- `requested_url` 與 `resolved_input_url` 可追溯本次輸入與實際貼文。
- `resolved_input_url` / `input_shortcode` 指向的實際輸入貼文必須在 accepted `parts[]` 中恰好出現一次，且 `thread.input_index` 必須指向同一位置；直接 post request 不得解析成另一個 shortcode。
- `thread.complete: true` 且 `thread.verification: structural`。
- thread status 只能是 `SINGLE_POST` 或 `COMPLETE_THREAD`。
- `thread.total`、`detected_parts` 與 `parts.length` 一致。
- 每一 part 都有可驗證 shortcode、canonical URL、作者與固定順序。
- 所有 part 與根貼文為同一作者。
- `combined_text` 必須等於有序 parts 的文字串接。
- 來源至少包含文字或媒體等可分析內容。
- `evidence_digest` 必須符合 accepted conversation 的內容指紋。

若根貼文明示仍有 replies，但目前只擷取到單篇且 conversation coverage 未被證明完整，必須 `SOURCE_INCOMPLETE`；不得把「只看到根貼文」當成「已證明只有根貼文」。

目前正式 runtime **沒有** LLM-assisted continuation / root-only recovery。當原生結構證據不足、同作者分支有歧義、已知總篇數缺篇或根貼文覆蓋範圍未證明完整時，保持 fail closed。未來若加入語意復原，仍必須是獨立受控能力，不能覆蓋更強且互相衝突的結構證據。

Threads evidence 會保留完整有序文字與媒體資訊供 analysis 使用；accepted source state 只保存來源與各 part 的雜湊／結構指紋，不保存 Threads 原文。媒體 URL 的易變 query / fragment 不參與 evidence digest 的穩定內容識別。

## Fail-closed 錯誤

常見錯誤：

| Code | 意義 |
| --- | --- |
| `SOURCE_URL_INVALID` | URL 不是合法支援格式。 |
| `SOURCE_PROVIDER_UNSUPPORTED` | Request / evidence provider 尚未支援。 |
| `INGESTION_EXECUTION_FAILED` | 網路、rate limit、外部服務或執行環境使驗證無法完成。 |
| `SOURCE_NOT_FOUND` | Provider 明確證明來源不存在；目前主要由 GitHub 404 使用。 |
| `SOURCE_ACCESS_DENIED` | Provider 明確拒絕授權。 |
| `SOURCE_FETCH_FAILED` | 其他可辨識的來源 HTTP 失敗。 |
| `SOURCE_INCOMPLETE` | 必要 evidence、來源完整性或 digest 驗證未通過。 |
| `SOURCE_IDENTITY_MISMATCH` | requested、resolved、canonical 或來源內容 identity 不一致。 |
| `SOURCE_CAPTURE_TIME_INVALID` | captured timestamp 無效。 |
| `INGESTION_IDENTITY_CONFLICT` | Workspace 內 identity / canonical URL 對應互相衝突或已有重複資料。 |

## Analysis result contract

Analysis provider 不屬於 ingestion。Engine 不固定特定 LLM 供應商。

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
- 兩者都沒有既有 Card：`create`，使用 provider 建議的 stable id。

Create 依 Card contract 建立 stable path。Update 保留原 path、`id`、`created_at`、所有 user override 與完整「使用者備註」。

## Writer 驗證與 persistence

`applyAcceptedSourceAnalysis(workspaceRoot, evidence, analysis)` 是 provider-neutral 正式 writer；`applyAcceptedGitHubAnalysis` 與 `applyAcceptedThreadsAnalysis` 是 provider-specific guard / compatibility entry。

任何正式寫入前會：

1. 驗證 provider-specific accepted evidence。
2. 驗證 analysis 與 evidence identity/digest binding。
3. 載入 Workspace、Taxonomy 與完整 Card collection。
4. 解析 create / update target。
5. 建立合併後 Card candidate。
6. update 時比較 user/stable-owned state。
7. 對候選的完整 collection 執行 Card / Taxonomy / uniqueness 驗證。
8. 建立並驗證對應 provider 的 accepted source state。

只有全部通過後才進入檔案替換。Writer 先寫 temp file；若 Card replacement 成功但 source-state replacement 失敗，會回復 Card。驗證在 temp write 前失敗時，既有 accepted source state 不前進。

## Accepted source state

GitHub：

```text
state/sources/github/{owner-lower}--{repo-lower}.json
```

保存 repository metadata 摘要、README SHA / content SHA-256 / bytes、evidence digest 與 Card 對應，不保存 README 全文。

Threads：

```text
state/sources/threads/{root-shortcode-slug}-{identity-hash}.json
```

保存根來源 identity / canonical URL、author、thread status / total / verification、每一 part 的 shortcode / canonical / reply-root 結構、文字 byte count 與文字／媒體／引用 SHA-256，以及 Card 對應；不保存 Threads 原文。

`npm run source-state:validate` 會遞迴驗證 `state/sources/**` 的已支援 provider，並確認 `card_path` 位於 configured knowledge root，且 state 的 Card id / identity / canonical URL 與實際 Card 相同。

## Remote Ingest handoff

當互動環境不能安全執行目前 Workspace 鎖定的 Engine 時，Workspace 可使用 reusable `.github/workflows/ingest-workspace.yml`。Remote Ingest 不建立第二套 writer；最終 apply 仍走 `applyAcceptedSourceAnalysis(...)`。

每個任務使用獨立 `chore/ingest-*` Workspace 分支與：

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

或：

```json
{
  "schema_version": 1,
  "provider": "threads",
  "source_url": "https://threads.com/share/example"
}
```

執行順序：

1. Agent 提交 request。
2. pinned Engine / Node.js 24 runner 驗證 Workspace 與 workflow pin，依 provider 取得 accepted evidence，只寫 `evidence.json`。
3. Agent 只依 accepted evidence、Taxonomy 與被允許的私人背景產生 evidence-bound `analysis.json`。
4. 第二次 workflow 重新驗證 request/evidence/analysis binding，呼叫正式 writer。
5. apply 成功後移除三個 handoff 暫存檔，只留下正式 Card 與 accepted source state；之後才建立或更新 PR。

Workflow 必須保留 stale branch guard 與 changed-path allowlist，不接受任意 shell command、輸出路徑或未定義 provider。`state/ingestion/**` 不得合併到 Workspace `main`。

## CLI

GitHub：

```bash
npm run ingest:github -- /path/to/workspace https://github.com/owner/repo \
  --analysis-file=analysis.json
```

Threads：

```bash
npm run ingest:threads -- /path/to/workspace https://threads.com/share/token \
  --analysis-file=analysis.json
```

兩者都可用 `--evidence-file=accepted-evidence.json` 注入已取得且仍需重新驗證的 evidence，並可用 `--captured-at=<iso>` 固定 captured time。GitHub 即時擷取需要授權時使用 `GITHUB_TOKEN`；密鑰不得提交。

受控 Remote Ingest runner：

```bash
npm run ingest:handoff -- /path/to/workspace --result-file=/tmp/ingest-result.json
```

Analysis JSON 必須已綁定本次 accepted evidence；CLI 不會動態載入任意 analyzer 程式。
