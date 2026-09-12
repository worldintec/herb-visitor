-- マイノート（visitor_notes）を「端末」ではなく「アカウント」に紐づけるための変更。
--
-- 従来は localStorage に保存したランダムUUID（session_id）で絞り込んでいたため、
--   ・同じIDでログインしても別端末・別ブラウザからは過去の記録が見えない
--   ・同じブラウザを別アカウントで使うと記録が混ざる
-- という、ログイン必須の設計と矛盾した状態になっていた。
--
-- user_id を追加し、アプリ側の絞り込みを user_id に切り替える。
-- session_id 列は互換のため残す（アプリは引き続き両方を書き込む）。

alter table public.visitor_notes
  add column if not exists user_id uuid references public.users(id) on delete cascade;

-- 一覧取得は user_id での絞り込み＋created_at の降順で行うため、複合インデックスを張る
create index if not exists visitor_notes_user_id_created_at_idx
  on public.visitor_notes (user_id, created_at desc);

-- 注意: visitor_notes は現在 anon キーから直接読み書きできる状態のため、
--       user_id による絞り込みはクライアント側のフィルタにとどまり、
--       他人の記録の閲覧を防ぐ保証にはならない。
--       恒久対応には RLS の有効化とサーバー経由（service_role）への移行が必要。
