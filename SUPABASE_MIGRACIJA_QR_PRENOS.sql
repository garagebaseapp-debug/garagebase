create table if not exists public.vehicle_transfers (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  car_id uuid references public.cars(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  mode text not null check (mode in ('verify', 'import')),
  consent boolean not null default false,
  payload jsonb not null,
  imported_at timestamptz,
  expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

alter table public.vehicle_transfers enable row level security;

drop policy if exists "transfer insert own" on public.vehicle_transfers;
create policy "transfer insert own" on public.vehicle_transfers
  for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "transfer read by token" on public.vehicle_transfers;
create policy "transfer read by token" on public.vehicle_transfers
  for select to authenticated
  using (expires_at is null or expires_at > now());

drop policy if exists "transfer update by token" on public.vehicle_transfers;
create policy "transfer update by token" on public.vehicle_transfers
  for update to authenticated
  using (expires_at is null or expires_at > now())
  with check (expires_at is null or expires_at > now());