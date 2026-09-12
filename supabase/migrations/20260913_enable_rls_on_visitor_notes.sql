-- マイノート（visitor_notes）を anon キーから直接読み書きできない状態にする。
--
-- user_id での紐づけ後、anon キーで全件取得すると「どのアカウントの記録か」まで
-- 特定できる状態になっていた。読み書きはすべて /api/visitor-notes 配下の
-- Route Handler（service_role キー＋セッション検証）を経由させる。
--
-- 適用順の注意: 先にサーバー経由へ移行したコードを本番反映し、
--               動作確認が取れてからこのマイグレーションを適用すること。
--               （コードより先に適用すると、マイノートが読めなくなる）

alter table public.visitor_notes enable row level security;

drop policy if exists "Allow all on visitor_notes" on public.visitor_notes;
drop policy if exists "service_role only" on public.visitor_notes;

-- service_role は RLS を bypass するため、全拒否のポリシーだけを置く。
-- anon / authenticated からの読み書きはすべて遮断される。
create policy "service_role only"
  on public.visitor_notes
  for all
  to public
  using (false)
  with check (false);
