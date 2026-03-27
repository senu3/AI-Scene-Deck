# Vault / Asset Guide

## TL;DR
対象：Vault内アセット管理の運用ルール
正本：.index.json / .metadata.json / .trash/.trash.json
原則：
- asset は `assetId` で解決する
- asset index が実体ファイル対応の正本
- 削除は trash + log による履歴管理
- `.index.json` の現行 usage summary は save 時に再構成される `usageRefs` を正本とする
- より豊かな human-readable recovery clue は note/TODO で追跡する
- JSON + Vault から recovery できる
詳細：実装分岐は implementation を参照

**目的**: Vault と asset 管理の不変条件を定義する。  
**適用範囲**: `vault/assets`, `.index.json`, `.metadata.json`, `.trash`。  
**関連ファイル**: `docs/guides/export.md`, `docs/guides/media-handling.md`, `docs/guides/preview.md`。  
**更新頻度**: 中。

## Must / Must Not
- Must: Asset は `vault/assets/` に保存する。
- Must: `assetId -> filename` 対応は `.index.json` を正本とする。
- Must: Asset 解決は `assetId` を主経路とする。
- Must: 削除時は asset を `.trash/` へ移動し `.trash.json` に履歴を残す。
- Must: trash move write path は、`assetId` が与えられた場合に index からの除去結果を呼び出し元へ返す。
- Must: asset index は asset 解決（`assetId -> filename`）の正本として扱う。
- Must: Vault への正式登録は finalize transaction 相当の単一 gateway write 入口でのみ行う。
- Must: managed asset の at-rest filename は hash を正本とし、UI 表示名は `originalName` を正本とする。
- Must: `.index.json` の現行 `usageRefs` は save 時に再構成される scene/cut 位置情報として扱う。
- Must: `.index.json` / `.trash.json` の richer clue 契約を将来案として書く場合は、現行実装と混同せず `docs/notes/index-trash-human-readable-plan-2026-03-12.md` と `docs/TODO_MASTER.md` に分離する。
- Must: `.trash/.trash.json` は、削除時点の構成推測に必要な最小情報を 1 entry で読める形を維持する。
- Must Not: `.metadata.json` を asset index の代替として使わない。
- Must Not: Vault 内 asset を再コピーして二重登録しない。
- Must Not: generated asset を直接 `assets/` へ書き込んで正式登録済み扱いにしない。
- Must Not: renderer が trash move 後に delete 用の index 更新を二重実行しない。
- Must Not: `.index.json` / `.trash.json` を、内部都合の field 名や多重ネストで人間に読みづらくしない。
- Must Not: `.index.json` を timeline 完全復元の正本として案内しない。
- Must Not: cut audio / scene audio / group audio / timing clue を `.index.json` の現行保存契約として案内しない。

## 復元ポリシー
- 復元は次の順序で行う。
  1. `project.sdp`
  2. `.index.json`
  3. `.metadata.json`
  4. `.trash/.trash.json`
- `project.sdp` が破損している場合、アプリは「破損通知 + Vault確認導線」を優先する。
- `.index.json` は asset inventory / 実体解決の正本であり、scene/cut/timing の完全復元を単独で保証しない。
- `project.sdp` から `.index.json` を repair する場合は、inventory 全再生成を行わず、referenced asset entry の補修と `usageRefs` 再構成だけを許可する。
- readable な `.index.json` に含まれる未使用 inventory は、project ベース repair でも保持する。
- unreadable / invalid-schema な `.index.json` を上書き repair する場合は、unused inventory が失われ得るため confirm 前提で扱う。

