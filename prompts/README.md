# Prompts

此目錄保存可公開重用的執行與分析契約。

- [RUNTIME.md](./RUNTIME.md)：定義 Knowledge Card 任務的執行順序、Engine／Workspace 邊界、收錄與寫入守門、release 狀態及完成回報。
- Analysis 不固定 OpenAI、Anthropic 或其他模型供應商；可驗證輸出格式由 `packages/analysis` 定義，並要求結果綁定 accepted source identity 與 evidence digest。詳見 [GitHub 收錄契約](../docs/ingestion.md)。

來源專屬演算法、資料 Schema 與 provider 實作不在 prompt 目錄重複維護，應以對應正式契約與程式為準。
