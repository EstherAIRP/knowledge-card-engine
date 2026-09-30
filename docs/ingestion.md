# 來源收錄契約

目前正式支援兩種來源供應者：

| 來源供應者 | 可接受輸入 | 穩定來源身分 | Card 來源類型 | 已接受證據 |
| --- | --- | --- | --- | --- |
| GitHub 倉庫 | GitHub 倉庫 URL 與其子路徑 | `github:{owner-lower}/{repo-lower}` | `github` | 倉庫中繼資料 + 非空 README |
| Threads | `threads.com`／`threads.net` 的貼文、`/share/*`、`/t/*` | `threads:{root_shortcode}` | `article` | 已解析至根貼文，且通過結構完整性或受控高信心語意復原的有序貼文集合 |

其他 HTTP(S) URL 目前只有通用網址正規化輔助函式，沒有通用內容擷取器；不能因 URL 可被正規化就視為可正式收錄。

## 共通資料流

```text
來源 URL
→ 來源供應者專屬解析／標準來源識別
→ 已接受證據
→ 可選的 GitHub 研究證據包
→ 與證據綁定的分析結果
→ 新建／更新解析
→ 遵守所有權規則的 Card 候選
→ 完整集合驗證
→ Card + 已接受來源狀態 + 可選的研究追溯資訊持久化
```

來源收錄、分析與 Workspace 持久化是不同責任層：來源收錄負責驗證外部來源、建立已接受證據，並可為 GitHub 擷取固定倉庫版本的受控研究證據；分析層產生與來源／研究摘要值綁定的 AI 管理結果；Workspace 寫入器才會把合法結果合併進 Card、已接受來源狀態與必要的精簡研究追溯資訊。

來源擷取失敗與來源本身不完整必須分開。網路、速率限制、執行器能力或其他執行環境問題不能冒充來源不存在或來源不完整。

## URL 正規化與來源識別

### GitHub 倉庫

以下形式都解析到 GitHub 倉庫根網址：

- `github.com/owner/repo`
- `www.github.com/owner/repo/`
- `github.com/owner/repo.git`
- 帶查詢參數／片段的 GitHub 倉庫 URL
- `/tree/...`、`/blob/...` 等 GitHub 倉庫子路徑

正規化後產生：

- 來源供應者：`github`
- 來源類型：`github`
- 標準網址：GitHub 倉庫根網址
- 來源識別：`github:{owner-lower}/{repo-lower}`
- 建議 ID：`github-{owner-lower}-{repo-lower}`

已接受證據的最終標準網址使用 GitHub 中繼資料的 `full_name` 組成；來源識別一律使用小寫的 `owner/repo`。

### Threads

支援 Threads 主機名稱 `threads.com` 與 `threads.net`，以及：

- `/@user/post/<shortcode>`
- `/share/<token>`
- `/t/<token>`

直接貼文 URL 可立即取得該貼文的短碼（shortcode）；`share`／`t` 路徑代碼只是暫時導向識別，**不得**作為正式 `source.identity`。來源供應者必須先解析到具體 Threads 貼文，再依結構證據重建其根貼文；正式來源識別只使用：

```text
threads:{root_shortcode}
```

正式標準網址是根貼文：

```text
https://threads.com/@user/post/{root_shortcode}
```

因此分享連結、中間篇或最後一篇只要能驗證屬於同一完整串文，都應解析成同一來源並更新同一張 Card。

### 通用 HTTP(S)

通用網址正規化會移除 URL 片段、移除 `www.`、刪除已知追蹤查詢參數、保留其他具有語意的查詢參數，並產生 `url:{canonical-url}` 來源識別。這不代表該來源已有可建立已接受證據的來源供應者。

## GitHub 已接受證據

正式 GitHub 證據必須通過 `validateGitHubEvidence`，至少包含：

- `provider: github` 與 `accepted: true`。
- 標準網址與 `source_identity` 一致。
- 合法的擷取時間。
- GitHub 倉庫 `full_name`、`default_branch` 與其他已接受中繼資料。
- 請求來源識別與中繼資料 `html_url`／`full_name` 的來源識別一致。
- GitHub 倉庫未停用。
- 非空 README。
- README SHA、UTF-8 位元組數與內容 SHA-256。
- 由已接受倉庫中繼資料與 README 摘要中繼資料計算的 `evidence_digest`。

