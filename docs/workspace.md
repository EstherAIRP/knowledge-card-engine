# Workspace 契約

Workspace 是 Knowledge Card 的私人資料根目錄。Engine 只接受呼叫端明確提供的 Workspace root，不會從目前工作目錄、repository 名稱或其他環境資訊推測私人資料位置。

## 必要檔案與目錄

Workspace root 必須包含：

- `workspace.yaml`：工作區識別與標準目錄映射。
- `engine.lock.json`：核准的 engine repository、完整 commit SHA 與 Workspace schema 相容資訊。
- `profile/`：經使用者授權的私人背景與分析政策。
- `projects/`：私人專案背景與需求。
- `content/knowledge/`：Knowledge Cards。
- `config/`：Taxonomy、人工設定與其他不含密鑰的設定。
- `state/`：accepted source state，以及 research-bound analysis 成功後的 compact research provenance state。
- `data/`：可重建的搜尋、向量、關聯與 Concept 索引。
- `releases/`：私人發布描述與發布指標。

實際目錄名稱由 `workspace.yaml.paths` 指定；七個 logical path 都必須存在且互不重複。

## Profile 與分析政策

`profile/` 保存使用者明確授權的私人背景與 analysis policy。這些政策不是 Card 正文來源，也不會因為位於 Workspace 就自動取得引用權限；背景是否可供分析、是否可寫入 Card，仍依各 Workspace 明確授權處理。

Workspace 可以用 `profile/language-policy.md` 定義 Knowledge Card 的輸出語言與術語偏好。若此檔存在，Knowledge Card 的產生、重新分析與 Remote Ingest analysis 在建立 AI-owned 自然語言內容前必須讀取它；若不存在，使用 Runtime 的預設語言規則。

語言政策只控制 AI-owned 敘述層，不可：

- 覆蓋 Card Schema、Taxonomy、evidence binding 或 ownership 契約。
- 改寫 accepted evidence、直接引用或程式碼。
- 修改任何 user-owned override 或完整 `## 使用者備註`。
- 從聊天記憶或其他未授權來源補充私人背景。

`profile/` 內容屬私人 Workspace 資料，不得複製到公開 Engine、公開 PR、測試 fixture 或建置產物。

## workspace.yaml

目前支援的 Workspace schema version 是 `1`。

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

欄位契約：

- `schema_version`：目前只接受整數 `1`；未知版本 fail closed。
- `workspace_id`：1–64 位小寫英數或 `-`，第一字元必須是英數。
- `paths`：必須且只能包含 `profile`、`projects`、`knowledge`、`config`、`state`、`data`、`releases`。

每個 path 都必須是 Workspace root 內的 canonical relative path。以下情況會被拒絕：

- 空字串或前後空白。
- 絕對路徑。
- 反斜線。
- 空 segment、`.`、`..`。
- normalize 後與原值不同。
- 兩個 logical path 指向同一位置。
- resolve 後越出 Workspace root。
- 對應路徑不存在或不是目錄。

結構 Schema：[`schema/workspace.schema.json`](../schema/workspace.schema.json)。

## engine.lock.json

目前支援的 engine lock schema version 是 `1`。

```json
{
  "schema_version": 1,
  "engine_repository": "EstherAIRP/knowledge-card-engine",
  "engine_commit": "<40-character-lowercase-git-sha>",
  "workspace_schema_version": 1
}
```

欄位契約：

- `schema_version`：目前只接受整數 `1`。
- `engine_repository`：`owner/repository` 格式。
- `engine_commit`：完整 40 位小寫十六進位 Git SHA。
- `workspace_schema_version`：正整數，必須與 `workspace.yaml.schema_version` 相同，且必須由目前 engine 支援。

Workspace 不追隨 engine `main`。升級 engine 時必須以新的不可變 commit SHA 更新 lock，不能只修改 branch 或 tag 名稱。

結構 Schema：[`schema/engine-lock.schema.json`](../schema/engine-lock.schema.json)。

## Loader 與相容性驗證

`loadWorkspace(root, options)` 依序驗證：

1. root 已明確提供。
2. `workspace.yaml` 與 `engine.lock.json` 存在且可解析。
3. 兩份檔案只包含契約允許的欄位。
4. 兩種 schema version 都受支援。
5. `workspace_id` 與所有 path 合法。
6. `engine.lock.json.workspace_schema_version` 與 Workspace schema 一致。
7. 呼叫端若提供 expected engine repository / commit，lock 必須完全相符。
8. 七個 resolved path 都在 root 內；預設還會要求目錄實際存在。

任何一項不成立都 fail closed，不回傳部分載入的 Workspace。

## GitHub Actions engine pin

Engine 提供三個 Workspace reusable workflow：

- `.github/workflows/validate-workspace.yml`
- `.github/workflows/release-workspace.yml`
- `.github/workflows/ingest-workspace.yml`

Workspace 對應的 validation、release 與 ingestion 薄層 workflow 都必須以完整 SHA 引用，且三者必須和 `engine.lock.json.engine_commit` 完全一致。例如：

```yaml
uses: EstherAIRP/knowledge-card-engine/.github/workflows/ingest-workspace.yml@<40-sha>
```

Workflow pin 驗證同時核對 reusable workflow 名稱、repository 與 commit。Validation runner 會驗三個 Workspace caller；release 與 ingestion runner 也會再次驗證自己的 caller pin與實際 checkout 的 Engine SHA。任何 repository、workflow 名稱或 SHA 不一致都 fail closed。

## 驗證命令

本機或 CI 可使用：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/ingest.yml \
  --reusable-workflow=ingest-workspace.yml
```

完整 Workspace CI 還會執行 Card / Taxonomy、accepted source-state 與 research provenance state 驗證；詳見 [development.md](./development.md)。
