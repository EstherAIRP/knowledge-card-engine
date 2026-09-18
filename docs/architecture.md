# Engine 架構

Knowledge Card Engine 保存可公開重用的程式、Schema、驗證與共用自動化；私人 Workspace 保存真實知識資料與使用者狀態。公開 engine 的測試、範例與 fixture 只能使用合成資料。

## 模組責任

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人閱覽前端的應用邊界；目前未實作可用 UI。 |
| `apps/server` | 登入、授權與資料讀取 API 的應用邊界；目前未實作可用服務。 |
| `packages/core` | Card / Taxonomy parsing、Schema 與受控值驗證、ownership、body contract、collection uniqueness 與 stable path。 |
| `packages/ingestion` | URL canonicalization、GitHub metadata + README evidence、create/update resolution 與 GitHub source-state contract。 |
| `packages/analysis` | provider-neutral analysis result contract；analysis 必須綁定 accepted source identity 與 evidence digest。 |
| `packages/graph` | 搜尋、向量、關聯與 Concept 的模組邊界；目前未實作演算法。 |
| `packages/workspace` | Workspace loader、engine pin，以及經驗證的 Card + source-state persistence。 |
| `packages/release` | manifest 與一致發布的模組邊界；目前未實作發布模型。 |

模組透過明確資料契約連接：ingestion 不直接寫 Card；analysis 不自行擷取外部來源或操作 Workspace filesystem；Workspace writer 不自行推論來源內容。

## 目前資料流

GitHub Repository 收錄的完整資料流是：

```text
GitHub URL
→ canonical repository identity
→ repository metadata + README accepted evidence
→ evidence-bound analysis result
→ identity / canonical URL create-or-update resolution
→ ownership-safe Card candidate
→ full Card collection validation
→ Card + accepted source state persistence
```

Card 與 source state 寫入前會完成 evidence、analysis binding、ownership 與 collection validation。writer 使用暫存檔寫入；若 Card 已替換但 source-state replacement 失敗，會回復 Card，避免只推進其中一側。

## 資料權威與所有權

- Card frontmatter 的結構由公開 `schema/knowledge-card.schema.json` 定義。
- Taxonomy 的結構由公開 `schema/taxonomy.schema.json` 定義；實際受控詞彙由各 Workspace 的 `config/taxonomy.yaml` 提供。
- Workspace 結構由 `workspace.yaml` 與 `engine.lock.json` 定義。
- `*.user` override、穩定 `id`、`created_at` 與完整「使用者備註」屬保護狀態，一般重新分析不得修改。
- accepted source state 是已通過來源驗證後的精簡狀態，不保存 README 全文。

## Engine / Workspace 邊界

Engine 接收明確的 Workspace root，不以目前工作目錄或固定私人 repository 名稱推測資料位置。Workspace 以 `engine.lock.json` 固定核准的 engine repository 與完整 commit SHA；CI 再驗證 workflow pin、lock 與實際 checkout 的 engine SHA 一致。

目前 Workspace、Card、GitHub ingestion 的詳細契約分別見 [workspace.md](./workspace.md)、[card-contract.md](./card-contract.md) 與 [ingestion.md](./ingestion.md)。
