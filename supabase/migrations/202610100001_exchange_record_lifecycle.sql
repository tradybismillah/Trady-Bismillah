begin;

create or replace function public.cancel_crm_exchange(p_exchange_id uuid)
returns uuid
language plpgsql
as $$
begin
  update public.crm_exchanges
  set status = 'cancelled',
      revision = revision + 1,
      updated_at = now()
  where id = p_exchange_id;

  if not found then
    raise exception 'La fiche échange à annuler est introuvable.';
  end if;

  update public.crm_actions
  set status = 'cancelled', updated_at = now()
  where exchange_id = p_exchange_id
    and status in ('todo', 'in_progress', 'waiting');

  return p_exchange_id;
end;
$$;

create or replace function public.delete_crm_exchange(p_exchange_id uuid)
returns uuid
language plpgsql
as $$
begin
  delete from public.crm_actions where exchange_id = p_exchange_id;

  delete from public.crm_exchanges where id = p_exchange_id;
  if not found then
    raise exception 'La fiche échange à supprimer est introuvable.';
  end if;

  return p_exchange_id;
end;
$$;

revoke all on function public.cancel_crm_exchange(uuid) from public, anon;
grant execute on function public.cancel_crm_exchange(uuid) to authenticated;
revoke all on function public.delete_crm_exchange(uuid) from public, anon;
grant execute on function public.delete_crm_exchange(uuid) to authenticated;

commit;
