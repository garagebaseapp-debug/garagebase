-- GarageBase - evidenca gum po vozilu
-- Zaženi v Supabase SQL editorju v pravem projektu.

create table if not exists public.tire_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  season text not null check (season in ('summer', 'winter', 'all_season')),
  brand text,
  model text,
  size text,
  dot text,
  tread_depth_mm numeric(4,1),
  purchase_date date,
  installed_at date,
  installed_km integer,
  removed_at date,
  removed_km integer,
  next_change_date date,
  remind_days_before integer not null default 7,
  total_km integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tire_sets_user_car_status_idx
  on public.tire_sets(user_id, car_id, status);

create index if not exists tire_sets_car_status_idx
  on public.tire_sets(car_id, status);

create index if not exists tire_sets_next_change_date_idx
  on public.tire_sets(next_change_date)
  where next_change_date is not null and status = 'active';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tire_sets_set_updated_at on public.tire_sets;
create trigger tire_sets_set_updated_at
before update on public.tire_sets
for each row
execute function public.set_updated_at();

alter table public.tire_sets enable row level security;

drop policy if exists "tire_sets_select_own" on public.tire_sets;
create policy "tire_sets_select_own"
on public.tire_sets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "tire_sets_insert_own" on public.tire_sets;
create policy "tire_sets_insert_own"
on public.tire_sets
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_sets.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_sets_update_own" on public.tire_sets;
create policy "tire_sets_update_own"
on public.tire_sets
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_sets.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_sets_delete_own" on public.tire_sets;
create policy "tire_sets_delete_own"
on public.tire_sets
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.tire_sets to authenticated;
grant select, insert, update, delete on public.tire_sets to service_role;
