# Workspace 契約

## 檔案

Workspace root 必須同時包含：

- `workspace.yaml`：Workspace schema version、穩定 workspace ID 與標準目錄映射。
- `engine.lock.json`：核准的 engine repository、完整 40 位 commit SHA，以及該 engine 預期的 Workspace schema version。

Engine 不會從目前工作目錄猜測私人 workspace；所有載入都必須明確傳入 workspace root。

## workspace.yaml v1

```yaml
schema_version: 1
workspace_id: example
paths:
  profile: profile
  projects: projects
  knowledge: content/knowledge
  config: config
  state: state
  data: data
  releases: releases
```

路徑必須是 workspace root 內的 canonical relative path。絕對路徑、反斜線、空 segment、`.`、`..`、重複目錄映射都會被拒絕。

正式結構 Schema：`schema/workspace.schema.json`。

## engine.lock.json v1

```json
{
  "schema_version": 1,
  "engine_repository": "EstherAIRP/knowledge-card-engine",
  "engine_commit": "<40-character-lowercase-git-sha>",
  "workspace_schema_version": 1
}
```

Workspace 不追隨 engine `main`。lock 必須指向已核准、不可變的完整 commit SHA。正式結構 Schema：`schema/engine-lock.schema.json`。

## 相容性

目前 engine 只支援 Workspace schema version 1 與 engine lock schema version 1。未知版本會 fail closed。

`loadWorkspace(root, options)` 會驗證：

1. 兩個契約檔存在且可解析。
2. schema version 受支援。
3. lock 的 `workspace_schema_version` 與 `workspace.yaml` 一致。
4. 目錄映射安全且實際目錄存在。
5. 呼叫端若提供預期 engine repository / commit，lock 必須完全一致。

## GitHub Actions pin

`.github/workflows/validate-workspace.yml` 是可重用驗證流程。私人 workspace 的薄層 workflow 必須以完整 SHA 引用：

```yaml
uses: EstherAIRP/knowledge-card-engine/.github/workflows/validate-workspace.yml@<40-sha>
```

驗證流程同時檢查：

- workflow `uses @SHA`
- `engine.lock.json.engine_commit`
- 實際 checkout 的 `engine_sha`

三者必須一致；repository 也必須一致。
