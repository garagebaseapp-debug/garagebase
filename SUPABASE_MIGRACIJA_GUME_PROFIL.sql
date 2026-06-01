-- GarageBase tire tread measurements.
-- Run after SUPABASE_MIGRACIJA_GUME_MONTAZE.sql and SUPABASE_MIGRACIJA_GUME_OBSEG.sql.

create table if not exists public.tire_tread_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  tire_set_id uuid not null references public.tire_sets(id) on delete cascade,
  measured_at date not null default current_date,
  km integer not null default 0,
  tread_mm numeric(4,1),
  front_tread_mm numeric(4,1),
  rear_tread_mm numeric(4,1),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tire_tread_measurements_any_tread_check
    check (tread_mm is not null or front_tread_mm is not null or rear_tread_mm is not null)
);

create index if not exists tire_tread_measurements_user_car_idx
  on public.tire_tread_measurements(user_id, car_id, measured_at desc);

create index if not exists tire_tread_measurements_tire_set_idx
  on public.tire_tread_measurements(tire_set_id, measured_at desc, km desc);

drop trigger if exists tire_tread_measurements_set_updated_at on public.tire_tread_measurements;
create trigger tire_tread_measurements_set_updated_at
before update on public.tire_tread_measurements
for each row
execute function public.set_updated_at();

alter table public.tire_tread_measurements enable row level security;

drop policy if exists "tire_tread_measurements_select_own" on public.tire_tread_measurements;
create policy "tire_tread_measurements_select_own"
on public.tire_tread_measurements
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "tire_tread_measurements_insert_own" on public.tire_tread_measurements;
create policy "tire_tread_measurements_insert_own"
on public.tire_tread_measurements
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_tread_measurements.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_tread_measurements_update_own" on public.tire_tread_measurements;
create policy "tire_tread_measurements_update_own"
on public.tire_tread_measurements
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_tread_measurements.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_tread_measurements_delete_own" on public.tire_tread_measurements;
create policy "tire_tread_measurements_delete_own"
on public.tire_tread_measurements
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.tire_tread_measurements to authenticated;
grant select, insert, update, delete on public.tire_tread_measurements to service_role;
