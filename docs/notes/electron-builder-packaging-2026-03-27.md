# Electron Builder Packaging (2026-03-27)

## TL;DR
- `electron-builder` 設定は `package.json` の `build` に置く。
- 配布コマンドは `npm run dist:app` / `npm run dist:app:dir` を使う。
- prototype 配布 target は各 OS ともまず `zip` を使う。
- Electron 本体は `node_modules/electron/dist` を使い、追加ダウンロードを避ける。
- `ffmpeg-static` は `asarUnpack` 対象にする。
- 現在のローカル環境では `npm` collector が不安定なため、`beforePack` で traversal collector に切り替える。
- cache は `~/.cache` ではなくリポジトリ配下の `.cache/` を使う。

## 目的
ローカル prototype 配布に必要な packaging 導線を固定し、renderer/main の build と packaged app の実行前提を揃える。

## 適用範囲
- `electron-builder` 設定
- 配布用 script
- prototype 配布 target
- `ffmpeg-static` の packaged 実行前提
- 一時的な collector workaround

## Must
- Must: packaging は `npm run build` と `npm run build:electron` の後に実行する。
- Must: prototype 配布 target は軽量な `zip` を優先する。
- Must: Electron 本体はローカルの `node_modules/electron/dist` を使う。
- Must: `ffmpeg-static` は unpack 済み実ファイルとして同梱する。
- Must: packaged 実行時は `app.asar.unpacked` 側の ffmpeg 実体を優先する。
- Must: 配布 script は `--publish never` を付け、意図しない publish を避ける。
- Must: `electron-builder` cache は repo local の `.cache/` に固定する。

## Must Not
- Must Not: `ffmpeg-static` を `asar` 内実行前提のままにしない。
- Must Not: packaging 成否を renderer build 成功だけで判断しない。
- Must Not: collector workaround を domain docs に混ぜない。

## 現状メモ
- unpacked 出力先は `release/`。
- `beforePack` フックは `scripts/electron-builder-before-pack.cjs`。
- `electron-builder` 実行ラッパーは `scripts/run-electron-builder.cjs`。
- Node.js 20.x を packaging の推奨実行環境とする。
