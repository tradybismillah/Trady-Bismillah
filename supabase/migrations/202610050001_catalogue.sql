create extension if not exists pgcrypto;

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  logo_url text,
  country text,
  region text,
  city text,
  address text not null default '',
  postal_code text not null default '',
  website text not null default '',
  phone_country_code text not null default '',
  phone_number text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.product_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete cascade,
  name text not null,
  unique (category_id, name)
);

create table if not exists public.packaging_types (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('uvc', 'sub_uvc', 'pcb', 'palette')),
  name text not null,
  unique (level, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  internal_reference text not null unique,
  designation text not null,
  main_photo_url text,
  ean_gtin text not null default '',
  brand_id uuid,
  manufacturer_id uuid references public.manufacturers(id) on delete set null,
  product_origin text not null default '',
  category_id uuid references public.product_categories(id) on delete set null,
  subcategory_id uuid references public.product_subcategories(id) on delete set null,
  uvc text not null default '',
  uvc_photo_url text,
  uvc_type_id uuid references public.packaging_types(id) on delete set null,
  sub_uvc_type_id uuid references public.packaging_types(id) on delete set null,
  quantity_sub_uvc numeric,
  quantity_sub_uvc_unit text not null default 'unité',
  uvc_length_cm numeric,
  uvc_width_cm numeric,
  uvc_height_cm numeric,
  uvc_volume_m3 numeric generated always as (uvc_length_cm * uvc_width_cm * uvc_height_cm / 1000000) stored,
  uvc_gross_weight_kg numeric,
  pcb_photo_url text,
  pcb_type_id uuid references public.packaging_types(id) on delete set null,
  quantity_uvc_pcb numeric,
  pcb_length_cm numeric,
  pcb_width_cm numeric,
  pcb_height_cm numeric,
  pcb_volume_m3 numeric generated always as (pcb_length_cm * pcb_width_cm * pcb_height_cm / 1000000) stored,
  pcb_gross_weight_kg numeric,
  palette_photo_url text,
  palette_type_id uuid references public.packaging_types(id) on delete set null,
  quantity_pcb_palette numeric,
  quantity_uvc_palette numeric generated always as (quantity_uvc_pcb * quantity_pcb_palette) stored,
  palette_length_cm numeric,
  palette_width_cm numeric,
  palette_height_cm numeric,
  palette_volume_m3 numeric generated always as (palette_length_cm * palette_width_cm * palette_height_cm / 1000000) stored,
  palette_gross_weight_kg numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text not null default '',
  country_of_origin text,
  creation_year integer,
  owner_manufacturer_id uuid references public.manufacturers(id) on delete set null,
  email text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

alter table public.products
  add constraint products_brand_id_fkey foreign key (brand_id) references public.brands(id) on delete set null;
alter table public.products
  add constraint products_category_subcategory_match
  check (subcategory_id is null or category_id is not null);

create unique index if not exists manufacturers_legal_name_unique
  on public.manufacturers (legal_name);
create unique index if not exists brands_name_unique
  on public.brands (name);
create unique index if not exists products_ean_gtin_unique
  on public.products (ean_gtin)
  where ean_gtin <> '';
create unique index if not exists products_missing_ean_designation_unique
  on public.products (designation)
  where ean_gtin = '';

create table if not exists public.brand_categories (
  brand_id uuid not null references public.brands(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  primary key (brand_id, category_id)
);

create table if not exists public.brand_social_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  url text not null
);

create table if not exists public.brand_documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  file_name text not null,
  file_url text not null
);

create table if not exists public.manufacturer_products (
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (manufacturer_id, product_id)
);

create table if not exists public.manufacturer_brands (
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  primary key (manufacturer_id, brand_id)
);

create table if not exists public.manufacturer_categories (
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  primary key (manufacturer_id, category_id)
);

create sequence if not exists public.product_reference_sequence start 50000;

create or replace function public.assign_product_reference()
returns trigger
language plpgsql
as $$
declare
  reference_number bigint;
  designation_prefix text;
  category_prefix text;
  category_name text;
begin
  reference_number := nextval('public.product_reference_sequence');
  
  if reference_number > 99999 then
    raise exception 'La limite des 99 999 references produit est atteinte.';
  end if;
  
  designation_prefix := upper(
    substring(
      regexp_replace(
        unaccent(new.designation),
        '[^a-zA-Z0-9]', '', 'g'
      ),
      1, 3
    )
  );
  
  select name into category_name
  from public.product_categories 
  where id = new.category_id 
  limit 1;
  
  if category_name is null then
    category_name := 'CAT';
  end if;
  
  category_prefix := upper(
    substring(
      regexp_replace(
        unaccent(category_name),
        '[^a-zA-Z0-9]', '', 'g'
      ),
      1, 3
    )
  );
  
  new.internal_reference := designation_prefix || '-' || category_prefix || '-' || lpad(reference_number::text, 5, '0');
  
  return new;
end;
$$;

drop trigger if exists products_assign_reference on public.products;
create trigger products_assign_reference
before insert on public.products
for each row execute function public.assign_product_reference();

alter table public.manufacturers enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_subcategories enable row level security;
alter table public.packaging_types enable row level security;
alter table public.brand_categories enable row level security;
alter table public.brand_social_links enable row level security;
alter table public.brand_documents enable row level security;
alter table public.manufacturer_products enable row level security;
alter table public.manufacturer_brands enable row level security;
alter table public.manufacturer_categories enable row level security;

do $$ 
declare
  table_name text;
begin
  foreach table_name in array array[
    'manufacturers', 'brands', 'products', 'product_categories',
    'product_subcategories', 'packaging_types', 'brand_categories',
    'brand_social_links', 'brand_documents', 'manufacturer_products',
    'manufacturer_brands', 'manufacturer_categories'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Authenticated users manage ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'Authenticated users manage ' || table_name,
      table_name
    );
  end loop;
end;
$$;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on sequence public.product_reference_sequence to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogue-media',
  'catalogue-media',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'application/pdf', 'text/csv', 'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload catalogue media" on storage.objects;
create policy "Authenticated users upload catalogue media"
on storage.objects for insert to authenticated
with check (bucket_id = 'catalogue-media');

drop policy if exists "Authenticated users update catalogue media" on storage.objects;
create policy "Authenticated users update catalogue media"
on storage.objects for update to authenticated
using (bucket_id = 'catalogue-media')
with check (bucket_id = 'catalogue-media');

drop policy if exists "Authenticated users delete catalogue media" on storage.objects;
create policy "Authenticated users delete catalogue media"
on storage.objects for delete to authenticated
using (bucket_id = 'catalogue-media');

drop policy if exists "Public catalogue media is readable" on storage.objects;
drop policy if exists "Authenticated users read catalogue media" on storage.objects;
create policy "Authenticated users read catalogue media"
on storage.objects for select to authenticated
using (bucket_id = 'catalogue-media');
