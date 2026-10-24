# Knowledge Card 契約

Knowledge Card 是工作區中的 Markdown 文件。合法卡片必須同時符合前置中繼資料（frontmatter）、工作區分類體系、正文結構、所有權、集合唯一性與穩定路徑等契約；任一層驗證失敗，都不能視為合法卡片。

## 權威來源

目前有三個互補的權威來源：

1. [`schema/knowledge-card.schema.json`](../../schema/knowledge-card.schema.json)：定義前置中繼資料的結構、型別、日期／URI 格式與基本範圍。
2. 工作區 `config/taxonomy.yaml`：定義實際受控詞彙。
3. `packages/core` 驗證器：驗證正文順序、分類體系成員資格、所有權規則、日期順序、集合唯一性與穩定路徑。

分類體系本身由 [`schema/taxonomy.schema.json`](../../schema/taxonomy.schema.json) 驗證。JSON Schema 不重複保存工作區的受控詞彙值；卡片通過結構驗證後，`packages/core` 驗證器再依分類體系檢查各欄位是否使用合法值。

## 前置中繼資料

目前卡片的結構版本為 `1`。前置中繼資料必須且只能包含下列欄位：

| 欄位 | 契約 |
| --- | --- |
| `schema_version` | 目前只接受 `1`。 |
| `id` | 小寫英數與單一連字號分隔的穩定識別，例如 `github-owner-repo`。 |
| `title` | 非空字串；正文 H1 必須完全相同。 |
| `canonical_url` | 合法 URI；網址正規化由 [來源收錄契約](./ingestion.md) 負責。 |
| `source.type` | 非空字串，且必須存在於分類體系 `source_types`。 |
| `source.url` | 合法 URI。 |
| `source.identity` | 非空穩定來源識別；來源類型專屬規則同樣由來源收錄層定義。 |
| `resource_kind` | `{ ai, user }` 所有權包裝結構；有效值必須存在於分類體系 `resource_kinds`。 |
| `created_at` | `YYYY-MM-DD`；一般更新不可修改。 |
| `updated_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `last_checked_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `summary` | 1–600 字元。 |
| `navigation.categories` | `ai` 值為非空唯一字串陣列；`user` 值為 `null` 或非空唯一字串陣列；值需存在於 `navigation_categories`。 |
| `classification.categories` | 所有權形狀與 `navigation.categories` 相同；值需存在於分類體系 `categories`。 |
| `classification.tags` | `ai` 值為唯一字串陣列；`user` 值為 `null` 或唯一字串陣列。Workspace 若定義 `tag_policy`，兩者都必須使用已登錄的標準標籤 ID，並符合數量與排序規則。 |
| `relevance` | `ai` 與 `user` 都是「維度 → 1–5 整數」；`ai` 必須完整覆蓋所有分類體系相關性維度，`user` 只能覆寫已定義維度。 |
| `actions` | `ai` 值為非空唯一字串陣列；`user` 值為 `null` 或唯一字串陣列；值需是分類體系 `actions` 的鍵。 |
| `status` | `{ ai, user }` 所有權包裝結構；值需存在於分類體系 `statuses`。 |

Schema 設定 `additionalProperties: false`，因此未定義的前置中繼資料欄位會被拒絕。

## 分類體系契約

工作區 `config/taxonomy.yaml` 目前使用 `schema_version: 1`，必須定義：

- `categories`
- `navigation_categories`
- `relevance_dimensions`
- `relevance_scale`
- `actions`
- `statuses`
- `source_types`
- `resource_kinds`

`relevance_dimensions` 必須包含 `overall`；`relevance_scale` 必須且只能定義 1、2、3、4、5。

### 受控標籤政策

Workspace 可在 `config/taxonomy.yaml` 定義 `tag_policy`。這是向後相容的選用政策；一旦存在，全部 Card 必須遵守，不得只對新 Card 套用。

```yaml
tag_policy:
  min_per_card: 2
  max_per_card: 8
  canonical:
    agent-orchestration:
      label: Agent 編排
      description: 多步驟或多 Agent 之間的任務分配、協調與狀態控制。
  aliases:
    Agent orchestration: agent-orchestration
```

- `canonical` 的鍵是 Card 實際儲存的穩定標籤 ID，只能使用小寫英數與單一連字號分隔。
- `label` 是介面與人工維護用名稱；`description` 說明適用邊界。ID 是資料契約，不因顯示語言改名。
- `aliases` 只供受控遷移與舊值辨識，Card 不得保存別名。別名必須指向已登錄 ID，且不得與標準 ID 重複。
- `classification.tags.ai` 與非 `null` 的 `classification.tags.user` 都必須介於 `min_per_card` 與 `max_per_card`，並以 ID 字典順序儲存。
- 標籤用於跨 Card 重用的技術、機制、能力或生態關聯。單一專案名稱、版本、當下狀態、實作細節、同義改寫，以及已由 navigation／category／action／status 表達的資訊，不應另建標籤。
- 新概念若必須成為標籤，先在 `canonical` 加入 ID、顯示名稱與清楚邊界，通過完整 Workspace 驗證後才能用於 Card。Agent 不得在分析結果中臨時自創標籤。

未定義 `tag_policy` 的舊 Workspace 仍可使用自由字串標籤；此相容模式不提供標籤收旂或數量防護。

## AI 與使用者所有權

一般所有權包裝結構的有效值為：

