create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_description text not null,
  usefulness_reason text not null,
  usage_frequency text not null,
  user_type text not null,
  priority text not null default 'normal',
  page_context text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback"
on public.feedback
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read own feedback" on public.feedback;
create policy "Users can read own feedback"
on public.feedback
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists feedback_user_id_created_at_idx
on public.feedback (user_id, created_at desc);
