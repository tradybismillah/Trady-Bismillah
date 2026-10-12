export const actionTypeOptions = [
  ['follow_up', 'Relance / suivi'],
  ['supplier_request', 'Demande au fournisseur'],
  ['customer_reply', 'Réponse au client'],
  ['send_offer', 'Envoi d’offre'],
  ['send_listing', 'Envoi de listing'],
  ['verify_availability', 'Vérification de disponibilité'],
  ['prepare_document', 'Préparation de document'],
  ['price_check', 'Vérification de prix'],
  ['market_research', 'Recherche marché / fournisseur'],
  ['delivery_claim', 'Réclamation livraison'],
];

const workflows = {
  price_request: { actionType: 'supplier_request', title: 'Demander le prix et la disponibilité au fournisseur', description: 'Consigner la réponse, le conditionnement, la quantité et la date de validité du prix.', days: 1, priority: 'high', stage: 'sourcing' },
  availability_request: { actionType: 'verify_availability', title: 'Vérifier la disponibilité auprès du fournisseur puis répondre au client', days: 1, priority: 'high', stage: 'sourcing' },
  price_announced: { actionType: 'send_offer', title: 'Présenter le prix aux clients concernés', days: 1, priority: 'normal', stage: 'client_offer' },
  supplier_offer_received: { actionType: 'price_check', title: 'Enregistrer l’offre fournisseur et la faire valider par le client', description: 'Vérifier le prix d’achat, le conditionnement et les dates; calculer le prix de vente puis demander l’accord du client avant de confirmer le trade.', days: 1, priority: 'high', stage: 'client_offer' },
  customer_offer_sent: { actionType: 'customer_reply', title: 'Relancer les clients intéressés sur l’offre envoyée', description: 'Consigner les réponses et les objections; si un client confirme, poursuivre dans ce dossier et préparer les documents de transaction.', days: 3, priority: 'normal', stage: 'client_wait' },
  supplier_price_changed: { actionType: 'send_offer', title: 'Mettre à jour le prix source et prévenir les clients concernés', description: 'Conserver le nouveau prix daté et lié à son fournisseur, puis contacter les clients ayant exprimé un besoin sur ce produit.', days: 1, priority: 'high', stage: 'client_offer' },
  availability_announced: { actionType: 'send_offer', title: 'Informer les clients de la disponibilité', days: 1, priority: 'normal', stage: 'client_offer' },
  proforma_request: { actionType: 'prepare_document', title: 'Préparer et envoyer la facture pro-forma', days: 1, priority: 'high', stage: 'documents' },
  proforma_sent: { actionType: 'customer_reply', title: 'Relancer le client sur la pro-forma', days: 2, priority: 'normal', stage: 'client_wait' },
  proforma_accepted: { actionType: 'prepare_document', title: 'Préparer la suite de la transaction et la facture finale', days: 1, priority: 'high', stage: 'confirmed' },
  supplier_proforma_received: { actionType: 'price_check', title: 'Vérifier le prix fournisseur et le faire valider par le client', days: 1, priority: 'high', stage: 'client_offer' },
  supplier_proforma_accepted: { actionType: 'prepare_document', title: 'Confirmer la commande fournisseur et suivre le paiement', days: 1, priority: 'high', stage: 'confirmed' },
  supplier_invoice_received: { actionType: 'prepare_document', title: 'Vérifier la facture fournisseur et préparer la facture client', days: 1, priority: 'high', stage: 'documents' },
  product_search_request: { actionType: 'supplier_request', title: 'Interroger les fournisseurs sur le produit, le prix et la quantité', description: 'Demander les références, conditionnements, quantités disponibles, prix unitaires et conditions de retrait.', days: 1, priority: 'high', stage: 'sourcing' },
  customer_product_request: { actionType: 'supplier_request', title: 'Chercher le produit auprès des fournisseurs puis répondre au client', description: 'Demander les références, quantités, prix, dates et conditions; conserver chaque réponse séparément.', days: 1, priority: 'high', stage: 'sourcing' },
  supplier_catalog_received: { actionType: 'send_listing', title: 'Vérifier le listing, compléter les produits inconnus puis le valider', description: 'Importer le fichier en attente, rapprocher les références, compléter les fiches et valider avant toute diffusion.', days: 1, priority: 'normal', stage: 'sourcing' },
  client_listing_request: { actionType: 'send_listing', title: 'Sélectionner et envoyer le listing adapté au client', days: 1, priority: 'high', stage: 'client_offer' },
  offer_to_customers: { actionType: 'send_offer', title: 'Présenter cette offre aux clients concernés', days: 1, priority: 'normal', stage: 'client_offer' },
  marketing_material: { actionType: 'prepare_document', title: 'Préparer le document de présentation commerciale', description: 'Créer un support clair sur l’entreprise, les familles de produits, services et coordonnées, puis le joindre à un échange sortant.', days: 2, priority: 'normal', stage: 'client_offer' },
  negotiation: { actionType: 'customer_reply', title: 'Répondre à la négociation et relancer le client', days: 1, priority: 'high', stage: 'client_wait' },
  availability_status: { actionType: 'verify_availability', title: 'Vérifier l’avancement avec le fournisseur puis informer le client', description: 'Confirmer la date et la quantité disponibles, consigner la réponse, puis prévenir le client dans le même dossier.', days: 1, priority: 'high', stage: 'delivery' },
  supplier_price_difference: { actionType: 'price_check', title: 'Comparer les prix en interrogeant chaque source séparément', description: 'Conserver séparément chaque prix, son fournisseur, sa date, son conditionnement et sa provenance sans révéler les autres sources.', days: 1, priority: 'high', stage: 'sourcing' },
  sourcing: { actionType: 'market_research', title: 'Rechercher des fournisseurs et comparer les possibilités', days: 2, priority: 'normal', stage: 'sourcing' },
  storage: { actionType: 'market_research', title: 'Trouver une solution de stockage dans la zone demandée', days: 2, priority: 'normal', stage: 'sourcing' },
  transport: { actionType: 'supplier_request', title: 'Demander aux transporteurs leur prix et leurs dates de chargement', days: 1, priority: 'high', stage: 'sourcing' },
  delivery_claim: { actionType: 'delivery_claim', title: 'Vérifier les manquants et avaries avec le fournisseur et le lieu de chargement', description: 'Comparer la commande, le chargement et la réception; joindre photos et quantités; décider ensuite d’un avoir ou d’un refus motivé.', days: 1, priority: 'high', stage: 'claim' },
  credit_note: { actionType: 'prepare_document', title: 'Calculer et préparer l’avoir après vérification de la réclamation', days: 1, priority: 'high', stage: 'claim' },
  open_discussion: { actionType: 'follow_up', title: 'Reprendre contact selon la suite convenue', days: 3, priority: 'normal', stage: 'qualification' },
};

