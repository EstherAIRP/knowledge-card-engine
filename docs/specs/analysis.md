# 分析與研究契約

`packages/analysis` 定義分析結果、研究計畫、分析證據包、結構化研究報告與證據綁定。分析層回答的是「目前證據足以支持哪些分析，以及分析與哪些證據綁定」；它不自行擷取外部來源、不操作 Knowledge Card Workspace 檔案系統，也不指定特定模型供應商。

來源身分、來源完整性、已接受來源證據，以及 GitHub 固定版本的安全來源擷取由 [來源收錄契約](./ingestion.md) 負責。Analysis 從已驗證的來源證據開始工作，不重新定義來源是否可接受。

## 分析版本

目前驗證器支援兩種可由機器辨識的分析格式：

| `analysis_version` | 綁定 | 用途 |
| --- | --- | --- |
| `1` | `source_identity + evidence_digest` | 來源供應者專屬直接 CLI 與 Threads Remote Ingest 使用的已接受來源分析。 |
| `2` | `source_identity + source_evidence_digest + analysis_evidence_digest` | 需要獨立研究證據包的研究型分析契約。 |

`analysis_version: 1` 與 `2` 的摘要值欄位不可混用。版本 1 不接受 `research`、`source_evidence_digest` 或 `analysis_evidence_digest`；版本 2 不使用 `evidence_digest`。

兩個版本都必須提供相同的卡片 AI 可更新中繼資料與十個正文段落，並維持 `summary` 長度、相關性分數與段落契約。

## 輸出語言與術語

分析產生的卡片 AI 可更新中繼資料、十個正文段落，以及會進入卡片敘述的自由文字，必須符合 [Knowledge Card 契約](./card.md) 的 AI 文字語言規則與 Knowledge Card Workspace 明確的分析語言政策。研究報告中會供卡片分析使用的敘述性研究結果，也應遵守同一政策；證據引用、程式識別字與受控狀態值則維持原契約。

語言整理不得：

- 改寫已接受來源證據或分析證據包內的來源文字。
- 為了中文化而翻譯直接引用、程式碼或官方識別字。
- 因來源為英文，就讓卡片敘述大量沿用可自然翻成中文的一般概念。
- 修改使用者覆寫、使用者備註或其他受所有權契約保護的狀態。

目前分析驗證器會驗證版本、欄位、摘要值綁定、研究覆蓋、研究結果與品質門檻，但不使用自然語言分類器判斷中英夾雜程度。因此輸出語言仍由執行契約、Knowledge Card Workspace 政策與執行 Agent 共同約束；通過結構與資料驗證，不代表已自動通過語言品質檢測。

## 分析產生前的重新閱讀與整合

分析資料契約只規定輸出的可驗證形狀與證據綁定；它不把研究計畫、研究覆蓋或 Card 正文段落順序定義成模型的閱讀順序。

在正式建立分析結果前，執行 Agent 必須先依 [Knowledge Card 知識編輯提示](../../prompts/KNOWLEDGE_EDITOR.md) 重新閱讀本輪最終有效證據：

- 版本 1：重新閱讀目前已接受來源證據。
- GitHub 版本 2：重新閱讀目前已接受來源證據與最終分析證據包內的已選來源原文。
- 若版本 2 的證據包因第二輪研究而改變，先前以舊 `analysis_evidence_digest` 形成的理解不得沿用。
- 形成整體理解以前，不先載入 [Knowledge Card 寫作樣式](../../prompts/CARD_STYLE.md)，也不使用 Card 正文段落當作閱讀來源的分類框架。
- 更新既有 Card 時，先依本輪證據形成新的整體理解，再讀既有 Card；舊 AI 正文不是本輪證據。
- 整體理解形成後，才讀 `CARD_STYLE.md` 與 Knowledge Card 契約，把既有理解映射成分析結果。

這一步是 Agent 的知識整理順序，不新增 `analysis_version`、不新增持久化欄位，也不要求保存新的中間推理資料。最終仍只輸出本文件定義的分析結果；完整內部推理過程不屬於資料契約。

結構化研究報告用來驗證證據覆蓋、研究結果與證據引用是否成立，但不能直接取代最終來源閱讀，也不應被逐欄改寫成 Card 正文。Card 的十個正文段落與寫作樣式都只在整體理解形成後才套用。

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

