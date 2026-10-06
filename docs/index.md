# Knowledge Card Engine 文件導航

本索引是 Knowledge Card Engine 正式文件的唯一導航入口。

文件採漸進式揭露：先建立系統全貌，再依任務讀取需要的正式契約。不同類型的文件有不同責任；同一規則只應有一個主要權威來源，其他文件以連結引用，不重複維護完整規則。

正式文件依責任分層如下。

## 文件總覽

```text
knowledge-card-engine/
├─ README.md
├─ AGENTS.md
│
├─ docs/
│  ├─ index.md
│  ├─ architecture/\n│  │  └─ overview.md
│  ├─ workspace.md
│  ├─ card-contract.md
│  ├─ ingestion.md
│  ├─ analysis.md
│  ├─ generated-data.md
│  ├─ release.md
│  ├─ private-site.md
│  ├─ web-ui.md
│  └─ development.md
│
├─ prompts/
│  ├─ README.md
│  ├─ RUNTIME.md
│  ├─ KNOWLEDGE_EDITOR.md
│  └─ CARD_STYLE.md
│
├─ schema/
│  ├─ README.md
│  ├─ workspace.schema.json
│  ├─ engine-lock.schema.json
│  ├─ knowledge-card.schema.json
│  ├─ taxonomy.schema.json
│  └─ threads-continuation-judgement.schema.json
│
└─ defaults/
   └─ README.md
```

測試 fixture 內的 README 只說明合成測試資料，不屬於正式系統文件，也不作為契約權威來源。

## 入口文件

| 文件 | 回答的問題 | 定位 |
| --- | --- | --- |
| [README](../README.md) | Knowledge Card 是什麼、Engine 做什麼 | 第一次閱讀的產品與系統入口 |
| [AGENTS.md](../AGENTS.md) | 如何安全修改此 repository | 倉庫工程、所有權、驗證、分支與提交規則 |
| [本索引](./index.md) | 需要讀哪份文件 | 正式文件的唯一導航 |

## 架構

### [Knowledge Card Engine 架構](./architecture/overview.md)

回答「系統如何組成」。

涵蓋：

- Engine／Workspace 邊界
- 各模組責任
- 高階資料流
- 資料權威與所有權
- 私人網站讀取資料流

這份文件負責跨模組的現行架構，不取代各領域的詳細契約。

## 功能與資料契約

下列文件回答「某個功能或資料必須遵守什麼」。

| 文件 | 主要責任 |
| --- | --- |
| [Knowledge Card Workspace 契約](./specs/workspace.md) | Workspace 結構、標準路徑、背景政策、Engine 版本鎖定與相容性驗證 |
| [Knowledge Card 契約](./specs/card.md) | Card 前置中繼資料、分類體系、AI／使用者所有權、正文、唯一性與穩定路徑 |
| [來源收錄契約](./specs/ingestion.md) | URL 正規化、來源識別、GitHub／Threads 已接受證據、新建／更新、安全寫入與來源狀態 |
| [分析與研究契約](./specs/analysis.md) | 分析版本、重新閱讀與整合、研究計畫、分析證據包、品質門檻與證據綁定 |
| [生成資料、搜尋與圖譜契約](./specs/generated-data.md) | 搜尋、向量、Card↔Card 關聯、人工關聯、Concept、Graph 與生成資料驗證 |
| [一致發布契約](./specs/release.md) | E／S／P、資訊清單、發布指標、過期防護、私人讀取版本與回復 |
| [私人網站與授權契約](./specs/private-site.md) | GitHub App 登入、工作階段、資格驗證、私人 API、Workspace 讀取與部署邊界 |
| [網頁介面與版面配置](./specs/web-ui.md) | Web UI 模組、樣式責任、版面、響應式、無障礙與介面驗證 |

## 操作與開發指南

### [開發與驗證](./guides/development.md)

回答「如何在目前 Engine 上開發、驗證與執行常用工作」。

涵蓋：

- Node.js／npm 工具鏈
- Workspace 驗證
- 來源收錄命令
- 私人網站啟動
- 生成資料與發布命令
- GitHub Actions
- 正式文件政策

功能行為本身仍以對應契約為準；本文件負責操作方式，不重新定義功能契約。

## 執行與 AI 行為契約

`prompts/` 不是一般說明文件，而是 Agent 執行 Knowledge Card 工作時使用的正式行為契約與提示。

