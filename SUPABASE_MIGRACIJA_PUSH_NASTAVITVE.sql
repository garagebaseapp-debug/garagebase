alter table public.push_subscriptions
  add column if not exists notification_settings jsonb not null default '{
    "enabled": true,
    "dateReminders": true,
    "kmReminders": true,
    "transitionAlerts": true,
    "dailyRedAlerts": true,
    "sendTime": "08:00"
  }'::jsonb,
  add column if not exists notification_state jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can select own push subscriptions" on public.push_subscriptions;
create policy "Users can select own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
