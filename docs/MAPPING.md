| 概念       | データモデル（TS型）                             | ストア/ユーティリティ                                               | 主要UI/コンポーネント                                                  |
| -------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| プロジェクト   | `Project`（vaultPath, scenes など）。        | `initializeProject` / `loadProject` など。                   | `StartupModal`（新規作成/読み込み/保存）。                                 |
| シーン      | `Scene`（cuts/order/notes/folderPath）。   | `addScene/removeScene/renameScene`。                       | `Storyline`（シーン列）、`PlaybackControls`（シーン数表示）。                 |
| カット      | `Cut`（assetId/displayTime/clip）。        | `addCutToScene/updateCutDisplayTime/moveCutToScene` 等。    | `CutCard`（切り取り/コピー/削除）、`PreviewModal`（再生対象）。                  |
| アセット     | `Asset`（path/type/vaultRelativePath 等）。 | `assetPath` の同期/解決/インポート系ユーティリティ（VaultGateway 経由）。            | `Sidebar`（閲覧/フォルダ追加）、`CutCard`/`PreviewModal`（表示/再生）。         |
| アセットドロワー | `Asset` / `AssetIndexEntry`。              | `loadAssetIndex` / `getFolderContents` / `metadataStore` 集計。           | `AssetDrawer`（vault/assets の一覧・使用状況バッジ）。                              |
| アセットパネル   | `Asset` / `AssetIndexEntry`。              | `loadAssetIndex` / `getFolderContents` / `metadataStore` 集計。           | `AssetPanel`（一覧UIの本体）。                                                     |
| アセットモーダル | `Asset`（選択結果）。                      | `AssetPanel` をモーダルでラップ。                                           | `AssetModal`（Attach Audioなどの選択UI）。                                          |
| ストーリーライン | （専用TS型なし）Scene/Cut構造を利用。                | D&D・外部投入・vault取り込み処理（Storyline内部）。                        | `Storyline.tsx`（タイムラインUI本体）。                                  |
| プレビュー    | `PreviewMode`（scene/all）。               | `setPreviewMode` 等のストア操作。                                 | `PlaybackControls`（起動）、`PreviewModal`（再生UI）。                  |
| プレビュー制御 | `PlaybackState`。                         | `useSequencePlaybackController`（再生/範囲/ループ/バッファ管理）。 | `PreviewModal`（Sequence Mode再生制御）。                              |
| メディアソース | `MediaSource`。                           | `createVideoMediaSource` / `createImageMediaSource`。            | `PreviewModal`（Sequence Modeの実体再生）。                             |
| 保管庫フォルダ  | `Project.vaultPath` / ストアの `vaultPath`。 | `initializeSourcePanel`（assetsフォルダ初期化）。                   | `StartupModal`（選択/作成/初期化）。                                    |
| 同期       | `AssetIndex` / `VaultImportResult` 等。   | `assetPath` ユーティリティ + ElectronAPI の vaultGateway 経由。           | 明示的な専用UIは未確認（主要フローは `StartupModal`/`Sidebar`/`Storyline` 経由）。 |
