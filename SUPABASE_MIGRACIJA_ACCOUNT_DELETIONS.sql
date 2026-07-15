-- GarageBase: minimalna evidenca izbrisanih profilov za admin pregled.
-- Ne hrani vsebine računa, vozil, računov ali polnega e-maila.

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email_hash text not null,
  email_preview text,
  car_count integer not null default 0,
  reason text,
  deleted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;

drop policy if exists "Admins can read account deletions" on public.account_deletions;
create policy "Admins can read account deletions"
on public.account_deletions
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists account_deletions_deleted_at_idx
on public.account_deletions (deleted_at desc);

create index if not exists account_deletions_email_hash_idx
on public.account_deletions (email_hash);

notify pgrst, 'reload schema';
