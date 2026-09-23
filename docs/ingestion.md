# 來源收錄契約

目前正式支援兩種來源 provider：

| Provider | 可接受輸入 | 穩定來源身分 | Card source type | Accepted evidence |
| --- | --- | --- | --- | --- |
| GitHub Repository | Repository URL 與其子路徑 | `github:{owner-lower}/{repo-lower}` | `github` | Repository metadata + 非空 README |
| Threads | `threads.com` / `threads.net` 的 post、`/share/*`、`/t/*` | `threads:{root_shortcode}` | `article` | 已解析至根貼文，且通過結構完整性或受控高信心語意復原的有序貼文集合 |

其他 HTTP(S) URL 只有 generic canonicalization helper，沒有 generic extractor；不能因 URL 可被正規化就視為可正式收錄。

## 共通資料流

```text
source URL
→ provider-specific resolution / canonical identity
→ accepted evidence
→ optional GitHub research evidence bundle
→ evidence-bound analysis result
→ create / update resolution
→ ownership-safe Card candidate
→ full collection validation
→ Card + accepted source state + optional research provenance persistence
```

Ingestion、analysis 與 Workspace persistence 是不同責任層：ingestion 驗證外部來源、建立 accepted evidence，並可為 GitHub 擷取固定 revision 的受控 research evidence；analysis 產生與 source / research digest 綁定的 AI-owned 結果；Workspace writer 才能把合法結果合併進 Card、accepted source state 與必要的 compact research provenance。

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

## GitHub research evidence

GitHub accepted evidence 只回答來源是否可接受；需要超出 README 的技術分析時，可另外建立固定 revision 的 research evidence。這個 research 階段不改變 accepted source evidence，也不把「研究深度不足」變成 source acceptance failure。

Engine 提供固定 revision 的 discovery / fetch primitives，以及可驗證的 bounded expansion loop：

```text
accepted GitHub evidence
→ discoverGitHubResearchCandidates(...)
→ fixed repository revision + bounded candidate set
→ research plan
→ createGitHubResearchProgress(...)
→ evaluateGitHubResearchContinuation(...)
→ fetchGitHubResearchExpansion(...)
→ cumulative Analysis Evidence Bundle
→ optional second research plan bound to prior analysis_evidence_digest
→ optional second expansion
→ deterministic stop
```

`fetchGitHubResearchEvidence(...)` 仍可直接建立單次 selected evidence bundle；需要多輪 material-question expansion 時，必須使用 research progress / continuation contract，不能由呼叫端自行忽略 round / cumulative budget。

### Revision pin 與 stale guard

Discovery 先讀 default branch 目前 commit，固定：

- `repository_revision`：40 字元 commit SHA。
- `root_tree_sha`：該 commit 的 root tree SHA。

接著以同一 `repository_revision` 重新查 README。若其 blob SHA 已與 accepted evidence 的 README SHA 不同，回報 `SOURCE_RESEARCH_STALE`，不得把舊 source acceptance 與較新的 repository tree 混成一份 research bundle。

### Candidate discovery

Repository tree 以 non-recursive Git tree API 受限展開。Engine 只暴露可能具研究價值、可視為文字 primary source 的候選，例如：

- README、架構／設計文件。
- dependency / build manifest。
- configuration、entrypoint、API / route。
- data model / schema / migration。
- auth / security。
- background job / workflow。
- deployment / container。
- LICENSE。
- representative source / test。

常見 generated、vendor、dependency、build/cache 目錄，以及 lockfile、minified file、非文字副檔名不進候選集合。

Discovery 有硬上限；目前預設：

| Budget | 預設上限 |
| --- | ---: |
| tree requests | 64 |
| tree entries | 4000 |
| candidates | 500 |
| directory depth | 5 |
| expansion rounds | 2 |
| selected evidence items（累計） | 20 |
| single item | 163840 bytes |
| selected bundle total（累計） | 786432 bytes |

呼叫端只能把上限調低，不能透過 options 提高 Engine 上限。

Discovery 若因 budget 或 GitHub truncated response 未完整走完，會把 `exhaustive` 設為 `false` 並保存 deterministic `stop_reasons`；目前可能值：

