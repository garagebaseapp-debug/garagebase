-- GarageBase mileage events + vehicle ownership cost fields.
-- Run this in Supabase before relying on exact mileage audit and ownership cost statistics.

alter table public.cars
  add column if not exists purchase_price numeric,
  add column if not exists down_payment numeric,
  add column if not exists finance_total_paid numeric,
  add column if not exists finance_overpayment numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists resale_value numeric,
  add column if not exists include_vehicle_price_in_costs boolean not null default false;

create table if not exists public.vehicle_mileage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  event_type text not null check (event_type in ('fuel', 'service', 'expense', 'tire_mount', 'tire_remove', 'manual', 'import')),
  source_table text,
  source_id uuid,
  event_date date not null,
  km integer not null,
  previous_known_km integer,
  entry_timing text not null default 'normal' check (entry_timing in ('normal', 'backfilled', 'corrected', 'imported')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists vehicle_mileage_events_car_date_idx
  on public.vehicle_mileage_events(car_id, event_date desc, km desc);

create index if not exists vehicle_mileage_events_user_car_idx
  on public.vehicle_mileage_events(user_id, car_id);

create unique index if not exists vehicle_mileage_events_source_idx
  on public.vehicle_mileage_events(source_table, source_id, event_type)
  where source_table is not null and source_id is not null;

drop trigger if exists vehicle_mileage_events_set_updated_at on public.vehicle_mileage_events;
create trigger vehicle_mileage_events_set_updated_at
before update on public.vehicle_mileage_events
for each row
execute function public.set_updated_at();

alter table public.vehicle_mileage_events enable row level security;

drop policy if exists "vehicle_mileage_events_select_own" on public.vehicle_mileage_events;
create policy "vehicle_mileage_events_select_own"
on public.vehicle_mileage_events
for select
using (auth.uid() = user_id);

drop policy if exists "vehicle_mileage_events_insert_own" on public.vehicle_mileage_events;
create policy "vehicle_mileage_events_insert_own"
on public.vehicle_mileage_events
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = vehicle_mileage_events.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "vehicle_mileage_events_update_own" on public.vehicle_mileage_events;
create policy "vehicle_mileage_events_update_own"
on public.vehicle_mileage_events
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = vehicle_mileage_events.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "vehicle_mileage_events_delete_own" on public.vehicle_mileage_events;
create policy "vehicle_mileage_events_delete_own"
on public.vehicle_mileage_events
for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on public.vehicle_mileage_events to authenticated;
grant select, insert, update, delete on public.vehicle_mileage_events to service_role;
