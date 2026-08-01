-- Reviews & ratings (after application completed)

-- Allow applications to be marked completed
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'accepted', 'rejected', 'completed'));

alter table public.profiles
  add column if not exists average_rating numeric(3, 2) not null default 0,
  add column if not exists review_count integer not null default 0;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reviewee_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id),
  unique (application_id, reviewer_id)
);

create index if not exists reviews_reviewee_id_idx on public.reviews (reviewee_id, created_at desc);
create index if not exists reviews_reviewer_id_idx on public.reviews (reviewer_id);
create index if not exists reviews_application_id_idx on public.reviews (application_id);

alter table public.reviews enable row level security;

-- Everyone can read reviews
drop policy if exists "Anyone can read reviews" on public.reviews;
create policy "Anyone can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

-- Only parties on a completed application can create a review (one per user via unique)
drop policy if exists "Participants can create reviews on completed apps" on public.reviews;
create policy "Participants can create reviews on completed apps"
  on public.reviews
  for insert
  to authenticated
  with check (
    auth.uid() = reviewer_id
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

-- No update / delete policies → immutable after submit

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

-- Keep profile aggregates in sync
create or replace function public.refresh_reviewee_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  avg_rating numeric(3, 2);
  cnt integer;
begin
  target := coalesce(new.reviewee_id, old.reviewee_id);
  select coalesce(avg(r.rating), 0)::numeric(3, 2), count(*)::integer
    into avg_rating, cnt
  from public.reviews r
  where r.reviewee_id = target;

  update public.profiles
  set average_rating = avg_rating,
      review_count = cnt
  where id = target;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or delete on public.reviews
  for each row
  execute function public.refresh_reviewee_rating();

-- Profile FKs so PostgREST can embed reviewer/reviewee profiles
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_reviewer_profile_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_reviewer_profile_fkey
      foreign key (reviewer_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_reviewee_profile_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_reviewee_profile_fkey
      foreign key (reviewee_id) references public.profiles (id) on delete cascade;
  end if;
end $$;
