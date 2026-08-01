-- Chat only after application is accepted

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
        and a.status = 'accepted'
        and (
          (a.freelancer_id = auth.uid() and receiver_id = j.client_id)
          or
          (j.client_id = auth.uid() and receiver_id = a.freelancer_id)
        )
    )
  );

-- Live UI updates when application status changes
do $$
begin
  alter publication supabase_realtime add table public.applications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.applications replica identity full;