README 全文只存在於分析輸入的已接受證據；已接受來源狀態不保存 README 全文。

## GitHub 研究證據

GitHub 已接受證據只回答來源是否可接受；需要超出 README 的技術分析時，可另外建立固定倉庫版本的研究證據。研究階段不改變已接受來源證據，也不會把「研究深度不足」視為來源接受失敗。

Knowledge Card Engine 提供固定倉庫版本的探索／擷取基礎操作，以及可驗證的受限擴充流程：

```text
已接受 GitHub 證據
→ discoverGitHubResearchCandidates(...)
→ 固定倉庫版本 + 受限候選提示
→ createGitHubResearchProgress(...) 建立第 0 輪狀態
→ Agent 關鍵研究問題計畫 + 選定路徑
→ evaluateGitHubResearchContinuation(...)
→ 在固定版本驗證選定路徑
→ fetchGitHubResearchExpansion(...)
→ 累積分析證據包
→ 可選的第二份研究計畫，綁定先前 analysis_evidence_digest
→ 可選的第二輪擴充
→ 確定性停止
```

`fetchGitHubResearchEvidence(...)` 仍可直接建立單次選定證據包；需要依關鍵研究問題進行多輪擴充時，必須使用研究進度／續行契約，不能由呼叫端自行忽略輪次或累計上限。

### 固定倉庫版本與過期防護

探索程序先讀取預設分支目前的提交，固定：

- `repository_revision`：40 字元提交 SHA。
- `root_tree_sha`：該提交的根目錄樹 SHA。

接著以同一 `repository_revision` 重新查 README。若其 Git blob SHA 已與已接受證據的 README SHA 不同，回報 `SOURCE_RESEARCH_STALE`，不得把較舊的來源接受結果與較新的倉庫目錄樹混成同一份研究證據包。

### 候選探索

GitHub 倉庫目錄樹透過 Git tree API 逐層、受限展開。Knowledge Card Engine 產生可能具有研究價值、可視為第一手文字來源的候選提示，例如：

- README、架構／設計文件。
- 相依套件／建置清單檔（manifest）。
- 設定、進入點、API／路由。
- 資料模型／Schema／遷移。
- 授權／安全。
- 背景工作／工作流程。
- 部署／容器。
- LICENSE。
- 具代表性的原始碼／測試。

常見生成目錄、第三方套件目錄、相依套件目錄、建置／快取目錄，以及套件鎖定檔、壓縮後檔案、非文字副檔名不進候選集合。候選探索只提供受限的倉庫導覽與已知 Git blob 中繼資料，不代表只有候選集合中的檔案才可被選為證據。

探索程序有硬性上限；目前預設：

| 項目 | 預設上限 |
| --- | ---: |
| 目錄樹請求 | 64 |
| 目錄樹項目 | 4000 |
| 候選項目 | 500 |
| 目錄深度 | 5 |
| 擴充輪次 | 2 |
| 選定證據項目（累計） | 20 |
| 單一項目 | 163840 位元組 |
| 選定證據包總量（累計） | 786432 位元組 |

呼叫端只能把上限調低，不能透過選項提高 Knowledge Card Engine 的硬性上限。

探索程序若因上限或 GitHub 回應被截斷而未完整走完，會把 `exhaustive` 設為 `false`，並保存確定性的 `stop_reasons`；目前可能值：

- `tree_request_budget_exhausted`
- `tree_entry_budget_exhausted`
- `candidate_budget_exhausted`
- `depth_budget_exhausted`
- `github_tree_truncated`

### 選定證據

`fetchGitHubResearchEvidence(...)` 接受非空、不得重複的安全倉庫相對路徑。若路徑已存在於探索候選集合，Knowledge Card Engine 可直接使用探索結果的 Git blob 中繼資料；若不在候選集合，Knowledge Card Engine 會以固定的 `repository_revision` 重新解析該精確路徑，確認它是存在於同一倉庫版本的一般文字檔，再取得對應的 Git blob。選定路徑不能指定任意 URL、任意分支、其他倉庫、被排除的生成／第三方套件／相依套件／建置／快取目錄、非文字內容或命令列指令。

因此探索候選之外的核心第一手來源仍可由 Agent 主動選取，但內容仍固定於同一倉庫版本，且仍須通過相同的路徑、二進位內容、UTF-8、項目數與位元組上限檢查。每個選定項目會保存：

