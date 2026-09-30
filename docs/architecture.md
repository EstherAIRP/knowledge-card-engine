# Knowledge Card Engine 架構

Knowledge Card Engine 保存可公開重用的程式、Schema、驗證與共用自動化；私人 Knowledge Card Workspace 保存真實知識資料與使用者狀態。公開 `knowledge-card-engine` 的測試、範例與合成測試資料只能使用合成內容。

## 模組責任

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人 Card 列表／詳細資料、搜尋、關聯／Concept 與圖譜 UI 外殼；樣式依責任分層，私人資料只由通過授權的 API 在執行階段取得。 |
| `apps/server` | GitHub App 使用者授權、伺服器端工作階段、資格重查、使用 GitHub App 安裝權杖（installation token）的 Knowledge Card Workspace 讀取器，以及固定於發布版本的 Card／搜尋／圖譜／發布 API。 |
| `packages/core` | Card／分類體系解析、Schema 與受控值驗證、所有權、正文契約、集合唯一性與穩定路徑。 |
| `packages/ingestion` | URL 正規化、GitHub 中繼資料與 README 已接受證據、固定倉庫版本的 GitHub 研究候選與選定證據擷取、Threads 結構完整串文證據、新建／更新解析，以及來源供應者專屬的來源狀態契約。 |
| `packages/analysis` | 與來源供應者無關的分析結果、研究計畫、分析證據包、結構化研究報告與證據支撐的品質門檻；綁定研究證據的分析可同時綁定來源證據與分析證據摘要值。 |
| `packages/graph` | 確定性搜尋、詞彙向量、具型別關聯、Concept、語意鄰近項目與圖譜投影；生成資料帶有追溯資訊與指紋。 |
| `packages/workspace` | Workspace 載入器、Engine 版本鎖定，以及經驗證的 Card、來源狀態與研究狀態交易式寫入。 |
| `packages/release` | E／S／P、生成產物資訊清單（manifest）、發布描述／指標與版本鏈結驗證。 |

模組透過明確資料契約連接：來源收錄層不直接寫入 Card；分析層不自行擷取外部來源，也不操作 Knowledge Card Workspace 檔案系統；Knowledge Card Workspace 寫入器不自行推論來源內容。GitHub 綁定研究證據的版本 2 分析，必須把已驗證的分析證據包一併交給 Knowledge Card Workspace 寫入器。

GitHub Remote Ingest 在取得已接受證據後固定倉庫版本，並建立第 0 輪研究狀態。Agent 先判斷關鍵研究問題與選定路徑，Knowledge Card Engine 再於同一固定版本驗證並擷取第一輪證據。第一輪證據包形成後，Agent 可選擇使用剩餘的一輪額度進行第二次與摘要值綁定的擴充；當本輪證據固定並準備分析時，Agent 重新閱讀已接受證據與最終證據包，先形成整體理解，再建立版本 2 分析。Threads 沒有研究證據包契約，因此其 Remote Ingest 與來源供應者專屬直接 CLI 維持使用版本 1 的已接受來源分析，但同樣在產生分析前重新閱讀最終已接受證據。

## 目前資料流

支援來源共用的完整資料流是：

```text
來源 URL
→ 來源供應者專屬解析／標準來源識別
→ 來源供應者專屬已接受證據
→ 可選的來源供應者專屬分析證據擴充
→ 重新閱讀最終證據 + Agent 知識整合
→ 與證據綁定的分析結果
→ 依來源識別／標準網址判定新建或更新
→ 遵守所有權規則的 Card 候選
→ 完整 Card 集合驗證
→ Card + 已接受來源狀態 + 可選的精簡研究追溯資訊
```

GitHub 以倉庫中繼資料與 README 建立已接受證據。研究流程會在已接受的 README 尚未變更的前提下，固定預設分支提交版本，受限展開倉庫目錄樹並產生可供導覽的文字候選提示；這些候選項目不是選定證據的允許清單。

