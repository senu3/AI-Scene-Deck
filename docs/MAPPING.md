| 概念 | データモデル（TS型） | ストア/ユーティリティ | 主要UI/コンポーネント |
| --- | --- | --- | --- |
| プロジェクト | `Project`（vaultPath, scenes, sourcePanel）。 | `initializeProject` / `loadProject` / `window.electronAPI.saveProject`。 | `StartupModal`、`Header` |
| シーン | `Scene`（cuts/order/notes/groups）。 | `addScene/removeScene/renameScene`。 | `Storyline`、`PlaybackControls` |
| シーンノート | `SceneNote`。 | `addSceneNote/updateSceneNote/removeSceneNote`。 | `DetailsPanel` |
| カット | `Cut`（assetId/displayTime/in/out）。 | `addCutToScene/updateCutDisplayTime/moveCutToScene`。 | `CutCard`、`PreviewModal` |
| カットグループ | `CutGroup`（cutIds/isCollapsed）。 | `createGroup/deleteGroup/toggleGroupCollapsed/renameGroup`。 | `CutGroupCard`、`Storyline` |
| アセット | `Asset`（path/type/vaultRelativePath 等）。 | `assetPath` 同期/解決/インポート（VaultGateway 経由）。 | `Sidebar`、`CutCard`、`PreviewModal` |
| Asset Index | `AssetIndex` / `AssetIndexEntry`。 | `loadAssetIndex` / `vaultGateway.saveAssetIndex`。 | `AssetDrawer`、`AssetPanel` |
| Metadata Store | `MetadataStore` / `AssetMetadata` / `SceneMetadata`。 | `loadMetadataStore` / `saveMetadataStore`。 | `DetailsPanel`、`PreviewModal` |
| アセットパネル | `Asset` / `AssetIndexEntry`。 | `loadAssetIndex` / `getFolderContents` / `metadataStore` 集計。 | `AssetPanel` |
| アセットモーダル | `Asset`（選択結果）。 | `AssetPanel` をモーダルでラップ。 | `AssetModal` |
| ストーリーライン | （専用TS型なし）Scene/Cut構造。 | D&D・外部投入・vault 取込（Storyline 内部）。 | `Storyline` |
| プレビュー | `PreviewMode`（scene/all）。 | `setPreviewMode`。 | `PlaybackControls`、`PreviewModal` |
| プレビュー制御 | `PlaybackState`。 | `useSequencePlaybackController`。 | `PreviewModal` |
| メディアソース | `MediaSource`。 | `createVideoMediaSource` / `createImageMediaSource`。 | `PreviewModal` |
| ソースパネル状態 | `SourcePanelState` / `SourceViewMode`。 | `initializeSourcePanel` / `getSourcePanelState`（`Project.sourcePanel` に保存）。 | `Sidebar` |
