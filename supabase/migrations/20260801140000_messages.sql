-- Skilleraa Real-Time Chat
-- Messages tied to applications + RLS + Realtime

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(trim(message)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> receiver_id)
);

create index if not exists messages_application_id_created_at_idx
  on public.messages (application_id, created_at asc);
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, created_at desc)
  where read_at is null;
create index if not exists messages_sender_id_idx on public.messages (sender_id);

alter table public.messages enable row level security;

-- Only sender and receiver can read
drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
  on public.messages
  for select
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
  );

-- Only sender can insert; must be application participant; receiver is the other party
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
        and (
          (a.freelancer_id = auth.uid() and receiver_id = j.client_id)
          or
          (j.client_id = auth.uid() and receiver_id = a.freelancer_id)
        )
    )
  );

-- Receivers (and senders) may update only their side for read receipts.
-- Column-level guard prevents editing message body / parties.
drop policy if exists "Participants can update read status" on public.messages;
create policy "Participants can update read status"
  on public.messages
  for update
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
  )
  with check (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
  );

create or replace function public.messages_prevent_content_edit()
returns trigger
language plpgsql
as $$
begin
  if new.application_id is distinct from old.application_id
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at can be updated on messages';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_prevent_content_edit on public.messages;
create trigger messages_prevent_content_edit
  before update on public.messages
  for each row
  execute function public.messages_prevent_content_edit();

grant select, insert, update on public.messages to authenticated;

-- Realtime: participants subscribe; RLS filters events to sender/receiver
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.messages replica identity full;
