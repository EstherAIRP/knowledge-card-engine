# Engine 架構

Knowledge Card Engine 是公開程式倉庫；真實私人知識資料由私人 workspace 保存。公開 engine 的測試與範例只能使用合成資料。

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人閱覽前端的應用邊界；尚未實作 UI。 |
| `apps/server` | 登入、授權與讀取 API 的應用邊界；尚未實作服務。 |
| `packages/core` | Card 模型、驗證與所有權的邊界；正式 Card 契約尚未建立。 |
| `packages/ingestion` | 來源識別、擷取與完整性驗證的邊界；provider 尚未建立。 |
| `packages/analysis` | 個人化分析與模型介面的邊界；provider 尚未建立。 |
| `packages/graph` | 搜尋、向量、關聯、Concept 與版面的邊界；演算法尚未建立。 |
| `packages/workspace` | 已實作 Workspace v1 loader、路徑安全、schema 相容性與 engine pin 驗證。 |
| `packages/release` | manifest 與一致發布的邊界；E/S/P 尚未實作。 |

Workspace 必須由明確 root 載入，不以 `process.cwd()` 或固定私人 repository 名稱猜測資料位置。公開 engine 只定義結構與驗證；真實 profile、projects、cards、state、generated data 與 releases 仍留在私人 workspace。
