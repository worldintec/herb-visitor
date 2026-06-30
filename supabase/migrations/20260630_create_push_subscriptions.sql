create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- サーバーサイド（service_role）からのみ読み書き可能。
-- クライアントから直接アクセスさせない。
create policy "service_role only"
  on public.push_subscriptions
  using (false)
  with check (false);
