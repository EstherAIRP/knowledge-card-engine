# Knowledge Card Engine 文件

本索引只連結目前有效、可用來理解與操作 Knowledge Card Engine 的正式文件。

建議閱讀順序：

1. [架構](./architecture.md)：engine / Workspace 責任邊界、模組與目前資料流。
2. [Workspace 契約](./workspace.md)：`workspace.yaml`、`engine.lock.json`、安全目錄映射與 workflow pin。
3. [Knowledge Card 契約](./card-contract.md)：Card frontmatter、Taxonomy、ownership、正文、集合唯一性與路徑。
4. [GitHub 收錄契約](./ingestion.md)：canonical identity、accepted evidence、analysis binding、create/update、safe write 與 source state。
5. [生成資料、搜尋與圖譜](./generated-data.md)：generated artifacts、deterministic search/vector、relation、Concept 與 graph projection。
6. [一致發布](./release.md)：E／S／P、manifest、current pointer、stale guard、回復與 release-pinned read model。
7. [私人網站與授權](./private-site.md)：GitHub App 登入、session、授權、Card/search/graph/release API 與唯讀 UI。
8. [開發與驗證](./development.md)：Node/npm、CLI、CI、Workspace release workflow 與文件治理。

目前可用來源 provider 只有 GitHub Repository；私人網站可在已驗證 release 上提供 Card list/detail、搜尋、圖譜與 release version。
