begin;

alter table public.trade_document_lines
  add column if not exists service_details jsonb not null default '{}'::jsonb;

create or replace function public.save_trade_document_for_issuer(
  p_document jsonb,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_issuer_id uuid;
  v_document_id uuid;
begin
  v_issuer_id := nullif(p_document->>'issuer_id', '')::uuid;
  if v_issuer_id is null then
    raise exception 'Choisissez une société émettrice pour ce document.';
  end if;
  if not exists (select 1 from public.business_issuers where id = v_issuer_id) then
    raise exception 'La société émettrice sélectionnée est introuvable.';
  end if;

  v_document_id := public.save_trade_document(p_document, p_lines);
  update public.trade_documents
  set issuer_id = v_issuer_id,
      case_id = nullif(p_document->>'case_id', '')::uuid,
      counterparty_role = coalesce(nullif(p_document->>'counterparty_role', ''), 'other')
  where id = v_document_id;

  update public.trade_document_lines saved_line
  set service_details = coalesce(line_data.value->'service_details', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as line_data(value)
  where saved_line.document_id = v_document_id
    and saved_line.item_type = 'service'
    and saved_line.line_number = (line_data.value->>'line_number')::integer;

  return v_document_id;
end;
$$;

revoke all on function public.save_trade_document_for_issuer(jsonb, jsonb) from public, anon;
grant execute on function public.save_trade_document_for_issuer(jsonb, jsonb) to authenticated;

commit;
