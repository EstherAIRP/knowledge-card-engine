# 提示詞文件

`prompts/` 保存 Agent 執行 Knowledge Card 任務時使用的行為契約。它們負責執行順序、來源閱讀、知識取捨與表達方式，不取代 `docs/specs/` 的系統與資料契約。

- [RUNTIME.md](./RUNTIME.md)：跨領域執行編排。決定先讀什麼、何時收錄、分析、寫入、驗證與發布，以及失敗和完成時如何處理。
- [KNOWLEDGE_EDITOR.md](./KNOWLEDGE_EDITOR.md)：最終證據固定後的來源閱讀與知識取捨。先形成整體理解，不先套用 Card 章節。
- [CARD_STYLE.md](./CARD_STYLE.md)：整體理解形成後使用的 Knowledge Card 表達規則，負責正文的閱讀層次、段落目的與寫作方式。

責任邊界：

- 來源身分、已接受證據與受控來源擷取：[`docs/specs/ingestion.md`](../docs/specs/ingestion.md)。
- 研究計畫、分析證據、分析版本與品質門檻：[`docs/specs/analysis.md`](../docs/specs/analysis.md)。
- Card 結構與所有權：[`docs/specs/card.md`](../docs/specs/card.md)。
- 執行順序：`RUNTIME.md`。
- 來源閱讀與知識取捨：`KNOWLEDGE_EDITOR.md`。
- 最終文字表達：`CARD_STYLE.md`。

來源專屬演算法、資料欄位、Schema、API 細節與 Workspace 持久化規則不在 `prompts/` 重複維護。若 prompt 需要依賴這些規則，只引用目前正式契約。
