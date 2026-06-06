-- GarageBase dodatni indeksi za 1000+ uporabnikov.
-- GarageBase additional indexes for 1000+ users.
-- Varno za ponoven zagon v Supabase SQL editorju.
-- Safe to run again in the Supabase SQL editor.

-- Opomniki: aktivni, opravljeni in arhivirani pregledi po vozilu.
-- Reminders: active, completed and archived views per vehicle.
create index if not exists reminders_car_status_datum_idx
  on public.reminders(car_id, status, datum);

create index if not exists reminders_car_status_km_idx
  on public.reminders(car_id, status, km_opomnik);

create index if not exists reminders_car_completed_idx
  on public.reminders(car_id, completed_at desc)
  where status = 'completed';

-- Gume: hitrejse kartice montiranih gum, hrambe in zgodovine profila.
-- Tires: faster mounted, stored and tread-history cards.
create index if not exists tire_sets_car_status_created_idx
  on public.tire_sets(car_id, status, created_at desc);

create index if not exists tire_sets_user_car_status_idx
  on public.tire_sets(user_id, car_id, status);

create index if not exists tire_mounts_car_active_idx
  on public.tire_mounts(car_id, mounted_at desc)
  where removed_at is null;

create index if not exists tire_mounts_tire_set_dates_idx
  on public.tire_mounts(tire_set_id, mounted_at desc, removed_at desc);

create index if not exists tire_tread_measurements_car_measured_idx
  on public.tire_tread_measurements(car_id, measured_at desc, km desc);

-- Kilometri: hitrejse zgodovine in zadnji znani odcitki.
-- Mileage: faster history and latest known readings.
create index if not exists vehicle_mileage_events_car_type_date_idx
  on public.vehicle_mileage_events(car_id, event_type, event_date desc, km desc);

create index if not exists vehicle_mileage_events_user_date_idx
  on public.vehicle_mileage_events(user_id, event_date desc);

-- Prenos vozila: hitrejsi pregledi po vozilu in ciscenje poteklih prenosov.
-- Vehicle transfer: faster per-vehicle views and expired-transfer cleanup.
create index if not exists vehicle_transfers_car_created_idx
  on public.vehicle_transfers(car_id, created_at desc);

create index if not exists vehicle_transfers_expires_idx
  on public.vehicle_transfers(expires_at)
  where imported_at is null;

notify pgrst, 'reload schema';
