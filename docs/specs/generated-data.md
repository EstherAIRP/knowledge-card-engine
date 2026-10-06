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

用於語意關聯與圖譜的向量，預設由本機 `Xenova/multilingual-e5-small` 產生；`@huggingface/transformers` 以 `feature-extraction` 執行平均池化（mean pooling）、正規化與 q8 模型推論。向量維度為 384。推論只在生成資料建置期間執行，不會進入網站請求路徑，也不需要外部模型憑證。

每張 Knowledge Card 的嵌入向量輸入固定由下列生效資料組成：

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

`navigation.categories`、`resource_kind`、使用者備註與其他正文段落不參與嵌入向量輸入。向量產物保存 `provider`、`model`、`method`、`dimensions`、每張 Card 的輸入雜湊與向量；只有供應器、模型、維度與輸入雜湊都相容時，才能沿用既有向量。

`deterministic-token-hash` 仍可作為明確指定的備援供應器，但不是正式環境預設，也不得標示為神經網路或模型嵌入向量。正式的本機嵌入向量建置失敗時，生成資料建置必須失敗，不得靜默切換成 token hash。

搜尋索引涵蓋 Knowledge Card 的 `title`、`summary`、有效分類類別／標籤、資源種類、動作與 Markdown 正文文字。伺服器端執行查詢正規化與確定性評分。

本文件只定義搜尋索引與評分所依據的生成資料。私人搜尋 API 的授權、查詢參數與回傳邊界由 [私人網站與授權契約](./private-site.md) 定義；搜尋與其他私人讀取介面必須使用同一個已驗證發布快照，版本一致性由 [一致發布契約](./release.md) 定義。

## Card↔Card 關聯

導覽分類體系與 Card↔Card 關聯是不同維度。導覽分類調整不得直接改寫關聯距離／分數，也不因介面導覽重分類就重寫 Concept 或關聯。

自動 Card↔Card 關聯使用兩組可追溯訊號：

- taxonomy：effective categories × 0.45、tags × 0.30、高相關度維度 × 0.20、actions × 0.05。
- 語意：E5 原始餘弦相似度經 `0.70..0.95 → 0..1` 正規化。

分類訊號與語意訊號以 0.40／0.60 組合。候選發現與正式發布分成兩階段：預設候選訊號門檻為分類分數 ≥ 0.08 或語意分數 ≥ 0.20，且組合分數 ≥ 0.30；未使用外部分類器時，只有組合分數 ≥ 0.48 且通過 `fallback_top_k` 的候選會成為正式關聯。

關聯分類器是選用能力。若私人 Workspace 沒有明確啟用並提供核准的外部模型供應器與憑證，新候選會使用確定性的語意備援判定；備援結果不會冒充 LLM 判定，也不會自行產生方向性的 `depends_on`／`extends`。

關聯保存：

- 具型別關聯
- 來源／目標
- 方向
- 分數／權重
- 方法
- 分類／語意／原始語意／可選 LLM 分數
- 信心分數、理由與分類器
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

本文件只定義圖譜產物的內容與一致性。私人圖譜 API 的授權與回傳投影由 [私人網站與授權契約](./private-site.md) 定義；圖譜、搜尋與 Knowledge Card 必須來自同一個已驗證發布快照，版本選擇由 [一致發布契約](./release.md) 定義。

## 驗證與失敗行為

生成產物在發布前要通過：

- Knowledge Card 參照完整性
- 追溯資訊／結構版本
- 確定性資料形狀
- 人工關聯優先規則
- Concept 成員關係證據
- 圖譜節點／邊一致性

缺少必要產物、內容與 Knowledge Card 不一致或追溯資訊不符時，不得發布；私人伺服器讀取已發布資料時也必須驗證失敗即拒絕。

生成、重建與發布前驗證的實際指令集中在 [開發與驗證指南](../guides/development.md)，本契約不重複操作步驟。
