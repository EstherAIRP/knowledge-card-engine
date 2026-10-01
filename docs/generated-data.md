# 生成資料、搜尋與圖譜契約

Knowledge Card Engine 將搜尋索引、向量、關聯、Concept 與圖譜視為可重建的生成資料。真實生成資料只存在私人 Knowledge Card Workspace；公開 `knowledge-card-engine` 倉庫只保存演算法、資料結構規格與合成測試資料。

## 固定產物

Knowledge Card Workspace 的 `data/` 目前包含五個正式生成產物：

```text
data/search.json
data/vectors.json
data/relations.json
data/concepts.json
data/graph.json
```

每個產物都帶：

- `schema_version`
- `engine_sha`
- `source_sha`
- 生成器／方法識別
- 設定／輸入指紋
- `generated_at`
- 確定性資料內容

這些欄位是快取、增量重建與發布驗證的一部分，不是裝飾性中繼資料。

## 向量與搜尋

正式 relation／graph 向量預設使用本機 `Xenova/multilingual-e5-small`，由 `@huggingface/transformers` 執行 `feature-extraction`，使用 mean pooling、normalize 與 q8 模型。向量維度為 384，推論發生在 generated-data build，不在網站 request path 執行，也不需要外部模型憑證。

每張 Knowledge Card 的 embedding 輸入固定由下列有效資料組成：

- `title`
- `summary`
- effective `classification.categories`
- effective `classification.tags`
- effective `actions`
- effective relevance
- `一句話介紹`
- `核心概念`
- `架構與技術`
- `技術亮點`

`navigation.categories`、`resource_kind`、使用者備註與其他正文段落不參與 embedding input。向量產物保存 provider、model、method、dimensions、每張 Card 的 input hash 與向量；只有 provider／model／dimensions／input hash 均相容時才能增量 reuse。

`deterministic-token-hash` 仍可作為明確指定的 fallback provider，但不是 production 預設，也不得標示為 neural／model embedding。正式 local embedding 失敗時 generated build 應失敗，不會靜默切換成 token hash。

搜尋索引涵蓋 Knowledge Card 的 `title`、`summary`、有效分類類別／標籤、資源種類、動作與 Markdown 正文文字。伺服器端執行查詢正規化與確定性評分。

`GET /api/search?q=<query>&limit=<n>`：

- 需要私人授權。
- `q` 必填，最長 300 字元。
- `limit` 為 1–100，預設 20。
- 只回傳顯示所需的 Knowledge Card 投影、比對證據與分數。
- 只有存在已驗證發布版本時可用；只有 Knowledge Card 的啟動模式回 `503 RELEASE_REQUIRED`。

## Card↔Card 關聯

導覽分類體系與 Card↔Card 關聯是不同維度。導覽分類調整不得直接改寫關聯距離／分數，也不因介面導覽重分類就重寫 Concept 或關聯。

自動 Card↔Card relation 使用兩組可追溯訊號：

- taxonomy：effective categories × 0.45、tags × 0.30、高相關度維度 × 0.20、actions × 0.05。
- semantic：E5 raw cosine 經 `0.70..0.95 → 0..1` 正規化。

taxonomy 與 semantic 以 0.40／0.60 組合。候選發現與正式發布分成兩階段：預設 candidate signal gate 為 taxonomy ≥ 0.08 或 semantic ≥ 0.20，combined ≥ 0.30；無外部分類器時只有 combined ≥ 0.48 且通過 `fallback_top_k` 的候選會成為正式 relation。

relation classifier 是選用能力。若私人 Workspace 沒有明確啟用並提供核准的外部 provider／credential，新的候選使用 deterministic semantic fallback；fallback 不會冒充 LLM 判定，也不會自行產生方向性的 `depends_on`／`extends`。

關聯保存：

- 具型別關聯
- 來源／目標
- 方向
- 分數／權重
- 方法
- taxonomy／semantic／raw semantic／可選 LLM 分數
- confidence、reason、classifier
- shared signals／證據與追溯資訊

有方向性的關聯在標準配對處理後仍保留主體／客體語意。

## 人工關聯規則

Knowledge Card Workspace 可在 `config/` 保存人工關聯設定。人工規則優先於生成候選：

- `block`：禁止指定關聯重新出現。
- `pin`：強制保留指定關聯。
- `override`：覆寫指定關聯的型別、方向、權重或其他受支援欄位。

重建不得覆蓋人工意圖。

## Concept

Concept 目前由確定性規則建立，包括：

- 分類類別
- 共用標籤
- 明確提升為 Concept 的設定

Knowledge Card ↔ Concept 成員關係必須帶證據、來源與強度。Concept ↔ Concept 只使用 `co_occurs_with` 類型表達共現／支撐，不推導因果、階層或本體關係。

## 圖譜投影

`data/graph.json` 是介面顯示投影，不是任意 Knowledge Card Workspace 資料傾印。它包含：

- Knowledge Card／Concept 節點
- 具型別邊
- 向量鄰近項目
- 可重建的 2D 版面
- 版面方法／追溯資訊

`GET /api/graph` 需要私人授權，並只回傳圖譜介面所需投影。圖譜與搜尋必須和 Knowledge Card API 讀取同一個發布版本。

## 驗證與失敗行為

生成產物在發布前要通過：

- Knowledge Card 參照完整性
- 追溯資訊／結構版本
- 確定性資料形狀
- 人工關聯優先規則
- Concept 成員關係證據
- 圖譜節點／邊一致性

缺少必要產物、內容與 Knowledge Card 不一致或追溯資訊不符時，不得發布；私人伺服器讀取已發布資料時也必須驗證失敗即拒絕。
