# DetailsPanel Same-Cut Undo/Redo

## TL;DR
対象: single-cut選択中の`DetailsPanel`
責務: same-cutのUndo/Redoで最低限どこを追従対象にするかを固定する
原則: `ClipSection` の in/out 表示だけを追従対象にする
補足: `ThumbSection` は別扱いにする

**目的**: `DetailsPanel` の Section 分割に先立ち、single-cut panel における same-cut Undo/Redo の最小追従仕様を固定する。  
**適用範囲**: `src/components/DetailsPanel.tsx` と、その後継となる single-cut details UI。  
**関連ファイル**: `docs/guides/cut-history.md`, `docs/guides/implementation/thumbnail-profiles.md`。  
**更新頻度**: 中。

## Must / Must Not
- Must: 本ガイドの対象は single-cut panel に限定する。
- Must: same-cut の Undo/Redo では `ClipSection` の `inPoint` / `outPoint` 表示だけを追従対象として固定する。
- Must: `ThumbSection` は別扱いとし、Undo/Redo 直後は既存サムネイルを維持してよい。
- Must: `ThumbSection` の更新が必要な場合は、後から非同期で追従させてよい。
- Must: scene / group / multi-cut details は現状維持とする。
- Must Not: same-cut の Undo/Redo 追従のためだけに clip 保存経路へ副作用を追加しない。
- Must Not: `ThumbSection` に clip境界表示と同じ即時一致保証を課さない。
- Must Not: scene / group / multi-cut details の追従仕様をこのガイドで拡張しない。

## Same-Cut Definition
- same-cut とは、`selectedCutId` が変わらないまま、同じ cut entity の内容だけが Undo/Redo で変化する状態を指す。
- 本ガイドでは、そのうち `ClipSection` の `inPoint` / `outPoint` 表示だけを扱う。
- selection が group / scene / multi-cut に切り替わった場合は本ガイドの対象外とする。

## Thumbnail Boundary
- `details-panel` profile は `timeline-card` と別責務を維持する。
- `DetailsPanel` 表示都合だけで clip保存 command に `details-panel` 用の regenerate effect を追加しない。
- `ThumbSection` は既存サムネイル維持を基本とし、必要なら後で非同期更新する。

## Non-Scope
- scene / group / multi-cut details の追従仕様変更。
- `HeaderSection` / `AudioSection` / `MetadataSection` の same-cut Undo/Redo 追従仕様固定。
- same-cut の Undo/Redo に対する `details-panel` thumbnail 再生成 queue 導入。
