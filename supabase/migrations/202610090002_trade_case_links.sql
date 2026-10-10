begin;

-- Attach commercial records to the dossier that contains their full history.
alter table public.crm_exchange_cases
  add column if not exists trade_stage text not null default 'qualification'
    check (trade_stage in ('qualification', 'sourcing', 'supplier_wait', 'client_offer', 'client_wait', 'confirmed', 'documents', 'delivery', 'claim', 'completed')),
  add column if not exists primary_contact_role text not null default 'other'
    check (primary_contact_role in ('customer', 'supplier', 'logistics', 'other'));

alter table public.crm_exchange_case_contacts
  add column if not exists relationship_role text not null default 'other'
    check (relationship_role in ('customer', 'supplier', 'logistics', 'other'));

alter table public.trade_documents
  add column if not exists case_id uuid references public.crm_exchange_cases(id) on delete set null,
  add column if not exists counterparty_role text not null default 'other'
    check (counterparty_role in ('customer', 'supplier', 'other'));

alter table public.trade_payments
  add column if not exists case_id uuid references public.crm_exchange_cases(id) on delete set null,
  add column if not exists counterparty_role text not null default 'other'
    check (counterparty_role in ('customer', 'supplier', 'other'));

alter table public.trade_expenses
  add column if not exists case_id uuid references public.crm_exchange_cases(id) on delete set null;

create table if not exists public.business_issuer_document_templates (
  issuer_id uuid primary key references public.business_issuers(id) on delete cascade,
  logo_path text,
  primary_color text not null default '#244d3c' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#6f806f' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  header_text text not null default '',
  footer_text text not null default '',
  updated_at timestamptz not null default now()
);

-- Preserve links for existing records using the exchange's known dossier.
update public.trade_documents document
set case_id = exchange.case_id
from public.crm_exchanges exchange
where document.exchange_id = exchange.id
  and document.case_id is null
  and exchange.case_id is not null;

update public.trade_payments payment
set case_id = exchange.case_id
from public.crm_exchanges exchange
where payment.exchange_id = exchange.id
  and payment.case_id is null
  and exchange.case_id is not null;

create index if not exists trade_documents_case_date_idx
  on public.trade_documents (case_id, document_date desc);
create index if not exists trade_payments_case_date_idx
  on public.trade_payments (case_id, payment_date desc);
create index if not exists trade_expenses_case_date_idx
  on public.trade_expenses (case_id, expense_date desc);

alter table public.business_issuer_document_templates enable row level security;
drop policy if exists "Authenticated users manage business_issuer_document_templates"
  on public.business_issuer_document_templates;
create policy "Authenticated users manage business_issuer_document_templates"
  on public.business_issuer_document_templates for all to authenticated
  using (true) with check (true);
grant select, insert, update, delete on public.business_issuer_document_templates to authenticated;

create or replace function public.save_trade_document_for_issuer(
  p_document jsonb,
  p_lines jsonb default '[]'::jsonb
)
returns uuid language plpgsql
as $$
declare
  v_issuer_id uuid;
  v_document_id uuid;
begin
  v_issuer_id := nullif(p_document->>'issuer_id', '')::uuid;
  if v_issuer_id is null then raise exception 'Choisissez une société émettrice pour ce document.'; end if;
  if not exists (select 1 from public.business_issuers where id = v_issuer_id) then
    raise exception 'La société émettrice sélectionnée est introuvable.';
  end if;

  v_document_id := public.save_trade_document(p_document, p_lines);
  update public.trade_documents
  set issuer_id = v_issuer_id,
      case_id = nullif(p_document->>'case_id', '')::uuid,
      counterparty_role = coalesce(nullif(p_document->>'counterparty_role', ''), 'other')
  where id = v_document_id;
  return v_document_id;
end;
$$;

revoke all on function public.save_trade_document_for_issuer(jsonb, jsonb) from public, anon;
grant execute on function public.save_trade_document_for_issuer(jsonb, jsonb) to authenticated;

-- Number documents only when they leave draft, so discarded drafts do not use a sequence number.
create or replace function public.assign_trade_document_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_number integer;
  v_prefix text;
begin
  if new.document_type not in ('proforma', 'final_invoice', 'credit_note') then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.document_number, '') <> '' then
    new.document_number := old.document_number;
    return new;
  end if;

  if new.status not in ('sent', 'accepted') then
    new.document_number := '';
    return new;
  end if;

  insert into public.trade_document_counters (document_type, document_year, last_number)
  values (new.document_type, extract(year from new.document_date)::integer, 1)
  on conflict (document_type, document_year)
  do update set last_number = trade_document_counters.last_number + 1
  returning last_number into v_number;

  v_prefix := case new.document_type
    when 'proforma' then 'PRO'
    when 'final_invoice' then 'FAC'
    else 'AVO'
  end;
  new.document_number := format('%s-%s-%s', v_prefix, extract(year from new.document_date)::integer, lpad(v_number::text, 5, '0'));
  return new;
end;
$$;

revoke all on function public.assign_trade_document_number() from public, anon, authenticated;

drop trigger if exists trade_documents_assign_number on public.trade_documents;
create trigger trade_documents_assign_number
before insert or update on public.trade_documents
for each row execute function public.assign_trade_document_number();

commit;