Remote Ingest 從空的第 0 輪研究狀態開始，由 Agent 先提交關鍵研究問題的研究計畫與選定路徑；Knowledge Card Engine 對同一固定版本中的安全倉庫相對文字路徑重新驗證、取得對應的 Git blob，並形成分析證據包。第一輪後 Agent 可立即提交版本 2 分析；若仍缺少關鍵證據，才使用第二輪額度做額外擴充。直接使用 `ingest:github` CLI 不接收研究證據包，因此走版本 1 的已接受來源分析。

Threads 先解析到具體貼文，再依回覆／根貼文關係與可用的結構證據重建根貼文及完整有序串文，必要時使用與摘要值綁定的語意續篇交接。Threads 不建立 GitHub 研究證據包，正式分析使用版本 1。

Card 與狀態寫入前會完成證據、分析綁定、所有權與集合驗證。GitHub 版本 2 另建立不含來源全文的精簡研究追溯狀態；Card、已接受來源狀態與研究狀態由同一個檔案交易提交，任一步驟失敗都回復已提交項目。GitHub 版本 1 更新若遇到既有研究狀態，會在同一交易移除該過期追溯資訊。

## 資料權威與所有權

- Card 前置中繼資料的結構由公開 `schema/knowledge-card.schema.json` 定義。
- 分類體系的結構由公開 `schema/taxonomy.schema.json` 定義；實際受控詞彙由各 Knowledge Card Workspace 的 `config/taxonomy.yaml` 提供。
- Knowledge Card Workspace 的結構由 `workspace.yaml` 與 `engine.lock.json` 定義。
- `*.user` 覆寫、穩定 `id`、`created_at` 與完整「使用者備註」屬保護狀態，一般重新分析不得修改。
- 已接受來源狀態是通過來源驗證後的精簡狀態；GitHub 不保存 README 全文，Threads 不保存貼文原文，只保存必要中繼資料與內容指紋。
- GitHub 研究追溯狀態位於已設定狀態根目錄的 `research/github/`，只保存倉庫版本、證據路徑／雜湊／位元組數、覆蓋狀態與 Card／來源綁定，不保存來源原文。

## Knowledge Card Engine／Workspace 邊界

Knowledge Card Engine 接收明確指定的工作區根目錄，不以目前工作目錄或固定私人倉庫名稱推測資料位置。Knowledge Card Workspace 以 `engine.lock.json` 固定核准的 Knowledge Card Engine 倉庫與完整提交 SHA；CI 再驗證工作流程版本鎖定、鎖定檔與實際簽出的 Knowledge Card Engine SHA 一致。

Workspace、Card、來源收錄、生成資料與一致發布的詳細契約分別見 [workspace.md](./workspace.md)、[card-contract.md](./card-contract.md)、[ingestion.md](./ingestion.md)、[generated-data.md](./generated-data.md) 與 [release.md](./release.md)。

## 私人閱覽資料流

目前私人網站的讀取邊界：

```text
瀏覽器
→ GitHub App `state` 參數 + PKCE 登入
→ 不透明的工作階段識別值
→ 伺服器端使用者權杖工作階段
→ 每次請求重新檢查私人 Workspace 資格
→ GitHub App 安裝權杖
→ 目前發布指標
→ 已驗證的發布描述 + E／S／P 資訊清單
→ 固定已發布版本 P
→ 已驗證的分類體系 + Card 集合 + 生成產物
→ Card／搜尋／圖譜／發布投影
```

登入憑證與倉庫資料憑證彼此分離。使用者存取權杖只存在伺服器端工作階段儲存區；GitHub App 安裝權杖只存在伺服器執行環境。私人 API 必須先完成授權，才能讀取 Knowledge Card Workspace 快照快取。

私人 API 也必須先完成授權，才能讀取發布快照快取。第一個發布版本尚未建立、且 Workspace 沒有任何生成產物時，只提供啟動階段的 Card 列表／詳細資料；一旦存在目前發布版本，Card、搜尋、圖譜與發布 API 都固定讀取同一個 P。詳細契約見 [private-site.md](./private-site.md)、[web-ui.md](./web-ui.md) 與 [release.md](./release.md)。

Node 轉接器預設使用單一處理程序內的記憶體工作階段儲存區；正式部署若需要跨處理程序或無伺服器（serverless）執行個體共享工作階段，必須注入共用的伺服器端工作階段儲存區。
