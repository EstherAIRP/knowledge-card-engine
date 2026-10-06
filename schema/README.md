# 結構規格

此目錄保存 Knowledge Card Engine 目前使用的公開機器可讀資料契約。

- `workspace.schema.json`：定義 `workspace.yaml` 的結構、Workspace ID 與標準路徑欄位。
- `engine-lock.schema.json`：定義 `engine.lock.json` 中 Knowledge Card Engine 倉庫、提交版本與 Workspace 結構版本鎖定。
- `knowledge-card.schema.json`：定義 Knowledge Card 前置中繼資料（frontmatter）的結構、基本型別、日期／URI 與所有權包裝結構。
- `taxonomy.schema.json`：定義 Knowledge Card Workspace `config/taxonomy.yaml` 的結構。
- `threads-continuation-judgement.schema.json`：定義 Threads 語意續篇／根貼文判定的機器輸出形狀；接受門檻與證據相關守門仍由受信任的驗證程式負責。

前四個 Workspace／Card 相關 Schema 目前都使用 `schema_version: 1`。Threads 判定 Schema 不含 `schema_version` 欄位，不能套用相同版本敘述。

JSON Schema 只負責可機器驗證的資料形狀。工作區路徑安全、分類體系成員資格、Knowledge Card 正文順序與所有權、集合唯一性、Threads 接受門檻，以及 Engine／工作流程版本鎖定等跨欄位或執行階段規則，由對應驗證器與正式契約負責。完整權威來源對照見 [`docs/index.md`](../docs/index.md)。
