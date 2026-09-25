# 工作區 契約

工作區 是 Knowledge Card 的私人資料根目錄。Engine 只接受呼叫端明確提供的 工作區根目錄，不會從目前工作目錄、倉庫 名稱或其他環境資訊推測私人資料位置。

## 必要檔案與目錄

工作區根目錄 必須包含：

- `workspace.yaml`：工作區識別與標準目錄映射。
- `engine.lock.json`：核准的 engine 倉庫、完整 提交 SHA 與 工作區 結構規格 相容資訊。
- `profile/`：經使用者授權的私人背景與分析政策。
- `projects/`：私人專案背景與需求。
- `content/knowledge/`：Knowledge Cards。
- `config/`：分類體系、人工設定與其他不含密鑰的設定。
- `state/`：accepted 來源狀態，以及 research-bound 分析 成功後的 compact 研究追溯狀態。
- `data/`：可重建的搜尋、向量、關聯與 Concept 索引。
- `releases/`：私人發布描述與發布指標。

實際目錄名稱由 `workspace.yaml.paths` 指定；七個 邏輯路徑 都必須存在且互不重複。

## Profile 與分析政策

`profile/` 保存使用者明確授權的私人背景與 分析政策。這些政策不是 卡片 正文來源，也不會因為位於 工作區 就自動取得引用權限；背景是否可供分析、是否可寫入 卡片，仍依各 工作區 明確授權處理。

工作區 可以用 `profile/language-policy.md` 定義 Knowledge Card 的輸出語言與術語偏好。若此檔存在，Knowledge Card 的產生、重新分析與 Remote Ingest 分析 在建立 AI 可更新 自然語言內容前必須讀取它；若不存在，使用 Runtime 的預設語言規則。

語言政策只控制 AI 可更新 敘述層，不可：

- 覆蓋 卡片 結構規格、分類體系、證據綁定 或 所有權 契約。
- 改寫 已接受的證據、直接引用或程式碼。
- 修改任何 使用者覆寫 或完整 `## 使用者備註`。
- 從聊天記憶或其他未授權來源補充私人背景。

`profile/` 內容屬私人 工作區 資料，不得複製到公開 Engine、公開 PR、測試 測試樣本 或建置產物。

## workspace.yaml

目前支援的 工作區 結構版本 是 `1`。

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

- `schema_version`：目前只接受整數 `1`；未知版本 驗證失敗即拒絕。
- `workspace_id`：1–64 位小寫英數或 `-`，第一字元必須是英數。
- `paths`：必須且只能包含 `profile`、`projects`、`knowledge`、`config`、`state`、`data`、`releases`。

每個 path 都必須是 工作區根目錄 內的 正規相對路徑。以下情況會被拒絕：

- 空字串或前後空白。
- 絕對路徑。
- 反斜線。
- 空 路徑片段、`.`、`..`。
- 正規化 後與原值不同。
- 兩個 邏輯路徑 指向同一位置。
- 解析 後越出 工作區根目錄。
- 對應路徑不存在或不是目錄。

結構 結構規格：[`schema/workspace.schema.json`](../結構規格/workspace.結構規格.json)。

## engine.鎖定.json

目前支援的 engine 鎖定 結構版本 是 `1`。

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

工作區 不追隨 engine `main`。升級 engine 時必須以新的不可變 提交 SHA 更新 鎖定，不能只修改 branch 或 tag 名稱。

結構 結構規格：[`schema/engine-lock.schema.json`](../結構規格/engine-鎖定.結構規格.json)。

## 載入器 與相容性驗證

`loadWorkspace(root, options)` 依序驗證：

1. 根 已明確提供。
2. `workspace.yaml` 與 `engine.lock.json` 存在且可解析。
3. 兩份檔案只包含契約允許的欄位。
4. 兩種 結構版本 都受支援。
5. `workspace_id` 與所有 path 合法。
6. `engine.lock.json.workspace_schema_version` 與 工作區 結構規格 一致。
7. 呼叫端若提供 expected engine 倉庫 / 提交，鎖定 必須完全相符。
8. 七個 解析d path 都在 根 內；預設還會要求目錄實際存在。

任何一項不成立都 驗證失敗即拒絕，不回傳部分載入的 工作區。

## GitHub Actions engine 版本鎖定

Engine 提供三個 工作區 可重用工作流程：

- `.github/workflows/validate-workspace.yml`
- `.github/workflows/release-workspace.yml`
- `.github/workflows/ingest-workspace.yml`

工作區 對應的 驗證、發布 與 ingestion 薄層 工作流程 都必須以完整 SHA 引用，且三者必須和 `engine.lock.json.engine_commit` 完全一致。例如：

```yaml
uses: EstherAIRP/knowledge-card-engine/.github/workflows/ingest-workspace.yml@<40-sha>
```

Workflow 版本鎖定 驗證同時核對 可重用工作流程 名稱、倉庫 與 提交。驗證執行器 會驗三個 工作區 caller；發布 與 ingestion 執行器 也會再次驗證自己的 caller 版本鎖定與實際 簽出 的 Engine SHA。任何 倉庫、工作流程 名稱或 SHA 不一致都 驗證失敗即拒絕。

## 驗證命令

本機或 CI 可使用：

```bash
npm run workspace:validate -- /path/to/workspace \
  --engine-repository=EstherAIRP/knowledge-card-engine \
  --engine-commit=<40-sha> \
  --workflow-file=.github/workflows/ingest.yml \
  --reusable-workflow=ingest-workspace.yml
```

完整 工作區 CI 還會執行 卡片 / 分類體系、accepted 來源狀態 與 研究追溯狀態 驗證；詳見 [development.md](./development.md)。