- 確定性的 `evidence_id`
- 倉庫相對 `path`
- 證據 `kind`
- Git blob SHA：`blob_sha`
- `content_sha256`
- UTF-8 位元組數：`bytes`
- `text`

二進位、非 UTF-8、超過單檔或總證據包上限的內容一律拒絕。

### 受限證據擴充

`createGitHubResearchProgress(...)` 建立第 0 輪進度；此時尚無選定研究項目。進度會綁定已接受來源摘要值與探索結果的倉庫版本，並記錄：

- `completed_rounds`
- 已選路徑
- 累計項目數
- 累計位元組數
- 目前 `analysis_evidence_digest`

`evaluateGitHubResearchContinuation(...)` 只依已驗證研究計畫、目前進度、目前證據包與探索上限決定是否繼續。結果只有：

- `needs_evidence`：仍有研究問題明確要求證據，而且輪次、項目數與位元組上限都還有額度。
- `plan_complete`：目前研究計畫沒有任何 `needs_evidence`。
- `round_budget_exhausted`：已完成最大擴充輪次。
- `item_budget_exhausted`：累計選定項目已達上限。
- `byte_budget_exhausted`：累計證據位元組數已達上限。

第一輪研究計畫不得帶先前研究摘要值。完成一輪後，下一份研究計畫若仍要求證據，必須帶：

```text
prior_analysis_evidence_digest == current bundle.analysis_evidence_digest
```

摘要值不一致時回報 `GITHUB_RESEARCH_PLAN_STALE`，不得把較舊的關鍵研究問題判定套到新的累積證據。

`fetchGitHubResearchExpansion(...)` 另外限制：

- 每輪選定路徑必須是安全的倉庫相對路徑；候選集合之外的路徑由 Knowledge Card Engine 在同一固定版本重新解析與驗證。
- 選定路徑不得落在 Knowledge Card Engine 排除目錄，且必須是受支援的第一手文字來源。
- 已在先前輪次使用的路徑不可重複擷取。
- 選定證據必須符合至少一個 `needs_evidence` 問題的證據類型或精確路徑提示。
- 項目數與位元組上限以累計證據包計算，不會因拆成多輪而重置。
- 每次成功擴充都重新計算累積的 `analysis_evidence_digest`。

目前研究進度最多記錄兩輪。Remote Ingest 從空的第 0 輪開始；第一輪與可能的第二輪都由 Agent 根據關鍵研究問題選取證據路徑，再交給 Knowledge Card Engine 驗證與擷取。第二輪後必須停止研究擴充；後續結構化研究報告應以 `unavailable`／`budget_exhausted` 表達缺口，而不是繼續無界限讀取倉庫。

最後形成的分析證據包由 [分析與研究契約](./analysis.md) 驗證，並產生獨立的 `analysis_evidence_digest`。這份全文證據包是分析輸入，不是已接受來源狀態。GitHub `analysis_version: 2` 會把已驗證證據包一併交給正式 Workspace 寫入器；寫入器只永久保存精簡研究追溯資訊。GitHub Remote Ingest 的準備階段只寫入已接受證據、固定倉庫版本的探索結果，以及 `completed_rounds: 0`／`bundle: null` 的 `research-evidence.json`；Agent 必須先用 `research-plan.json` 指定第一輪關鍵證據。第一輪證據包形成後可直接提交最終版本 2 分析，或在剩餘額度內再要求一次與摘要值綁定的擴充。直接 `ingest:github` CLI 不接收研究證據包，因此仍使用版本 1 的已接受來源分析。

## Threads 已接受證據

正式 Threads 證據必須通過 `validateThreadsEvidence`。來源供應者先以原生結構證據重建串文；只有在結構資料不足但仍屬於可受控判定的續篇不確定性時，才允許進入語意復原。任何已知缺篇、結構歧義、來源身分衝突或執行環境失敗都不能由語意判定覆蓋。

來源供應者的處理順序是：

```text
Threads 輸入 URL
→ 必要時解析暫時網址
→ 公開 HTTP 擷取
→ HTTP 證據不足時使用公開瀏覽器備援
→ 嚴格重建回覆／根貼文關係圖
→ 結構完整性檢查
→ 只有符合條件的續篇不確定性可繼續
→ 與摘要值綁定的語意判定
→ 確定性接受門檻
→ 有序 parts[]
→ combined_text
→ 已接受證據摘要值
```

