# 私人網站與授權契約

Knowledge Card Engine 目前提供一個不綁特定託管平台的唯讀私人網站邊界。本文件回答的是「誰可以讀取私人資料，以及授權後如何安全讀取」。

瀏覽器只取得公開介面外殼與通過授權的 Knowledge Card API 回應；GitHub 憑證、Knowledge Card Workspace 倉庫憑證、`profile/`、`projects/` 與其他私人原始資料都不會打包進公開靜態資產。

發布版本如何選定、E／S／P 如何驗證，以及哪些資料必須屬於同一發布快照，由 [一致發布契約](./release.md) 定義。本文件不重新定義發布一致性規則。

## 安全責任分離

登入與資料讀取使用不同的 GitHub 憑證：

1. **GitHub App 使用者存取權杖（user access token）**：只用來確認 GitHub 身分，以及該使用者是否能存取設定的私人 Knowledge Card Workspace 倉庫。
2. **GitHub App 安裝存取權杖（installation access token）**：只存在伺服器執行環境，用來讀取設定的 Knowledge Card Workspace 倉庫內容。

使用者存取權杖與 refresh token 都不回傳給瀏覽器，也不放進工作階段 Cookie。瀏覽器的 `__Host-kc_session` 只保存不可推導憑證的不透明工作階段識別值；對應的 GitHub 憑證與使用者資料保存在伺服器端工作階段儲存區。

GitHub App 倉庫權限至少需要：

- Metadata: Read-only
- Contents: Read-only

伺服器端安裝存取權杖請求會再限制到設定的 Knowledge Card Workspace 倉庫，並只要求 `contents: read`。

## 登入流程

`GET /api/auth/login`：

1. 建立隨機 OAuth `state`。
2. 建立 PKCE 驗證碼（verifier）與 SHA-256／S256 挑戰值（challenge）。
3. 把 `state`／驗證碼放進 10 分鐘有效的 `__Host-kc_oauth` Cookie。
4. 重新導向 GitHub App 授權端點。

流程 Cookie 屬性：

- HttpOnly
- Secure
- SameSite=Lax
- Path=/
- 無 Domain

GitHub 回呼網址固定為：

```text
{KC_PUBLIC_URL}/api/auth/callback
```

`KC_PUBLIC_URL` 必須是 HTTPS 來源（origin），不能帶路徑、查詢參數或片段。

`GET /api/auth/callback` 會驗證 `state` 與流程有效期，再使用原始 PKCE 驗證碼交換 GitHub App 使用者存取權杖。成功後以該權杖讀取 GitHub 使用者身分，再讀取設定的 Knowledge Card Workspace 倉庫中繼資料。

只有同時符合以下條件才建立工作階段：

- GitHub 使用者身分可驗證。
- 使用者存取權杖可讀取設定的倉庫。
- 倉庫的 `full_name` 與設定相符。
- 倉庫是私人倉庫。

403／404 視為沒有 Knowledge Card Workspace 資格；401 視為使用者授權無效；速率限制、5xx 或網路失敗都採驗證失敗即拒絕。

## 工作階段

工作階段自登入成功起固定有效最長 30 天，不採滑動延長。若 GitHub 回傳會到期的使用者存取權杖，登入時必須同時取得 refresh token；伺服器會在使用者存取權杖接近到期時以 refresh token 輪替新的憑證，輪替不延長原本 30 天的工作階段期限。若 GitHub 回傳的 refresh token 自身期限早於 30 天，伺服器端工作階段以較早期限為準。

瀏覽器 Cookie：

```text
__Host-kc_session=<opaque-random-id>
```

屬性：

- HttpOnly
- Secure
- SameSite=Lax
- Path=/
- 無 Domain
- Max-Age 最長 2592000 秒（30 天）

伺服器端工作階段內容保存：

- GitHub 使用者 `id`／`login`／`avatar`
- GitHub App 使用者存取權杖
- 使用者存取權杖到期時間；若該權杖不會到期則為空值
- GitHub refresh token 與其到期時間；僅在 GitHub 回傳可輪替憑證時存在
- 工作階段到期時間

`createPrivateSiteApp({ sessionStore })` 可注入工作階段儲存區；介面必須提供非同步 `create/get/update/acquireRefresh/delete`。`acquireRefresh` 用短效鎖序列化同一工作階段的 GitHub 憑證輪替，避免多個並行私人 API 同時使用一次性的 refresh token。內建 `createMemorySessionStore` 是單一處理程序內的參考實作：處理程序重新啟動會讓所有工作階段安全失效，但不適合需要跨執行個體或無伺服器請求共享工作階段的部署。

Knowledge Card Engine 另提供 `createRestSessionStore`，使用相容 Redis 的 REST 指令端點保存具存活期限的伺服器端工作階段。它需要 `KC_SESSION_STORE_REST_URL` 與 `KC_SESSION_STORE_REST_TOKEN`，工作階段鍵使用 `kc:session:` 命名空間。REST 後端無法讀寫或回傳格式錯誤的值時，工作階段操作採驗證失敗即拒絕。

