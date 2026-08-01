-- Skilleraa Applications
-- Freelancer applications to jobs + RLS

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  -- Same UUID as auth.users / profiles.id
  freelancer_id uuid not null references auth.users (id) on delete cascade,
  proposal text not null default '',
  bid_amount numeric(12, 2) not null default 0,
  estimated_days integer not null default 1
    check (estimated_days > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (job_id, freelancer_id)
);

-- Allow PostgREST embeds: applications.freelancer_id -> profiles
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_freelancer_profile_fkey'
  ) then
    alter table public.applications
      add constraint applications_freelancer_profile_fkey
      foreign key (freelancer_id) references public.profiles (id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_freelancer_id_idx on public.applications (freelancer_id);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_created_at_idx on public.applications (created_at desc);

alter table public.applications enable row level security;

-- Freelancers create applications for themselves
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
  );

-- Freelancers view own applications
drop policy if exists "Freelancers can view own applications" on public.applications;
create policy "Freelancers can view own applications"
  on public.applications
  for select
  to authenticated
  using (auth.uid() = freelancer_id);

-- Clients view applications on jobs they own
drop policy if exists "Clients can view applications on own jobs" on public.applications;
create policy "Clients can view applications on own jobs"
  on public.applications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.client_id = auth.uid()
    )
  );

-- Only job owner can update status (accept / reject)
drop policy if exists "Job owners can update application status" on public.applications;
create policy "Job owners can update application status"
  on public.applications
  for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.client_id = auth.uid()
    )
  );

grant select, insert, update on public.applications to authenticated;
