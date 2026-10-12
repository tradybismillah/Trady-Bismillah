begin;

alter table public.crm_actions
  add column if not exists action_type text not null default 'follow_up';

alter table public.crm_actions
  drop constraint if exists crm_actions_action_type_check;
alter table public.crm_actions
  add constraint crm_actions_action_type_check check (action_type in (
    'follow_up', 'supplier_request', 'customer_reply', 'send_offer', 'send_listing',
    'verify_availability', 'prepare_document', 'price_check', 'market_research', 'delivery_claim'
  ));

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
  if p_action is not null then
    update public.crm_actions set
      action_type = coalesce(nullif(p_action->>'action_type', ''), 'follow_up'),
      contact_id = coalesce(nullif(p_action->>'contact_id', '')::uuid, contact_id),
      description = coalesce(p_action->>'description', description),
      priority = coalesce(nullif(p_action->>'priority', ''), priority),
      updated_at = now()
    where exchange_id = v_exchange_id;
  end if;
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
  if p_action is not null then
    update public.crm_actions set
      action_type = coalesce(nullif(p_action->>'action_type', ''), action_type),
      contact_id = coalesce(nullif(p_action->>'contact_id', '')::uuid, contact_id),
      description = coalesce(p_action->>'description', description),
      priority = coalesce(nullif(p_action->>'priority', ''), priority),
      updated_at = now()
    where exchange_id = v_exchange_id;
  end if;
  return v_exchange_id;
end;
$$;

revoke all on function public.save_crm_exchange_logistics(jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_crm_exchange_logistics(jsonb, uuid[], uuid[], jsonb) to authenticated;
revoke all on function public.update_crm_exchange_logistics(uuid, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.update_crm_exchange_logistics(uuid, jsonb, uuid[], uuid[], jsonb) to authenticated;

commit;