```text
effective = user ?? ai
```

`relevance` 逐維套用覆寫：若 `relevance.user` 已提供某個維度，就使用使用者值；否則使用同一維度的 AI 值。

一般重新分析允許更新由 AI 管理的狀態，包括：

- `title`、`summary`
- 標準來源中繼資料
- `resource_kind.ai`
- `navigation`／`classification` 的 AI 值
- `relevance.ai`
- `actions.ai`
- `status.ai`
- 10 個 AI 分析正文段落
- 合法的 `updated_at`、`last_checked_at` 與更新紀錄

以下狀態在一般重新分析時不可改動：

- `id`
- `created_at`
- 所有 `*.user` 覆寫
- 完整 `## 使用者備註` 段落

`compareUserOwnedState(before, after)` 會直接比較兩份卡片，不依賴 Git HEAD。

## AI 文字語言要求

Knowledge Card 中由 AI 產生的自然語言內容包含 `title`、`summary` 與前 10 個分析正文段落。這些內容除了符合本文件的結構與所有權規則，也必須遵守目前 Knowledge Card Workspace 的分析語言政策；若 Workspace 沒有額外政策，則遵守 [執行契約](../../prompts/RUNTIME.md) 的預設語言與術語規則。

語言政策只作用於 AI 可更新內容，不得因此修改任何 `*.user` 覆寫或完整 `## 使用者備註`。來源證據、直接引用、程式碼與正式識別字也不因卡片語言政策而改寫。

本契約只確認語言政策的適用範圍與所有權邊界，不重複定義各語言的具體寫作規則。分析輸出的語言責任見 [分析與研究契約](./analysis.md)；實際 Knowledge Card 的敘述方式見 [Knowledge Card 寫作樣式](../../prompts/CARD_STYLE.md)。

`packages/core` 與 Schema 驗證器目前不使用英文比例或文體分類器判斷語言自然度；通過結構驗證不代表已自動通過語言品質檢查。

## 正文契約

正文必須有一個 H1，且 H1 文字與前置中繼資料 `title` 完全一致。

接著必須依序包含：

1. `## 一句話介紹`
2. `## 它解決什麼問題`
3. `## 核心概念`
4. `## 架構與技術`
5. `## 主要功能`
6. `## 技術亮點`
7. `## 限制與風險`
8. `## 與你的相關性`
9. `## 建議怎麼使用`
10. `## 與其他收藏的關聯`
11. `## 使用者備註`
12. `## 更新紀錄`

前 10 段屬於分析結果中的 AI 內容；「使用者備註」在一般重新分析時必須逐字保留。寫入器可在「更新紀錄」追加建立紀錄或實質分析更新紀錄。

這 12 個頂層段落是 Card 的結構契約，不是研究或閱讀來源的順序。Agent 必須先依 [Knowledge Card 知識編輯提示](../../prompts/KNOWLEDGE_EDITOR.md) 讀完本輪最終證據並形成整體理解；**完成理解後才讀 [Knowledge Card 寫作樣式](../../prompts/CARD_STYLE.md)**，再把既有理解整理成上述正文結構。

本契約只固定 H1、頂層段落順序與所有權。子標題安排、條列方式、敘述節奏、內容取捨與各段具體寫法，以 `CARD_STYLE.md` 為權威來源，不在這裡重複維護。

寫作樣式不改變前置中繼資料 Schema，也不新增或刪除頂層正文段落。`packages/core` 驗證器仍負責 H1、頂層段落順序、分類、所有權、日期、唯一性與穩定路徑；它不以編輯樣式中的子標題數量或條列形式判定既有 Card 是否結構合法。

來源簡單時可以保持簡潔；證據不足時應明確保留未知，不得為了填滿段落而臆造內容。

## 集合唯一性

同一工作區的完整卡片集合不得出現重複：

- `id`
- `source.identity`
- `canonical_url`

卡片驗證器會對集合中的值做唯一性檢查；來源進入工作區前，收錄層會先把支援來源轉成標準來源識別與標準網址，再由新建／更新解析器檢查來源衝突。

## 日期與更新語意

卡片驗證器保證：

- `updated_at >= created_at`
- `last_checked_at >= created_at`

已接受來源寫入器目前的行為：

- 新建時，三個日期使用已接受證據的擷取日期。
- 更新時，若 AI 分析或標準來源狀態有實質變更，`updated_at` 更新為擷取日期。
- 若分析內容沒有實質變更，保留原 `updated_at`。
- 成功處理已接受證據時，`last_checked_at` 更新為擷取日期。
- 驗證失敗時，不應把來源狀態當成已重新檢查成功；詳見 [來源收錄契約](./ingestion.md)。

## 穩定路徑

新卡片的穩定路徑：

```text
content/knowledge/{created_at year}/{id}.md
```

既有卡片更新時沿用原有檔案路徑，不因標題、AI 分析或 URL 輸入形式改名。

## 驗證責任

Card 驗證會同時檢查：

- 前置中繼資料是否符合 Schema。
- 分類體系受控值與成員資格。
- 受控標籤的成員資格、數量、排序與別名目標。
- H1 與頂層正文段落順序。
- 日期與所有權規則。
- `id`、`source.identity` 與 `canonical_url` 的集合唯一性。
- 新建與更新後的穩定路徑。

驗證指令與開發操作方式集中在 [開發與驗證指南](../guides/development.md)，本契約只定義 Card 必須符合的規則。
