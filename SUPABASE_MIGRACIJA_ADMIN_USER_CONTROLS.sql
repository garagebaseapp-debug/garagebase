-- GarageBase: admin varovalke za testerje, omejitve funkcij in rocne pakete.
-- Run in Supabase SQL editor. Safe to run more than once.

create table if not exists public.user_admin_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'normal',
  blocked_until timestamptz,
  reason text,
  internal_note text,
  feature_limits jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_admin_controls enable row level security;

drop policy if exists "Admins can read user controls" on public.user_admin_controls;
create policy "Admins can read user controls"
on public.user_admin_controls
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can manage user controls" on public.user_admin_controls;
create policy "Admins can manage user controls"
on public.user_admin_controls
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

drop policy if exists "Users can read own controls" on public.user_admin_controls;
create policy "Users can read own controls"
on public.user_admin_controls
for select
to authenticated
using (user_id = auth.uid());

create index if not exists user_admin_controls_email_idx
on public.user_admin_controls (lower(email));

create index if not exists user_admin_controls_status_idx
on public.user_admin_controls (status);

create table if not exists public.admin_user_control_changes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete cascade,
  target_email text not null,
  previous_status text,
  next_status text not null,
  previous_feature_limits jsonb,
  next_feature_limits jsonb not null default '{}'::jsonb,
  previous_blocked_until timestamptz,
  next_blocked_until timestamptz,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_user_control_changes enable row level security;

drop policy if exists "Admins can read user control changes" on public.admin_user_control_changes;
create policy "Admins can read user control changes"
on public.admin_user_control_changes
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can insert user control changes" on public.admin_user_control_changes;
create policy "Admins can insert user control changes"
on public.admin_user_control_changes
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists admin_user_control_changes_target_created_idx
on public.admin_user_control_changes (target_user_id, created_at desc);

notify pgrst, 'reload schema';
