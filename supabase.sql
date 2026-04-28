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

-- 자신의 row만 삭제(계정 삭제 시 데이터 삭제용)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_user_states' and policyname = 'todox_delete_own'
  ) then
    create policy todox_delete_own
      on public.todox_user_states
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists todox_user_states_updated_at_idx
  on public.todox_user_states (updated_at desc);

-- 푸시 디바이스 토큰(웹/안드/iOS)
create table if not exists public.todox_push_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('web', 'android', 'ios')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists todox_push_devices_user_idx
  on public.todox_push_devices (user_id);

alter table public.todox_push_devices enable row level security;

-- 자신의 디바이스만 읽기/쓰기/삭제
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_push_devices' and policyname = 'todox_push_devices_select_own'
  ) then
    create policy todox_push_devices_select_own
      on public.todox_push_devices
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_push_devices' and policyname = 'todox_push_devices_insert_own'
  ) then
    create policy todox_push_devices_insert_own
      on public.todox_push_devices
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_push_devices' and policyname = 'todox_push_devices_update_own'
  ) then
    create policy todox_push_devices_update_own
      on public.todox_push_devices
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_push_devices' and policyname = 'todox_push_devices_delete_own'
  ) then
    create policy todox_push_devices_delete_own
      on public.todox_push_devices
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- 중복 발송 방지(dedupe)
create table if not exists public.todox_push_dedup (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  fire_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, fire_at)
);

create index if not exists todox_push_dedup_user_fire_idx
  on public.todox_push_dedup (user_id, fire_at desc);

alter table public.todox_push_dedup enable row level security;

-- dedup은 기본적으로 서버(서비스 롤)에서만 쓰는 용도. 유저는 읽기만 허용(디버그/투명성)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'todox_push_dedup' and policyname = 'todox_push_dedup_select_own'
  ) then
    create policy todox_push_dedup_select_own
      on public.todox_push_dedup
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

