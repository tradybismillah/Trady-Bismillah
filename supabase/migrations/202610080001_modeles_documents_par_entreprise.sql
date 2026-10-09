begin;

create table if not exists public.trade_document_templates (
  company_id uuid primary key references public.network_companies(id) on delete cascade,
  logo_path text,
  primary_color text not null default '#244d3c'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#6f806f'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  header_text text not null default '',
  footer_text text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.trade_document_templates enable row level security;
drop policy if exists "Authenticated users manage trade_document_templates"
  on public.trade_document_templates;
create policy "Authenticated users manage trade_document_templates"
  on public.trade_document_templates for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com');

grant select, insert, update, delete on public.trade_document_templates to authenticated;

commit;
