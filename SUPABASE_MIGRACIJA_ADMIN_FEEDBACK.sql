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

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  page_path text,
  car_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_events enable row level security;

drop policy if exists "Users can insert own app events" on public.app_events;
create policy "Users can insert own app events"
on public.app_events
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Admins can read all app events" on public.app_events;
create policy "Admins can read all app events"
on public.app_events
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists app_events_event_name_created_at_idx
on public.app_events (event_name, created_at desc);

create index if not exists app_events_user_id_created_at_idx
on public.app_events (user_id, created_at desc);

create table if not exists public.user_plans (
  email text primary key,
  plan text not null default 'max',
  note text,
  valid_until date,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_plans enable row level security;

drop policy if exists "Users can read own plan" on public.user_plans;
create policy "Users can read own plan"
on public.user_plans
for select
to authenticated
using (email = auth.jwt() ->> 'email');

drop policy if exists "Admins can read all user plans" on public.user_plans;
create policy "Admins can read all user plans"
on public.user_plans
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can upsert user plans" on public.user_plans;
create policy "Admins can upsert user plans"
on public.user_plans
for all
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists user_plans_plan_idx
on public.user_plans (plan);
