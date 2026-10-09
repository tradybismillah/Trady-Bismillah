begin;

create table if not exists public.product_subcategory_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.product_subcategories(id) on delete cascade,
  name text not null,
  unique (subcategory_id, name)
);

alter table public.products
  add column if not exists subcategory_item_id uuid
  references public.product_subcategory_items(id) on delete set null;

create index if not exists product_subcategory_items_subcategory_id_idx
  on public.product_subcategory_items (subcategory_id);

alter table public.product_subcategory_items enable row level security;
drop policy if exists "Authenticated users manage product_subcategory_items"
  on public.product_subcategory_items;
create policy "Authenticated users manage product_subcategory_items"
  on public.product_subcategory_items
  for all to authenticated
  using (true)
  with check (true);
grant select, insert, update, delete on public.product_subcategory_items to authenticated;

-- Repair values from an earlier PowerShell clipboard import if they were decoded as Windows-1252.
update public.product_categories
set name = convert_from(convert_to(name, 'WIN1252'), 'UTF8')
where position(U&'\00c3' in name) > 0
   or position(U&'\00c2' in name) > 0
   or position(U&'\fffd' in name) > 0;
update public.product_subcategories
set name = convert_from(convert_to(name, 'WIN1252'), 'UTF8')
where position(U&'\00c3' in name) > 0
   or position(U&'\00c2' in name) > 0
   or position(U&'\fffd' in name) > 0;
update public.product_subcategory_items
set name = convert_from(convert_to(name, 'WIN1252'), 'UTF8')
where position(U&'\00c3' in name) > 0
   or position(U&'\00c2' in name) > 0
   or position(U&'\fffd' in name) > 0;

insert into public.product_categories (name)
values
  ('Épicerie Sucrée'),
  ('Boissons Non-Alcoolisées'),
  ('Épicerie Salée & Ingrédients de Base'),
  ('Hygiène & Soins')
on conflict (name) do nothing;

insert into public.product_subcategories (category_id, name)
select categories.id, seed.title
from (values
  ('Épicerie Sucrée', 'Cafés, Thés & Boissons Chaudes'),
  ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle'),
  ('Épicerie Sucrée', 'Confiserie & Chocolaterie'),
  ('Épicerie Sucrée', 'Sucre & Ingrédients de Pâtisserie'),
  ('Boissons Non-Alcoolisées', 'Jus, Nectars & Concentrés'),
  ('Boissons Non-Alcoolisées', 'Sodas & Eaux'),
  ('Épicerie Salée & Ingrédients de Base', 'Céréales, Pâtes & Féculents'),
  ('Épicerie Salée & Ingrédients de Base', 'Huiles, Condiments & Sauces'),
  ('Hygiène & Soins', 'Hygiène Personnelle'),
  ('Hygiène & Soins', 'Hygiène Bébé'),
  ('Hygiène & Soins', 'Entretien de la Maison & Linge')
) as seed(category_name, title)
join public.product_categories categories on categories.name = seed.category_name
on conflict (category_id, name) do nothing;