- `tree_request_budget_exhausted`
- `tree_entry_budget_exhausted`
- `candidate_budget_exhausted`
- `depth_budget_exhausted`
- `github_tree_truncated`

### Selected evidence

`fetchGitHubResearchEvidence(...)` 只能讀取 discovery 已核准的 exact candidate path；不能新增任意 URL、任意 branch、任意 repository path 或 shell command。

實際檔案以 discovery 記錄的 blob SHA 直接讀取，因此內容固定於同一 repository revision。每個 selected item 會保存：

- deterministic `evidence_id`
- repository-relative `path`
- evidence `kind`
- Git `blob_sha`
- `content_sha256`
- UTF-8 `bytes`
- `text`

Binary、非 UTF-8、超過單檔／總 bundle budget 的內容 fail closed。

### Bounded evidence expansion

`createGitHubResearchProgress(...)` 建立 round 0 進度；此時尚無 selected research item。Progress 綁定 accepted source digest 與 discovery 的 repository revision，並記錄：

- `completed_rounds`
- 已選 path
- 累計 item 數
- 累計 bytes
- 目前 `analysis_evidence_digest`

`evaluateGitHubResearchContinuation(...)` 只依 validated research plan、current progress、current bundle 與 discovery budget 決定是否繼續。結果只有：

- `needs_evidence`：仍有 research question 明確要求證據，而且 round / item / byte budget 都還有額度。
- `plan_complete`：目前 plan 沒有任何 `needs_evidence`。
- `round_budget_exhausted`：已完成最大 expansion rounds。
- `item_budget_exhausted`：累計 selected item 已達上限。
- `byte_budget_exhausted`：累計 evidence bytes 已達上限。

第一輪 plan 不得帶 prior research digest。完成一輪後，下一份 plan 若仍要求 evidence，必須帶：

```text
prior_analysis_evidence_digest == current bundle.analysis_evidence_digest
```

digest 不一致時回報 `GITHUB_RESEARCH_PLAN_STALE`，不得把舊 material-question judgement 套到新的 cumulative evidence。

`fetchGitHubResearchExpansion(...)` 另外限制：

- 每輪 selected path 必須仍在同一 discovery candidate set。
- 已在先前 round 使用的 path 不可重複擷取。
- selected candidate 必須符合至少一個 `needs_evidence` question 的 evidence kind 或 exact path hint。
- item / byte budget 以累計 bundle 計算，不會因拆成多輪而重置。
- 每次成功 expansion 都重新計算 cumulative `analysis_evidence_digest`。

目前預設最多兩個 expansion rounds。第二輪後即使仍有 material unknown，也必須停止 expansion；後續 structured research report 應以 `unavailable` / `budget_exhausted` 表達，而不是繼續無界限讀取 Repository。

最後形成的 Analysis Evidence Bundle 由 [Analysis 與 Research 契約](./analysis.md) 驗證，並產生獨立 `analysis_evidence_digest`。這份全文 bundle 是 analysis input，不是 accepted source state。GitHub `analysis_version: 2` 可將 bundle 交給正式 Workspace writer，writer 只永久保存 compact research provenance；目前 Remote Ingest handoff 尚未交換 research plan / bundle，因此 Remote Ingest 仍使用 version 1。

## Threads accepted evidence

正式 Threads evidence 必須通過 `validateThreadsEvidence`。Provider 先以原生結構證據重建串文；只有在結構資料不足但仍屬於可受控判定的 continuation uncertainty 時，才允許進入語意復原。任何已知缺篇、結構歧義、來源身分衝突或執行環境失敗都不能由語意判定覆蓋。

Provider 的處理順序是：

```text
Threads input URL
→ transient URL resolution when needed
→ public HTTP extraction
→ public browser fallback when HTTP evidence is insufficient
→ strict reply/root graph reconstruction
→ structural completeness checks
→ eligible continuation uncertainty only
→ digest-bound semantic judgement
→ deterministic acceptance gates
→ ordered parts[]
→ combined_text
→ accepted evidence digest
```

Browser fallback 只讀取公開 Threads 頁面的 rendered DOM 與同源公開 JSON response，不使用登入狀態、私人 cookie 或私人帳號資料。若 runner 缺少可啟動的 browser runtime、網路被阻擋或頁面無法取得，屬於 execution failure，不得降級成來源不完整。

