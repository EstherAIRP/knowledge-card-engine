# Schema

此目錄保存 Knowledge Card Engine 目前使用的公開結構 Schema。

- `workspace.schema.json`：`workspace.yaml` 的結構、workspace ID 與標準 path 欄位。
- `engine-lock.schema.json`：`engine.lock.json` 的 engine repository / commit 與 Workspace schema pin。
- `knowledge-card.schema.json`：Knowledge Card frontmatter 的結構、基本型別、日期／URI 與 ownership wrapper 形狀。
- `taxonomy.schema.json`：Workspace `config/taxonomy.yaml` 的結構。

目前上述 Schema 的 `schema_version` 都接受 `1`。實際 runtime validator 還會執行 JSON Schema 以外的規則，例如 Workspace path 安全、Taxonomy membership、Card 正文順序、ownership、collection uniqueness 與 engine/workflow pin 一致性；正式契約分別見 [Workspace](../docs/workspace.md) 與 [Knowledge Card](../docs/card-contract.md) 文件。