## 每次請求重新驗資格

目前不使用授權快取。每一個私人 API 請求都會：

1. 解析不透明工作階段識別值。
2. 從伺服器端工作階段儲存區取得 GitHub 使用者憑證。
3. 若使用者存取權杖距離到期不足 5 分鐘，以伺服器端 refresh token 向 GitHub 輪替新的使用者憑證，並更新同一個工作階段識別值下的伺服器端狀態。
4. 使用目前有效的使用者存取權杖重新讀取設定的私人 Knowledge Card Workspace 倉庫中繼資料。
5. 成功後才讀取安裝存取權杖快取或 Knowledge Card Workspace 資料快取。

因此：

- 沒有工作階段 → 401。
- GitHub 使用者存取權杖已撤銷／失效，或 refresh token 已無法再輪替 → 401，刪除伺服器工作階段並清除 Cookie。
- GitHub 權杖輪替暫時無法連線或 GitHub 服務暫時失敗 → 503，保留尚未到期的伺服器工作階段供後續重試。
- 使用者仍能登入 GitHub App，但失去 Knowledge Card Workspace 倉庫存取權 → 403。
- GitHub 無法完成資格重查 → 503；不提供舊快取中的私人內容。

伺服器端資料快取不能繞過授權；必須先完成授權，再讀取 Knowledge Card 快照快取。

## 登出與撤銷

`POST /api/auth/session` 是登出操作，而且必須帶與 `KC_PUBLIC_URL` 相同的 `Origin`。

登出順序：

1. 取得伺服器端工作階段與 GitHub 使用者存取權杖。
2. 呼叫 GitHub `DELETE /applications/{client_id}/token` 撤銷該使用者存取權杖。
3. GitHub 回報成功後，刪除伺服器工作階段；其中保存的 refresh token 一併移除。
4. 清除 `__Host-kc_session`。

若 GitHub 使用者存取權杖撤銷失敗，API 回傳錯誤、保留伺服器工作階段與 Cookie，不宣稱登出成功。

管理端若移除使用者對私人 Knowledge Card Workspace 倉庫的資格，不需要依賴安裝存取權杖；下一個私人 API 請求的使用者存取權杖 資格重查會得到 403。

## 私人 API

### GET /api/health

公開端點。固定回傳：

- `status`
- `configured`

若 `configured: false`，另外回傳 `configuration_error.code` 與 `configuration_error.detail`。診斷內容只描述缺少的環境變數名稱或格式規則，不回傳環境變數值、倉庫憑證或其他秘密。

### GET /api/auth/session

需要有效工作階段並重新驗證 Knowledge Card Workspace 資格。只回傳最少的使用者投影：

- id
- login
- avatar URL
- repository permission
- 工作階段到期時間

不回傳使用者存取權杖、安裝存取權杖 或伺服器工作階段識別值。

### POST /api/auth/session

登出並撤銷使用者存取權杖。需要同源的 `Origin`。

### GET /api/cards

需要授權。支援：

- `limit`：1–100，預設 50
- `cursor`：由伺服器產生、綁定倉庫版本的分頁游標（cursor）

只回傳 Knowledge Card 摘要，不回正文。摘要目前包含穩定 ID、`title`、`summary`、標準網址、`source type`、`effective resource kind`／`navigation`／`tags`／`relevance`／`actions`／`status`，以及建立、更新與最近檢查日期。這些欄位供已授權的 Knowledge Radar 首頁呈現、排序與瀏覽器端篩選；正文仍只由 Knowledge Card 詳細資料 API 提供。

分頁游標綁定 Knowledge Card Workspace 提交 SHA；如果下一頁請求時設定的版本參照（ref）已移到另一個版本，回 409 `DATA_VERSION_CHANGED`，要求從第一頁重新讀取，避免跨版本混頁。

### GET /api/cards/:id

需要授權。只接受 Knowledge Card 穩定 ID，不接受倉庫路徑。

伺服器先由受驗證的 Knowledge Card 集合建立 ID→Knowledge Card 對應表，再回傳：

- Knowledge Card 安全中繼資料投影
- 有效所有權值
- 關聯／Concept 投影
- Markdown 正文

不存在的 id 回 404；非法 id 回 400。

### GET /api/search

需要授權。使用 `q` 與可選的 `limit` 執行伺服器端確定性搜尋：

- `q` 必填，最長 300 字元。
- `limit` 為 1–100，預設 20。
- 只回傳顯示所需的 Knowledge Card 投影、比對證據與分數。
- 只有目前已驗證的發布版本存在時可用；只有 Knowledge Card 的啟動模式回 `503 RELEASE_REQUIRED`。

