-- GarageBase: dovoli izbris servisnega zapisa tudi po 24h, urejanje pa ostane zaklenjeno.
-- GarageBase: allow deleting service records after 24h, while editing remains locked.
-- Run in Supabase SQL editor.

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

  -- Service-role/API admin operations must still be able to clean up data safely.
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;

  -- A wrongly entered service must be removable later. Editing remains locked by the 24h rule.
  if TG_TABLE_NAME = 'service_logs' and TG_OP = 'DELETE' then
    return old;
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
