-- Tighten default grants: anon must not mutate money/auth-adjacent tables
revoke all on table public.payments from anon;
grant select on table public.payments to authenticated;
revoke insert, update, delete, truncate on table public.payments from authenticated;

revoke all on table public.wallets from anon;
revoke insert, update, delete, truncate on table public.wallets from authenticated;
grant select on table public.wallets to authenticated;

revoke all on table public.wallet_transactions from anon;
revoke insert, update, delete, truncate on table public.wallet_transactions from authenticated;
grant select on table public.wallet_transactions to authenticated;

revoke all on table public.admin_audit_logs from anon;
revoke insert, update, delete, truncate on table public.admin_audit_logs from authenticated;
grant select on table public.admin_audit_logs to authenticated;

revoke insert, update, delete, truncate on table public.reviews from anon;
revoke insert, update, delete, truncate on table public.messages from anon;
revoke insert, update, delete, truncate on table public.applications from anon;
revoke insert, update, delete, truncate on table public.jobs from anon;
