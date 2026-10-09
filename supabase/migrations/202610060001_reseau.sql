begin;

create table if not exists public.network_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default '',
  legal_identifiers jsonb not null default '{}'::jsonb,
  headquarters_region text not null default '',
  headquarters_city text not null default '',
  headquarters_postal_code text not null default '',
  headquarters_address text not null default '',
  phone_country_code text not null default '',
  phone_number text not null default '',
  email text not null default '',
  website text not null default '',
  main_activity text not null default '',
  secondary_activities text not null default '',
  purchase_sales_zones text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.network_contacts (
  id uuid primary key default gen_random_uuid(),
  profile text not null check (profile in ('individual', 'professional')),
  last_name text not null,
  first_name text not null default '',
  job_role text not null default '',
  country text not null default '',
  region text not null default '',
  city text not null default '',
  postal_code text not null default '',
  address text not null default '',
  phone_country_code text not null default '',
  phone_number text not null default '',
  mobile_country_code text not null default '',
  mobile_number text not null default '',
  whatsapp_country_code text not null default '',
  whatsapp_number text not null default '',
  facebook_messenger_url text not null default '',
  linkedin_messenger_url text not null default '',
  email text not null default '',
  contact_source text not null default '',
  company_id uuid references public.network_companies(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint individual_contact_has_no_company check (profile <> 'individual' or company_id is null)
);

create table if not exists public.network_contact_social_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.network_contacts(id) on delete cascade,
  platform text not null,
  url text not null
);

create table if not exists public.network_company_social_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete cascade,
  platform text not null,
  url text not null
);

create table if not exists public.network_company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete cascade,
  region text not null default '',
  city text not null default '',
  postal_code text not null default '',
  address text not null
);

create table if not exists public.network_company_brands (
  company_id uuid not null references public.network_companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  primary key (company_id, brand_id)
);

