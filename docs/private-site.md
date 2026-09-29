# 私人網站與授權契約

Knowledge Card Engine 目前提供一個不綁特定託管平台的唯讀私人網站邊界。瀏覽器只取得公開 UI 外殼與通過授權的 Card API 回應；GitHub 憑證、Workspace 倉庫憑證、`profile/`、`projects/` 與其他私人原始資料都不會打包進公開靜態資產。

## 安全責任分離

登入與資料讀取使用不同的 GitHub 憑證：

1. **GitHub App user access token**：只用來確認 GitHub 身分，以及該使用者是否能存取設定的私人 Workspace 倉庫。
2. **GitHub App installation access token**：只存在伺服器執行環境，用來讀取設定的 Workspace 倉庫內容。

User access token 不回傳給瀏覽器，也不放進工作階段 Cookie。瀏覽器的 `__Host-kc_session` 只保存不可推導憑證的不透明工作階段識別值；對應的 user token 與使用者資料保存在伺服器端工作階段儲存區。

GitHub App repository permissions 至少需要：

- Metadata: Read-only
- Contents: Read-only

伺服器端 installation token 請求會再限制到設定的 Workspace 倉庫，並只要求 `contents: read`。

## 登入流程

`GET /api/auth/login`：

1. 建立隨機 OAuth `state`。
2. 建立 PKCE verifier 與 SHA-256／S256 challenge。
3. 把 state／verifier 放進 10 分鐘有效的 `__Host-kc_oauth` Cookie。
4. 重新導向 GitHub App authorization endpoint。

流程 Cookie 設定：

- HttpOnly
- Secure
- SameSite=Lax
- Path=/
- 無 Domain

GitHub callback 固定為：

```text
{KC_PUBLIC_URL}/api/auth/callback
```

`KC_PUBLIC_URL` 必須是 HTTPS origin，不能帶 path、query 或 fragment。

`GET /api/auth/callback` 會驗證 state 與流程有效期，再使用原始 PKCE verifier 交換 GitHub App user access token。成功後以該 token 讀取 GitHub 使用者身分，再讀取設定的 Workspace 倉庫中繼資料。

只有同時符合以下條件才建立工作階段：

- GitHub 使用者身分可驗證。
- user access token 可讀取設定的倉庫。
- repository `full_name` 與設定相符。
- repository 是 private。

403／404 視為沒有 Workspace 資格；401 視為使用者授權無效；速率限制、5xx 或網路失敗都採驗證失敗即拒絕。

## 工作階段

工作階段有效期最長 1 小時，也不會超過 GitHub user token 自身有效期。

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
- Max-Age 最長 3600 秒

伺服器端工作階段內容保存：

- GitHub user id／login／avatar
- GitHub App user access token
- user token expiry
- session expiry

`createPrivateSiteApp({ sessionStore })` 可注入工作階段儲存區；介面必須提供非同步 `create/get/delete`。內建 `createMemorySessionStore` 是單一處理程序內的參考實作：處理程序重新啟動會讓所有工作階段安全失效，但不適合需要跨執行個體或 serverless 請求共享工作階段的部署。

Engine 另提供 `createRestSessionStore`，使用 Redis-compatible REST command endpoint 保存具存活期限的伺服器端工作階段。它需要 `KC_SESSION_STORE_REST_URL` 與 `KC_SESSION_STORE_REST_TOKEN`，工作階段 key 使用 `kc:session:` namespace。REST 後端無法讀寫或回傳格式錯誤的值時，工作階段操作採驗證失敗即拒絕。

## 每次請求重新驗資格

目前不使用授權快取。每一個私人 API 請求都會：

1. 解析不透明工作階段識別值。
2. 從伺服器端工作階段儲存區取得 user token。
3. 使用 user token 重新讀取設定的私人 Workspace 倉庫中繼資料。
4. 成功後才讀取 installation token 快取或 Workspace 資料快取。

因此：

- 沒有工作階段 → 401。
- GitHub user token 已撤銷／失效 → 401，刪除伺服器工作階段並清除 Cookie。
- 使用者仍能登入 GitHub App，但失去 Workspace 倉庫存取權 → 403。
- GitHub 無法完成資格重查 → 503；不提供舊快取中的私人內容。

伺服器端資料快取不能繞過授權；必須先完成授權，再讀取 Card 快照快取。