const caseKindScenario = {
  transport: 'transport', product_search: 'customer_product_request', offer: 'customer_offer_sent',
  supplier_catalog: 'supplier_catalog_received', price_intel: 'supplier_price_changed',
  client_listing: 'client_listing_request', availability: 'availability_status',
  sourcing: 'sourcing', storage: 'storage', delivery_claim: 'delivery_claim',
  marketing: 'marketing_material', negotiation: 'negotiation', other: 'open_discussion',
};

export const scenarioWorkflowLabels = [
  ['supplier_offer_received', 'Offre reçue d’un fournisseur'],
  ['customer_offer_sent', 'Offre envoyée à un client'],
  ['supplier_price_changed', 'Changement de prix fournisseur'],
  ['customer_product_request', 'Produit demandé par un client'],
  ['transport', 'Demande de transport'],
  ['product_search_request', 'Recherche d’un produit'],
  ['supplier_catalog_received', 'Listing reçu d’un fournisseur'],
  ['client_listing_request', 'Listing demandé par un client'],
  ['offer_to_customers', 'Offre à présenter aux clients'],
  ['marketing_material', 'Document de présentation à préparer'],
  ['availability_request', 'Demande de disponibilité'],
  ['availability_status', 'Suivi de disponibilité ou livraison'],
  ['supplier_price_difference', 'Écart de prix entre sources'],
  ['sourcing', 'Recherche de fournisseur'],
  ['storage', 'Recherche de stockage'],
  ['negotiation', 'Négociation de prix ou disponibilité'],
  ['delivery_claim', 'Avarie ou quantité manquante'],
  ['price_request', 'Demande de prix'],
  ['price_announced', 'Prix à annoncer'],
  ['proforma_request', 'Demande de facture pro-forma'],
  ['proforma_sent', 'Facture pro-forma envoyée'],
  ['supplier_proforma_received', 'Pro-forma reçue du fournisseur'],
  ['supplier_invoice_received', 'Facture reçue du fournisseur'],
  ['credit_note', 'Avoir à préparer'],
  ['open_discussion', 'Discussion ouverte'],
];

export function scenarioForCaseKind(caseKind) {
  return caseKindScenario[caseKind] || 'open_discussion';
}

export function scenarioForActionType(actionType, caseKind = '') {
  if (actionType === 'supplier_request' && caseKind === 'transport') return 'transport';
  if (actionType === 'supplier_request' && caseKind === 'product_search') return 'supplier_offer_received';
  return ({
    supplier_request: 'price_request', customer_reply: 'open_discussion', send_offer: 'customer_offer_sent',
    send_listing: 'client_listing_request', verify_availability: 'availability_status',
    prepare_document: 'proforma_sent', price_check: 'supplier_price_difference',
    market_research: 'sourcing', delivery_claim: 'delivery_claim',
  })[actionType] || 'open_discussion';
}

export function getExchangeWorkflow(scenario) {
  return workflows[scenario] || workflows.open_discussion;
}

export function suggestedActionDate(days = 1, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
