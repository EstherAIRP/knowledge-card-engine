# 生成資料、搜尋與圖譜契約

Knowledge Card Engine 將搜尋索引、向量、關聯、Concept 與圖譜視為可重建的 generated data。真實 generated data 只存在私人 Workspace；公開 engine repository 僅保存演算法、Schema 邊界與合成 fixture。

## 固定產物

Workspace 的 `data/` 目前包含五個正式 generated artifacts：

```text
data/search.json
data/vectors.json
data/relations.json
data/concepts.json
data/graph.json
```

每個 artifact 都帶：

- `schema_version`
- `engine_sha`
- `source_sha`
- generator / method identifier
- config / input fingerprint
- `generated_at`
- deterministic payload

這些欄位是 cache、增量重建與 release 驗證的一部分，不是裝飾性 metadata。

## 向量與搜尋

目前內建向量方法是 deterministic lexical fallback，不使用外部 embedding credential，也不能標示為 neural、LLM 或 model judgement。

向量輸入由 Card 的有效內容建立；fingerprint 會納入 method、設定與 Card 輸入。增量 build 可沿用 fingerprint 未變的既有 record；full build 會重建全部 generated records。

搜尋索引涵蓋 Card title、summary、有效 classification categories / tags、resource kind、actions 與 Markdown body text。Server 端執行 query normalization 與 deterministic scoring。

`GET /api/search?q=<query>&limit=<n>`：

- 需要 private authorization。
- `q` 必填，最長 300 字元。
- `limit` 為 1–100，預設 20。
- 只回顯示所需的 Card projection、match evidence 與 score。
- 只有存在已驗證 release 時可用；bootstrap Card-only mode 回 `503 RELEASE_REQUIRED`。

## Semantic relation

Navigation taxonomy 與 semantic relation 是不同維度。Navigation category 的調整不直接作為 semantic distance，也不因 UI 導覽重分類就重寫 Concept / relation。

Generated relation 使用可驗證 signal，例如有效 classification categories / tags 與 lexical-vector similarity。Relation 保存：

- typed relation
- source / target
- direction
- score / weight
- method
- evidence / provenance

Directional relation 在 canonical pair 處理後仍保留 subject / object 語意。

## 人工 relation 規則

Workspace 可在 `config/` 保存人工 relation 設定。人工規則優先於 generated candidate：

- block：禁止指定 relation 重新出現。
- pin：強制保留指定 relation。
- override：覆寫指定 relation 的型別、方向、權重或其他受支援欄位。

Rebuild 不得覆蓋人工意圖。

## Concept

Concept 目前由 deterministic 規則建立，包括：

- classification category
- shared tag
- 明確 promoted concept config

Card↔Concept membership 必須帶 evidence、origin 與 strength。Concept↔Concept 只使用 `co_occurs_with` 類型表達共現／support，不推導因果、階層或本體關係。

## Graph projection

`data/graph.json` 是 UI 顯示投影，不是任意 Workspace dump。它包含：

- Card / Concept nodes
- typed edges
- semantic neighbors
- 可重建 2D layout
- layout method / provenance

`GET /api/graph` 需要 private authorization，並只回 graph UI 所需 projection。Graph 與 search 必須和 Card API 讀取同一個 release。

## 驗證與失敗行為

Generated artifacts 在 release 前要通過：

- Card reference 完整性
- provenance / schema version
- deterministic shape
- manual relation precedence
- Concept membership evidence
- graph node / edge consistency

缺少必要 artifact、內容與 Card 不一致或 provenance 不符時，release 不可發布；private server 在讀取已發布資料時也會 fail closed。
