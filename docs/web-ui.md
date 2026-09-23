# Web UI 與 Layout

`apps/web` 產生單頁、唯讀的 Knowledge Radar browser shell。私人資料只在使用者完成授權後由 authenticated API 取得；樣式與版面模組不得嵌入 Card、generated data 或 credential。

## 模組結構

Web shell 由 `apps/web/src/index.js` 組合。樣式位於 `apps/web/src/styles/`：

| 模組 | 責任 |
| --- | --- |
| `tokens.js` | 品牌色、語意色、page / reading width、gutter、radius、shadow 與 dark-mode token。 |
| `base.js` | box sizing、document/body 基準、form/font inheritance、hidden 與 reduced-motion 基準。 |
| `layout.js` | shell、header、page frame、Detail outline 與 responsive breakpoint。 |
| `shared.js` | 跨 view 的 form control、focus、surface、狀態與共用 primitive。 |
| `radar.js` | loading、Radar hero / stats / filter 與 Knowledge Card grid。 |
| `detail.js` | Card metadata、Markdown reading typography、outline content、Concept 與 Related Knowledge。 |
| `search.js` | Search heading、result presentation 與 search-only state。 |
| `graph.js` | Graph surface、toolbar、canvas、inspector、node / edge presentation 與 Graph-specific presentation。 |
| `index.js` | 依 `order` 組合 style fragments，維持 cascade 順序並輸出 `siteCss`。 |

Graph interaction script 位於 `apps/web/src/graph-runtime.js`。該檔只負責 Graph behavior；Graph presentation 由 `styles/graph.js` 擁有。

## Style ownership

樣式依語意分層：

```text
tokens
→ base
→ layout / shared
→ Radar / Detail / Search / Graph presentation
```

同一條規則只有一個主要 owner。跨 view 共用的 control、focus 或 surface 才放入 `shared.js`；單一 view 的 presentation 不因值相同就提升成全站 primitive。

各模組可以輸出多個 style fragment。Fragment 的 `order` 代表在最終 stylesheet 中的 cascade 位置；`styles/index.js` 合併後依 order 排序，因此 ownership 拆分不改變 selector 的原始覆蓋順序。

## Layout contract

### Shared page frame

全站主框架使用：

```css
--kc-page-max: 1440px;
--kc-page-gutter: clamp(16px, 3vw, 32px);
```

`.page-shell` 的有效寬度是 viewport 扣除雙側 gutter 後與 `--kc-page-max` 的較小值，並水平置中。Header 使用相同 page max / gutter 計算，所以 Cards、Search、Graph 與 Card Detail 外層和 header 對齊。

### Reading width

Card Markdown 主要閱讀區使用：

```css
--kc-reading-max: 920px;
```

`knowledge-reading` 外層與 Card metadata、Concept Neighborhood、Related Knowledge 使用同一個 Detail 主欄寬度與左邊界；Markdown 的段落、列表、引用、code block 與 table 再以 `--kc-reading-max` 限制閱讀行寬。Heading 與 section divider 保持主欄寬度，因此 Detail 三個主要區塊的版面基準線一致。

### Card Detail outline

`1120px` 以上的 Card Detail 使用主內容加 `240px` outline 欄，Outline 為 sticky，top offset 是 `84px`。`1119px` 以下改用單層 compact detail header：原本的 Knowledge Radar 品牌位置改成「文章目錄」按鈕，並與 Cards / Search / Graph 導覽共用同一條 sticky header。目錄預設收合，展開時以 header 下方 dropdown 顯示同一份 H2／H3、Concept Neighborhood 與 Related Knowledge outline；選擇章節後自動收合並捲動定位，不再以第二條常駐 sticky bar 壓縮閱讀 viewport。

### Card permalink 與 browser history

Card detail 使用與 stable id 對應的 browser route：

```text
/knowledge/<stable-id>
```

Card click 在 authenticated detail fetch 成功後才以 History API 寫入 permalink。直接開啟或重新整理 permalink 時，server 仍只傳送相同的公開 UI shell；browser 通過 session / Workspace authorization 後，再由 `/api/cards/:id` 載入私人 Card。

`popstate` 會依目前 pathname 恢復 Card detail 或 Radar 首頁，因此 browser back / forward 不依賴記憶體中的暫存 view state。Markdown 內指向其他 Card 的相對連結也使用相同 permalink。

### Radar grid

Radar 預設三欄；`1080px` 以下兩欄；`680px` 以下單欄。Filter controls 在 `1080px` 以下收斂為兩欄，`680px` 以下為單欄。

### Graph viewport

Graph canvas 留在 shared page frame 內，寬度為可用區域的 `100%`。Desktop inspector 是固定右側 drawer；`900px` 以下改為 bottom sheet。Graph pan / zoom、pointer capture、selection 與 filtering 屬 behavior contract，不由 CSS module 改寫。

## Responsive breakpoints

目前結構斷點：

| Breakpoint | 目前用途 |
| --- | --- |
| `1120px` | Card Detail 右側 sticky outline；其下改用單層 compact header + outline dropdown。 |
| `1080px` | Radar grid / controls / relevance layout。 |
| `900px` | Header wrapping、Graph inspector bottom sheet、Radar hero。 |
| `680px` | Main mobile layout、Radar single column。 |
| `640px` | Related Knowledge single column 與 section heading stack。 |

Breakpoint 只有在具有相同結構語意時才共用；component-specific content breakpoint 不必強制合併。

## Accessibility 與 motion

- UI 支援 light / dark color scheme；dark mode 只覆寫 design token。
- `prefers-reduced-motion: reduce` 會停用 loading radar、progress 與 skeleton animation。
- Form control 的 focus state使用一致 brand border / ring。
- Header navigation 可在窄 viewport 水平捲動，避免截斷導覽按鈕。
- Card Detail 小尺寸目錄整合進主 sticky header，以 `button` 控制 `aria-expanded`；收合時 chevron 朝左、展開時朝下，使用同一個固定尺寸 icon slot 只做中心旋轉，不因狀態切換改變位置；dropdown 與桌機 outline 共用章節 active-state，並保留 reduced-motion scroll 行為。
- Markdown code block 自己管理 horizontal overflow，不要求整頁跟著水平捲動。

## 驗證

Repository 的 `npm run ui:verify` 執行 Web UI layout contract tests；`npm run validate` 也會透過 `npm test` 執行同一組測試。

測試會確認：

- design token、page frame、reading width 與主要 breakpoint 仍存在；
- style fragments 的 order 連續且唯一；
- Radar / Detail / Search / Graph 的 selector 仍由對應模組持有；
- Graph presentation 不再由 behavior script 匯出；
- rendered shell 使用組合後的 `siteCss`；
- public shell 的私人資料安全測試仍由 `private-site.test.mjs` 保護。

登入、授權、private API 與 release-pinned read boundary 見 [private-site.md](./private-site.md)。
