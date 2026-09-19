# 一致發布與 Release 契約

Knowledge Card 的私人閱覽、搜尋與圖譜使用同一個已驗證 release。發布模型以 E／S／P 固定 engine、來源與 generated-data revision，避免 Card 與索引混用不同版本。

## E／S／P

- **E**：建立 release 時固定的 engine commit SHA。
- **S**：build 開始時固定的 Workspace source commit SHA。
- **P**：保存本次 generated artifacts 的 Workspace commit SHA。
- **release_id**：一次發布的穩定識別。
- **manifest**：五個 generated artifacts 的 SHA-256、bytes 與 schema version。

P 只有兩種合法形態：

1. `P = S`，表示沒有 generated commit 差異。
2. P 是 S 的直接子提交，而且該 commit 只修改允許的 generated artifact paths。

任何其他 ancestry 或 changed path 都拒絕。

## Workspace 路徑

Current release pointer：

```text
releases/current.json
```

Release description：

```text
releases/by-id/<release-id>.json
```

Generated artifacts：

```text
data/search.json
data/vectors.json
data/relations.json
data/concepts.json
data/graph.json
```

Pointer 只保存 release identity / path / update time，不要求 P 自我記錄自己的 SHA，因此沒有循環引用。

## Manifest

Manifest 固定列出所有 generated artifact。每個 entry 包含：

- SHA-256
- UTF-8 byte size
- artifact schema version

Release description 同時保存 `engine_sha`、`source_sha`、`published_sha`、build mode、created time 與 manifest。

Private reader 會重新驗證：

- pointer shape
- release description shape
- manifest file set
- artifact hash / bytes
- artifact E / S provenance
- P lineage
- generated data 與 Card collection consistency

任一不一致都 fail closed。

## Build 與發布

Engine CLI：

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

`build` 先驗證 Workspace / Taxonomy / Cards，再建立五個 artifacts。`finalize` 凍結 manifest、release description 與 current pointer。`validate` 重新驗整個 current release bundle。

Reusable workflow `.github/workflows/release-workspace.yml` 固定 E 與 S，執行 build、generated-only commit、lineage / stale guards、finalize 與 pointer advance。Workflow 使用 repository-level concurrency，避免較舊 run 與較新 run 同時更新 current release。

來源在 build 期間已前進時，舊 run 不得更新 pointer。Generated-only / pointer-only machine commit 必須由 Workspace trigger guard 排除，避免形成 release loop。

## Private read model

授權成功後，server：

1. 解析 configured Workspace ref 的 current pointer。
2. 驗 release description。
3. 固定 P。
4. 驗 P lineage。
5. 從 P 載入 Cards、Taxonomy 與五個 generated artifacts。
6. 驗 manifest 與 generated-data consistency。
7. 以 release id + P 作 server-side snapshot cache key。

`/api/cards`、`/api/cards/:id`、`/api/search`、`/api/graph` 與 `/api/release` 都從同一 snapshot 取得資料。

在第一個 release 建立前，如果 Workspace 沒有 current pointer 且沒有 generated artifacts，reader 進入 bootstrap Card-only mode：Card list/detail 可用，search / graph 回 `RELEASE_REQUIRED`，`/api/release` 回 mode `bootstrap`。

如果 generated artifacts 已存在但 current pointer 缺失，視為不完整發布並 fail closed，不退回 bootstrap。

## 回復

回復不改寫 Git 歷史。將 current pointer 切回既有、仍相容且已驗證的 release 即可讓 server 重新讀取該 P。

新 build 或部署失敗時，只要 current pointer 沒有被更新，使用者繼續讀上一個完整 release。

完整發布成功應同時滿足：

- Workspace release workflow 成功。
- current pointer 已更新到預期 release。
- 部署成功。
- 授權後的 `/api/release` live readback 與預期 release_id / E / S / P / manifest 相符。
