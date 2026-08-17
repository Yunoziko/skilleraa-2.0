-- Seed confirmed demo Auth users for Skilleraa (run in Supabase SQL editor after restore).
-- Passwords match the Login page Demo buttons (public demo accounts).
-- Safe to re-run: skips if emails already exist.

do $$
declare
  uid uuid;
begin
  if not exists (select 1 from auth.users where email = 'student@skilleraa.com') then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'student@skilleraa.com', crypt('Student@1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Student","full_name":"Demo Student","role":"student"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'student@skilleraa.com', 'email_verified', true),
      'email', uid::text, now(), now(), now()
    );
    insert into public.profiles (id, full_name, role, status)
    values (uid, 'Demo Student', 'student', 'active')
    on conflict (id) do update
      set full_name = excluded.full_name, role = excluded.role, status = excluded.status;
  end if;

  if not exists (select 1 from auth.users where email = 'client@skilleraa.com') then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'client@skilleraa.com', crypt('Client@1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Client","full_name":"Demo Client","role":"client"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'client@skilleraa.com', 'email_verified', true),
      'email', uid::text, now(), now(), now()
    );
    insert into public.profiles (id, full_name, role, status)
    values (uid, 'Demo Client', 'client', 'active')
    on conflict (id) do update
      set full_name = excluded.full_name, role = excluded.role, status = excluded.status;
  end if;
end $$;
