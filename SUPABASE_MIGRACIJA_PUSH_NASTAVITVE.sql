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
