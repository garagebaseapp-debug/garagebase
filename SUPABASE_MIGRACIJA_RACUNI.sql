alter table public.fuel_logs
  add column if not exists receipt_url text;

alter table public.expenses
  add column if not exists receipt_url text;

comment on column public.fuel_logs.receipt_url is 'URL slike racuna za tankanje.';
comment on column public.expenses.receipt_url is 'URL slike racuna za strosek.';
