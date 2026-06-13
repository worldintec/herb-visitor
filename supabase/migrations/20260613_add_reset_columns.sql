-- パスワード再設定フロー用カラム追加
-- users テーブルに以下のカラムを追加してください

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reset_email TEXT;

-- reset_token はユニークである必要があるため、インデックスを追加
CREATE UNIQUE INDEX IF NOT EXISTS users_reset_token_idx
  ON users (reset_token)
  WHERE reset_token IS NOT NULL;
