# L0: User Model

## TL;DR
- ユーザーが何を操作し、どの概念がどの画面責務に対応するかを最短で把握できる入口にする。

## 1. ユーザーが操作する概念

| UI概念 | 内部エンティティ | 正本 |
|--------|------------------|------|
| Scene  | scene entity      | sceneOrder |
| Cut    | cut entity        | cut.order |
| Group  | group entity      | group.cutIds |
| Asset  | asset entity       | assetId |

## 2. 画面単位の責務

### Workspace
- Asset Workspace で Vault asset と source folder を参照する
- Project View で Scene / Cut / Group を編集する
- Details Panel で選択中の Scene / Cut / Group の補助情報を編集する
- Header から preview / export / save / duration goal / close を起動する

### Preview
- Single Preview で単一 cut / asset の確認と clip 調整を行う
- Sequence Preview で scene 単位または全体の流れを確認する

### Export
- 書き出し設定の確認
- 全体または scene 単位の出力実行

### Recovery
- load 時の missing asset に対して relink / delete / skip を選択する

## 3. UI操作 -> ドメイン変更対応

| 操作 | 変更対象 | 備考 |
|------|----------|------|
| Scene 並び替え | sceneOrder | 表示順と編集順を同期 |
| Asset 取り込み | asset entity / cut entity | Vault 登録後に Scene へ配置できる |
| Cut 追加 | cut entity | 追加先 Scene の順序に従う |
| Cut 並び替え | cut.order | 並び替え後に再採番 |
| Cut clip 調整 | cut entity | `inPoint` / `outPoint` / `isClip` を更新する |
| Group 作成 | group.cutIds | Cut 所属を定義 |
| Asset 再リンク | assetId | 参照切れ時の復旧経路 |
| Missing asset 対応 | assetId / cut entity | relink / delete / skip を選択する |

## 4. このドキュメントの役割

- ユーザー視点の概念と操作責務のみを扱う。
- 実装詳細、監査運用、設計原則は扱わない。
