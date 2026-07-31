-- Skilleraa Jobs — complete SQL (profiles + jobs + RLS)
-- Already applied to project skilleraa (ntplmmiqdmbricrcksvg).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create extension if not exists "pgcrypto";

-- ========== profiles ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student'
    check (role in ('student', 'client')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ========== jobs ==========
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  budget text not null default '',
  category text not null default 'Other',
  skills text[] not null default '{}',
  location text not null default '',
  job_type text not null default 'remote'
    check (job_type in ('remote', 'onsite', 'hybrid')),
  duration text not null default '',
  experience text not null default 'Beginner',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_client_id_idx on public.jobs (client_id);
create index if not exists jobs_category_idx on public.jobs (category);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);
create index if not exists jobs_status_idx on public.jobs (status);

create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_jobs_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      ''
    ),
    case
      when coalesce(new.raw_user_meta_data ->> 'role', new.raw_user_meta_data ->> 'intended_role', '') = 'client'
        then 'client'
      else 'student'
    end,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    ''
  ),
  case
    when coalesce(u.raw_user_meta_data ->> 'role', u.raw_user_meta_data ->> 'intended_role', '') = 'client'
      then 'client'
    else 'student'
  end
from auth.users u
on conflict (id) do nothing;

-- ========== RLS ==========
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Anyone can read jobs" on public.jobs;
create policy "Anyone can read jobs"
  on public.jobs for select to anon, authenticated using (true);

drop policy if exists "Owners can create their own jobs" on public.jobs;
create policy "Owners can create their own jobs"
  on public.jobs for insert to authenticated
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client'
    )
  );

drop policy if exists "Owners can update their own jobs" on public.jobs;
create policy "Owners can update their own jobs"
  on public.jobs for update to authenticated
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

drop policy if exists "Owners can delete their own jobs" on public.jobs;
create policy "Owners can delete their own jobs"
  on public.jobs for delete to authenticated
  using (auth.uid() = client_id);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_jobs_updated_at() from public, anon, authenticated;