瀏覽器備援只讀取公開 Threads 頁面已渲染的 DOM 與同源公開 JSON 回應，不使用登入狀態、私人 Cookie 或私人帳號資料。若執行器缺少可啟動的瀏覽器執行環境、網路被阻擋或頁面無法取得，屬於執行失敗，不得降級成來源不完整。

### 結構驗證

結構證據足夠時直接接受，不經語意判定。已接受證據必須符合：

- `provider: threads`、`accepted: true`、`source_type: article`。
- 根貼文標準網址與 `threads:{root_shortcode}` 完全一致。
- `requested_url` 與 `resolved_input_url` 可追溯本次輸入與實際貼文。
- `resolved_input_url`／`input_shortcode` 指向的實際輸入貼文必須在已接受的 `parts[]` 中恰好出現一次，且 `thread.input_index` 必須指向同一位置；直接貼文請求不得解析成另一個短碼。
- `thread.complete: true` 且 `thread.verification: structural`。
- 串文狀態只能是 `SINGLE_POST` 或 `COMPLETE_THREAD`。
- `thread.total`、`detected_parts` 與 `parts.length` 一致。
- 每個 `parts[]` 項目都有可驗證的短碼、標準網址、作者與固定順序。
- 所有 `parts[]` 項目與根貼文為同一作者。
- `combined_text` 必須等於依 `parts[]` 順序串接的文字。
- 來源至少包含文字或媒體等可分析內容。
- `evidence_digest` 必須符合已接受串文的內容指紋。

若根貼文明示仍有回覆，但目前只擷取到單篇，且串文涵蓋範圍尚未證明完整，不能直接把「只看到根貼文」當成「已證明只有根貼文」。

### 受控語意續篇復原

只有嚴格結構重建失敗，而且失敗屬於可判定的續篇不確定性時，Knowledge Card Engine 才建立候選集合。預設候選規則包含：同作者、在根貼文之後、時間差不超過 24 小時、明確排除非回覆，最多 8 個候選；候選另計算確定性中繼資料分數。

語意判定是固定資料契約，不直接決定已接受證據。Remote Ingest 的判定必須由 `knowledge_card_agent` 產生，並包含：

- `selected_shortcodes`
- `root_only`
- `confidence`
- `complete`
- `rationale`

一般續篇重建以有序 `selected_shortcodes` 作為唯一具有權威性的選取結果；`candidate_labels` 可省略，也不參與正文組裝或續篇接受判定。只有判定 `root_only: true` 時，才必須提供完整 `candidate_labels`，逐一把每個候選高信心標成 `followup` 或 `unrelated`。

Knowledge Card Engine 重新套用確定性門檻。至少要求整體 `confidence >= 0.90`；選擇續篇時，選定短碼必須來自目前證據、不得重複，且必須維持時間順序；第一個選定候選項目的中繼資料分數必須達最低門檻。判定 `root_only` 時，每個候選都必須明確排除，不能存在續篇或不確定候選項目。

語意復原成功後，已接受證據使用：

- `thread.verification: llm_assisted`
- `INFERRED_THREAD_HIGH_CONFIDENCE` 或 `INFERRED_SINGLE_POST_HIGH_CONFIDENCE`
- `extraction.inferred: true`
- `thread.recovery` 保存 `confidence`、選定短碼、`candidate_labels` 與排序器追溯資訊。

這個能力只能處理結構資料「不足以辨識續篇」的缺口，不能覆蓋更強且互相衝突的結構證據，也不能把已知缺篇或有歧義的關係圖推定成完整。

### 與摘要值綁定的語意交接

Remote Ingest 需要語意判定時，Knowledge Card Engine 先輸出 `semantic-handoff.json`，其中包含公開根貼文／候選證據及其 SHA-256 摘要值。Agent 回填的 `semantic-judgement.json` 必須帶相同摘要值。

第二次執行不直接信任先前快照；Knowledge Card Engine 會重新取得來源、重新建立候選並重新計算摘要值。若來源或候選證據已改變，回報 `THREADS_CONTINUATION_HANDOFF_EVIDENCE_MISMATCH` 並停止，不得把舊判定套到新來源。

