-- Profile file paths + Supabase Storage policies for resumes / portfolios

alter table public.profiles
  add column if not exists resume_url text,
  add column if not exists portfolio_url text;

-- Ensure private buckets exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolios',
  'portfolios',
  false,
  52428800,
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {auth.uid()}/filename
drop policy if exists "Users can upload own resumes" on storage.objects;
create policy "Users can upload own resumes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own resumes" on storage.objects;
create policy "Users can update own resumes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own resumes" on storage.objects;
create policy "Users can read own resumes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own resumes" on storage.objects;
create policy "Users can delete own resumes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own portfolios" on storage.objects;
create policy "Users can upload own portfolios"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own portfolios" on storage.objects;
create policy "Users can update own portfolios"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own portfolios" on storage.objects;
create policy "Users can read own portfolios"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own portfolios" on storage.objects;
create policy "Users can delete own portfolios"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
