-- Saved jobs (replaces Mongo saved_jobs collection)

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, job_id)
);

create index if not exists saved_jobs_student_id_idx on public.saved_jobs (student_id);
create index if not exists saved_jobs_job_id_idx on public.saved_jobs (job_id);

alter table public.saved_jobs enable row level security;

drop policy if exists "Students manage own saved jobs" on public.saved_jobs;
create policy "Students manage own saved jobs"
  on public.saved_jobs
  for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

grant select, insert, delete on public.saved_jobs to authenticated;