Threads 證據會保留完整有序文字與媒體資訊供分析使用；已接受來源狀態只保存來源與 `parts[]` 各項目的雜湊值／結構指紋，以及語意復原追溯資訊，不保存 Threads 原文。媒體 URL 中易變的查詢參數／片段不參與證據摘要值的穩定內容識別。

## 驗證失敗即拒絕的錯誤

常見錯誤：

| 錯誤碼 | 意義 |
| --- | --- |
| `SOURCE_URL_INVALID` | URL 不是合法支援格式。 |
| `SOURCE_PROVIDER_UNSUPPORTED` | 請求／證據的來源供應者尚未支援。 |
| `INGESTION_EXECUTION_FAILED` | 網路、速率限制、外部服務或執行環境使驗證無法完成。 |
| `SOURCE_NOT_FOUND` | 來源供應者明確證明來源不存在；目前主要由 GitHub 404 使用。 |
| `SOURCE_ACCESS_DENIED` | 來源供應者明確拒絕授權。 |
| `SOURCE_FETCH_FAILED` | 其他可辨識的來源 HTTP 失敗。 |
| `SOURCE_INCOMPLETE` | 必要證據、來源完整性或摘要值驗證未通過。 |
| `SOURCE_IDENTITY_MISMATCH` | 請求、解析、標準或來源內容的來源識別不一致。 |
| `SOURCE_CAPTURE_TIME_INVALID` | 擷取時間無效。 |
| `SOURCE_RESEARCH_STALE` | GitHub 已接受 README 與固定研究版本的 README Git blob 已不一致。 |
| `GITHUB_RESEARCH_LIMIT_INVALID` | 呼叫端提供的研究上限無效，或試圖使用未定義的上限。 |
| `GITHUB_RESEARCH_DISCOVERY_INVALID` | GitHub 研究探索結構、候選項目或受限中繼資料無效。 |
| `GITHUB_RESEARCH_PATH_INVALID` | 研究路徑不是安全的倉庫相對路徑。 |
| `GITHUB_RESEARCH_PATH_NOT_CANDIDATE` | 要求擷取的路徑不在受控探索候選集合。 |
| `GITHUB_RESEARCH_SELECTION_INVALID` | 選定路徑集合為空、重複或形狀無效。 |
| `GITHUB_RESEARCH_SELECTION_REPEATED` | 多輪研究再次要求已取得的路徑。 |
| `GITHUB_RESEARCH_SELECTION_NOT_REQUESTED` | 選定候選項目不符合任何目前的 `needs_evidence` 問題。 |
| `GITHUB_RESEARCH_PLAN_STALE` | 重試研究計畫綁定的先前分析證據摘要值已過期或缺失。 |
| `GITHUB_RESEARCH_PROGRESS_INVALID` | 研究進度與已接受來源、倉庫版本、證據包、項目／位元組累計值不一致。 |
| `GITHUB_RESEARCH_EXPANSION_STOPPED` | 續行已依研究計畫／上限判定必須停止，仍嘗試擷取下一輪證據。 |
| `GITHUB_RESEARCH_BUDGET_EXCEEDED` | 選定研究證據超過單輪可用或累計的項目數／位元組上限。 |
| `GITHUB_RESEARCH_BINARY_UNSUPPORTED` | 選定的 Git blob 不是可接受的 UTF-8 文字內容。 |
| `INGESTION_IDENTITY_CONFLICT` | Knowledge Card Workspace 內的來源識別／標準網址對應互相衝突或已有重複資料。 |

## 分析結果契約

分析供應者不屬於來源收錄層。Knowledge Card Engine 不固定特定 LLM 供應商。

正式分析結果必須符合 [分析與研究契約](./analysis.md)：

- 版本 1 綁定 `source_identity + evidence_digest`；來源供應者專屬直接 CLI 與 Threads Remote Ingest 使用此格式。GitHub Remote Ingest 不使用版本 1；準備階段必須先建立非空、固定倉庫版本且已驗證的分析證據包，之後才能提交版本 2。
- GitHub 版本 2 綁定 `source_identity + source_evidence_digest + analysis_evidence_digest`，並必須一併提供已驗證分析證據包與結構化研究報告。
- 兩種版本都提供 Card 契約要求的 AI 管理中繼資料與 10 個正文段落；`summary` 不超過 600 字元，相關性分數為 1–5 整數。
- Threads 目前沒有研究證據包契約，因此不得使用版本 2。

