// Stratégie de chargement initial (note d'implémentation Ph.2B)
// Ce module ne change pas le comportement actuel ; il formalise la
// cartographie et la décision de chargement pour loadData().

// 1) Ce qui reste chargé immédiatement au démarrage
//    - données transverses utilisées partout
//    - médias (media_assets + construction mediaUrls)
//    - réseau (network_*)
//    - paramètres métier (business_*) utilisés dans BusinessWorkspace
//    - fiches produit, catégories, sous-catégories, packaging, marques, fabricants

// 2) Ce qui peut être chargé à la demande (premier accès à l'onglet)
//    - données lourdes spécifiques à Exchanges/Actions/Trade/Services/
//      business-settings (crm_exchanges, crm_actions,
//      crm_exchange_*, trade_documents, trade_document_templates,
//      trade_payments, trade_expenses, trade_document_lines)

// 3) Règles de cohérence
//    - loadData() reste le point de rafraîchissement global
//    - chaque écran peut déclencher son propre préchargement
//    - les erreurs restent centralisées via les notices existantes

// 4) Ce qu'on ne touche pas
//    - SQL, données, RLS
//    - architecture globale
//    - ModalA11y.jsx, Tabs.jsx (Phase 1 inchangée)
