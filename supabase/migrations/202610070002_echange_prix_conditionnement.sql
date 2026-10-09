begin;

alter table public.crm_exchange_products
  add column if not exists packaging_level text not null default 'uvc',
  add column if not exists quantity numeric,
  add column if not exists uvc_unit_price numeric,
  add column if not exists pcb_unit_price numeric,
  add column if not exists palette_unit_price numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_exchange_products'::regclass
      and conname = 'crm_exchange_products_packaging_level_check'
  ) then
    alter table public.crm_exchange_products
      add constraint crm_exchange_products_packaging_level_check
      check (packaging_level in ('uvc', 'pcb', 'palette'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_exchange_products'::regclass
      and conname = 'crm_exchange_products_quantity_check'
  ) then
    alter table public.crm_exchange_products
      add constraint crm_exchange_products_quantity_check
      check (quantity is null or quantity > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_exchange_products'::regclass
      and conname = 'crm_exchange_products_uvc_unit_price_check'
  ) then
    alter table public.crm_exchange_products
      add constraint crm_exchange_products_uvc_unit_price_check
      check (uvc_unit_price is null or uvc_unit_price >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_exchange_products'::regclass
      and conname = 'crm_exchange_products_pcb_unit_price_check'
  ) then
    alter table public.crm_exchange_products
      add constraint crm_exchange_products_pcb_unit_price_check
      check (pcb_unit_price is null or pcb_unit_price >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_exchange_products'::regclass
      and conname = 'crm_exchange_products_palette_unit_price_check'
  ) then
    alter table public.crm_exchange_products
      add constraint crm_exchange_products_palette_unit_price_check
      check (palette_unit_price is null or palette_unit_price >= 0);
  end if;
end;
$$;

comment on column public.crm_exchange_products.packaging_level is
  'Conditionnement utilisé pour exprimer la quantité associée à cet échange.';
comment on column public.crm_exchange_products.quantity is
  'Quantité dans le conditionnement sélectionné; nullable pour les anciennes associations.';
comment on column public.crm_exchange_products.uvc_unit_price is
  'Prix unitaire de base par UVC, en EUR; les tarifs PCB et palette se calculent depuis la fiche produit.';
comment on column public.crm_exchange_products.pcb_unit_price is
  'Prix unitaire PCB, en EUR, conservé comme instantané historique de l’annonce.';
comment on column public.crm_exchange_products.palette_unit_price is
  'Prix unitaire palette, en EUR, conservé comme instantané historique de l’annonce.';

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
    scenario, subscenario, entry_kind, content, status
  ) values (
    v_contact_id,
    coalesce(nullif(p_exchange->>'occurred_at', '')::timestamptz, now()),
    nullif(p_exchange->>'direction', ''),
    p_exchange->>'channel_kind',
    p_exchange->>'channel',
    p_exchange->>'category',
    coalesce(p_exchange->>'scenario', ''),
    coalesce(p_exchange->>'subscenario', ''),
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

grant select, insert, update, delete on public.crm_exchange_products to authenticated;
revoke all on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) to authenticated;

commit;
