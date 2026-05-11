-- Omogoci varno razveljavitev zadnjega CSV/Drivvo uvoza.
-- Run in Supabase SQL editor.

alter table public.fuel_logs
add column if not exists import_batch_id text;

alter table public.service_logs
add column if not exists import_batch_id text;

alter table public.expenses
add column if not exists import_batch_id text;

create index if not exists fuel_logs_car_import_batch_idx
on public.fuel_logs (car_id, import_batch_id)
where import_batch_id is not null;

create index if not exists service_logs_car_import_batch_idx
on public.service_logs (car_id, import_batch_id)
where import_batch_id is not null;

create index if not exists expenses_car_import_batch_idx
on public.expenses (car_id, import_batch_id)
where import_batch_id is not null;
