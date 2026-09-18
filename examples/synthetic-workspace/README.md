# Synthetic Workspace Fixture

此目錄是一個可由目前 engine 完整載入與驗證的合成 Workspace，只用於公開測試與契約驗證，不含真實私人資料。

Fixture 目前包含：

- `workspace.yaml` 與 `engine.lock.json`。
- 七個標準 Workspace 目錄。
- 合成 `config/taxonomy.yaml`。
- 一張合法的合成 Knowledge Card。
- 與該 Card 對應的合成 GitHub accepted source state。
- `fixture.json`，明確標示 `synthetic: true` 與 `contains_private_data: false`。

這些資料用來驗證 Workspace、Card、Taxonomy、ownership、collection uniqueness 與 source-state 對應，不代表任何真實使用者、專案或外部來源。
