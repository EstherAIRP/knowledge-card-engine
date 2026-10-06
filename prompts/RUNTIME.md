# Knowledge Card 執行契約

> **角色：** Knowledge Card 任務的跨領域執行編排  
> **文件導航：** [`../docs/index.md`](../docs/index.md)  
> **工程與資料安全：** [`../AGENTS.md`](../AGENTS.md)

本文件規定 Agent 收到 Knowledge Card 任務後的執行順序、倉庫選擇、跨領域守門、失敗處理與完成回報。來源、分析、Card、生成資料、發布與私人網站的詳細規則，由各自的正式規格與驗證器維護；本文件只描述它們應以什麼順序銜接，不建立第二套領域規格。

## 語言與術語

- 一般中文回覆、正式文件與任務完成回報使用自然繁體中文。
- 產生或重新分析 Knowledge Card 前，若 Workspace 有明確語言政策，必須讀取並遵守。
- 官方名稱、程式識別字、API、欄位、指令、路徑、錯誤碼、狀態值與不宜硬譯的標準名稱保留原文；其餘內容避免不必要的中英夾雜。
- 語言整理不得改寫來源證據、使用者覆寫或完整 `## 使用者備註`。

## 1. 任務判定

以下輸入預設視為 Knowledge Card 收錄或更新意圖，不需再次確認：

- 技術文章、GitHub、論文、官方文件、工具或產品 URL。
- 使用者要求重新分析既有 Card。
- 使用者要求修改 Card 的人工狀態、分類、標籤、評分、動作、備註或關聯設定。

這只代表任務意圖，不代表來源已受支援。來源必須通過目前 Engine 的正式契約；不支援或驗證失敗時，停止正式寫入，不得用模型記憶或手工建立 Card 繞過流程。

若使用者明確要求說明、審查、規劃、比較或其他不寫入倉庫的工作，只處理該要求，不應自動修改資料。

## 2. 確定目標倉庫與有效 Engine

Knowledge Card 由公開的 Knowledge Card Engine 與私人的 Knowledge Card Workspace 組成。

### Engine 任務

程式、Schema、共用規則、來源實作、網站、可重用工作流程、正式公開文件與合成測試資料屬於：

```text
EstherAIRP/knowledge-card-engine
```

開工前至少讀取 `README.md`、`AGENTS.md`、本文件、`docs/index.md`，以及本次任務直接相關的規格、程式與測試。

### Workspace 任務

私人背景、專案、Knowledge Card、人工設定、來源狀態、研究追溯、生成資料與發布紀錄屬於私人 Workspace。

開工前至少讀取 Workspace 的 `README.md`、`AGENTS.md`、`workspace.yaml`、`engine.lock.json`、本次需要的私人政策與既有資料，以及 `engine.lock.json.engine_commit` 指定版本的 Engine 契約與實作。

Workspace 不直接追隨 Engine `main`。會影響寫入、驗證、來源、Schema、CLI 或發布的能力，只能使用 Workspace 目前鎖定的完整 Engine SHA。不能因 Engine `main` 已有新功能，就假設目前 Workspace 已可使用。

## 3. 開工前狀態檢查

任何會修改倉庫的任務，先確認：

- 目標倉庫與 `main` 的目前狀態。
- 目前分支與可取得的工作樹狀態。
- 既有相關短期分支與未合併 PR。
- 是否已有同一來源、Card 或任務的進行中成果。
- Workspace 任務實際鎖定的 Engine 完整 SHA。

不得因換對話、重試、標題差異或網址形式差異建立重複 Card、重複分支或重複 PR。發現無關的既有修改時，保留原狀，不用重設、強制推送或清理方式消除。

## 4. 公私資料邊界

跨領域執行必須維持以下邊界：

```text
Engine = 公開程式、契約與合成資料
Workspace = 私人權威資料與私人衍生資料
```