### Structural verification

結構證據足夠時直接接受，不經語意判定。Accepted evidence 必須符合：

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

若根貼文明示仍有 replies，但目前只擷取到單篇且 conversation coverage 未被證明完整，不能直接把「只看到根貼文」當成「已證明只有根貼文」。

### Controlled semantic continuation recovery

只有 strict reconstruction 已失敗，而且失敗屬於可判定的 continuation uncertainty 時，Engine 才建立候選集合。預設候選規則包含：同作者、在根貼文之後、時間差不超過 24 小時、明確 non-reply 排除，最多 8 個候選；候選另計算 deterministic metadata score。

Semantic judgement 是固定資料契約，不直接決定 accepted evidence。Remote Ingest 的 judgement 必須由 `knowledge_card_agent` 產生，並包含：

- `selected_shortcodes`
- `root_only`
- `confidence`
- `complete`
- `rationale`
- 每個候選的 `candidate_labels`

Engine 重新套用 deterministic gate。至少要求整體 `confidence >= 0.90`；選擇 continuation 時，第一個 selected candidate 的 metadata score 必須達最低門檻；判定 `root_only` 時，每個候選都必須明確標成高信心 `followup` 或 `unrelated`，不能有 continuation 或 uncertain candidate。

語意復原成功後，accepted evidence 使用：

- `thread.verification: llm_assisted`
- `INFERRED_THREAD_HIGH_CONFIDENCE` 或 `INFERRED_SINGLE_POST_HIGH_CONFIDENCE`
- `extraction.inferred: true`
- `thread.recovery` 保存 confidence、選取 shortcode、candidate labels 與 ranker provenance

這個能力只能處理結構資料「不足以辨識 continuation」的缺口，不能覆蓋更強且互相衝突的結構證據，也不能把已知缺篇或 ambiguous graph 推定成完整。

### Digest-bound semantic handoff

Remote Ingest 需要語意判定時，Engine 先輸出 `semantic-handoff.json`，其中包含公開 root/candidate evidence 與其 SHA-256 digest。Agent 回填的 `semantic-judgement.json` 必須帶同一 digest。

第二次執行不直接信任先前快照；Engine 會重新取得來源、重新建立候選並重新計算 digest。若來源或候選 evidence 已改變，回報 `THREADS_CONTINUATION_HANDOFF_EVIDENCE_MISMATCH` 並停止，不得把舊 judgement 套到新來源。

Threads evidence 會保留完整有序文字與媒體資訊供 analysis 使用；accepted source state 只保存來源與各 part 的雜湊／結構指紋，以及語意復原 provenance，不保存 Threads 原文。媒體 URL 的易變 query / fragment 不參與 evidence digest 的穩定內容識別。

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
| `SOURCE_RESEARCH_STALE` | GitHub accepted README 已與 research revision 的 README blob 不一致。 |
| `GITHUB_RESEARCH_LIMIT_INVALID` | 呼叫端提供的 research budget 無效或試圖使用未定義 budget。 |
| `GITHUB_RESEARCH_DISCOVERY_INVALID` | GitHub research discovery 結構、candidate 或 bounded metadata 無效。 |
| `GITHUB_RESEARCH_PATH_INVALID` | Research path 不是安全 repository-relative path。 |
| `GITHUB_RESEARCH_PATH_NOT_CANDIDATE` | 要求擷取的 path 不在受控 discovery candidate set。 |
| `GITHUB_RESEARCH_SELECTION_INVALID` | Selected path 集合為空、重複或形狀無效。 |
| `GITHUB_RESEARCH_SELECTION_REPEATED` | Multi-round research 再次要求已取得的 path。 |
| `GITHUB_RESEARCH_SELECTION_NOT_REQUESTED` | Selected candidate 不符合任何目前 `needs_evidence` question。 |
| `GITHUB_RESEARCH_PLAN_STALE` | Retry plan 綁定的 prior analysis evidence digest 已過期或缺失。 |
| `GITHUB_RESEARCH_PROGRESS_INVALID` | Research progress 與 accepted source、revision、bundle、item/byte totals 不一致。 |
| `GITHUB_RESEARCH_EXPANSION_STOPPED` | Continuation 已依 plan / budget 判定必須停止，仍嘗試擷取下一輪 evidence。 |
| `GITHUB_RESEARCH_BUDGET_EXCEEDED` | Selected research evidence 超過單輪可用或累計 item / byte budget。 |
| `GITHUB_RESEARCH_BINARY_UNSUPPORTED` | Selected blob 不是可接受的 UTF-8 文字內容。 |
| `INGESTION_IDENTITY_CONFLICT` | Workspace 內 identity / canonical URL 對應互相衝突或已有重複資料。 |

