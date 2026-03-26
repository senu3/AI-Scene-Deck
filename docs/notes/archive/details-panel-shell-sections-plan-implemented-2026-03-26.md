# DetailsPanel Shell + Sections Plan Implemented (2026-03-26)

## 状態
- `DetailsPanel.tsx` は selection shell / router として維持する。
- 初回スコープでは single-cut panel だけを `CutDetailsPanel` へ分離した。
- scene / group / multi-cut の分岐は `DetailsPanel.tsx` に残しており、これは意図通りの停止点である。
- 本ノートの scoped work は完了したため archive へ移動する。

## TL;DR
- `DetailsPanel` を selection shell と view別 panel に分離し、single-cut 表示だけをさらに section 分割する。
- same-cut Undo/Redo の追従範囲は `docs/guides/implementation/details-panel-same-cut-undo-redo.md` を正本にする。
- 初回移行では canonical表示の局所化を優先し、`details-panel` thumbnail の即時一致保証は拡張対象に留める。

## 目的
- `src/components/DetailsPanel.tsx` の責務過多を解消し、single-cut details の再レンダー原因を section 単位へ局所化する。
- Undo/Redo と selection 維持時の表示挙動を読みやすくし、以後の改修コストを下げる。

## 適用範囲
- `src/components/DetailsPanel.tsx`
- `src/store/selectors.ts` または details-panel 専用 selector 群
- single-cut details に関係する thumbnail / metadata / audio 表示ロジック

## Must / Must Not
- Must: `DetailsPanel` の selection shell と single-cut details 表示を分離する。
- Must: same-cut Undo/Redo 追従範囲は implementation guide に合わせる。
- Must: clip保存責務と details 表示更新責務を分離したまま移行する。
- Must: `details-panel` thumbnail profile と `timeline-card` profile を混線させない。
- Must: 初回移行では single-cut 経路の購読最適化を優先し、scene/group/multi-cut は view 分離止まりでよい。
- Must Not: section 分割のついでに command 境界や thumbnail regenerate policy を変更しない。
- Must Not: `useAssetMetadataHydration` を複数 section に重複配置して hydration retry を増やさない。
- Must Not: selector factory 導入前に大きい domain object を section props で毎回渡して `React.memo` だけに依存しない。

## Same-Cut Scope Memo
- 現時点で same-cut Undo/Redo の仕様対象は single-cut panel だけに限定する。
- same-cut の Undo/Redo で明示的に追従対象とするのは `ClipSection` の `inPoint` / `outPoint` 表示だけとする。
- `ThumbSection` は別扱いとし、Undo/Redo 直後は既存サムネイル維持を基本にする。
- `ThumbSection` の更新が必要な場合は、後から非同期更新する前提で設計する。
- scene / group / multi-cut details は現状維持とし、今回の移行では追従仕様を増やさない。

## 現状整理
- 現在の `DetailsPanel` は scene / group / multi-cut / single-cut を1ファイルで分岐している。
- component冒頭で `scenes`、selection、metadata、audio action、modal state を広く抱えている。
- single-cut 表示では `preferredThumbnail` 依存で同一cut中でもサムネ再評価が起きうる。
- clip保存 command に `thumbnailProfile: "details-panel"` を渡していても、thumbnail queue は `timeline-card` のみ対象である。

## 到達目標
- selection shell が `none | scene | group | cut-single | cut-multi` の view 切替だけを担当する。
- single-cut panel は layout component と section component 群に分割される。
- same-cut の store 更新で、少なくとも `ClipSection` の in/out 表示が局所更新される構造になる。
- `ThumbSection` は clip境界表示と切り離された別境界として読み取れる。

## 推奨構成
- `DetailsPanelShell`
  - selection type と selected ids を見て view を切り替える
- `SceneDetailsPanel`
  - scene details 専用
- `GroupDetailsPanel`
  - group details 専用
- `MultiCutDetailsPanel`
  - multi-select details 専用
