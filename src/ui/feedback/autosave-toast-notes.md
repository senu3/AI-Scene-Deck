# Autosave Toast Notes

目的: autosave 失敗時のUI通知を後から安全に差し替えられるように、必要仕様を固定する。

## 現状の仮実装
- 発火: autosave の save が失敗したとき (1回のみ、成功でリセット)
- 表示: toast.error('Autosave failed', 'Please save manually.', { id: 'autosave-failed' })
- 重複抑止: toast ID 固定で上書き

## 置き換え時に必要な要件
- タイトル: ローカライズ可能な短文
- 説明: ユーザーの行動が明確になる文言 (例: 手動保存/再試行)
- 重複抑止: ID 固定 or エラー種別ごとのID
- 継続時間: error は長め or 手動dismiss (duration=0) の検討
- アクション: 「今すぐ保存」「再試行」などのCTAの導線
- オフライン/権限エラーなどの分類表示 (もし取得できるなら)

## 追加候補
- 保存成功時の軽いtoast (autosave success) を出すかは要検討
- 連続失敗時の間隔制御 (クールダウン)

## Feature Flag
- 環境変数: `VITE_DISABLE_AUTOSAVE=1`
- 参照箇所: `src/hooks/useHeaderProjectController.ts`
- 目的: CI/緊急時に autosave を止める kill switch
