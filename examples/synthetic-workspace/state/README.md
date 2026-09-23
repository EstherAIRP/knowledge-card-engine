# Synthetic Workspace State

此目錄保存公開測試用的合成狀態資料，不得放入真實來源快照、研究全文或私人衍生資料。

目前的 `sources/github/example--synthetic-example.json` 對應 synthetic Knowledge Card，包含合成 repository metadata 摘要、README hash/digest 與 Card identity/path，用來驗證 source-state contract 與 Card 對應。Research provenance validator 也會掃描 `state/research/**`；目前 synthetic fixture 不預置 research state，research writer tests 會在暫時 Workspace 中建立並驗證 compact provenance。
