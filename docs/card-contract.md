# Knowledge Card 契約

Knowledge Card 是 Workspace 中的 Markdown 文件。Card 契約由 frontmatter 結構、Workspace Taxonomy、正文結構、ownership、collection uniqueness 與 stable path 共同構成；任一層驗證失敗都不能視為合法 Card。

## 權威來源

目前有三個互補的權威來源：

1. [`schema/knowledge-card.schema.json`](../schema/knowledge-card.schema.json)：frontmatter 結構、型別、日期／URI 格式與基本範圍。
2. Workspace `config/taxonomy.yaml`：實際受控詞彙。
3. `packages/core` validator：正文順序、Taxonomy membership、ownership helper、日期順序、集合唯一性與 stable path。

Taxonomy 自身結構由 [`schema/taxonomy.schema.json`](../schema/taxonomy.schema.json) 驗證。JSON Schema 不複製 Workspace 的受控詞彙值；Card 結構驗證後，Core validator 再依 Taxonomy 驗證 membership。

## Frontmatter

目前 Card schema version 是 `1`。frontmatter 必須且只能包含下列欄位：

| 欄位 | 契約 |
| --- | --- |
| `schema_version` | 目前只接受 `1`。 |
| `id` | 小寫英數與單一連字號分隔的穩定識別，例如 `github-owner-repo`。 |
| `title` | 非空字串；正文 H1 必須完全相同。 |
| `canonical_url` | 合法 URI；來源收錄層負責 canonicalization。 |
| `source.type` | 非空字串，且必須在 Taxonomy `source_types`。 |
| `source.url` | 合法 URI。 |
| `source.identity` | 非空穩定來源識別；provider-specific 規則由 ingestion 定義。 |
| `resource_kind` | `{ ai, user }` ownership wrapper；有效值必須在 Taxonomy `resource_kinds`。 |
| `created_at` | `YYYY-MM-DD`；一般更新不可修改。 |
| `updated_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `last_checked_at` | `YYYY-MM-DD`，不得早於 `created_at`。 |
| `summary` | 1–600 字元。 |
| `navigation.categories` | AI 值為非空唯一字串陣列；user 值為 `null` 或非空唯一字串陣列；值需在 `navigation_categories`。 |
| `classification.categories` | 與 navigation 相同的 ownership 形狀；值需在 Taxonomy `categories`。 |
| `classification.tags` | AI 值為唯一字串陣列；user 值為 `null` 或唯一字串陣列；tags 目前不是 Taxonomy 受控值。 |
| `relevance` | `ai` 與 `user` 都是 dimension→1–5 整數；`ai` 必須完整覆蓋所有 Taxonomy relevance dimensions，`user` 只能覆寫已定義 dimension。 |
| `actions` | AI 值為非空唯一字串陣列；user 值為 `null` 或唯一字串陣列；值需是 Taxonomy `actions` 的 key。 |
| `status` | `{ ai, user }` ownership wrapper；值需在 Taxonomy `statuses`。 |

Schema 設定 `additionalProperties: false`，未定義 frontmatter 欄位會被拒絕。

## Taxonomy 契約

Workspace `config/taxonomy.yaml` 目前使用 `schema_version: 1`，必須定義：

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

一般 ownership wrapper 的有效值為：

```text
effective = user ?? ai
```

`relevance` 逐維套用覆寫：若 `relevance.user` 有某個 dimension，就使用 user 值；否則使用同 dimension 的 AI 值。

一般重新分析允許更新 AI-owned 狀態，包括：

- `title`、`summary`
- canonical source metadata
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

`compareUserOwnedState(before, after)` 直接比較兩份 Card；不依賴 Git HEAD。

## 正文契約

正文必須有一個 H1，且 H1 文字與 frontmatter `title` 完全一致。

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

前 10 段屬 analysis result 的 AI 內容；「使用者備註」在一般重新分析時必須逐字保留。Writer 可在「更新紀錄」追加建立或實質分析更新紀錄。

## 集合唯一性

同一 Workspace 的完整 Card collection 不得有重複：

- `id`
- `source.identity`
- `canonical_url`

Card validator 對集合中的值做唯一性檢查；來源進入 Workspace 前，ingestion 會先把支援來源轉成 canonical identity / URL，並在 create/update resolver 再檢查來源衝突。

## 日期與更新語意

Card validator 保證：

- `updated_at >= created_at`
- `last_checked_at >= created_at`

Accepted-source writer 的目前行為：

- create 時三個日期使用 accepted evidence 的 captured date。
- update 若 AI analysis / canonical source state 有實質變更，`updated_at` 更新為 captured date。
- update 若分析內容沒有實質變更，保留原 `updated_at`。
- 成功處理 accepted evidence 時，`last_checked_at` 更新為 captured date。
- 驗證失敗時不應把 source state 當成已重新檢查成功；詳見 [ingestion.md](./ingestion.md)。

## 穩定路徑

新 Card 的 stable path：

```text
content/knowledge/{created_at year}/{id}.md
```

既有 Card 更新時沿用既有 file path，不因 title、AI 分析或 URL 輸入形式改名。

## 驗證

指定 Workspace 可執行：

```bash
npm run cards:validate -- /path/to/workspace
```

此命令會載入 Workspace Taxonomy、所有 Card，並執行 Taxonomy、Schema、正文、日期、membership 與 collection uniqueness 驗證。
