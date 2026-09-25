# Workspace 契約

Workspace 是 Knowledge Card 的私人資料根目錄。Engine 只接受呼叫端明確提供的工作區根目錄，不會從目前工作目錄、倉庫名稱或其他環境資訊推測私人資料位置。

## 必要檔案與目錄

工作區根目錄必須包含：

- `workspace.yaml`：工作區識別與標準目錄映射。
- `engine.lock.json`：核准的 Engine 倉庫、完整提交 SHA 與工作區結構相容資訊。
- `profile/`：經使用者授權的私人背景與分析政策。
- `projects/`：私人專案背景與需求。
- `content/knowledge/`：Knowledge Card。
- `config/`：分類體系、人工設定與其他不含密鑰的設定。
- `state/`：已接受來源狀態，以及研究型分析成功後的精簡研究追溯狀態。
- `data/`：可重建的搜尋、向量、關聯與 Concept 索引。
- `releases/`：私人發布描述與發布指標。

實際目錄名稱由 `workspace.yaml.paths` 指定；七個邏輯路徑都必須存在且互不重複。

## Profile 與分析政策

`profile/` 保存使用者明確授權的私人背景與分析政策。這些政策不是 Knowledge Card 正文來源，也不會因為位於 Workspace 就自動取得引用權限；背景是否可供分析、是否可寫入卡片，仍依各工作區明確授權處理。

Workspace 可以用 `profile/language-policy.md` 定義 Knowledge Card 的輸出語言與術語偏好。若此檔存在，建立、重新分析 Knowledge Card 或執行 Remote Ingest 分析時，在產生 AI 自然語言內容前必須先讀取；若不存在，使用執行契約中的預設語言規則。

語言政策只控制 AI 產生的敘述，不可：

- 覆蓋卡片結構、分類體系、證據綁定或所有權契約。
- 改寫已接受的證據、直接引用或程式碼。
- 修改任何 `*.user` 覆寫或完整 `## 使用者備註`。
- 從聊天記憶或其他未授權來源補充私人背景。

`profile/` 內容屬於私人 Workspace 資料，不得複製到公開 Engine、公開 PR、測試樣本或建置產物。

## workspace.yaml

目前支援的 Workspace 結構版本為 `1`。

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

- `schema_version`：目前只接受整數 `1`；未知版本一律拒絕載入。
- `workspace_id`：1–64 位小寫英數或 `-`，第一字元必須是英數。
- `paths`：必須且只能包含 `profile`、`projects`、`knowledge`、`config`、`state`、`data`、`releases`。

每個路徑都必須是工作區根目錄內的正規相對路徑。以下情況會被拒絕：

- 空字串或前後空白。
- 絕對路徑。
- 反斜線。
- 空路徑片段、`.`、`..`。
- 正規化後與原值不同。
- 兩個邏輯路徑指向同一位置。
- 解析後越出工作區根目錄。
- 對應路徑不存在或不是目錄。

結構定義：[`schema/workspace.schema.json`](../schema/workspace.schema.json)。

## engine.lock.json

目前支援的 Engine 鎖定檔結構版本為 `1`。

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
- `workspace_schema_version`：正整數，必須與 `workspace.yaml.schema_version` 相同，且必須由目前 Engine 支援。

Workspace 不追隨 Engine `main`。升級 Engine 時必須以新的不可變提交 SHA 更新鎖定檔，不能只修改分支或標籤名稱。

結構定義：[`schema/engine-lock.schema.json`](../schema/engine-lock.schema.json)。

## 載入器與相容性驗證

`loadWorkspace(root, options)` 依序驗證：

1. 已明確提供工作區根目錄。
2. `workspace.yaml` 與 `engine.lock.json` 存在且可解析。
3. 兩份檔案只包含契約允許的欄位。
4. 兩種結構版本都受支援。
5. `workspace_id` 與所有路徑合法。
6. `engine.lock.json.workspace_schema_version` 與 Workspace 結構版本一致。
7. 呼叫端若提供預期的 Engine 倉庫與提交 SHA，鎖定檔必須完全相符。
8. 七個解析後的路徑都位於工作區根目錄內；預設還會要求目錄實際存在。

任何一項不成立都會拒絕載入，不回傳部分載入的 Workspace。

## GitHub Actions 的 Engine 版本鎖定

Engine 提供三個可重用的 Workspace 工作流程：

- `.github/workflows/validate-workspace.yml`
- `.github/workflows/release-workspace.yml`
- `.github/workflows/ingest-workspace.yml`

Workspace 對應的驗證、發布與收錄薄層工作流程都必須以完整 SHA 引用，而且三者必須與 `engine.lock.json.engine_commit` 完全一致。例如：

```yaml
uses: EstherAIRP/knowledge-card-engine/.github/workflows/ingest-workspace.yml@<40-sha>
```

工作流程版本鎖定驗證會同時核對可重用工作流程名稱、倉庫與提交 SHA。驗證執行器會檢查三個 Workspace 呼叫端；發布與收錄執行器也會再次核對自己的呼叫端版本鎖定與實際簽出的 Engine SHA。任何倉庫、工作流程名稱或 SHA 不一致都會拒絕繼續執行。

## 驗證命令

本機或 CI 可使用：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/ingest.yml \
  --reusable-workflow=ingest-workspace.yml
```

完整的 Workspace CI 還會驗證卡片與分類體系、已接受來源狀態，以及研究追溯狀態；詳見 [development.md](./development.md)。