## Analysis result contract

Analysis provider 不屬於 ingestion。Engine 不固定特定 LLM 供應商。

正式 analysis result 必須符合 [Analysis 與 Research 契約](./analysis.md)：

- Version 1 綁定 `source_identity + evidence_digest`；GitHub / Threads 現有 CLI 與 Remote Ingest 使用此格式。
- GitHub Version 2 綁定 `source_identity + source_evidence_digest + analysis_evidence_digest`，並必須一併提供 validated Analysis Evidence Bundle 與 structured research report。
- 兩種版本都提供 Card 契約要求的 AI-owned metadata 與 10 個正文段落；summary 不超過 600 字元，relevance score 為 1–5 整數。
- Threads 目前沒有 research evidence bundle contract，因此不得使用 version 2。

舊 source evidence 或舊 research bundle 產生的 analysis 不能套用到新的 digest；binding 不一致時 fail closed，且不得寫入 Card / accepted source state / research state。

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

`applyAcceptedSourceAnalysis(workspaceRoot, evidence, analysis, options)` 是 provider-neutral 正式 writer；GitHub version 2 透過 `options.analysisEvidenceBundle` 傳入 research bundle。`applyAcceptedGitHubAnalysis` 與 `applyAcceptedThreadsAnalysis` 是 provider-specific guard / compatibility entry。

任何正式寫入前會：

1. 驗證 provider-specific accepted evidence。
2. 驗證 analysis 與 source evidence binding；GitHub version 2 另外驗 Analysis Evidence Bundle / research digest / structured quality gate。
3. 載入 Workspace、Taxonomy 與完整 Card collection。
4. 解析 create / update target。
5. 建立合併後 Card candidate。
6. update 時比較 user/stable-owned state。
7. 對候選的完整 collection 執行 Card / Taxonomy / uniqueness 驗證。
8. 建立並驗證對應 provider 的 accepted source state。
9. GitHub version 2 建立並驗證 compact research provenance state。

全部驗證完成後，writer 將 Card、accepted source state 與需要的 research state 視為同一檔案交易。任一 replacement 失敗時會回復已提交項目；驗證失敗時三者都不前進。若同一 GitHub Card 後續成功套用 version 1，既有 research state 會在同一交易移除，避免過期 provenance 被誤認為目前 Card 的研究依據。

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

### GitHub research provenance state

GitHub version 2 成功寫入後，另保存：

```text
state/research/github/{owner-lower}--{repo-lower}.json
```

此 state 只保存 source / research digest、repository revision、evidence item 的 path / kind / blob SHA / content hash / bytes、coverage 狀態、分析時間與 Card 對應；不保存 evidence `text`、structured findings、unknowns 或 credential。

`npm run research-state:validate` 會驗證 research state 自身結構、固定路徑，並交叉確認目前 accepted source state 的 evidence digest / captured time / Card mapping，以及實際 Card 的 id / identity / canonical URL。GitHub material coverage 不可在持久 state 中改成 `not_applicable`。

## Remote Ingest handoff

當互動環境不能安全執行目前 Workspace 鎖定的 Engine 時，Workspace 可使用 reusable `.github/workflows/ingest-workspace.yml`。Remote Ingest 不建立第二套 writer；最終 apply 仍走 `applyAcceptedSourceAnalysis(...)`。

每個任務使用獨立 `chore/ingest-*` Workspace 分支。Handoff 目錄只允許下列暫存檔：

```text
state/ingestion/request.json
state/ingestion/semantic-handoff.json
state/ingestion/semantic-judgement.json
state/ingestion/evidence.json
state/ingestion/research-plan.json
state/ingestion/research-evidence.json
state/ingestion/analysis.json
```

Provider 邊界固定：

