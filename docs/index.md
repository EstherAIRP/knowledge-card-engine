# Knowledge Card Engine 文件

本索引只連結目前有效、可用來理解與操作 Knowledge Card Engine 的正式文件。

建議閱讀順序：

1. [Runtime 執行契約](../prompts/RUNTIME.md)：任務判定、Engine／Workspace 邊界、收錄與寫入守門、release 狀態與完成回報。
2. [架構](./architecture.md)：engine / Workspace 責任邊界、模組與目前資料流。
3. [Workspace 契約](./workspace.md)：`workspace.yaml`、`engine.lock.json`、安全目錄映射與 workflow pin。
4. [Knowledge Card 契約](./card-contract.md)：Card frontmatter、Taxonomy、ownership、正文、集合唯一性與路徑。
5. [來源收錄契約](./ingestion.md)：canonical identity、accepted evidence、analysis binding、create/update、safe write 與 source state。
6. [生成資料、搜尋與圖譜](./generated-data.md)：generated artifacts、deterministic search/vector、relation、Concept 與 graph projection。
7. [一致發布](./release.md)：E／S／P、manifest、current pointer、stale guard、回復與 release-pinned read model。
8. [私人網站與授權](./private-site.md)：GitHub App 登入、session、授權、Card/search/graph/release API 與唯讀 UI。
9. [開發與驗證](./development.md)：Node/npm、CLI、CI、Workspace release workflow 與文件治理。

目前可用來源 provider 是 GitHub Repository 與 Threads；Threads 只接受可由結構證據證明完整的來源。私人網站可在已驗證 release 上提供 Card list/detail、搜尋、圖譜與 release version。
