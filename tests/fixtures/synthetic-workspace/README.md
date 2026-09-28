# Synthetic Workspace Test Fixture

此目錄是 engine tests 共用的完整合成 Workspace，只用於公開契約測試，不含真實私人資料，也不是使用者範例或 Workspace 範本。

Fixture 保留目前測試需要的最小集合：

- `workspace.yaml` 與 `engine.lock.json`。
- 七個必要 Workspace 邏輯目錄；其中 `profile/`、`projects/`、`data/`、`releases/` 目前沒有測試內容，以各自的 README 讓目錄存在於 Git。
- `config/taxonomy.yaml`。
- 一張合法的合成 Knowledge Card。
- 與該 Card 對應的合成 GitHub accepted source state。
- `fixture.json`，明確標示 `synthetic: true` 與 `contains_private_data: false`。

Relation / Concept generated-data 設定不屬於此共用 fixture 的必要輸入；相關契約由各自測試建立專用資料。

這些資料用來驗證 Workspace、Card、Taxonomy、ownership、collection uniqueness、source-state 與 research-state 寫入／驗證行為。不得加入真實使用者、專案、來源內容、來源快照、向量或其他私人衍生資料。
