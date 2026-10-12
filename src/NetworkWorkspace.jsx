import { useEffect, useMemo, useState } from 'react';
import { Ban, Building2, CalendarClock, ContactRound, FileDown, FileText, FolderPlus, ImagePlus, Mail, MapPin, MessageCircle, MessageSquare, Pencil, Phone, Plus, Search, Trash2, Upload, X, ArrowUpDown } from 'lucide-react';
import { MediaPicker } from './MediaLibrary.jsx';
import ModalBackdrop from './ModalA11y.jsx';
import Tabs from './Tabs.jsx';
import { exchangeProductRates, exchangeProductTotal, formatExchangeCurrency } from './lib/exchangePricing.js';
import { actionTypeOptions, getExchangeWorkflow, scenarioForCaseKind, scenarioWorkflowLabels, suggestedActionDate } from './lib/exchangeWorkflows.js';

const contactDefaults = { profile: 'individual', first_name: '', last_name: '', nickname: '', job_role: '', country: '', region: '', city: '', postal_code: '', address: '', phone_country_code: '', phone_number: '', mobile_country_code: '', mobile_number: '', whatsapp_country_code: '', whatsapp_number: '', facebook_messenger_url: '', linkedin_messenger_url: '', email: '', contact_source: '', company_id: '' };
const companyDefaults = { name: '', country: '', legal_identifiers: {}, headquarters_region: '', headquarters_city: '', headquarters_postal_code: '', headquarters_address: '', phone_country_code: '', phone_number: '', email: '', website: '', main_activity: '', secondary_activities: '', purchase_sales_zones: [] };
const contactFields = [['first_name', 'Prénom'], ['last_name', 'Nom'], ['nickname', 'Surnom / pseudonyme'], ['job_role', 'Fonction'], ['email', 'E-mail'], ['phone_number', 'Téléphone'], ['mobile_number', 'Mobile'], ['whatsapp_number', 'WhatsApp'], ['country', 'Pays'], ['region', 'Région'], ['city', 'Ville'], ['postal_code', 'Code postal'], ['address', 'Adresse'], ['contact_source', 'Origine du contact'], ['facebook_messenger_url', 'Facebook Messenger'], ['linkedin_messenger_url', 'LinkedIn']];
const companyFields = [['name', 'Nom de la société'], ['country', 'Pays'], ['headquarters_region', 'Région du siège'], ['headquarters_city', 'Ville du siège'], ['headquarters_postal_code', 'Code postal'], ['headquarters_address', 'Adresse du siège'], ['phone_country_code', 'Indicatif téléphonique'], ['phone_number', 'Téléphone'], ['email', 'E-mail'], ['website', 'Site web'], ['main_activity', 'Activité principale'], ['secondary_activities', 'Activités secondaires']];

