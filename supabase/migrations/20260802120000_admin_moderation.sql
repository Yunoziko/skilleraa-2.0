-- Admin analytics & moderation

-- ========== Profiles: admin role + account status ==========
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'client', 'admin'));

alter table public.profiles
  add column if not exists status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended'));

-- Never create admin via signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url, status)
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
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    'active'
  )
  on conflict (id) do update
    set full_name = excluded.full_name;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Role immutable; status only changeable by admin
create or replace function public.profiles_lock_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed';
  end if;
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only admins can change account status';
  end if;
  return new;
end;
$$;

-- ========== Audit log ==========
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_admin());

grant select on public.admin_audit_logs to authenticated;

create or replace function public.admin_write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_details text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, ''));
end;
$$;

revoke all on function public.admin_write_audit(text, text, text, text) from public;
grant execute on function public.admin_write_audit(text, text, text, text) to authenticated;

-- ========== Admin read / moderate policies ==========
drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read all applications" on public.applications;
create policy "Admins can read all applications"
  on public.applications
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all payments" on public.payments;
create policy "Admins can read all payments"
  on public.payments
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete any job" on public.jobs;
create policy "Admins can delete any job"
  on public.jobs
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update any job" on public.jobs;
create policy "Admins can update any job"
  on public.jobs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete reviews" on public.reviews;
create policy "Admins can delete reviews"
  on public.reviews
  for delete
  to authenticated
  using (public.is_admin());

-- ========== Overview stats (single round-trip) ==========
create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*)::int from public.profiles where role in ('student', 'client')),
    'total_students', (select count(*)::int from public.profiles where role = 'student'),
    'total_clients', (select count(*)::int from public.profiles where role = 'client'),
    'total_jobs', (select count(*)::int from public.jobs),
    'total_applications', (select count(*)::int from public.applications),
    'total_payments', (select count(*)::int from public.payments where status = 'paid'),
    'total_revenue', coalesce((select sum(amount) from public.payments where status = 'paid'), 0),
    'suspended_users', (select count(*)::int from public.profiles where status = 'suspended'),
    'total_reviews', (select count(*)::int from public.reviews)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview_stats() from public;
grant execute on function public.admin_overview_stats() to authenticated;

-- ========== Weekly analytics (last 8 weeks) ==========
create or replace function public.admin_weekly_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  with weeks as (
    select generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    )::date as week_start
  ),
  users_w as (
    select date_trunc('week', created_at)::date as week_start, count(*)::int as n
    from public.profiles
    where role in ('student', 'client')
      and created_at >= date_trunc('week', now()) - interval '7 weeks'
    group by 1
  ),
  jobs_w as (
    select date_trunc('week', created_at)::date as week_start, count(*)::int as n
    from public.jobs
    where created_at >= date_trunc('week', now()) - interval '7 weeks'
    group by 1
  ),
  apps_w as (
    select date_trunc('week', created_at)::date as week_start, count(*)::int as n
    from public.applications
    where created_at >= date_trunc('week', now()) - interval '7 weeks'
    group by 1
  ),
  rev_w as (
    select date_trunc('week', created_at)::date as week_start, coalesce(sum(amount), 0)::numeric as n
    from public.payments
    where status = 'paid'
      and created_at >= date_trunc('week', now()) - interval '7 weeks'
    group by 1
  )
  select jsonb_build_object(
    'weeks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'week', to_char(w.week_start, 'Mon DD'),
          'week_start', w.week_start,
          'users', coalesce(u.n, 0),
          'jobs', coalesce(j.n, 0),
          'applications', coalesce(a.n, 0),
          'revenue', coalesce(r.n, 0)
        )
        order by w.week_start
      )
      from weeks w
      left join users_w u on u.week_start = w.week_start
      left join jobs_w j on j.week_start = w.week_start
      left join apps_w a on a.week_start = w.week_start
      left join rev_w r on r.week_start = w.week_start
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_weekly_analytics() from public;
grant execute on function public.admin_weekly_analytics() to authenticated;

-- ========== Admin actions ==========
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid status';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own status';
  end if;

  update public.profiles
  set status = p_status
  where id = p_user_id
    and role in ('student', 'client')
  returning * into row;

  if row.id is null then
    raise exception 'User not found';
  end if;

  perform public.admin_write_audit(
    case when p_status = 'suspended' then 'suspend_user' else 'reactivate_user' end,
    'user',
    p_user_id::text,
    row.full_name || ' → ' || p_status
  );

  return row;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

create or replace function public.admin_delete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  select title into t from public.jobs where id = p_job_id;
  if t is null then
    raise exception 'Job not found';
  end if;
  delete from public.jobs where id = p_job_id;
  perform public.admin_write_audit('delete_job', 'job', p_job_id::text, t);
end;
$$;

revoke all on function public.admin_delete_job(uuid) from public;
grant execute on function public.admin_delete_job(uuid) to authenticated;

create or replace function public.admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if not exists (select 1 from public.reviews where id = p_review_id) then
    raise exception 'Review not found';
  end if;
  delete from public.reviews where id = p_review_id;
  perform public.admin_write_audit('delete_review', 'review', p_review_id::text, 'Removed inappropriate review');
end;
$$;

revoke all on function public.admin_delete_review(uuid) from public;
grant execute on function public.admin_delete_review(uuid) to authenticated;
