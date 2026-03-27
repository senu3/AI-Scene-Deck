# Prototype Release Flags (2026-03-27)

## TL;DR
- プロトタイプ公開向けに、`Environment Settings` と `VIDEO Hold` の公開面を env flag で切り替える。
- `VITE_ENABLE_ENVIRONMENT_SETTINGS=1` のときだけ Settings 入口とモーダルを表示する。
- `VITE_ENABLE_VIDEO_HOLD=1` のときだけ Preview の `VIDEO Hold` ボタンとモーダルを表示する。
- `VIDEO Hold` flag は UI 露出のみを切り替え、既存 project に保存済みの hold runtime までは無効化しない。

## 目的
- 作りかけ機能を prototype build から安全に隠し、公開面を最小化する。

## 適用範囲
- `src/App.tsx`
- `src/components/Header.tsx`
- `src/components/PreviewModal.tsx`
- `src/utils/featureFlags.ts`
- `src/vite-env.d.ts`

## Must
- `Environment Settings` は header menu 入口と modal mount を同じ flag で揃えて制御する。
- `Notification Tests` は production へ出さず、`DEV` かつ Settings flag 有効時のみ到達可能にする。
- `VIDEO Hold` は Preview UI の露出だけを制御し、Preview/Export parity の時間定義は分岐させない。
- flag 未設定時の既定値は「非表示」とする。

## Must Not
- flag を使って Preview / Export の canonical timing 解釈を分岐させない。
- Settings 入口だけ隠して modal を常時 mount するような片側制御をしない。
- 開発用 Notification UI を本番 build へ露出しない。

## 運用メモ
- `VITE_ENABLE_ENVIRONMENT_SETTINGS=1`
  - `Environment Settings` menu と modal を表示する。
- `VITE_ENABLE_VIDEO_HOLD=1`
  - Preview の `VIDEO Hold` button と modal を表示する。
- 両方未設定:
  - prototype 公開向け既定として非表示になる。