由舊來源證據或舊研究證據包產生的分析不能套用到新的摘要值；綁定不一致時一律拒絕，且不得寫入 Card、已接受來源狀態或研究狀態。

當本輪證據已固定並準備產生最終分析時，Agent 必須先依 [Knowledge Card 知識編輯提示契約](../prompts/KNOWLEDGE_EDITOR.md) 重新閱讀目前有效的來源證據。GitHub 版本 2 另須重新閱讀目前最終證據包中的已選來源原文；若又完成一輪擴充，舊整理與舊分析都不得沿用。Threads 則重新閱讀最終已接受串文，不以語意判定草稿、搜尋摘要或先前候選代替來源。

這個重新閱讀步驟不建立新的來源收錄狀態；它只規定 Agent 從已驗證交接證據產生 `analysis.json` 前的處理順序。

## 新建／更新解析

Knowledge Card Workspace 寫入器載入完整 Card 集合後依序解析：

1. `source.identity`
2. 標準網址

規則：

- 來源識別或標準網址對應多張 Card：一律拒絕。
- 來源識別與標準網址分別指向不同 Card：一律拒絕。
- 任一方式解析到同一張既有 Card：`update`。
- 兩者都沒有既有 Card：`create`，使用來源供應者建議的穩定 ID。

新建依 Card 契約建立穩定路徑。更新保留原路徑、`id`、`created_at`、所有使用者覆寫與完整「使用者備註」。

## 寫入器驗證與持久化

`applyAcceptedSourceAnalysis(workspaceRoot, evidence, analysis, options)` 是與來源供應者無關的正式寫入器；GitHub 版本 2 透過 `options.analysisEvidenceBundle` 傳入研究證據包。`applyAcceptedGitHubAnalysis` 與 `applyAcceptedThreadsAnalysis` 是來源供應者專屬的驗證／相容入口。

任何正式寫入前會：

1. 驗證來源供應者專屬已接受證據。
2. 驗證分析與來源證據綁定；GitHub 版本 2 另外驗證分析證據包、研究摘要值與結構化品質門檻。
3. 載入 Knowledge Card Workspace、分類體系與完整 Card 集合。
4. 解析新建／更新目標。
5. 建立合併後 Card 候選。
6. 更新時比較所有使用者管理狀態與穩定狀態。
7. 對候選的完整集合執行 Card／分類體系／唯一性驗證。
8. 建立並驗證對應來源供應者的已接受來源狀態。
9. GitHub 版本 2 建立並驗證精簡研究追溯狀態。

全部驗證完成後，寫入器將 Card、已接受來源狀態與需要的研究狀態視為同一檔案交易。任一檔案替換失敗時會回復已提交項目；驗證失敗時三者都不前進。若同一 GitHub Card 後續成功套用版本 1，既有研究狀態會在同一交易移除，避免過期追溯資訊被誤認為目前 Card 的研究依據。

## 已接受來源狀態

GitHub：

```text
state/sources/github/{owner-lower}--{repo-lower}.json
```

保存倉庫中繼資料摘要、README SHA／內容 SHA-256／位元組數、`evidence_digest` 與 Card 對應，不保存 README 全文。

Threads：

```text
state/sources/threads/{root-shortcode-slug}-{identity-hash}.json
```

保存根來源識別／標準網址、作者、串文狀態／總數／驗證方式、每個 `parts[]` 項目的短碼／標準網址／回覆與根貼文結構、文字位元組數，以及文字／媒體／引用 SHA-256 與 Card 對應；不保存 Threads 原文。

`npm run source-state:validate` 會遞迴驗證 `state/sources/**` 的已支援來源供應者，並確認 `card_path` 位於設定的知識根目錄，且狀態中的 Card id／來源識別／標準網址與實際 Card 相同。

### GitHub 研究追溯狀態

GitHub 版本 2 成功寫入後，另保存：

```text
state/research/github/{owner-lower}--{repo-lower}.json
```

此狀態只保存來源／研究摘要值、倉庫版本、證據項目的 `path`／`kind`／Git blob SHA／內容雜湊／位元組數、覆蓋狀態、分析時間與 Card 對應；不保存證據 `text`、結構化研究結果、`unknowns` 或憑證。

`npm run research-state:validate` 會驗證研究狀態本身的結構與固定路徑，並交叉確認目前已接受來源狀態的 `evidence_digest`、擷取時間與 Card 對應，以及實際 Card 的 id／來源識別／標準網址。GitHub 的關鍵覆蓋維度不可在持久化狀態中改成 `not_applicable`。

