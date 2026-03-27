# Electron Packaging

## TL;DR
対象: `electron-builder` による prototype 配布 packaging  
正本: `package.json#build` と packaging scripts  
原則:
- packaging は renderer/main build 完了後に実行する
- Windows prototype 配布は `npm run build-win` で NSIS installer (`.exe`) を作る
- packaged 実行時の `ffmpeg-static` 実体は unpack 済みファイルを使う

## 目的
prototype 配布に必要な packaging 導線を固定し、ローカル build と packaged app の実行前提を揃える。

## 適用範囲
- `package.json`
- `package-lock.json`
- `scripts/electron-builder-before-pack.cjs`
- `scripts/run-electron-builder.cjs`
- `electron/main.ts`

## Must
- Must: packaging は `npm run build` と `npm run build:electron` の後に実行する。
- Must: 配布コマンドは `npm run dist:app` / `npm run dist:app:dir` を使う。
- Must: Windows prototype 配布 installer (`.exe`) は `npm run build-win` を使う。
- Must: Windows packaging target は `nsis` とする。
- Must: Electron 本体は `node_modules/electron/dist` を使い、追加ダウンロードを避ける。
- Must: `ffmpeg-static` は `asarUnpack` で同梱する。
- Must: packaged 実行時は `app.asar.unpacked` 側の ffmpeg 実体を優先する。
- Must: `electron-builder` cache は repo local の `.cache/` に固定する。
- Must: 配布 script は `--publish never` を付け、意図しない publish を避ける。
- Must: packaging の推奨実行環境は Node.js 20.x とする。
- Must: `build-win` は Windows host でのみ実行する。
- Must: Windows installer build を行う環境は symlink 作成権限を持つこと（Developer Mode もしくは管理者権限の terminal）。

## Must Not
- Must Not: `ffmpeg-static` を `asar` 内実行前提のままにしない。
- Must Not: packaging 成否を renderer build 成功だけで判断しない。
- Must Not: Linux / macOS から `build-win` を使って Windows artifact を作ろうとしない。

## Packaging Commands
- `npm run dist:app`
  - 現在の OS 向け配布 artifact を作成する。Windows では `nsis` に従い installer (`.exe`) を作成する。
- `npm run dist:app:dir`
  - unpacked app を作成する。
- `npm run build-win`
  - Windows host 上で Windows 用 NSIS installer (`.exe`) を作成する。

## 実装メモ
- `beforePack` は `npm` collector を traversal に切り替える。
- `scripts/run-electron-builder.cjs` は cache 先を `.cache/` に固定して `electron-builder` を起動する。
- `scripts/build-win.cjs` は Windows host 以外からの実行を拒否し、`nsis` target を明示する。
- `electron-builder` の NSIS packaging は `winCodeSign` 展開時に symlink を作成するため、権限不足だと `.exe` 生成前に失敗する。
- 出力先は `release/`。
