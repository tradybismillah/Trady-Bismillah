begin;

create table if not exists public.business_transport_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_handling_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_storage_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.business_transport_types (name) values
  ('Navette locale'),
  ('Navette régionale'),
  ('Navette nationale'),
  ('Intra-Européenne'),
  ('Export')
on conflict (name) do nothing;

create table if not exists public.crm_exchange_transports (
  exchange_id uuid not null references public.crm_exchanges(id) on delete cascade,
  transport_type_id uuid not null references public.business_transport_types(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('pcb', 'palette')),
  route_details jsonb not null default '{}'::jsonb,
  primary key (exchange_id, transport_type_id)
);

alter table public.crm_exchange_transports
  add column if not exists route_details jsonb not null default '{}'::jsonb;

create table if not exists public.crm_exchange_handling_types (
  exchange_id uuid not null references public.crm_exchanges(id) on delete cascade,
  handling_type_id uuid not null references public.business_handling_types(id) on delete restrict,
  primary key (exchange_id, handling_type_id)
);

create table if not exists public.crm_exchange_storage_types (
  exchange_id uuid not null references public.crm_exchanges(id) on delete cascade,
  storage_type_id uuid not null references public.business_storage_types(id) on delete restrict,
  primary key (exchange_id, storage_type_id)
);

create or replace function public.sync_crm_exchange_logistics(
  p_exchange_id uuid,
  p_exchange jsonb
)
returns void language plpgsql
as $$
begin
  delete from public.crm_exchange_transports where exchange_id = p_exchange_id;
  insert into public.crm_exchange_transports (exchange_id, transport_type_id, quantity, unit, route_details)
  select p_exchange_id, item.transport_type_id, item.quantity, item.unit, coalesce(item.route_details, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_exchange->'transport_details', '[]'::jsonb))
    as item(transport_type_id uuid, quantity numeric, unit text, route_details jsonb)
  where item.quantity > 0 and item.unit in ('pcb', 'palette')
  on conflict (exchange_id, transport_type_id) do update
    set quantity = excluded.quantity, unit = excluded.unit, route_details = excluded.route_details;

  delete from public.crm_exchange_handling_types where exchange_id = p_exchange_id;
  insert into public.crm_exchange_handling_types (exchange_id, handling_type_id)
  select p_exchange_id, value::uuid
  from jsonb_array_elements_text(coalesce(p_exchange->'handling_type_ids', '[]'::jsonb)) as selected(value)
  on conflict do nothing;

  delete from public.crm_exchange_storage_types where exchange_id = p_exchange_id;
  insert into public.crm_exchange_storage_types (exchange_id, storage_type_id)
  select p_exchange_id, value::uuid
  from jsonb_array_elements_text(coalesce(p_exchange->'storage_type_ids', '[]'::jsonb)) as selected(value)
  on conflict do nothing;
end;
$$;

create or replace function public.save_crm_exchange_logistics(
  p_exchange jsonb,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}',
  p_action jsonb default null
)
returns uuid language plpgsql
as $$
declare
  v_exchange_id uuid;
begin
  v_exchange_id := public.save_crm_exchange(p_exchange, p_product_ids, p_service_ids, p_action);
  perform public.sync_crm_exchange_logistics(v_exchange_id, p_exchange);
  return v_exchange_id;
end;
$$;

create or replace function public.update_crm_exchange_logistics(
  p_exchange_id uuid,
  p_exchange jsonb,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}',
  p_action jsonb default null
)
returns uuid language plpgsql
as $$
declare
  v_exchange_id uuid;
begin
  v_exchange_id := public.update_crm_exchange(p_exchange_id, p_exchange, p_product_ids, p_service_ids, p_action);
  perform public.sync_crm_exchange_logistics(v_exchange_id, p_exchange);
  return v_exchange_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_transport_types', 'business_handling_types', 'business_storage_types',
    'crm_exchange_transports', 'crm_exchange_handling_types', 'crm_exchange_storage_types'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'Authenticated users manage ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'Authenticated users manage ' || table_name,
      table_name
    );
  end loop;
end;
$$;

grant select, insert, update, delete on
  public.business_transport_types, public.business_handling_types, public.business_storage_types,
  public.crm_exchange_transports, public.crm_exchange_handling_types, public.crm_exchange_storage_types
to authenticated;

revoke all on function public.sync_crm_exchange_logistics(uuid, jsonb) from public, anon;
grant execute on function public.sync_crm_exchange_logistics(uuid, jsonb) to authenticated;
revoke all on function public.save_crm_exchange_logistics(jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_crm_exchange_logistics(jsonb, uuid[], uuid[], jsonb) to authenticated;
revoke all on function public.update_crm_exchange_logistics(uuid, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.update_crm_exchange_logistics(uuid, jsonb, uuid[], uuid[], jsonb) to authenticated;

commit;
