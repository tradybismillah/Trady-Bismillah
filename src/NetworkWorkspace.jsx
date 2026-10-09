import { useMemo, useState } from 'react';
import { Building2, CalendarClock, ContactRound, FileDown, FileText, ImagePlus, Mail, MapPin, MessageCircle, MessageSquare, Phone, Plus, Search, Upload, X } from 'lucide-react';
import { MediaPicker } from './MediaLibrary.jsx';
import ModalBackdrop from './ModalA11y.jsx';
import Tabs from './Tabs.jsx';
import { exchangeProductRates, exchangeProductTotal, formatExchangeCurrency } from './lib/exchangePricing.js';

const contactDefaults = { profile: 'individual', first_name: '', last_name: '', job_role: '', country: '', region: '', city: '', postal_code: '', address: '', phone_country_code: '', phone_number: '', mobile_country_code: '', mobile_number: '', whatsapp_country_code: '', whatsapp_number: '', facebook_messenger_url: '', linkedin_messenger_url: '', email: '', contact_source: '', company_id: '' };
const companyDefaults = { name: '', country: '', legal_identifiers: {}, headquarters_region: '', headquarters_city: '', headquarters_postal_code: '', headquarters_address: '', phone_country_code: '', phone_number: '', email: '', website: '', main_activity: '', secondary_activities: '', purchase_sales_zones: [] };
const contactFields = [['first_name', 'Prénom'], ['last_name', 'Nom'], ['job_role', 'Fonction'], ['email', 'E-mail'], ['phone_number', 'Téléphone'], ['mobile_number', 'Mobile'], ['whatsapp_number', 'WhatsApp'], ['country', 'Pays'], ['region', 'Région'], ['city', 'Ville'], ['postal_code', 'Code postal'], ['address', 'Adresse'], ['contact_source', 'Origine du contact']];
const companyFields = [['name', 'Nom de la société'], ['country', 'Pays'], ['headquarters_region', 'Région du siège'], ['headquarters_city', 'Ville du siège'], ['headquarters_postal_code', 'Code postal'], ['headquarters_address', 'Adresse du siège'], ['phone_number', 'Téléphone'], ['email', 'E-mail'], ['website', 'Site web'], ['main_activity', 'Activité principale'], ['secondary_activities', 'Activités secondaires']];

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

function Field({ label, value, onChange, type = 'text', multiline = false }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea rows="3" value={value ?? ''} onChange={(e) => onChange(e.target.value)} /> : <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}</label>;
}

