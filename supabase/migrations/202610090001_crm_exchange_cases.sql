begin;

-- A case groups a commercial request and its later calls, messages and decisions.
create table if not exists public.crm_exchange_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  contact_id uuid not null references public.network_contacts(id) on delete restrict,
  category text not null check (category in ('trade', 'lead', 'open')),
  case_kind text not null default 'other',
  case_data jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'waiting', 'closed_no_followup', 'converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_exchange_cases
  add column if not exists case_kind text not null default 'other',
  add column if not exists case_data jsonb not null default '{}'::jsonb;

create table if not exists public.crm_exchange_case_contacts (
  case_id uuid not null references public.crm_exchange_cases(id) on delete cascade,
  contact_id uuid not null references public.network_contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, contact_id)
);

create table if not exists public.crm_exchange_case_media (
  case_id uuid not null references public.crm_exchange_cases(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_id, media_asset_id)
);

alter table public.crm_exchanges
  add column if not exists case_id uuid references public.crm_exchange_cases(id) on delete set null;

create index if not exists crm_exchange_cases_contact_updated_idx
  on public.crm_exchange_cases (contact_id, updated_at desc);
create index if not exists crm_exchange_cases_status_updated_idx
  on public.crm_exchange_cases (status, updated_at desc);
create index if not exists crm_exchange_case_contacts_contact_idx
  on public.crm_exchange_case_contacts (contact_id, case_id);
create index if not exists crm_exchanges_case_time_idx
  on public.crm_exchanges (case_id, occurred_at desc);

alter table public.crm_exchange_cases enable row level security;
alter table public.crm_exchange_case_contacts enable row level security;
alter table public.crm_exchange_case_media enable row level security;

drop policy if exists "Owner access" on public.crm_exchange_cases;
create policy "Owner access" on public.crm_exchange_cases
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com');

drop policy if exists "Owner access" on public.crm_exchange_case_contacts;
create policy "Owner access" on public.crm_exchange_case_contacts
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com');

drop policy if exists "Owner access" on public.crm_exchange_case_media;
create policy "Owner access" on public.crm_exchange_case_media
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com');

grant select, insert, update, delete on public.crm_exchange_cases, public.crm_exchange_case_contacts, public.crm_exchange_case_media to authenticated;

create or replace function public.create_crm_exchange_case(
  p_title text,
  p_exchange jsonb,
  p_contact_ids uuid[] default '{}',
  p_action jsonb default null,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_case_id uuid;
  v_exchange_id uuid;
  v_primary_contact_id uuid;
  v_category text;
begin
  v_primary_contact_id := nullif(p_exchange->>'contact_id', '')::uuid;
  v_category := p_exchange->>'category';
  if v_primary_contact_id is null then raise exception 'Un contact est obligatoire.'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'Un objet est obligatoire pour le dossier.'; end if;

  insert into public.crm_exchange_cases (title, contact_id, category, case_kind, case_data)
  values (btrim(p_title), v_primary_contact_id, v_category, coalesce(nullif(p_exchange->>'case_kind', ''), 'other'), coalesce(p_exchange->'case_data', '{}'::jsonb))
  returning id into v_case_id;

  insert into public.crm_exchange_case_contacts (case_id, contact_id)
  select v_case_id, linked_contact_id
  from unnest(coalesce(p_contact_ids, '{}')) as selected(linked_contact_id)
  where linked_contact_id is not null and linked_contact_id <> v_primary_contact_id
  on conflict do nothing;

  v_exchange_id := public.save_crm_exchange_logistics(p_exchange, p_product_ids, p_service_ids, p_action);
  update public.crm_exchanges set case_id = v_case_id where id = v_exchange_id;
  return v_case_id;
end;
$$;

create or replace function public.add_crm_exchange_case_entry(
  p_case_id uuid,
  p_exchange jsonb,
  p_action jsonb default null,
  p_product_ids uuid[] default '{}',
  p_service_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_exchange_id uuid;
  v_primary_contact_id uuid;
  v_event_contact_id uuid;
  v_exchange jsonb;
begin
  select contact_id into v_primary_contact_id
  from public.crm_exchange_cases
  where id = p_case_id;
  if not found then raise exception 'Dossier introuvable.'; end if;

  v_exchange := p_exchange;
  v_event_contact_id := nullif(v_exchange->>'contact_id', '')::uuid;
  if v_event_contact_id is null then
    v_event_contact_id := v_primary_contact_id;
    v_exchange := jsonb_set(v_exchange, '{contact_id}', to_jsonb(v_event_contact_id::text), true);
  end if;

  if v_event_contact_id <> v_primary_contact_id and not exists (
    select 1 from public.crm_exchange_case_contacts
    where case_id = p_case_id and contact_id = v_event_contact_id
  ) then raise exception 'Cet interlocuteur ne fait pas partie du dossier.'; end if;

  v_exchange_id := public.save_crm_exchange_logistics(v_exchange, p_product_ids, p_service_ids, p_action);
  update public.crm_exchanges set case_id = p_case_id where id = v_exchange_id;
  update public.crm_exchange_cases set updated_at = now(), status = 'in_progress' where id = p_case_id;
  return v_exchange_id;
end;
$$;

revoke all on function public.create_crm_exchange_case(text, jsonb, uuid[], jsonb, uuid[], uuid[]) from public, anon;
grant execute on function public.create_crm_exchange_case(text, jsonb, uuid[], jsonb, uuid[], uuid[]) to authenticated;
revoke all on function public.add_crm_exchange_case_entry(uuid, jsonb, jsonb, uuid[], uuid[]) from public, anon;
grant execute on function public.add_crm_exchange_case_entry(uuid, jsonb, jsonb, uuid[], uuid[]) to authenticated;

commit;