搜尋索引的內容、評分與生成方式由 [生成資料、搜尋與圖譜契約](./generated-data.md) 定義；本文件只規定私人 API 的授權、參數與回傳邊界。

### GET /api/graph

需要授權。只回傳目前發布版本的圖譜顯示投影：Knowledge Card／Concept 節點、具型別邊、語意鄰近項目與版面方法，不提供任意 Knowledge Card Workspace 路徑或原始倉庫資料傾印。

### GET /api/release

需要授權。回傳目前讀取模型的發布投影。第一個發布版本尚未建立時回 `mode: "bootstrap"`；存在目前發布版本時回傳 `release_id`、E／S／P、`manifest` 投影、版本修訂值與發布指標修訂值。

## Knowledge Card Workspace 倉庫讀取器

讀取器的倉庫由 `KC_WORKSPACE_OWNER`、`KC_WORKSPACE_REPO` 與 `KC_WORKSPACE_REF`（預設 `main`）定位，但私人 API 不直接以目前分支內容拼裝 Card、搜尋與圖譜資料。

每次私人請求都必須先完成本文件定義的 Workspace 資格重查。授權成功後，伺服器才可依 [一致發布契約](./release.md) 建立或取得已驗證的發布快照。發布讀取器負責固定目前發布版本、驗證版本鏈結與生成資料一致性；Private Site 只使用驗證成功的結果，不另行選擇其他版本。

因此：

- `/api/cards`、`/api/cards/:id`、`/api/search`、`/api/graph` 與 `/api/release` 不得跨不同發布版本混讀。
- 第一個發布版本尚未建立時，是否可進入只有 Knowledge Card 的啟動模式，由 Release 契約判定。
- 生成產物已存在但發布狀態不完整時，讀取器必須驗證失敗即拒絕，Private Site 不得自行退回其他版本。
- 發布快照快取只能在授權完成後使用；快取命中不能取代每次請求的 Workspace 資格重查。

Knowledge Card 單檔上限目前是 1 MiB；分類體系、發布中繼資料與生成產物另有伺服器端大小限制。完整發布讀取流程、快照鍵、E／S／P 與資訊清單驗證見 [一致發布契約](./release.md)。

## GitHub App 伺服器憑證

Knowledge Card Engine 以 RS256 GitHub App JWT 建立安裝存取權杖。JWT `iat` 向前容忍 60 秒時鐘偏差，`exp` 約為 9 分鐘。

安裝存取權杖：

- 由固定安裝 ID 建立。
- 請求限制到設定的 Knowledge Card Workspace 倉庫。
- 只要求 `contents: read`。
- 依 GitHub 回傳的 `expires_at` 保存在伺服器記憶體快取。
- 有效期結束前 60 秒不再重用。

程式不假設安裝存取權杖有固定長度或固定字首。

GitHub REST 請求使用 API 版本 `2026-03-10`。

## UI 整合邊界

`apps/web` 提供唯讀的 Knowledge Radar 介面，但 UI 不建立自己的授權或資料讀取規則。

- 未授權狀態只顯示公開介面外殼。
- Card、搜尋與圖譜資料只能由本文件定義的已授權 API 取得。
- Knowledge Card 永久連結與瀏覽器歷程不能繞過伺服器端工作階段與 Workspace 資格重查。
- 401／403 回應必須讓前端清除目前私人狀態並回到授權流程。
- 介面外殼不得預載私人 Knowledge Card、生成索引或憑證。

版面、路由、Markdown 呈現、圖譜互動、響應式與無障礙等介面規則，以 [網頁介面與版面配置](./web-ui.md) 為權威來源。

## 部署邊界

私人網站的部署不得改變本文件的授權與憑證模型：

- `KC_PUBLIC_URL` 必須對應正式 HTTPS origin；OAuth 回呼、同源檢查與 Cookie 安全屬性都以此為基準。
- 單一處理程序可使用記憶體工作階段儲存區作為參考實作；多執行個體或無伺服器環境必須使用可共享的伺服器端工作階段儲存區。
- Vercel 轉接器只有在共用 REST 工作階段儲存區設定完整時才啟用登入能力，不能退回單一處理程序記憶體模式。
- 部署平台的逾時、快取或平行讀取最佳化不得降低資格重查、資料大小、雜湊、Schema、所有權與發布一致性的驗證門檻。

環境變數、Node 本機啟動、Vercel 設定與授權後線上回讀的操作步驟，集中在 [私人網站部署指南](../guides/deployment.md)。
## 尚未提供的能力

目前私人網站不提供：

- `profile/`／`projects/` 原始資料 API
- 任意倉庫／路徑代理
- 網站寫入 Knowledge Card
- 外部嵌入模型／模型搜尋供應者
- 內建代管式工作階段資料庫／資源

以上能力不能從目前 API 或 UI 推測為已存在。
