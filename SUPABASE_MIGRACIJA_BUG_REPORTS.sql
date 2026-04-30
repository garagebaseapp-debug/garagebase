create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  title text not null,
  description text not null,
  area text,
  steps text,
  expected text,
  actual text,
  device_info text,
  priority text default 'normal',
  status text default 'new',
  page_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bug_reports enable row level security;

drop policy if exists "Users can insert own bug reports" on public.bug_reports;
create policy "Users can insert own bug reports"
on public.bug_reports for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read own bug reports" on public.bug_reports;
create policy "Users can read own bug reports"
on public.bug_reports for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read bug reports" on public.bug_reports;
create policy "Admins can read bug reports"
on public.bug_reports for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Admins can update bug reports" on public.bug_reports;
create policy "Admins can update bug reports"
on public.bug_reports for update
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

create index if not exists bug_reports_user_id_idx on public.bug_reports(user_id);
create index if not exists bug_reports_status_idx on public.bug_reports(status);
create index if not exists bug_reports_created_at_idx on public.bug_reports(created_at desc);

notify pgrst, 'reload schema';
