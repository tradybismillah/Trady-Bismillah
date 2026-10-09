-- CORRECTIONS MANUELLES À EXÉCUTER APRES L'INSTALLATION DES MIGRATIONS PRINCIPALES
-- Date: 2026-10-08
-- Ces corrections résolvent les incohérences identifiées dans l'audit

-- ============================================
-- CORRECTION 1: Changer le type du champ scenario
-- ============================================
-- Problème: Le frontend utilise scenario[] mais la BD a scenario text
-- Impact: Les échanges avec plusieurs scénarios ne fonctionnent pas

ALTER TABLE public.crm_exchanges 
ALTER COLUMN scenario TYPE text[] USING ARRAY[scenario];

-- Mettre à jour les données existantes
UPDATE public.crm_exchanges 
SET scenario = ARRAY[scenario]
WHERE scenario IS NOT NULL AND scenario <> '';

-- ============================================
-- CORRECTION 2: Mettre à jour la fonction assign_product_reference
-- ============================================
-- Problème: La fonction génère PRD-REF-XXXXX au lieu du format attendu
-- Format attendu: LUV-EPI-05000 (3 lettres désignation + 3 lettres catégorie + numéro)

DROP FUNCTION IF EXISTS public.assign_product_reference();

CREATE OR REPLACE FUNCTION public.assign_product_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  reference_number bigint;
  designation_prefix text;
  category_prefix text;
  category_name text;
BEGIN
  reference_number := nextval('public.product_reference_sequence');
  
  IF reference_number > 99999 THEN
    RAISE EXCEPTION 'La limite des 99 999 références produit est atteinte.';
  END IF;
  
  -- Extraire les 3 premières lettres de la désignation (sans accents, majuscules)
  designation_prefix := UPPER(
    SUBSTRING(
      REGEXP_REPLACE(
        UNACCENT(NEW.designation),
        '[^a-zA-Z0-9]', '', 'g'
      ),
      1, 3
    )
  );
  
  -- Récupérer le nom de la catégorie
  SELECT name INTO category_name 
  FROM public.product_categories 
  WHERE id = NEW.category_id 
  LIMIT 1;
  
  -- Si pas de catégorie, utiliser 'CAT'
  IF category_name IS NULL THEN
    category_name := 'CAT';
  END IF;
  
  -- Extraire les 3 premières lettres de la catégorie (sans accents, majuscules)
  category_prefix := UPPER(
    SUBSTRING(
      REGEXP_REPLACE(
        UNACCENT(category_name),
        '[^a-zA-Z0-9]', '', 'g'
      ),
      1, 3
    )
  );
  
  -- Générer la référence au format: DES-CAT-05000
  NEW.internal_reference := designation_prefix || '-' || category_prefix || '-' || LPAD(reference_number::text, 5, '0');
  
  RETURN NEW;
END;
$$;

-- ============================================
-- CORRECTION 3: Initialiser la séquence à 50000 pour le compte à rebours
-- ============================================
-- Le README mentionne un "numéro global décroissant"
-- On commence à 50000 et on descend vers 00001

DROP SEQUENCE IF EXISTS public.product_reference_sequence;
CREATE SEQUENCE public.product_reference_sequence START 50000;

-- Mettre à jour les références existantes pour utiliser le nouveau format
-- Cette étape est optionnelle et peut être lourde sur une grosse base
-- À exécuter uniquement si vous voulez normaliser les références existantes
-- UPDATE public.products SET internal_reference = ... (logique similaire à la fonction)

-- ============================================
-- CORRECTION 4: Vérifier les contraintes manquantes
-- ============================================

-- Vérifier que la colonne subcategory_item_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'subcategory_item_id'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN subcategory_item_id uuid 
    REFERENCES public.product_subcategory_items(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ============================================
-- VÉRIFICATIONS POST-CORRECTION
-- ============================================

-- Vérifier que tout est correct
SELECT 
  'Séquence product_reference_sequence' as vérification,
  nextval('public.product_reference_sequence'::regclass) as valeur_test
UNION ALL
SELECT 
  'Type du champ scenario',
  pg_typeof(scenario) as type_actuel
FROM public.crm_exchanges 
LIMIT 1
UNION ALL
SELECT 
  'Fonction assign_product_reference existe',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'assign_product_reference'
  ) THEN 'OUI' ELSE 'NON' END as existe;
