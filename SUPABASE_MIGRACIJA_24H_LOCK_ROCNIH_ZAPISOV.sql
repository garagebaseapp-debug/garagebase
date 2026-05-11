-- GarageBase: stroga 24h zascita rocno vnesenih zapisov v bazi.
-- Uvozeni zapisi ostanejo popravljivi/brisljivi, rocni zapisi pa samo prvih 24 ur.
-- Run in Supabase SQL editor.

alter table public.fuel_logs add column if not exists source_owner_label text;
alter table public.fuel_logs add column if not exists import_batch_id text;

alter table public.service_logs add column if not exists source_owner_label text;
alter table public.service_logs add column if not exists import_batch_id text;

alter table public.expenses add column if not exists source_owner_label text;
alter table public.expenses add column if not exists import_batch_id text;

create or replace function public.garagebase_is_imported_record(
  p_import_batch_id text,
  p_source_owner_label text
) returns boolean
language sql
stable
as $$
  select coalesce(p_import_batch_id, '') <> ''
    or coalesce(p_source_owner_label, '') <> '';
$$;

create or replace function public.garagebase_prevent_late_manual_change()
returns trigger
language plpgsql
as $$
declare
  imported boolean;
  created_value timestamptz;
  old_row jsonb;
begin
  old_row := to_jsonb(old);

  -- Service-role/API admin operations must still be able to clean up data safely
  -- (for example account deletion), while normal user edits stay locked.
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;

  imported := public.garagebase_is_imported_record(
    old_row ->> 'import_batch_id',
    old_row ->> 'source_owner_label'
  );

  if imported then
    return coalesce(new, old);
  end if;

  -- Old CSV imports before import_batch_id existed may have been saved as empty
  -- fuel rows. Keep them removable so users can clean bad imports.
  if TG_TABLE_NAME = 'fuel_logs'
     and coalesce(nullif(old_row ->> 'litri', '')::numeric, 0) = 0
     and coalesce(nullif(old_row ->> 'cena_skupaj', '')::numeric, 0) = 0 then
    return coalesce(new, old);
  end if;

  created_value := coalesce(nullif(old_row ->> 'created_at', '')::timestamptz, now());

  if created_value < now() - interval '24 hours' then
    raise exception 'manual_record_locked_after_24h'
      using hint = 'Manual GarageBase records can only be changed during the first 24 hours. Imported records are excluded.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists fuel_logs_lock_manual_after_24h on public.fuel_logs;
create trigger fuel_logs_lock_manual_after_24h
before update or delete on public.fuel_logs
for each row execute function public.garagebase_prevent_late_manual_change();

drop trigger if exists service_logs_lock_manual_after_24h on public.service_logs;
create trigger service_logs_lock_manual_after_24h
before update or delete on public.service_logs
for each row execute function public.garagebase_prevent_late_manual_change();

drop trigger if exists expenses_lock_manual_after_24h on public.expenses;
create trigger expenses_lock_manual_after_24h
before update or delete on public.expenses
for each row execute function public.garagebase_prevent_late_manual_change();
