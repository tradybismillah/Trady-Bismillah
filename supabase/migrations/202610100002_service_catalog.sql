begin;

alter table public.business_services
  add column if not exists is_catalog_item boolean not null default false,
  add column if not exists service_family text,
  add column if not exists internal_reference text,
  add column if not exists description text not null default '',
  add column if not exists billing_unit text not null default 'forfait',
  add column if not exists default_price_ht numeric(12, 2),
  add column if not exists request_fields jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists business_services_internal_reference_uidx
  on public.business_services (internal_reference)
  where internal_reference is not null;

create table if not exists public.business_service_price_history (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.business_services(id) on delete cascade,
  price_ht numeric(12, 2) not null check (price_ht >= 0),
  effective_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists business_service_price_history_service_date_idx
  on public.business_service_price_history (service_id, effective_at desc, created_at desc);

alter table public.business_service_price_history enable row level security;
drop policy if exists "Authenticated users manage business_service_price_history" on public.business_service_price_history;
create policy "Authenticated users manage business_service_price_history"
  on public.business_service_price_history for all to authenticated
  using (true) with check (true);
grant select, insert, update, delete on public.business_service_price_history to authenticated;

create or replace function public.save_business_service_price(
  p_service_id uuid,
  p_price_ht numeric,
  p_effective_at date default current_date,
  p_note text default ''
)
returns uuid
language plpgsql
as $$
declare
  v_history_id uuid;
  v_latest_price numeric(12, 2);
begin
  if p_price_ht is null or p_price_ht < 0 then
    raise exception 'Le prix forfaitaire HT doit être supérieur ou égal à zéro.';
  end if;
  if not exists (
    select 1 from public.business_services
    where id = p_service_id and is_catalog_item
  ) then
    raise exception 'La prestation à tarifer est introuvable.';
  end if;

  insert into public.business_service_price_history (service_id, price_ht, effective_at, note)
  values (p_service_id, p_price_ht, coalesce(p_effective_at, current_date), coalesce(p_note, ''))
  returning id into v_history_id;

  select price_ht into v_latest_price
  from public.business_service_price_history
  where service_id = p_service_id
  order by effective_at desc, created_at desc
  limit 1;

  update public.business_services
  set default_price_ht = v_latest_price, updated_at = now()
  where id = p_service_id;

  return v_history_id;
end;
$$;

revoke all on function public.save_business_service_price(uuid, numeric, date, text) from public, anon;
grant execute on function public.save_business_service_price(uuid, numeric, date, text) to authenticated;

update public.business_services
set is_catalog_item = false,
    service_family = case lower(name)
      when 'transport' then 'transport'
      when 'stockage' then 'storage'
      when 'manutention' then 'handling'
      else service_family
    end,
    updated_at = now()
where name in ('Transport', 'Stockage', 'Manutention');

insert into public.business_services (name, is_catalog_item, service_family, internal_reference, description, request_fields)
values
  ('Transport Complet Locale', true, 'transport', 'TRN-CPT-LCL', '', '[{"key":"origin","label":"Adresse locale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":true},{"key":"destination","label":"Adresse locale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Complet Régionale', true, 'transport', 'TRN-CPT-RGL', '', '[{"key":"origin","label":"Adresse régionale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":true},{"key":"destination","label":"Adresse régionale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Complet Nationale', true, 'transport', 'TRN-CPT-NTL', '', '[{"key":"origin","label":"Adresse nationale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":true},{"key":"destination","label":"Adresse nationale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Complet Export', true, 'transport', 'TRN-CPT-EXP', '', '[{"key":"origin","label":"Adresse export de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":true},{"key":"destination","label":"Adresse export de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Complet Intra-Européen', true, 'transport', 'TRN-CPT-UE', '', '[{"key":"origin","label":"Adresse UE de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":true},{"key":"destination","label":"Adresse UE de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Palette Locale', true, 'transport', 'TRN-PLT-LCL', '', '[{"key":"origin","label":"Adresse locale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":false},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":false},{"key":"destination","label":"Adresse locale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Palette Régionale', true, 'transport', 'TRN-PLT-RGL', '', '[{"key":"origin","label":"Adresse régionale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":false},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":false},{"key":"destination","label":"Adresse régionale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Palette Nationale', true, 'transport', 'TRN-PLT-NTL', '', '[{"key":"origin","label":"Adresse nationale de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":false},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":false},{"key":"destination","label":"Adresse nationale de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Palette Intra-Européen', true, 'transport', 'TRN-PLT-UE', '', '[{"key":"origin","label":"Adresse UE de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":false},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":false},{"key":"destination","label":"Adresse UE de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Transport Palette Export', true, 'transport', 'TRN-PLT-EXP', '', '[{"key":"origin","label":"Adresse export de chargement","type":"address","required":true},{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":false},{"key":"weight_kg","label":"Poids total (kg)","type":"number","required":false},{"key":"destination","label":"Adresse export de livraison","type":"address","required":true},{"key":"delivery_date","label":"Date de livraison souhaitée","type":"date","required":true}]'::jsonb),
  ('Stockage Palette Hebdomadaire', true, 'storage', 'STK-PLT-HBD', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"duration","label":"Durée (semaines)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Stockage Palette Mensuel', true, 'storage', 'STK-PLT-MSL', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"duration","label":"Durée (mois)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Stockage Palette Trimestriel', true, 'storage', 'STL-PLT-TRM', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (palettes)","type":"number","required":true},{"key":"duration","label":"Durée (trimestres)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Stockage Complet Hebdomadaire', true, 'storage', 'STK-CPT-HBD', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (camion complet)","type":"number","required":true},{"key":"duration","label":"Durée (semaines)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Stockage Complet Mensuel', true, 'storage', 'STK-CPT-MSL', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (camion complet)","type":"number","required":true},{"key":"duration","label":"Durée (mois)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Stockage Complet Trimestriel', true, 'storage', 'STK-CPT-TRM', '', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"quantity","label":"Quantité de marchandise (camion complet)","type":"number","required":true},{"key":"duration","label":"Durée (trimestres)","type":"number","required":true},{"key":"location","label":"Adresse de stockage","type":"address","required":true}]'::jsonb),
  ('Déchargement de Marchandise', true, 'handling', 'DGT-MRD-XXX', 'Réception de camions, conteneurs ou remorques.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true}]'::jsonb),
  ('Expédition de Marchandise', true, 'handling', 'CGT-MRD-XXX', 'Expédition de camions, conteneurs ou remorques.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true}]'::jsonb),
  ('Mise sur palette / Palettisation', true, 'handling', 'MSP-XXX-XXX', 'Regroupement et fixation de marchandises en vrac ou en cartons sur des palettes normalisées.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true}]'::jsonb),
  ('Manutention spécifique / Hors gabarit', true, 'handling', 'MHG-XXX-XXX', 'Utilisation de grues, chariots élévateurs de forte capacité ou nacelles pour des charges lourdes ou volumineuses.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true}]'::jsonb),
  ('Conditionnement / Reconditionnement', true, 'handling', 'CDT-XXX-XXX', 'Filmage, cerclage, mise sous blister, étiquetage, marquage ou pose de codes-barres.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true}]'::jsonb),
  ('Gestion des retours (Logistique inverse)', true, 'handling', 'GDT-XXX-XXX', 'Réception, déballage, contrôle qualité et remise en stock ou destruction des marchandises retournées.', '[{"key":"goods","label":"Nature de la marchandise","type":"text","required":true},{"key":"return_quantity","label":"Quantité retournée (UVC, PCB ou palettes)","type":"text","required":true},{"key":"return_cause","label":"Cause du retour","type":"text","required":true},{"key":"proof","label":"Preuve (photos, commentaire, CMR)","type":"text","required":false}]'::jsonb)
on conflict (name) do update set
  is_catalog_item = excluded.is_catalog_item,
  service_family = excluded.service_family,
  internal_reference = excluded.internal_reference,
  description = excluded.description,
  request_fields = excluded.request_fields,
  updated_at = now();

insert into public.business_transport_types (name, active)
values
  ('Transport Complet Locale', true),
  ('Transport Complet Régionale', true),
  ('Transport Complet Nationale', true),
  ('Transport Complet Export', true),
  ('Transport Complet Intra-Européen', true),
  ('Transport Palette Locale', true),
  ('Transport Palette Régionale', true),
  ('Transport Palette Nationale', true),
  ('Transport Palette Intra-Européen', true),
  ('Transport Palette Export', true)
on conflict (name) do update set active = true;

update public.business_transport_types
set active = false
where name in ('Navette locale', 'Navette régionale', 'Navette nationale', 'Intra-Européenne', 'Export');

commit;
