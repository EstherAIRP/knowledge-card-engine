# 網頁介面與版面配置

`apps/web` 產生單頁、唯讀的 Knowledge Radar 瀏覽器介面外殼。私人資料只在使用者完成授權後由已授權 API 取得；樣式與版面模組不得嵌入 Knowledge Card、生成資料或憑證。

## 模組結構

網頁介面外殼由 `apps/web/src/index.js` 組合。樣式位於 `apps/web/src/styles/`：

| 模組 | 責任 |
| --- | --- |
| `tokens.js` | 品牌色、語意色、頁面／閱讀寬度、邊距、圓角、陰影與深色模式設計變數。 |
| `base.js` | 盒模型、`document`／`body` 基準、表單／字型繼承、隱藏狀態與減少動態效果基準。 |
| `layout.js` | 介面外殼、頁首、頁面框架、詳細頁文章目錄與響應式斷點。 |
| `shared.js` | 跨畫面的表單控制項、焦點狀態、內容面板、狀態與共用基礎元件。 |
| `radar.js` | 載入狀態、Radar 主視覺／統計／篩選與 Knowledge Card 網格。 |
| `detail.js` | Knowledge Card 中繼資料、Markdown 閱讀排版、文章目錄內容、Concept 與 `Related Knowledge`。 |
| `search.js` | 搜尋標題、結果呈現與搜尋專屬狀態。 |
| `graph.js` | 圖譜內容面板、工具列、畫布、檢視器、節點／邊線與圖譜專屬呈現。 |
| `index.js` | 依 `order` 組合樣式片段，維持 CSS 層疊順序並輸出 `siteCss`。 |

圖譜互動程式位於 `apps/web/src/graph-runtime.js`。該檔只負責圖譜互動行為；圖譜呈現樣式由 `styles/graph.js` 負責。

## 樣式責任歸屬

樣式依語意分層：

```text
tokens
→ base
→ layout / shared
→ Radar / Detail / Search / Graph 呈現
```

同一條規則只有一個主要負責模組。跨畫面共用的控制項、焦點狀態或內容面板才放入 `shared.js`；單一畫面的呈現規則不因數值相同就提升成全站共用基礎元件。

各模組可以輸出多個樣式片段。片段的 `order` 代表它在最終樣式表中的覆蓋順序位置；`styles/index.js` 合併後依 `order` 排序，因此拆分樣式責任不會改變選擇器原有的覆蓋順序。

## 版面契約

### 共用頁面框架

全站主框架使用：

```css
--kc-page-max: 1440px;
--kc-page-gutter: clamp(16px, 3vw, 32px);
```

`.page-shell` 的有效寬度是瀏覽器可視區域扣除雙側邊距後與 `--kc-page-max` 的較小值，並水平置中。頁首使用相同的最大頁寬與邊距計算，所以 `Cards`、`Search`、`Graph` 與 Knowledge Card 詳細頁外層會和頁首對齊。

### 閱讀寬度

Knowledge Card Markdown 主要閱讀區使用：

```css
--kc-reading-max: 920px;
```

`knowledge-reading` 外層與 Knowledge Card 中繼資料、`Concept Neighborhood`、`Related Knowledge` 使用同一個詳細頁主欄寬度與左邊界；Markdown 的段落、列表、引用、程式碼區塊與表格再以 `--kc-reading-max` 限制閱讀行寬。標題與段落分隔線維持主欄寬度，因此詳細頁三個主要區塊的版面基準線一致。

### Knowledge Card 詳細頁文章目錄

`1120px` 以上的 Knowledge Card 詳細頁使用主內容加 `240px` 文章目錄欄。文章目錄固定於捲動位置，頂端偏移量是 `84px`。