| 文件 | 主要責任 |
| --- | --- |
| [提示詞文件索引](../prompts/README.md) | 說明 prompts 目錄中的文件分工 |
| [執行契約](../prompts/RUNTIME.md) | 跨領域任務判定、執行順序、公私邊界、失敗處理與完成回報 |
| [Knowledge Card 知識編輯提示](../prompts/KNOWLEDGE_EDITOR.md) | 最終證據固定後的重新閱讀、整合理解與知識取捨 |
| [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md) | 將已形成的理解整理成 Knowledge Card 的內容結構與寫作原則 |

## 機器可讀契約

`schema/` 保存資料形狀的機器可讀權威來源。文字文件負責解釋語意，JSON Schema 負責可執行的結構限制。

- [Schema 索引](../schema/README.md)
- [Workspace Schema](../schema/workspace.schema.json)
- [Engine Lock Schema](../schema/engine-lock.schema.json)
- [Knowledge Card Schema](../schema/knowledge-card.schema.json)
- [Taxonomy Schema](../schema/taxonomy.schema.json)
- [Threads continuation judgement Schema](../schema/threads-continuation-judgement.schema.json)

JSON Schema 之外的跨欄位、所有權、集合或執行階段規則，仍以對應正式契約與驗證器為準。

## 其他 repository 說明

### [預設設定](../defaults/README.md)

`defaults/` 保留給可公開重用且不含私人資料的預設設定。目前沒有由執行階段讀取的正式預設設定。

這類 README 說明 repository 內特定支援目錄的用途，但不取代正式功能契約。

## 依任務選文件

### 單張 Knowledge Card 收錄或更新

在 Knowledge Card Workspace 確認目前核准的 Engine 版本後，依序讀：

1. [執行契約](../prompts/RUNTIME.md)
2. [來源收錄契約](./specs/ingestion.md)
3. [分析與研究契約](./specs/analysis.md)
4. [Knowledge Card 契約](./specs/card.md)

需要建立最終分析內容時，再依流程讀：

5. [Knowledge Card 知識編輯提示](../prompts/KNOWLEDGE_EDITOR.md)
6. [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md)

### Engine 程式或共用契約開發

1. [AGENTS.md](../AGENTS.md)
2. [執行契約](../prompts/RUNTIME.md)
3. [架構](./architecture/overview.md)
4. 本次修改領域的正式契約
5. [開發與驗證](./guides/development.md)
6. 直接相關的 Schema、程式與測試

### Workspace 結構或 Engine 版本升級

讀：

- [Knowledge Card Workspace 契約](./specs/workspace.md)
- [開發與驗證](./guides/development.md)
- 受變更直接影響的其他契約與 Schema

### 搜尋、關聯、Concept 或 Graph

讀：

- [生成資料、搜尋與圖譜契約](./specs/generated-data.md)
- 必要時再讀 [一致發布契約](./specs/release.md)

### 發布與版本一致性

讀：

- [一致發布契約](./specs/release.md)
- [生成資料、搜尋與圖譜契約](./specs/generated-data.md)
- [開發與驗證](./guides/development.md)

### 登入、授權、私人 API 或部署

讀：

- [私人網站與授權契約](./specs/private-site.md)
- UI 變更時再讀 [網頁介面與版面配置](./specs/web-ui.md)
- 發布版本讀取行為涉及變更時再讀 [一致發布契約](./specs/release.md)

### Knowledge Card 分析品質或寫作行為

依責任讀：

- 研究、證據與分析資料： [分析與研究契約](./specs/analysis.md)
- 來源閱讀與知識取捨： [Knowledge Card 知識編輯提示](../prompts/KNOWLEDGE_EDITOR.md)
- Knowledge Card 表達與章節結構： [Knowledge Card 寫作樣式](../prompts/CARD_STYLE.md)
- Card 結構與所有權： [Knowledge Card 契約](./specs/card.md)

## 權威來源原則

不同層級的權威來源分工如下：

- **資料形狀**：`schema/` 下的 JSON Schema。
- **受控詞彙**：Knowledge Card Workspace 的 `config/taxonomy.yaml`。
- **跨領域執行順序**：`prompts/RUNTIME.md`。
- **功能與資料語意**：`docs/` 中對應的正式契約。
- **Agent 的知識整理與寫作行為**：`prompts/KNOWLEDGE_EDITOR.md` 與 `prompts/CARD_STYLE.md`。
- **倉庫工程與提交安全**：`AGENTS.md`。
- **可執行行為**：對應程式、驗證器與測試。

文件、Schema、驗證器、測試或實際行為若互相衝突，應視為需要修正的缺陷，不自行選擇較方便的規則。
