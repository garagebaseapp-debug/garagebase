-- GarageBase tire scope and axle position.
-- Run after SUPABASE_MIGRACIJA_GUME_MONTAZE.sql.

alter table public.tire_sets
  add column if not exists tire_scope text not null default 'full_set';

alter table public.tire_mounts
  add column if not exists axle_position text not null default 'all';

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
      and pg_get_constraintdef(con.oid) ilike '%tire_scope%'
  loop
    execute format('alter table public.tire_sets drop constraint if exists %I', constraint_name);
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'tire_mounts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%axle_position%'
  loop
    execute format('alter table public.tire_mounts drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.tire_sets
  add constraint tire_sets_tire_scope_check
    check (tire_scope in ('full_set', 'front_pair', 'rear_pair'));

alter table public.tire_mounts
  add constraint tire_mounts_axle_position_check
    check (axle_position in ('all', 'front', 'rear'));

update public.tire_sets
set tire_scope = 'full_set'
where tire_scope is null or tire_scope = '';

update public.tire_mounts
set axle_position = 'all'
where axle_position is null or axle_position = '';

create index if not exists tire_sets_scope_idx
  on public.tire_sets(car_id, tire_scope, status);

create index if not exists tire_mounts_axle_position_idx
  on public.tire_mounts(tire_set_id, axle_position);
