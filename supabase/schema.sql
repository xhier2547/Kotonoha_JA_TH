-- Kotonoha Studio (言の葉スタジオ) — Supabase Schema & RLS Setup
-- Run this script once inside Supabase Dashboard -> SQL Editor

-- 1. Public user profiles linked 1:1 with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner',
  learner_level text not null default 'N5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2. Cloud sync table holding all 10 Dexie learning tables as a versioned JSONB snapshot
create table if not exists public.user_study_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_study_data enable row level security;

drop policy if exists "Users can read own study data" on public.user_study_data;
create policy "Users can read own study data"
  on public.user_study_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own study data" on public.user_study_data;
create policy "Users can insert own study data"
  on public.user_study_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own study data" on public.user_study_data;
create policy "Users can update own study data"
  on public.user_study_data for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own study data" on public.user_study_data;
create policy "Users can delete own study data"
  on public.user_study_data for delete
  using (auth.uid() = user_id);

-- 3. Auto-create profile row when a new user registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Learner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
