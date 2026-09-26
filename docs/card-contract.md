# Knowledge Card 契約

Knowledge Card 是工作區中的 Markdown 文件。合法卡片必須同時符合前置中繼資料（frontmatter）、工作區分類體系、正文結構、所有權、集合唯一性與穩定路徑等契約；任一層驗證失敗，都不能視為合法卡片。

## 權威來源

目前有三個互補的權威來源：

1. [`schema/knowledge-card.schema.json`](../schema/knowledge-card.schema.json)：定義前置中繼資料的結構、型別、日期／URI 格式與基本範圍。
2. 工作區 `config/taxonomy.yaml`：定義實際受控詞彙。
3. `packages/core` 驗證器：驗證正文順序、分類體系成員資格、所有權規則、日期順序、集合唯一性與穩定路徑。

分類體系本身由 [`schema/taxonomy.schema.json`](../schema/taxonomy.schema.json) 驗證。JSON Schema 不重複保存工作區的受控詞彙值；卡片通過結構驗證後，Core 驗證器再依分類體系檢查各欄位是否使用合法值。

## 前置中繼資料

目前卡片的結構版本為 `1`。前置中繼資料必須且只能包含下列欄位：

| 欄位 | 契約 |
| --- | --- |
| `schema_version` | 目前只接受 `1`。 |
| `id` | 小寫英數與單一連字號分隔的穩定識別，例如 `github-owner-repo`。 |
| `title` | 非空字串；正文 H1 必須完全相同。 |
| `canonical_url` | 合法 URI；來源收錄層負責網址正規化。 |
| `source.type` | 非空字串，且必須存在於分類體系 `source_types`。 |
| `source.url` | 合法 URI。 |
| `source.identity` | 非空穩定來源識別；來源類型專屬規則由收錄契約定義。 |
| `resource_kind` | `{ ai, user }` 所有權包裝結構；有效值必須存在於分類體系 `resource_kinds`。 |
| `created_at` | `YYYY-MM-DD`；一般更新不可修改。 |
| `updated_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `last_checked_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `summary` | 1–600 字元。 |
| `navigation.categories` | `ai` 值為非空唯一字串陣列；`user` 值為 `null` 或非空唯一字串陣列；值需存在於 `navigation_categories`。 |
| `classification.categories` | 所有權形狀與 `navigation.categories` 相同；值需存在於分類體系 `categories`。 |
| `classification.tags` | `ai` 值為唯一字串陣列；`user` 值為 `null` 或唯一字串陣列；標籤目前不是分類體系受控值。 |
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

## AI 文字語言契約

Knowledge Card 中由 AI 產生的自然語言內容包含 `title`、`summary` 與前 10 個分析正文段落。這些內容除了符合結構與證據契約，也必須遵守工作區明確的分析語言政策；若工作區沒有額外政策，則遵守執行契約中的預設語言與術語規則。

當目標語言為中文時：

- 使用自然繁體中文敘述，不模仿來源的中英夾雜語體。
- 已有成熟中文譯名的一般概念優先使用中文；來源是英文或技術文件，不構成大量保留英文敘述的理由。
- 官方專案／產品名稱、程式碼、API、函式、參數、欄位、識別字、指令、檔案路徑、縮寫、錯誤碼、狀態值與不宜硬譯的標準名稱保留原文。
- 重要術語首次需要中英對照時，可使用「中文（English）」格式，後續優先使用中文。
- 直接引用、程式碼與來源證據保持原文，不為符合卡片敘述語言而改寫證據。

語言整理只適用於 AI 可更新內容，不得因此重寫任何 `*.user` 覆寫或完整 `## 使用者備註`。目前 Core 與 Schema 驗證器會驗證卡片的資料形狀、正文結構、分類體系、所有權、日期、唯一性與穩定路徑，**不會使用英文比例或文體分類器來機器判定語言自然度**；語言規則屬於分析與 Agent 的輸出契約，違反時應視為分析品質缺陷。

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

前 10 段是最終呈現結構，不是研究計畫或閱讀來源的順序。Agent 應先依 [Knowledge Card 知識編輯提示](../prompts/KNOWLEDGE_EDITOR.md) 讀完本輪最終證據並形成整體理解；**完成理解後才讀 [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md)**，不得先用 section 或模板分類來源，也不得把 research question、structured findings 或 README 章節逐項改寫成正文。

目前寫作樣式要求：

- 「核心概念」選 2～3 個真正重要的主題，各以 `###` 標示並解釋概念內容。
- 「架構與技術」使用條列詳述主要元件、階段、資料流與重要技術邊界。
- 「主要功能」使用條列整理真正有助於理解用途的主要能力。
- 「技術亮點」選 2～3 個有辨識度、值得記住的設計或機制，各以 `###` 標示並說明做法、價值與必要取捨。
- 「限制與風險」使用條列詳述真正影響採用、操作、可靠性、成本、安全、授權或成熟度判斷的問題。
- 其他段落的敘述節奏與具體寫法以 `CARD_STYLE.md` 為準。

這些是新分析產生時必須遵守的寫作樣式，不改變前置中繼資料 Schema，也不新增正文 section。現有 Core 驗證器仍負責 H1、頂層 section 順序、分類、所有權、日期、唯一性與穩定路徑；它目前不以 Markdown 子標題數量或條列型態拒絕既有卡片。

各段不要求固定字數。來源簡單時可保持簡潔，證據不足時應誠實表達未知，不得為了湊滿內容而臆造資訊；只有 `CARD_STYLE.md` 明確指定的主題數與呈現方式屬目前寫作樣式。

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
- 驗證失敗時，不應把來源狀態當成已重新檢查成功；詳見 [ingestion.md](./ingestion.md)。

## 穩定路徑

新卡片的穩定路徑：

```text
content/knowledge/{created_at year}/{id}.md
```

既有卡片更新時沿用原有檔案路徑，不因標題、AI 分析或 URL 輸入形式改名。

## 驗證

指定工作區可執行：

```bash
npm run cards:validate -- /path/to/workspace
```

此命令會載入工作區分類體系與所有卡片，並執行分類體系、Schema、正文、日期、成員資格與集合唯一性驗證。
