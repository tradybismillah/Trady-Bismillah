begin;

alter table public.crm_exchanges
  add column if not exists availability_date date;

comment on column public.crm_exchanges.availability_date is
  'Date demandée ou annoncée pour la disponibilité des produits concernés par l’échange.';

create or replace function public.save_crm_exchange(
  p_exchange jsonb,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}',
  p_action jsonb default null
)
returns uuid language plpgsql
as $$
declare
  v_exchange_id uuid;
  v_contact_id uuid;
  v_entry_kind text;
begin
  v_contact_id := nullif(p_exchange->>'contact_id', '')::uuid;
  v_entry_kind := coalesce(p_exchange->>'entry_kind', 'exchange');
  if v_contact_id is null then raise exception 'Un contact est obligatoire.'; end if;
  if p_action is not null and v_entry_kind in ('information', 'observation', 'alert') then
    raise exception 'Une information, observation ou alerte ne crée pas automatiquement une action.';
  end if;

  insert into public.crm_exchanges (
    contact_id, occurred_at, direction, channel_kind, channel, category,
    scenario, subscenario, availability_date, entry_kind, content, status
  ) values (
    v_contact_id,
    coalesce(nullif(p_exchange->>'occurred_at', '')::timestamptz, now()),
    nullif(p_exchange->>'direction', ''),
    p_exchange->>'channel_kind',
    p_exchange->>'channel',
    p_exchange->>'category',
    coalesce(p_exchange->>'scenario', ''),
    coalesce(p_exchange->>'subscenario', ''),
    nullif(p_exchange->>'availability_date', '')::date,
    v_entry_kind,
    coalesce(p_exchange->>'content', ''),
    coalesce(p_exchange->>'status', 'recorded')
  ) returning id into v_exchange_id;

  insert into public.crm_exchange_products (
    exchange_id, product_id, packaging_level, quantity,
    uvc_unit_price, pcb_unit_price, palette_unit_price
  )
  select
    v_exchange_id,
    selected.product_id,
    coalesce(details.packaging_level, 'uvc'),
    details.quantity,
    details.uvc_unit_price,
    details.pcb_unit_price,
    details.palette_unit_price
  from unnest(coalesce(p_product_ids, '{}')) as selected(product_id)
  left join jsonb_to_recordset(coalesce(p_exchange->'product_details', '[]'::jsonb))
    as details(
      product_id uuid,
      packaging_level text,
      quantity numeric,
      uvc_unit_price numeric,
      pcb_unit_price numeric,
      palette_unit_price numeric
    )
    using (product_id)
  on conflict (exchange_id, product_id) do nothing;

  insert into public.crm_exchange_services (exchange_id, service_id)
  select v_exchange_id, linked_id from unnest(coalesce(p_service_ids, '{}')) linked_id
  on conflict do nothing;

  if p_action is not null then
    insert into public.crm_actions (
      exchange_id, contact_id, title, description, due_at, priority, status, assignee
    ) values (
      v_exchange_id, v_contact_id, nullif(btrim(p_action->>'title'), ''),
      coalesce(p_action->>'description', ''),
      nullif(p_action->>'due_at', '')::timestamptz,
      coalesce(p_action->>'priority', 'normal'),
      'todo',
      coalesce(p_action->>'assignee', '')
    );
  end if;
  return v_exchange_id;
end;
$$;

create or replace function public.update_crm_exchange(
  p_exchange_id uuid,
  p_exchange jsonb,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}',
  p_action jsonb default null
)
returns uuid language plpgsql
as $$
declare
  v_contact_id uuid;
  v_entry_kind text;
begin
  v_contact_id := nullif(p_exchange->>'contact_id', '')::uuid;
  v_entry_kind := coalesce(p_exchange->>'entry_kind', 'exchange');
  if v_contact_id is null then raise exception 'Un contact est obligatoire.'; end if;
  if p_action is not null and v_entry_kind in ('information', 'observation', 'alert') then
    raise exception 'Une information, observation ou alerte ne crée pas automatiquement une action.';
  end if;

  update public.crm_exchanges
  set contact_id = v_contact_id,
      occurred_at = coalesce(nullif(p_exchange->>'occurred_at', '')::timestamptz, now()),
      direction = nullif(p_exchange->>'direction', ''),
      channel_kind = p_exchange->>'channel_kind',
      channel = p_exchange->>'channel',
      category = p_exchange->>'category',
      scenario = coalesce(p_exchange->>'scenario', ''),
      subscenario = coalesce(p_exchange->>'subscenario', ''),
      availability_date = nullif(p_exchange->>'availability_date', '')::date,
      entry_kind = v_entry_kind,
      content = coalesce(p_exchange->>'content', ''),
      revision = revision + 1,
      updated_at = now()
  where id = p_exchange_id;
  if not found then raise exception 'La fiche échange à modifier est introuvable.'; end if;

  update public.crm_actions
  set contact_id = v_contact_id, updated_at = now()
  where exchange_id = p_exchange_id;
  if p_action is not null and not exists (
    select 1 from public.crm_actions where exchange_id = p_exchange_id
  ) then
    insert into public.crm_actions (
      exchange_id, contact_id, title, description, due_at, priority, status, assignee
    ) values (
      p_exchange_id, v_contact_id, nullif(btrim(p_action->>'title'), ''),
      coalesce(p_action->>'description', ''),
      nullif(p_action->>'due_at', '')::timestamptz,
      coalesce(p_action->>'priority', 'normal'),
      'todo',
      coalesce(p_action->>'assignee', '')
    );
  elsif p_action is not null then
    update public.crm_actions
    set title = nullif(btrim(p_action->>'title'), ''),
        due_at = nullif(p_action->>'due_at', '')::timestamptz,
        updated_at = now()
    where exchange_id = p_exchange_id;
  end if;

  delete from public.crm_exchange_products where exchange_id = p_exchange_id;
  insert into public.crm_exchange_products (
    exchange_id, product_id, packaging_level, quantity,
    uvc_unit_price, pcb_unit_price, palette_unit_price
  )
  select
    p_exchange_id,
    selected.product_id,
    coalesce(details.packaging_level, 'uvc'),
    details.quantity,
    details.uvc_unit_price,
    details.pcb_unit_price,
    details.palette_unit_price
  from unnest(coalesce(p_product_ids, '{}')) as selected(product_id)
  left join jsonb_to_recordset(coalesce(p_exchange->'product_details', '[]'::jsonb))
    as details(
      product_id uuid,
      packaging_level text,
      quantity numeric,
      uvc_unit_price numeric,
      pcb_unit_price numeric,
      palette_unit_price numeric
    )
    using (product_id)
  on conflict (exchange_id, product_id) do update set
    packaging_level = excluded.packaging_level,
    quantity = excluded.quantity,
    uvc_unit_price = excluded.uvc_unit_price,
    pcb_unit_price = excluded.pcb_unit_price,
    palette_unit_price = excluded.palette_unit_price;

  delete from public.crm_exchange_services where exchange_id = p_exchange_id;
  insert into public.crm_exchange_services (exchange_id, service_id)
  select p_exchange_id, linked_id from unnest(coalesce(p_service_ids, '{}')) linked_id
  on conflict do nothing;

  return p_exchange_id;
end;
$$;

revoke all on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) to authenticated;
revoke all on function public.update_crm_exchange(uuid, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.update_crm_exchange(uuid, jsonb, uuid[], uuid[], jsonb) to authenticated;

commit;
