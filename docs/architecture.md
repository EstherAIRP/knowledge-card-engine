# Engine 架構

Knowledge Card Engine 保存可公開重用的程式、Schema、驗證與共用自動化；私人 Workspace 保存真實知識資料與使用者狀態。公開 engine 的測試、範例與 fixture 只能使用合成資料。

## 模組責任

| 路徑 | 目前責任 |
| --- | --- |
| `apps/web` | 私人 Card list/detail、搜尋、關聯／Concept 與 graph UI shell；styles 依 token / base / layout / shared / view ownership 拆分，private data 只由 authenticated API runtime 取得。 |
| `apps/server` | GitHub App user authorization、server-side session、資格重查、installation-token Workspace reader，以及 release-pinned Card/search/graph/release API。 |
| `packages/core` | Card / Taxonomy parsing、Schema 與受控值驗證、ownership、body contract、collection uniqueness 與 stable path。 |
| `packages/ingestion` | URL canonicalization、GitHub metadata + README accepted evidence、固定 revision 的 GitHub research candidate / selected evidence capture、Threads 結構完整串文 evidence、create/update resolution 與 provider-specific source-state contract。 |
| `packages/analysis` | provider-neutral analysis result、research plan、analysis evidence bundle、structured research report 與 evidence-backed quality gate；research-bound analysis 可同時綁定 source evidence 與 analysis evidence digest。 |
| `packages/graph` | Deterministic search、lexical vector、typed relation、Concept、semantic neighbor 與 graph projection；generated data 帶 provenance / fingerprint。 |
| `packages/workspace` | Workspace loader、engine pin，以及經驗證的 Card + source-state / research-state transactional persistence。 |
| `packages/release` | E／S／P、generated artifact manifest、release description / pointer 與 lineage 驗證。 |

模組透過明確資料契約連接：ingestion 不直接寫 Card；analysis 不自行擷取外部來源或操作 Workspace filesystem；Workspace writer 不自行推論來源內容。GitHub research-bound version 2 analysis 必須把 validated Analysis Evidence Bundle 一併交給 Workspace writer。GitHub Remote Ingest 在 accepted evidence 後固定 revision、執行至少一輪 bounded research expansion，最後只接受 version 2；Threads 沒有 research bundle contract，因此其 Remote Ingest 與 provider-specific direct CLI 維持 accepted-source version 1。

## 目前資料流

支援來源共用的完整資料流是：

```text
source URL
→ provider-specific resolution / canonical identity
→ provider-specific accepted evidence
→ optional provider-specific analysis evidence expansion
→ evidence-bound analysis result
→ identity / canonical URL create-or-update resolution
→ ownership-safe Card candidate
→ full Card collection validation
→ Card + accepted source state + optional compact research provenance
```

GitHub 以 repository metadata + README 建立 accepted evidence。Research path 會在 accepted README 尚未變更的前提下固定 default branch commit，受限展開 repository tree，只暴露可分析的文字候選，並只從候選集合擷取選定 blob 形成 analysis evidence bundle。GitHub Remote Ingest 必須完成至少一輪 bounded expansion 後提交 version 2 analysis；直接 `ingest:github` CLI 不接收 research bundle，因此走 accepted-source version 1。Threads 先解析到具體貼文，再依 reply/root 關係與可用的結構證據重建根貼文及完整有序串文，必要時使用 digest-bound semantic continuation handoff；Threads 不建立 GitHub research bundle，正式分析使用 version 1。

Card 與 state 寫入前會完成 evidence、analysis binding、ownership 與 collection validation。GitHub version 2 另建立不含來源全文的 compact research provenance state；Card、accepted source state 與 research state 由同一個檔案交易提交，任一步驟失敗都回復已提交項目。GitHub version 1 更新若遇到既有 research state，會在同一交易移除該過期 provenance。

## 資料權威與所有權

- Card frontmatter 的結構由公開 `schema/knowledge-card.schema.json` 定義。
- Taxonomy 的結構由公開 `schema/taxonomy.schema.json` 定義；實際受控詞彙由各 Workspace 的 `config/taxonomy.yaml` 提供。
- Workspace 結構由 `workspace.yaml` 與 `engine.lock.json` 定義。
- `*.user` override、穩定 `id`、`created_at` 與完整「使用者備註」屬保護狀態，一般重新分析不得修改。
- accepted source state 是已通過來源驗證後的精簡狀態；GitHub 不保存 README 全文，Threads 不保存貼文原文，只保存必要 metadata 與內容指紋。
- GitHub research provenance state 位於 configured state root 的 `research/github/`，只保存 revision、evidence path/hash/bytes、coverage 狀態與 Card/source binding，不保存 source text。

## Engine / Workspace 邊界

Engine 接收明確的 Workspace root，不以目前工作目錄或固定私人 repository 名稱推測資料位置。Workspace 以 `engine.lock.json` 固定核准的 engine repository 與完整 commit SHA；CI 再驗證 workflow pin、lock 與實際 checkout 的 engine SHA 一致。

目前 Workspace、Card、source ingestion、generated data 與一致發布的詳細契約分別見 [workspace.md](./workspace.md)、[card-contract.md](./card-contract.md)、[ingestion.md](./ingestion.md)、[generated-data.md](./generated-data.md) 與 [release.md](./release.md)。


## 私人閱覽資料流

目前私人網站的讀取邊界：

```text
Browser
→ GitHub App state + PKCE login
→ opaque session id
→ server-side user-token session
→ per-request private Workspace eligibility check
→ GitHub App installation token
→ current release pointer
→ validated release description + E/S/P manifest
→ fixed published revision P
→ validated Taxonomy + Card collection + generated artifacts
→ Card/search/graph/release projection
```

登入 credential 與 repository data credential 分離。User access token 只存在 server-side session store；installation token 只存在 server runtime。Private API authorization 一律先於 Workspace snapshot cache。

Private API authorization 一律先於 release snapshot cache。第一個 release 尚未建立、且 Workspace 沒有任何 generated artifacts 時只提供 bootstrap Card list/detail；一旦存在 current release，Card、search、graph 與 release API 都固定同一個 P。詳細契約見 [private-site.md](./private-site.md)、[web-ui.md](./web-ui.md) 與 [release.md](./release.md)。

Node adapter 預設使用 process-local memory session store；需要跨 process / serverless instance 的正式部署必須注入 shared server-side session store。
