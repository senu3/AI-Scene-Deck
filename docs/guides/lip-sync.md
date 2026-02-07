# LipSync Guide (RMS-based, Minimal Integration)

**目的**: AI-Scene-Deck における LipSync のデータ構造、保存、プレビュー、再生の最小統合方針を定義する。  
**適用範囲**: `LipSyncModal`, `metadataStore`, `vaultGateway`, `lipSyncUtils`。  
**関連ファイル**:  
- `src/components/LipSyncModal.tsx`  
- `src/hooks/useLipSyncPreview.ts`  
- `src/utils/lipSyncUtils.ts`  
- `src/utils/metadataStore.ts`  
- `src/store/useStore.ts`  
- `electron/vaultGateway.ts`, `electron/preload.ts`  
**更新頻度**: 中。  

## Design Principles
- **PreviewModal のエンジンを共有しない**  
  LipSyncModal では `<video>` 直再生を使い、PreviewModal の Sequence/Single エンジンに依存しない。
- **base64 を永続化しない**  
  画像フレームやマスクは Vault の assets に保存し、metadata は `assetId` 参照で保持する。
- **RMS は既存の保存形式に従う**  
  RMS 配列は `AssetMetadata.analysis` に保存される（`audioUtils` 側の生成/保存に準拠）。

## Data Model
`AssetMetadata.lipSync` に設定を格納する。

```ts
type LipSyncSettings = {
  baseImageAssetId: string;
  variantAssetIds: string[];
  maskAssetId?: string;
  rmsSourceAudioAssetId: string;
  thresholds?: number[]; // default: [0.2, 0.4, 0.6]
};
```

### Storage
- 保存先: `.metadata.json` 経由の `metadataStore`
- 主なAPI:
  - `metadataStore.updateLipSyncSettings(assetId, settings)`
  - `metadataStore.removeLipSyncSettings(assetId)`
- `Cut` 側は `isLipSync` / `lipSyncFrameCount` で参照するだけに留める。

## Asset Handling (Vault)
- フレーム/マスクは **Data URL → Vault asset** の変換を行う。
- `vaultGateway.importDataUrlAsset` で assets を登録し、`assetId` を保存する。
- 直接 base64 を metadata に保存しないこと。

## LipSyncModal Flow
1. **音声未紐づけ**の場合: `ATTACH AUDIO` を促し、紐づけ後に LipSyncModal を開く。
2. **登録時**:
   - フレーム/マスクを Vault に保存
   - `AssetMetadata.lipSync` を更新
   - `Cut.isLipSync` と `Cut.lipSyncFrameCount` を更新
3. **プレビュー**:
   - `<video>` の `currentTime` を読んで RMS インデックスを算出
   - `rmsValueToVariantIndex` で口画像インデックスを決定
   - `variantIndex` が変わった時だけ切り替え

## RMS → Variant Mapping
`lipSyncUtils` の純粋関数で扱う。
- `absoluteTimeToRmsIndex(timeSec, fps, rmsLength)`
- `rmsValueToVariantIndex(rmsValue, thresholds)`

推奨:
- `fps` は 30 を基準にする（RMS 生成側と一致させる）
- `thresholds` は **閾値ビン**で切替頻度を抑える

## Error / Fallback Behavior
- RMS 不足時は **base variant** を表示して継続
- asset が欠損している場合は **該当 variant をスキップ**し、停止しない
- UI 表示は `MiniToast` / `Toast` を使用（既存パターンに従う）

## Must NOT Do
- PreviewModal の Sequence エンジンを LipSyncModal に流用しない
- base64 を metadata に直保存しない
- `Cut` データに大きなバイナリ/配列を保持しない
- RMS 参照のために `<audio>` / `<video>` のイベントに依存しない

## Related Docs
- `docs/guides/preview.md`
- `docs/guides/media-handling.md`
- `docs/guides/buffer-guide.md`
- `docs/references/DOMAIN.md`
- `docs/references/MAPPING.md`
