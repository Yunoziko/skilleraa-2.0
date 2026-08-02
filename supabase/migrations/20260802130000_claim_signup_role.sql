-- One-time student↔client claim after OAuth signup (no activity, within 24h)

create or replace function public.claim_signup_role(p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  app_count int;
  job_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('student', 'client') then
    raise exception 'Invalid role';
  end if;

  select * into row from public.profiles where id = uid;
  if row.id is null then
    raise exception 'Profile not found';
  end if;
  if row.role = p_role then
    return row;
  end if;
  if row.role = 'admin' then
    raise exception 'Admin role cannot be claimed';
  end if;
  if row.created_at < now() - interval '24 hours' then
    raise exception 'Signup role can only be claimed within 24 hours';
  end if;

  select count(*)::int into app_count from public.applications where freelancer_id = uid;
  select count(*)::int into job_count from public.jobs where client_id = uid;
  if app_count > 0 or job_count > 0 then
    raise exception 'Role cannot be changed after activity';
  end if;

  perform set_config('app.allow_role_claim', 'on', true);
  update public.profiles set role = p_role where id = uid returning * into row;
  return row;
end;
$$;

revoke all on function public.claim_signup_role(text) from public;
grant execute on function public.claim_signup_role(text) to authenticated;

create or replace function public.profiles_lock_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if coalesce(current_setting('app.allow_role_claim', true), '') = 'on'
       and new.role in ('student', 'client')
       and old.role in ('student', 'client') then
      null;
    else
      raise exception 'Profile role cannot be changed';
    end if;
  end if;
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only admins can change account status';
  end if;
  return new;
end;
$$;
