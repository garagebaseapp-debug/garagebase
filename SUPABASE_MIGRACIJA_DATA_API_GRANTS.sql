-- GarageBase: Data API grants za Supabase spremembo 2026.
-- Zazeni v Supabase SQL Editorju. Varno je za ponoven zagon.
--
-- Namen:
-- - vse obstojece public tabele, ki jih uporablja app prek supabase-js/PostgREST,
--   imajo eksplicitne GRANT pravice,
-- - RLS ostane glavna varnostna plast,
-- - bodoce tabele dobijo eksplicitne default privileges, prelaunch check pa nas
--   opozori, ce nova tabela ni dodana v ta seznam.

do $$
declare
  table_name text;
  data_api_tables text[] := array[
    'cars',
    'fuel_logs',
    'service_logs',
    'expenses',
    'reminders',
    'push_subscriptions',
    'vehicle_transfers',
    'feedback',
    'bug_reports',
    'admin_users',
    'app_events',
    'user_plans',
    'app_errors',
    'admin_plan_changes',
    'api_rate_limits',
    'archived_cars'
  ];
begin
  foreach table_name in array data_api_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant select on table public.%I to anon', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- Funkcije naj ne bodo avtomatsko odprte za anon/authenticated. Posamezne funkcije
-- naj dobijo ekspliciten grant glede na namen. Trenutno check_rate_limit uporablja
-- samo service_role.
revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