function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatExchangeDate(value) {
  if (!value) return 'Date non renseignée';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const exchangeCategoryLabels = { trade: 'Transaction', lead: 'Demande commerciale', open: 'Discussion / information' };
const exchangeChannelLabels = { whatsapp_message: 'WhatsApp', whatsapp_call: 'Appel WhatsApp', phone_call: 'Téléphone', email: 'E-mail', sms: 'SMS', other: 'Autre' };
const actionStatusLabels = { todo: 'À faire', in_progress: 'En cours', waiting: 'En attente', done: 'Terminée', cancelled: 'Annulée' };
const caseStatusLabels = { in_progress: 'En cours', waiting: 'En attente', closed_no_followup: 'Clôturé sans suite', converted: 'Converti en transaction' };
const tradeStageLabels = { qualification: 'Qualification', sourcing: 'Recherche fournisseur', supplier_wait: 'En attente fournisseur', client_offer: 'Proposition au client', client_wait: 'En attente client', confirmed: 'Opération confirmée', documents: 'Documents', delivery: 'Livraison', claim: 'Litige / réclamation', completed: 'Terminée' };
const contactRoleLabels = { customer: 'Client', supplier: 'Fournisseur', logistics: 'Transport / logistique', other: 'Autre' };
const caseKindLabels = { transport: 'Transport', product_search: 'Recherche de produit', offer: 'Offre produit', supplier_catalog: 'Catalogue fournisseur', price_intel: 'Information de prix', client_listing: 'Demande de listing', availability: 'Disponibilité / livraison', sourcing: 'Recherche fournisseur', storage: 'Recherche de stockage', delivery_claim: 'Réclamation livraison', marketing: 'Présentation / marketing', negotiation: 'Négociation', other: 'Autre demande' };
const caseKindFields = {
  transport: [['goods', 'Marchandise', 'text'], ['pickup_details', 'Adresses et lieux de chargement', 'textarea'], ['destination', 'Destination(s)', 'textarea'], ['truck_count', 'Nombre de camions', 'number'], ['weight_kg', 'Poids total (kg)', 'number'], ['pallet_count', 'Nombre de palettes', 'number'], ['loading_date', 'Date de chargement souhaitée', 'date']],
  product_search: [['product_request', 'Produit recherché', 'text'], ['requested_quantity', 'Quantité souhaitée', 'text'], ['specifications', 'Précisions', 'textarea']],
  offer: [['available_quantity', 'Quantité disponible', 'text'], ['availability_date', 'Date de disponibilité', 'date'], ['sell_price', 'Prix proposé au client (€)', 'number']],
  supplier_catalog: [['catalog_source', 'Fournisseur / origine du catalogue', 'text']],
  price_intel: [['quoted_price', 'Prix communiqué (€)', 'number'], ['price_unit', 'Unité du prix', 'text']],
  client_listing: [['requested_listing', 'Listing demandé', 'textarea']],
  availability: [['product_request', 'Produit concerné', 'text'], ['required_date', 'Date demandée', 'date'], ['delivery_reference', 'Référence de livraison', 'text']],
  sourcing: [['product_request', 'Produit à sourcer', 'text'], ['search_region', 'Pays / région de recherche', 'text']],
  storage: [['storage_location', 'Ville / région recherchée', 'text'], ['storage_capacity', 'Volume ou capacité souhaitée', 'text']],
  delivery_claim: [['product_request', 'Produit concerné', 'text'], ['damaged_quantity', 'Quantité abîmée', 'number'], ['missing_quantity', 'Quantité manquante', 'number'], ['loading_location', 'Lieu de chargement', 'text'], ['claim_details', 'Détails / vérifications', 'textarea']],
  marketing: [['marketing_material', 'Document à préparer', 'text'], ['target_audience', 'Public visé', 'text']],
  negotiation: [['requested_price', 'Prix demandé (€)', 'number'], ['requested_availability', 'Disponibilité demandée', 'text']],
  other: [['request_summary', 'Objet de la demande', 'textarea']],
};

function Field({ label, value, onChange, type = 'text', multiline = false, required = false }) {
  return <label className="field"><span>{label}{required && <em className="required-mark"> *</em>}</span>{multiline ? <textarea rows="3" required={required} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /> : <input type={type} required={required} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}</label>;
}

function contactDisplayName(contact) {
  const nickname = String(contact?.nickname || '').trim();
  const personName = [contact?.first_name, contact?.last_name].filter((part) => part && !/^https?:\/\//i.test(String(part).trim())).join(' ').trim();
  return nickname || personName || (String(contact?.email || '').includes('@') ? contact.email : '') || 'Contact';
}

function facebookIdentity(contact, data) {
  const social = (data.network_contact_social_links || []).find((link) => link.contact_id === contact?.id && /facebook/i.test(link.platform || ''));
  const url = String(social?.url || contact?.facebook_messenger_url || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const path = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = path.at(-1) || '';
    const username = lastSegment && !['profile.php', 'messages', 't'].includes(lastSegment.toLowerCase()) ? decodeURIComponent(lastSegment).replace(/^@/, '') : '';
    const id = parsed.searchParams.get('id');
    return username ? `Facebook · ${username}` : id ? `Facebook · ${id}` : 'Facebook';
  } catch {
    return 'Facebook';
  }
}

function contactDirectoryName(contact, company, data) {
  const name = contactDisplayName(contact);
  return name !== 'Contact' ? name : facebookIdentity(contact, data) || company?.name || name;
}

function contactOptionName(contact, companies) {
  const company = companies.find((item) => item.id === contact.company_id)?.name;
  if (contactDisplayName(contact) === 'Contact' && company) return company;
  return company ? `${contactDisplayName(contact)} · ${company}` : contactDisplayName(contact);
}

function NetworkDirectoryViews({ tab, setTab, search, setSearch, filter, setFilter, sort, setSort, data, contacts, companies, rows, contactsFor, onOpenContact, onOpenRelated, onOpenCompany, onNewContact, onNewCompany, onNewExchange, onActionStatus }) {
  const [creationKind, setCreationKind] = useState('');
  const [creationContactId, setCreationContactId] = useState('');
  const cases = data.crm_exchange_cases || [];
  const exchanges = data.crm_exchanges || [];
  const actions = data.crm_actions || [];
  const getPerson = (id) => contacts.find((person) => person.id === id);
  const personName = (person) => person ? contactDirectoryName(person, companies.find((company) => company.id === person.company_id), data) : '—';
  const caseContact = (record) => getPerson(record.contact_id) || getPerson((data.crm_exchange_case_contacts || []).find((link) => link.case_id === record.id)?.contact_id);
  const getCase = (id) => cases.find((record) => record.id === id);
  const getEvent = (id) => exchanges.find((record) => record.id === id);
  const isClosed = (record) => ['closed_no_followup', 'converted'].includes(record.status);
  const isLate = (record) => record.due_at && new Date(record.due_at) < new Date() && !['done', 'cancelled'].includes(record.status);
  const caseRows = cases.filter((record) => {
    const person = caseContact(record);
    const text = `${record.title || ''} ${caseKindLabels[record.case_kind] || ''} ${caseStatusLabels[record.status] || ''} ${tradeStageLabels[record.trade_stage] || ''} ${personName(person)}`.toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase()) && (filter === 'all' || (filter === 'open' && !isClosed(record)) || (filter === 'closed' && isClosed(record)));
  }).sort((a, b) => sort === 'name' ? String(a.title || '').localeCompare(String(b.title || ''), 'fr') : new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  const exchangeRows = exchanges.filter((record) => {
    const person = getPerson(record.contact_id);
    const related = getCase(record.case_id);
    const directionMatches = filter === 'all' || record.direction === filter;
    return directionMatches && `${record.content || ''} ${record.channel || ''} ${exchangeCategoryLabels[record.category] || ''} ${personName(person)} ${related?.title || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }).sort((a, b) => sort === 'name' ? String(a.content || '').localeCompare(String(b.content || ''), 'fr') : new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0));
  const actionRows = actions.filter((record) => {
    const source = getEvent(record.exchange_id);
    const related = getCase(source?.case_id);
    const person = getPerson(record.contact_id);
    const text = `${record.title || ''} ${record.description || ''} ${actionTypeOptions.find(([value]) => value === record.action_type)?.[1] || ''} ${actionStatusLabels[record.status] || ''} ${personName(person)} ${related?.title || ''}`.toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase()) && (filter === 'all' || (filter === 'open' && !['done', 'cancelled'].includes(record.status)) || (filter === 'closed' && ['done', 'cancelled'].includes(record.status)) || (filter === 'late' && isLate(record)));
  }).sort((a, b) => sort === 'name' ? String(a.title || '').localeCompare(String(b.title || ''), 'fr') : new Date(a.due_at || 8640000000000000) - new Date(b.due_at || 8640000000000000));
  const openPerson = (person, caseId = null) => person && onOpenRelated(person, caseId);
  const tabs = [
    ['contacts', 'Contacts', contacts.length, <ContactRound size={15} />],
    ['companies', 'Sociétés', companies.length, <Building2 size={15} />],
    ['cases', 'Dossiers', cases.length, <FolderPlus size={15} />],
    ['exchanges', 'Échanges', exchanges.length, <MessageSquare size={15} />],
    ['actions', 'Actions', actions.filter((item) => !['done', 'cancelled'].includes(item.status)).length, <CalendarClock size={15} />],
  ];
  const filterItems = tab === 'cases' ? [['all', 'Tous'], ['open', 'A suivre'], ['closed', 'Clotures']] : tab === 'contacts' ? [['all', 'Tous'], ['with_cases', 'Avec dossier actif'], ['without_cases', 'Sans dossier actif']] : tab === 'exchanges' ? [['all', 'Tous'], ['incoming', 'Recus'], ['outgoing', 'Envoyes']] : [['all', 'Toutes'], ['open', 'Ouvertes'], ['closed', 'Terminees'], ['late', 'En retard']];
  const count = { contacts: rows.length, companies: rows.length, cases: caseRows.length, exchanges: exchangeRows.length, actions: actionRows.length }[tab];
  const titles = { contacts: 'Contacts', companies: 'Sociétés', cases: 'Dossiers', exchanges: 'Échanges', actions: 'Actions' };
  const placeholders = { contacts: 'Nom, pseudo, société ou coordonnées…', companies: 'Nom, activité ou localisation…', cases: 'Dossier, contact ou sujet…', exchanges: 'Contenu, canal, contact ou dossier…', actions: 'Action, contact ou dossier…' };
  return <>
    <div className="section-header network-directory-header"><div><p className="eyebrow">CRM</p><h1>{titles[tab]}</h1><p className="muted">Une vue d’ensemble des relations, échanges et suivis commerciaux.</p></div><div className="network-directory-create">{['contacts', 'companies'].includes(tab) && <button className="button button-quiet" type="button" onClick={onNewCompany}><Building2 size={16} /> Nouvelle société</button>}{tab === 'contacts' && <button className="button button-primary" type="button" onClick={onNewContact}><Plus size={16} /> Nouveau contact</button>}{tab === 'exchanges' && <button className="button button-primary" type="button" disabled={!contacts.length} onClick={() => { setCreationKind(creationKind ? '' : 'exchange'); setCreationContactId(''); }}><Plus size={16} /> Nouvel échange</button>}{tab === 'cases' && <button className="button button-primary" type="button" disabled={!contacts.length} onClick={() => { setCreationKind(creationKind ? '' : 'case'); setCreationContactId(''); }}><FolderPlus size={16} /> Nouveau dossier</button>}</div></div>
    {creationKind && <div className="network-create-from-directory"><label className="field"><span>Contact concerné</span><select value={creationContactId} onChange={(event) => setCreationContactId(event.target.value)}><option value="">Choisir un contact…</option>{contacts.map((person) => <option key={person.id} value={person.id}>{personName(person)}</option>)}</select></label><button className="button button-primary button-small" type="button" disabled={!creationContactId} onClick={() => { const person = getPerson(creationContactId); if (person) onNewExchange(person); setCreationKind(''); }}>Continuer</button><button className="button button-quiet button-small" type="button" onClick={() => setCreationKind('')}>Annuler</button><small>{creationKind === 'case' ? 'Un dossier commence par un premier échange consigné.' : 'Le nouvel échange sera associé à ce contact.'}</small></div>}
    <Tabs className="network-tabs" label="Rubriques CRM" value={tab} onChange={(value) => { setTab(value); setSearch(''); setFilter('all'); }} tabs={tabs.map(([value, label, total, icon]) => ({ value, label, count: total, icon }))} />
    {tab === 'contacts' && <div className="network-kpis"><article><span>Contacts</span><strong>{contacts.length}</strong><small>Personnes enregistrées</small></article><article><span>Dossiers en cours</span><strong>{cases.filter((item) => !isClosed(item)).length}</strong><small>Demandes à suivre</small></article><article><span>Échanges récents</span><strong>{exchanges.filter((item) => item.occurred_at && Date.now() - new Date(item.occurred_at).getTime() <= 30 * 86400000).length}</strong><small>Sur les 30 derniers jours</small></article><article><span>Actions en retard</span><strong>{actions.filter(isLate).length}</strong><small>Échéance dépassée</small></article></div>}
    <div className="table-tools network-directory-tools"><label className="search-input"><Search size={16} /><input type="search" placeholder={`Rechercher ${placeholders[tab]}`} value={search} onChange={(event) => setSearch(event.target.value)} /></label>{['contacts', 'cases', 'exchanges', 'actions'].includes(tab) && <div className="network-filter-chips" aria-label="Filtres rapides">{filterItems.map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>}<label className="network-sort"><ArrowUpDown size={14} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Trier la liste"><option value="recent">Plus récents / échéance</option><option value="name">Nom / titre A à Z</option></select></label><span className="result-count">{count} résultat{count === 1 ? '' : 's'}</span></div>
    {['contacts', 'companies'].includes(tab) && (rows.length ? <div className="network-table-scroll"><table className="directory-table network-directory-table"><thead><tr><th>{tab === 'contacts' ? 'Contact' : 'Société'}</th><th>Rôle / activité</th><th>Repère</th><th>Localisation</th><th>{tab === 'contacts' ? 'Dossiers ouverts' : 'Contacts liés'}</th><th>Dernier échange</th><th>Coordonnées</th></tr></thead><tbody>{rows.map((row) => { const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id) : null; const personCases = cases.filter((item) => (item.contact_id === row.id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === item.id && link.contact_id === row.id)) && !isClosed(item)); const lastExchange = exchanges.filter((item) => item.contact_id === row.id).sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0))[0]; return <tr key={row.id} tabIndex={0} onClick={() => tab === 'contacts' ? onOpenContact(row) : onOpenCompany(row)} onKeyDown={(event) => { if (event.key === 'Enter') tab === 'contacts' ? onOpenContact(row) : onOpenCompany(row); }}><td><strong>{tab === 'contacts' ? personName(row) : row.name}</strong>{tab === 'contacts' && row.nickname && <small>{row.nickname}</small>}</td><td>{tab === 'contacts' ? row.job_role || company?.name || '—' : row.main_activity || '—'}</td><td><span className="network-tag">{tab === 'contacts' ? (company ? 'Société liée' : 'Contact') : 'Société'}</span></td><td>{[row.city || row.headquarters_city, row.country].filter(Boolean).join(', ') || '—'}</td><td>{tab === 'contacts' ? personCases.length : contactsFor(row).length}</td><td>{tab === 'contacts' && lastExchange ? formatExchangeDate(lastExchange.occurred_at) : '—'}</td><td>{row.email || row.phone_number || row.mobile_number || '—'}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><span className="empty-icon"><ContactRound size={22} /></span><h2>{search ? 'Aucun résultat' : 'Aucune fiche enregistrée'}</h2><p>Modifie la recherche ou crée une nouvelle fiche.</p></div>)}
    {tab === 'cases' && (caseRows.length ? <div className="network-table-scroll"><table className="directory-table network-directory-table"><thead><tr><th>Dossier</th><th>Contact</th><th>Sujet</th><th>Statut</th><th>Étape</th><th>Échanges</th><th>Dernière activité</th></tr></thead><tbody>{caseRows.map((item) => { const person = caseContact(item); return <tr key={item.id} onClick={() => openPerson(person, item.id)}><td><strong>{item.title}</strong></td><td>{personName(person)}</td><td><span className="network-tag">{caseKindLabels[item.case_kind] || 'Dossier'}</span></td><td>{caseStatusLabels[item.status] || item.status || '—'}</td><td>{tradeStageLabels[item.trade_stage] || '—'}</td><td>{exchanges.filter((event) => event.case_id === item.id).length}</td><td>{formatExchangeDate(item.updated_at || item.created_at)}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><h2>Aucun dossier trouvé</h2><p>Les dossiers liés aux contacts apparaîtront ici.</p></div>)}
    {tab === 'exchanges' && (exchangeRows.length ? <div className="network-table-scroll"><table className="directory-table network-directory-table"><thead><tr><th>Date</th><th>Contact</th><th>Dossier</th><th>Canal / sens</th><th>Catégorie</th><th>Compte rendu</th></tr></thead><tbody>{exchangeRows.map((item) => { const person = getPerson(item.contact_id); const related = getCase(item.case_id); return <tr key={item.id} onClick={() => openPerson(person, related?.id)}><td>{formatExchangeDate(item.occurred_at)}</td><td><strong>{personName(person)}</strong></td><td>{related?.title || 'Échange sans dossier'}</td><td>{exchangeChannelLabels[item.channel] || item.channel} · {item.direction === 'outgoing' ? 'Envoyé' : 'Reçu'}</td><td><span className="network-tag">{exchangeCategoryLabels[item.category] || 'Échange'}</span></td><td className="network-table-excerpt">{item.content || '—'}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><h2>Aucun échange trouvé</h2><p>Les échanges enregistrés apparaîtront ici.</p></div>)}
    {tab === 'actions' && (actionRows.length ? <div className="network-table-scroll"><table className="directory-table network-directory-table"><thead><tr><th>Action</th><th>Contact</th><th>Dossier</th><th>Échéance</th><th>Priorité</th><th>Statut</th></tr></thead><tbody>{actionRows.map((item) => { const source = getEvent(item.exchange_id); const related = getCase(source?.case_id); const person = getPerson(item.contact_id); return <tr key={item.id} onClick={() => openPerson(person, related?.id)}><td><strong>{item.title || actionTypeOptions.find(([value]) => value === item.action_type)?.[1] || 'Action'}</strong></td><td>{personName(person)}</td><td>{related?.title || '—'}</td><td>{item.due_at ? formatExchangeDate(item.due_at) : 'Sans échéance'}</td><td><span className={`network-tag${item.priority === 'high' ? ' is-alert' : ''}`}>{item.priority === 'high' ? 'Haute' : item.priority === 'low' ? 'Basse' : 'Normale'}</span></td><td><select value={item.status || 'todo'} aria-label={`Statut de ${item.title || 'l’action'}`} onClick={(event) => event.stopPropagation()} onChange={(event) => onActionStatus(item.id, event.target.value)}>{Object.entries(actionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>; })}</tbody></table></div> : <div className="empty-state"><h2>Aucune action trouvée</h2><p>Les actions de suivi créées depuis un échange apparaîtront ici.</p></div>)}
  </>;
}

function valueFor(record, key) {
  const value = record[key];
  const countryCodeKey = { phone_number: 'phone_country_code', mobile_number: 'mobile_country_code', whatsapp_number: 'whatsapp_country_code' }[key]; if (countryCodeKey && value && record[countryCodeKey]) return record[countryCodeKey] + ' ' + value;
  return value || '—';
}

function NetworkAssociations({ kind, row, data }) {
  if (kind === 'contact') {
    const links = (data.network_contact_social_links || []).filter((item) => item.contact_id === row.id);
    return links.length ? <div className="network-related-contacts"><h3>Réseaux sociaux</h3>{links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.platform} · {link.url}</a>)}</div> : null;
  }
  const addresses = (data.network_company_addresses || []).filter((item) => item.company_id === row.id);
  const socials = (data.network_company_social_links || []).filter((item) => item.company_id === row.id);
  const brands = (data.network_company_brands || []).filter((item) => item.company_id === row.id).map((item) => data.brands.find((brand) => brand.id === item.brand_id)?.name).filter(Boolean);
  const categories = (data.network_company_categories || []).filter((item) => item.company_id === row.id).map((item) => data.product_categories.find((category) => category.id === item.category_id)?.name).filter(Boolean);
  return <>{addresses.length > 0 && <div className="network-related-contacts"><h3>Adresses secondaires</h3>{addresses.map((item) => <p key={item.id}><MapPin size={13} /> {[item.address, item.postal_code, item.city, item.region].filter(Boolean).join(', ')}</p>)}</div>}{socials.length > 0 && <div className="network-related-contacts"><h3>Réseaux sociaux</h3>{socials.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.platform} · {link.url}</a>)}</div>}{brands.length > 0 && <div className="network-related-contacts"><h3>Marques distribuées</h3><p>{brands.join(' · ')}</p></div>}{categories.length > 0 && <div className="network-related-contacts"><h3>Catégories</h3><p>{categories.join(' · ')}</p></div>}</>;
}

function ExchangeEventCard({ exchange, data, onActionStatus, onEdit, onCancel, onDelete }) {
  const tasks = (data.crm_actions || []).filter((action) => action.exchange_id === exchange.id);
  const contact = data.network_contacts.find((person) => person.id === exchange.contact_id);
  const products = (data.crm_exchange_products || []).filter((item) => item.exchange_id === exchange.id).map((item) => ({ ...item, product: data.products.find((product) => product.id === item.product_id) })).filter((item) => item.product);
  const isCancelled = exchange.status === 'cancelled';
  return <article className={`network-exchange-card${isCancelled ? ' is-cancelled' : ''}`} key={exchange.id}>
    <div className="network-exchange-card-meta"><span>{formatExchangeDate(exchange.occurred_at)}{contact ? ` · ${contactDisplayName(contact)}` : ''}</span><span className={`network-exchange-direction ${exchange.direction === 'outgoing' ? 'is-outgoing' : ''}`}>{exchange.direction === 'outgoing' ? 'Envoyé' : 'Reçu'}</span>{isCancelled && <span className="network-exchange-cancelled-label">Échange annulé</span>}</div>
    <div className="network-exchange-card-title"><MessageSquare size={15} /><strong>{exchangeCategoryLabels[exchange.category] || 'Échange'}</strong><span>{exchangeChannelLabels[exchange.channel] || exchange.channel}</span></div>
    {exchange.scenario && <div className="network-exchange-scenario">{exchange.scenario.split(',').map((scenario) => scenarioWorkflowLabels.find(([value]) => value === scenario)?.[1] || scenario.replaceAll('_', ' ')).join(' · ')}</div>}
    {exchange.content && <p>{exchange.content}</p>}
    {products.length > 0 && <div className="network-exchange-event-products"><strong>Produits et prix consignés</strong>{products.map((item) => <div key={item.product_id}><span>{item.product.designation}</span><small>{item.quantity ? `${item.quantity} ${({ uvc: 'UVC', pcb: 'PCB', palette: 'palettes' })[item.packaging_level] || item.packaging_level} · ` : ''}{item.uvc_unit_price != null ? `${formatExchangeCurrency(item.uvc_unit_price)} / UVC` : 'Prix non renseigné'}</small></div>)}</div>}
    {tasks.length > 0 && <div className="network-exchange-actions"><strong>Tâches de suivi</strong>{tasks.map((action) => <div className="network-exchange-action" key={action.id}><span><small>{actionTypeOptions.find(([value]) => value === action.action_type)?.[1] || 'Relance / suivi'} · {contactDisplayName(data.network_contacts.find((person) => person.id === action.contact_id))}</small>{action.title}{action.due_at ? <small> · {formatExchangeDate(action.due_at)}</small> : null}</span><select aria-label={`Statut de la tâche ${action.title}`} value={action.status} onChange={(event) => onActionStatus(action.id, event.target.value)}>{Object.entries(actionStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></div>)}</div>}
    <div className="network-exchange-record-actions"><button type="button" className="button button-quiet button-small" onClick={() => onEdit(exchange)}><Pencil size={14} /> Modifier la fiche</button>{!isCancelled && <button type="button" className="button button-quiet button-small" onClick={() => onCancel(exchange)}><Ban size={14} /> Annuler l’échange</button>}<button type="button" className="button button-danger-ghost button-small" onClick={() => onDelete(exchange)}><Trash2 size={14} /> Supprimer</button></div>
  </article>;
}

function ContactExchangeHistory({ data, contact, initialCaseId, onCreate, onAddEvent, onActiveCaseChange, onActionStatus, onCaseStatus, onCaseStage, onDeleteCase, onGenerateProductPdf, onCreateProforma, onSaveExchange, onCancelExchange, onDeleteExchange }) {
  const [caseFilter, setCaseFilter] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId || null);
  const [editingExchange, setEditingExchange] = useState(null);
  const [exchangeEditDraft, setExchangeEditDraft] = useState(null);
  const [savingExchangeEdit, setSavingExchangeEdit] = useState(false);
  const caseLinks = data.crm_exchange_case_contacts || [];
  const cases = (data.crm_exchange_cases || []).filter((exchangeCase) => exchangeCase.contact_id === contact.id || caseLinks.some((link) => link.case_id === exchangeCase.id && link.contact_id === contact.id));
  const followUpCount = cases.filter((exchangeCase) => !['closed_no_followup', 'converted'].includes(exchangeCase.status)).length;
  const closedCount = cases.length - followUpCount;
  const filteredCases = cases.filter((exchangeCase) => {
    const isClosed = ['closed_no_followup', 'converted'].includes(exchangeCase.status);
    const matchesFilter = caseFilter === 'all' || (caseFilter === 'follow_up' && !isClosed) || (caseFilter === 'closed' && isClosed);
    return matchesFilter && `${exchangeCase.title || ''} ${caseKindLabels[exchangeCase.case_kind] || ''}`.toLocaleLowerCase().includes(caseSearch.trim().toLocaleLowerCase());
  }).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  const activeCase = filteredCases.find((exchangeCase) => exchangeCase.id === selectedCaseId) || filteredCases[0] || null;
  useEffect(() => onActiveCaseChange?.(activeCase?.id || null), [activeCase?.id, onActiveCaseChange]);
  const caseIds = new Set(cases.map((exchangeCase) => exchangeCase.id));
  const caseEvents = (data.crm_exchanges || []).filter((exchange) => caseIds.has(exchange.case_id));
  const legacyEvents = (data.crm_exchanges || []).filter((exchange) => !exchange.case_id && exchange.contact_id === contact.id);
  const startExchangeEdit = (exchange) => {
    setEditingExchange(exchange);
    setExchangeEditDraft({
      occurred_at: localDateTimeValue(new Date(exchange.occurred_at)),
      direction: exchange.direction || 'incoming',
      channel_kind: exchange.channel_kind || 'digital',
      channel: exchange.channel || 'other',
      category: exchange.category || 'lead',
      entry_kind: exchange.entry_kind || 'exchange',
      content: exchange.content || '',
    });
  };
  const submitExchangeEdit = async (event) => {
    event.preventDefault();
    if (!editingExchange || !exchangeEditDraft) return;
    setSavingExchangeEdit(true);
    try {
      const saved = await onSaveExchange(editingExchange, exchangeEditDraft);
      if (saved) { setEditingExchange(null); setExchangeEditDraft(null); }
    } finally { setSavingExchangeEdit(false); }
  };
  if (!cases.length && !legacyEvents.length) return <div className="network-exchange-empty"><MessageSquare size={21} /><strong>Aucun échange pour le moment</strong><p>Utilise « Nouvel échange » pour consigner une demande, garder les réponses et planifier la relance.</p></div>;
  return <div className="network-exchange-layout">
    <aside className="network-case-sidebar">
      <div className="network-exchange-overview"><div className="network-exchange-stats"><span><strong>{cases.length}</strong> dossier{cases.length > 1 ? 's' : ''}</span><span><strong>{followUpCount}</strong> à suivre</span><span><strong>{caseEvents.length + legacyEvents.length}</strong> échange{caseEvents.length + legacyEvents.length > 1 ? 's' : ''}</span></div><div className="network-exchange-filters" role="group" aria-label="Filtrer les dossiers"><button type="button" className={caseFilter === 'all' ? 'is-active' : ''} onClick={() => setCaseFilter('all')}>Tous <span>{cases.length}</span></button><button type="button" className={caseFilter === 'follow_up' ? 'is-active' : ''} onClick={() => setCaseFilter('follow_up')}>À suivre <span>{followUpCount}</span></button><button type="button" className={caseFilter === 'closed' ? 'is-active' : ''} onClick={() => setCaseFilter('closed')}>Clôturés <span>{closedCount}</span></button></div></div>
      {cases.length > 0 && <label className="search-input network-case-search"><Search size={15} /><input type="search" value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Retrouver un dossier…" aria-label="Rechercher un dossier d’échange" /></label>}
      <nav className="network-case-nav" aria-label="Dossiers de ce contact">{filteredCases.map((exchangeCase) => { const eventCount = caseEvents.filter((exchange) => exchange.case_id === exchangeCase.id).length; const isClosed = ['closed_no_followup', 'converted'].includes(exchangeCase.status); return <button type="button" key={exchangeCase.id} className={`network-case-nav-item${activeCase?.id === exchangeCase.id ? ' is-active' : ''}`} aria-current={activeCase?.id === exchangeCase.id ? 'true' : undefined} onClick={() => setSelectedCaseId(exchangeCase.id)}><span className="network-case-nav-kind">{caseKindLabels[exchangeCase.case_kind] || 'Dossier'}</span><strong>{exchangeCase.title}</strong><span className="network-case-nav-meta"><span className={`network-case-status-dot${isClosed ? ' is-closed' : ''}`} />{caseStatusLabels[exchangeCase.status] || 'En cours'} · {eventCount} échange{eventCount === 1 ? '' : 's'}</span></button>; })}{cases.length > 0 && filteredCases.length === 0 && <div className="network-case-nav-empty">Aucun dossier ne correspond.</div>}{cases.length === 0 && <div className="network-case-nav-empty">Aucun dossier créé pour ce contact.</div>}</nav>
    </aside>
    <main className="network-case-main">
    {activeCase ? (() => { const exchangeCase = activeCase;
      const events = caseEvents.filter((exchange) => exchange.case_id === exchangeCase.id).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
       const relatedCaseContacts = caseLinks.filter((link) => link.case_id === exchangeCase.id).map((link) => ({ contact: data.network_contacts.find((person) => person.id === link.contact_id), role: link.relationship_role || 'other' })).filter((entry) => entry.contact);
       const otherContacts = relatedCaseContacts.filter((entry) => entry.contact.id !== contact.id);
      const productIds = [...new Set(events.flatMap((exchange) => (data.crm_exchange_products || []).filter((item) => item.exchange_id === exchange.id).map((item) => item.product_id)))];
      const eventIds = new Set(events.map((exchange) => exchange.id));
       const documents = (data.trade_documents || []).filter((document) => document.case_id === exchangeCase.id || eventIds.has(document.exchange_id));
       const payments = (data.trade_payments || []).filter((payment) => payment.case_id === exchangeCase.id || eventIds.has(payment.exchange_id));
      const firstPrimaryEvent = events.find((exchange) => exchange.contact_id === exchangeCase.contact_id);
      const caseDetails = (caseKindFields[exchangeCase.case_kind] || caseKindFields.other).filter(([key]) => exchangeCase.case_data?.[key] !== '' && exchangeCase.case_data?.[key] != null);
       const primaryCaseContact = data.network_contacts.find((person) => person.id === exchangeCase.contact_id);
       const customerParticipants = [{ contact: primaryCaseContact, role: exchangeCase.primary_contact_role || 'other' }, ...relatedCaseContacts]
         .filter(({ contact, role }) => contact && (role === 'customer' || (role === 'other' && contact.id === exchangeCase.contact_id)));
       const hasInvoice = customerParticipants.some(({ contact: customer }) => documents.some((document) => document.contact_id === customer.id && document.counterparty_role !== 'supplier' && ['proforma', 'final_invoice'].includes(document.document_type)));
      return <section className="network-exchange-case" key={exchangeCase.id}>
        <div className="network-exchange-case-heading"><div><span className="reference-label">{caseKindLabels[exchangeCase.case_kind] || caseKindLabels.other} · {exchangeCategoryLabels[exchangeCase.category] || 'Dossier'}</span><h4>{exchangeCase.title}</h4><small>{contactRoleLabels[exchangeCase.primary_contact_role || 'other']} · {contactDisplayName(contact)}{otherContacts.length ? ` · Avec ${otherContacts.map(({ contact: person, role }) => `${contactDisplayName(person)} (${contactRoleLabels[role]})`).join(', ')}` : ''}</small></div><div className="network-exchange-case-progress">{['trade', 'lead'].includes(exchangeCase.category) && <label className="network-exchange-status"><span>Étape commerciale</span><select aria-label={`Étape commerciale du dossier ${exchangeCase.title}`} value={exchangeCase.trade_stage || 'qualification'} onChange={(event) => onCaseStage(exchangeCase.id, event.target.value)}>{Object.entries(tradeStageLabels).map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}</select></label>}<label className="network-exchange-status"><span>Suivi du dossier</span><select aria-label={`Statut du dossier ${exchangeCase.title}`} value={exchangeCase.status} onChange={(event) => onCaseStatus(exchangeCase.id, event.target.value)}>{Object.entries(caseStatusLabels).filter(([status]) => status !== 'converted' || hasInvoice || exchangeCase.status === 'converted').map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label><button type="button" className="button button-danger-ghost button-small network-delete-case" onClick={() => onDeleteCase(exchangeCase)}><Trash2 size={14} /> Supprimer le dossier</button></div></div>
        {caseDetails.length > 0 && <dl className="network-exchange-case-details">{caseDetails.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{exchangeCase.case_data[key]}</dd></div>)}</dl>}
        {(data.crm_exchange_case_media || []).filter((link) => link.case_id === exchangeCase.id).map((link) => { const asset = (data.media_assets || []).find((item) => item.id === link.media_asset_id); const url = asset && data.mediaUrls?.[asset.storage_path]; return asset ? <a className="network-exchange-file" href={url || '#'} target="_blank" rel="noreferrer" key={link.media_asset_id}>{asset.file_name}</a> : null; })}
        {documents.length > 0 && <div className="network-exchange-documents"><strong>Factures et documents Trade</strong>{documents.map((document) => { const documentContact = data.network_contacts.find((person) => person.id === document.contact_id); return <span key={document.id}>{({ proforma: 'Facture pro forma', final_invoice: 'Facture finale', credit_note: 'Avoir', delivery_note: 'Bon de livraison' })[document.document_type] || 'Document'}{document.document_number ? ` · ${document.document_number}` : ''} · {documentContact ? contactDisplayName(documentContact) : 'Contact'} · {({ draft: 'Brouillon', received: 'Reçu', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', stored: 'Archivé' })[document.status] || document.status}</span>; })}</div>}
         {payments.length > 0 && <div className="network-exchange-documents"><strong>Paiements liés au dossier</strong>{payments.map((payment) => { const payer = data.network_contacts.find((person) => person.id === payment.contact_id); return <span key={payment.id}>{formatExchangeCurrency(payment.amount)} · {payment.direction === 'incoming' ? 'Reçu' : 'Versé'}{payer ? ` · ${contactDisplayName(payer)}` : ''} · {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(payment.payment_date))}</span>; })}</div>}
        <div className="network-exchange-case-events">{events.map((exchange) => <ExchangeEventCard key={exchange.id} exchange={exchange} data={data} onActionStatus={onActionStatus} onEdit={startExchangeEdit} onCancel={onCancelExchange} onDelete={onDeleteExchange} />)}</div>
         {exchangeCase.status !== 'closed_no_followup' && customerParticipants.map(({ contact: customer }) => { const customerProformas = documents.filter((document) => document.contact_id === customer.id && document.document_type === 'proforma' && document.counterparty_role !== 'supplier'); const customerExchange = events.find((exchange) => exchange.contact_id === customer.id) || firstPrimaryEvent; const latestProforma = customerProformas[0]; return <span className="network-exchange-document-actions" key={`documents-${customer.id}`}><button type="button" className="button button-quiet button-small" onClick={() => onCreateProforma({ caseId: exchangeCase.id, contactId: customer.id, exchangeId: customerExchange?.id || '', counterpartyRole: 'customer' })}><FileText size={14} /> Pro-forma · {contactDisplayName(customer)}</button>{latestProforma && <button type="button" className="button button-quiet button-small" onClick={() => onCreateProforma({ caseId: exchangeCase.id, contactId: customer.id, exchangeId: customerExchange?.id || '', documentType: 'final_invoice', relatedDocumentId: latestProforma.id, counterpartyRole: 'customer' })}><FileText size={14} /> Facture finale</button>}</span>; })}
        {productIds.length > 0 && <button type="button" className="button button-quiet button-small" onClick={() => onGenerateProductPdf(productIds)}><FileDown size={14} /> Préparer un listing PDF des produits</button>}
        <button type="button" className="button button-quiet button-small" onClick={() => onAddEvent(exchangeCase)}>+ Ajouter un appel, message ou suivi</button>
      </section>;
    })() : <div className="network-case-main-empty"><MessageSquare size={20} /><strong>{cases.length ? 'Aucun dossier dans cette vue' : 'Aucun dossier sélectionné'}</strong><span>{cases.length ? 'Modifie le filtre ou la recherche.' : 'Crée un nouvel échange pour commencer le suivi.'}</span></div>}
    {legacyEvents.length > 0 && <section className="network-exchange-legacy"><h4>Échanges enregistrés précédemment</h4>{legacyEvents.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)).map((exchange) => <ExchangeEventCard key={exchange.id} exchange={exchange} data={data} onActionStatus={onActionStatus} onEdit={startExchangeEdit} onCancel={onCancelExchange} onDelete={onDeleteExchange} />)}</section>}
    </main>
    {editingExchange && exchangeEditDraft && <ModalBackdrop onClose={() => { if (!savingExchangeEdit) { setEditingExchange(null); setExchangeEditDraft(null); } }}><section className="modal-card modal-wide network-exchange-edit-modal" role="dialog" aria-modal="true" aria-labelledby="network-exchange-edit-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon"><Pencil size={17} /></span><h2 id="network-exchange-edit-title">Modifier la fiche échange</h2></div><button type="button" className="icon-button" aria-label="Fermer" disabled={savingExchangeEdit} onClick={() => { setEditingExchange(null); setExchangeEditDraft(null); }}><X size={17} /></button></div><form className="record-form" onSubmit={submitExchangeEdit}><p className="muted">Modifie les informations de cet appel, message ou suivi. Les produits et pièces jointes liés restent conservés.</p><div className="form-grid two-columns"><label className="field"><span>Date et heure</span><input type="datetime-local" required value={exchangeEditDraft.occurred_at} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, occurred_at: event.target.value }))} /></label><label className="field"><span>Sens</span><select value={exchangeEditDraft.direction} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, direction: event.target.value }))}><option value="incoming">Reçu</option><option value="outgoing">Envoyé</option></select></label><label className="field"><span>Canal</span><input required maxLength={80} value={exchangeEditDraft.channel} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, channel: event.target.value }))} /></label><label className="field"><span>Type de canal</span><select value={exchangeEditDraft.channel_kind} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, channel_kind: event.target.value }))}><option value="digital">Digital</option><option value="physical">Physique</option></select></label><label className="field"><span>Catégorie</span><select value={exchangeEditDraft.category} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, category: event.target.value }))}><option value="trade">Trade</option><option value="lead">Demande commerciale</option><option value="open">Discussion / information</option></select></label><label className="field"><span>Qualification</span><select value={exchangeEditDraft.entry_kind} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, entry_kind: event.target.value }))}><option value="exchange">Échange</option><option value="information">Information</option><option value="observation">Observation</option><option value="alert">Alerte</option></select></label></div><label className="field"><span>Compte rendu / information</span><textarea rows="5" value={exchangeEditDraft.content} onChange={(event) => setExchangeEditDraft((draft) => ({ ...draft, content: event.target.value }))} /></label><div className="form-actions"><button type="button" className="button button-quiet" disabled={savingExchangeEdit} onClick={() => { setEditingExchange(null); setExchangeEditDraft(null); }}>Annuler les modifications</button><span className="form-actions-spacer" /><button type="submit" className="button button-primary" disabled={savingExchangeEdit || !exchangeEditDraft.channel.trim()}>{savingExchangeEdit ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div></form></section></ModalBackdrop>}
  </div>;
}

export default function NetworkWorkspace({ data, client, onRefresh, notify, onGenerateProductPdf, onCreateProforma, contactExchangeRequest, onContactExchangeRequestHandled }) {
  const [tab, setTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('all');
  const [directorySort, setDirectorySort] = useState('recent');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [companyQuickDraft, setCompanyQuickDraft] = useState(null);
  const [savingQuickCompany, setSavingQuickCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPath, setPhotoPath] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [detailTab, setDetailTab] = useState('details');
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [savingExchange, setSavingExchange] = useState(false);
  const [exchangeDraft, setExchangeDraft] = useState(null);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [focusedCaseId, setFocusedCaseId] = useState(null);
  const [selectedHistoryCaseId, setSelectedHistoryCaseId] = useState(null);
  const [relatedContactIds, setRelatedContactIds] = useState([]);
  const [relatedContactRoles, setRelatedContactRoles] = useState({});
  const [exchangeFile, setExchangeFile] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [exchangeProductDetails, setExchangeProductDetails] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productBrandFilter, setProductBrandFilter] = useState('all');
  const companies = data.network_companies || [];
  const contacts = data.network_contacts || [];
  useEffect(() => {
    if (!contactExchangeRequest) return;
    const contact = contacts.find((item) => item.id === contactExchangeRequest.contactId);
    if (!contact) return;
    setTab('contacts');
    setSearch('');
    setSelected({ kind: 'contact', row: contact });
    setDetailTab('exchanges');
    setShowExchangeForm(false);
    setExchangeDraft(null);
    setFocusedCaseId(contactExchangeRequest.caseId || null);
    onContactExchangeRequestHandled?.();
  }, [contactExchangeRequest, contacts]);
  const rows = useMemo(() => (tab === 'contacts' ? contacts : companies).filter((row) => {
    const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id)?.name : '';
    const socialLinks = tab === 'contacts' ? (data.network_contact_social_links || []).filter((link) => link.contact_id === row.id).map((link) => `${link.platform || ''} ${link.url || ''}`) : [];
    const haystack = tab === 'contacts'
      ? [row.first_name, row.last_name, row.nickname, row.job_role, company, row.email, row.phone_number, row.mobile_number, row.whatsapp_number, row.facebook_messenger_url, row.linkedin_messenger_url, row.city, row.region, row.country, ...socialLinks]
      : [row.name, row.main_activity, row.email, row.phone_number, row.headquarters_city, row.headquarters_region, row.country, ...Object.values(row.legal_identifiers || {})];
    const matchesSearch = haystack.filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    if (!matchesSearch || tab !== 'contacts' || directoryFilter === 'all') return matchesSearch;
    const linkedCase = (data.crm_exchange_cases || []).some((exchangeCase) => !['closed_no_followup', 'converted'].includes(exchangeCase.status) && (exchangeCase.contact_id === row.id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === exchangeCase.id && link.contact_id === row.id)));
    return directoryFilter === 'with_cases' ? linkedCase : directoryFilter === 'without_cases' ? !linkedCase : true;
  }).sort((a, b) => directorySort === 'name'
    ? String(tab === 'contacts' ? contactDirectoryName(a, companies.find((entry) => entry.id === a.company_id), data) : a.name || '').localeCompare(String(tab === 'contacts' ? contactDirectoryName(b, companies.find((entry) => entry.id === b.company_id), data) : b.name || ''), 'fr')
    : new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)), [tab, contacts, companies, data.network_contact_social_links, data.crm_exchange_cases, data.crm_exchange_case_contacts, search, directoryFilter, directorySort, data]);
  const contactsFor = (company) => contacts.filter((contact) => contact.company_id === company.id);
  const startNew = (kind) => { setSelected(null); setEditing(kind); setDraft({ ...(kind === 'company' ? companyDefaults : contactDefaults) }); setPhotoFile(null); setPhotoPath(''); };
  const createCompanyFromContact = async (event) => {
    event?.preventDefault?.();
    const name = companyQuickDraft?.name?.trim();
    if (!name) return;
    setSavingQuickCompany(true);
    try {
      const { data: saved, error } = await client.rpc('save_network_records', {
        p_contact: null,
        p_company: { ...companyDefaults, name },
        p_contact_id: null,
        p_company_id: null,
        p_contact_social_links: [],
        p_company_social_links: [],
        p_company_addresses: [],
        p_company_brand_ids: [],
        p_company_category_ids: [],
      });
      if (error) throw error;
      if (!saved?.company_id) throw new Error('La société a été enregistrée, mais son identifiant est introuvable.');
      setDraft((current) => current ? { ...current, company_id: saved.company_id, profile: 'professional' } : current);
      setCompanyQuickDraft(null);
      await onRefresh();
      notify('Société créée et associée au contact.');
    } catch (error) {
      notify(`Création de la société impossible : ${error.message}`, true);
    } finally {
      setSavingQuickCompany(false);
    }
  };
  const openContact = (row) => { setDetailTab('details'); setShowExchangeForm(false); setExchangeDraft(null); setFocusedCaseId(null); setSelectedHistoryCaseId(null); setSelected({ kind: 'contact', row }); };
  const startContactExchange = (row, exchangeCase = null) => {
    setSelected({ kind: 'contact', row });
    setDetailTab('exchanges');
    setFocusedCaseId(exchangeCase?.id || null);
    setSelectedHistoryCaseId(exchangeCase?.id || null);
    setShowExchangeForm(true);
    setActiveCaseId(exchangeCase?.id || null);
    setExchangeFile(null);
    setSelectedProductIds([]);
    setExchangeProductDetails({});
    setProductSearch('');
    setProductCategoryFilter('all');
    setProductBrandFilter('all');
     const caseContactLinks = exchangeCase ? (data.crm_exchange_case_contacts || []).filter((link) => link.case_id === exchangeCase.id) : [];
     setRelatedContactIds(caseContactLinks.map((link) => link.contact_id));
     setRelatedContactRoles(Object.fromEntries(caseContactLinks.map((link) => [link.contact_id, link.relationship_role || 'other'])));
     const latestExchange = exchangeCase && data.crm_exchanges.filter((item) => item.case_id === exchangeCase.id).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0];
     const scenario = latestExchange?.scenario?.split(',')[0] || scenarioForCaseKind(exchangeCase?.case_kind || 'other');
     const workflow = getExchangeWorkflow(scenario);
      setExchangeDraft({ occurred_at: localDateTimeValue(), direction: 'incoming', channel_kind: 'digital', channel: 'whatsapp_message', category: exchangeCase?.category || 'lead', case_kind: exchangeCase?.case_kind || 'other', case_data: exchangeCase?.case_data || {}, primary_contact_role: exchangeCase?.primary_contact_role || 'customer', entry_kind: 'exchange', scenario, content: '', action_enabled: true, action_contact_id: row.id, action_type: workflow.actionType, action_title: workflow.title, action_due_at: suggestedActionDate(workflow.days), action_description: workflow.description || '', action_priority: workflow.priority || 'normal' });
  };
  const startEdit = (row, kind) => { setSelected(null); setEditing(kind); setDraft({ ...(kind === 'company' ? companyDefaults : contactDefaults), ...row, company_id: row.company_id || '' }); setPhotoFile(null); setPhotoPath(row.contact_photo_path || ''); };
  const save = async (event) => {
    event.preventDefault();
    if (editing === 'contact' && !draft.first_name?.trim() && !draft.last_name?.trim() && !draft.nickname?.trim()) {
      notify('Renseigne le prénom, le nom ou le pseudonyme du contact.', true);
      return;
    }
    if (editing === 'company' && !draft.name?.trim()) {
      notify('Le nom de la société est obligatoire.', true);
      return;
    }
    setSaving(true);
    let uploadedPath = '';
    try {
      const kind = editing;
      if (kind === 'contact' && photoFile) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(photoFile.type) || photoFile.size > 20 * 1024 * 1024) throw new Error('Photo invalide : JPEG, PNG, WebP ou AVIF, 20 Mo maximum.');
        const { data: auth } = await client.auth.getSession();
        if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
        uploadedPath = `${auth.session.user.id}/contacts/${crypto.randomUUID()}-${photoFile.name.normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: uploadError } = await client.storage.from('catalogue-media').upload(uploadedPath, photoFile, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: assetError } = await client.from('media_assets').insert({ storage_path: uploadedPath, file_name: photoFile.name, folder: 'Contacts', mime_type: photoFile.type, file_size: photoFile.size });
        if (assetError) throw assetError;
      }
      const { data: savedIds, error } = await client.rpc('save_network_records', {
        p_contact: kind === 'contact' ? { ...draft, first_name: draft.first_name.trim(), last_name: draft.last_name.trim() || draft.first_name.trim() || draft.nickname.trim(), profile: draft.company_id ? 'professional' : draft.profile, company_id: draft.company_id || null } : null,
        p_company: kind === 'company' ? { ...draft, legal_identifiers: draft.legal_identifiers || {}, purchase_sales_zones: draft.purchase_sales_zones || [] } : null,
        p_contact_id: kind === 'contact' ? draft.id || null : null,
        p_company_id: kind === 'company' ? draft.id || null : null,
        p_contact_social_links: kind === 'contact' ? (data.network_contact_social_links || []).filter((item) => item.contact_id === draft.id).map(({ platform, url }) => ({ platform, url })) : [],
        p_company_social_links: kind === 'company' ? (data.network_company_social_links || []).filter((item) => item.company_id === draft.id).map(({ platform, url }) => ({ platform, url })) : [],
        p_company_addresses: kind === 'company' ? (data.network_company_addresses || []).filter((item) => item.company_id === draft.id).map(({ region, city, postal_code, address }) => ({ region, city, postal_code, address })) : [],
        p_company_brand_ids: kind === 'company' ? (data.network_company_brands || []).filter((item) => item.company_id === draft.id).map((item) => item.brand_id) : [],
        p_company_category_ids: kind === 'company' ? (data.network_company_categories || []).filter((item) => item.company_id === draft.id).map((item) => item.category_id) : [],
      });
      if (error) throw error;
      if (kind === 'contact') {
        const contactId = draft.id || savedIds?.contact_id;
        if (!contactId) throw new Error('Identifiant du contact introuvable après enregistrement.');
        const { error: identityError } = await client.from('network_contacts').update({ first_name: draft.first_name.trim(), last_name: draft.last_name.trim(), nickname: draft.nickname.trim() }).eq('id', contactId);
        if (identityError) throw identityError;
      }
      if (kind === 'contact' && (uploadedPath || photoPath !== (draft.contact_photo_path || ''))) {
        const contactId = draft.id || savedIds?.contact_id;
        if (contactId) {
          const { error: photoError } = await client.from('network_contacts').update({ contact_photo_path: uploadedPath || photoPath || null }).eq('id', contactId);
          if (photoError) throw photoError;
        }
      }
      setEditing(null); setDraft(null);
      await onRefresh();
      notify(kind === 'company' ? 'Fiche société enregistrée.' : 'Fiche contact enregistrée.');
    } catch (error) { notify(`Enregistrement impossible : ${error.message}`, true); }
    finally { setSaving(false); }
  };
  const remove = async (row, kind) => {
    const label = kind === 'company' ? row.name : contactDisplayName(row);
    if (!window.confirm(`Supprimer la fiche « ${label} » ?`)) return;
    const { error } = await client.from(kind === 'company' ? 'network_companies' : 'network_contacts').delete().eq('id', row.id);
    if (error) notify(`Suppression impossible : ${error.message}`, true);
    else { setSelected(null); notify('Fiche supprimée.'); await onRefresh(); }
  };
  const saveContactExchange = async (event) => {
    event.preventDefault();
    if (!detail?.id || !exchangeDraft) return;
    const allowedFileTypes = ['.pdf', '.xlsx', '.xls', '.csv', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp'];
    if (exchangeFile && (exchangeFile.size > 25 * 1024 * 1024 || !allowedFileTypes.some((extension) => exchangeFile.name.toLowerCase().endsWith(extension)))) {
      notify('Fichier non accepté : PDF, Excel, CSV, Word ou image, 25 Mo maximum.', true);
      return;
    }
    setSavingExchange(true);
    try {
      const action = exchangeDraft.action_enabled && exchangeDraft.action_title.trim()
        ? { title: exchangeDraft.action_title.trim(), due_at: exchangeDraft.action_due_at ? new Date(exchangeDraft.action_due_at).toISOString() : null, contact_id: exchangeDraft.action_contact_id || detail.id, action_type: exchangeDraft.action_type || 'follow_up', description: exchangeDraft.action_description || '', priority: exchangeDraft.action_priority || 'normal' }
        : null;
      const productDetails = selectedProductIds.map((productId) => {
        const product = data.products.find((item) => item.id === productId);
        const details = exchangeProductDetails[productId] || { packaging_level: 'uvc', quantity: '', uvc_unit_price: '' };
        const rates = exchangeProductRates(product, details);
        return {
          product_id: productId,
          packaging_level: details.packaging_level || 'uvc',
          quantity: details.quantity === '' ? null : Number(details.quantity),
          uvc_unit_price: rates.uvc,
          pcb_unit_price: rates.pcb,
          palette_unit_price: rates.palette,
        };
      });
      const p_exchange = {
          contact_id: detail.id,
           primary_contact_role: exchangeDraft.primary_contact_role || 'other',
          occurred_at: new Date(exchangeDraft.occurred_at).toISOString(),
          direction: exchangeDraft.direction,
          channel_kind: exchangeDraft.channel_kind,
          channel: exchangeDraft.channel,
          category: exchangeDraft.category,
          case_kind: exchangeDraft.case_kind,
          case_data: exchangeDraft.case_data || {},
          scenario: exchangeDraft.scenario || scenarioForCaseKind(exchangeDraft.case_kind),
          subscenario: '',
          entry_kind: exchangeDraft.entry_kind,
          content: exchangeDraft.content.trim(),
          status: 'recorded',
          product_details: productDetails,
        };
      const { data: caseResult, error } = await client.rpc(activeCaseId ? 'add_crm_exchange_case_entry' : 'create_crm_exchange_case', activeCaseId
        ? { p_case_id: activeCaseId, p_exchange, p_action: action, p_product_ids: selectedProductIds, p_service_ids: [] }
        : { p_title: caseKindLabels[exchangeDraft.case_kind] || caseKindLabels.other, p_exchange, p_contact_ids: relatedContactIds, p_action: action, p_product_ids: selectedProductIds, p_service_ids: [] });
      if (error) throw error;
      if (!caseResult) throw new Error('Le serveur n’a pas renvoyé le dossier créé. Actualise la page avant de réessayer.');
      if (!activeCaseId) setFocusedCaseId(caseResult);
       let relationshipWarning = '';
       if (!activeCaseId && caseResult) {
         const { error: primaryRoleError } = await client.from('crm_exchange_cases').update({ primary_contact_role: exchangeDraft.primary_contact_role || 'other' }).eq('id', caseResult);
         if (primaryRoleError) relationshipWarning = primaryRoleError.message;
         for (const contactId of relatedContactIds) {
           const { error: roleError } = await client.from('crm_exchange_case_contacts').update({ relationship_role: relatedContactRoles[contactId] || 'other' }).eq('case_id', caseResult).eq('contact_id', contactId);
           if (roleError) relationshipWarning = [relationshipWarning, roleError.message].filter(Boolean).join(' · ');
         }
         const initialStage = getExchangeWorkflow(exchangeDraft.scenario || scenarioForCaseKind(exchangeDraft.case_kind)).stage;
         if (['trade', 'lead'].includes(exchangeDraft.category) && initialStage) {
           const { error: stageError } = await client.from('crm_exchange_cases').update({ trade_stage: initialStage, updated_at: new Date().toISOString() }).eq('id', caseResult);
           if (stageError) relationshipWarning = [relationshipWarning, stageError.message].filter(Boolean).join(' · ');
         }
       }
      let attachmentWarning = '';
      if (exchangeFile) {
        const caseId = activeCaseId || caseResult;
        let storagePath = '';
        let assetId = '';
        try {
          const { data: auth } = await client.auth.getSession();
          if (!auth.session?.user?.id) throw new Error('Session utilisateur absente.');
          const safeName = exchangeFile.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
          storagePath = `${auth.session.user.id}/exchange-cases/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadError } = await client.storage.from('catalogue-media').upload(storagePath, exchangeFile, { upsert: false });
          if (uploadError) throw uploadError;
          const { data: asset, error: assetError } = await client.from('media_assets').insert({ storage_path: storagePath, file_name: exchangeFile.name, folder: 'Échanges', mime_type: exchangeFile.type || 'application/octet-stream', file_size: exchangeFile.size }).select('id').single();
          if (assetError) throw assetError;
          assetId = asset.id;
          const { error: linkError } = await client.from('crm_exchange_case_media').insert({ case_id: caseId, media_asset_id: asset.id });
          if (linkError) throw linkError;
        } catch (error) {
          attachmentWarning = error.message;
          if (assetId) await client.from('media_assets').delete().eq('id', assetId);
          if (storagePath) await client.storage.from('catalogue-media').remove([storagePath]);
        }
      }
      setShowExchangeForm(false);
      setExchangeDraft(null);
      setActiveCaseId(null);
      setRelatedContactIds([]);
       setRelatedContactRoles({});
      setExchangeFile(null);
      setSelectedProductIds([]);
      setExchangeProductDetails({});
      await onRefresh();
       notify(attachmentWarning ? `Dossier enregistré, mais le document n’a pas été joint : ${attachmentWarning}` : relationshipWarning ? `Dossier enregistré, mais certains rôles de contacts n’ont pas été enregistrés : ${relationshipWarning}` : exchangeFile ? 'Dossier, échange et document enregistrés.' : action ? 'Dossier, échange et tâche de suivi enregistrés.' : 'Dossier et échange enregistrés dans la fiche contact.', Boolean(attachmentWarning || relationshipWarning));
    } catch (error) {
      notify(`Enregistrement de l’échange impossible : ${error.message}`, true);
    } finally {
      setSavingExchange(false);
    }
  };
  const updateActionStatus = async (actionId, status) => {
    const { error } = await client.from('crm_actions').update({ status, updated_at: new Date().toISOString() }).eq('id', actionId);
    if (error) notify(`Mise à jour de la tâche impossible : ${error.message}`, true);
    else {
      const action = data.crm_actions.find((item) => item.id === actionId);
      const source = data.crm_exchanges.find((item) => item.id === action?.exchange_id);
      const exchangeCase = data.crm_exchange_cases.find((item) => item.id === source?.case_id);
      if (exchangeCase && status === 'waiting') {
        const otherActive = data.crm_actions.some((item) => item.id !== actionId && data.crm_exchanges.find((event) => event.id === item.exchange_id)?.case_id === exchangeCase.id && !['waiting', 'done', 'cancelled'].includes(item.status));
        if (!otherActive) await client.from('crm_exchange_cases').update({ status: 'waiting', updated_at: new Date().toISOString() }).eq('id', exchangeCase.id);
      } else if (exchangeCase && ['todo', 'in_progress'].includes(status) && exchangeCase.status === 'waiting') {
        await client.from('crm_exchange_cases').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', exchangeCase.id);
      }
      await onRefresh(); notify('Suivi de la tâche mis à jour.');
    }
  };
  const saveExchangeRecord = async (exchange, draft) => {
    try {
      const { data: updated, error } = await client.from('crm_exchanges').update({
        occurred_at: new Date(draft.occurred_at).toISOString(),
        direction: draft.direction,
        channel_kind: draft.channel_kind,
        channel: draft.channel.trim(),
        category: draft.category,
        entry_kind: draft.entry_kind,
        content: draft.content.trim(),
        revision: Number(exchange.revision || 1) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', exchange.id).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('La fiche échange est introuvable ou tu n’as pas le droit de la modifier.');
      await onRefresh();
      notify('Fiche échange mise à jour.');
      return true;
    } catch (error) {
      notify(`Modification de la fiche impossible : ${error.message}`, true);
      return false;
    }
  };
  const cancelExchangeRecord = async (exchange) => {
    const linkedActions = (data.crm_actions || []).filter((action) => action.exchange_id === exchange.id && !['done', 'cancelled'].includes(action.status));
    if (!window.confirm(`Annuler cet échange ?${linkedActions.length ? ` Les ${linkedActions.length} action(s) de suivi encore ouvertes seront également annulées.` : ''}`)) return;
    const { error } = await client.rpc('cancel_crm_exchange', { p_exchange_id: exchange.id });
    if (error) notify(`Annulation de l’échange impossible : ${error.message}`, true);
    else { await onRefresh(); notify('Échange annulé.'); }
  };
  const deleteExchangeRecord = async (exchange) => {
    const linkedActions = (data.crm_actions || []).filter((action) => action.exchange_id === exchange.id);
    if (!window.confirm(`Supprimer définitivement cet échange ?${linkedActions.length ? ` Ses ${linkedActions.length} action(s) de suivi seront également supprimées.` : ''} Les documents et paiements resteront conservés, mais leur lien direct avec cet échange sera retiré.`)) return;
    const { error } = await client.rpc('delete_crm_exchange', { p_exchange_id: exchange.id });
    if (error) notify(`Suppression de l’échange impossible : ${error.message}`, true);
    else { await onRefresh(); notify('Échange supprimé.'); }
  };
  const deleteExchangeCase = async (exchangeCase) => {
    const exchanges = (data.crm_exchanges || []).filter((exchange) => exchange.case_id === exchangeCase.id);
    const exchangeIds = new Set(exchanges.map((exchange) => exchange.id));
    const actionCount = (data.crm_actions || []).filter((action) => exchangeIds.has(action.exchange_id)).length;
    const documentCount = (data.trade_documents || []).filter((document) => document.case_id === exchangeCase.id || exchangeIds.has(document.exchange_id)).length;
    const paymentCount = (data.trade_payments || []).filter((payment) => payment.case_id === exchangeCase.id || exchangeIds.has(payment.exchange_id)).length;
    const retainedRecords = [documentCount ? `${documentCount} document(s)` : '', paymentCount ? `${paymentCount} paiement(s)` : ''].filter(Boolean).join(' et ');
    const confirmation = `Supprimer définitivement le dossier « ${exchangeCase.title} » ?\n\n${exchanges.length} échange(s) et ${actionCount} action(s) liés seront supprimés. ${retainedRecords ? `${retainedRecords} resteront conservés, mais ne seront plus reliés au dossier.` : ''}`;
    if (!window.confirm(confirmation)) return;
    const { error } = await client.rpc('delete_crm_exchange_case', { p_case_id: exchangeCase.id });
    if (error) notify(`Suppression du dossier impossible : ${error.message}`, true);
    else {
      if (focusedCaseId === exchangeCase.id) setFocusedCaseId(null);
      await onRefresh();
      notify('Dossier supprimé.');
    }
  };
  const updateCaseStatus = async (caseId, status) => {
    const { error } = await client.from('crm_exchange_cases').update({ status, updated_at: new Date().toISOString() }).eq('id', caseId);
    if (error) notify(`Mise à jour du dossier impossible : ${error.message}`, true);
    else { await onRefresh(); notify('Statut du dossier mis à jour.'); }
  };
  const updateCaseStage = async (caseId, trade_stage) => {
    const { error } = await client.from('crm_exchange_cases').update({ trade_stage, updated_at: new Date().toISOString() }).eq('id', caseId);
    if (error) notify(`Mise à jour de l’étape commerciale impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const selectExchangeProducts = (productIds) => {
    setSelectedProductIds(productIds);
    setExchangeProductDetails((current) => Object.fromEntries(productIds.map((id) => [id, current[id] || { packaging_level: 'uvc', quantity: '', uvc_unit_price: '' }])));
  };
  const toggleExchangeProduct = (productId) => {
    selectExchangeProducts(selectedProductIds.includes(productId)
      ? selectedProductIds.filter((id) => id !== productId)
      : [...selectedProductIds, productId]);
  };
  const updateExchangeProduct = (productId, field, value) => setExchangeProductDetails((current) => ({
    ...current,
    [productId]: { packaging_level: 'uvc', quantity: '', uvc_unit_price: '', ...current[productId], [field]: value },
  }));
  const exchangeProductResults = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return (data.products || []).filter((product) => {
      const brand = (data.brands || []).find((item) => item.id === product.brand_id)?.name || '';
      const matchesQuery = !query || [product.designation, product.internal_reference, product.ean_gtin, brand].some((value) => String(value || '').toLocaleLowerCase().includes(query));
      return matchesQuery && (productCategoryFilter === 'all' || product.category_id === productCategoryFilter) && (productBrandFilter === 'all' || product.brand_id === productBrandFilter);
    }).sort((a, b) => String(a.designation || '').localeCompare(String(b.designation || ''), 'fr'));
  }, [data.products, data.brands, productSearch, productCategoryFilter, productBrandFilter]);
  const detailKind = selected?.kind;
  const detail = selected?.row;
  const exchangeCountForContact = (contactId) => {
    const linkedCaseIds = (data.crm_exchange_case_contacts || []).filter((link) => link.contact_id === contactId).map((link) => link.case_id);
    const casesForContact = (data.crm_exchange_cases || []).filter((exchangeCase) => exchangeCase.contact_id === contactId || linkedCaseIds.includes(exchangeCase.id));
    const legacyCount = (data.crm_exchanges || []).filter((exchange) => !exchange.case_id && exchange.contact_id === contactId).length;
    return casesForContact.length + legacyCount;
  };

  return <section className="directory-section network-directory">
    <NetworkDirectoryViews
      tab={tab} setTab={setTab} search={search} setSearch={setSearch}
      filter={directoryFilter} setFilter={setDirectoryFilter} sort={directorySort} setSort={setDirectorySort}
      data={data} contacts={contacts} companies={companies} rows={rows} contactsFor={contactsFor}
      onOpenContact={(contact, caseId = null) => { setSelected({ kind: 'contact', row: contact }); setDetailTab(caseId ? 'exchanges' : 'details'); setFocusedCaseId(caseId); setShowExchangeForm(false); }}
      onOpenRelated={(contact, caseId = null) => { setSelected({ kind: 'contact', row: contact }); setDetailTab('exchanges'); setFocusedCaseId(caseId); setShowExchangeForm(false); }}
      onOpenCompany={(company) => setSelected({ kind: 'company', row: company })}
      onNewContact={() => startNew('contact')} onNewCompany={() => startNew('company')}
      onNewExchange={(contact = contacts[0]) => contact && startContactExchange(contact)}
      onActionStatus={updateActionStatus}
    />
    {detail && <ModalBackdrop onClose={() => setSelected(null)}><section className="modal-card modal-wide network-contact-modal" role="dialog" aria-modal="true" aria-labelledby="network-detail-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{detailKind === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-detail-title">{detailKind === 'company' ? detail.name : contactDisplayName(detail)}</h2></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><X size={17} /></button></div>
      {detailKind === 'contact' && (() => { const companyName = companies.find((entry) => entry.id === detail.company_id)?.name; const phone = [detail.phone_country_code, detail.phone_number].filter(Boolean).join('') || [detail.mobile_country_code, detail.mobile_number].filter(Boolean).join(''); const whatsapp = [detail.whatsapp_country_code, detail.whatsapp_number].filter(Boolean).join('').replace(/\D/g, ''); const photo = detail.contact_photo_path ? data.mediaUrls?.[detail.contact_photo_path] : ''; return <div className="network-contact-hero"><div className="network-contact-hero-avatar">{photo ? <img src={photo} alt="" /> : <ContactRound size={20} />}</div><div className="network-contact-hero-copy"><span>{detail.job_role || 'Personne'}{companyName ? ` · ${companyName}` : ''}</span><small>{[detail.city, detail.country].filter(Boolean).join(', ') || 'Localisation à renseigner'}</small></div><div className="network-contact-quick-actions">{phone && <a className="button button-quiet button-small" href={`tel:${phone}`}><Phone size={14} /> Appeler</a>}{detail.email && <a className="button button-quiet button-small" href={`mailto:${detail.email}`}><Mail size={14} /> E-mail</a>}{whatsapp && <a className="button button-quiet button-small" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}</div></div>; })()}
      <p className="eyebrow">FICHE {detailKind === 'company' ? 'SOCIÉTÉ' : 'CONTACT'}</p>
      {detailKind === 'contact' ? <>
        <div className="network-contact-detail-tabs" role="tablist" aria-label="Rubriques de la fiche contact"><button type="button" role="tab" aria-selected={detailTab === 'details'} className={detailTab === 'details' ? 'is-active' : ''} onClick={() => setDetailTab('details')}>Coordonnées</button><button type="button" role="tab" aria-selected={detailTab === 'exchanges'} className={detailTab === 'exchanges' ? 'is-active' : ''} onClick={() => setDetailTab('exchanges')}>Échanges <span>{exchangeCountForContact(detail.id)}</span></button></div>
        {detailTab === 'details' ? <div role="tabpanel" className="network-contact-details-panel"><section className="network-detail-section"><h3>Informations du contact</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['nickname', 'job_role', 'contact_source', 'facebook_messenger_url', 'linkedin_messenger_url'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}{detail.company_id && <div className="network-detail-item"><small>Société associée</small><strong>{companies.find((entry) => entry.id === detail.company_id)?.name || 'Société associée'}</strong></div>}</div></section><section className="network-detail-section"><h3>Coordonnées</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['email', 'phone_number', 'mobile_number', 'whatsapp_number'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div></section><section className="network-detail-section"><h3>Localisation</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['country', 'region', 'city', 'postal_code', 'address'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div></section><NetworkAssociations kind="contact" row={detail} data={data} /></div> : <div role="tabpanel" className="network-exchange-panel">
          <div className="network-exchange-heading"><div><span className="reference-label">SUIVI COMMERCIAL</span><h3>Échanges et dossiers</h3><p>Demandes, réponses, relances et prochaines actions.</p></div><div className="network-exchange-heading-actions"><button type="button" className="button button-quiet" onClick={() => startContactExchange(detail)}><FolderPlus size={16} /> Nouveau dossier</button><button type="button" className="button button-primary network-exchange-fab" disabled={!selectedHistoryCaseId} onClick={() => { const exchangeCase = data.crm_exchange_cases.find((item) => item.id === selectedHistoryCaseId && (item.contact_id === detail.id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === item.id && link.contact_id === detail.id))); if (exchangeCase) startContactExchange(detail, exchangeCase); }}><Plus size={16} /> Nouvel échange</button></div></div>
          {showExchangeForm && exchangeDraft && <form className="network-exchange-form" onSubmit={saveContactExchange}>
            <div className="network-exchange-form-heading"><div><strong>{activeCaseId ? 'Nouvelle activité dans le dossier' : 'Nouveau dossier'}</strong><small>{activeCaseId ? 'Ajoute une étape au suivi existant.' : 'Consigne la demande, puis garde la prochaine action sous contrôle.'}</small></div><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => { setShowExchangeForm(false); setExchangeDraft(null); setActiveCaseId(null); setRelatedContactIds([]); setExchangeFile(null); }}><X size={15} /></button></div>
            {!activeCaseId && <div className="network-form-section-label"><span>1</span><strong>Dossier</strong><small>Choisis le sujet qui servira de titre au dossier.</small></div>}
            {!activeCaseId && <label className="field"><span>Sujet du dossier</span><select value={exchangeDraft.case_kind} onChange={(event) => { const case_kind = event.target.value; const scenario = scenarioForCaseKind(case_kind); const workflow = getExchangeWorkflow(scenario); setExchangeDraft((draft) => ({ ...draft, case_kind, scenario, action_type: workflow.actionType, action_title: workflow.title, action_due_at: suggestedActionDate(workflow.days), action_description: workflow.description || '', action_priority: workflow.priority || 'normal', primary_contact_role: ['supplier_catalog', 'price_intel', 'sourcing'].includes(case_kind) ? 'supplier' : draft.primary_contact_role })); }}>{Object.entries(caseKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><small className="muted">Le sujet devient le titre du dossier et propose des étapes de suivi adaptées.</small></label>}
            {!activeCaseId && <label className="field"><span>Rôle de {contactDisplayName(detail)} dans ce dossier</span><select value={exchangeDraft.primary_contact_role || 'other'} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, primary_contact_role: event.target.value }))}>{Object.entries(contactRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>}
            {!activeCaseId && (caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).length > 0 && <details className="network-optional-section"><summary>Préciser la demande <span>{(caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).length} champ{(caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).length > 1 ? 's' : ''} selon le sujet</span></summary><div className="network-exchange-case-data">{(caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).map(([key, label, type]) => <label className="field" key={key}><span>{label}</span>{type === 'textarea' ? <textarea rows="2" value={exchangeDraft.case_data?.[key] ?? ''} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_data: { ...(draft.case_data || {}), [key]: event.target.value } }))} /> : <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} value={exchangeDraft.case_data?.[key] ?? ''} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_data: { ...(draft.case_data || {}), [key]: type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value } }))} />}</label>)}</div></details>}
            <div className="network-form-section-label"><span>{activeCaseId ? '1' : '2'}</span><strong>Échange consigné</strong><small>Quand, comment et ce qui a été dit.</small></div>
            <div className="form-grid two-columns">
              <label className="field"><span>Date et heure</span><input type="datetime-local" required value={exchangeDraft.occurred_at} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, occurred_at: event.target.value }))} /></label>
              <label className="field"><span>Sens</span><select value={exchangeDraft.direction} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, direction: event.target.value }))}><option value="incoming">Entrant · reçu</option><option value="outgoing">Sortant · envoyé</option></select></label>
              <label className="field"><span>Catégorie</span><select value={exchangeDraft.category} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, category: event.target.value }))}><option value="lead">Demande commerciale</option><option value="trade">Transaction</option><option value="open">Discussion / information</option></select></label>
              <label className="field"><span>Canal</span><select value={exchangeDraft.channel} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, channel: event.target.value, channel_kind: ['in_person', 'meeting', 'other_physical'].includes(event.target.value) ? 'physical' : 'digital' }))}><option value="whatsapp_message">WhatsApp · message</option><option value="whatsapp_call">WhatsApp · appel</option><option value="phone_call">Téléphone</option><option value="email">E-mail</option><option value="sms">SMS</option><option value="in_person">En personne</option><option value="other">Autre</option></select></label>
            </div>
            <label className="field"><span>Scénario de l’échange</span><select value={exchangeDraft.scenario || scenarioForCaseKind(exchangeDraft.case_kind)} onChange={(event) => { const scenario = event.target.value; const workflow = getExchangeWorkflow(scenario); setExchangeDraft((draft) => ({ ...draft, scenario, action_type: workflow.actionType, action_title: workflow.title, action_due_at: suggestedActionDate(workflow.days), action_description: workflow.description || '', action_priority: workflow.priority || 'normal' })); }}>{scenarioWorkflowLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="muted">Le scénario prépare la prochaine action suggérée. Tu peux la modifier ou la désactiver.</small></label>
            {!activeCaseId && <details className="network-optional-section"><summary>Associer d’autres contacts <span>{relatedContactIds.length ? `${relatedContactIds.length} sélectionné${relatedContactIds.length > 1 ? 's' : ''}` : 'Facultatif'}</span></summary><label className="field"><span>Contacts concernés</span><select multiple value={relatedContactIds} onChange={(event) => { const selectedIds = Array.from(event.target.selectedOptions, (option) => option.value); setRelatedContactIds(selectedIds); setRelatedContactRoles((current) => Object.fromEntries(selectedIds.map((id) => [id, current[id] || 'other']))); }}>{contacts.filter((contact) => contact.id !== detail.id).map((contact) => <option key={contact.id} value={contact.id}>{contactOptionName(contact, companies)}</option>)}</select><small className="muted">Chaque contact lié retrouvera le même dossier dans sa fiche.</small></label>{relatedContactIds.length > 0 && <div className="network-case-contact-roles">{relatedContactIds.map((contactId) => { const person = contacts.find((item) => item.id === contactId); return <label className="field" key={contactId}><span>{person ? contactOptionName(person, companies) : 'Contact'} · rôle</span><select value={relatedContactRoles[contactId] || 'other'} onChange={(event) => setRelatedContactRoles((current) => ({ ...current, [contactId]: event.target.value }))}>{Object.entries(contactRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>; })}</div>}</details>}
            <label className="field"><span>Compte rendu / information</span><textarea rows="4" value={exchangeDraft.content} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, content: event.target.value }))} placeholder="Note l’échange, les produits, prix, réponses ou prochaines étapes…" /></label>
            <details className="network-exchange-products network-optional-section"><summary>Produits concernés <span>{selectedProductIds.length ? `${selectedProductIds.length} sélectionné${selectedProductIds.length > 1 ? 's' : ''}` : 'Ajouter si nécessaire'}</span></summary>
              <label className="search-input network-product-search"><Search size={15} /><input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nom, référence ou code-barres…" aria-label="Rechercher un produit" /></label>
              <div className="network-product-filters"><label className="field"><span>Catégorie</span><select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}><option value="all">Toutes</option>{(data.product_categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field"><span>Marque</span><select value={productBrandFilter} onChange={(event) => setProductBrandFilter(event.target.value)}><option value="all">Toutes</option>{(data.brands || []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label></div>
              {selectedProductIds.length > 0 && <div className="network-product-selected" aria-label="Produits sélectionnés">{selectedProductIds.map((productId) => { const product = (data.products || []).find((item) => item.id === productId); return product ? <button type="button" key={productId} onClick={() => toggleExchangeProduct(productId)} title={`Retirer ${product.designation}`}><span>{product.designation}</span><X size={12} /></button> : null; })}</div>}
              <div className="network-product-results" role="group" aria-label="Résultats produits">
                {!productSearch.trim() && productCategoryFilter === 'all' && productBrandFilter === 'all' && <p className="muted network-product-empty">Saisis un nom, une référence ou un code-barres, ou choisis une catégorie ou une marque.</p>}
                {(productSearch.trim() || productCategoryFilter !== 'all' || productBrandFilter !== 'all') && exchangeProductResults.slice(0, 100).map((product) => <label className={`network-product-option${selectedProductIds.includes(product.id) ? ' is-selected' : ''}`} key={product.id}><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleExchangeProduct(product.id)} /><span><strong>{product.designation}</strong><small>{[product.internal_reference, (data.brands || []).find((item) => item.id === product.brand_id)?.name].filter(Boolean).join(' · ') || 'Sans référence ni marque'}</small></span></label>)}
                {(productSearch.trim() || productCategoryFilter !== 'all' || productBrandFilter !== 'all') && exchangeProductResults.length === 0 && <p className="muted network-product-empty">Aucun produit ne correspond. Essaie un autre nom, une référence ou un filtre.</p>}
                {(productSearch.trim() || productCategoryFilter !== 'all' || productBrandFilter !== 'all') && exchangeProductResults.length > 100 && <p className="muted network-product-empty">100 résultats affichés sur {exchangeProductResults.length}. Affine la recherche pour trouver le bon produit.</p>}
              </div><small className="muted">Recherche par nom, référence, code-barres ou marque. Les produits sélectionnés restent visibles même quand tu changes de filtre. Les prix seront consignés dans l’historique de l’échange.</small>
              {selectedProductIds.map((productId) => {
                const product = data.products.find((item) => item.id === productId);
                if (!product) return null;
                const details = exchangeProductDetails[productId] || { packaging_level: 'uvc', quantity: '', uvc_unit_price: '' };
                const rates = exchangeProductRates(product, details);
                const total = exchangeProductTotal(details, rates);
                return <article className="exchange-product-price" key={productId}><h3>{product.designation}</h3><div className="form-grid two-columns"><label className="field"><span>Conditionnement</span><select value={details.packaging_level} onChange={(event) => updateExchangeProduct(productId, 'packaging_level', event.target.value)}><option value="uvc">UVC</option><option value="pcb">PCB</option><option value="palette">Palette</option></select></label><label className="field"><span>Quantité</span><input type="number" min="1" step="1" value={details.quantity} onChange={(event) => updateExchangeProduct(productId, 'quantity', event.target.value)} /></label><label className="field"><span>Prix unitaire UVC (€)</span><input type="number" min="0" step="0.01" value={details.uvc_unit_price} onChange={(event) => updateExchangeProduct(productId, 'uvc_unit_price', event.target.value)} /></label><div className="exchange-product-total"><span>Total estimé · {details.quantity || '—'} {({ uvc: 'UVC', pcb: 'PCB', palette: 'palettes' })[details.packaging_level]}</span><strong>{formatExchangeCurrency(total)}</strong></div></div><div className="exchange-product-rates"><span>Prix UVC <strong>{formatExchangeCurrency(rates.uvc)}</strong></span><span>Prix PCB <strong>{formatExchangeCurrency(rates.pcb)}</strong></span><span>Prix palette <strong>{formatExchangeCurrency(rates.palette)}</strong></span></div></article>;
              })}
            </details>
            <div className="network-form-section-label"><span>{activeCaseId ? '2' : '3'}</span><strong>Suite à donner</strong><small>Prépare le suivi sans encombrer le compte rendu.</small></div>
            <details className="network-exchange-attachment network-optional-section"><summary>Ajouter un document <span>{exchangeFile ? exchangeFile.name : 'Facultatif'}</span></summary><label className="field network-exchange-upload"><span>Document reçu ou envoyé</span><input type="file" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={(event) => setExchangeFile(event.target.files?.[0] || null)} />{exchangeFile && <small>{exchangeFile.name} · {(exchangeFile.size / (1024 * 1024)).toFixed(1)} Mo</small>}</label></details>
            <section className="network-exchange-task"><div className="network-exchange-task-heading"><div><strong><CalendarClock size={16} /> Prochaine action</strong><small>{exchangeDraft.action_enabled ? `Suggestion · ${scenarioWorkflowLabels.find(([value]) => value === exchangeDraft.scenario)?.[1] || 'autre scénario'}` : 'Aucun suivi planifié'}</small></div><label className="network-workflow-toggle"><input type="checkbox" checked={Boolean(exchangeDraft.action_enabled)} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_enabled: event.target.checked }))} /><span>{exchangeDraft.action_enabled ? 'À suivre' : 'Désactivée'}</span></label></div>{exchangeDraft.action_enabled && <><div className="network-action-primary-fields"><label className="field"><span>Action à faire</span><input value={exchangeDraft.action_title} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_title: event.target.value }))} placeholder="Ex. Relancer Marta pour son prix" /></label><label className="field"><span>Échéance</span><input type="datetime-local" value={exchangeDraft.action_due_at} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_due_at: event.target.value }))} /></label></div><details className="network-optional-section"><summary>Options de l’action <span>Contact, type et priorité</span></summary><div className="form-grid two-columns"><label className="field"><span>Contact à solliciter</span><select value={exchangeDraft.action_contact_id || detail.id} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_contact_id: event.target.value }))}><option value={detail.id}>{contactOptionName(detail, companies)} · contact principal</option>{(activeCaseId ? (data.crm_exchange_case_contacts || []).filter((link) => link.case_id === activeCaseId).map((link) => link.contact_id) : relatedContactIds).filter((id) => id !== detail.id).map((id) => { const person = contacts.find((item) => item.id === id); return person ? <option key={id} value={id}>{contactOptionName(person, companies)} · {contactRoleLabels[relatedContactRoles[id] || 'other']}</option> : null; })}</select></label><label className="field"><span>Type d’action</span><select value={exchangeDraft.action_type || 'follow_up'} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_type: event.target.value }))}>{actionTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Priorité</span><select value={exchangeDraft.action_priority || 'normal'} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_priority: event.target.value }))}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option></select></label><label className="field"><span>Consigne pour le suivi</span><textarea rows="2" value={exchangeDraft.action_description || ''} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_description: event.target.value }))} /></label></div></details></>}</section>
            <div className="form-actions"><button type="button" className="button button-quiet" disabled={savingExchange} onClick={() => { setShowExchangeForm(false); setExchangeDraft(null); setActiveCaseId(null); setRelatedContactIds([]); setExchangeFile(null); }}>Annuler</button><button type="submit" className="button button-primary" disabled={savingExchange}>{savingExchange ? 'Enregistrement…' : activeCaseId ? 'Enregistrer l’échange' : 'Créer le dossier et l’échange'}</button></div>
          </form>}
          <ContactExchangeHistory key={`${detail.id}:${focusedCaseId || ''}`} data={data} contact={detail} initialCaseId={focusedCaseId} onCreate={() => startContactExchange(detail)} onAddEvent={(exchangeCase) => startContactExchange(detail, exchangeCase)} onActiveCaseChange={setSelectedHistoryCaseId} onActionStatus={updateActionStatus} onCaseStatus={updateCaseStatus} onCaseStage={updateCaseStage} onDeleteCase={deleteExchangeCase} onGenerateProductPdf={(ids) => onGenerateProductPdf?.(ids)} onCreateProforma={(request) => onCreateProforma?.(request)} onSaveExchange={saveExchangeRecord} onCancelExchange={cancelExchangeRecord} onDeleteExchange={deleteExchangeRecord} />
        </div>}
      </> : <><section className="network-detail-section"><h3>Identité et activité</h3><div className="network-detail-grid">{companyFields.filter(([key]) => ['name', 'main_activity', 'secondary_activities'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}{Object.entries(detail.legal_identifiers || {}).filter(([, value]) => value).map(([key, value]) => <div className="network-detail-item" key={key}><small>{{ siren: 'SIREN', siret: 'SIRET', vat: 'N° TVA' }[key] || key}</small><strong>{value}</strong></div>)}{(detail.purchase_sales_zones || []).length > 0 && <div className="network-detail-item"><small>Zones d’achat et de vente</small><strong>{detail.purchase_sales_zones.join(', ')}</strong></div>}</div></section><section className="network-detail-section"><h3>Coordonnées de la société</h3><div className="network-detail-grid">{companyFields.filter(([key]) => ['country', 'headquarters_region', 'headquarters_city', 'headquarters_postal_code', 'headquarters_address', 'phone_number', 'email', 'website'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div></section><NetworkAssociations kind="company" row={detail} data={data} /><div className="network-related-contacts"><h3>Contacts associés</h3>{contactsFor(detail).length ? contactsFor(detail).map((contact) => <button type="button" key={contact.id} onClick={() => openContact(contact)}>{contactDisplayName(contact)}<small>{contact.job_role || contact.email}</small></button>) : <p>Aucun contact associé. Une société peut exister sans contact nominatif.</p>}</div></>}
      <div className={`modal-actions network-contact-modal-actions${detailKind === 'contact' && detailTab === 'exchanges' ? ' is-minimal' : ''}`}>{(detailKind !== 'contact' || detailTab === 'details') && <button className="button button-danger-ghost" type="button" onClick={() => remove(detail, detailKind)}>Supprimer</button>}<button className="button button-quiet" type="button" onClick={() => setSelected(null)}>Fermer</button>{(detailKind !== 'contact' || detailTab === 'details') && <button className="button button-primary" type="button" onClick={() => startEdit(detail, detailKind)}>Modifier la fiche</button>}</div></section></ModalBackdrop>}

    {editing && draft && <ModalBackdrop onClose={() => { if (!saving) { setEditing(null); setDraft(null); } }}><section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="network-form-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{editing === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-form-title">{draft.id ? 'Modifier la fiche' : `Nouvelle fiche ${editing === 'company' ? 'société' : 'contact'}`}</h2></div><button type="button" className="icon-button" onClick={() => { setEditing(null); setDraft(null); }} aria-label="Fermer"><X size={17} /></button></div><form className="record-form" onSubmit={save}>{editing === "contact" && <div className="contact-photo-tools">{photoPath && data.mediaUrls?.[photoPath] ? <img src={data.mediaUrls[photoPath]} alt="Portrait du contact" /> : <span><ImagePlus size={20} /></span>}<label className="button button-quiet button-small"><Upload size={13} /> Importer une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setPhotoFile(event.target.files?.[0] || null); }} /></label><button type="button" className="button button-quiet button-small" onClick={() => setShowMediaPicker(true)}>Choisir dans la médiathèque</button>{photoFile && <small>{photoFile.name}</small>}</div>}{editing === 'contact' && <div className="form-grid two-columns"><Field label="Prénom" value={draft.first_name} onChange={(value) => setDraft((d) => ({ ...d, first_name: value }))} /><Field label="Nom" value={draft.last_name} onChange={(value) => setDraft((d) => ({ ...d, last_name: value }))} /><Field label="Surnom / pseudonyme" value={draft.nickname} onChange={(value) => setDraft((current) => ({ ...current, nickname: value }))} /><small className="network-name-help">Renseigne au moins le prénom, le nom ou le pseudonyme.</small></div>}{editing === "contact" && <div className="network-company-picker"><label className="field"><span>Société liée (facultatif)</span><select value={draft.company_id || ""} onChange={(event) => setDraft((d) => ({ ...d, company_id: event.target.value, profile: event.target.value ? "professional" : "individual" }))}><option value="">Aucune société liée</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label><button type="button" className="button button-quiet button-small" onClick={() => setCompanyQuickDraft({ ...companyDefaults })}><Plus size={14} /> Créer une société</button>{companyQuickDraft && <div className="network-company-quick-form"><Field label="Nom de la société" required value={companyQuickDraft.name} onChange={(value) => setCompanyQuickDraft((current) => ({ ...current, name: value }))} /><div><button type="button" className="button button-quiet button-small" disabled={savingQuickCompany} onClick={() => setCompanyQuickDraft(null)}>Annuler</button><button type="button" className="button button-primary button-small" disabled={savingQuickCompany || !companyQuickDraft.name?.trim()} onClick={createCompanyFromContact}>{savingQuickCompany ? "Création…" : "Créer et associer"}</button></div></div>}</div>}<div className="form-grid two-columns">{(editing === 'contact' ? contactFields.filter(([key]) => !['first_name', 'last_name', 'nickname'].includes(key)) : companyFields).map(([key, label]) => <Field key={key} label={label} required={editing === 'company' && key === 'name'} type={key === 'email' ? 'email' : key.endsWith('_url') || key === 'website' ? 'url' : 'text'} multiline={key === 'address' || key === 'headquarters_address' || key === 'secondary_activities'} value={draft[key]} onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} />)}{editing === 'company' && <><div className="network-legal-identifiers"><strong>Identifiants légaux</strong>{[['siren', 'SIREN'], ['siret', 'SIRET'], ['vat', 'N° TVA intracommunautaire']].map(([key, label]) => <Field key={key} label={label} value={draft.legal_identifiers?.[key] || ''} onChange={(value) => setDraft((current) => ({ ...current, legal_identifiers: { ...(current.legal_identifiers || {}), [key]: value } }))} />)}</div><Field label="Zones d’achat et de vente (séparées par des virgules)" value={(draft.purchase_sales_zones || []).join(', ')} onChange={(value) => setDraft((current) => ({ ...current, purchase_sales_zones: value.split(',').map((zone) => zone.trim()).filter(Boolean) }))} /></>}</div><div className="modal-actions"><button className="button button-quiet" type="button" disabled={saving} onClick={() => { setEditing(null); setDraft(null); }}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || (editing === 'contact' && !draft.first_name?.trim() && !draft.last_name?.trim() && !draft.nickname?.trim()) || (editing === 'company' && !draft.name?.trim())}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div></form></section></ModalBackdrop>}
    {showMediaPicker && <MediaPicker data={data} onClose={() => setShowMediaPicker(false)} onSelect={(asset) => { setPhotoFile(null); setPhotoPath(asset.storage_path); setShowMediaPicker(false); }} />}
  </section>;
}
