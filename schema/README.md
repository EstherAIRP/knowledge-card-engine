# 結構規格

此目錄保存 Knowledge Card Engine 目前使用的公開資料結構規格。

- `workspace.schema.json`：定義 `workspace.yaml` 的結構、工作區 ID 與標準路徑欄位。
- `engine-lock.schema.json`：定義 `engine.lock.json` 中 Knowledge Card Engine 倉庫、提交版本與 Knowledge Card Workspace 結構版本鎖定。
- `knowledge-card.schema.json`：定義 Knowledge Card 前置中繼資料（frontmatter）的結構、基本型別、日期／URI 與所有權包裝結構。
- `taxonomy.schema.json`：定義 Knowledge Card Workspace `config/taxonomy.yaml` 的結構。

目前上述 Schema 的 `schema_version` 都接受 `1`。實際執行階段的驗證器還會檢查 JSON Schema 之外的規則，例如工作區路徑安全、分類體系成員資格、Knowledge Card 正文順序、所有權、集合唯一性，以及 Knowledge Card Engine／工作流程版本鎖定的一致性；正式契約分別見 [Knowledge Card Workspace](../docs/workspace.md) 與 [Knowledge Card](../docs/card-contract.md) 文件。
