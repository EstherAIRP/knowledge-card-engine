# Prompts

此目錄保存可公開重用的執行與分析契約。

- [RUNTIME.md](./RUNTIME.md)：定義 Knowledge Card 任務的執行順序、Engine／Workspace 邊界、收錄與寫入守門、release 狀態及完成回報。
- [KNOWLEDGE_EDITOR.md](./KNOWLEDGE_EDITOR.md)：最終證據固定後先讀來源、形成整體理解與做知識取捨；這個階段不先載入 Card 寫作模板。
- [CARD_STYLE.md](./CARD_STYLE.md)：整體理解形成後才讀取的 Knowledge Card 寫作樣式；把既有理解整理成固定章節與可讀版型。
- Analysis 不固定 OpenAI、Anthropic 或其他模型供應商；可驗證輸出格式由 `packages/analysis` 定義，並要求結果綁定 accepted source identity 與 evidence digest。知識編輯與寫作樣式只調整最終證據固定後的閱讀／表達順序，不改變 Analysis Schema、來源證據或 Writer 契約。詳見 [GitHub 收錄契約](../docs/ingestion.md)。

來源專屬演算法、資料 Schema 與 provider 實作不在 prompt 目錄重複維護，應以對應正式契約與程式為準。