- 真實私人背景、專案、Card、人工設定、來源狀態與私人衍生資料不得進入公開 Engine、公開 PR、公開測試資料、日誌或建置產物。
- 密鑰、權杖、私鑰與其他憑證不得提交到 Git。
- 私人背景只能依 Workspace 明確政策使用；「可供分析」不等於「可寫入 Card 正文」。
- 聊天記憶、未授權個人資訊或 Agent 自行推測的背景，不得補入正式資料。

倉庫工程與資料安全細則由 [`AGENTS.md`](../AGENTS.md) 負責；本文件只把這些邊界當成每個執行階段都必須遵守的守門條件。

## 5. 收錄與證據

正式收錄先依 [來源收錄契約](../docs/specs/ingestion.md) 驗證來源身分、標準網址、來源完整性與已接受證據。一般網址可以正規化，不代表已有正式來源供應者。

收錄階段只在目前契約允許的範圍內取得來源與研究材料。來源專屬演算法、GitHub 固定版本擷取、Threads 完整性、交接資料形狀與擷取限制，都以 Ingestion spec 為準；Runtime 不重複列舉。

執行環境失敗必須和來源本身失敗分開。網路、外部服務、授權、速率限制或執行器能力不足時，不得把結果冒充為「來源不存在」或「來源不完整」。無法完成已接受證據驗證，就不能建立或更新正式 Card。

### Remote Ingest

若目前互動環境不能安全執行 Workspace 鎖定的 Engine，而 Workspace 已配置核准的 Remote Ingest，應使用該正式交接流程，不得手工模擬寫入成功。

Agent 只處理交接結果明確要求的下一步，例如提供必要判定、研究計畫、選定來源或最終分析；來源取得、交接狀態驗證與正式持久化仍由固定版本 Engine 執行。詳細狀態與限制只以 [來源收錄契約](../docs/specs/ingestion.md) 和 [分析與研究契約](../docs/specs/analysis.md) 為準。

## 6. 分析與知識整理

取得本輪最終有效證據後，先讀 [Knowledge Card 知識編輯提示](./KNOWLEDGE_EDITOR.md)，再依執行器或正式流程指定的目前證據重新閱讀並形成整體理解。

**在整體理解形成以前，不得先讀 `CARD_STYLE.md`。**研究計畫、覆蓋狀態與結構化研究結果可以協助檢查證據，但**不能取代重新閱讀來源文字，也不能直接當成卡片大綱**。

如果本輪有效證據後來改變，先前依舊證據形成的理解與分析不得沿用；必須重新閱讀目前有效證據。

整體理解形成後，才讀 [Knowledge Card 寫作樣式](./CARD_STYLE.md)、[Knowledge Card 契約](../docs/specs/card.md) 與 Workspace 語言政策，把既有理解整理成正式分析結果。更新既有 Card 時，也是在形成本輪理解後才讀舊 Card；舊 AI 正文不是本輪事實證據。

分析版本、研究計畫、證據包、摘要值綁定、品質門檻與研究追溯，全部以 [分析與研究契約](../docs/specs/analysis.md) 為準。Runtime 不再重複欄位或版本規則。

## 7. 新建、更新與所有權

正式寫入前，依來源收錄契約判斷應新建還是更新既有 Card；同一來源不能因網址形式或重試而建立重複 Card。

Card 結構、穩定 `id`、`created_at`、使用者覆寫、`## 使用者備註`、日期與穩定路徑等規則，由 [Knowledge Card 契約](../docs/specs/card.md) 與驗證器負責。

Agent 不得手工改寫正式來源 Card 來繞過寫入器。使用者明確要求修改人工值時，只修改要求涵蓋的使用者管理內容，不順帶重寫其他人工資料。

## 8. 寫入與驗證

支援來源的正式 Card、來源狀態與必要研究追溯資訊，必須由目前 Engine 的正式 Workspace 寫入流程處理。持久化前應完成本次流程要求的來源、分析、Workspace、Card、所有權與集合驗證；任一必要驗證失敗，都不能宣稱正式狀態已更新。