## 登出與撤銷

`POST /api/auth/session` 是登出操作，而且必須帶與 `KC_PUBLIC_URL` 相同的 `Origin`。

登出順序：

1. 取得伺服器端工作階段與 GitHub user token。
2. 呼叫 GitHub `DELETE /applications/{client_id}/token` 撤銷該 user token。
3. GitHub 回報成功後，刪除伺服器工作階段。
4. 清除 `__Host-kc_session`。

若 GitHub token 撤銷失敗，API 回傳錯誤、保留伺服器工作階段與 Cookie，不宣稱登出成功。

管理端若移除使用者對私人 Workspace 倉庫的資格，不需要依賴 installation token；下一個私人 API 請求的 user token 資格重查會得到 403。

## 私人 API

### GET /api/health

公開端點。固定回傳：

- `status`
- `configured`

若 `configured: false`，另外回傳 `configuration_error.code` 與 `configuration_error.detail`。診斷內容只描述缺少的環境變數名稱或格式規則，不回傳環境變數值、倉庫憑證或其他秘密。

### GET /api/auth/session

需要有效工作階段並重新驗證 Workspace 資格。只回傳最少的使用者投影：

- id
- login
- avatar URL
- repository permission
- session expiry

不回傳 user token、installation token 或伺服器工作階段識別值。

### POST /api/auth/session

登出並撤銷 user token。需要同源的 `Origin`。

### GET /api/cards

需要授權。支援：

- `limit`：1–100，預設 50
- `cursor`：由伺服器產生、綁定倉庫版本的 cursor

只回傳 Card 摘要，不回正文。摘要目前包含 stable id、title、summary、標準網址、source type、effective resource kind／navigation／tags／relevance／actions／status，以及建立、更新與最近檢查日期。這些欄位供已授權的 Radar 首頁呈現、排序與瀏覽器端篩選；正文仍只由 Card Detail API 提供。

Cursor 綁定 Workspace commit SHA；如果下一頁請求時設定的 ref 已移到另一個版本，回 409 `DATA_VERSION_CHANGED`，要求從第一頁重新讀取，避免跨版本混頁。

### GET /api/cards/:id

需要授權。只接受 Knowledge Card stable id，不接受倉庫路徑。

伺服器先由受驗證的 Card 集合建立 id→Card map，再回傳：

- Card 安全中繼資料投影
- 有效所有權值
- 關聯／Concept 投影
- Markdown 正文

不存在的 id 回 404；非法 id 回 400。

### GET /api/search

需要授權。使用 `q` 與可選的 `limit` 執行伺服器端確定性搜尋。只有目前已驗證的發布版本存在時可用；只有 Card 的啟動模式回 `503 RELEASE_REQUIRED`。

### GET /api/graph

需要授權。只回傳目前發布版本的圖譜顯示投影：Card／Concept 節點、具型別邊、語意鄰近項目與版面方法，不提供任意 Workspace 路徑或原始倉庫資料傾印。

### GET /api/release

需要授權。回傳目前讀取模型的發布投影。第一個發布版本尚未建立時回 `mode: "bootstrap"`；存在目前發布版本時回傳 `release_id`、E／S／P、manifest 投影、revision 與 pointer revision。

## Workspace 倉庫讀取器

讀取器的倉庫由 `KC_WORKSPACE_OWNER`、`KC_WORKSPACE_REPO` 與 `KC_WORKSPACE_REF`（預設 `main`）定位，但 Card／搜尋／圖譜的資料來源由目前發布版本決定。

每次建立快照：

1. 解析設定的 ref，讀取 `releases/current.json`。
2. 驗證發布指標與發布描述。
3. 固定已發布版本 P，驗證 P = S，或 P 是 S 的直接、僅含生成資料的子提交。
4. 從 P 載入 `content/knowledge/{YYYY}/{stable-id}.md`、`config/taxonomy.yaml` 與五個生成產物。
5. 驗證 Card 集合、manifest 雜湊／位元組數／追溯資訊與生成資料一致性。
6. 只在完整驗證成功後建立快照快取。

若 Workspace 尚未有發布指標，且完全沒有生成產物，讀取器允許只有 Card 的啟動模式；Card 列表／詳細資料可讀，搜尋／圖譜不可用。若生成產物已存在卻沒有發布指標，視為不完整發布並採驗證失敗即拒絕。

