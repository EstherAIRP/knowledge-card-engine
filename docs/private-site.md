# 私人網站與授權契約

Knowledge Card Engine 目前提供一個不綁特定 hosting 平台的唯讀私人網站邊界。瀏覽器只取得公開 UI shell 與經授權的 Card API 回應；GitHub credential、Workspace repository credential、profile、projects 與其他私人原始資料都不會打包進公開靜態資產。

## 安全責任分離

登入與資料讀取使用不同 GitHub credential：

1. **GitHub App user access token**：只用來確認 GitHub 身分與該使用者是否能存取設定的私人 Workspace repository。
2. **GitHub App installation access token**：只存在 server runtime，用來讀取設定的 Workspace repository 內容。

User access token 不回傳給 browser，也不放進 session cookie。Browser 的 `__Host-kc_session` 只保存不可推導 credential 的 opaque session id；對應 user token 與使用者資料保存在 server-side session store。

GitHub App repository permissions 至少需要：

- Metadata: Read-only
- Contents: Read-only

Server-side installation token request 會再限制到設定的 Workspace repository，並只要求 `contents: read`。

## 登入流程

`GET /api/auth/login`：

1. 建立隨機 OAuth `state`。
2. 建立 PKCE verifier 與 SHA-256 / S256 challenge。
3. 把 state/verifier 放進 10 分鐘有效的 `__Host-kc_oauth` cookie。
4. redirect 到 GitHub App authorization endpoint。

Flow cookie 設定：

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

`GET /api/auth/callback` 會驗證 state 與 flow expiry，再用原始 PKCE verifier 交換 GitHub App user access token。成功後以該 token讀取 GitHub user identity，再讀取設定的 Workspace repository metadata。

只有同時符合以下條件才建立 session：

- GitHub user identity 可驗證。
- user access token 可讀取設定的 repository。
- repository `full_name` 與設定相符。
- repository 是 private。

403 / 404 視為沒有 Workspace 資格；401 視為 user authorization 無效；rate limit、5xx 或網路失敗都 fail closed。

## Session

Session 有效期最長 1 小時，也不會超過 GitHub user token 自身 expiry。

Browser cookie：

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

Server-side session value 保存：

- GitHub user id / login / avatar
- GitHub App user access token
- user token expiry
- session expiry

`createPrivateSiteApp({ sessionStore })` 可注入 session store；介面必須提供 async `create/get/delete`。內建 `createMemorySessionStore` 是 process-local reference implementation：process restart 會讓所有 session 安全失效，但不適合需要跨 instance / serverless request 共享 session 的部署。

Engine 另提供 `createRestSessionStore`，使用 Redis-compatible REST command endpoint 保存 TTL-bound server sessions。它需要 `KC_SESSION_STORE_REST_URL` 與 `KC_SESSION_STORE_REST_TOKEN`，session key 使用 `kc:session:` namespace。REST backend 無法讀寫或回傳 malformed value 時，session operation fail closed。

## 每次請求重新驗資格

目前不使用 authorization cache。每一個私人 API request 都會：

1. 解析 opaque session id。
2. 從 server-side session store 取得 user token。
3. 用 user token重新讀取設定的 private Workspace repository metadata。
4. 成功後才讀 installation-token cache 或 Workspace data cache。

因此：

- 沒有 session → 401。
- GitHub user token 已撤銷／失效 → 401，server session 刪除並清 cookie。
- user 還能登入 GitHub App、但失去 Workspace repository access → 403。
- GitHub 無法完成資格重查 → 503；不提供舊快取的私人內容。

Server-side data cache 不能繞過 authorization；authorization 一律先於 Card snapshot cache。

## 登出與撤銷

`POST /api/auth/session` 是登出操作，而且必須帶與 `KC_PUBLIC_URL` 相同的 `Origin`。

登出順序：

1. 取得 server-side session 與 GitHub user token。
2. 呼叫 GitHub `DELETE /applications/{client_id}/token` 撤銷該 user token。
3. GitHub 回報成功後，刪除 server session。
4. 清除 `__Host-kc_session`。

若 GitHub token revocation 失敗，API 回 error、保留 server session 與 cookie，不宣稱登出成功。

管理端若移除使用者對 private Workspace repository 的資格，不需要依賴 installation token；下一個 private API request 的 user-token資格重查會得到 403。

## Private API

### GET /api/health

公開 endpoint。固定回：

- `status`
- `configured`

若 `configured: false`，另外回 `configuration_error.code` 與 `configuration_error.detail`。診斷內容只描述缺少的 environment variable 名稱或格式規則，不回傳 environment value、repository credential 或其他秘密。

### GET /api/auth/session

需要有效 session 並重新驗 Workspace 資格。只回最少 user projection：

- id
- login
- avatar URL
- repository permission
- session expiry

不回 user token、installation token 或 server session id。

### POST /api/auth/session

登出並撤銷 user token。需要 same-origin `Origin`。

### GET /api/cards

需要授權。支援：

- `limit`：1–100，預設 50
- `cursor`：由 server 產生的 revision-bound cursor

只回 Card summary，不回正文。Summary 目前包含 stable id、title、summary、canonical URL、effective resource kind / navigation / status，以及更新日期。

Cursor 綁定 Workspace commit SHA；如果下一頁 request 時 configured ref 已移到另一 revision，回 409 `DATA_VERSION_CHANGED`，要求從第一頁重讀，避免跨 revision 混頁。