- `semantic-handoff.json` / `semantic-judgement.json` 只可出現在 Threads。
- `research-plan.json` / `research-evidence.json` 只可出現在 GitHub。
- `research-plan.json` 與 `analysis.json` 不得同時存在；一個 run 只能表示「再研究一輪」或「提交最終分析」。
- 上述 handoff 全部是分支內暫存資料，正式 apply 成功後必須移除；不得進入 Workspace `main`。

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

### GitHub research handoff

GitHub request 第一次執行時，runner：

1. 取得並驗證 accepted source evidence，寫入 `evidence.json`。
2. 固定 default-branch repository revision，建立 bounded candidate discovery。
3. 建立 round 0 research progress。
4. 把 discovery、progress 與目前 bundle 寫入 `research-evidence.json`。

`research-evidence.json` 是 runner 管理的暫存狀態，固定外層：

```json
{
  "schema_version": 1,
  "provider": "github",
  "discovery": {},
  "progress": {},
  "bundle": null
}
```

完成 expansion 後，`bundle` 會是 cumulative Analysis Evidence Bundle，包含 selected primary-source text。這些全文只允許存在於專用 ingestion branch 的暫存 handoff；正式 writer 只保存 compact `state/research/**` provenance。

Agent 依 `evidence.json`、`research-evidence.json.discovery`、目前 cumulative bundle 與允許的 Workspace context 產生：

```json
{
  "schema_version": 1,
  "provider": "github",
  "plan": {},
  "selected_paths": [
    "docs/architecture.md"
  ]
}
```

其中 `plan` 必須符合正式 Research Plan contract；retry plan 必須以 `prior_analysis_evidence_digest` 綁定目前 cumulative bundle。每個 `selected_paths` 都必須是 discovery 已核准 candidate，而且符合至少一個 `needs_evidence` question 的 evidence kind 或 exact path hint。

runner 讀到 `research-plan.json` 後：

1. 重新驗證 accepted evidence、discovery、progress、current bundle 與 plan binding。
2. 套用 round / cumulative item / cumulative byte budget。
3. 依 frozen blob SHA 取得本輪新 evidence；不得重複先前 round 已讀 path。
4. 合併成新的 cumulative bundle、重算 `analysis_evidence_digest`。
5. 更新 `research-evidence.json` 並移除已消費的 `research-plan.json`。

預設最多兩個 expansion rounds。Round 1 後，Agent 可以在 budget 允許時提交第二份 digest-bound research plan，或直接產生最終 `analysis.json`；budget 已耗盡時只能進入分析，不得自由擴張第三輪。

GitHub 最終 `analysis.json` 必須使用 `analysis_version: 2`，並綁定 `research-evidence.json.bundle.analysis_evidence_digest`。Runner 重新驗證整份 analysis / source / research binding，再把 bundle 一併交給正式 writer。成功後留下正式 Card、accepted source state 與 compact research provenance state，並清除全部 ingestion handoff。

### Threads semantic handoff

Threads 保留既有 provider-aware 流程：

1. runner 先嘗試 strict structural reconstruction。
2. 只有 eligible continuation uncertainty 才寫入 `semantic-handoff.json`。
3. Agent 回填 digest-bound `semantic-judgement.json`。
4. runner 重新擷取 live source、重建候選並確認 digest 未變，再由 deterministic gate 決定是否形成 accepted `evidence.json`。
5. accepted evidence 後等待 `analysis_version: 1` 的 `analysis.json`，再由正式 writer 寫入 Card + accepted source state。

Threads 不使用 GitHub research plan / bundle，也不因 GitHub 的研究品質規則被迫補寫來源沒有的技術細節。

### Runner persistence guard

Reusable workflow 只在 handoff 實際產生 Repository 變更時提交；`waiting-*` stage 不建立空提交。每次持久化都必須：

- 只允許 result 回報的 exact `allowed_changed_paths`。
- push 前確認遠端 ingestion branch SHA 仍等於 run 開始時的 source SHA。
- 拒絕任何未列入 handoff contract 的檔案、任意 output path 或 shell command。
- apply 後重新驗證 Cards、accepted source state 與 research provenance state。

`state/ingestion/**` 不得合併到 Workspace `main`。

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