`1119px` 以下改用單層精簡詳細頁頁首：原本 Knowledge Radar 品牌位置改成「文章目錄」按鈕，並與 `Cards`／`Search`／`Graph` 導覽共用同一條固定頁首。目錄預設收合，展開時在頁首下方以下拉區顯示同一份 H2／H3、`Concept Neighborhood` 與 `Related Knowledge` 目錄；選擇章節後自動收合並捲動定位，不再保留第二條常駐固定導覽列壓縮閱讀區域。

### Knowledge Card 永久連結與瀏覽器歷程

Knowledge Card 詳細頁使用與穩定 ID 對應的瀏覽器路由：

```text
/knowledge/<stable-id>
```

點擊 Knowledge Card 後，只有在已授權的詳細資料請求成功時，才使用 History API 寫入永久連結。直接開啟或重新整理永久連結時，伺服器仍只傳送相同的公開介面外殼；瀏覽器通過工作階段與 Knowledge Card Workspace 授權後，再由 `/api/cards/:id` 載入私人 Knowledge Card。

`popstate` 會依目前 `pathname` 恢復 Knowledge Card 詳細頁或 Radar 首頁，因此瀏覽器上一頁／下一頁不依賴記憶體中的暫存畫面狀態。Markdown 內指向其他 Knowledge Card 的相對連結也使用相同永久連結。

### Radar 網格

Radar 預設三欄；`1080px` 以下兩欄；`680px` 以下單欄。篩選控制項在 `1080px` 以下收斂為兩欄，`680px` 以下為單欄。

### 圖譜可視區域

圖譜畫布位於共用頁面框架內，寬度為可用區域的 `100%`。桌機版檢視器是固定右側抽屜；`900px` 以下改為底部面板。圖譜平移／縮放、指標擷取（pointer capture）、選取與篩選屬互動行為契約，不由 CSS 模組改寫。

## 響應式斷點

目前結構斷點：

| 斷點 | 目前用途 |
| --- | --- |
| `1120px` | Knowledge Card 詳細頁右側固定文章目錄；其下改用單層精簡頁首與文章目錄下拉區。 |
| `1080px` | Radar 網格／控制項／相關性版面。 |
| `900px` | 頁首換行、圖譜檢視器底部面板、Radar 主視覺。 |
| `680px` | 主要行動版版面、Radar 單欄。 |
| `640px` | `Related Knowledge` 單欄與段落標題堆疊。 |

只有具有相同結構語意的斷點才共用；元件專屬的內容斷點不必強制合併。

## 無障礙與動態效果

- 介面支援淺色／深色配色；深色模式只覆寫設計變數。
- `prefers-reduced-motion: reduce` 會停用 Radar 載入動畫、進度與骨架動畫。
- 表單控制項的焦點狀態使用一致的品牌邊框與焦點環。
- 頁首導覽可在窄可視區域水平捲動，避免截斷導覽按鈕。
- Knowledge Card 詳細頁的小尺寸文章目錄整合進主固定頁首，以 `button` 控制 `aria-expanded`；收合時箭頭朝左、展開時朝下，使用同一個固定尺寸圖示槽，只做中心旋轉，不因狀態切換改變位置。下拉區與桌機文章目錄共用章節目前狀態，並保留減少動態效果時的捲動行為。
- Markdown 程式碼區塊自行管理水平溢出，不要求整頁跟著水平捲動。

## 驗證責任

網頁介面契約由自動化測試保護，重點包括：

- 設計變數、頁面框架、閱讀寬度與主要響應式斷點。
- 樣式片段的責任歸屬與固定組合順序。
- Radar、Detail、Search、Graph 各自的樣式與互動邊界。
- 圖譜互動程式與呈現樣式的分離。
- 實際介面外殼使用組合後的 `siteCss`。
- 公開介面外殼不得夾帶私人 Knowledge Card、生成資料或憑證。

執行測試與驗證的實際指令集中在 [開發與驗證指南](../guides/development.md)。登入、授權、私人 API 與發布版本讀取邊界則由 [私人網站與授權契約](./private-site.md) 與 [一致發布契約](./release.md) 定義。
