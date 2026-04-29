-- GarageBase: homologacija vozila
-- To zaženi v Supabase SQL Editorju za projekt GarageBase.

alter table public.cars
  add column if not exists homologacija_stevilka text,
  add column if not exists homologacija_opis text,
  add column if not exists homologacija_url text;

comment on column public.cars.homologacija_stevilka is 'Stevilka ali oznaka homologacije vozila.';
comment on column public.cars.homologacija_opis is 'Rocni opis homologacije, posebnih vpisov ali opomb.';
comment on column public.cars.homologacija_url is 'URL slike ali PDF dokumenta homologacije v Supabase Storage.';
