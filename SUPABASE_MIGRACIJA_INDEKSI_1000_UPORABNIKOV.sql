-- GarageBase dodatni indeksi za 1000+ uporabnikov.
-- GarageBase additional indexes for 1000+ users.
-- Varno za ponoven zagon v Supabase SQL editorju.
-- Safe to run again in the Supabase SQL editor.

-- Opomniki: aktivni, opravljeni in arhivirani pregledi po vozilu.
-- Reminders: active, completed and archived views per vehicle.
do $$
begin
  if to_regclass('public.reminders') is not null then
    execute 'create index if not exists reminders_car_status_datum_idx on public.reminders(car_id, status, datum)';
    execute 'create index if not exists reminders_car_status_km_idx on public.reminders(car_id, status, km_opomnik)';
    execute 'create index if not exists reminders_car_completed_idx on public.reminders(car_id, completed_at desc) where status = ''completed''';
    execute 'create index if not exists reminders_car_active_datum_idx on public.reminders(car_id, datum) where status is null or status = ''active''';
  end if;
end $$;

-- Gume: hitrejse kartice montiranih gum, hrambe in zgodovine profila.
-- Tires: faster mounted, stored and tread-history cards.
do $$
begin
  if to_regclass('public.tire_sets') is not null then
    execute 'create index if not exists tire_sets_car_status_created_idx on public.tire_sets(car_id, status, created_at desc)';
    execute 'create index if not exists tire_sets_user_car_status_idx on public.tire_sets(user_id, car_id, status)';
  end if;

  if to_regclass('public.tire_mounts') is not null then
    execute 'create index if not exists tire_mounts_car_active_idx on public.tire_mounts(car_id, mounted_at desc) where removed_at is null';
    execute 'create index if not exists tire_mounts_tire_set_dates_idx on public.tire_mounts(tire_set_id, mounted_at desc, removed_at desc)';
  end if;

  if to_regclass('public.tire_tread_measurements') is not null then
    execute 'create index if not exists tire_tread_measurements_car_measured_idx on public.tire_tread_measurements(car_id, measured_at desc, km desc)';
    execute 'create index if not exists tire_tread_measurements_tire_set_measured_idx on public.tire_tread_measurements(tire_set_id, measured_at desc, km desc)';
  end if;
end $$;

-- Kilometri: hitrejse zgodovine in zadnji znani odcitki.
-- Mileage: faster history and latest known readings.
do $$
begin
  if to_regclass('public.vehicle_mileage_events') is not null then
    execute 'create index if not exists vehicle_mileage_events_car_type_date_idx on public.vehicle_mileage_events(car_id, event_type, event_date desc, km desc)';
    execute 'create index if not exists vehicle_mileage_events_user_date_idx on public.vehicle_mileage_events(user_id, event_date desc)';
  end if;
end $$;

-- Prenos vozila: hitrejsi pregledi po vozilu in ciscenje poteklih prenosov.
-- Vehicle transfer: faster per-vehicle views and expired-transfer cleanup.
do $$
begin
  if to_regclass('public.vehicle_transfers') is not null then
    execute 'create index if not exists vehicle_transfers_car_created_idx on public.vehicle_transfers(car_id, created_at desc)';
    execute 'create index if not exists vehicle_transfers_expires_idx on public.vehicle_transfers(expires_at) where imported_at is null';
  end if;
end $$;

-- Glavne strani: garaza, dashboard, stroski in zgodovine po vozilu.
-- Main screens: garage, dashboard, costs and per-vehicle histories.
do $$
begin
  if to_regclass('public.cars') is not null then
    execute 'create index if not exists cars_user_archive_order_idx on public.cars(user_id, arhivirano, vrstni_red, created_at desc)';
    execute 'create index if not exists cars_user_id_archive_idx on public.cars(user_id, id, arhivirano)';
  end if;

  if to_regclass('public.fuel_logs') is not null then
    execute 'create index if not exists fuel_logs_car_datum_desc_idx on public.fuel_logs(car_id, datum desc)';
    execute 'create index if not exists fuel_logs_car_km_desc_idx on public.fuel_logs(car_id, km desc)';
    execute 'create index if not exists fuel_logs_car_created_desc_idx on public.fuel_logs(car_id, created_at desc)';
  end if;

  if to_regclass('public.service_logs') is not null then
    execute 'create index if not exists service_logs_car_datum_desc_idx on public.service_logs(car_id, datum desc)';
    execute 'create index if not exists service_logs_car_km_desc_idx on public.service_logs(car_id, km desc)';
    execute 'create index if not exists service_logs_car_created_desc_idx on public.service_logs(car_id, created_at desc)';
  end if;

  if to_regclass('public.expenses') is not null then
    execute 'create index if not exists expenses_car_datum_desc_idx on public.expenses(car_id, datum desc)';
    execute 'create index if not exists expenses_car_kategorija_datum_idx on public.expenses(car_id, kategorija, datum desc)';
    execute 'create index if not exists expenses_car_created_desc_idx on public.expenses(car_id, created_at desc)';
  end if;
end $$;

-- Admin analitika: hitrejsi admin dashboard, uporabniska aktivnost in napake.
-- Admin analytics: faster admin dashboard, user activity and error views.
do $$
begin
  if to_regclass('public.app_events') is not null then
    execute 'create index if not exists app_events_created_desc_idx on public.app_events(created_at desc)';
    execute 'create index if not exists app_events_user_created_desc_idx on public.app_events(user_id, created_at desc)';
    execute 'create index if not exists app_events_name_created_desc_idx on public.app_events(event_name, created_at desc)';
    execute 'create index if not exists app_events_page_created_desc_idx on public.app_events(page_path, created_at desc)';
  end if;

  if to_regclass('public.app_errors') is not null then
    execute 'create index if not exists app_errors_created_desc_idx on public.app_errors(created_at desc)';
    execute 'create index if not exists app_errors_status_created_desc_idx on public.app_errors(status, created_at desc)';
    execute 'create index if not exists app_errors_user_created_desc_idx on public.app_errors(user_id, created_at desc)';
  end if;

  if to_regclass('public.feedback') is not null then
    execute 'create index if not exists feedback_status_created_desc_idx on public.feedback(status, created_at desc)';
    execute 'create index if not exists feedback_user_created_desc_idx on public.feedback(user_id, created_at desc)';
  end if;

  if to_regclass('public.user_plans') is not null then
    execute 'create index if not exists user_plans_email_idx on public.user_plans(lower(email))';
    execute 'create index if not exists user_plans_updated_desc_idx on public.user_plans(updated_at desc)';
  end if;
end $$;

notify pgrst, 'reload schema';
