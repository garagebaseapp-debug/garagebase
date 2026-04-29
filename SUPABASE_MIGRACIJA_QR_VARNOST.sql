alter table public.vehicle_transfers
  add column if not exists revoked_at timestamptz,
  add column if not exists imported_by uuid references auth.users(id) on delete set null;

create index if not exists vehicle_transfers_car_created_idx
  on public.vehicle_transfers(car_id, created_at desc);

create index if not exists vehicle_transfers_active_token_idx
  on public.vehicle_transfers(token)
  where revoked_at is null;

create unique index if not exists cars_user_source_transfer_unique
  on public.cars(user_id, source_transfer_id)
  where source_transfer_id is not null;

create unique index if not exists service_logs_import_source_unique
  on public.service_logs(car_id, source_transfer_id, source_entry_id)
  where source_transfer_id is not null and source_entry_id is not null;

create unique index if not exists fuel_logs_import_source_unique
  on public.fuel_logs(car_id, source_transfer_id, source_entry_id)
  where source_transfer_id is not null and source_entry_id is not null;

create unique index if not exists expenses_import_source_unique
  on public.expenses(car_id, source_transfer_id, source_entry_id)
  where source_transfer_id is not null and source_entry_id is not null;

drop policy if exists "transfer read by token" on public.vehicle_transfers;
drop policy if exists "transfer read active" on public.vehicle_transfers;
create policy "transfer read active" on public.vehicle_transfers
  for select to authenticated
  using (
    revoked_at is null
    and (expires_at is null or expires_at > now())
  );

drop policy if exists "transfer update by token" on public.vehicle_transfers;
drop policy if exists "transfer update owner or importer" on public.vehicle_transfers;
create policy "transfer update owner or importer" on public.vehicle_transfers
  for update to authenticated
  using (
    revoked_at is null
    and (expires_at is null or expires_at > now())
    and (auth.uid() = created_by or imported_by is null)
  )
  with check (
    (auth.uid() = created_by or imported_by = auth.uid())
  );
