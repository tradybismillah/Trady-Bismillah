begin;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text not null,
  folder text not null default 'Autres',
  mime_type text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  created_at timestamptz not null default now()
);

alter table public.media_assets enable row level security;
drop policy if exists "Authenticated users manage media_assets" on public.media_assets;
create policy "Authenticated users manage media_assets"
on public.media_assets for all to authenticated
using (true) with check (true);

grant select, insert, update, delete on public.media_assets to authenticated;

alter table public.network_contacts
  add column if not exists contact_photo_path text;

insert into public.media_assets (storage_path, file_name, folder, mime_type, file_size, created_at)
select
  object.name,
  regexp_replace(object.name, '^.*/', ''),
  case split_part(object.name, '/', 2)
    when 'products' then 'Produits'
    when 'brands' then 'Marques'
    when 'manufacturers' then 'Fabricants'
    when 'contacts' then 'Clients'
    when 'clients' then 'Clients'
    else 'Autres'
  end,
  coalesce(object.metadata->>'mimetype', object.metadata->>'contentType', ''),
  coalesce(nullif(object.metadata->>'size', '')::bigint, 0),
  object.created_at
from storage.objects object
where object.bucket_id = 'catalogue-media'
  and coalesce(object.metadata->>'mimetype', object.metadata->>'contentType', '') like 'image/%'
on conflict (storage_path) do nothing;

commit;