實際驗證與 CLI 指令以目前 Engine 的 [開發與驗證指南](../docs/guides/development.md) 為準，不從其他版本混用命令。

## 9. 生成資料與發布

`data/**` 與 `releases/**` 是機器管理的私人衍生資料，不應以手工修改生成產物或目前發布指標來表達使用者意圖。

權威資料進入 Workspace `main` 後，再依 Workspace 現行流程建立生成資料與發布版本。生成資料契約見 [生成資料、搜尋與圖譜契約](../docs/specs/generated-data.md)；發布版本一致性見 [一致發布契約](../docs/specs/release.md)。

以下狀態必須分開回報：

```text
Card 寫入或合併成功
!= 生成資料建立成功
!= 發布指標推進成功
!= 部署成功
!= 線上讀回驗證成功
```

沒有實際驗證後續狀態時，不得籠統回報「發布完成」。

## 10. 分支、提交與 PR

- `main` 是唯一長期分支，不得 force push。
- Engine 的功能、修正、Schema、正式文件與共用工作流程變更使用短期分支與 PR。
- Workspace 的修改依 Workspace `AGENTS.md` 執行。
- 分支使用 `feat/`、`fix/`、`docs/`、`chore/` 或 `migration/` 前綴。
- 一項任務使用一個可驗收的短期分支。
- 合併前執行與變更相關的測試、格式檢查、建置與資料驗證。
- 不得刪除測試、放寬規則或以假資料冒充成功。
- 合併後依倉庫政策刪除工作分支。

## 11. 失敗處理

發生下列情況時停止會改變正式狀態的步驟，不用推測補完：

- 必要倉庫、Workspace 或鎖定的 Engine 無法取得。
- Workspace 鎖定版本與實際執行版本不一致。
- 來源、分析、Card、Workspace、生成資料、發布或授權的必要驗證失敗。
- 來源類型不受目前版本支援。
- 執行會造成私人資料進入公開 Engine。

失敗回報應指出實際層級與已確認原因，例如執行環境、來源、分析、Card、提交、發布或部署；不要用模糊的「來源不可用」或「發布失敗」取代可確認的狀態。

## 12. 進度與完成回報

執行期間只在重要狀態改變時回報，例如來源接受完成、必要研究或判定完成、分析套用與驗證完成、PR 建立或合併，以及本次任務實際涉及的發布、部署與線上讀回。

外部工作流程進入成功、失敗或取消等終態時，如果它影響下一個正式步驟，先回報已驗證結果，再繼續執行。短期分支消失時，先查 PR、合併提交與目標分支狀態，不直接判定成果遺失。

完成回報至少包含：

- 修改的倉庫與主要內容。
- 執行的驗證與結果。
- commit、PR 與合併狀態。
- 本次若涉及發布或部署，回報實際確認到的狀態。
- 尚未完成或無法驗證的事項。

只回報已實際完成或已驗證的結果。

## 13. 權威來源

跨領域執行時依下列權威來源分工：

- 資料形狀：JSON Schema。
- 受控詞彙：Workspace `config/taxonomy.yaml`。
- Card 結構與所有權：`docs/specs/card.md`。
- Workspace 結構與 Engine 版本鎖定：`docs/specs/workspace.md`。
- 來源識別、已接受證據與受控來源擷取：`docs/specs/ingestion.md`。
- 研究與分析證據：`docs/specs/analysis.md`。
- 生成資料：`docs/specs/generated-data.md`。
- 發布一致性：`docs/specs/release.md`。
- 登入、授權與私人讀取：`docs/specs/private-site.md`。
- Agent 的來源閱讀與知識取捨：`prompts/KNOWLEDGE_EDITOR.md`。
- Knowledge Card 的表達方式：`prompts/CARD_STYLE.md`。
- 跨領域執行順序：本文件。
- 倉庫工程與修改安全：`AGENTS.md`。

文件、Schema、驗證器、測試或實際行為互相衝突時，把衝突視為缺陷，不自行挑選較方便的規則，也不降低驗證標準。
