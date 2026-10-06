# 一致發布契約

一致發布契約回答的是「私人網站應該讀取哪一個完整版本」。Knowledge Card 的 Card、搜尋與圖譜必須來自同一個已驗證發布快照，不能把不同版本的 Knowledge Card 與生成資料混在一起。

登入、工作階段與 Workspace 資格由 [私人網站與授權契約](./private-site.md) 負責；只有授權成功後，伺服器才可使用本文件定義的發布讀取模型。

## E／S／P

- **E**：建立發布版本時固定的 Knowledge Card Engine 提交 SHA。
- **S**：建置開始時固定的 Knowledge Card Workspace 來源提交 SHA。
- **P**：保存本次生成產物的 Knowledge Card Workspace 提交 SHA。
- **release_id**：一次發布的穩定識別。
- **manifest**：五個生成產物的資訊清單，記錄 SHA-256、位元組數與結構版本；生成產物本身由 [生成資料、搜尋與圖譜契約](./generated-data.md) 定義。

P 只有兩種合法形態：

1. `P = S`，表示沒有生成資料提交差異。
2. P 是 S 的直接子提交，而且該提交只修改允許的生成產物路徑。

其他祖先關係或變更路徑一律拒絕。

## Knowledge Card Workspace 路徑

目前發布指標：

```text
releases/current.json
```

發布描述：

```text
releases/by-id/<release-id>.json
```

生成產物：

```text
data/search.json
data/vectors.json
data/relations.json
data/concepts.json
data/graph.json
```

發布指標只保存發布識別、路徑與更新時間，不要求 P 自我記錄自己的 SHA，因此沒有循環引用。

## 資訊清單

資訊清單固定列出全部生成產物。每個項目包含：

- SHA-256
- UTF-8 位元組數
- 產物 結構版本

發布描述同時保存 `engine_sha`、`source_sha`、`published_sha`、建置模式、建立時間與 `manifest`。

私人讀取器會重新驗證：

- 發布指標資料形狀
- 發布描述資料形狀
- 資訊清單中的檔案集合
- 產物雜湊／位元組數
- 產物 E／S 追溯資訊
- P 版本鏈結
- 生成資料與 Knowledge Card 集合一致性

任一不一致都必須驗證失敗即拒絕。

## 建置與發布

發布流程依序完成生成資料建置、發布描述建立、版本鏈結檢查與目前發布指標推進。

- 生成資料建置前先驗證 Knowledge Card Workspace、分類體系與 Knowledge Card 集合，再依 [生成資料、搜尋與圖譜契約](./generated-data.md) 建立五個正式生成產物。
- 發布定案時固定 `manifest`、發布描述與目前發布指標。
- 發布驗證會重新檢查目前發布資料、資訊清單與 E／S／P 版本鏈結。
- 可重用工作流程 `.github/workflows/release-workspace.yml` 固定 E 與 S，並以倉庫層級並行控制避免較舊與較新的執行同時推進目前發布版本。
- 來源在建置期間前進時，較舊的執行不得更新發布指標。
- 只含生成資料或只更新發布指標的機器提交，必須由 Workspace 觸發條件排除，避免形成發布循環。
- 使用本機語意嵌入向量時，模型下載或推論失敗視為建置失敗，不得靜默改用較弱方法。

只要目前發布指標尚未前進，私人網站就繼續讀取上一個完整發布版本。

實際建置、定案與驗證命令集中在 [開發與驗證指南](../guides/development.md)；本契約只定義發布必須滿足的版本與一致性規則。
## 私人讀取模型

本節只定義授權完成後「讀哪一版資料」。授權是否成立由 [私人網站與授權契約](./private-site.md) 決定；發布讀取器不得自行放寬授權條件。

授權成功後，伺服器：

1. 解析設定的 Knowledge Card Workspace 版本參照（ref）與目前發布指標。
2. 驗證發布描述。
3. 固定 P。
4. 驗證 P 版本鏈結。
5. 從 P 載入 Knowledge Card、分類體系與五個生成產物。
6. 驗證資訊清單與生成資料一致性。
7. 以 `release_id + P` 作為伺服器端快照快取鍵。

`/api/cards`、`/api/cards/:id`、`/api/search`、`/api/graph` 與 `/api/release` 都從同一個快照取得資料。

在第一個發布版本建立前，如果 Knowledge Card Workspace 沒有目前發布指標且沒有生成產物，讀取器進入只有 Knowledge Card 的啟動模式：Knowledge Card 列表／詳細資料可用，搜尋／圖譜回 `RELEASE_REQUIRED`，`/api/release` 回 `mode: "bootstrap"`。

如果生成產物已存在但目前發布指標缺失，視為不完整發布並驗證失敗即拒絕，不退回啟動模式。

## 回復

回復不改寫 Git 歷史。將目前發布指標切回既有、仍相容且已驗證的發布版本，即可讓伺服器重新讀取該 P。

新的建置或部署失敗時，只要目前發布指標沒有被更新，使用者就會繼續讀取上一個完整發布版本。

就發布資料本身而言，發布完成至少必須滿足：

- Knowledge Card Workspace 發布工作流程成功。
- 目前發布指標已更新到預期發布版本。
- 目前指標指向的發布描述、E／S／P 鏈結與資訊清單可重新驗證。

網站部署與授權後的線上回讀屬私人網站的部署驗收；相關要求見 [私人網站與授權契約](./private-site.md)。
