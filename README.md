# SceneDeck

**メディア素材からストーリー構造を組み立てるためのビジュアルツール**

SceneDeck は、画像・動画などの素材を **Scene と Cut 単位で整理し、映像の流れを視覚的に構築するためのアプリケーション**です。

動画編集を始める前の段階で、素材を並べ替えながら **ストーリー構造や構成の流れを確認する** ことを目的としています。

[プロトタイプ v.0.1.0 (Windows11)](https://github.com/senu3/scene-deck-builder/releases)  
  
<img width="1386" height="893" alt="スクリーンショット 2026-03-16 235741" src="https://github.com/user-attachments/assets/fa857c98-a4ea-4691-b1cd-4f18e2988cde" />

## どんなツールか

動画制作では、素材が増えるほど次の問題が起きます。

- 素材がフォルダに散らばる
- 映像の構成が頭の中にしかない
- 編集前にストーリーの流れを確認しづらい

SceneDeck は、素材を **Scene（シーン）と Cut（カット）として並べることで、映像構造を視覚的に整理** できるツールです。

```text
Media Asset
      ↓
     Cut
      ↓
    Scene
      ↓
  Storyline
```

素材を並べ替えながら、映像全体の流れをプレビューできます。

## 主な機能

### 素材からカットを作成

画像や動画ファイルをドラッグすると、カットとしてストーリーラインに追加できます。

```text
Drag media
↓
Create cut
↓
Add to scene
```

### シーン単位で構成を整理

カットを並び替えながら、シーンの流れを組み立てられます。

- シーン追加
- カットの並び替え
- シーン間移動
- グループ化によるまとまり管理

### ストーリーの流れをプレビュー

並べたカットをそのまま再生し、映像の流れを確認できます。

- Single Preview で単体 cut / asset を確認
- Sequence Preview で scene 単位または全体の流れを確認
- 構成確認用のプレビューとして利用

### ローカルファイルと同期する設計

SceneDeck は **ローカルファイルと同期する構造** になっています。

主な特徴:

- すべての素材はローカル保存
- プロジェクトはファイルとして復元可能
- アプリ外からも素材を管理可能

アセットは `vault` フォルダで管理され、インデックスにより素材とカットの対応関係が保持されます。

### プロジェクトに素材をコピーして管理

SceneDeck に素材を追加すると、ファイルはプロジェクトの保管フォルダに **コピー** されます。

これは元ファイルへのリンクではありません。

```text
Drag media
↓
Copy into project vault
↓
Manage as cut
```

この方式により、次の利点があります。

- 元ファイルを移動してもリンク切れが起きない
- プロジェクトをそのままバックアップできる
- フォルダ単位でプロジェクトを共有しやすい

### 補助機能

- MP4 エクスポート
- `manifest.json` / `timeline.txt` の sidecar 出力
- `project.sdp` への autosave
- missing asset の recovery 導線

## プロジェクト構成

代表的な保存ファイル:

- `project.sdp`
  - ストーリーライン全体の保存データ
- `vault/assets/.index.json`
  - asset と実体ファイルの対応
- `vault/.metadata.json`
  - 補助メタ情報
- `vault/.trash/.trash.json`
  - 削除・退避ログ

## セットアップ

### 前提条件

- Node.js 18 以上
- npm

Packaging は `electron-builder` の検証対象として Node.js 20.x を推奨します。

### インストールと起動

```bash
npm install
npm run build:electron
npm run dev
```

## ドキュメント

設計・仕様ドキュメントの入口は `docs/INDEX.md` です。開発用の詳細な運用ルールや補助コマンドは docs 側を参照してください。

## ライセンス

MIT
