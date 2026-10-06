# Knowledge Card Engine 架構

Knowledge Card 由公開的 Knowledge Card Engine 與私人的 Knowledge Card Workspace 共同組成。

Knowledge Card Engine 保存可公開重用的程式、Schema、驗證器與共用自動化；Knowledge Card Workspace 保存真實的個人背景、專案、Knowledge Card、來源狀態、生成資料與發布紀錄。公開 Engine 的測試、範例與建置產物不得包含真實私人資料。

## 系統組成

| 路徑 | 主要責任 |
| --- | --- |
| `apps/web` | 私人 Knowledge Card 的瀏覽、搜尋與圖譜介面；私人資料只在授權完成後由 API 載入。 |
| `apps/server` | GitHub App 登入、工作階段、Workspace 資格驗證，以及私人 Card／搜尋／圖譜／發布 API。 |
| `packages/core` | Knowledge Card 與分類體系解析、Schema 驗證、所有權、正文契約、集合唯一性與穩定路徑。 |
| `packages/ingestion` | 來源網址正規化、來源識別、GitHub／Threads 已接受證據，以及受控的來源資料擷取。 |
| `packages/analysis` | 分析結果、研究計畫、分析證據包、結構化研究報告與證據綁定。 |
| `packages/graph` | 搜尋、向量、Card 關聯、Concept 與圖譜等生成資料。 |
| `packages/workspace` | Workspace 載入、Engine 版本鎖定，以及經驗證的 Card 與狀態寫入。 |
| `packages/release` | 生成資料資訊清單、發布描述、目前發布指標與發布版本一致性。 |

各模組以明確契約連接，不互相跨越責任：

- 來源收錄層負責確認「來源是誰、來源是否可接受，以及可安全取得哪些來源資料」。
- 分析層負責確認「目前證據足以支持哪些分析，以及分析與哪些證據綁定」。
- Workspace 寫入器負責把通過驗證的分析套用到既有或新建的 Knowledge Card，並保護使用者管理狀態。
- 生成資料與發布流程只從已驗證的 Workspace 狀態建立可重建資料，不改寫 Knowledge Card 的人工意圖。
- 私人網站只在授權通過後讀取已驗證的 Workspace 或發布快照。

詳細規則分別由對應的正式契約定義，本文件不重複欄位、版本與執行步驟。

## 高階資料流

```text
公開來源 URL
→ 來源解析與已接受證據
→ 必要時取得受控研究來源
→ 與證據綁定的分析
→ 建立或更新 Knowledge Card
→ 寫入來源／研究狀態
→ Workspace 完整驗證
→ 建立搜尋、向量、關聯、Concept 與 Graph
→ 建立一致發布版本
→ 授權後由私人 Web / API 讀取
```

來源是否可接受由 [來源收錄契約](../specs/ingestion.md) 決定；研究計畫、分析證據與分析品質由 [分析與研究契約](../specs/analysis.md) 決定。兩者完成後，正式寫入器才會建立或更新 Knowledge Card。

生成資料由 [生成資料、搜尋與圖譜契約](../specs/generated-data.md) 定義；發布版本的一致性由 [一致發布契約](../specs/release.md) 定義。

## 資料權威

Knowledge Card 的不同資料由不同權威來源負責：

- Card 前置中繼資料形狀：[Knowledge Card Schema](../../schema/knowledge-card.schema.json)。
- 分類體系資料形狀：[Taxonomy Schema](../../schema/taxonomy.schema.json)。
- Workspace 實際受控詞彙：各 Knowledge Card Workspace 的 `config/taxonomy.yaml`。
- Knowledge Card 所有權、正文、唯一性與穩定路徑：[Knowledge Card 契約](../specs/card.md)。
- Workspace 結構與 Engine 版本鎖定：[Knowledge Card Workspace 契約](../specs/workspace.md)。
- 來源識別與已接受來源證據：[來源收錄契約](../specs/ingestion.md)。
- 研究證據、分析結果與研究追溯：[分析與研究契約](../specs/analysis.md)。
- 搜尋、向量、關聯、Concept 與 Graph：[生成資料、搜尋與圖譜契約](../specs/generated-data.md)。
- 發布版本與讀取快照：[一致發布契約](../specs/release.md)。
- 登入、授權與私人 API：[私人網站與授權契約](../specs/private-site.md)。

同一規則只應由一個主要權威來源完整定義；其他文件只描述必要的交界並連回該權威來源。

## Knowledge Card Engine 與 Workspace 邊界

Knowledge Card Engine 不推測私人 Workspace 的位置。呼叫端必須明確提供工作區根目錄；Knowledge Card Workspace 則以 `engine.lock.json` 固定核准的 Engine 提交版本。

公開 Engine 不保存真實私人 Knowledge Card、背景、專案、來源狀態、向量、關聯、圖譜或發布資料。這些資料只存在私人 Workspace 與授權後的執行環境。

完整 Workspace 結構與版本鎖定規則見 [Knowledge Card Workspace 契約](../specs/workspace.md)。

## 私人讀取流程

```text
瀏覽器
→ GitHub App 登入與 Workspace 資格驗證
→ 伺服器端私人 API
→ 已驗證的 Workspace／發布快照
→ Card、搜尋、圖譜與發布資料
```

登入與授權決定「誰可以讀取」；一致發布決定「讀取哪一個完整版本」。

因此私人 API 必須先完成授權，才可使用伺服器端快照；一旦存在正式發布版本，Card、搜尋、圖譜與發布資訊必須來自同一個已驗證發布快照，不能混用不同版本。

授權與工作階段規則見 [私人網站與授權契約](../specs/private-site.md)；發布快照與版本一致性見 [一致發布契約](../specs/release.md)；介面行為見 [網頁介面與版面配置](../specs/web-ui.md)。
