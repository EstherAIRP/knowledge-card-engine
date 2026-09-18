# Engine 架構

Knowledge Card Engine 是公開程式倉庫；真實私人知識資料由私人 workspace 保存。公開 engine 的測試與範例只能使用合成資料。

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人閱覽前端的應用邊界；尚未實作 UI。 |
| `apps/server` | 登入、授權與讀取 API 的應用邊界；尚未實作服務。 |
| `packages/core` | 已實作 Card v1 / Taxonomy v1、AI/user ownership、body contract、collection validation 與 stable path helper。 |
| `packages/ingestion` | 來源識別、擷取與完整性驗證的邊界；provider 尚未建立。 |
| `packages/analysis` | 個人化分析與模型介面的邊界；provider 尚未建立。 |
| `packages/graph` | 搜尋、向量、關聯、Concept 與版面的邊界；演算法尚未建立。 |
| `packages/workspace` | Workspace v1 loader、路徑安全、schema 相容性與 engine pin 驗證。 |
| `packages/release` | manifest 與一致發布的邊界；E/S/P 尚未實作。 |

Card structural schema 屬於公開 engine；受控 taxonomy 的實際值屬於各 Workspace 的 `config/taxonomy.yaml`。這讓 engine 可以公開驗證規則，而不需要公開私人工作區偏好。

Workspace 必須由明確 root 載入，不以 `process.cwd()` 或固定私人 repository 名稱猜測資料位置。
