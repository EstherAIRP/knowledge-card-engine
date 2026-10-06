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
→ 來源供應者專屬解析與穩定來源識別
→ 已接受來源證據
→ 必要時依研究需求受控擷取更多第一手來源
→ 交由分析契約產生並驗證分析結果
→ 新建／更新解析
→ Workspace 寫入器驗證完整 Card 集合與所有權
→ Card + 已接受來源狀態 + 必要的研究追溯狀態持久化
```

來源收錄層回答的是「來源是誰、來源是否可接受，以及可安全取得哪些來源資料」。它負責來源識別、已接受證據、來源完整性與受控擷取，不定義分析結果的內容品質。

研究計畫、分析證據包、分析版本、證據綁定與品質門檻由 [分析與研究契約](./analysis.md) 定義。Workspace 寫入器只接受已通過來源與分析契約的結果，再依 Knowledge Card 所有權與集合規則完成正式寫入。

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

## GitHub 研究來源擷取

GitHub 已接受證據只回答來源是否可接受。若分析需要 README 以外的第一手資料，來源收錄層可在固定倉庫版本上提供受控探索與擷取；研究問題、研究計畫、分析證據包及品質門檻則由 [分析與研究契約](./analysis.md) 負責。

兩層責任不可混用：

- Ingestion 固定倉庫版本、驗證路徑、讀取 Git blob，並限制擷取輪次、項目數與位元組數。
- Analysis 判斷還缺哪些證據、驗證研究計畫與分析證據包，並以摘要值把最終分析綁定到實際證據。
- 研究深度不足不等於來源不完整；已接受來源證據不會因後續研究結果而被改寫。

### 固定倉庫版本與過期防護

探索程序先讀取預設分支目前的提交，固定：

- `repository_revision`：40 字元提交 SHA。
- `root_tree_sha`：該提交的根目錄樹 SHA。

接著以同一 `repository_revision` 重新檢查 README。若 Git blob SHA 已與已接受證據中的 README SHA 不同，回報 `SOURCE_RESEARCH_STALE`，不得把舊的來源接受結果與新的倉庫內容混在同一次研究。

### 候選探索

GitHub 倉庫目錄樹透過 Git tree API 逐層、受限展開。候選提示優先涵蓋具有研究價值的第一手文字來源，例如 README、架構文件、設定、進入點、API、資料模型、Schema、安全、工作流程、部署、授權、代表性原始碼與測試。

生成目錄、第三方套件、相依套件、建置／快取目錄、套件鎖定檔、壓縮檔與明確非文字內容不進候選集合。候選只提供導覽與已知 Git blob 中繼資料，**不是允許清單**；Agent 仍可選擇候選以外、但能在同一固定版本中驗證的安全第一手文字檔。

探索與擷取都有硬性上限，目前預設：

| 項目 | 預設上限 |
| --- | ---: |
| 目錄樹請求 | 64 |
| 目錄樹項目 | 4000 |
| 候選項目 | 500 |
| 目錄深度 | 5 |
| 擴充輪次 | 2 |
| 選定證據項目（累計） | 20 |
| 單一項目 | 163840 位元組 |
| 選定證據總量（累計） | 786432 位元組 |

呼叫端只能把上限調低，不能提高 Engine 的硬性上限。探索若因上限或 GitHub 回應截斷而未完整走完，會以 `exhaustive: false` 與確定性的停止原因記錄結果。

### 選定來源與擷取

選定路徑必須是安全、非重複的倉庫相對路徑。若路徑已在候選集合中，可以重用其 Git blob 中繼資料；若不在候選集合，Engine 會在同一 `repository_revision` 重新解析該精確路徑，確認它是存在於該版本的一般文字檔後再讀取內容。

以下內容一律拒絕：

- 任意 URL、其他分支或其他倉庫。
- Engine 明確排除的生成、第三方套件、相依套件、建置或快取目錄。
- 二進位、非 UTF-8 或超過單檔／累計上限的內容。
- 多輪研究中已經取得過的路徑。

每次成功擷取都保留固定版本、路徑、Git blob SHA、內容雜湊與位元組數等可驗證資訊，供 Analysis 建立或更新分析證據包。分析證據包的欄位、`analysis_evidence_digest`、研究計畫重試綁定與品質門檻，以 [分析與研究契約](./analysis.md) 為唯一權威來源。

### 受限擴充

多輪研究由 Analysis 產生並驗證研究計畫，Ingestion 只依已驗證計畫與目前進度決定是否還能擷取下一輪來源。續行時仍必須遵守固定倉庫版本、安全路徑、不得重複、累計項目數與累計位元組上限。

目前最多擴充兩輪。第二輪後即使仍有未知事項，也必須停止擷取；未取得的關鍵證據由分析契約以明確的不可用原因保留，而不是繼續無界限讀取倉庫。

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

## 與分析契約的交界

來源收錄層不定義分析內容，也不固定特定模型供應商。正式分析結果必須先通過 [分析與研究契約](./analysis.md)，來源收錄流程只確認它綁定的是本次有效來源與研究證據。

目前交界如下：

- 來源供應者專屬直接 CLI 與 Threads Remote Ingest 使用 `analysis_version: 1`，綁定目前已接受來源證據。
- GitHub Remote Ingest 使用 `analysis_version: 2`，除已接受來源證據外，還必須綁定目前最終分析證據包。
- 來源或分析證據摘要值只要已改變，舊分析就不得套用，也不得推進 Card、已接受來源狀態或研究追溯狀態。

分析版本的欄位、研究報告、品質門檻、重新閱讀順序與證據綁定規則只在 Analysis 契約定義；本文件不重複維護。

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

### 研究追溯狀態

研究追溯狀態不屬於已接受來源狀態。GitHub 研究型分析成功後，Workspace 只保存精簡追溯資訊，不永久保存研究來源原文；其資料內容、與分析證據的綁定及驗證要求由 [分析與研究契約](./analysis.md) 定義。

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

GitHub Remote Ingest 會把來源擷取與分析判斷分成可驗證的交接步驟：

1. 執行器先取得已接受來源證據，固定預設分支倉庫版本，建立受限候選探索與尚未選取研究來源的初始進度。
2. Agent 依 [分析與研究契約](./analysis.md) 提交研究計畫與選定路徑；執行器重新驗證計畫所依據的證據狀態，再依本文件的固定版本、路徑安全與擷取上限取得第一輪來源。
3. 第一輪證據形成後，Agent 可以提交最終分析，或在仍有額度時提交第二份研究計畫。第二輪仍使用同一固定倉庫版本，並拒絕重複路徑、過期計畫與超出累計上限的要求。
4. 最終分析必須綁定目前有效的分析證據包。執行器重新驗證來源、研究證據與分析後，才交給正式 Workspace 寫入器。
5. 正式套用成功後，只留下 Card、已接受來源狀態與精簡研究追溯狀態；來源全文與交接檔全部移除。

`research-plan.json` 與 `research-evidence.json` 的資料形狀、研究問題、`analysis_evidence_digest` 與品質門檻以 Analysis 契約為準；Ingestion 不另行定義第二份分析規格。

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

## 操作入口

GitHub、Threads 與 Remote Ingest 都必須使用 Engine 提供的正式收錄入口，不得以手工寫檔取代來源驗證、分析綁定與 Workspace 寫入器。

實際 CLI 指令、參數與 Remote Ingest 執行方式集中在 [開發與驗證指南](../guides/development.md)。本契約只定義來源識別、已接受證據、受控擷取、交接守門與正式寫入前置條件。
