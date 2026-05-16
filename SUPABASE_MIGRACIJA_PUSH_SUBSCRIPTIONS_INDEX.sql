-- GarageBase - hitrejsi pregled push narocnin po uporabniku
-- GarageBase - faster push subscription lookup by user

create index if not exists push_subscriptions_user_updated_idx
  on public.push_subscriptions(user_id, updated_at desc);
