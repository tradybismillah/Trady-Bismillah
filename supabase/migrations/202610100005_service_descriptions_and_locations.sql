begin;

update public.business_services
set description = case internal_reference
  when 'TRN-CPT-LCL' then 'Transport complet pour vos livraisons locales.'
  when 'TRN-CPT-RGL' then 'Transport complet à l’échelle régionale.'
  when 'TRN-CPT-NTL' then 'Transport complet partout en France.'
  when 'TRN-CPT-EXP' then 'Transport complet à l’international.'
  when 'TRN-CPT-UE' then 'Transport complet entre pays européens.'
  when 'TRN-PLT-LCL' then 'Transport de palettes sur trajet local.'
  when 'TRN-PLT-RGL' then 'Transport de palettes à l’échelle régionale.'
  when 'TRN-PLT-NTL' then 'Transport de palettes partout en France.'
  when 'TRN-PLT-UE' then 'Transport de palettes entre pays européens.'
  when 'TRN-PLT-EXP' then 'Transport de palettes à l’international.'
  when 'STK-PLT-HBD' then 'Stockage de palettes à la semaine.'
  when 'STK-PLT-MSL' then 'Stockage de palettes au mois.'
  when 'STL-PLT-TRM' then 'Stockage de palettes au trimestre.'
  when 'STK-CPT-HBD' then 'Stockage de lots complets à la semaine.'
  when 'STK-CPT-MSL' then 'Stockage de lots complets au mois.'
  when 'STK-CPT-TRM' then 'Stockage de lots complets au trimestre.'
  when 'DGT-MRD-XXX' then 'Déchargement de camions et marchandises.'
  when 'CGT-MRD-XXX' then 'Chargement et expédition de marchandises.'
  when 'MSP-XXX-XXX' then 'Mise en palette et regroupement des colis.'
  when 'MHG-XXX-XXX' then 'Manutention de charges lourdes ou hors gabarit.'
  when 'CDT-XXX-XXX' then 'Conditionnement, étiquetage ou reconditionnement.'
  when 'GDT-XXX-XXX' then 'Traitement et suivi des marchandises retournées.'
  else description
end,
updated_at = now()
where is_catalog_item;

update public.business_services service
set request_fields = coalesce((
  select jsonb_agg(
    case
      when field.value->>'type' = 'address'
        then jsonb_set(field.value, '{type}', '"location"'::jsonb)
      else field.value
    end
    order by field.ordinality
  )
  from jsonb_array_elements(service.request_fields) with ordinality as field(value, ordinality)
), '[]'::jsonb),
updated_at = now()
where is_catalog_item
  and jsonb_path_exists(request_fields, '$[*] ? (@.type == "address")');

commit;
