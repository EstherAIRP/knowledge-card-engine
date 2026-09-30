# 一致發布契約

Knowledge Card 的私人閱覽、搜尋與圖譜使用同一個已驗證發布版本。發布模型以 E／S／P 固定 Knowledge Card Engine、來源與生成資料版本，避免 Knowledge Card 與索引混用不同版本。

## E／S／P

- **E**：建立發布版本時固定的 Knowledge Card Engine 提交 SHA。
- **S**：建置開始時固定的 Knowledge Card Workspace 來源提交 SHA。
- **P**：保存本次生成產物的 Knowledge Card Workspace 提交 SHA。
- **release_id**：一次發布的穩定識別。
- **manifest**：五個生成產物的資訊清單，記錄 SHA-256、位元組數與 Schema 版本。

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
- 產物 Schema 版本

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

Knowledge Card Engine 命令列工具：

```bash
npm run generated:build -- /path/to/workspace \
  --engine-sha=<E> \
  --source-sha=<S> \
  --generated-at=<iso> \
  --mode=incremental

npm run release:finalize -- /path/to/workspace \
  --engine-sha=<E> \
  --source-sha=<S> \
  --published-sha=<P> \
  --release-id=<id> \
  --created-at=<iso> \
  --mode=incremental

npm run release:validate -- /path/to/workspace
```

`generated:build` 先驗證 Knowledge Card Workspace、分類體系與 Knowledge Card 集合，再建立五個生成產物。`release:finalize` 固定 `manifest`、發布描述與目前發布指標。`release:validate` 重新驗證完整的目前發布資料。

可重用工作流程 `.github/workflows/release-workspace.yml` 固定 E 與 S，執行建置、僅含生成資料的提交、版本鏈結／過期防護、發布定案與發布指標推進。工作流程使用倉庫層級並行控制，避免較舊與較新的執行同時更新目前發布版本。

來源在建置期間已前進時，較舊的執行不得更新發布指標。僅含生成資料／僅含發布指標的機器提交必須由 Knowledge Card Workspace 的觸發條件排除，避免形成發布循環。

## 私人讀取模型

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

完整發布成功應同時滿足：

- Knowledge Card Workspace 發布工作流程成功。
- 目前發布指標已更新到預期發布版本。
- 部署成功。
- 授權後的 `/api/release` 即時回讀與預期的 `release_id`／E／S／P／`manifest` 相符。
