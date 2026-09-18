# Engine 架構

Knowledge Card Engine 是公開程式倉庫；真實私人知識資料由私人 workspace 保存。公開 engine 的測試與範例只能使用合成資料。

目前程式只建立責任邊界，尚未提供領域功能：

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人閱覽前端的應用邊界；尚未實作 UI。 |
| `apps/server` | 登入、授權與讀取 API 的應用邊界；尚未實作服務。 |
| `packages/core` | Card 模型、驗證與所有權的邊界；正式契約尚未建立。 |
| `packages/ingestion` | 來源識別、擷取與完整性驗證的邊界；provider 尚未建立。 |
| `packages/analysis` | 個人化分析與模型介面的邊界；provider 尚未建立。 |
| `packages/graph` | 搜尋、向量、關聯、Concept 與版面的邊界；演算法尚未建立。 |
| `packages/workspace` | 私人 workspace 存取與版本解析的邊界；T03 才建立契約。 |
| `packages/release` | manifest 與一致發布的邊界；E/S/P 尚未實作。 |

模組不得以目前工作目錄或固定私人倉庫名稱推測資料位置。之後的 workspace 路徑與版本必須由明確輸入提供。
