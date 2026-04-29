-- GarageBase: varovalka proti podvojenemu QR uvozu in osnova za stopnje zaupanja zapisov.
-- To zaženi v Supabase SQL Editorju pred testiranjem novega QR uvoza.

alter table public.cars
  add column if not exists source_transfer_id uuid references public.vehicle_transfers(id) on delete set null,
  add column if not exists source_owner_label text,
  add column if not exists imported_at timestamptz;

alter table public.service_logs
  add column if not exists source_transfer_id uuid references public.vehicle_transfers(id) on delete set null,
  add column if not exists source_entry_id uuid,
  add column if not exists source_owner_label text,
  add column if not exists verification_level text not null default 'basic',
  add column if not exists odometer_photo_url text,
  add column if not exists verified_document_url text,
  add column if not exists locked_at timestamptz,
  add column if not exists edited_at timestamptz;

alter table public.fuel_logs
  add column if not exists source_transfer_id uuid references public.vehicle_transfers(id) on delete set null,
  add column if not exists source_entry_id uuid,
  add column if not exists source_owner_label text,
  add column if not exists verification_level text not null default 'basic',
  add column if not exists odometer_photo_url text,
  add column if not exists verified_document_url text,
  add column if not exists locked_at timestamptz,
  add column if not exists edited_at timestamptz;

alter table public.expenses
  add column if not exists source_transfer_id uuid references public.vehicle_transfers(id) on delete set null,
  add column if not exists source_entry_id uuid,
  add column if not exists source_owner_label text,
  add column if not exists verification_level text not null default 'basic',
  add column if not exists odometer_photo_url text,
  add column if not exists verified_document_url text,
  add column if not exists locked_at timestamptz,
  add column if not exists edited_at timestamptz;

create unique index if not exists cars_user_source_transfer_unique
  on public.cars(user_id, source_transfer_id)
  where source_transfer_id is not null;

create unique index if not exists service_logs_car_source_entry_unique
  on public.service_logs(car_id, source_entry_id)
  where source_entry_id is not null;

create unique index if not exists fuel_logs_car_source_entry_unique
  on public.fuel_logs(car_id, source_entry_id)
  where source_entry_id is not null;

create unique index if not exists expenses_car_source_entry_unique
  on public.expenses(car_id, source_entry_id)
  where source_entry_id is not null;

alter table public.service_logs
  drop constraint if exists service_logs_verification_level_check,
  add constraint service_logs_verification_level_check
  check (verification_level in ('basic', 'photo', 'strong'));

alter table public.fuel_logs
  drop constraint if exists fuel_logs_verification_level_check,
  add constraint fuel_logs_verification_level_check
  check (verification_level in ('basic', 'photo', 'strong'));

alter table public.expenses
  drop constraint if exists expenses_verification_level_check,
  add constraint expenses_verification_level_check
  check (verification_level in ('basic', 'photo', 'strong'));

comment on column public.cars.source_transfer_id is 'QR prenos, iz katerega je bil avto uvozen. Preprecuje podvojene uvoze.';
comment on column public.service_logs.verification_level is 'basic = rocni vnos, photo = slika stevca, strong = slika stevca + dokument + zaklenjen zapis.';
comment on column public.fuel_logs.verification_level is 'basic = rocni vnos, photo = slika stevca, strong = slika stevca + dokument + zaklenjen zapis.';
comment on column public.expenses.verification_level is 'basic = rocni vnos, photo = slika stevca, strong = slika stevca + dokument + zaklenjen zapis.';