## Remote Ingest 交接

當互動環境不能安全執行目前 Knowledge Card Workspace 鎖定的 Knowledge Card Engine 時，Workspace 可使用可重用的 `.github/workflows/ingest-workspace.yml`。Remote Ingest 不建立第二套寫入器；最終套用仍走 `applyAcceptedSourceAnalysis(...)`。

每個任務使用獨立 `chore/ingest-*` Workspace 分支。交接目錄只允許下列暫存檔：

```text
state/ingestion/request.json
state/ingestion/semantic-handoff.json
state/ingestion/semantic-judgement.json
state/ingestion/evidence.json
state/ingestion/research-plan.json
state/ingestion/research-evidence.json
state/ingestion/analysis.json
```

來源供應者邊界固定：

- `semantic-handoff.json`／`semantic-judgement.json` 只可出現在 Threads。
- `research-plan.json`／`research-evidence.json` 只可出現在 GitHub。
- `research-plan.json` 與 `analysis.json` 不得同時存在；一次執行只能表示「再研究一輪」或「提交最終分析」。
- 上述交接檔全部是分支內暫存資料，正式套用成功後必須移除；不得進入 Workspace `main`。

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

當執行器已具備可產生分析的最終證據時，結果會額外回傳暫存的 `analysis_handoff` 提示：

~~~json
{
  "reread_required": true,
  "input_paths": [
    "state/ingestion/evidence.json",
    "state/ingestion/research-evidence.json"
  ],
  "output_path": "state/ingestion/analysis.json",
  "evidence_digest": "<已接受證據摘要值>",
  "analysis_evidence_digest": "<最終 GitHub 證據包摘要值或 null>"
}
~~~

這個物件只存在於執行器結果／日誌，不是新的 Workspace 狀態，也不會提交到 `main`。GitHub 在第一輪或第二輪證據包形成後，`input_paths` 包含已接受證據與目前的 `research-evidence.json`；Threads 已接受證據完成後只包含 `evidence.json`。新的 Agent 工作階段應直接依這些目前交接檔案重新讀取，不依賴前一段對話或舊摘要。

若 GitHub 又完成一輪研究擴充，新的結果會帶新的 `analysis_evidence_digest`；任何綁定舊摘要值的 `analysis.json` 都會由正式分析驗證拒絕。

### GitHub 研究交接

GitHub 請求第一次執行時，執行器：

1. 取得並驗證已接受來源證據，寫入 `evidence.json`。
2. 固定預設分支的倉庫版本，建立受限候選探索。
3. 以 `createGitHubResearchProgress(...)` 建立 `completed_rounds: 0`、尚未擷取任何研究項目的進度。
4. 把探索結果、第 0 輪進度與 `bundle: null` 寫入 `research-evidence.json`。
5. 回報 `waiting_for: research-plan`；此階段不得直接提交 GitHub 版本 2 分析。

`research-evidence.json` 是執行器管理的暫存狀態，第一次準備階段的外層形狀為：

```json
{
  "schema_version": 1,
  "provider": "github",
  "discovery": {},
  "progress": {
    "completed_rounds": 0,
    "selected_paths": [],
    "analysis_evidence_digest": null
  },
  "bundle": null
}
```

探索候選提供受限倉庫導覽、證據類型與已知 Git blob 中繼資料，但不代表只有候選集合中的檔案才能被 Agent 選為證據。Agent 必須先判斷關鍵研究問題，再提交第一份 `research-plan.json`：

```json
{
  "schema_version": 1,
  "provider": "github",
  "plan": {},
  "selected_paths": [
    "skills/example/SKILL.md",
    "docs/architecture.md"
  ]
}
```

第一份 `plan` 必須符合正式研究計畫契約，且不得帶 `prior_analysis_evidence_digest`。每個 `selected_paths` 都必須符合至少一個 `needs_evidence` 問題的證據類型或精確路徑提示。

執行器讀到 `research-plan.json` 後：

