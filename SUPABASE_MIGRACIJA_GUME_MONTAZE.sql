-- GarageBase tire season storage + mount history
-- Run this after SUPABASE_MIGRACIJA_GUME.sql in the real Supabase project.

alter table public.tire_sets
  add column if not exists last_mounted_at date,
  add column if not exists last_mounted_km integer;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'tire_sets'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.tire_sets drop constraint if exists %I', constraint_name);
  end loop;
end $$;

update public.tire_sets
set status = case
  when status = 'active' then 'mounted'
  when status = 'archived' then 'retired'
  else status
end
where status in ('active', 'archived');

alter table public.tire_sets
  alter column status set default 'mounted',
  add constraint tire_sets_status_check
    check (status in ('mounted', 'stored', 'retired'));

update public.tire_sets
set
  last_mounted_at = coalesce(last_mounted_at, installed_at),
  last_mounted_km = coalesce(last_mounted_km, installed_km)
where installed_at is not null or installed_km is not null;

create table if not exists public.tire_mounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  tire_set_id uuid not null references public.tire_sets(id) on delete cascade,
  mounted_at date not null,
  mounted_km integer not null default 0,
  removed_at date,
  removed_km integer,
  km_driven integer generated always as (
    case
      when removed_km is not null then greatest(0, removed_km - mounted_km)
      else null
    end
  ) stored,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tire_mounts_user_car_idx
  on public.tire_mounts(user_id, car_id);

create index if not exists tire_mounts_tire_set_idx
  on public.tire_mounts(tire_set_id, mounted_at desc);

create index if not exists tire_mounts_open_idx
  on public.tire_mounts(car_id, tire_set_id)
  where removed_at is null;

create unique index if not exists tire_mounts_unique_start_idx
  on public.tire_mounts(tire_set_id, mounted_at, mounted_km);

drop trigger if exists tire_mounts_set_updated_at on public.tire_mounts;
create trigger tire_mounts_set_updated_at
before update on public.tire_mounts
for each row
execute function public.set_updated_at();

alter table public.tire_mounts enable row level security;

drop policy if exists "tire_mounts_select_own" on public.tire_mounts;
create policy "tire_mounts_select_own"
on public.tire_mounts
for select
using (auth.uid() = user_id);

drop policy if exists "tire_mounts_insert_own" on public.tire_mounts;
create policy "tire_mounts_insert_own"
on public.tire_mounts
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_mounts.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_mounts_update_own" on public.tire_mounts;
create policy "tire_mounts_update_own"
on public.tire_mounts
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cars
    where cars.id = tire_mounts.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "tire_mounts_delete_own" on public.tire_mounts;
create policy "tire_mounts_delete_own"
on public.tire_mounts
for delete
using (auth.uid() = user_id);

insert into public.tire_mounts (
  user_id,
  car_id,
  tire_set_id,
  mounted_at,
  mounted_km,
  removed_at,
  removed_km
)
select
  tire_sets.user_id,
  tire_sets.car_id,
  tire_sets.id,
  coalesce(tire_sets.installed_at, tire_sets.created_at::date, current_date),
  coalesce(tire_sets.installed_km, 0),
  tire_sets.removed_at,
  tire_sets.removed_km
from public.tire_sets
where not exists (
  select 1
  from public.tire_mounts
  where tire_mounts.tire_set_id = tire_sets.id
);

grant select, insert, update, delete on public.tire_mounts to authenticated;
grant select, insert, update, delete on public.tire_mounts to service_role;
