alter table public.network_contacts
  add column if not exists nickname text not null default '';
