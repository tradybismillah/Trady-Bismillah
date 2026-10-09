begin;

create or replace function public.sync_manufacturer_product_link()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.manufacturer_id is not null then
    insert into public.manufacturer_products (manufacturer_id, product_id)
    values (new.manufacturer_id, new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

insert into public.manufacturer_products (manufacturer_id, product_id)
select manufacturer_id, id
from public.products
where manufacturer_id is not null
on conflict do nothing;

drop trigger if exists products_sync_manufacturer_link on public.products;
create trigger products_sync_manufacturer_link
after insert or update of manufacturer_id on public.products
for each row execute function public.sync_manufacturer_product_link();

alter table public.network_contacts
  add column if not exists is_company_default boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_default_contact_is_professional'
      and conrelid = 'public.network_contacts'::regclass
  ) then
    alter table public.network_contacts
      add constraint company_default_contact_is_professional
      check (not is_company_default or profile = 'professional');
  end if;
end;
$$;

create unique index if not exists network_contacts_one_company_default_idx
  on public.network_contacts (company_id)
  where is_company_default;

create or replace function public.detach_company_default_contact()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  update public.network_contacts
  set is_company_default = false,
      first_name = '',
      job_role = 'Contact de société'
  where company_id = old.id
    and is_company_default;

  return old;
end;
$$;

drop trigger if exists network_companies_detach_default_contact on public.network_companies;
create trigger network_companies_detach_default_contact
before delete on public.network_companies
for each row execute function public.detach_company_default_contact();

insert into public.network_contacts (
  profile, last_name, first_name, job_role, country, region, city, postal_code,
  address, phone_country_code, phone_number, email, company_id, is_company_default
)
select
  'professional', company.name, 'Contact général', 'Contact général',
  company.country, company.headquarters_region, company.headquarters_city,
  company.headquarters_postal_code, company.headquarters_address,
  company.phone_country_code, company.phone_number, company.email,
  company.id, true
from public.network_companies as company
where not exists (
  select 1
  from public.network_contacts as contact
  where contact.company_id = company.id
);

create or replace function public.ensure_company_default_contact(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.network_companies%rowtype;
  v_contact_id uuid;
begin
  select *
  into v_company
  from public.network_companies
  where id = p_company_id
  for update;

  if not found then
    raise exception 'Société introuvable.';
  end if;

  select id
  into v_contact_id
  from public.network_contacts
  where company_id = p_company_id
    and is_company_default
  limit 1;

  if v_contact_id is null and exists (
    select 1
    from public.network_contacts
    where company_id = p_company_id
  ) then
    return null;
  end if;

  if v_contact_id is null then
    insert into public.network_contacts (
      profile, last_name, first_name, job_role, country, region, city,
      postal_code, address, phone_country_code, phone_number, email,
      company_id, is_company_default
    ) values (
      'professional', v_company.name, 'Contact général', 'Contact général',
      v_company.country, v_company.headquarters_region, v_company.headquarters_city,
      v_company.headquarters_postal_code, v_company.headquarters_address,
      v_company.phone_country_code, v_company.phone_number, v_company.email,
      v_company.id, true
    )
    returning id into v_contact_id;
  else
    update public.network_contacts
    set last_name = v_company.name,
        first_name = 'Contact général',
        job_role = 'Contact général',
        country = v_company.country,
        region = v_company.headquarters_region,
        city = v_company.headquarters_city,
        postal_code = v_company.headquarters_postal_code,
        address = v_company.headquarters_address,
        phone_country_code = v_company.phone_country_code,
        phone_number = v_company.phone_number,
        email = v_company.email
    where id = v_contact_id;
  end if;

  return v_contact_id;
end;
$$;

revoke all on function public.ensure_company_default_contact(uuid) from public, anon;
grant execute on function public.ensure_company_default_contact(uuid) to authenticated;

commit;
