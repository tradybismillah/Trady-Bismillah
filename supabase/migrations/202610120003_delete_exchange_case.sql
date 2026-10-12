begin;

create or replace function public.delete_crm_exchange_case(p_case_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_exchange_id uuid;
begin
  perform 1
  from public.crm_exchange_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Le dossier à supprimer est introuvable.';
  end if;

  for v_exchange_id in
    select id
    from public.crm_exchanges
    where case_id = p_case_id
  loop
    perform public.delete_crm_exchange(v_exchange_id);
  end loop;

  delete from public.crm_exchange_cases
  where id = p_case_id;

  return p_case_id;
end;
$$;

revoke all on function public.delete_crm_exchange_case(uuid) from public, anon;
grant execute on function public.delete_crm_exchange_case(uuid) to authenticated;

commit;
