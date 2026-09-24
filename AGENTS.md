# AGENTS.md

本檔定義 `knowledge-card-engine` 目前有效的開發與資料規則。規則採漸進式揭露：先判定任務類型，再讀取該任務必要契約；不得為保險而預先掃描整個 Repository、全部正式文件、所有分支或 PR。

## 倉庫責任

- 保存核心程式、網站程式邊界、Schema、通用規則、共用 Actions、正式現行文件與合成測試資料。
- 真實私人背景、專案、Knowledge Cards、人工設定、來源狀態、生成索引與發布紀錄只屬於私人 Workspace，不得複製到本公開倉庫。
- 密鑰不得提交，也不得出現在測試、PR、日誌或建置產物。

## 開工前：漸進式揭露

1. 先讀本檔與 [`prompts/RUNTIME.md`](./prompts/RUNTIME.md) 的任務路由；只有 Engine 開發或需要理解 Repository 能力時才額外讀 `README.md`。
2. 依任務類型從 [`docs/index.md`](./docs/index.md) 只讀相關正式契約、Schema、程式與測試，不把索引中的全部文件當成必讀清單。
3. 單張 Knowledge Card 收錄／更新屬 Workspace 日常資料任務，不應因此掃描 Engine 全部程式、文件、branches 或 PR；只讀 Workspace 鎖定 Engine revision 中 ingestion、analysis、Card／writer 所需契約。
4. 只有會修改 Engine Repository 的任務，才確認 `main`、相關既有分支、open PR 與工作範圍；搜尋應以本次任務關鍵字或預定分支名稱為界，不預設列出全部分支／PR。
5. 以目前 Schema、runtime、tests 與本次相關正式規格交叉確認行為；若彼此衝突，先把衝突視為缺陷處理，不自行猜測。

## 資料與修改規則

- 只修改本次任務必要範圍；保留與本次任務無關的既有修改。
- Knowledge Card 必須遵守 [docs/card-contract.md](./docs/card-contract.md)。
- GitHub / Threads 收錄必須遵守 [docs/ingestion.md](./docs/ingestion.md)；不得以 URL slug、share token、時間接近、repo 名稱或模型記憶取代 accepted evidence。Threads 未證明完整串文時必須 fail closed。
- 一般重新分析不得修改穩定 `id`、`created_at`、任何 `*.user` override 或完整 `## 使用者備註`。
- 相同來源應解析為既有 Card update；identity / canonical URL 衝突必須 fail closed。
- accepted source state 只能在 evidence、analysis binding、ownership 與完整 Card collection 驗證成功後推進。GitHub research-bound analysis 的 research provenance state 必須和 Card / accepted source state 同一交易推進；不得永久保存 selected source text。
- Remote Ingest handoff 只能在專用 `chore/ingest-*` Workspace 分支執行；`state/ingestion/` 的 request、accepted evidence、Threads semantic handoff、GitHub research evidence、必要時的 GitHub research plan 與 analysis 都是暫存交換資料，正式 apply 成功後必須移除，不得進入 Workspace `main`。GitHub prepare 會先 deterministic 擷取 revision-pinned initial research pack，Agent 可直接提交 analysis；只有 evidence 不足時才提交一次 digest-bound research plan 做 optional expansion。Agent 的 request / judgement / research-plan / analysis 提交仍必須遵守單一輸入檔與 runner-parent lineage 守門，不得修改 runner-owned evidence state。GitHub research evidence handoff 可暫存 selected source text 供分析，但正式 research state 只能保留 compact provenance。
- Private API 必須在讀取 server-side Workspace/release cache 前重新驗證使用者的 Workspace 資格；前端 AuthGate 不能作為唯一授權邊界。
- Search、vector、relation、Concept、graph 與 release metadata 都是 generated/private data；真實產物不得進公開 engine、PR、測試、log 或 build artifact。
- Navigation taxonomy 與 semantic relation 不得混為同一維度；manual relation block/pin/override 必須優先於 generated result。
- Release reader 必須驗 E／S／P lineage、manifest hash/size 與 current pointer；不完整 release fail closed，不能混讀最新 Card 與舊索引。
- GitHub user access token、installation token、App private key、client secret 不得回傳到 browser；browser session cookie 只保存 opaque session id。
- 公開範例與測試只能使用合成資料。

## 正式文件規則

- 正式文件只描述目前有效的架構、契約、操作方式與限制。
- 正式文件必須自足：不得要求讀者先理解其他產品代際、開發任務、舊 PR、聊天紀錄或外部開發管理倉庫才能正確操作目前系統。
- 產品代際、遷移比較、開發 Roadmap、開發階段文件、task plan、archive 與過期設計不得放入正式文件。
- `schema_version`、`analysis_version`、API / protocol / data-format version 等可由機器驗證的版本屬於現行契約，可以保留並必須說明其驗證行為。
- 文件與 runtime 行為不一致視為缺陷；不能以歷史敘事或「沿用既有行為」代替完整現行定義。

## 分支與交付

- `main` 是唯一長期分支，不 force push。
- 一項任務使用一個短期分支：`feat/`、`fix/`、`docs/`、`chore/` 或 `migration/`。
- 正常變更透過 PR，原則採 Squash merge；合併後刪除工作分支。
- 執行與變更相關的測試、格式檢查、建置與資料驗證。
- 未執行或失敗的檢查必須明確回報，不得刪除測試、放寬規則或以假資料冒充成功。
