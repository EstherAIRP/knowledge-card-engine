# Knowledge Card Engine 文件

本索引只連結目前有效、可用來理解與操作 Knowledge Card Engine 的正式文件。文件採漸進式揭露：先依任務類型選擇入口，再只讀本次需要的契約；下列文件不是每次任務的固定必讀清單。

## 任務入口

### 單張 Knowledge Card 收錄／更新

這是 Workspace 日常資料任務。先依 Workspace `AGENTS.md`、`workspace.yaml`、`engine.lock.json` 確認核准 Engine revision，再按需要讀：

1. [Runtime 執行契約](../prompts/RUNTIME.md)：任務路由、Repository 邊界與失敗處理。
2. [來源收錄契約](./ingestion.md)：canonical identity、accepted evidence、create/update、safe write 與 source state。
3. [Analysis 與 Research 契約](./analysis.md)：analysis version、evidence bundle、coverage 與 digest binding。
4. [Knowledge Card 契約](./card-contract.md)：Card、Taxonomy、ownership、正文與集合唯一性。

不要因單張 Card 收錄預先掃描全部 Engine 程式、其他領域文件、所有 branches 或 PR。只有來源、分析或 writer 契約要求時才展開對應程式／Schema。

### Engine 程式、Schema、provider 或共用 Workflow 開發

先讀 [Runtime 執行契約](../prompts/RUNTIME.md)、[架構](./architecture.md) 與本次修改領域的正式文件，再讀直接相關的 Schema、程式與測試。只有會修改 Repository 時才檢查相關既有分支與 PR。

### Workspace／Engine 契約或版本升級

讀 [Workspace 契約](./workspace.md)、[開發與驗證](./development.md) 以及本次變更直接影響的契約。Engine 升級必須依 Workspace pin 與驗證流程處理。

### Generated data、發布或私人網站

依任務只讀對應文件：

- [生成資料、搜尋與圖譜](./generated-data.md)：generated artifacts、deterministic search/vector、relation、Concept 與 graph projection。
- [一致發布](./release.md)：E／S／P、manifest、current pointer、stale guard、回復與 release-pinned read model。
- [私人網站與授權](./private-site.md)：GitHub App 登入、session、授權、Card/search/graph/release API 與唯讀 UI。
- [Web UI 與 Layout](./web-ui.md)：樣式 ownership、page frame、reading width、responsive contract 與 UI regression guard。

## 其他正式文件

- [架構](./architecture.md)：engine / Workspace 責任邊界、模組與目前資料流。
- [Workspace 契約](./workspace.md)：`workspace.yaml`、`engine.lock.json`、安全目錄映射與 workflow pin。
- [Knowledge Card 契約](./card-contract.md)：Card frontmatter、Taxonomy、ownership、正文、集合唯一性與路徑。
- [來源收錄契約](./ingestion.md)：canonical identity、accepted evidence、create/update、safe write 與 source state。
- [Analysis 與 Research 契約](./analysis.md)：analysis version、research plan、analysis evidence bundle、structured coverage 與 digest binding。
- [開發與驗證](./development.md)：Node/npm、CLI、CI、Workspace release workflow 與文件治理。

目前可用來源 provider 是 GitHub Repository 與 Threads；Threads 優先使用結構證據，並可在限定 continuation uncertainty 下使用受控高信心語意復原。私人網站可在已驗證 release 上提供 Card list/detail、搜尋、圖譜與 release version。