insert into public.product_subcategory_items (subcategory_id, name)
select titles.id, seed.item_name
from (values
    ('Épicerie Sucrée', 'Cafés, Thés & Boissons Chaudes', 'Café Mulu & En Grains'),
    ('Épicerie Sucrée', 'Cafés, Thés & Boissons Chaudes', 'Café Soluble & Succédanés'),
    ('Épicerie Sucrée', 'Cafés, Thés & Boissons Chaudes', 'Boissons Instantanées Mix'),
    ('Épicerie Sucrée', 'Cafés, Thés & Boissons Chaudes', 'Thés & Infusions'),
    ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle', 'Biscuits Secs & Petit-Déjeuner'),
    ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle', 'Biscuits Fourrés & Enrobés'),
    ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle', 'Gaufrettes (Wafers)'),
    ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle', 'Pâtisseries Industrielles & Gâteaux'),
    ('Épicerie Sucrée', 'Biscuiterie, Gaufrettes & Pâtisserie Industrielle', 'Pains Grillés & Biscottes'),
    ('Épicerie Sucrée', 'Confiserie & Chocolaterie', 'Bonbons & Gommes'),
    ('Épicerie Sucrée', 'Confiserie & Chocolaterie', 'Chewing-gums & Pastilles'),
    ('Épicerie Sucrée', 'Confiserie & Chocolaterie', 'Tablettes de Chocolat'),
    ('Épicerie Sucrée', 'Confiserie & Chocolaterie', 'Barres Chocolatées & En-cas'),
    ('Épicerie Sucrée', 'Confiserie & Chocolaterie', 'Pâtes à Tartiner & Poudres Chocolatées'),
    ('Épicerie Sucrée', 'Sucre & Ingrédients de Pâtisserie', 'Sucres'),
    ('Épicerie Sucrée', 'Sucre & Ingrédients de Pâtisserie', 'Édulcorants & Sirops'),
    ('Épicerie Sucrée', 'Sucre & Ingrédients de Pâtisserie', 'Aides à la Pâtisserie'),
    ('Boissons Non-Alcoolisées', 'Jus, Nectars & Concentrés', 'Jus de Fruits 100% Pure Jus'),
    ('Boissons Non-Alcoolisées', 'Jus, Nectars & Concentrés', 'Nectars de Fruits'),
    ('Boissons Non-Alcoolisées', 'Jus, Nectars & Concentrés', 'Boissons au Jus & Boissons Poudres'),
    ('Boissons Non-Alcoolisées', 'Jus, Nectars & Concentrés', 'Concentrés & Sirops à Diluer'),
    ('Boissons Non-Alcoolisées', 'Sodas & Eaux', 'Boissons Gazeuses (Sodas)'),
    ('Boissons Non-Alcoolisées', 'Sodas & Eaux', 'Boissons Énergisantes & Sportives'),
    ('Boissons Non-Alcoolisées', 'Sodas & Eaux', 'Thés Glacés & Boissons Aromatisées'),
    ('Boissons Non-Alcoolisées', 'Sodas & Eaux', 'Eaux Conditionnées'),
    ('Épicerie Salée & Ingrédients de Base', 'Céréales, Pâtes & Féculents', 'Pâtes Alimentaires'),
    ('Épicerie Salée & Ingrédients de Base', 'Céréales, Pâtes & Féculents', 'Couscous & Semoules'),
    ('Épicerie Salée & Ingrédients de Base', 'Céréales, Pâtes & Féculents', 'Riz'),
    ('Épicerie Salée & Ingrédients de Base', 'Céréales, Pâtes & Féculents', 'Farines & Fécules'),
    ('Épicerie Salée & Ingrédients de Base', 'Huiles, Condiments & Sauces', 'Huiles Alimentaires'),
    ('Épicerie Salée & Ingrédients de Base', 'Huiles, Condiments & Sauces', 'Conserves d''Aide Culinaires'),
    ('Épicerie Salée & Ingrédients de Base', 'Huiles, Condiments & Sauces', 'Sauces Conditionnées'),
    ('Épicerie Salée & Ingrédients de Base', 'Huiles, Condiments & Sauces', 'Épices & Assaisonnements'),
    ('Hygiène & Soins', 'Hygiène Personnelle', 'Savons & Douche'),
    ('Hygiène & Soins', 'Hygiène Personnelle', 'Soins Capillaires'),
    ('Hygiène & Soins', 'Hygiène Personnelle', 'Hygiène Bucco-dentaire'),
    ('Hygiène & Soins', 'Hygiène Personnelle', 'Rasage & Déodorants'),
    ('Hygiène & Soins', 'Hygiène Personnelle', 'Hygiène Féminine'),
    ('Hygiène & Soins', 'Hygiène Bébé', 'Couches Bébé'),
    ('Hygiène & Soins', 'Hygiène Bébé', 'Soins & Toilette Bébé'),
    ('Hygiène & Soins', 'Entretien de la Maison & Linge', 'Lavage du Linge'),
    ('Hygiène & Soins', 'Entretien de la Maison & Linge', 'Produits Vaisselle'),
    ('Hygiène & Soins', 'Entretien de la Maison & Linge', 'Nettoyage des Surfaces'),
    ('Hygiène & Soins', 'Entretien de la Maison & Linge', 'Papier & Produits Aérosols')
) as seed(category_name, title, item_name)
join public.product_categories categories on categories.name = seed.category_name
join public.product_subcategories titles
  on titles.category_id = categories.id and titles.name = seed.title
on conflict (subcategory_id, name) do nothing;

notify pgrst, 'reload schema';

commit;
