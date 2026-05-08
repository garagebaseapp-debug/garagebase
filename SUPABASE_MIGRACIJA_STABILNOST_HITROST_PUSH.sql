-- GarageBase faza 1-3: stabilnost, hitrost in push higiena.
-- Zazeni v Supabase SQL editorju. Vse vrstice so varne za ponoven zagon.

-- 1) Hitrejsi glavni ekrani in zgodovine po vozilu.
create index if not exists cars_user_active_order_idx
  on public.cars(user_id, arhivirano, vrstni_red, created_at desc);

create index if not exists cars_user_created_idx
  on public.cars(user_id, created_at desc);

create index if not exists fuel_logs_car_datum_idx
  on public.fuel_logs(car_id, datum desc);

create index if not exists fuel_logs_car_km_idx
  on public.fuel_logs(car_id, km desc);

create index if not exists service_logs_car_datum_idx
  on public.service_logs(car_id, datum desc);

create index if not exists service_logs_car_km_idx
  on public.service_logs(car_id, km desc);

create index if not exists expenses_car_datum_idx
  on public.expenses(car_id, datum desc);

create index if not exists reminders_car_datum_idx
  on public.reminders(car_id, datum);

create index if not exists reminders_car_km_idx
  on public.reminders(car_id, km_opomnik);

-- 2) Admin analitika in napake.
-- Nekatere tabele so iz prejsnjih migracij, zato jih preverimo pred indeksi.
do $$
begin
  if to_regclass('public.app_events') is not null then
    execute 'create index if not exists app_events_user_created_idx on public.app_events(user_id, created_at desc)';
    execute 'create index if not exists app_events_name_created_idx on public.app_events(event_name, created_at desc)';
  end if;

  if to_regclass('public.app_errors') is not null then
    execute 'create index if not exists app_errors_created_idx on public.app_errors(created_at desc)';
  end if;

  if to_regclass('public.bug_reports') is not null then
    execute 'create index if not exists bug_reports_status_created_idx on public.bug_reports(status, created_at desc)';
  end if;

  if to_regclass('public.feedback') is not null then
    execute 'create index if not exists feedback_status_created_idx on public.feedback(status, created_at desc)';
  end if;
end $$;

-- 3) Push subscription higiena: lazje iskanje naprave, sledenje napakam.
alter table public.push_subscriptions
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists last_error text,
  add column if not exists fail_count integer not null default 0;

create index if not exists push_subscriptions_endpoint_idx
  on public.push_subscriptions((subscription->>'endpoint'));

create index if not exists push_subscriptions_updated_idx
  on public.push_subscriptions(updated_at desc);

notify pgrst, 'reload schema';
