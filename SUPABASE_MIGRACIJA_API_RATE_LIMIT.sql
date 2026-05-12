-- GarageBase: API rate limit for Vercel/serverless routes.
-- Zazeni v Supabase SQL Editorju. Varno je za ponoven zagon.

create table if not exists public.api_rate_limits (
  scope text not null,
  identifier text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier, window_start)
);

alter table public.api_rate_limits enable row level security;

create index if not exists api_rate_limits_cleanup_idx
  on public.api_rate_limits(window_start);

create or replace function public.check_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_seconds integer := greatest(1, p_window_seconds);
  v_window_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / greatest(1, p_window_seconds)) * greatest(1, p_window_seconds)
  );
  v_count integer;
begin
  insert into public.api_rate_limits(scope, identifier, window_start, count, updated_at)
  values (p_scope, p_identifier, v_window_start, 1, now())
  on conflict (scope, identifier, window_start)
  do update set
    count = public.api_rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  delete from public.api_rate_limits
  where window_start < now() - interval '1 day';

  return query select
    v_count <= p_limit,
    v_count,
    greatest(0, ceil(extract(epoch from (v_window_start + make_interval(secs => v_window_seconds) - now())))::integer);
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