function valueFor(record, key) {
  const value = record[key];
  if (key.endsWith('phone_number') && value && record[`${key.replace('phone_number', 'phone_country_code')}`]) return `${record[key.replace('phone_number', 'phone_country_code')]} ${value}`;
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

function ExchangeEventCard({ exchange, data, onActionStatus }) {
  const tasks = (data.crm_actions || []).filter((action) => action.exchange_id === exchange.id);
  const contact = data.network_contacts.find((person) => person.id === exchange.contact_id);
  const products = (data.crm_exchange_products || []).filter((item) => item.exchange_id === exchange.id).map((item) => ({ ...item, product: data.products.find((product) => product.id === item.product_id) })).filter((item) => item.product);
  return <article className="network-exchange-card" key={exchange.id}>
    <div className="network-exchange-card-meta"><span>{formatExchangeDate(exchange.occurred_at)}{contact ? ` · ${[contact.first_name, contact.last_name].filter(Boolean).join(' ')}` : ''}</span><span className={`network-exchange-direction ${exchange.direction === 'outgoing' ? 'is-outgoing' : ''}`}>{exchange.direction === 'outgoing' ? 'Envoyé' : 'Reçu'}</span></div>
    <div className="network-exchange-card-title"><MessageSquare size={15} /><strong>{exchangeCategoryLabels[exchange.category] || 'Échange'}</strong><span>{exchangeChannelLabels[exchange.channel] || exchange.channel}</span></div>
    {exchange.content && <p>{exchange.content}</p>}
    {products.length > 0 && <div className="network-exchange-event-products"><strong>Produits et prix consignés</strong>{products.map((item) => <div key={item.product_id}><span>{item.product.designation}</span><small>{item.quantity ? `${item.quantity} ${({ uvc: 'UVC', pcb: 'PCB', palette: 'palettes' })[item.packaging_level] || item.packaging_level} · ` : ''}{item.uvc_unit_price != null ? `${formatExchangeCurrency(item.uvc_unit_price)} / UVC` : 'Prix non renseigné'}</small></div>)}</div>}
    {tasks.length > 0 && <div className="network-exchange-actions"><strong>Tâches de suivi</strong>{tasks.map((action) => <div className="network-exchange-action" key={action.id}><span>{action.title}{action.due_at ? <small> · {formatExchangeDate(action.due_at)}</small> : null}</span><select aria-label={`Statut de la tâche ${action.title}`} value={action.status} onChange={(event) => onActionStatus(action.id, event.target.value)}>{Object.entries(actionStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></div>)}</div>}
  </article>;
}

function ContactExchangeHistory({ data, contact, onCreate, onAddEvent, onActionStatus, onCaseStatus, onGenerateProductPdf, onCreateProforma }) {
  const [caseFilter, setCaseFilter] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
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
  const caseIds = new Set(cases.map((exchangeCase) => exchangeCase.id));
  const caseEvents = (data.crm_exchanges || []).filter((exchange) => caseIds.has(exchange.case_id));
  const legacyEvents = (data.crm_exchanges || []).filter((exchange) => !exchange.case_id && exchange.contact_id === contact.id);
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
      const otherContacts = caseLinks.filter((link) => link.case_id === exchangeCase.id).map((link) => data.network_contacts.find((person) => person.id === link.contact_id)).filter((person) => person && person.id !== contact.id);
      const productIds = [...new Set(events.flatMap((exchange) => (data.crm_exchange_products || []).filter((item) => item.exchange_id === exchange.id).map((item) => item.product_id)))];
      const eventIds = new Set(events.map((exchange) => exchange.id));
      const documents = (data.trade_documents || []).filter((document) => eventIds.has(document.exchange_id));
      const customerProformas = documents.filter((document) => document.contact_id === exchangeCase.contact_id && document.document_type === 'proforma');
      const hasInvoice = documents.some((document) => document.contact_id === exchangeCase.contact_id && ['proforma', 'final_invoice'].includes(document.document_type));
      const firstPrimaryEvent = events.find((exchange) => exchange.contact_id === exchangeCase.contact_id);
      const caseDetails = (caseKindFields[exchangeCase.case_kind] || caseKindFields.other).filter(([key]) => exchangeCase.case_data?.[key] !== '' && exchangeCase.case_data?.[key] != null);
      return <section className="network-exchange-case" key={exchangeCase.id}>
        <div className="network-exchange-case-heading"><div><span className="reference-label">{caseKindLabels[exchangeCase.case_kind] || caseKindLabels.other} · {exchangeCategoryLabels[exchangeCase.category] || 'Dossier'}</span><h4>{exchangeCase.title}</h4><small>{otherContacts.length ? `Contacts associés : ${otherContacts.map((person) => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email).join(', ')}` : 'Suivi dans cette fiche contact'}</small></div><label className="network-exchange-status"><span>Statut</span><select aria-label={`Statut du dossier ${exchangeCase.title}`} value={exchangeCase.status} onChange={(event) => onCaseStatus(exchangeCase.id, event.target.value)}>{Object.entries(caseStatusLabels).filter(([status]) => status !== 'converted' || hasInvoice || exchangeCase.status === 'converted').map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label></div>
        {caseDetails.length > 0 && <dl className="network-exchange-case-details">{caseDetails.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{exchangeCase.case_data[key]}</dd></div>)}</dl>}
        {(data.crm_exchange_case_media || []).filter((link) => link.case_id === exchangeCase.id).map((link) => { const asset = (data.media_assets || []).find((item) => item.id === link.media_asset_id); const url = asset && data.mediaUrls?.[asset.storage_path]; return asset ? <a className="network-exchange-file" href={url || '#'} target="_blank" rel="noreferrer" key={link.media_asset_id}>{asset.file_name}</a> : null; })}
        {documents.length > 0 && <div className="network-exchange-documents"><strong>Factures et documents Trade</strong>{documents.map((document) => { const documentContact = data.network_contacts.find((person) => person.id === document.contact_id); return <span key={document.id}>{({ proforma: 'Facture pro forma', final_invoice: 'Facture finale', credit_note: 'Avoir', delivery_note: 'Bon de livraison' })[document.document_type] || 'Document'}{document.document_number ? ` · ${document.document_number}` : ''} · {documentContact ? [documentContact.first_name, documentContact.last_name].filter(Boolean).join(' ') : 'Contact'} · {({ draft: 'Brouillon', received: 'Reçu', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', stored: 'Archivé' })[document.status] || document.status}</span>; })}</div>}
        <div className="network-exchange-case-events">{events.map((exchange) => <ExchangeEventCard key={exchange.id} exchange={exchange} data={data} onActionStatus={onActionStatus} />)}</div>
        {exchangeCase.status !== 'closed_no_followup' && <button type="button" className="button button-quiet button-small" onClick={() => onCreateProforma({ contactId: exchangeCase.contact_id, exchangeId: firstPrimaryEvent?.id || '' })}><FileText size={14} /> Créer une facture pro forma</button>}
        {exchangeCase.status !== 'closed_no_followup' && customerProformas.length > 0 && <button type="button" className="button button-quiet button-small" onClick={() => { const proforma = [...customerProformas].reverse()[0]; onCreateProforma({ contactId: exchangeCase.contact_id, exchangeId: firstPrimaryEvent?.id || '', documentType: 'final_invoice', relatedDocumentId: proforma?.id || '' }); }}><FileText size={14} /> Créer la facture finale</button>}
        {productIds.length > 0 && <button type="button" className="button button-quiet button-small" onClick={() => onGenerateProductPdf(productIds)}><FileDown size={14} /> Préparer un listing PDF des produits</button>}
        <button type="button" className="button button-quiet button-small" onClick={() => onAddEvent(exchangeCase)}>+ Ajouter un appel, message ou suivi</button>
      </section>;
    })() : <div className="network-case-main-empty"><MessageSquare size={20} /><strong>{cases.length ? 'Aucun dossier dans cette vue' : 'Aucun dossier sélectionné'}</strong><span>{cases.length ? 'Modifie le filtre ou la recherche.' : 'Crée un nouvel échange pour commencer le suivi.'}</span></div>}
    {legacyEvents.length > 0 && <section className="network-exchange-legacy"><h4>Échanges enregistrés précédemment</h4>{legacyEvents.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)).map((exchange) => <ExchangeEventCard key={exchange.id} exchange={exchange} data={data} onActionStatus={onActionStatus} />)}</section>}
    </main>
  </div>;
}

export default function NetworkWorkspace({ data, client, onRefresh, notify, onGenerateProductPdf, onCreateProforma }) {
  const [tab, setTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPath, setPhotoPath] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [detailTab, setDetailTab] = useState('details');
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [savingExchange, setSavingExchange] = useState(false);
  const [exchangeDraft, setExchangeDraft] = useState(null);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [relatedContactIds, setRelatedContactIds] = useState([]);
  const [exchangeFile, setExchangeFile] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [exchangeProductDetails, setExchangeProductDetails] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productBrandFilter, setProductBrandFilter] = useState('all');
  const companies = data.network_companies || [];
  const contacts = data.network_contacts || [];
  const rows = useMemo(() => (tab === 'contacts' ? contacts : companies).filter((row) => {
    const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id)?.name : '';
    return `${tab === 'contacts' ? `${row.first_name} ${row.last_name} ${row.job_role}` : row.name} ${company || ''} ${row.email || ''} ${row.city || row.headquarters_city || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [tab, contacts, companies, search]);
  const contactsFor = (company) => contacts.filter((contact) => contact.company_id === company.id);
  const startNew = (kind) => { setSelected(null); setEditing(kind); setDraft({ ...(kind === 'company' ? companyDefaults : contactDefaults) }); setPhotoFile(null); setPhotoPath(''); };
  const openContact = (row) => { setDetailTab('details'); setShowExchangeForm(false); setExchangeDraft(null); setSelected({ kind: 'contact', row }); };
  const startContactExchange = (row, exchangeCase = null) => {
    setSelected({ kind: 'contact', row });
    setDetailTab('exchanges');
    setShowExchangeForm(true);
    setActiveCaseId(exchangeCase?.id || null);
    setExchangeFile(null);
    setSelectedProductIds([]);
    setExchangeProductDetails({});
    setProductSearch('');
    setProductCategoryFilter('all');
    setProductBrandFilter('all');
    setRelatedContactIds(exchangeCase ? (data.crm_exchange_case_contacts || []).filter((link) => link.case_id === exchangeCase.id).map((link) => link.contact_id) : []);
    setExchangeDraft({ occurred_at: localDateTimeValue(), direction: 'incoming', channel_kind: 'digital', channel: 'whatsapp_message', category: exchangeCase?.category || 'lead', case_kind: exchangeCase?.case_kind || 'other', case_data: exchangeCase?.case_data || {}, entry_kind: 'exchange', content: '', action_title: '', action_due_at: '', case_title: '' });
  };
  const startEdit = (row, kind) => { setSelected(null); setEditing(kind); setDraft({ ...(kind === 'company' ? companyDefaults : contactDefaults), ...row, company_id: row.company_id || '' }); setPhotoFile(null); setPhotoPath(row.contact_photo_path || ''); };
  const save = async (event) => {
    event.preventDefault();
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
        p_contact: kind === 'contact' ? { ...draft, profile: draft.company_id ? 'professional' : draft.profile, company_id: draft.company_id || null } : null,
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
    const label = kind === 'company' ? row.name : `${row.first_name} ${row.last_name}`;
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
      const action = exchangeDraft.action_title.trim()
        ? { title: exchangeDraft.action_title.trim(), due_at: exchangeDraft.action_due_at ? new Date(exchangeDraft.action_due_at).toISOString() : null }
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
          occurred_at: new Date(exchangeDraft.occurred_at).toISOString(),
          direction: exchangeDraft.direction,
          channel_kind: exchangeDraft.channel_kind,
          channel: exchangeDraft.channel,
          category: exchangeDraft.category,
          case_kind: exchangeDraft.case_kind,
          case_data: exchangeDraft.case_data || {},
          scenario: exchangeDraft.category === 'open' ? 'open_discussion' : exchangeDraft.category === 'trade' ? 'other' : 'price_request',
          subscenario: '',
          entry_kind: exchangeDraft.entry_kind,
          content: exchangeDraft.content.trim(),
          status: 'recorded',
          product_details: productDetails,
        };
      const { data: caseResult, error } = await client.rpc(activeCaseId ? 'add_crm_exchange_case_entry' : 'create_crm_exchange_case', activeCaseId
        ? { p_case_id: activeCaseId, p_exchange, p_action: action, p_product_ids: selectedProductIds, p_service_ids: [] }
        : { p_title: exchangeDraft.case_title, p_exchange, p_contact_ids: relatedContactIds, p_action: action, p_product_ids: selectedProductIds, p_service_ids: [] });
      if (error) throw error;
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
      setExchangeFile(null);
      setSelectedProductIds([]);
      setExchangeProductDetails({});
      await onRefresh();
      notify(attachmentWarning ? `Dossier enregistré, mais le document n’a pas été joint : ${attachmentWarning}` : exchangeFile ? 'Dossier, échange et document enregistrés.' : action ? 'Dossier, échange et tâche de suivi enregistrés.' : 'Dossier et échange enregistrés dans la fiche contact.', Boolean(attachmentWarning));
    } catch (error) {
      notify(`Enregistrement de l’échange impossible : ${error.message}`, true);
    } finally {
      setSavingExchange(false);
    }
  };
  const updateActionStatus = async (actionId, status) => {
    const { error } = await client.from('crm_actions').update({ status, updated_at: new Date().toISOString() }).eq('id', actionId);
    if (error) notify(`Mise à jour de la tâche impossible : ${error.message}`, true);
    else { await onRefresh(); notify('Suivi de la tâche mis à jour.'); }
  };
  const updateCaseStatus = async (caseId, status) => {
    const { error } = await client.from('crm_exchange_cases').update({ status, updated_at: new Date().toISOString() }).eq('id', caseId);
    if (error) notify(`Mise à jour du dossier impossible : ${error.message}`, true);
    else { await onRefresh(); notify('Statut du dossier mis à jour.'); }
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
    <div className="section-header"><div><p className="eyebrow">CRM</p><h1>Contacts</h1><p className="muted">Fiches contacts et sociétés, avec l’historique des échanges dans chaque fiche.</p></div><button className="button button-primary" type="button" onClick={() => startNew(tab === 'contacts' ? 'contact' : 'company')}><Plus size={16} /> Ajouter {tab === 'contacts' ? 'un contact' : 'une société'}</button></div>
    <Tabs className="network-tabs" label="Type de fiche" value={tab} onChange={setTab} tabs={[{ value: 'contacts', label: 'Contacts', count: contacts.length, icon: <ContactRound size={15} /> }, { value: 'companies', label: 'Sociétés', count: companies.length, icon: <Building2 size={15} /> }]} />
    <div className="table-tools"><label className="search-input"><Search size={16} /><input type="search" placeholder={`Rechercher ${tab === 'contacts' ? 'un contact, une société' : 'une société'}…`} value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="result-count">{rows.length} fiche{rows.length > 1 ? 's' : ''} sur {(tab === 'contacts' ? contacts : companies).length}</span></div>
    {!rows.length ? <div className="empty-state"><span className="empty-icon">{tab === 'contacts' ? <ContactRound size={22} /> : <Building2 size={22} />}</span><h2>Aucune fiche trouvée</h2><p>Ajoute une fiche pour commencer à organiser ton réseau.</p><button className="button button-primary" type="button" onClick={() => startNew(tab === 'contacts' ? 'contact' : 'company')}><Plus size={15} /> Ajouter une fiche</button></div> : <div className="record-grid">{rows.map((row) => {
      const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id) : null;
      const name = tab === 'contacts' ? `${row.first_name || ''} ${row.last_name || ''}`.trim() : row.name;
      const count = tab === 'contacts' ? null : contactsFor(row).length;
      const photo = tab === 'contacts' && row.contact_photo_path ? data.mediaUrls?.[row.contact_photo_path] : '';
      return <article className="record-card network-record-card" key={row.id} role="button" tabIndex={0} onClick={() => tab === 'contacts' ? openContact(row) : setSelected({ kind: 'company', row })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tab === 'contacts' ? openContact(row) : setSelected({ kind: 'company', row }); } }}>{photo ? <img className="network-avatar network-avatar-photo" src={photo} alt="" /> : <span className="network-avatar">{tab === 'contacts' ? <ContactRound size={19} /> : <Building2 size={19} />}</span>}<div className="record-card-body"><span className="reference-label">{tab === 'contacts' ? (row.profile === 'professional' ? 'PROFESSIONNEL' : 'PARTICULIER') : 'SOCIÉTÉ'}</span><h3>{name || 'Sans nom'}</h3><p>{tab === 'contacts' ? [row.job_role, company?.name].filter(Boolean).join(' · ') || row.email || 'Contact' : row.main_activity || row.email || 'Société du réseau'}</p><div className="card-meta"><span>{tab === 'contacts' ? [row.city, row.country].filter(Boolean).join(', ') || 'Coordonnées à renseigner' : `${count} contact${count > 1 ? 's' : ''}`}</span><span>{row.email || ''}</span></div></div></article>;
    })}</div>}

    {detail && <ModalBackdrop onClose={() => setSelected(null)}><section className="modal-card modal-wide network-contact-modal" role="dialog" aria-modal="true" aria-labelledby="network-detail-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{detailKind === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-detail-title">{detailKind === 'company' ? detail.name : `${detail.first_name} ${detail.last_name}`}</h2></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><X size={17} /></button></div>
      {detailKind === 'contact' && (() => { const companyName = companies.find((entry) => entry.id === detail.company_id)?.name; const phone = [detail.phone_country_code, detail.phone_number].filter(Boolean).join('') || [detail.mobile_country_code, detail.mobile_number].filter(Boolean).join(''); const whatsapp = [detail.whatsapp_country_code, detail.whatsapp_number].filter(Boolean).join('').replace(/\D/g, ''); const photo = detail.contact_photo_path ? data.mediaUrls?.[detail.contact_photo_path] : ''; return <div className="network-contact-hero"><div className="network-contact-hero-avatar">{photo ? <img src={photo} alt="" /> : <ContactRound size={20} />}</div><div className="network-contact-hero-copy"><span>{detail.job_role || (detail.profile === 'professional' ? 'Professionnel' : 'Particulier')}{companyName ? ` · ${companyName}` : ''}</span><small>{[detail.city, detail.country].filter(Boolean).join(', ') || 'Localisation à renseigner'}</small></div><div className="network-contact-quick-actions">{phone && <a className="button button-quiet button-small" href={`tel:${phone}`}><Phone size={14} /> Appeler</a>}{detail.email && <a className="button button-quiet button-small" href={`mailto:${detail.email}`}><Mail size={14} /> E-mail</a>}{whatsapp && <a className="button button-quiet button-small" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}</div></div>; })()}
      <p className="eyebrow">FICHE {detailKind === 'company' ? 'SOCIÉTÉ' : detail.profile === 'professional' ? 'PROFESSIONNEL' : 'CONTACT'}</p>
      {detailKind === 'contact' ? <>
        <div className="network-contact-detail-tabs" role="tablist" aria-label="Rubriques de la fiche contact"><button type="button" role="tab" aria-selected={detailTab === 'details'} className={detailTab === 'details' ? 'is-active' : ''} onClick={() => setDetailTab('details')}>Coordonnées</button><button type="button" role="tab" aria-selected={detailTab === 'exchanges'} className={detailTab === 'exchanges' ? 'is-active' : ''} onClick={() => setDetailTab('exchanges')}>Échanges <span>{exchangeCountForContact(detail.id)}</span></button></div>
        {detailTab === 'details' ? <div role="tabpanel" className="network-contact-details-panel"><section className="network-detail-section"><h3>Informations du contact</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['job_role', 'contact_source'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}{detail.company_id && <div className="network-detail-item"><small>Société associée</small><strong>{companies.find((entry) => entry.id === detail.company_id)?.name || 'Société associée'}</strong></div>}</div></section><section className="network-detail-section"><h3>Coordonnées</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['email', 'phone_number', 'mobile_number', 'whatsapp_number'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div></section><section className="network-detail-section"><h3>Localisation</h3><div className="network-detail-grid">{contactFields.filter(([key]) => ['country', 'region', 'city', 'postal_code', 'address'].includes(key)).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div></section><NetworkAssociations kind="contact" row={detail} data={data} /></div> : <div role="tabpanel" className="network-exchange-panel">
          <div className="network-exchange-heading"><div><span className="reference-label">SUIVI COMMERCIAL</span><h3>Échanges et dossiers</h3><p>Demandes, réponses, relances et prochaines actions.</p></div><button type="button" className="button button-primary network-exchange-fab" onClick={() => startContactExchange(detail)}><Plus size={16} /> Nouvel échange</button></div>
          {showExchangeForm && exchangeDraft && <form className="network-exchange-form" onSubmit={saveContactExchange}>
            <div className="network-exchange-form-heading"><div><strong>{activeCaseId ? 'Nouvelle activité dans le dossier' : 'Nouveau dossier'}</strong><small>{activeCaseId ? 'Ajoute une étape au suivi existant.' : 'Consigne la demande, puis garde la prochaine action sous contrôle.'}</small></div><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => { setShowExchangeForm(false); setExchangeDraft(null); setActiveCaseId(null); setRelatedContactIds([]); setExchangeFile(null); }}><X size={15} /></button></div>
            {!activeCaseId && <div className="network-form-section-label"><span>1</span><strong>Dossier</strong><small>Donne un titre facile à retrouver.</small></div>}
            {!activeCaseId && <label className="field"><span>Objet du dossier</span><input required maxLength={180} value={exchangeDraft.case_title} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_title: event.target.value }))} placeholder="Ex. Transport de marchandises pour Sofiane" /></label>}
            {!activeCaseId && <label className="field"><span>Sujet du dossier</span><select value={exchangeDraft.case_kind} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_kind: event.target.value }))}>{Object.entries(caseKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><small className="muted">Ce sujet sert à classer et retrouver les demandes. La liste peut évoluer.</small></label>}
            {!activeCaseId && (caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).length > 0 && <div className="network-exchange-case-data">{(caseKindFields[exchangeDraft.case_kind] || caseKindFields.other).map(([key, label, type]) => <label className="field" key={key}><span>{label}</span>{type === 'textarea' ? <textarea rows="2" value={exchangeDraft.case_data?.[key] ?? ''} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_data: { ...(draft.case_data || {}), [key]: event.target.value } }))} /> : <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} value={exchangeDraft.case_data?.[key] ?? ''} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, case_data: { ...(draft.case_data || {}), [key]: type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value } }))} />}</label>)}</div>}
            <div className="network-form-section-label"><span>{activeCaseId ? '1' : '2'}</span><strong>Échange consigné</strong><small>Quand, comment et ce qui a été dit.</small></div>
            <div className="form-grid two-columns">
              <label className="field"><span>Date et heure</span><input type="datetime-local" required value={exchangeDraft.occurred_at} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, occurred_at: event.target.value }))} /></label>
              <label className="field"><span>Sens</span><select value={exchangeDraft.direction} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, direction: event.target.value }))}><option value="incoming">Entrant · reçu</option><option value="outgoing">Sortant · envoyé</option></select></label>
              <label className="field"><span>Catégorie</span><select value={exchangeDraft.category} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, category: event.target.value }))}><option value="lead">Demande commerciale</option><option value="trade">Transaction</option><option value="open">Discussion / information</option></select></label>
              <label className="field"><span>Canal</span><select value={exchangeDraft.channel} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, channel: event.target.value, channel_kind: ['in_person', 'meeting', 'other_physical'].includes(event.target.value) ? 'physical' : 'digital' }))}><option value="whatsapp_message">WhatsApp · message</option><option value="whatsapp_call">WhatsApp · appel</option><option value="phone_call">Téléphone</option><option value="email">E-mail</option><option value="sms">SMS</option><option value="in_person">En personne</option><option value="other">Autre</option></select></label>
            </div>
            {!activeCaseId && <label className="field"><span>Autres contacts concernés</span><select multiple value={relatedContactIds} onChange={(event) => setRelatedContactIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{contacts.filter((contact) => contact.id !== detail.id).map((contact) => <option key={contact.id} value={contact.id}>{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email}</option>)}</select><small className="muted">Maintiens Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs contacts. Chaque contact lié retrouvera le même dossier dans sa fiche.</small></label>}
            <label className="field"><span>Compte rendu / information</span><textarea rows="4" value={exchangeDraft.content} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, content: event.target.value }))} placeholder="Note l’échange, les produits, prix, réponses ou prochaines étapes…" /></label>
            <div className="network-exchange-products"><div className="network-product-picker-heading"><strong>Produits concernés <span>(facultatif)</span></strong><small>{selectedProductIds.length} sélectionné{selectedProductIds.length > 1 ? 's' : ''}</small></div>
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
            </div>
            <div className="network-form-section-label"><span>{activeCaseId ? '2' : '3'}</span><strong>Document et prochaine action</strong><small>Ajoute une pièce ou planifie une relance.</small></div>
            <label className="field network-exchange-upload"><span>Document reçu ou envoyé (facultatif)</span><input type="file" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={(event) => setExchangeFile(event.target.files?.[0] || null)} />{exchangeFile && <small>{exchangeFile.name} · {(exchangeFile.size / (1024 * 1024)).toFixed(1)} Mo</small>}</label>
            <div className="network-exchange-task"><strong><CalendarClock size={15} /> Prévoir un suivi (facultatif)</strong><div className="form-grid two-columns"><label className="field"><span>Action à faire</span><input value={exchangeDraft.action_title} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_title: event.target.value }))} placeholder="Ex. Relancer Marta pour son prix" /></label><label className="field"><span>Échéance</span><input type="datetime-local" value={exchangeDraft.action_due_at} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, action_due_at: event.target.value }))} /></label></div></div>
            <div className="form-actions"><button type="button" className="button button-quiet" disabled={savingExchange} onClick={() => { setShowExchangeForm(false); setExchangeDraft(null); setActiveCaseId(null); setRelatedContactIds([]); setExchangeFile(null); }}>Annuler</button><button type="submit" className="button button-primary" disabled={savingExchange}>{savingExchange ? 'Enregistrement…' : activeCaseId ? 'Ajouter au dossier' : 'Créer le dossier'}</button></div>
          </form>}
          <ContactExchangeHistory key={detail.id} data={data} contact={detail} onCreate={(exchangeCase) => startContactExchange(detail, exchangeCase)} onAddEvent={(exchangeCase) => startContactExchange(detail, exchangeCase)} onActionStatus={updateActionStatus} onCaseStatus={updateCaseStatus} onGenerateProductPdf={(ids) => onGenerateProductPdf?.(ids)} onCreateProforma={(request) => onCreateProforma?.(request)} />
        </div>}
      </> : <><div className="network-detail-grid">{companyFields.map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div><NetworkAssociations kind="company" row={detail} data={data} /><div className="network-related-contacts"><h3>Contacts associés</h3>{contactsFor(detail).length ? contactsFor(detail).map((contact) => <button type="button" key={contact.id} onClick={() => openContact(contact)}>{contact.first_name} {contact.last_name}<small>{contact.job_role || contact.email}</small></button>) : <p>Aucun contact associé. Une société peut exister sans contact nominatif.</p>}</div></>}
      <div className={`modal-actions network-contact-modal-actions${detailKind === 'contact' && detailTab === 'exchanges' ? ' is-minimal' : ''}`}>{(detailKind !== 'contact' || detailTab === 'details') && <button className="button button-danger-ghost" type="button" onClick={() => remove(detail, detailKind)}>Supprimer</button>}<button className="button button-quiet" type="button" onClick={() => setSelected(null)}>Fermer</button>{(detailKind !== 'contact' || detailTab === 'details') && <button className="button button-primary" type="button" onClick={() => startEdit(detail, detailKind)}>Modifier la fiche</button>}</div></section></ModalBackdrop>}

    {editing && draft && <ModalBackdrop onClose={() => { if (!saving) { setEditing(null); setDraft(null); } }}><section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="network-form-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{editing === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-form-title">{draft.id ? 'Modifier la fiche' : `Nouvelle fiche ${editing === 'company' ? 'société' : 'contact'}`}</h2></div><button type="button" className="icon-button" onClick={() => { setEditing(null); setDraft(null); }} aria-label="Fermer"><X size={17} /></button></div><form className="record-form" onSubmit={save}>{editing === "contact" && <div className="contact-photo-tools">{photoPath && data.mediaUrls?.[photoPath] ? <img src={data.mediaUrls[photoPath]} alt="Portrait du contact" /> : <span><ImagePlus size={20} /></span>}<label className="button button-quiet button-small"><Upload size={13} /> Importer une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setPhotoFile(event.target.files?.[0] || null); }} /></label><button type="button" className="button button-quiet button-small" onClick={() => setShowMediaPicker(true)}>Choisir dans la médiathèque</button>{photoFile && <small>{photoFile.name}</small>}</div>}{editing === 'contact' && <label className="field"><span>Type de contact</span><select value={draft.company_id ? 'professional' : draft.profile} onChange={(event) => setDraft((current) => ({ ...current, profile: event.target.value, company_id: event.target.value === 'individual' ? '' : current.company_id }))}><option value="individual">Particulier</option><option value="professional">Professionnel</option></select></label>}{editing === 'contact' && <div className="form-grid two-columns"><Field label="Prénom" value={draft.first_name} onChange={(value) => setDraft((d) => ({ ...d, first_name: value }))} /><Field label="Nom" value={draft.last_name} onChange={(value) => setDraft((d) => ({ ...d, last_name: value }))} /></div>}{editing === 'contact' && draft.profile === 'professional' && <label className="field"><span>Société</span><select value={draft.company_id || ''} onChange={(event) => setDraft((d) => ({ ...d, company_id: event.target.value }))}><option value="">Aucune société</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>}<div className="form-grid two-columns">{(editing === 'contact' ? contactFields.filter(([key]) => !['first_name', 'last_name'].includes(key)) : companyFields).map(([key, label]) => <Field key={key} label={label} type={key === 'email' ? 'email' : 'text'} multiline={key === 'address' || key === 'headquarters_address'} value={draft[key]} onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} />)}</div><div className="modal-actions"><button className="button button-quiet" type="button" disabled={saving} onClick={() => { setEditing(null); setDraft(null); }}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || (editing === 'contact' && !draft.last_name) || (editing === 'company' && !draft.name)}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div></form></section></ModalBackdrop>}
    {showMediaPicker && <MediaPicker data={data} onClose={() => setShowMediaPicker(false)} onSelect={(asset) => { setPhotoFile(null); setPhotoPath(asset.storage_path); setShowMediaPicker(false); }} />}
  </section>;
}
