-- Razsiritev admin paketov za varnejse kasnejse placljive pakete.
-- Run in Supabase SQL editor.

alter table public.user_plans
add column if not exists source text not null default 'manual';

alter table public.user_plans
add column if not exists billing_status text not null default 'free_open';

alter table public.user_plans
add column if not exists locked boolean not null default false;

alter table public.user_plans
add column if not exists change_reason text;

create index if not exists user_plans_source_idx
on public.user_plans (source);

create index if not exists user_plans_billing_status_idx
on public.user_plans (billing_status);

create table if not exists public.admin_plan_changes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  previous_plan text,
  next_plan text not null,
  previous_source text,
  next_source text,
  previous_billing_status text,
  next_billing_status text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_plan_changes enable row level security;

drop policy if exists "Admins can read plan changes" on public.admin_plan_changes;
create policy "Admins can read plan changes"
on public.admin_plan_changes
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can insert plan changes" on public.admin_plan_changes;
create policy "Admins can insert plan changes"
on public.admin_plan_changes
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

create index if not exists admin_plan_changes_email_created_idx
on public.admin_plan_changes (email, created_at desc);
