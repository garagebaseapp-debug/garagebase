-- GarageBase: dodatna polja za lastnike, VIN in prenos zgodovine
-- To zaženi v Supabase SQL Editorju za projekt GarageBase.

alter table public.cars
  add column if not exists st_lastnikov integer,
  add column if not exists lastnik_mesto text,
  add column if not exists lastnik_starost integer,
  add column if not exists prenos_soglasje boolean default false,
  add column if not exists prenos_opomba text;

comment on column public.cars.st_lastnikov is 'Stevilo lastnikov vozila, vidno na reportu.';
comment on column public.cars.lastnik_mesto is 'Mesto trenutnega/prejsnjega lastnika za report prenosa.';
comment on column public.cars.lastnik_starost is 'Starost trenutnega/prejsnjega lastnika za report prenosa.';
comment on column public.cars.prenos_soglasje is 'Ali se lastnik strinja s prenosom zgodovine na naslednjega lastnika.';
comment on column public.cars.prenos_opomba is 'Opcijska opomba pri prenosu zgodovine.';
