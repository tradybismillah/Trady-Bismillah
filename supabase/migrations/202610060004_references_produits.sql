begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.product_reference_prefix(value text)
returns text
language sql
stable
set search_path = pg_catalog, extensions
as $$
  select coalesce(
    nullif(rpad(left(regexp_replace(unaccent(upper(coalesce(value, ''))), '[^A-Z]', '', 'g'), 3), 3, 'X'), ''),
    'XXX'
  );
$$;

create or replace function public.assign_product_reference()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  reference_number bigint;
  category_name text;
begin
  reference_number := nextval('public.product_reference_sequence');
  if reference_number < 1 or reference_number > 5000 then
    raise exception 'La limite des 5 000 références produit est atteinte.';
  end if;

  select name into category_name
  from public.product_categories
  where id = new.category_id;

  new.internal_reference :=
    public.product_reference_prefix(new.designation) || '-' ||
    public.product_reference_prefix(coalesce(category_name, 'CAT')) || '-' ||
    lpad(reference_number::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists products_assign_reference on public.products;
create trigger products_assign_reference
before insert on public.products
for each row execute function public.assign_product_reference();

do $$
declare
  product_count bigint;
begin
  select count(*) into product_count from public.products;
  if product_count > 5000 then
    raise exception 'Il y a plus de 5 000 produits; aucune référence n’a été modifiée.';
  end if;
end;
$$;

update public.products
set internal_reference = 'TMP-' || id::text;

with numbered_products as (
  select
    products.id,
    public.product_reference_prefix(products.designation) as designation_prefix,
    public.product_reference_prefix(coalesce(categories.name, 'CAT')) as category_prefix,
    row_number() over (order by products.created_at, products.id) as position
  from public.products
  left join public.product_categories categories on categories.id = products.category_id
)
update public.products
set internal_reference =
  numbered_products.designation_prefix || '-' ||
  numbered_products.category_prefix || '-' ||
  lpad((5001 - numbered_products.position)::text, 5, '0')
from numbered_products
where products.id = numbered_products.id;

do $$
declare
  product_count bigint;
begin
  select count(*) into product_count from public.products;
  if product_count = 5000 then
    perform setval('public.product_reference_sequence', 1, true);
  else
    execute format(
      'alter sequence public.product_reference_sequence increment by -1 minvalue 1 maxvalue 5000 no cycle restart with %s',
      5000 - product_count
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
