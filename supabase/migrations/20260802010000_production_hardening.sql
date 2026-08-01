-- Production hardening: payments, roles, applications, chat, apply rules, storage

-- ========== 1) Payments: clients cannot forge paid ==========
drop policy if exists "Clients can create payments" on public.payments;
create policy "Clients can create payments"
  on public.payments
  for insert
  to authenticated
  with check (
    auth.uid() = client_id
    and status = 'pending'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_id
        and a.status in ('accepted', 'completed')
        and a.freelancer_id = freelancer_id
        and j.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can update own pending payments" on public.payments;
create policy "Clients can update own pending payments"
  on public.payments
  for update
  to authenticated
  using (auth.uid() = client_id and status = 'pending')
  with check (
    auth.uid() = client_id
    and status in ('pending', 'failed')
  );

create or replace function public.payments_block_client_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authenticated clients must not mark payments paid (service_role bypasses RLS; this still runs)
  if tg_op = 'UPDATE'
     and new.status = 'paid'
     and old.status is distinct from 'paid'
     and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'Payments can only be marked paid by the payment verifier';
  end if;
  if tg_op = 'INSERT'
     and new.status = 'paid'
     and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'Payments can only be marked paid by the payment verifier';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_block_client_paid on public.payments;
create trigger payments_block_client_paid
  before insert or update on public.payments
  for each row
  execute function public.payments_block_client_paid();

-- ========== 2) Lock profile.role after create ==========
create or replace function public.profiles_lock_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
  before update on public.profiles
  for each row
  execute function public.profiles_lock_role();

-- Do not overwrite role on signup conflict
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
    set full_name = excluded.full_name;
  return new;
end;
$$;

-- ========== 3) Restrict application updates (status only + transitions) ==========
create or replace function public.applications_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_id is distinct from old.job_id
     or new.freelancer_id is distinct from old.freelancer_id
     or new.proposal is distinct from old.proposal
     or new.bid_amount is distinct from old.bid_amount
     or new.estimated_days is distinct from old.estimated_days
     or new.created_at is distinct from old.created_at then
    raise exception 'Only application status can be updated';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    return new;
  end if;
  if old.status = 'accepted' and new.status = 'completed' then
    return new;
  end if;

  raise exception 'Invalid application status transition from % to %', old.status, new.status;
end;
$$;

drop trigger if exists applications_restrict_update on public.applications;
create trigger applications_restrict_update
  before update on public.applications
  for each row
  execute function public.applications_restrict_update();

-- Apply only to open jobs that the student does not own
drop policy if exists "Freelancers can create applications" on public.applications;
create policy "Freelancers can create applications"
  on public.applications
  for insert
  to authenticated
  with check (
    auth.uid() = freelancer_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'open'
        and j.client_id <> auth.uid()
    )
  );

-- ========== 4) Chat allowed for accepted or completed ==========
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
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

-- ========== 5) Clients can read applicant resume/portfolio objects ==========
drop policy if exists "Clients can read applicant resumes" on storage.objects;
create policy "Clients can read applicant resumes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where j.client_id = auth.uid()
        and (storage.foldername(name))[1] = a.freelancer_id::text
    )
  );

drop policy if exists "Clients can read applicant portfolios" on storage.objects;
create policy "Clients can read applicant portfolios"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'portfolios'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where j.client_id = auth.uid()
        and (storage.foldername(name))[1] = a.freelancer_id::text
    )
  );

revoke all on function public.payments_block_client_paid() from public, anon, authenticated;
revoke all on function public.profiles_lock_role() from public, anon, authenticated;
revoke all on function public.applications_restrict_update() from public, anon, authenticated;
