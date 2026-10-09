begin;

-- Restrict every existing authenticated table policy to the project owner.
-- Update this address here and in src/App.jsx if the authorized account changes.
do $$
declare
  v_table text;
  v_policy record;
  v_tables text[];
begin
  select array_agg(distinct tablename)
    into v_tables
    from pg_policies
   where schemaname = 'public'
     and 'authenticated' = any(roles);

  for v_policy in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and 'authenticated' = any(roles)
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;

  if v_tables is not null then
    foreach v_table in array v_tables
    loop
      execute format(
        'create policy %I on public.%I for all to authenticated using (lower(coalesce(auth.jwt() ->> ''email'', '''')) = %L) with check (lower(coalesce(auth.jwt() ->> ''email'', '''')) = %L)',
        'Owner access', v_table, 'tradybismillah@gmail.com', 'tradybismillah@gmail.com'
      );
    end loop;
  end if;
end;
$$;

-- This SECURITY DEFINER helper is not called by the client and must not be an RPC.
revoke all on function public.ensure_company_default_contact(uuid) from public, anon, authenticated;

drop policy if exists "Authenticated users upload catalogue media" on storage.objects;
create policy "Authenticated users upload catalogue media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'catalogue-media'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com'
);

drop policy if exists "Authenticated users update catalogue media" on storage.objects;
create policy "Authenticated users update catalogue media"
on storage.objects for update to authenticated
using (
  bucket_id = 'catalogue-media'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com'
)
with check (
  bucket_id = 'catalogue-media'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com'
);

drop policy if exists "Authenticated users delete catalogue media" on storage.objects;
create policy "Authenticated users delete catalogue media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'catalogue-media'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com'
);

drop policy if exists "Authenticated users read catalogue media" on storage.objects;
create policy "Authenticated users read catalogue media"
on storage.objects for select to authenticated
using (
  bucket_id = 'catalogue-media'
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'tradybismillah@gmail.com'
);

commit;
