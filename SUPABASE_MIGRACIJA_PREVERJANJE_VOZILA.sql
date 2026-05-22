-- GarageBase javno preverjanje vozila po VIN/sasiji z izrecno privolitvijo lastnika.
-- Zaženi v Supabase SQL editorju.

create table if not exists public.vehicle_public_registry (
  car_id uuid primary key references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vin_hash text,
  vin_last4 text,
  enabled boolean not null default false,
  visibility jsonb not null default '{"showPlate":false,"showMileage":true,"showServiceSummary":true,"showCostSummary":false,"showDocuments":false}'::jsonb,
  consent_version text not null,
  consent_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_public_registry enable row level security;

drop policy if exists "Users can read own vehicle registry consent" on public.vehicle_public_registry;
create policy "Users can read own vehicle registry consent"
on public.vehicle_public_registry
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can manage own vehicle registry consent" on public.vehicle_public_registry;
create policy "Users can manage own vehicle registry consent"
on public.vehicle_public_registry
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Admins can read vehicle registry consent" on public.vehicle_public_registry;
create policy "Admins can read vehicle registry consent"
on public.vehicle_public_registry
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.email = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create index if not exists vehicle_public_registry_vin_hash_idx
on public.vehicle_public_registry (vin_hash)
where enabled = true and revoked_at is null;

create index if not exists vehicle_public_registry_user_updated_idx
on public.vehicle_public_registry (user_id, updated_at desc);

create table if not exists public.vehicle_public_registry_events (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references public.cars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_enabled boolean,
  next_enabled boolean,
  previous_visibility jsonb,
  next_visibility jsonb,
  consent_version text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.vehicle_public_registry_events enable row level security;

drop policy if exists "Admins can read vehicle registry events" on public.vehicle_public_registry_events;
create policy "Admins can read vehicle registry events"
on public.vehicle_public_registry_events
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.email = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Users can read own vehicle registry events" on public.vehicle_public_registry_events;
create policy "Users can read own vehicle registry events"
on public.vehicle_public_registry_events
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists vehicle_public_registry_events_car_created_idx
on public.vehicle_public_registry_events (car_id, created_at desc);

create table if not exists public.vehicle_public_registry_lookups (
  id uuid primary key default gen_random_uuid(),
  vin_hash text not null,
  found boolean not null default false,
  matched_car_id uuid references public.cars(id) on delete set null,
  lookup_ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.vehicle_public_registry_lookups enable row level security;

drop policy if exists "Admins can read vehicle registry lookups" on public.vehicle_public_registry_lookups;
create policy "Admins can read vehicle registry lookups"
on public.vehicle_public_registry_lookups
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.email = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create index if not exists vehicle_public_registry_lookups_created_idx
on public.vehicle_public_registry_lookups (created_at desc);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.vehicle_public_registry to authenticated, service_role;
grant select, insert on public.vehicle_public_registry_events to authenticated, service_role;
grant select, insert on public.vehicle_public_registry_lookups to service_role;

notify pgrst, 'reload schema';
