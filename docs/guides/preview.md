# Preview Guide (Single vs Sequence)

## TL;DR
対象：Preview の責務境界
正本：canonical cut timing / command 単一入口 / mode境界
原則：
- Sequence再生制御は単一コントローラ経由
- Preview操作は command 単一入口経由
- 時間正本は canonical cut timing
- runtime ownership / UI contract 詳細は L2 実装ガイドを参照
詳細：実装境界は `docs/guides/implementation/preview-runtime-boundaries.md` を参照

**目的**: Preview のL1責務と不変条件を固定し、runtime 実装境界を L2 へ分離して運用する。  
**適用範囲**: `PreviewModal` / 再生コントローラ / Preview command surface。  
**関連ファイル**: `docs/guides/export.md`, `docs/guides/media-handling.md`, `docs/guides/implementation/preview-runtime-boundaries.md`, `docs/guides/implementation/debug-overlay.md`。  
**更新頻度**: 中。

## Must / Must Not
- Must: Sequence 再生は `useSequencePlaybackController` を単一制御面として使う。
- Must: Preview 操作（play/pause/seek/step/skip/in/out/loop/mute/marker）は `usePreviewInteractionCommands` を単一入口として通す。
- Must: timing 解決は domain 正規化後の canonical cut timing を正本とする。
- Must: Sequence consumer は `buildSequencePlan(project, opts)` を公開入口として使う。
- Must: `sequenceCuts` 指定時はその範囲のみで sequence を構築する。
- Must: `PreviewModal.tsx` は Composition Root とし、配線（hook 呼び出し＋View props 組み立て）に限定する。
- Must: Debug Overlay は Preview の時間正本を変更しない。
- Must Not: Preview/Export で時間定義を分岐させない（ad-hoc タイマー含む）。
- Must Not: Preview consumer が `buildSequenceItemsForCuts` / `buildSequenceItemsForExport` を直接公開入口として使わない。
- Must Not: Sequence Mode を `<video>` 直接制御へ戻さない。
- Must Not: Controller はドメイン構造を書き換えない。

## モード境界
- `PreviewModalProps` は `mode: 'single' | 'sequence'` の discriminated union を正本にする。
- Single Mode:
  - 単一 asset（または単一 cut）の確認に使う。
  - clip-local な IN/OUT 調整を許可する。
- Sequence Mode:
  - cut 列の連続再生を行う。
  - play/pause/seek/loop/range/buffering をコントローラで一元管理する。
- owner / runtime / capability 差 / 欠落状態 UI contract の詳細は `docs/guides/implementation/preview-runtime-boundaries.md` を正本にする。

## Preview / Export Parity
- 表示時間は cut canonical timing を正本とする。
- Preview 起点 export は Export ガイドの正本ルールに従う。
- Preview 側で独自の export 時間定義を持たず、`buildSequencePlan(project, opts)` で生成した Plan を Export へ渡す。

## Debug Overlay Boundary
- Debug Overlay の仕様は `docs/guides/implementation/debug-overlay.md` に従う。
- Preview の時間正本・ドメイン構造に干渉してはならない。

## 関連ガイド
- 実装境界: `docs/guides/implementation/preview-runtime-boundaries.md`
- Export正本: `docs/guides/export.md`
- Media I/O: `docs/guides/media-handling.md`
- Debug Overlay: `docs/guides/implementation/debug-overlay.md`
