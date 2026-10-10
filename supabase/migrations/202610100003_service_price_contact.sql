begin;

alter table public.business_service_price_history
  add column if not exists contact_id uuid references public.network_contacts(id) on delete set null;

create index if not exists business_service_price_history_contact_idx
  on public.business_service_price_history (contact_id)
  where contact_id is not null;

-- Replace the previous four-argument RPC so a price and its source contact
-- are recorded together in one transaction.
drop function if exists public.save_business_service_price(uuid, numeric, date, text);

create function public.save_business_service_price(
  p_service_id uuid,
  p_price_ht numeric,
  p_effective_at date default current_date,
  p_note text default '',
  p_contact_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_history_id uuid;
  v_latest_price numeric(12, 2);
begin
  if p_price_ht is null or p_price_ht < 0 then
    raise exception 'Le prix forfaitaire HT doit être supérieur ou égal à zéro.';
  end if;
  if not exists (
    select 1 from public.business_services
    where id = p_service_id and is_catalog_item
  ) then
    raise exception 'La prestation à tarifer est introuvable.';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.network_contacts where id = p_contact_id
  ) then
    raise exception 'Le contact associé est introuvable.';
  end if;

  insert into public.business_service_price_history
    (service_id, price_ht, effective_at, note, contact_id)
  values
    (p_service_id, p_price_ht, coalesce(p_effective_at, current_date), coalesce(p_note, ''), p_contact_id)
  returning id into v_history_id;

  select price_ht into v_latest_price
  from public.business_service_price_history
  where service_id = p_service_id
  order by effective_at desc, created_at desc
  limit 1;

  update public.business_services
  set default_price_ht = v_latest_price, updated_at = now()
  where id = p_service_id;

  return v_history_id;
end;
$$;

revoke all on function public.save_business_service_price(uuid, numeric, date, text, uuid) from public, anon;
grant execute on function public.save_business_service_price(uuid, numeric, date, text, uuid) to authenticated;

commit;