## 正本ファイルの責務
- `.index.json`:
  - Asset識別と実体ファイル対応の正本。
  - 人間向けには「この asset がどこで使われていたか」を推測するための current summary として `usageRefs` を持つ。
  - repair は全再生成ではなく、referenced entry 補修と `usageRefs` 再構成に留める。
  - 保持情報例: assetId / filename / hash / type / importedAt / `usageRefs`
  - 現行 `usageRefs` は `sceneId` / `sceneName` / `sceneOrder` / `cutId` / `cutOrder` / `cutIndex` を持つ cut ベース summary。
  - cut audio / scene audio / group audio / timing clue を含む richer clue は現行保存契約ではなく、必要時は `docs/notes/index-trash-human-readable-plan-2026-03-12.md` を参照する。
  - 注意: `.index.json` 単独では group / notes / full timeline の完全復元は保証しない
- `.metadata.json`:
  - Asset/Scene の補助メタ情報を保持する。
  - 例: audio attachment / analysis / scene notes
- `.trash/.trash.json`:
  - 削除・退避の監査ログを保持する。
  - 現行 entry は `assetId` / `assetIds` / `originalPath` / `trashRelativePath` / `reason` / `originRefs` / `indexEntry` / `indexEntries` を保持しうる。
  - 人間向け読みやすさの改善や entry shape 整理は `docs/notes/index-trash-human-readable-plan-2026-03-12.md` と `docs/TODO_MASTER.md` で追跡する。

## 参照整合ルール
- Asset参照グラフは、cut参照と audio参照を一貫して追跡する。
- 参照中Assetは、参照チェックを通過した場合のみ削除可能とする。
- 削除時は「物理移動」「index更新」「参照掃除」を同一方針で実行する。
- 物理移動と index 更新の write 責務は同一 gateway 経路に集約し、renderer は返却結果に応じて metadata 掃除だけを続行する。
- 資産解決順は `assetId -> index -> filename` を正とする。
- `.index.json` の現行 `usageRefs` summary は、save 時に再構成される派生情報として扱う。
- `.trash/.trash.json` は削除時点の index snapshot を保持してよいが、読みやすさを損なう冗長 field は増やさない。

## 実装ルール
- formal register は finalize 経由のみとする。
- unregistered media の detect は read-only に留め、confirm 後のみ finalize で正式登録する。
- unregistered media の sync UI は auto prompt か explicit action のどちらでもよいが、write は confirm 後のみ行う。
- drag/import 系を含む新規 asset 追加経路は finalize を迂回してはならず、`assets/` 直書きや index 直接更新を行ってはならない。
- 生成アセットは hidden staging を経由し、assets/ に直接書き込んではならない。
- hidden staging は finalize 前の短命な領域であり、inventory として扱ったり UI に露出してはならない。
- hidden staging の stale ファイルは write/finalize のエントリポイントで best-effort に削除してよく、失敗は fatal にしてはならない。
- managed asset の at-rest filename は hash とし、UI 表示名は `originalName` から出す。
- `originalPath` は recovery clue として扱い、表示名の主経路にしない。
- Asset inventory UI は registered asset を主対象とし、`assets/` 直スキャンで pseudo asset を組み立てない。

## 境界ルール
- VaultGateway が担当:
  - index/trash の更新
  - import/register/trash move の書き込み責務
- main IPC が担当:
  - AssetPanel からの外部DnD開始時に `vault/assets` 配下かつ実在ファイルかを検証し、OSへファイル受け渡しを開始する。
- VaultGateway が担当しない:
  - export計画生成
  - preview制御
  - renderer内の表示ロジック

## 関連ガイド
- Export canonical flow の正本: `docs/guides/export.md`
- media I/O と queue 運用: `docs/guides/media-handling.md`
- Vault ingest policy: `docs/DECISIONS/ADR-0008-vault-ingest-finalize-policy.md`
- human-readable recovery clue の将来案: `docs/notes/index-trash-human-readable-plan-2026-03-12.md`
- store/UI/feature にじみ防止の移行計画: `docs/notes/archive/store-ui-feature-effects-migration-plan-implemented-2026-03-05.md`
- 詳細運用・経緯メモ: `docs/notes/`
