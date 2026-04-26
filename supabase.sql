-- Supabase SQL Editor에서 실행하세요.
-- 이 버전은 supabase-js + 익명 로그인(auth) + RLS 정책을 사용합니다.
-- 전제: Supabase Auth에서 "Anonymous sign-ins"를 활성화하세요.

create table if not exists public.todox_user_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.todox_user_states enable row level security;

-- 자신의 row만 읽기
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_user_states' and policyname = 'todox_select_own'
  ) then
    create policy todox_select_own
      on public.todox_user_states
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- 자신의 row만 upsert(= insert/update)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_user_states' and policyname = 'todox_insert_own'
  ) then
    create policy todox_insert_own
      on public.todox_user_states
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_user_states' and policyname = 'todox_update_own'
  ) then
    create policy todox_update_own
      on public.todox_user_states
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists todox_user_states_updated_at_idx
  on public.todox_user_states (updated_at desc);

