create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email)
values
  ('drazen.letsgo@gmail.com'),
  ('garagebase.app@gmail.com')
on conflict (email) do nothing;

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (email = auth.jwt() ->> 'email');

drop policy if exists "Admins can read all feedback" on public.feedback;
create policy "Admins can read all feedback"
on public.feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can update feedback status" on public.feedback;
create policy "Admins can update feedback status"
on public.feedback
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists feedback_status_created_at_idx
on public.feedback (status, created_at desc);

drop policy if exists "Admins can read all cars" on public.cars;
create policy "Admins can read all cars"
on public.cars
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can read all fuel logs" on public.fuel_logs;
create policy "Admins can read all fuel logs"
on public.fuel_logs
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can read all service logs" on public.service_logs;
create policy "Admins can read all service logs"
on public.service_logs
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can read all expenses" on public.expenses;
create policy "Admins can read all expenses"
on public.expenses
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can read all push subscriptions" on public.push_subscriptions;
create policy "Admins can read all push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can read all vehicle transfers" on public.vehicle_transfers;
create policy "Admins can read all vehicle transfers"
on public.vehicle_transfers
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);
