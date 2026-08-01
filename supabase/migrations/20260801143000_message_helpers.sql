-- Helpers for efficient conversation previews (security invoker + RLS)

create or replace function public.latest_messages_for_applications(app_ids uuid[])
returns setof public.messages
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.application_id) m.*
  from public.messages m
  where m.application_id = any (app_ids)
  order by m.application_id, m.created_at desc;
$$;

grant execute on function public.latest_messages_for_applications(uuid[]) to authenticated;