Card 單檔上限目前是 1 MiB；分類體系／發布中繼資料與生成產物另有伺服器端大小限制。發布快照快取以 release id + P 隔離，最多保留少量版本；授權永遠先於快取。完整 E／S／P 與 manifest 契約見 [release.md](./release.md)。

## GitHub App 伺服器憑證

Knowledge Card Engine 以 RS256 GitHub App JWT 建立 installation token。JWT `iat` 向前容忍 60 秒時鐘偏差，`exp` 約為 9 分鐘。

Installation token：

- 由固定 installation id 建立。
- 請求限制到設定的 Workspace 倉庫。
- 只要求 `contents: read`。
- 依 GitHub 回傳的 `expires_at` 保存在伺服器記憶體快取。
- 有效期結束前 60 秒不再重用。

程式不假設 installation token 固定長度或固定字首。

GitHub REST 請求使用 API 版本 `2026-03-10`。

## UI

`apps/web` 提供單頁唯讀 Knowledge Radar 介面：

- 未登入：以 Knowledge Radar 品牌頁提供 GitHub 登入。
- `cancelled`／`invalid`／`forbidden`／`unavailable`：顯示同一視覺系統的登入錯誤狀態。
- 已登入首頁：使用寬版 Radar 頁面框架、主視覺、統計資訊、搜尋／篩選控制項與響應式 Knowledge Card 網格。
- 初始啟動、Card 集合、Card Detail 與 Graph 非同步讀取期間，UI 先顯示 Knowledge Radar 載入狀態：品牌化 Radar 動畫、狀態文案與骨架內容面板；載入畫面只含公開介面外殼，不預載私人 Card。`prefers-reduced-motion: reduce` 會停用載入動畫。
- Card 列表摘要只使用 `/api/cards` 已授權回傳的 title、summary、source／resource kind、navigation categories、tags、relevance、actions、status 與日期；首頁可依這些中繼資料篩選與排序，但不額外下載私人正文。
- Card Detail 瀏覽器路由使用 `/knowledge/<stable-id>`。點開 Card 後以 History API 寫入永久連結；重新整理或直接開啟該網址時，伺服器只回公開介面外殼，瀏覽器完成工作階段與 Workspace 授權後，才由 `/api/cards/:id` 取得正文並恢復同一張 Card。瀏覽器上一頁／下一頁由 `popstate` 依目前 URL 在 Card Detail 與首頁之間切換；路由本身不繞過私人 API 授權。
- Card Detail：先以寬版中繼資料內容面板顯示來源、狀態、Navigation Category、Action、Relevance、Tag 與日期；Markdown 正文維持較窄閱讀寬度。桌機右側提供固定文章目錄；較窄可視區域則把「文章目錄」整合進主固定頁首，與 Cards／Search／Graph 共用同一列，點擊後在頁首下方展開同一份章節清單，不再額外保留第二條固定區域導覽。目錄依序納入正文 H2／H3，以及實際存在的 Concept Neighborhood、Related Knowledge 頂層區段；點擊可捲動定位，並隨閱讀位置標示目前章節。Concept Neighborhood 與 Related Knowledge 在正文後維持寬版內容區，以卡片網格呈現。Concept 卡會切換至 Graph 並以該 Concept 作為查詢；Related Knowledge 顯示鄰近 Card 摘要，以及目前關聯產物可提供的 score／evidence／manual note。
- 搜尋沿用同一套頁面框架、內容面板、品牌色與控制項；資料只由已授權的 `/api/search` 取得。
- Graph UI 使用與 Cards 首頁一致的 Radar 頁面語言：主視覺內容面板、四格統計與圓角探索／篩選面板；其下維持語意可視區域調整、依節點感知的 pointer capture、滑鼠／觸控平移加雙指／滾輪縮放、Card 選取、焦點／全域模式、響應式檢視器抽屜、語意鄰近清單、節點標籤優先序、關聯顯示與圖譜篩選。資料只由已授權的 `/api/graph` 提供。
- `/api/graph` 在目前發布快照上投影圖譜檢視模型：Card 中繼資料、Concept 中繼資料、具型別邊、版面／統計，以及由目前發布版本向量即時計算的 `semantic.neighborsByCard`／`semantic.distancesByCard`。這個投影不寫回生成產物，也不跨發布版本讀資料。
- 圖譜指標規則：`pointerdown` 發生在 `.graph-node` 上時不得建立拖曳狀態或 pointer capture；Card 節點的 click／Enter／Space 必須可進入已選檢視器。
- 頁首只保留 Knowledge Radar 品牌與 Cards／Search／Graph 導覽，不顯示 release id、GitHub avatar／login 或登出按鈕；工作階段與發布 API 契約仍保留。401／403 會立即清除前端目前私人狀態，回到授權介面。
- Markdown 仍以安全 DOM 建構，不使用 `innerHTML` 解譯 Card 原文；支援 H1–H3、段落、無序／有序列表、blockquote、horizontal rule、fenced code、table、粗體／斜體、inline code、HTTP(S) link 與相對 Card `.md` link。fenced code 提供本機 Clipboard API 複製操作；相對 Card 連結會以 stable id 開啟私人 Card；raw HTML 不執行，Markdown image 不自動載入外部資源。
- UI 支援淺色／深色配色；桌機版 Radar 網格為三欄，較窄可視區域依序收斂為兩欄與單欄。

