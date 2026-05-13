ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS polni_rezervar boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.fuel_logs.polni_rezervar IS
  'True = full tank (full-to-full), false = partial fill-up';
