# Knowledge Card v1 契約

## 權威來源

Card v1 採兩層權威：

1. `schema/knowledge-card.schema.json`：frontmatter 結構、基本型別與日期／URI 格式。
2. Workspace `config/taxonomy.yaml`：受控詞彙唯一權威，包括 semantic categories、navigation categories、relevance dimensions、actions、statuses、source types、resource kinds。

JSON Schema 不再複製 taxonomy enum。Core validator 會在結構驗證後驗證 taxonomy membership，因此非法值仍會 fail closed，同時消除 V1 的 Schema／Taxonomy 雙份 enum 漂移。

## Frontmatter

Card 保留 V1 欄位：

- `schema_version`
- `id`
- `title`
- `canonical_url`
- `source.type/url/identity`
- `resource_kind.ai/user`
- `created_at` / `updated_at` / `last_checked_at`
- `summary`
- `navigation.categories.ai/user`
- `classification.categories.ai/user`
- `classification.tags.ai/user`
- `relevance.ai/user`
- `actions.ai/user`
- `status.ai/user`

目前 Card schema version 為 1。

## AI / 使用者所有權

一般 ownership wrapper 的有效值：

```text
effective = user ?? ai
```

`relevance` 採逐維 override：若 `relevance.user` 有該 dimension，使用 user 值；否則使用 AI 值。

以下狀態在一般重新分析時不可改動：

- `id`
- `created_at`
- 所有 `*.user`
- 完整 `## 使用者備註` section

Core 提供 `compareUserOwnedState(before, after)`，直接比較兩份 Card，不依賴 Git HEAD。

## 正文

正文必須依序包含：

1. 一句話介紹
2. 它解決什麼問題
3. 核心概念
4. 架構與技術
5. 主要功能
6. 技術亮點
7. 限制與風險
8. 與你的相關性
9. 建議怎麼使用
10. 與其他收藏的關聯
11. 使用者備註
12. 更新紀錄

H1 必須與 frontmatter `title` 完全一致。

## 集合唯一性

同一 Workspace 的 Card collection 不得有重複：

- `id`
- `source.identity`
- `canonical_url`

URL canonicalization 與 provider-specific identity 產生規則由 ingestion 層負責，尚未在本階段實作。

## 日期

- `updated_at >= created_at`
- `last_checked_at >= created_at`

`last_checked_at` 何時允許前進屬於來源收錄流程責任；Card validator 只檢查基本日期一致性。

## 路徑

新 Card 的建議穩定路徑：

```text
content/knowledge/{created_at year}/{id}.md
```

既有 Card 更新時保留既有路徑，不因標題或重新分析結果改名。
