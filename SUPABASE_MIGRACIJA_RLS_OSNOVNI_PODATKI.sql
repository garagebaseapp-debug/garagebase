-- GarageBase: osnovna RLS varnost za vec uporabnikov.
-- Zazeni v Supabase SQL Editorju. Vse vrstice so varne za ponoven zagon.
--
-- Namen:
-- - uporabnik vidi in ureja samo svoja vozila,
-- - uporabnik vidi in ureja samo gorivo/servise/stroske/opomnike za svoja vozila,
-- - admin read politike iz SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql ostanejo veljavne.

alter table public.cars enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.service_logs enable row level security;
alter table public.expenses enable row level security;
alter table public.reminders enable row level security;

-- Vozila
drop policy if exists "Users can read own cars" on public.cars;
create policy "Users can read own cars"
on public.cars
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own cars" on public.cars;
create policy "Users can insert own cars"
on public.cars
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own cars" on public.cars;
create policy "Users can update own cars"
on public.cars
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cars" on public.cars;
create policy "Users can delete own cars"
on public.cars
for delete
to authenticated
using (auth.uid() = user_id);

-- Gorivo
drop policy if exists "Users can read fuel logs for own cars" on public.fuel_logs;
create policy "Users can read fuel logs for own cars"
on public.fuel_logs
for select
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = fuel_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert fuel logs for own cars" on public.fuel_logs;
create policy "Users can insert fuel logs for own cars"
on public.fuel_logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.cars
    where cars.id = fuel_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can update fuel logs for own cars" on public.fuel_logs;
create policy "Users can update fuel logs for own cars"
on public.fuel_logs
for update
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = fuel_logs.car_id
      and cars.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cars
    where cars.id = fuel_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete fuel logs for own cars" on public.fuel_logs;
create policy "Users can delete fuel logs for own cars"
on public.fuel_logs
for delete
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = fuel_logs.car_id
      and cars.user_id = auth.uid()
  )
);

-- Servisi
drop policy if exists "Users can read service logs for own cars" on public.service_logs;
create policy "Users can read service logs for own cars"
on public.service_logs
for select
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = service_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert service logs for own cars" on public.service_logs;
create policy "Users can insert service logs for own cars"
on public.service_logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.cars
    where cars.id = service_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can update service logs for own cars" on public.service_logs;
create policy "Users can update service logs for own cars"
on public.service_logs
for update
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = service_logs.car_id
      and cars.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cars
    where cars.id = service_logs.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete service logs for own cars" on public.service_logs;
create policy "Users can delete service logs for own cars"
on public.service_logs
for delete
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = service_logs.car_id
      and cars.user_id = auth.uid()
  )
);

-- Stroski
drop policy if exists "Users can read expenses for own cars" on public.expenses;
create policy "Users can read expenses for own cars"
on public.expenses
for select
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = expenses.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert expenses for own cars" on public.expenses;
create policy "Users can insert expenses for own cars"
on public.expenses
for insert
to authenticated
with check (
  exists (
    select 1 from public.cars
    where cars.id = expenses.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can update expenses for own cars" on public.expenses;
create policy "Users can update expenses for own cars"
on public.expenses
for update
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = expenses.car_id
      and cars.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cars
    where cars.id = expenses.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete expenses for own cars" on public.expenses;
create policy "Users can delete expenses for own cars"
on public.expenses
for delete
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = expenses.car_id
      and cars.user_id = auth.uid()
  )
);

-- Opomniki
drop policy if exists "Users can read reminders for own cars" on public.reminders;
create policy "Users can read reminders for own cars"
on public.reminders
for select
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = reminders.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert reminders for own cars" on public.reminders;
create policy "Users can insert reminders for own cars"
on public.reminders
for insert
to authenticated
with check (
  exists (
    select 1 from public.cars
    where cars.id = reminders.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can update reminders for own cars" on public.reminders;
create policy "Users can update reminders for own cars"
on public.reminders
for update
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = reminders.car_id
      and cars.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cars
    where cars.id = reminders.car_id
      and cars.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete reminders for own cars" on public.reminders;
create policy "Users can delete reminders for own cars"
on public.reminders
for delete
to authenticated
using (
  exists (
    select 1 from public.cars
    where cars.id = reminders.car_id
      and cars.user_id = auth.uid()
  )
);

-- Storage: app shranjuje datoteke v mapo auth.uid()/...
-- Ce sta bucketa public, direktni public URL-ji se vedno delujejo, ta pravila pa omejijo pisanje na lastno mapo.
drop policy if exists "Users can read own car images" on storage.objects;
create policy "Users can read own car images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can write own car images" on storage.objects;
create policy "Users can write own car images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own car images" on storage.objects;
create policy "Users can update own car images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own car images" on storage.objects;
create policy "Users can delete own car images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own service documents" on storage.objects;
create policy "Users can read own service documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'service-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can write own service documents" on storage.objects;
create policy "Users can write own service documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own service documents" on storage.objects;
create policy "Users can update own service documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'service-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'service-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own service documents" on storage.objects;
create policy "Users can delete own service documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'service-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
