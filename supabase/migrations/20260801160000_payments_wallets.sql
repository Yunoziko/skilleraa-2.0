-- Skilleraa Razorpay payments + wallets

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  freelancer_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  unique (application_id)
);

create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists payments_freelancer_id_idx on public.payments (freelancer_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_razorpay_order_id_idx on public.payments (razorpay_order_id);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  available_balance numeric(12, 2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(12, 2) not null default 0 check (pending_balance >= 0),
  lifetime_earnings numeric(12, 2) not null default 0 check (lifetime_earnings >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('credit', 'debit')),
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_id_idx
  on public.wallet_transactions (wallet_id, created_at desc);

-- Auto-create wallet for new profiles
create or replace function public.ensure_wallet_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_wallet on public.profiles;
create trigger profiles_ensure_wallet
  after insert on public.profiles
  for each row
  execute function public.ensure_wallet_for_user();

-- Backfill wallets for existing profiles
insert into public.wallets (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

alter table public.payments enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- Payments: client creates (pending orders); parties can read
drop policy if exists "Clients can create payments" on public.payments;
create policy "Clients can create payments"
  on public.payments
  for insert
  to authenticated
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_id
        and a.status = 'accepted'
        and a.freelancer_id = freelancer_id
        and j.client_id = auth.uid()
    )
  );

drop policy if exists "Payment parties can read payments" on public.payments;
create policy "Payment parties can read payments"
  on public.payments
  for select
  to authenticated
  using (
    auth.uid() = client_id
    or auth.uid() = freelancer_id
  );

-- Clients may mark their own pending payment failed (cancel); paid updates via service role
drop policy if exists "Clients can update own pending payments" on public.payments;
create policy "Clients can update own pending payments"
  on public.payments
  for update
  to authenticated
  using (auth.uid() = client_id and status = 'pending')
  with check (auth.uid() = client_id);

-- Wallets: owner read only
drop policy if exists "Users can read own wallet" on public.wallets;
create policy "Users can read own wallet"
  on public.wallets
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Wallet transactions: owner read only
drop policy if exists "Users can read own wallet transactions" on public.wallet_transactions;
create policy "Users can read own wallet transactions"
  on public.wallet_transactions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

grant select, insert, update on public.payments to authenticated;
grant select on public.wallets to authenticated;
grant select on public.wallet_transactions to authenticated;