UI 外殼本身不包含任何私人 Card、生成索引或憑證；外觀與版面調整不能改變伺服器端授權與固定於發布版本的讀取邊界。樣式模組、頁面框架、閱讀寬度、響應式斷點與 UI 回歸契約見 [web-ui.md](./web-ui.md)。

## 執行環境設定

需要：

```text
KC_PUBLIC_URL
KC_SESSION_SECRET
KC_GITHUB_APP_ID
KC_GITHUB_CLIENT_ID
KC_GITHUB_CLIENT_SECRET
KC_GITHUB_PRIVATE_KEY
KC_GITHUB_INSTALLATION_ID
KC_WORKSPACE_OWNER
KC_WORKSPACE_REPO
```

Serverless／多執行個體部署另外需要：

```text
KC_SESSION_STORE_REST_URL
KC_SESSION_STORE_REST_TOKEN
```

可選：

```text
KC_WORKSPACE_REF=main
PORT=3000
```

`KC_SESSION_SECRET` 至少 32 UTF-8 位元組，目前只用來保護短效 OAuth state／PKCE 流程 Cookie；GitHub user token 仍只存在伺服器端工作階段儲存區。

範例見 `apps/server/.env.example`。範例值不是正式秘密。

## 啟動

安裝依賴：

```bash
npm ci
```

Node HTTP 轉接器：

```bash
npm run site:serve
```

Node 轉接器可以放在 TLS 反向代理伺服器後方；正式瀏覽器 origin 仍以 `KC_PUBLIC_URL` 的 HTTPS origin 為準。

## Vercel 部署

倉庫根目錄的 `vercel.json` 會把公開請求改寫到 `api/site.js` Node Function。此轉接器直接重用 `createPrivateSiteApp`，不另建一套授權邏輯。

Vercel 轉接器**不允許單一處理程序記憶體工作階段的備援模式**：只有同時存在 `KC_SESSION_STORE_REST_URL` 與 `KC_SESSION_STORE_REST_TOKEN` 時，才把完整環境設定交給私人網站。缺少共用工作階段儲存區時，`GET /api/health` 會顯示 `configured: false`，登入 API 不會啟用。

這讓 Vercel 可以先部署取得 HTTPS hostname，再補 GitHub App callback／secrets 與共用 REST 工作階段資源；未完整配置前不能誤判成可用的私人登入站。

Vercel Function 的 `maxDuration` 設為 30 秒，但 GitHub 與共用 REST 工作階段儲存區的單次上游請求會在 5 秒內中止並採驗證失敗即拒絕，不把託管平台硬性逾時當作應用層錯誤處理。發布快照冷載入時，Knowledge Card 與生成產物 blob 採最多 8 個並行讀取；仍逐檔執行既有大小、雜湊、Schema、所有權與發布一致性驗證，不因效能最佳化降低驗證門檻。

## 尚未提供的能力

目前私人網站不提供：

- `profile/`／`projects/` 原始資料 API
- 任意倉庫／路徑代理
- 網站寫入 Card
- 外部 embedding／model 搜尋供應者
- 內建代管式工作階段資料庫／資源

以上能力不能從目前 API 或 UI 推測為已存在。
