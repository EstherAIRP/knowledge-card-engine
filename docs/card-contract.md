# Knowledge Card 契約

Knowledge Card 是 工作區 中的 Markdown 文件。卡片 契約由 前置中繼資料 結構、工作區 分類體系、正文結構、所有權、集合唯一性 與 穩定路徑 共同構成；任一層驗證失敗都不能視為合法 卡片。

## 權威來源

目前有三個互補的權威來源：

1. [`schema/knowledge-card.schema.json`](../結構規格/knowledge-card.結構規格.json)：前置中繼資料 結構、型別、日期／URI 格式與基本範圍。
2. 工作區 `config/taxonomy.yaml`：實際受控詞彙。
3. `packages/core` 驗證器：正文順序、分類體系 成員資格、所有權輔助邏輯、日期順序、集合唯一性與 穩定路徑。

分類體系 自身結構由 [`schema/taxonomy.schema.json`](../結構規格/taxonomy.結構規格.json) 驗證。JSON Schema 不複製 工作區 的受控詞彙值；卡片 結構驗證後，Core 驗證器 再依 分類體系 驗證 成員資格。

## Frontmatter

目前 卡片 結構版本 是 `1`。前置中繼資料 必須且只能包含下列欄位：

| 欄位 | 契約 |
| --- | --- |
| `schema_version` | 目前只接受 `1`。 |
| `id` | 小寫英數與單一連字號分隔的穩定識別，例如 `github-owner-repo`。 |
| `title` | 非空字串；正文 H1 必須完全相同。 |
| `canonical_url` | 合法 URI；來源收錄層負責 網址正規化。 |
| `source.type` | 非空字串，且必須在 分類體系 `source_types`。 |
| `source.url` | 合法 URI。 |
| `source.identity` | 非空穩定來源識別；來源類型專屬 規則由 ingestion 定義。 |
| `resource_kind` | `{ ai, user }` 所有權包裝結構；有效值必須在 分類體系 `resource_kinds`。 |
| `created_at` | `YYYY-MM-DD`；一般更新不可修改。 |
| `updated_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `last_checked_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `summary` | 1–600 字元。 |
| `navigation.categories` | AI 值為非空唯一字串陣列；user 值為 `null` 或非空唯一字串陣列；值需在 `navigation_categories`。 |
| `classification.categories` | 與 navigation 相同的 所有權 形狀；值需在 分類體系 `categories`。 |
| `classification.tags` | AI 值為唯一字串陣列；user 值為 `null` 或唯一字串陣列；tags 目前不是 分類體系 受控值。 |
| `relevance` | `ai` 與 `user` 都是 dimension→1–5 整數；`ai` 必須完整覆蓋所有 分類體系 relevance dimensions，`user` 只能覆寫已定義 dimension。 |
| `actions` | AI 值為非空唯一字串陣列；user 值為 `null` 或唯一字串陣列；值需是 分類體系 `actions` 的 key。 |
| `status` | `{ ai, user }` 所有權包裝結構；值需在 分類體系 `statuses`。 |

結構規格 設定 `additionalProperties: false`，未定義 前置中繼資料 欄位會被拒絕。

## 分類體系 契約

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

## AI / 使用者所有權

一般 所有權包裝結構 的有效值為：

```text
effective = user ?? ai
```

`relevance` 逐維套用覆寫：若 `relevance.user` 有某個 dimension，就使用 user 值；否則使用同 dimension 的 AI 值。

一般重新分析允許更新 AI 可更新 狀態，包括：

- `title`、`summary`
- canonical source 中繼資料
- `resource_kind.ai`
- navigation / classification 的 AI 值
- `relevance.ai`
- `actions.ai`
- `status.ai`
- 10 個 AI 分析正文段落
- 合法的 `updated_at`、`last_checked_at` 與更新紀錄

以下狀態在一般重新分析時不可改動：

- `id`
- `created_at`
- 所有 `*.user` override
- 完整 `## 使用者備註` section

`compareUserOwnedState(before, after)` 直接比較兩份 卡片；不依賴 Git HEAD。

## AI 文字語言契約

Knowledge Card 的 AI 可更新 自然語言內容包含 `title`、`summary` 與前 10 個分析正文段落。這些內容除了符合結構與 證據契約，也必須遵守 工作區 明確的分析語言政策；若 工作區 沒有額外政策，則遵守 Runtime 的預設語言與術語規則。

當目標語言為中文時：

- 使用自然繁體中文敘述，不模仿來源的中英夾雜語體。
- 已有成熟中文譯名的一般概念優先使用中文；來源是英文或技術文件，不構成大量保留英文敘述的理由。
- 官方專案／產品名稱、程式碼、API、函式、參數、欄位、識別字、指令、檔案路徑、縮寫、錯誤碼、狀態值與不宜硬譯的標準名稱保留原文。
- 重要術語首次需要對照時可使用「中文（English）」；後續優先使用中文。
- 直接引用、程式碼與來源證據保持原文，不為符合 卡片 敘述語言而改寫 evidence。

語言整理只適用於 AI 可更新 內容，不得因此重寫任何 `*.user` override 或完整 `## 使用者備註`。目前 Core / 結構規格 驗證器 驗證 卡片 的資料形狀、正文結構、分類體系、所有權、日期、唯一性與 穩定路徑，**不以英文比例或文體分類器機器判定語言自然度**；語言規則屬 分析 / Agent 輸出契約，違反時應視為分析品質缺陷處理。

## 正文契約

正文必須有一個 H1，且 H1 文字與 前置中繼資料 `title` 完全一致。

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

前 10 段屬 分析結果 的 AI 內容；「使用者備註」在一般重新分析時必須逐字保留。Writer 可在「更新紀錄」追加建立或實質分析更新紀錄。

## 集合唯一性

同一 工作區 的完整 卡片集合 不得有重複：

- `id`
- `source.identity`
- `canonical_url`

卡片 驗證器 對集合中的值做唯一性檢查；來源進入 工作區 前，ingestion 會先把支援來源轉成 標準來源識別 / URL，並在 新建／更新 解析r 再檢查來源衝突。

## 日期與更新語意

卡片 驗證器 保證：

- `updated_at >= created_at`
- `last_checked_at >= created_at`

Accepted-source 寫入器 的目前行為：

- 新建 時三個日期使用 已接受的證據 的 captured date。
- 更新 若 AI 分析 / canonical 來源狀態 有實質變更，`updated_at` 更新為 captured date。
- 更新 若分析內容沒有實質變更，保留原 `updated_at`。
- 成功處理 已接受的證據 時，`last_checked_at` 更新為 captured date。
- 驗證失敗時不應把 來源狀態 當成已重新檢查成功；詳見 [ingestion.md](./ingestion.md)。

## 穩定路徑

新 卡片 的 穩定路徑：

```text
content/knowledge/{created_at year}/{id}.md
```

既有 卡片 更新時沿用既有 file path，不因 title、AI 分析或 URL 輸入形式改名。

## 驗證

指定 工作區 可執行：

```bash
npm run cards:validate -- /path/to/workspace
```

此命令會載入 工作區 分類體系、所有 卡片，並執行 分類體系、結構規格、正文、日期、成員資格 與 集合唯一性 驗證。
