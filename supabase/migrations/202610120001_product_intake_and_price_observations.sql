begin;

create table if not exists public.product_import_batches (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  exchange_id uuid references public.crm_exchanges(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  source_role text not null default 'supplier' check (source_role in ('supplier', 'customer', 'other')),
  price_side text not null default 'purchase' check (price_side in ('purchase', 'sale')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  eur_per_currency_unit numeric(18, 8) check (eur_per_currency_unit is null or eur_per_currency_unit > 0),
  source_location text not null default '',
  status text not null default 'review' check (status in ('review', 'partial', 'completed', 'cancelled')),
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.product_import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  designation text not null default '',
  ean_gtin text not null default '',
  source_reference text not null default '',
  brand_name text not null default '',
  manufacturer_name text not null default '',
  category_name text not null default '',
  uvc text not null default '',
  quantity_uvc_pcb numeric(18, 4) check (quantity_uvc_pcb is null or quantity_uvc_pcb > 0),
  quantity_pcb_palette numeric(18, 4) check (quantity_pcb_palette is null or quantity_pcb_palette > 0),
  source_price numeric(18, 6) check (source_price is null or source_price >= 0),
  source_price_basis text not null default 'uvc' check (source_price_basis in ('uvc', 'pcb', 'palette')),
  price_per_uvc numeric(18, 6) check (price_per_uvc is null or price_per_uvc >= 0),
  matched_product_id uuid references public.products(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'matched', 'validated', 'rejected')),
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists public.product_price_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  contact_id uuid references public.network_contacts(id) on delete set null,
  exchange_id uuid references public.crm_exchanges(id) on delete set null,
  import_row_id uuid unique references public.product_import_rows(id) on delete set null,
  price_type text not null check (price_type in ('traded', 'announced', 'observed')),
  side text not null check (side in ('purchase', 'sale')),
  amount_per_uvc numeric(18, 6) not null check (amount_per_uvc >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  eur_per_uvc numeric(18, 6) check (eur_per_uvc is null or eur_per_uvc >= 0),
  eur_per_currency_unit numeric(18, 8) check (eur_per_currency_unit is null or eur_per_currency_unit > 0),
  occurred_at date not null default current_date,
  valid_until date,
  source_location text not null default '',
  source_note text not null default '',
  source_url text not null default '',
  evidence_path text not null default '',
  confidence smallint not null default 3 check (confidence between 1 and 5),
  uvc_per_pcb_snapshot numeric(18, 4),
  uvc_per_palette_snapshot numeric(18, 4),
  status text not null default 'validated' check (status in ('pending', 'validated', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= occurred_at)
);

create index if not exists product_import_batches_contact_created_idx
  on public.product_import_batches (contact_id, created_at desc);
create index if not exists product_import_rows_batch_status_idx
  on public.product_import_rows (batch_id, status, row_number);
create index if not exists product_price_observations_product_side_date_idx
  on public.product_price_observations (product_id, side, occurred_at desc)
  where status = 'validated';
create index if not exists product_price_observations_contact_idx
  on public.product_price_observations (contact_id, occurred_at desc);

alter table public.product_import_batches enable row level security;
alter table public.product_import_rows enable row level security;
alter table public.product_price_observations enable row level security;

drop policy if exists "Authenticated users manage product_import_batches" on public.product_import_batches;
create policy "Authenticated users manage product_import_batches"
  on public.product_import_batches for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users manage product_import_rows" on public.product_import_rows;
create policy "Authenticated users manage product_import_rows"
  on public.product_import_rows for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users manage product_price_observations" on public.product_price_observations;
create policy "Authenticated users manage product_price_observations"
  on public.product_price_observations for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.product_import_batches to authenticated;
grant select, insert, update, delete on public.product_import_rows to authenticated;
grant select, insert, update, delete on public.product_price_observations to authenticated;

create or replace function public.validate_product_import_row(
  p_row_id uuid,
  p_matched_product_id uuid default null,
  p_product jsonb default null
)
returns uuid
language plpgsql
as $$
declare
  v_row public.product_import_rows%rowtype;
  v_batch public.product_import_batches%rowtype;
  v_product_id uuid;
  v_uvc_per_pcb numeric;
  v_uvc_per_palette numeric;
  v_price_per_uvc numeric;
  v_pending integer;
  v_validated integer;
begin
  select * into v_row from public.product_import_rows where id = p_row_id for update;
  if not found then raise exception 'La ligne d’import est introuvable.'; end if;
  if v_row.status in ('validated', 'rejected') then raise exception 'Cette ligne a déjà été traitée.'; end if;
  select * into v_batch from public.product_import_batches where id = v_row.batch_id for update;
  if not found then raise exception 'L’importation est introuvable.'; end if;

  if p_matched_product_id is not null then
    select id, quantity_uvc_pcb, quantity_uvc_palette
      into v_product_id, v_uvc_per_pcb, v_uvc_per_palette
      from public.products where id = p_matched_product_id;
    if not found then raise exception 'Le produit associé est introuvable.'; end if;
  else
    if p_product is null or nullif(btrim(p_product->>'designation'), '') is null then
      raise exception 'Une désignation est obligatoire pour créer le produit.';
    end if;
    insert into public.products (
      designation, ean_gtin, brand_id, manufacturer_id, category_id,
      uvc, quantity_uvc_pcb, quantity_pcb_palette
    ) values (
      btrim(p_product->>'designation'), coalesce(nullif(btrim(p_product->>'ean_gtin'), ''), ''),
      nullif(p_product->>'brand_id', '')::uuid,
      nullif(p_product->>'manufacturer_id', '')::uuid,
      nullif(p_product->>'category_id', '')::uuid,
      coalesce(p_product->>'uvc', ''),
      nullif(p_product->>'quantity_uvc_pcb', '')::numeric,
      nullif(p_product->>'quantity_pcb_palette', '')::numeric
    ) returning id, quantity_uvc_pcb, quantity_uvc_palette
      into v_product_id, v_uvc_per_pcb, v_uvc_per_palette;
  end if;

  v_price_per_uvc := null;
  if v_row.source_price is not null then
    if v_row.source_price_basis = 'uvc' then
      v_price_per_uvc := v_row.source_price;
    elsif v_row.source_price_basis = 'pcb' and v_uvc_per_pcb > 0 then
      v_price_per_uvc := v_row.source_price / v_uvc_per_pcb;
    elsif v_row.source_price_basis = 'palette' and v_uvc_per_palette > 0 then
      v_price_per_uvc := v_row.source_price / v_uvc_per_palette;
    else
      raise exception 'Renseigne les quantités UVC par colis et par palette avant de valider le prix de cette ligne.';
    end if;
  else
    v_price_per_uvc := v_row.price_per_uvc;
  end if;

  if v_price_per_uvc is not null and v_price_per_uvc > 0 then
    insert into public.product_price_observations (
      product_id, contact_id, exchange_id, import_row_id, price_type, side,
      amount_per_uvc, currency, eur_per_uvc, eur_per_currency_unit,
      occurred_at, source_location, source_note, evidence_path, confidence,
      uvc_per_pcb_snapshot, uvc_per_palette_snapshot, status
    ) values (
      v_product_id, v_batch.contact_id, v_batch.exchange_id, v_row.id,
      'announced', v_batch.price_side, v_price_per_uvc, v_batch.currency,
      case when v_batch.currency = 'EUR' then v_price_per_uvc
        when v_batch.eur_per_currency_unit is not null then v_price_per_uvc * v_batch.eur_per_currency_unit
        else null end,
      v_batch.eur_per_currency_unit, current_date, v_batch.source_location,
      'Prix extrait du listing : ' || v_batch.file_name, v_batch.storage_path, 3,
      v_uvc_per_pcb, v_uvc_per_palette, 'validated'
    );
  end if;

  update public.product_import_rows set
    matched_product_id = p_matched_product_id,
    product_id = v_product_id,
    status = 'validated',
    updated_at = now()
  where id = v_row.id;

  select count(*) filter (where status in ('pending', 'matched')),
         count(*) filter (where status = 'validated')
    into v_pending, v_validated
    from public.product_import_rows where batch_id = v_batch.id;
  update public.product_import_batches set
    status = case when v_pending > 0 and v_validated > 0 then 'partial'
      when v_pending = 0 then 'completed' else 'review' end,
    updated_at = now()
  where id = v_batch.id;
  return v_product_id;
end;
$$;

grant execute on function public.validate_product_import_row(uuid, uuid, jsonb) to authenticated;

commit;
