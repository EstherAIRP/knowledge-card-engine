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

向量產物必須以自身 provenance 說明實際使用的方法、維度與設定；若使用模型 provider，還必須記錄足以辨識 provider／model 的資訊。任何 lexical、deterministic、local model 或外部 model 方法都不得被標成另一種判定來源。

向量輸入由 Knowledge Card 的有效內容建立；指紋必須納入會影響結果的方法、模型／設定與 Knowledge Card 輸入。只有 provenance 與輸入均相容時才可增量沿用既有紀錄；完整建置會依目前方法重建生成紀錄。

搜尋索引涵蓋 Knowledge Card 的 `title`、`summary`、有效分類類別／標籤、資源種類、動作與 Markdown 正文文字。伺服器端執行查詢正規化與確定性評分。

`GET /api/search?q=<query>&limit=<n>`：

- 需要私人授權。
- `q` 必填，最長 300 字元。
- `limit` 為 1–100，預設 20。
- 只回傳顯示所需的 Knowledge Card 投影、比對證據與分數。
- 只有存在已驗證發布版本時可用；只有 Knowledge Card 的啟動模式回 `503 RELEASE_REQUIRED`。

## Card↔Card 關聯

導覽分類體系與 Card↔Card 關聯是不同維度。導覽分類調整不得直接改寫關聯距離／分數，也不因介面導覽重分類就重寫 Concept 或關聯。

生成關聯只能使用目前 relation pipeline 定義且可追溯的訊號；具體 scoring、vector 或 classifier 方法不在本文件寫死，而由產物的 method／evidence／provenance 說明。關聯保存：

- 具型別關聯
- 來源／目標
- 方向
- 分數／權重
- 方法
- 證據／追溯資訊

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