create table if not exists public.network_company_categories (
  company_id uuid not null references public.network_companies(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  primary key (company_id, category_id)
);

create table if not exists public.network_reference_values (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('job_role', 'contact_source')),
  name text not null,
  unique (kind, name)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'network_companies', 'network_contacts', 'network_contact_social_links',
    'network_company_social_links', 'network_company_addresses',
    'network_company_brands', 'network_company_categories', 'network_reference_values'
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
  public.network_companies, public.network_contacts,
  public.network_contact_social_links, public.network_company_social_links,
  public.network_company_addresses, public.network_company_brands,
  public.network_company_categories, public.network_reference_values
to authenticated;

create or replace function public.save_network_records(
  p_contact jsonb default null,
  p_company jsonb default null,
  p_contact_id uuid default null,
  p_company_id uuid default null,
  p_contact_social_links jsonb default '[]'::jsonb,
  p_company_social_links jsonb default '[]'::jsonb,
  p_company_addresses jsonb default '[]'::jsonb,
  p_company_brand_ids uuid[] default '{}',
  p_company_category_ids uuid[] default '{}',
  p_company_contact_ids uuid[] default null
)
returns jsonb
language plpgsql
as $$
declare
  v_contact_id uuid := p_contact_id;
  v_company_id uuid := p_company_id;
  v_company_name text;
begin
  if p_company is not null then
    v_company_name := nullif(btrim(p_company->>'name'), '');
    if v_company_name is null then
      raise exception 'Le nom de la société est obligatoire.';
    end if;
    if v_company_id is null then
      insert into public.network_companies (
        name, country, legal_identifiers, headquarters_region, headquarters_city,
        headquarters_postal_code, headquarters_address, phone_country_code,
        phone_number, email, website, main_activity, secondary_activities,
        purchase_sales_zones
      ) values (
        v_company_name, coalesce(p_company->>'country', ''),
        coalesce(p_company->'legal_identifiers', '{}'::jsonb),
        coalesce(p_company->>'headquarters_region', ''),
        coalesce(p_company->>'headquarters_city', ''),
        coalesce(p_company->>'headquarters_postal_code', ''),
        coalesce(p_company->>'headquarters_address', ''),
        coalesce(p_company->>'phone_country_code', ''),
        coalesce(p_company->>'phone_number', ''),
        coalesce(p_company->>'email', ''),
        coalesce(p_company->>'website', ''),
        coalesce(p_company->>'main_activity', ''),
        coalesce(p_company->>'secondary_activities', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_company->'purchase_sales_zones', '[]'::jsonb))), '{}')
      ) returning id into v_company_id;
    else
      update public.network_companies set
        name = v_company_name,
        country = coalesce(p_company->>'country', ''),
        legal_identifiers = coalesce(p_company->'legal_identifiers', '{}'::jsonb),
        headquarters_region = coalesce(p_company->>'headquarters_region', ''),
        headquarters_city = coalesce(p_company->>'headquarters_city', ''),
        headquarters_postal_code = coalesce(p_company->>'headquarters_postal_code', ''),
        headquarters_address = coalesce(p_company->>'headquarters_address', ''),
        phone_country_code = coalesce(p_company->>'phone_country_code', ''),
        phone_number = coalesce(p_company->>'phone_number', ''),
        email = coalesce(p_company->>'email', ''),
        website = coalesce(p_company->>'website', ''),
        main_activity = coalesce(p_company->>'main_activity', ''),
        secondary_activities = coalesce(p_company->>'secondary_activities', ''),
        purchase_sales_zones = coalesce(array(select jsonb_array_elements_text(coalesce(p_company->'purchase_sales_zones', '[]'::jsonb))), '{}')
      where id = v_company_id;
      if not found then raise exception 'Société introuvable.'; end if;
    end if;

    delete from public.network_company_social_links where company_id = v_company_id;
    insert into public.network_company_social_links (company_id, platform, url)
    select v_company_id, btrim(platform), btrim(url)
    from jsonb_to_recordset(coalesce(p_company_social_links, '[]'::jsonb)) as link(platform text, url text)
    where nullif(btrim(platform), '') is not null and nullif(btrim(url), '') is not null;

    delete from public.network_company_addresses where company_id = v_company_id;
    insert into public.network_company_addresses (company_id, region, city, postal_code, address)
    select v_company_id, coalesce(region, ''), coalesce(city, ''), coalesce(postal_code, ''), btrim(address)
    from jsonb_to_recordset(coalesce(p_company_addresses, '[]'::jsonb)) as addr(region text, city text, postal_code text, address text)
    where nullif(btrim(address), '') is not null;

    delete from public.network_company_brands where company_id = v_company_id;
    insert into public.network_company_brands (company_id, brand_id)
    select v_company_id, selected.brand_id from unnest(coalesce(p_company_brand_ids, '{}'::uuid[])) as selected(brand_id)
    on conflict do nothing;

    delete from public.network_company_categories where company_id = v_company_id;
    insert into public.network_company_categories (company_id, category_id)
    select v_company_id, selected.category_id from unnest(coalesce(p_company_category_ids, '{}'::uuid[])) as selected(category_id)
    on conflict do nothing;

    if p_company_contact_ids is not null then
      update public.network_contacts
      set company_id = null
      where company_id = v_company_id and not (id = any(p_company_contact_ids));
      update public.network_contacts
      set company_id = v_company_id, profile = 'professional'
      where id = any(p_company_contact_ids);
    end if;
  end if;

  if p_contact is not null then
    if nullif(btrim(p_contact->>'last_name'), '') is null then
      raise exception 'Le nom du contact est obligatoire.';
    end if;
    if v_contact_id is null then
      insert into public.network_contacts (
        profile, last_name, first_name, job_role, country, region, city, postal_code,
        address, phone_country_code, phone_number, mobile_country_code, mobile_number,
        whatsapp_country_code, whatsapp_number, facebook_messenger_url,
        linkedin_messenger_url, email, contact_source, company_id
      ) values (
        case when v_company_id is not null then 'professional' else coalesce(p_contact->>'profile', 'individual') end,
        btrim(p_contact->>'last_name'), coalesce(p_contact->>'first_name', ''),
        coalesce(p_contact->>'job_role', ''), coalesce(p_contact->>'country', ''),
        coalesce(p_contact->>'region', ''), coalesce(p_contact->>'city', ''),
        coalesce(p_contact->>'postal_code', ''), coalesce(p_contact->>'address', ''),
        coalesce(p_contact->>'phone_country_code', ''), coalesce(p_contact->>'phone_number', ''),
        coalesce(p_contact->>'mobile_country_code', ''), coalesce(p_contact->>'mobile_number', ''),
        coalesce(p_contact->>'whatsapp_country_code', ''), coalesce(p_contact->>'whatsapp_number', ''),
        coalesce(p_contact->>'facebook_messenger_url', ''), coalesce(p_contact->>'linkedin_messenger_url', ''),
        coalesce(p_contact->>'email', ''), coalesce(p_contact->>'contact_source', ''),
        coalesce(v_company_id, nullif(p_contact->>'company_id', '')::uuid)
      ) returning id into v_contact_id;
    else
      update public.network_contacts set
        profile = case when v_company_id is not null then 'professional' else coalesce(p_contact->>'profile', 'individual') end,
        last_name = btrim(p_contact->>'last_name'),
        first_name = coalesce(p_contact->>'first_name', ''),
        job_role = coalesce(p_contact->>'job_role', ''),
        country = coalesce(p_contact->>'country', ''),
        region = coalesce(p_contact->>'region', ''),
        city = coalesce(p_contact->>'city', ''),
        postal_code = coalesce(p_contact->>'postal_code', ''),
        address = coalesce(p_contact->>'address', ''),
        phone_country_code = coalesce(p_contact->>'phone_country_code', ''),
        phone_number = coalesce(p_contact->>'phone_number', ''),
        mobile_country_code = coalesce(p_contact->>'mobile_country_code', ''),
        mobile_number = coalesce(p_contact->>'mobile_number', ''),
        whatsapp_country_code = coalesce(p_contact->>'whatsapp_country_code', ''),
        whatsapp_number = coalesce(p_contact->>'whatsapp_number', ''),
        facebook_messenger_url = coalesce(p_contact->>'facebook_messenger_url', ''),
        linkedin_messenger_url = coalesce(p_contact->>'linkedin_messenger_url', ''),
        email = coalesce(p_contact->>'email', ''),
        contact_source = coalesce(p_contact->>'contact_source', ''),
        company_id = coalesce(v_company_id, nullif(p_contact->>'company_id', '')::uuid)
      where id = v_contact_id;
      if not found then raise exception 'Contact introuvable.'; end if;
    end if;

    delete from public.network_contact_social_links where contact_id = v_contact_id;
    insert into public.network_contact_social_links (contact_id, platform, url)
    select v_contact_id, btrim(platform), btrim(url)
    from jsonb_to_recordset(coalesce(p_contact_social_links, '[]'::jsonb)) as link(platform text, url text)
    where nullif(btrim(platform), '') is not null and nullif(btrim(url), '') is not null;
  end if;

  return jsonb_build_object('contact_id', v_contact_id, 'company_id', v_company_id);
end;
$$;

revoke all on function public.save_network_records(jsonb, jsonb, uuid, uuid, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.save_network_records(jsonb, jsonb, uuid, uuid, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]) to authenticated;

commit;
