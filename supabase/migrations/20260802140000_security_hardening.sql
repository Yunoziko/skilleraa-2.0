-- Security hardening: payments, profiles, storage, active-user gates, grants

-- ========== Active account helper ==========
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  );
$$;

revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

-- ========== Payments: client cannot insert/update (backend service_role only) ==========
drop policy if exists "Clients can create payments" on public.payments;
drop policy if exists "Clients can update own pending payments" on public.payments;

revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

-- Freeze payment fields if any authenticated update sneaks back
create or replace function public.payments_freeze_client_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if new.amount is distinct from old.amount
       or new.freelancer_id is distinct from old.freelancer_id
       or new.application_id is distinct from old.application_id
       or new.client_id is distinct from old.client_id
       or new.currency is distinct from old.currency
       or new.razorpay_order_id is distinct from old.razorpay_order_id then
      raise exception 'Payment fields are immutable';
    end if;
    if new.status = 'paid' then
      raise exception 'Payments can only be marked paid by the payment verifier';
    end if;
    if new.status not in ('pending', 'failed') then
      raise exception 'Invalid payment status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_freeze_client_fields on public.payments;
create trigger payments_freeze_client_fields
  before update on public.payments
  for each row
  execute function public.payments_freeze_client_fields();

revoke all on function public.payments_freeze_client_fields() from public, anon, authenticated;

-- ========== Profiles: no self-admin, lock aggregates ==========
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and role in ('student', 'client')
    and status = 'active'
  );

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin() and role in ('student', 'client'))
  with check (public.is_admin() and role in ('student', 'client'));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id and public.is_active_account())
  with check (auth.uid() = id and public.is_active_account() and role in ('student', 'client', 'admin'));

create or replace function public.profiles_lock_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_admin() then
    if new.average_rating is distinct from old.average_rating
       or new.review_count is distinct from old.review_count then
      raise exception 'Rating fields are system-managed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_sensitive_columns on public.profiles;
create trigger profiles_lock_sensitive_columns
  before update on public.profiles
  for each row
  execute function public.profiles_lock_sensitive_columns();

revoke all on function public.profiles_lock_sensitive_columns() from public, anon, authenticated;

-- Anon: only non-sensitive columns (no resume/portfolio paths, no status)
revoke select on public.profiles from anon;
grant select (id, full_name, role, avatar_url, average_rating, review_count, created_at)
  on public.profiles to anon;
grant select on public.profiles to authenticated;

-- Jobs: anon only open listings
drop policy if exists "Anyone can read jobs" on public.jobs;
drop policy if exists "Public can read open jobs" on public.jobs;
drop policy if exists "Authenticated can read jobs" on public.jobs;
create policy "Public can read open jobs"
  on public.jobs for select to anon
  using (status = 'open');
create policy "Authenticated can read jobs"
  on public.jobs for select to authenticated
  using (true);

-- ========== Suspended users blocked from mutations ==========
drop policy if exists "Owners can create their own jobs" on public.jobs;
create policy "Owners can create their own jobs"
  on public.jobs for insert to authenticated
  with check (
    auth.uid() = client_id
    and public.is_active_account()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'client')
  );

drop policy if exists "Owners can update their own jobs" on public.jobs;
create policy "Owners can update their own jobs"
  on public.jobs for update to authenticated
  using (auth.uid() = client_id and public.is_active_account())
  with check (auth.uid() = client_id and public.is_active_account());

drop policy if exists "Freelancers can create applications" on public.applications;
create policy "Freelancers can create applications"
  on public.applications for insert to authenticated
  with check (
    auth.uid() = freelancer_id
    and public.is_active_account()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status = 'open' and j.client_id <> auth.uid()
    )
  );

drop policy if exists "Job owners can update application status" on public.applications;
create policy "Job owners can update application status"
  on public.applications for update to authenticated
  using (
    public.is_active_account()
    and exists (select 1 from public.jobs j where j.id = applications.job_id and j.client_id = auth.uid())
  )
  with check (
    public.is_active_account()
    and exists (select 1 from public.jobs j where j.id = applications.job_id and j.client_id = auth.uid())
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_active_account()
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_id
        and a.status in ('accepted', 'completed')
        and (
          (a.freelancer_id = auth.uid() and receiver_id = j.client_id)
          or
          (j.client_id = auth.uid() and receiver_id = a.freelancer_id)
        )
    )
  );

drop policy if exists "Participants can create reviews on completed apps" on public.reviews;
create policy "Participants can create reviews on completed apps"
  on public.reviews for insert to authenticated
  with check (
    auth.uid() = reviewer_id
    and public.is_active_account()
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_id
        and a.status = 'completed'
        and (
          (auth.uid() = j.client_id and reviewee_id = a.freelancer_id)
          or
          (auth.uid() = a.freelancer_id and reviewee_id = j.client_id)
        )
    )
  );

-- ========== Storage: only pending/accepted/completed apps; match profile path ==========
drop policy if exists "Clients can read applicant resumes" on storage.objects;
create policy "Clients can read applicant resumes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and public.is_active_account()
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.profiles p on p.id = a.freelancer_id
      where j.client_id = auth.uid()
        and a.status in ('pending', 'accepted', 'completed')
        and (storage.foldername(name))[1] = a.freelancer_id::text
        and p.resume_url = ('resumes/' || name)
    )
  );

drop policy if exists "Clients can read applicant portfolios" on storage.objects;
create policy "Clients can read applicant portfolios"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portfolios'
    and public.is_active_account()
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.profiles p on p.id = a.freelancer_id
      where j.client_id = auth.uid()
        and a.status in ('pending', 'accepted', 'completed')
        and (storage.foldername(name))[1] = a.freelancer_id::text
        and p.portfolio_url = ('portfolios/' || name)
    )
  );

-- Own storage uploads require active account
drop policy if exists "Users can upload own resumes" on storage.objects;
create policy "Users can upload own resumes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and public.is_active_account()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own portfolios" on storage.objects;
create policy "Users can upload own portfolios"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolios'
    and public.is_active_account()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== Harden messages trigger search_path ==========
create or replace function public.messages_prevent_content_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message is distinct from old.message
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.application_id is distinct from old.application_id then
    raise exception 'Message content cannot be edited';
  end if;
  return new;
end;
$$;

revoke all on function public.messages_prevent_content_edit() from public, anon, authenticated;

-- ========== Revoke anon EXECUTE on privileged RPCs ==========
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.admin_overview_stats() from public, anon;
grant execute on function public.admin_overview_stats() to authenticated;

revoke all on function public.admin_weekly_analytics() from public, anon;
grant execute on function public.admin_weekly_analytics() to authenticated;

revoke all on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

revoke all on function public.admin_delete_job(uuid) from public, anon;
grant execute on function public.admin_delete_job(uuid) to authenticated;

revoke all on function public.admin_delete_review(uuid) from public, anon;
grant execute on function public.admin_delete_review(uuid) to authenticated;

revoke all on function public.admin_write_audit(text, text, text, text) from public, anon;
grant execute on function public.admin_write_audit(text, text, text, text) to authenticated;

revoke all on function public.claim_signup_role(text) from public, anon;
grant execute on function public.claim_signup_role(text) to authenticated;

revoke all on function public.ensure_wallet_for_user() from public, anon, authenticated;
revoke all on function public.refresh_reviewee_rating() from public, anon, authenticated;
revoke all on function public.payments_block_client_paid() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
