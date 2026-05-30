-- GarageBase vehicle purchase baseline for ownership cost per km.
-- Run this in Supabase so "od nakupa" calculations can be stored on the vehicle.

alter table public.cars
  add column if not exists purchase_date date,
  add column if not exists purchase_mileage integer;