### GET /api/cards/:id

需要授權。只接受 Knowledge Card stable id，不接受 repository path。

Server 先由受驗證的 Card collection 建立 id→Card map，再回：

- Card safe metadata projection
- effective ownership values
- relation / Concept projection
- Markdown body

不存在的 id 回 404；非法 id 回 400。

### GET /api/search

需要授權。使用 `q` 與可選 `limit` 執行 server-side deterministic search。只有 current validated release 存在時可用；bootstrap Card-only mode 回 `503 RELEASE_REQUIRED`。

### GET /api/graph

需要授權。只回 current release 的 graph display projection：Card / Concept nodes、typed edges、semantic neighbors 與 layout method，不提供任意 Workspace path 或 raw repository dump。

### GET /api/release

需要授權。回目前 read model 的 release projection。第一個 release 尚未建立時回 `mode: "bootstrap"`；有 current release 時回 release_id、E/S/P、manifest projection、revision 與 pointer revision。

## Workspace repository reader

Reader 的 repository 由 `KC_WORKSPACE_OWNER`、`KC_WORKSPACE_REPO` 與 `KC_WORKSPACE_REF`（預設 `main`）定位，但 Card/search/graph data source 由 current release 決定。

每次 snapshot：

1. 解析 configured ref，讀 `releases/current.json`。
2. 驗證 release pointer 與 release description。
3. 固定 published revision P，驗證 P = S 或 P 是 S 的直接 generated-only child。
4. 從 P 載入 `content/knowledge/{YYYY}/{stable-id}.md`、`config/taxonomy.yaml` 與五個 generated artifacts。
5. 驗 Card collection、manifest hash / bytes / provenance 與 generated-data consistency。
6. 只在完整驗證成功後建立 snapshot cache。

若 Workspace 尚未有 release pointer 且完全沒有 generated artifacts，reader 允許 bootstrap Card-only mode；Card list/detail 可讀，search / graph 不可用。若 generated artifacts 已存在卻沒有 pointer，視為不完整發布並 fail closed。

Card 單檔上限目前是 1 MiB；Taxonomy / release metadata 與 generated artifact 另有 server-side size limits。Release snapshot cache 以 release id + P 隔離，最多保留少量 revision；authorization 永遠先於 cache。完整 E／S／P 與 manifest 契約見 [release.md](./release.md)。

## GitHub App server credential

Engine 以 RS256 GitHub App JWT 建立 installation token。JWT `iat` 向前容忍 60 秒 clock skew，`exp` 為約 9 分鐘。

Installation token：

- 由固定 installation id 建立。
- request 限制到 configured Workspace repository。
- 只要求 `contents: read`。
- 依 GitHub 回傳 `expires_at` 在 server memory cache。
- expiry 前 60 秒不再重用。

程式不假設 installation token 固定長度或固定字首。

GitHub REST request 使用 API version `2026-03-10`。

## UI

`apps/web` 目前提供單頁唯讀 shell：

- 未登入：GitHub login。
- cancelled / invalid / forbidden / unavailable：登入錯誤狀態。
- 已登入：GitHub login/avatar、登出、Card list、Card detail。
- 401 / 403：立即清除前端目前 private state，回到 auth UI。
- Markdown 以 DOM `textContent` 建立基本 heading / list / paragraph，不解譯 raw HTML。

UI shell 本身不包含任何私人 Card 內容。

## Runtime configuration

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

Serverless / multi-instance deployment另外需要：

```text
KC_SESSION_STORE_REST_URL
KC_SESSION_STORE_REST_TOKEN
```

可選：

```text
KC_WORKSPACE_REF=main
PORT=3000
```

`KC_SESSION_SECRET` 至少 32 UTF-8 bytes，目前只用來保護短效 OAuth state / PKCE flow cookie；GitHub user token 仍只存在 server-side session store。

範例見 `apps/server/.env.example`。範例值不是正式秘密。

## 啟動

安裝依賴：

```bash
npm ci
```

Node HTTP adapter：

```bash
npm run site:serve
```

Node adapter 可以放在 TLS reverse proxy 後方；正式 browser origin 仍以 `KC_PUBLIC_URL` 的 HTTPS origin 為準。

## Vercel deployment

Repository root 的 `vercel.json` 會把公開 request rewrite 到 `api/site.js` Node Function。此 adapter 直接重用 `createPrivateSiteApp`，不另建一套 authorization 邏輯。

Vercel adapter **不允許 process-local memory session fallback**：只有同時存在 `KC_SESSION_STORE_REST_URL` 與 `KC_SESSION_STORE_REST_TOKEN` 時，才把完整 environment 交給 private site。缺少 shared session store 時，`GET /api/health` 會顯示 `configured: false`，登入 API不會啟用。

這讓 Vercel 可以先部署取得 HTTPS hostname，再補 GitHub App callback / secrets 與 shared REST session resource；未完整配置前不能誤判成可用的私人登入站。

## 尚未提供的能力

目前 private site 不提供：

- 搜尋 API
- 圖譜 API
- release API / release-pinned read model
- profile / projects 原始資料 API
- 任意 repository / path proxy
- 網站寫入 Card
- 內建 managed session database/resource

以上能力不能從目前 API 或 UI 推測為已存在。
