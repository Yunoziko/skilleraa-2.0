-- Suspended users cannot update their own profile via Data API
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id and public.is_active_account())
  with check (auth.uid() = id and public.is_active_account() and role in ('student', 'client', 'admin'));
