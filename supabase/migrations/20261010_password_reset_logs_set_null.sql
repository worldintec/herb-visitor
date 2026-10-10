-- supabase/migrations/20261010_password_reset_logs_set_null.sql
-- 来園者が自分で退会できるようにするため、利用者の削除で再設定ログが
-- 削除を妨げないようにする。
-- 誰に対する再設定かは失われるが、いつ・どの職員が行ったかは残る。

ALTER TABLE password_reset_logs
  ALTER COLUMN target_user_id DROP NOT NULL;

ALTER TABLE password_reset_logs
  DROP CONSTRAINT password_reset_logs_target_user_id_fkey;

ALTER TABLE password_reset_logs
  ADD CONSTRAINT password_reset_logs_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
