# Engine 架構

Knowledge Card Engine 是公開程式倉庫；真實私人知識資料由私人 workspace 保存。公開 engine 的測試與範例只能使用合成資料。

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人閱覽前端的應用邊界；尚未實作 UI。 |
| `apps/server` | 登入、授權與讀取 API 的應用邊界；尚未實作服務。 |
| `packages/core` | Card v1 / Taxonomy v1、ownership、body contract、collection validation 與 stable path。 |
| `packages/ingestion` | GitHub URL canonicalization、metadata + README evidence、identity resolution 與 accepted source state contract。 |
| `packages/analysis` | provider-neutral analysis result contract，analysis 必須綁定 accepted evidence digest。 |
| `packages/graph` | 搜尋、向量、關聯、Concept 與版面的邊界；演算法尚未建立。 |
| `packages/workspace` | Workspace loader、engine pin，以及 validated Card + source state 的安全寫入。 |
| `packages/release` | manifest 與一致發布的邊界；E/S/P 尚未實作。 |

資料流目前是：

```text
source evidence
→ analysis
→ workspace write
```

三層責任分開：ingestion 不寫 Card、analysis 不操作 filesystem、workspace writer 不自行擷取外部來源。

Card structural schema 屬於公開 engine；受控 taxonomy 實際值屬於各 Workspace。
