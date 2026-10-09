begin;

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.business_services (name) values
  ('Transport'),
  ('Stockage'),
  ('Manutention')
on conflict (name) do nothing;

create table if not exists public.business_profile (
  singleton boolean primary key default true check (singleton),
  legal_name text not null default '',
  country text not null default 'France',
  legal_identifiers jsonb not null default '{}'::jsonb,
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  email text not null default '',
  phone text not null default '',
  currency text not null default 'EUR' check (currency = 'EUR'),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_exchanges (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  direction text check (direction in ('incoming', 'outgoing')),
  channel_kind text not null check (channel_kind in ('digital', 'physical')),
  channel text not null,
  category text not null check (category in ('trade', 'lead', 'open')),
  scenario text[] not null default '{}',
  subscenario text not null default '',
  entry_kind text not null default 'exchange' check (entry_kind in ('exchange', 'information', 'observation', 'alert')),
  content text not null default '',
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_exchanges_contact_time_idx
  on public.crm_exchanges (contact_id, occurred_at desc);
create index if not exists crm_exchanges_category_time_idx
  on public.crm_exchanges (category, occurred_at desc);

create table if not exists public.crm_exchange_products (
  exchange_id uuid not null references public.crm_exchanges(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  primary key (exchange_id, product_id)
);

create table if not exists public.crm_exchange_services (
  exchange_id uuid not null references public.crm_exchanges(id) on delete cascade,
  service_id uuid not null references public.business_services(id) on delete restrict,
  primary key (exchange_id, service_id)
);

create table if not exists public.crm_actions (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.crm_exchanges(id) on delete restrict,
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'done', 'cancelled')),
  assignee text not null default '',
  result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_actions_status_due_idx
  on public.crm_actions (status, due_at);
create index if not exists crm_actions_contact_idx
  on public.crm_actions (contact_id, created_at desc);

create or replace function public.save_crm_exchange(
  p_exchange jsonb,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}',
  p_action jsonb default null
)
returns uuid
language plpgsql
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

  insert into public.crm_exchange_products (exchange_id, product_id)
  select v_exchange_id, linked_id from unnest(coalesce(p_product_ids, '{}')) linked_id
  on conflict do nothing;
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

create table if not exists public.trade_documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  exchange_id uuid references public.crm_exchanges(id) on delete set null,
  related_document_id uuid references public.trade_documents(id) on delete set null,
  document_type text not null check (document_type in (
    'proforma', 'final_invoice', 'credit_note', 'delivery_note',
    'administrative', 'commercial', 'accounting', 'other'
  )),
  document_number text not null default '',
  document_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'received', 'sent', 'accepted', 'refused', 'stored')),
  notes text not null default '',
  file_path text,
  currency text not null default 'EUR' check (currency = 'EUR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_document_counters (
  document_type text not null check (document_type in ('proforma', 'final_invoice', 'credit_note')),
  document_year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (document_type, document_year)
);

alter table public.trade_document_counters enable row level security;

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

drop trigger if exists trade_documents_assign_number on public.trade_documents;
create trigger trade_documents_assign_number
before insert on public.trade_documents
for each row execute function public.assign_trade_document_number();

create unique index if not exists trade_documents_number_unique_idx
  on public.trade_documents (document_type, document_number)
  where document_number <> '';

create index if not exists trade_documents_contact_date_idx
  on public.trade_documents (contact_id, document_date desc);
create index if not exists trade_documents_exchange_idx
  on public.trade_documents (exchange_id);

create table if not exists public.trade_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.trade_documents(id) on delete cascade,
  line_number integer not null,
  item_type text not null check (item_type in ('product', 'service')),
  product_id uuid references public.products(id) on delete set null,
  service_id uuid references public.business_services(id) on delete set null,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  vat_rate numeric not null check (vat_rate >= 0 and vat_rate <= 100),
  vat_treatment text not null default 'domestic' check (vat_treatment in (
    'domestic', 'intra_community_goods', 'intra_community_services', 'other_exemption'
  )),
  unique (document_id, line_number),
  check (
    (item_type = 'product' and product_id is not null and service_id is null)
    or (item_type = 'service' and service_id is not null and product_id is null)
  )
);

create or replace function public.save_trade_document(
  p_document jsonb,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_document_id uuid;
begin
  insert into public.trade_documents (
    contact_id, exchange_id, related_document_id, document_type,
    document_date, status, notes, file_path
  ) values (
    nullif(p_document->>'contact_id', '')::uuid,
    nullif(p_document->>'exchange_id', '')::uuid,
    nullif(p_document->>'related_document_id', '')::uuid,
    p_document->>'document_type',
    coalesce(nullif(p_document->>'document_date', '')::date, current_date),
    coalesce(nullif(p_document->>'status', ''), 'draft'),
    coalesce(p_document->>'notes', ''),
    nullif(p_document->>'file_path', '')
  ) returning id into v_document_id;

  insert into public.trade_document_lines (
    document_id, line_number, item_type, product_id, service_id,
    description, quantity, unit_price, vat_rate, vat_treatment
  )
  select
    v_document_id, line.line_number, line.item_type, line.product_id, line.service_id,
    line.description, line.quantity, line.unit_price, line.vat_rate, line.vat_treatment
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(
    line_number integer,
    item_type text,
    product_id uuid,
    service_id uuid,
    description text,
    quantity numeric,
    unit_price numeric,
    vat_rate numeric,
    vat_treatment text
  );

  return v_document_id;
end;
$$;

create table if not exists public.trade_payments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  exchange_id uuid references public.crm_exchanges(id) on delete set null,
  document_id uuid references public.trade_documents(id) on delete set null,
  payment_date date not null default current_date,
  direction text not null check (direction in ('incoming', 'outgoing')),
  amount numeric not null check (amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'card')),
  bank_account_id uuid references public.business_bank_accounts(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (payment_method = 'bank_transfer' or bank_account_id is null)
);

create index if not exists trade_payments_contact_date_idx
  on public.trade_payments (contact_id, payment_date desc);

create table if not exists public.trade_expenses (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.network_contacts(id) on delete set null,
  expense_date date not null default current_date,
  amount numeric not null check (amount >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  category text not null,
  description text not null default '',
  payment_method text not null default '' check (payment_method in ('', 'cash', 'bank_transfer', 'card')),
  information text not null default '',
  receipt_path text,
  created_at timestamptz not null default now()
);

create index if not exists trade_expenses_date_idx
  on public.trade_expenses (expense_date desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_services', 'business_profile', 'business_bank_accounts',
    'crm_exchanges', 'crm_exchange_products', 'crm_exchange_services',
    'crm_actions', 'trade_documents', 'trade_document_lines',
    'trade_payments', 'trade_expenses'
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
  public.business_services, public.business_profile, public.business_bank_accounts,
  public.crm_exchanges, public.crm_exchange_products, public.crm_exchange_services,
  public.crm_actions, public.trade_documents, public.trade_document_lines,
  public.trade_payments, public.trade_expenses
to authenticated;

revoke delete on public.trade_documents from authenticated;
revoke all on function public.assign_trade_document_number() from public, anon, authenticated;
revoke all on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.save_crm_exchange(jsonb, uuid[], uuid[], jsonb) to authenticated;
revoke all on function public.save_trade_document(jsonb, jsonb) from public, anon;
grant execute on function public.save_trade_document(jsonb, jsonb) to authenticated;

commit;
