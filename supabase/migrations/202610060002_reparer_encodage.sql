begin;

create or replace function public.repair_catalogue_mojibake(value text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  current_value text := value;
  repaired_value text;
  attempt integer;
begin
  if value is null then
    return null;
  end if;

  for attempt in 1..3 loop
    if position(U&'\00c3' in current_value) = 0
      and position(U&'\00c2' in current_value) = 0
      and position(U&'\00e2' in current_value) = 0
      and position(U&'\fffd' in current_value) = 0 then
      exit;
    end if;

    begin
      repaired_value := convert_from(convert_to(current_value, 'WIN1252'), 'UTF8');
    exception when others then
      exit;
    end;

    if repaired_value = current_value then
      exit;
    end if;
    current_value := repaired_value;
  end loop;

  return current_value;
end;
$$;

revoke all on function public.repair_catalogue_mojibake(text) from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from public.brands damaged
    join public.brands existing
      on existing.name = public.repair_catalogue_mojibake(damaged.name)
     and existing.id <> damaged.id
    where public.repair_catalogue_mojibake(damaged.name) <> damaged.name
  ) then
    raise exception 'La réparation créerait un doublon de marque; aucune donnée n’a été modifiée.';
  end if;

  if exists (
    select 1 from public.manufacturers damaged
    join public.manufacturers existing
      on existing.legal_name = public.repair_catalogue_mojibake(damaged.legal_name)
     and existing.id <> damaged.id
    where public.repair_catalogue_mojibake(damaged.legal_name) <> damaged.legal_name
  ) then
    raise exception 'La réparation créerait un doublon de fabricant; aucune donnée n’a été modifiée.';
  end if;

  if exists (
    select 1 from public.product_categories damaged
    join public.product_categories existing
      on existing.name = public.repair_catalogue_mojibake(damaged.name)
     and existing.id <> damaged.id
    where public.repair_catalogue_mojibake(damaged.name) <> damaged.name
  ) then
    raise exception 'La réparation créerait un doublon de catégorie; aucune donnée n’a été modifiée.';
  end if;

  if exists (
    select 1 from public.product_subcategories damaged
    join public.product_subcategories existing
      on existing.category_id = damaged.category_id
     and existing.name = public.repair_catalogue_mojibake(damaged.name)
     and existing.id <> damaged.id
    where public.repair_catalogue_mojibake(damaged.name) <> damaged.name
  ) then
    raise exception 'La réparation créerait un doublon de sous-catégorie; aucune donnée n’a été modifiée.';
  end if;

  if exists (
    select 1 from public.packaging_types damaged
    join public.packaging_types existing
      on existing.level = damaged.level
     and existing.name = public.repair_catalogue_mojibake(damaged.name)
     and existing.id <> damaged.id
    where public.repair_catalogue_mojibake(damaged.name) <> damaged.name
  ) then
    raise exception 'La réparation créerait un doublon de type de conditionnement; aucune donnée n’a été modifiée.';
  end if;

  if exists (
    select 1 from public.products damaged
    join public.products existing
      on existing.ean_gtin = ''
     and existing.designation = public.repair_catalogue_mojibake(damaged.designation)
     and existing.id <> damaged.id
    where damaged.ean_gtin = ''
      and public.repair_catalogue_mojibake(damaged.designation) <> damaged.designation
  ) then
    raise exception 'La réparation créerait un doublon de produit sans EAN; aucune donnée n’a été modifiée.';
  end if;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any(array[
        'products', 'brands', 'manufacturers', 'product_categories',
        'product_subcategories', 'packaging_types', 'brand_social_links',
        'brand_documents', 'network_companies', 'network_contacts',
        'network_contact_social_links', 'network_company_social_links',
        'network_company_addresses', 'network_reference_values'
      ])
      and data_type in ('text', 'character varying', 'character')
    order by table_name, ordinal_position
  loop
    execute format(
      'update public.%I set %I = public.repair_catalogue_mojibake(%I) where public.repair_catalogue_mojibake(%I) is distinct from %I',
      item.table_name, item.column_name, item.column_name, item.column_name, item.column_name
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
drop function public.repair_catalogue_mojibake(text);

commit;
