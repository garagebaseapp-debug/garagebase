-- GarageBase: boljsi avtomatski error logging za admin panel.
-- Zazeni v Supabase SQL Editorju.

alter table public.app_errors
  add column if not exists app_version text,
  add column if not exists release_channel text,
  add column if not exists device_info text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists app_errors_app_version_idx
  on public.app_errors(app_version, created_at desc);

create index if not exists app_errors_release_channel_idx
  on public.app_errors(release_channel, created_at desc);

notify pgrst, 'reload schema';
