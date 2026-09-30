# Knowledge Card Engine 文件

本索引只連結目前有效、可用來理解與操作 Knowledge Card Engine 的正式文件。文件採漸進式揭露：先依任務類型選擇入口，再只讀本次需要的契約；下列文件不是每次任務的固定必讀清單。

## 任務入口

### 單張 Knowledge Card 收錄／更新

這是 Knowledge Card Workspace 的日常資料任務。先依 Knowledge Card Workspace 的 `AGENTS.md`、`workspace.yaml`、`engine.lock.json` 確認核准的 Knowledge Card Engine 版本，再按需要讀：

1. [執行契約](../prompts/RUNTIME.md)：任務路由、倉庫邊界與失敗處理。
2. [來源收錄契約](./ingestion.md)：標準來源識別、已接受證據、新建／更新、安全寫入與來源狀態。
3. [分析與研究契約](./analysis.md)：分析版本、證據包、覆蓋狀態與摘要值綁定。
4. [Knowledge Card 契約](./card-contract.md)：Knowledge Card、分類體系、所有權、正文與集合唯一性。

不要因單張 Knowledge Card 收錄而預先掃描全部 Knowledge Card Engine 程式、其他領域文件、所有分支或 PR。只有來源、分析或寫入器契約要求時，才展開對應程式或資料結構規格。

### Knowledge Card Engine 程式、資料結構、來源供應者或共用工作流程開發

先讀 [執行契約](../prompts/RUNTIME.md)、[架構](./architecture.md) 與本次修改領域的正式文件，再讀直接相關的資料結構規格、程式與測試。只有會修改 `knowledge-card-engine` 倉庫時，才檢查相關既有分支與未合併 PR。

### Knowledge Card Workspace／Knowledge Card Engine 契約或版本升級

讀 [Knowledge Card Workspace 契約](./workspace.md)、[開發與驗證](./development.md) 以及本次變更直接影響的契約。Knowledge Card Engine 升級必須依 Knowledge Card Workspace 的版本鎖定與驗證流程處理。

### 生成資料、發布或私人網站

依任務只讀對應文件：

- [生成資料、搜尋與圖譜](./generated-data.md)：生成產物、確定性搜尋／向量、關聯、Concept 與圖譜投影。
- [一致發布](./release.md)：E／S／P、資訊清單、目前發布指標、過期防護、回復與固定於發布版本的讀取模型。
- [私人網站與授權](./private-site.md)：GitHub App 登入、工作階段、授權、Knowledge Card／搜尋／圖譜／發布 API 與唯讀介面。
- [網頁介面與版面配置](./web-ui.md)：樣式責任、頁面框架、閱讀寬度、響應式契約與介面回歸防護。

## 其他正式文件

- [架構](./architecture.md)：Knowledge Card Engine／Knowledge Card Workspace 責任邊界、模組與目前資料流。
- [Knowledge Card Workspace 契約](./workspace.md)：`workspace.yaml`、`engine.lock.json`、安全目錄映射與工作流程版本鎖定。
- [Knowledge Card 契約](./card-contract.md)：Knowledge Card 前置中繼資料、分類體系、所有權、正文、集合唯一性與路徑。
- [來源收錄契約](./ingestion.md)：標準來源識別、已接受證據、新建／更新、安全寫入與來源狀態。
- [分析與研究契約](./analysis.md)：分析版本、研究計畫、分析證據包、結構化覆蓋與摘要值綁定。
- [開發與驗證](./development.md)：Node／npm、命令列工具、CI、Knowledge Card Workspace 發布工作流程與文件治理。

目前可用的來源供應者是 GitHub 倉庫與 Threads；Threads 優先使用結構證據，並可在限定的續篇不確定性下使用受控高信心語意復原。私人網站可在已驗證的發布版本上提供 Knowledge Card 列表／詳細資料、搜尋、圖譜與發布版本資訊。

正式文件的一般敘述使用自然繁體中文；專案／產品正式名稱、倉庫名稱與程式識別字的保留原則見 [`AGENTS.md`](../AGENTS.md) 的「正式文件規則」。
