-- GarageBase: atomic push subscription upsert.
-- Zazeni v Supabase SQL Editorju. Varno je za ponoven zagon.

alter table public.push_subscriptions
  add column if not exists endpoint text;

update public.push_subscriptions
set endpoint = subscription->>'endpoint'
where endpoint is null
  and subscription ? 'endpoint';

delete from public.push_subscriptions a
using public.push_subscriptions b
where a.ctid < b.ctid
  and a.user_id = b.user_id
  and coalesce(a.endpoint, a.subscription->>'endpoint') = coalesce(b.endpoint, b.subscription->>'endpoint');

create unique index if not exists push_subscriptions_user_endpoint_uidx
  on public.push_subscriptions(user_id, endpoint)
  where endpoint is not null;

create index if not exists push_subscriptions_endpoint_text_idx
  on public.push_subscriptions(endpoint);

notify pgrst, 'reload schema';
