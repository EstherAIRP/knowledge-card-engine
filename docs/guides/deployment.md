# 私人網站部署

本指南說明 Knowledge Card 私人網站目前支援的本機啟動、環境設定、Vercel 部署與線上驗收方式。登入、工作階段、授權與私人 API 的功能規則以 [私人網站與授權契約](../specs/private-site.md) 為準；發布版本與 E／S／P 一致性以 [一致發布契約](../specs/release.md) 為準。

## 執行環境設定

必要環境變數：

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

無伺服器或多執行個體部署另外需要：

```text
KC_SESSION_STORE_REST_URL
KC_SESSION_STORE_REST_TOKEN
```

可選：

```text
KC_WORKSPACE_REF=main
KC_SITE_PERFORMANCE=0
PORT=3000
```

`KC_SITE_PERFORMANCE=1` 只用於受控效能診斷；預設關閉。診斷模式的資料範圍、授權要求與禁止記錄內容以 [私人網站與授權契約](../specs/private-site.md) 為準。

`KC_PUBLIC_URL` 必須是 HTTPS origin，不能帶路徑、查詢參數或片段。GitHub App 的回呼網址使用：

```text
{KC_PUBLIC_URL}/api/auth/callback
```

`KC_SESSION_SECRET` 至少 32 UTF-8 位元組，只用來保護短效 OAuth state／PKCE 流程 Cookie；GitHub 使用者存取權杖與 refresh token 仍只存在伺服器端工作階段儲存區。

環境變數範例見 `apps/server/.env.example`。範例值不是正式秘密；正式憑證應放在部署平台或其他正式秘密管理機制中，不得提交到 Git。

## 本機啟動

安裝依賴：

```bash
npm ci
```

啟動 Node HTTP 轉接器：

```bash
npm run site:serve
```

Node 轉接器可以放在 TLS 反向代理伺服器後方；瀏覽器正式來源仍以 `KC_PUBLIC_URL` 設定的 HTTPS origin 為準。

單一處理程序環境可使用內建記憶體工作階段儲存區作為參考實作。處理程序重新啟動後，既有工作階段會安全失效。需要跨執行個體共享工作階段時，必須改用共用儲存區。

## Vercel 部署

倉庫根目錄的 `vercel.json` 會把公開請求改寫到 `api/site.js` Node Function；此轉接器直接重用 `createPrivateSiteApp`，不另建一套授權流程。

Vercel 不使用單一處理程序記憶體工作階段作為備援。部署前必須設定：

```text
KC_SESSION_STORE_REST_URL
KC_SESSION_STORE_REST_TOKEN
```

缺少共用工作階段儲存區時，`GET /api/health` 會回報 `configured: false`，登入 API 不會啟用。

建議設定順序：

1. 先部署取得正式 HTTPS 主機名稱。
2. 以該主機名稱設定 `KC_PUBLIC_URL`。
3. 在 GitHub App 設定對應回呼網址。
4. 補齊 GitHub App、Workspace 與共用工作階段儲存區所需秘密。
5. 重新部署或重新整理環境設定。
6. 先檢查 `/api/health` 已顯示設定完成，再進行登入與私人資料驗收。

目前 Vercel Function 的 `maxDuration` 為 30 秒。GitHub 與共用 REST 工作階段儲存區的單次上游請求會在 5 秒內中止；發布快照冷載入時，Knowledge Card 與生成產物 Git blob 最多同時讀取 8 個。這些效能設定不會降低大小、雜湊、Schema、所有權或發布一致性的驗證門檻。

## 效能診斷

需要量測正式站延遲時，先在目標環境設定：

```text
KC_SITE_PERFORMANCE=1
```

重新部署後，以具資格帳號正常登入並開啟 Knowledge Radar 首頁。診斷模式會記錄伺服器端授權與主要處理耗時，以及瀏覽器端第一次工作階段請求、第一次卡片列表請求、Radar 呈現與整體啟動耗時。紀錄只包含固定的毫秒數、路由名稱與 HTTP 狀態，不包含 Card 內容、Card ID、來源 URL、標籤、Workspace 名稱、發布識別或憑證。

量測完成後應把 `KC_SITE_PERFORMANCE` 改回 `0` 或移除並重新部署，避免長期產生不必要的診斷日誌。診斷模式不能取代授權後線上回讀，也不能放寬任何資料驗證或發布一致性規則。

## 線上驗收

正式部署完成後，至少確認：

1. Knowledge Card Workspace 發布工作流程成功。
2. `releases/current.json` 已指向預期發布版本。
3. 部署平台顯示本次部署成功。
4. 使用具資格帳號完成 GitHub App 登入。
5. 授權後即時讀取 `/api/release`，確認 `release_id`、E／S／P 與 `manifest` 和預期發布版本一致。

只有實際完成上述步驟，才能回報網站部署與線上讀回已驗收。發布資料本身的完整性、版本鏈結與回復方式仍以 [一致發布契約](../specs/release.md) 為準。

## 目前部署邊界

目前正式提供：

- Node HTTP 轉接器，可部署在 HTTPS 反向代理後方。
- Vercel `api/site.js` 轉接器。

目前沒有其他託管平台的正式轉接器，也沒有內建代管式工作階段資料庫。若使用其他平台，必須自行提供與 Private Site 契約相容的伺服器執行環境與共用工作階段儲存能力，不能假設現有 Vercel 設定可直接套用。