1. 重新驗證已接受證據、探索結果與第 0 輪進度。
2. 套用輪次、累計項目數與累計位元組上限。
3. 對每個選定路徑做安全的倉庫相對路徑驗證。
4. 若路徑已存在於探索候選集合，使用其固定版本的 Git blob 中繼資料；若不在候選集合，則以同一 `repository_revision` 重新解析精確路徑，確認它是存在於該倉庫版本的受支援第一手文字來源。
5. 拒絕 Knowledge Card Engine 排除目錄、任意 URL／分支／其他倉庫、二進位／非 UTF-8，以及超過單檔或累計上限的內容。
6. 依固定的 Git blob SHA 擷取第一輪證據，建立累積分析證據包。
7. 更新 `research-evidence.json` 為 `completed_rounds: 1`、非空證據包，並移除已消費的 `research-plan.json`。

第一輪證據包形成後，Agent 有兩個合法下一步：

- 證據已足夠：重新閱讀目前 `evidence.json` 與最終 `research-evidence.json` 證據包，完成知識整合後，再提交綁定目前 `analysis_evidence_digest` 的最終 `analysis.json`。
- 仍缺關鍵證據：提交第二份 `research-plan.json` 做第二輪擴充；新的證據包形成後，再以新證據重新閱讀與整合。

第二份研究計畫必須以：

```text
prior_analysis_evidence_digest == current bundle.analysis_evidence_digest
```

綁定目前累積證據。執行器會再次驗證先前摘要值、剩餘輪次／項目數／位元組上限、重複路徑與研究計畫相關性；第二輪選定路徑同樣可以是探索候選項目，或候選目錄之外但能在同一固定版本驗證的安全第一手文字來源。

目前最大 `max_expansion_rounds` 為 2，因此最多有兩輪 Agent 指定的證據擷取。第二輪後即使仍有關鍵未知事項，也只能進入分析，以 `unavailable`／`budget_exhausted` 表達缺口。

證據包內的已選第一手來源原文只允許存在於專用來源收錄分支的暫存交接檔；正式寫入器只保存精簡的 `state/research/**` 追溯資訊。GitHub 最終 `analysis.json` 必須使用 `analysis_version: 2`，並綁定目前 `research-evidence.json.bundle.analysis_evidence_digest`。執行器會重新驗證完整的分析／來源／研究綁定，再把證據包一併交給正式寫入器。成功後留下正式 Card、已接受來源狀態與精簡研究追溯狀態，並清除全部來源收錄交接檔。

### Threads 語意交接

Threads 保留既有依來源供應者分流的流程：

1. 執行器先嘗試嚴格結構重建。
2. 只有符合條件的續篇不確定性才寫入 `semantic-handoff.json`。
3. Agent 回填與摘要值綁定的 `semantic-judgement.json`。
4. 執行器重新擷取即時來源、重建候選並確認摘要值未變，再由確定性門檻決定是否形成已接受的 `evidence.json`。
5. 已接受證據後等待 `analysis_version: 1` 的 `analysis.json`，再由正式寫入器寫入 Card 與已接受來源狀態。

Threads 不使用 GitHub 研究計畫／證據包，也不因 GitHub 的研究品質規則被迫補寫來源沒有的技術細節。

### 執行器持久化守門

可重用工作流程只在交接實際產生倉庫變更時提交；`waiting-*` 階段不建立空提交。Agent 提交本身也受版本鏈結守門：初始提交只能改 `request.json`；後續判定、研究計畫或分析提交只能改目前單一輸入檔，而且必須直接接在上一個由執行器管理的交接提交之後。這可防止在其他提交先竄改執行器管理的已接受／研究證據，再把舊或偽造狀態帶入下一輪。

每次持久化都必須：

- 只允許結果回報的精確 `allowed_changed_paths`。
- 推送前確認遠端來源收錄分支 SHA 仍等於執行開始時的來源 SHA。
- 拒絕任何未列入交接契約的檔案、任意輸出路徑 或命令列指令。
- 套用後重新驗證 Knowledge Card 集合、已接受來源狀態與研究追溯狀態。

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

兩者都可用 `--evidence-file=accepted-evidence.json` 注入已取得且仍需重新驗證的證據，並可用 `--captured-at=<iso>` 固定擷取時間。GitHub 即時擷取需要授權時使用 `GITHUB_TOKEN`；密鑰不得提交。

受控 Remote Ingest 執行器：

```bash
npm run ingest:handoff -- /path/to/workspace --result-file=/tmp/ingest-result.json
```

分析 JSON 必須已綁定本次已接受證據；CLI 不會動態載入任意分析器程式。