- `CutDetailsPanel`
  - single-cut の layout 専用
- `CutDetailsHeaderSection`
- `CutDetailsThumbSection`
- `CutDetailsClipSection`
- `CutDetailsAudioSection`
- `CutDetailsMetadataSection`

## データ境界
- Shell:
  - selection type
  - `selectedSceneId`
  - `selectedGroupId`
  - `selectedCutId`
  - `selectedCutIds`
- `CutDetailsPanel`:
  - `cutId` を受け取り、layout と modal ownership だけを持つ
- shared cut context:
  - cut探索と active asset hydration は 1 箇所で行う
  - hydration 結果を section 間で共有する
- sections:
  - 必要な selector だけを読む
  - 派生shapeを小さく固定する

## フェーズ計画
### Phase 0. 仕様固定
- `docs/guides/implementation/details-panel-same-cut-undo-redo.md` を正本として追加する。
- 現状メモとのズレがないことを確認する。

### Phase 1. Shell 分離
- 既存 `DetailsPanel.tsx` から selection view の分岐を切り出す。
- scene / group / multi-cut / single-cut を別 component に分ける。
- この段階では single-cut 内部はまだ直置きでもよい。

### Phase 2. Single-Cut Layout 分離
- `CutDetailsPanel` を追加し、layout、preview modal、asset modal の ownership をここへ寄せる。
- `cutId` 以外の大きい domain object を親 props で渡さない。

### Phase 3. Section 分割
- header / thumb / clip / audio / metadata を section component に分ける。
- same-cut Undo/Redo では `ClipSection` の in/out 表示だけを追従対象として固定する。
- `React.memo` は selector粒度が整った section にだけ使う。

### Phase 4. Selector 最適化
- details-panel 専用 selector 群を追加する。
- `makeSelectCutClipFields(cutId)` のように section 単位の最小shape selector を導入する。
- equality 戦略を決めずに object selector を増やさない。

### Phase 5. Thumb 境界の明文化
- `ThumbSection` は既存サムネイル維持を基本とする。
- 必要な場合だけ後から非同期更新する方針を明文化する。

### Phase 6. 任意最適化
- Accordion / Tabs を導入する場合だけ閉じた section の unmount を検討する。
- audio summary など重い派生計算が残る場合だけ memo 化を追加する。

## 実装上の注意
- `getSelectedCuts()` や `getSelectedGroup()` のような全探索 getter を render 中に多用し続けない。
- `selectedCutId` から cut を引く共有ヘルパーを先に用意し、各 section が個別に `scenes` 全探索しないようにする。
- `useAssetMetadataHydration` は shared cut context 側に留め、section内へ分散させない。
- modal の open state は layout ownership に残し、section に散らさない。

## 初回検証観点
- same-cut の clip boundary Undo/Redo で `ClipSection` の in/out 表示が追従する。
- same-cut の clip boundary Undo/Redo で `ThumbSection` は既存サムネイル維持でもよい。
- scene / group / multi-cut details の挙動が現状から変わらない。
- selected cut 削除時に panel が不整合状態で残らない。

## フォローアップ候補
- same-cut の `displayTime` Undo/Redo 追従をどこまで広げるか再検討する。
- same-cut の audio toggle Undo/Redo 追従を `AudioSection` へ広げるか再検討する。
- `assetId` relink Undo/Redo 時の header / metadata / thumb 追従をどの段階で固定するか再検討する。

## リスク
- selector factory が毎renderで作り直されると効果が薄れる。
- object selector の equality 設計が曖昧だと `React.memo` だけでは再レンダーを止められない。
- shared cut context を作らず section ごとに探索すると、購読は細かくても探索コストが重複する。

## 完了条件
- selection shell と single-cut details が責務分離されている。
- single-cut details が section 単位の購読に分かれている。
- same-cut Undo/Redo の追従範囲が docs と実装で一致している。
- `details-panel` thumbnail 即時一致を保証しない点が docs 上で明示されている。
