-- GarageBase: arhiv vozil in opomnik po izvozu zgodovine.
-- To zaženi v Supabase SQL Editorju.

alter table public.cars
  add column if not exists arhivirano boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists history_exported_at timestamptz,
  add column if not exists archive_reminder_dismissed_until timestamptz;

create index if not exists cars_user_archived_idx
  on public.cars(user_id, arhivirano, vrstni_red);

comment on column public.cars.arhivirano is 'Arhivirana/prodana vozila niso privzeto prikazana v glavni garazi.';
comment on column public.cars.history_exported_at is 'Zadnji datum priprave QR izvoza zgodovine za prodajo/prenos.';