目前分析證據包只定義 GitHub 倉庫形式；其他來源類型若沒有正式研究證據包契約，驗證器會拒絕繼續處理。

GitHub 分析證據所使用的來源文字由 Ingestion 的受控擷取能力取得。Ingestion 負責固定倉庫版本、驗證安全路徑、讀取 Git blob 與限制擷取量；Analysis 則負責研究計畫、證據包結構、摘要值與品質門檻。候選探索只是導覽，不是允許清單。完整的版本鎖定、路徑防護、擷取上限與二進位／UTF-8 規則見 [來源收錄契約](./ingestion.md)。

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

只有 `needs_evidence` 可要求 `evidence_kinds` 或 `path_hints`。路徑提示必須是安全的倉庫相對路徑；它只是研究提示，不是可直接執行的外部 URL、命令列指令或擷取權限。

GitHub 多輪擴充在收錄層另有重試綁定：Remote Ingest 從第 0 輪開始，第一份 Agent 研究計畫不帶 `prior_analysis_evidence_digest`；第一輪已驗證證據包形成後，若 Agent 還需要第二輪證據，新計畫必須把 `prior_analysis_evidence_digest` 設為目前證據包的 `analysis_evidence_digest`。這個欄位用來證明新的關鍵研究問題判定是基於目前研究證據，而不是較舊的證據包。

目前可表達的 `kind` 包含 `README`、`documentation`、`manifest`、`configuration`、`entrypoint`、`API`、`data model`、`auth`、`security`、`background job`、`deployment`、`license`、`source`、`test` 與 `other`。

研究計畫只描述還缺哪些證據，以及選定來源應對應哪些研究問題；它不授予任意來源存取權。實際可讀路徑、固定倉庫版本、輪次與位元組上限仍由 Ingestion 驗證。

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

## Knowledge Card Workspace 寫入器邊界

`packages/workspace` 的 `applyAcceptedSourceAnalysis(...)` 只接受已通過來源與分析契約的資料：

- `analysis_version: 1` 不得傳入分析證據包。
- GitHub `analysis_version: 2` 必須同時傳入與已接受來源綁定、且已驗證的分析證據包。
- Threads 目前沒有研究證據包契約，因此正式寫入器只接受版本 1 分析。

寫入器會重新驗證分析版本、來源摘要值與必要的研究摘要值，再依 Knowledge Card 所有權與集合規則建立或更新 Card。GitHub 版本 2 成功寫入時，Card、已接受來源狀態與研究追溯狀態必須在同一交易中推進；任一驗證或檔案替換失敗，都不能留下部分更新。

若同一 GitHub Card 之後以版本 1 成功更新，既有研究追溯狀態會在同一交易中移除，避免舊研究被誤認為目前分析依據。

Remote Ingest 如何準備交接檔、擷取來源與限制研究輪次，由 [來源收錄契約](./ingestion.md) 定義；本文件只定義研究計畫、分析證據與最終分析必須滿足的條件。

## 研究追溯狀態

GitHub 版本 2 成功寫入後，Knowledge Card Workspace 會保存精簡的研究追溯狀態：

```text
state/research/github/{owner-lower}--{repo-lower}.json
```

此狀態保存目前分析所依據的來源／研究摘要值、固定倉庫版本、證據項目的 `path`／`kind`／Git blob SHA／內容雜湊／位元組數、覆蓋狀態、分析時間與 Card 對應。它不保存：

- 證據來源全文 `text`。
- 結構化研究結果。
- `unknowns`。
- 任何 GitHub 或模型憑證。

`npm run research-state:validate` 會驗證研究狀態的結構與固定路徑，並交叉確認目前已接受來源狀態的 `evidence_digest`、擷取時間與 Card 對應，以及實際 Card 的 id、來源識別與標準網址。GitHub 的關鍵覆蓋維度不可在持久化狀態中改成 `not_applicable`。

研究追溯狀態是分析證據的精簡持久化投影，不是已接受來源狀態，也不能取代分析證據包本身。

## 錯誤語意

研究契約沿用既有分析的「驗證失敗即拒絕」原則，主要錯誤包含：

| 錯誤碼 | 意義 |
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
