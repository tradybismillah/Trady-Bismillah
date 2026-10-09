begin;

create table if not exists public.business_issuers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null default '',
  country text not null default 'France',
  legal_identifiers jsonb not null default '{}'::jsonb,
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  email text not null default '',
  phone text not null default '',
  currency text not null default 'EUR' check (currency = 'EUR'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_issuers (
  legal_name, country, legal_identifiers, address, postal_code, city,
  email, phone, currency, is_default, updated_at
)
select
  profile.legal_name, profile.country, profile.legal_identifiers, profile.address,
  profile.postal_code, profile.city, profile.email, profile.phone, profile.currency,
  true, profile.updated_at
from public.business_profile profile
where profile.singleton
  and not exists (select 1 from public.business_issuers);

create unique index if not exists business_issuers_single_default_idx
  on public.business_issuers (is_default)
  where is_default;

alter table public.trade_documents
  add column if not exists issuer_id uuid references public.business_issuers(id) on delete restrict;

update public.trade_documents document
set issuer_id = issuer.id
from public.business_issuers issuer
where issuer.is_default and document.issuer_id is null;

create index if not exists trade_documents_issuer_idx
  on public.trade_documents (issuer_id);

create or replace function public.save_business_issuer(
  p_issuer_id uuid,
  p_issuer jsonb
)
returns uuid language plpgsql
as $$
declare
  v_issuer_id uuid;
  v_is_default boolean;
begin
  if nullif(btrim(p_issuer->>'legal_name'), '') is null then
    raise exception 'Le nom légal de la société est obligatoire.';
  end if;

  v_is_default := coalesce((p_issuer->>'is_default')::boolean, false);
  if p_issuer_id is null and not exists (select 1 from public.business_issuers) then
    v_is_default := true;
  end if;
  if v_is_default then
    update public.business_issuers set is_default = false where is_default;
  end if;

  if p_issuer_id is null then
    insert into public.business_issuers (
      legal_name, country, legal_identifiers, address, postal_code, city,
      email, phone, currency, is_default, updated_at
    ) values (
      btrim(p_issuer->>'legal_name'),
      coalesce(nullif(p_issuer->>'country', ''), 'France'),
      coalesce(p_issuer->'legal_identifiers', '{}'::jsonb),
      coalesce(p_issuer->>'address', ''),
      coalesce(p_issuer->>'postal_code', ''),
      coalesce(p_issuer->>'city', ''),
      coalesce(p_issuer->>'email', ''),
      coalesce(p_issuer->>'phone', ''),
      coalesce(nullif(p_issuer->>'currency', ''), 'EUR'),
      v_is_default,
      now()
    ) returning id into v_issuer_id;
  else
    update public.business_issuers
    set legal_name = btrim(p_issuer->>'legal_name'),
        country = coalesce(nullif(p_issuer->>'country', ''), 'France'),
        legal_identifiers = coalesce(p_issuer->'legal_identifiers', '{}'::jsonb),
        address = coalesce(p_issuer->>'address', ''),
        postal_code = coalesce(p_issuer->>'postal_code', ''),
        city = coalesce(p_issuer->>'city', ''),
        email = coalesce(p_issuer->>'email', ''),
        phone = coalesce(p_issuer->>'phone', ''),
        currency = coalesce(nullif(p_issuer->>'currency', ''), 'EUR'),
        is_default = v_is_default,
        updated_at = now()
    where id = p_issuer_id
    returning id into v_issuer_id;
    if v_issuer_id is null then raise exception 'La société émettrice à modifier est introuvable.'; end if;
  end if;
  return v_issuer_id;
end;
$$;

create or replace function public.delete_business_issuer(p_issuer_id uuid)
returns void language plpgsql
as $$
declare
  v_was_default boolean;
begin
  select is_default into v_was_default
  from public.business_issuers where id = p_issuer_id;
  if not found then raise exception 'La société émettrice à supprimer est introuvable.'; end if;

  delete from public.business_issuers where id = p_issuer_id;
  if v_was_default then
    update public.business_issuers
    set is_default = true
    where id = (
      select id from public.business_issuers
      order by created_at, id
      limit 1
    );
  end if;
end;
$$;

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
  update public.trade_documents set issuer_id = v_issuer_id where id = v_document_id;
  return v_document_id;
end;
$$;

alter table public.business_issuers enable row level security;
drop policy if exists "Authenticated users manage business_issuers" on public.business_issuers;
create policy "Authenticated users manage business_issuers"
  on public.business_issuers for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.business_issuers to authenticated;
revoke all on function public.save_business_issuer(uuid, jsonb) from public, anon;
grant execute on function public.save_business_issuer(uuid, jsonb) to authenticated;
revoke all on function public.delete_business_issuer(uuid) from public, anon;
grant execute on function public.delete_business_issuer(uuid) to authenticated;
revoke all on function public.save_trade_document_for_issuer(jsonb, jsonb) from public, anon;
grant execute on function public.save_trade_document_for_issuer(jsonb, jsonb) to authenticated;

commit;
