# Preview Runtime Boundaries

## TL;DR
対象：Preview runtime の ownership と UI contract
正本：`docs/guides/preview.md` の L1 不変条件
原則：
- Owner Matrix は監査表であり新抽象ではない
- owner の単位は hook / runtime / controller に揃える
- 欠落状態は silent fallback しない
- single-only capability は parity debt と混同しない
詳細：L1 の責務境界は `docs/guides/preview.md` を参照

**目的**: Preview runtime の実装境界と再発防止ルールを L2 として固定する。  
**適用範囲**: `PreviewModal.tsx`, `usePreviewInteractionCommands`, `usePreviewSingleRuntime`, `usePreviewSequenceRuntime`, `usePreviewFullscreen`, `useSequencePlaybackController`。  
**関連ファイル**: `docs/guides/preview.md`, `docs/guides/export.md`, `docs/guides/media-handling.md`, `docs/guides/implementation/debug-overlay.md`。  
**更新頻度**: 中。

## Must / Must Not
- Must: Owner Matrix は監査表として扱い、新しい実装抽象に昇格させない。
- Must: owner label は hook / runtime / controller 単位に揃える。
- Must: Single Image の clock/media owner は `usePreviewSingleRuntime` に維持する。
- Must: Preview 操作の入口は `usePreviewInteractionCommands` に集約する。
- Must: fullscreen state は `fullscreenchange` を正本として同期する。
- Must: focus cut 不在など play 開始条件を満たさない状態では、理由を UI に出す。
- Must Not: Single Image を sequence controller 経由へ戻さない。
- Must Not: capability 差を parity 漏れとして扱い、L1 更新なしに仕様拡張しない。
- Must Not: clamp/normalize/swap/reject のロジックを `clipRangeOps` の外へ戻さない。

## Owner Matrix
- owner 軸は `clock owner` `media owner` `audio owner` の 3 つに固定する。
- Single Video:
  - clock owner は `usePreviewSingleRuntime`。
  - media owner は `usePreviewSingleRuntime`。
  - audio owner は `usePreviewSingleAttachedAudio`（attached）。
- Single Image:
  - clock owner は `usePreviewSingleRuntime`。
  - media owner は `usePreviewSingleRuntime`。
  - audio owner は `usePreviewSingleAttachedAudio`（attached）。
- Sequence:
  - clock owner は `useSequencePlaybackController`。
  - media owner は `usePreviewSequenceRuntime`。
  - audio owner は `usePreviewSequenceAudio`。

## 時間・音声の実装境界
- AudioPlan / 再生同期は cut 列由来の時間軸で扱う。
- focus cut 不在時は曖昧なフォールバック再生を行わず、欠落状態を明示する。
- 欠落状態では silent fallback せず、play 開始条件を満たさない理由を UI に出す。

## 責務境界
- 操作入口（Commands）:
  - 対象は play/pause/seek/step/skip、IN/OUT、loop/mute/marker。
  - progress bar click/drag や marker drag による seek も command 入口で処理する。
  - 表示整形、DOM 計測、fullscreen/overlay など純UI状態は command 対象外。
- 時間の正本（Timebase）:
  - 正本は domain 正規化後の canonical cut timing とし、Preview 側の独自再計算や Preview/Export の時間定義分岐を禁止する。
- IN/OUT（Clip Range）:
  - 更新入力は playhead、基準は canonical timing。
  - 最小 range span は 1 frame とし、I/O ボタン・marker drag・keyboard nudge の全経路で同じ clamp を使う。
  - single image は I/O surface を持たず、single video のみを range 編集対象とする。
  - single video は partial I/O のときだけ `Clear I/O` を出し、clip 保存/解除の scissors と意味を分離する。
  - sequence は range 存在時のみ `Clear I/O` を出し、動作は `null/null` への明示解除に限定する。
  - marker focus は drag end で落とさず、handle は keyboard focus 可能にする。
  - IN/OUT が両方ある場合、selection は固定長 window として平行移動できる。
  - clamp/normalize/swap/reject は `clipRangeOps` の純関数に集約し、`PreviewModal.tsx` に戻さない。
  - clip 保存/clear 後のサムネイル更新は command 外の非同期 queue（`features/cut`）で追随させる。
- Sequence Playback Spec:
  - Sequence 再生時の clip/hold/media source 判定は `buildSequencePlan` 由来の playback spec を使う。
  - `PreviewItem.cut` は表示文脈や command 入力の参照に留め、Sequence media source の時間 spec に使わない。
- 表示（View）:
  - UI playhead time の丸め/fps/表示単位は View 側の純関数で完結し、controller/domain に混ぜない。
  - fullscreen state は `fullscreenchange` を正本とする event 駆動で同期し、楽観的な local state を正本にしない。

## Related Docs
- L1 正本: `docs/guides/preview.md`
- Export正本: `docs/guides/export.md`
- Media I/O: `docs/guides/media-handling.md`
- Debug Overlay: `docs/guides/implementation/debug-overlay.md`
