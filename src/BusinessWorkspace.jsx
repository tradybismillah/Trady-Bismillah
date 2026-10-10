import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Check, Clock3, FileDown, FileText, FolderOpen, Pencil, Plus, Search, Save, Trash2, Upload } from 'lucide-react';
import Country from 'country-state-city/lib/country';
import { exchangeProductRates, exchangeProductStoredRates, exchangeProductTotal, formatExchangeCurrency } from './lib/exchangePricing.js';
import { exchangeScenarioValues, hasExchangeScenario } from './lib/exchangeScenarios.js';
import ModalBackdrop from './ModalA11y.jsx';
import Tabs from './Tabs.jsx';

const tradeDocumentTypes = [
  ['proforma', 'Pro-forma'],
  ['final_invoice', 'Facture finale'],
  ['credit_note', 'Avoir'],
  ['delivery_note', 'Bon de livraison'],
  ['administrative', 'Document administratif'],
  ['commercial', 'Document commercial'],
  ['accounting', 'Document comptable'],
  ['other', 'Autre document'],
];
const tradeStages = [
  ['qualification', 'Qualification'], ['sourcing', 'Recherche fournisseur'], ['supplier_wait', 'En attente fournisseur'],
  ['client_offer', 'Proposition au client'], ['client_wait', 'En attente client'], ['confirmed', 'Opération confirmée'],
  ['documents', 'Documents'], ['delivery', 'Livraison'], ['claim', 'Litige / réclamation'], ['completed', 'Terminée'],
];

function issuerBrandProfile(issuer) {
  const name = (issuer?.legal_name || issuer?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('safras')) return { logo: '/brand-assets/safras-ineditas.png', primary_color: '#087fb8', accent_color: '#f47713' };
  if (name.includes('fikra')) return { logo: '/brand-assets/fikra-matif.png', primary_color: '#176b48', accent_color: '#b83e3b' };
  return { logo: '', primary_color: '#244d3c', accent_color: '#6f806f' };
}

const exchangeScenarios = [
  ['proforma_request', 'Demande de pro-forma', 'Préparer une pro-forma'],
  ['supplier_proforma_received', 'Pro-forma fournisseur reçue', ''],
  ['supplier_proforma_accepted', 'Pro-forma fournisseur acceptée', ''],
  ['supplier_proforma_refused', 'Pro-forma fournisseur refusée', ''],
  ['supplier_invoice_received', 'Facture finale fournisseur reçue', ''],
  ['price_request', 'Demande de prix', 'Préparer une réponse prix'],
  ['availability_request', 'Demande de disponibilité', 'Répondre sur la disponibilité'],
  ['price_announced', 'Annonce d’un prix', ''],
  ['availability_announced', 'Annonce d’une disponibilité', ''],
  ['proforma_change', 'Modification de pro-forma', 'Modifier la pro-forma'],
  ['account_statement', 'Demande de relevé de compte', 'Préparer le relevé de compte'],
  ['proforma_sent', 'Pro-forma envoyée', ''],
  ['proforma_accepted', 'Pro-forma acceptée', ''],
  ['proforma_refused', 'Pro-forma refusée', ''],
  ['final_invoice', 'Facture finale', ''],
  ['credit_note', 'Avoir', ''],
  ['market_information', 'Renseignement marché', ''],
  ['contact_information', 'Renseignement contact', ''],
  ['open_discussion', 'Discussion ouverte', ''],
  ['hand_delivery', 'Remise en main propre', ''],
  ['other', 'Autre', ''],
];
const scenariosByCategory = {
  trade: ['proforma_request', 'supplier_proforma_received', 'supplier_proforma_accepted', 'supplier_proforma_refused', 'supplier_invoice_received', 'proforma_change', 'proforma_sent', 'proforma_accepted', 'proforma_refused', 'final_invoice', 'credit_note', 'account_statement', 'hand_delivery', 'other'],
  lead: ['price_request', 'availability_request', 'price_announced', 'availability_announced', 'open_discussion', 'other'],
  open: ['market_information', 'contact_information', 'open_discussion', 'other'],
};

const digitalChannels = [
  ['whatsapp_message', 'WhatsApp — message'],
  ['whatsapp_call', 'WhatsApp — appel'],
  ['messenger_message', 'Messenger — message'],
  ['messenger_call', 'Messenger — appel'],
  ['linkedin_message', 'LinkedIn — message'],
  ['linkedin_call', 'LinkedIn — appel'],
  ['email', 'E-mail'],
  ['phone', 'Téléphone'],
];

const physicalChannels = ['Café', 'Rendez-vous', 'Salon', 'Visite', 'Déjeuner', 'Réunion', 'Événement', 'Autre'];
const frenchVatRates = [['20', '20 % — taux normal'], ['10', '10 % — taux intermédiaire'], ['5.5', '5,5 % — taux réduit'], ['2.1', '2,1 % — taux particulier']];
const serviceFamilyLabels = { transport: 'Transport', storage: 'Stockage', handling: 'Manutention' };

function ServiceIllustration({ service }) {
  const family = service.service_family || 'handling';
  const palette = family === 'transport'
    ? { back: '#e7f2f2', light: '#b9ded7', dark: '#247669', accent: '#ef9b54' }
    : family === 'storage'
      ? { back: '#f1efe4', light: '#ddc99d', dark: '#8b7147', accent: '#bd7753' }
      : { back: '#f4ece4', light: '#e7b98d', dark: '#ae6543', accent: '#668b70' };
  const variation = [...(service.internal_reference || service.id || service.name || 'service')]
    .reduce((total, character) => total + character.charCodeAt(0), 0) % 3;
  return <div className={`service-artwork service-artwork-${family}`} aria-hidden="true">
    <svg viewBox="0 0 640 240" role="img" focusable="false">
      <defs>
        <linearGradient id={`service-bg-${service.id || service.internal_reference}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.back} /><stop offset="1" stopColor="#fffaf0" />
        </linearGradient>
      </defs>
      <rect width="640" height="240" rx="18" fill={`url(#service-bg-${service.id || service.internal_reference})`} />
      <circle cx="525" cy="47" r="23" fill={palette.accent} opacity=".25" />
      <path d="M0 185 Q130 150 250 188 T510 178 T640 183 V240 H0Z" fill={palette.light} opacity=".42" />
      {family === 'transport' ? <>
        <path d="M68 184h498" stroke={palette.dark} strokeWidth="5" strokeLinecap="round" opacity=".28" />
        <path d="M110 165v-45q0-8 8-8h230q8 0 8 8v45" fill={palette.light} stroke={palette.dark} strokeWidth="4" />
        <path d="M356 165v-68q0-8 8-8h75l51 47v29" fill="#fffaf2" stroke={palette.dark} strokeWidth="4" strokeLinejoin="round" />
        <path d="M421 98v38h57" fill="none" stroke={palette.dark} strokeWidth="4" />
        <rect x="126" y="126" width="55" height="38" rx="4" fill="#fffaf2" opacity=".9" />
        <rect x="190" y="126" width="55" height="38" rx="4" fill={palette.accent} opacity=".82" />
        <rect x="254" y="126" width="55" height="38" rx="4" fill="#fffaf2" opacity=".9" />
        <circle cx="174" cy="171" r="18" fill="#344b48" /><circle cx="174" cy="171" r="8" fill="#f6eee1" />
        <circle cx="435" cy="171" r="18" fill="#344b48" /><circle cx="435" cy="171" r="8" fill="#f6eee1" />
        <path d={variation === 0 ? 'M70 83h48m-16-16 16 16-16 16' : variation === 1 ? 'M83 88h58m-18-18 18 18-18 18' : 'M74 91h43m-14-14 14 14-14 14'} fill="none" stroke={palette.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </> : family === 'storage' ? <>
        <path d="M112 179V70h343v109M96 179h374" fill="none" stroke={palette.dark} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        {[105, 142].map((y) => <g key={y}><path d={`M117 ${y}h333`} stroke={palette.dark} strokeWidth="5" opacity=".7" />{[0, 1, 2, 3].map((box) => <rect key={box} x={139 + box * 75} y={y - 31} width="58" height="28" rx="4" fill={box % 2 ? palette.accent : palette.light} stroke="#fffaf2" strokeWidth="3" />)}</g>)}
        <path d="M490 179v-66h52v66m-70 0h88" fill="none" stroke={palette.dark} strokeWidth="6" strokeLinecap="round" />
        <circle cx="506" cy="184" r="9" fill={palette.dark} /><circle cx="530" cy="184" r="9" fill={palette.dark} />
        <path d={variation === 0 ? 'M504 76h70' : variation === 1 ? 'M508 67h58' : 'M498 79h80'} stroke={palette.accent} strokeWidth="7" strokeLinecap="round" />
      </> : <>
        <path d="M107 179h405" stroke={palette.dark} strokeWidth="6" strokeLinecap="round" opacity=".55" />
        <rect x="145" y="124" width="106" height="53" rx="7" fill={palette.light} stroke={palette.dark} strokeWidth="4" />
        <path d="M164 124V91h68v33m-68-17h68" fill="none" stroke={palette.dark} strokeWidth="4" />
        <rect x="278" y="102" width="65" height="75" rx="6" fill="#fffaf2" stroke={palette.dark} strokeWidth="4" />
        <path d="M278 126h65m-34-24v75" stroke={palette.dark} strokeWidth="3" opacity=".7" />
        <path d={variation === 0 ? 'M409 165v-53h76v53m-57-53V93h38v19' : variation === 1 ? 'M397 165v-48h93v48m-70-48V88h48v29' : 'M408 165v-59h80v59m-60-59V85h40v21'} fill={palette.accent} opacity=".75" stroke={palette.dark} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="427" cy="179" r="13" fill={palette.dark} /><circle cx="477" cy="179" r="13" fill={palette.dark} />
        <path d="M99 76q20-22 41 0t41 0" fill="none" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" />
      </>}
      <circle cx="78" cy="46" r="4" fill={palette.dark} opacity=".45" />
      <circle cx="566" cy="139" r="5" fill={palette.accent} opacity=".6" />
    </svg>
  </div>;
}

function emptyCatalogService() {
  return { name: '', service_family: 'transport', internal_reference: '', description: '', is_catalog_item: true, billing_unit: 'forfait', default_price_ht: null, request_fields: [] };
}

function emptyActionRecord() {
  return { id: '', contact_id: '', exchange_id: '', title: '', description: '', due_at: '', priority: 'normal', status: 'todo', assignee: '', result: '' };
}

function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function createUniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const emptyExchange = {
  contact_id: '', occurred_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  direction: 'incoming', channel_kind: 'digital', channel: 'whatsapp_message',
  category: 'lead', scenario: ['price_request'], availability_date: '', subscenario: '', entry_kind: 'exchange', content: '',
};

function contactLabel(contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || contact.id;
}

function emptyExchangeProduct() {
  return { packaging_level: 'uvc', quantity: '', uvc_unit_price: '' };
}

function emptyTransportDetails() {
  return {
    quantity: '',
    price: '',
    unit: 'pcb',
    direct: true,
    country_code: 'FR',
    origin_country_code: 'FR',
    origin_city: '',
    origin_address: '',
    destination_country_code: 'FR',
    destination_city: '',
    destination_address: '',
    pickup_locations: [{ country_code: 'FR', city: '', address: '' }],
  };
}

const countries = Country.getAllCountries()
  .map((country) => [country.isoCode, country.name])
  .sort((first, second) => first[1].localeCompare(second[1], 'fr'));

function hasService(data, selectedServices, name) {
  const normalizedName = name.toLocaleLowerCase('fr');
  return data.business_services.some((service) => selectedServices.includes(service.id)
    && service.name.trim().toLocaleLowerCase('fr') === normalizedName);
}

function countryName(code) {
  return countries.find(([countryCode]) => countryCode === code)?.[1] || code || '';
}

function transportRouteDescription(transport, type) {
  const route = transport.route_details || {};
  const international = ['intra-européenne', 'export'].includes(type?.name?.toLocaleLowerCase('fr'));
  const stopLabel = (city, address, countryCode) => [city, address, international ? countryName(countryCode) : countryName(route.country_code)].filter(Boolean).join(', ');
  const loading = route.direct
    ? stopLabel(route.origin_city, route.origin_address, route.origin_country_code)
    : (route.pickup_locations || []).map((stop) => stopLabel(stop.city, stop.address, stop.country_code)).filter(Boolean).join(' → ');
  const unloading = stopLabel(route.destination_city, route.destination_address, route.destination_country_code);
  return `Chargement : ${loading || '—'} · Déchargement : ${unloading || '—'}`;
}

function SectionLabel({ children }) {
  return <div className="form-section-label"><span>{children}</span><i /></div>;
}

function ServiceAddressFields({ field, value, onChange }) {
  const address = typeof value === 'string' ? { address: value } : (value || {});
  const update = (key, nextValue) => onChange({ ...address, [key]: nextValue });
  return <fieldset className="service-address-fields">
    <legend>{field.label}</legend>
    <div className="form-grid two-columns">
      <SelectField label="Pays" value={address.country_code || ''} onChange={(country_code) => onChange({ ...address, country_code, region: '', city: '' })} options={countries} placeholder="Choisir un pays" required={Boolean(field.required)} />
      <Field label="Région / département" value={address.region || ''} onChange={(region) => update('region', region)} />
      <Field label="Ville" value={address.city || ''} onChange={(city) => update('city', city)} required={Boolean(field.required)} />
      <Field label="Adresse" value={address.address || ''} onChange={(street) => update('address', street)} required={Boolean(field.required)} />
      <Field label="Code postal" value={address.postal_code || ''} onChange={(postal_code) => update('postal_code', postal_code)} autoComplete="postal-code" />
    </div>
  </fieldset>;
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function displayDate(value, includeTime = true) {
  if (!value) return 'Date non précisée';
  return new Intl.DateTimeFormat('fr-FR', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value));
}

function Field({ label, value, onChange, ...props }) {
  return <label className="field"><span>{label}</span><input value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function SelectField({ label, value, onChange, options, placeholder, required = false }) {
  return (
    <label className="field"><span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function MultiSelectField({ label, value, onChange, options }) {
  const [query, setQuery] = useState('');
  const selectedOptions = options.filter((item) => value.includes(item.id));
  const matchingOptions = options.filter((item) => (item.designation || item.name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
    .slice(0, 50);
  return (
    <div className="field business-multi-select">
      <span>{label} · {value.length} sélectionné{value.length === 1 ? '' : 's'}</span>
      <input aria-label={`Rechercher ${label}`} placeholder={`Rechercher ${label}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="business-multi-results">
        {matchingOptions.map((option) => <label className="business-multi-option" key={option.id}>
          <input type="checkbox" checked={value.includes(option.id)} onChange={() => onChange(value.includes(option.id) ? value.filter((id) => id !== option.id) : [...value, option.id])} />
          <span>{option.designation || option.name}</span>
        </label>)}
        {!matchingOptions.length && <small className="muted">Aucun résultat.</small>}
        {matchingOptions.length === 50 && options.length > matchingOptions.length && <small className="muted">Affinez la recherche pour voir plus de résultats.</small>}
      </div>
      {selectedOptions.length > 0 && <div className="business-chips">{selectedOptions.map((item) => <button className="business-selected-chip" type="button" key={item.id} onClick={() => onChange(value.filter((id) => id !== item.id))}>{item.designation || item.name} ×</button>)}</div>}
    </div>
  );
}

function LogisticsTypeManager({ title, table, records, client, notify, onRefresh }) {
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState({});
  const saveNew = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const { error } = await client.from(table).insert({ name });
    if (error) notify(`Ajout du type ${title.toLowerCase()} impossible : ${error.message}`, true);
    else { setNewName(''); await onRefresh(); }
  };
  const saveName = async (record) => {
    const name = (drafts[record.id] ?? record.name).trim();
    if (!name) {
      notify(`Le nom du type de ${title.toLowerCase()} est obligatoire.`, true);
      return;
    }
    const { error } = await client.from(table).update({ name }).eq('id', record.id);
    if (error) notify(`Modification du type de ${title.toLowerCase()} impossible : ${error.message}`, true);
    else {
      setDrafts((current) => { const next = { ...current }; delete next[record.id]; return next; });
      await onRefresh();
    }
  };
  const toggleActive = async (record) => {
    const { error } = await client.from(table).update({ active: !record.active }).eq('id', record.id);
    if (error) notify(`Modification du type de ${title.toLowerCase()} impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const remove = async (record) => {
    if (!window.confirm(`Supprimer le type « ${record.name} » ?`)) return;
    const { error } = await client.from(table).delete().eq('id', record.id);
    if (error) notify(`Suppression impossible : ${error.message}. Ce type est peut-être utilisé dans un échange; désactivez-le pour le retirer des choix futurs.`, true);
    else await onRefresh();
  };
  return (
    <section className="logistics-type-manager">
      <h3>{title}</h3>
      <form className="heading-actions" onSubmit={saveNew}>
        <Field label={`Nouveau type de ${title.toLowerCase()}`} value={newName} onChange={setNewName} required maxLength={100} />
        <button className="button button-primary" type="submit"><Plus size={15} /> Ajouter</button>
      </form>
      <div className="reference-list">{records.map((record) => (
        <div className="reference-row logistics-type-row" key={record.id}>
          <Field label={`Nom ${title.toLowerCase()}`} value={drafts[record.id] ?? record.name} onChange={(value) => setDrafts((current) => ({ ...current, [record.id]: value }))} maxLength={100} />
          {drafts[record.id] !== undefined && drafts[record.id] !== record.name && <button className="button button-quiet button-small" type="button" onClick={() => saveName(record)}>Enregistrer</button>}
          <button className="button button-quiet button-small" type="button" onClick={() => toggleActive(record)}>{record.active ? 'Désactiver' : 'Réactiver'}</button>
          <button className="button button-quiet button-small" type="button" onClick={() => remove(record)}>Supprimer</button>
        </div>
      ))}</div>
    </section>
  );
}

function Modal({ title, onClose, children, className = '' }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <section className={`modal-card modal-wide business-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}>×</button></div>
        {children}
      </section>
    </ModalBackdrop>
  );
}

function ServiceCatalogEditor({ service, history, contacts, onSave, onSavePrice, onClose }) {
  const [draft, setDraft] = useState(() => service ? { ...service } : emptyCatalogService());
  const [priceDraft, setPriceDraft] = useState({ price_ht: '', effective_at: new Date().toISOString().slice(0, 10), contact_id: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { if (await onSave(draft)) onClose(); } finally { setSaving(false); }
  };
  const savePrice = async (event) => {
    event.preventDefault();
    if (!service?.id) return;
    setSavingPrice(true);
    try {
      const saved = await onSavePrice(service, priceDraft);
      if (saved) setPriceDraft({ price_ht: '', effective_at: new Date().toISOString().slice(0, 10), contact_id: '', note: '' });
    } finally { setSavingPrice(false); }
  };
  return <Modal title={service ? 'Fiche de prestation' : 'Nouvelle prestation'} onClose={onClose} className="service-editor-modal">
    <div className="service-editor-layout">
      <form className="record-form" onSubmit={save}>
        <SectionLabel>Référence de la prestation</SectionLabel>
        <div className="form-grid two-columns">
          <SelectField label="Famille" value={draft.service_family} onChange={(value) => setDraft((current) => ({ ...current, service_family: value }))} options={Object.entries(serviceFamilyLabels).map(([value, label]) => [value, label])} />
          <Field label="Désignation" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} required maxLength={140} />
          <Field label="Référence interne" value={draft.internal_reference || ''} onChange={(value) => setDraft((current) => ({ ...current, internal_reference: value.toUpperCase().replace(/\s+/g, '-') }))} required maxLength={40} />
        </div>
        <Field label="Description" value={draft.description || ''} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} />
        {service && <div className="service-billing-summary"><strong>Facturation</strong><span>Forfait · prix hors taxes</span><b>{service.default_price_ht == null ? 'Tarif à définir' : formatExchangeCurrency(service.default_price_ht)}</b><small>Le tarif pourra être ajusté sur chaque facture pro forma ou finale.</small></div>}
        <div className="form-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={onClose}>Fermer</button><span className="form-actions-spacer" /><button type="submit" className="button button-primary" disabled={saving || !draft.name.trim() || !draft.internal_reference.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div>
      </form>
      {service && <aside className="service-price-history"><SectionLabel>Historique des prix</SectionLabel><p className="muted small">Les prix sont conservés en HT, au forfait, avec leur date d’effet et le contact concerné.</p><form className="service-price-form" onSubmit={savePrice}><Field label="Nouveau prix forfaitaire HT (€)" type="number" min="0" step="0.01" value={priceDraft.price_ht} onChange={(value) => setPriceDraft((current) => ({ ...current, price_ht: value }))} required /><div className="form-grid two-columns"><Field label="Date d’effet" type="date" value={priceDraft.effective_at} onChange={(value) => setPriceDraft((current) => ({ ...current, effective_at: value }))} required /><SelectField label="Contact associé" value={priceDraft.contact_id} onChange={(value) => setPriceDraft((current) => ({ ...current, contact_id: value }))} options={contacts.map((person) => [person.id, contactLabel(person)])} placeholder="Aucun contact" /></div><Field label="Note" value={priceDraft.note} onChange={(value) => setPriceDraft((current) => ({ ...current, note: value }))} placeholder="Ex. prix communiqué par Marta" /><button className="button button-quiet button-small" type="submit" disabled={savingPrice}>{savingPrice ? 'Enregistrement…' : 'Ajouter au tarif et à l’historique'}</button></form><div className="service-price-timeline">{history.length ? history.map((entry) => { const contact = contacts.find((person) => person.id === entry.contact_id); return <article key={entry.id}><strong>{formatExchangeCurrency(entry.price_ht)}</strong><span>{displayDate(entry.effective_at, false)}</span>{contact && <small>Contact · {contactLabel(contact)}</small>}{entry.note && <small>{entry.note}</small>}</article>; }) : <p className="muted small">Aucun historique de prix pour le moment.</p>}</div></aside>}
    </div>
  </Modal>;
}

function emptyDocumentLine() {
  return { item_type: 'product', product_id: '', service_id: '', service_details: {}, description: '', quantity: '1', unit_price: '', vat_rate: '20', vat_treatment: 'domestic' };
}

function emptyIssuer() {
  return {
    legal_name: '', country: 'France', legal_identifiers: {}, address: '',
    postal_code: '', city: '', email: '', phone: '', currency: 'EUR',
    is_default: false,
  };
}

function taxMention(line) {
  if (line.vat_treatment === 'intra_community_goods') return 'Exonération de TVA — article 262 ter I du CGI';
  if (line.vat_treatment === 'intra_community_services') return 'Autoliquidation — article 196 de la directive 2006/112/CE';
  if (line.vat_treatment === 'other_exemption') return 'Exonération de TVA — motif à vérifier et à préciser';
  return '';
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeHexColor(value, fallback) {
  return /^#[0-9A-Fa-f]{6}$/.test(value || '') ? value : fallback;
}

function printDocument(documentRecord, lines, data) {
  const profile = data.business_issuers.find((issuer) => issuer.id === documentRecord.issuer_id)
    || data.business_profile
    || {};
  const contact = data.network_contacts.find((item) => item.id === documentRecord.contact_id);
  const buyerCompany = data.network_companies.find((item) => item.id === contact?.company_id);
  const issuerTemplate = data.business_issuer_templates.find((item) => item.issuer_id === documentRecord.issuer_id) || {};
  const issuerBrand = issuerBrandProfile(profile);
  const templateLogoUrl = (issuerTemplate.logo_path && data.mediaUrls[issuerTemplate.logo_path])
    || (issuerBrand.logo ? new URL(issuerBrand.logo, window.location.href).href : '');
  const label = tradeDocumentTypes.find(([value]) => value === documentRecord.document_type)?.[1] || 'Document';
  const isProforma = documentRecord.document_type === 'proforma';
  const isFinalInvoice = documentRecord.document_type === 'final_invoice';
  const relatedDocument = data.trade_documents.find((item) => item.id === documentRecord.related_document_id);
  const exchange = data.crm_exchanges.find((item) => item.id === documentRecord.exchange_id);
  const enriched = lines.map((line) => {
    const item = line.item_type === 'product'
      ? data.products.find((product) => product.id === line.product_id)
      : data.business_services.find((service) => service.id === line.service_id);
    const base = Number(line.quantity) * Number(line.unit_price);
    const tax = line.vat_treatment === 'domestic' ? base * Number(line.vat_rate) / 100 : 0;
    return {
      ...line,
      description: line.description || item?.designation || item?.name || '',
      serviceDetails: line.item_type === 'service'
        ? (item?.request_fields || []).flatMap((field) => {
          const value = line.service_details?.[field.key];
          if (value === undefined || value === '' || value === null) return [];
          if (field.type !== 'location' || typeof value === 'string') return [`${field.label}: ${value}`];
          const parts = [
            value.country_code ? countryName(value.country_code) : '',
            value.region || '',
            [value.postal_code, value.city].filter(Boolean).join(' '),
            value.address || '',
          ].filter(Boolean);
          return parts.length ? [`${field.label}: ${parts.join(', ')}`] : [];
        })
        : [],
      reference: line.item_type === 'product' ? item?.internal_reference || '' : '',
      base,
      tax,
    };
  });
  const subtotal = enriched.reduce((sum, line) => sum + line.base, 0);
  const taxTotal = enriched.reduce((sum, line) => sum + line.tax, 0);
  const total = subtotal + taxTotal;
  const receivedPayments = isFinalInvoice
    ? data.trade_payments
      .filter((payment) => payment.document_id === documentRecord.id && payment.direction === 'incoming')
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    : 0;
  const remainingBalance = Math.max(0, total - receivedPayments);
  const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  const quantity = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(value));
  const identifiers = (values) => Object.entries(values || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${({
      vat: 'TVA intracommunautaire',
      siret: 'SIRET',
      siren: 'SIREN',
      rcs: 'RCS',
    })[key.toLocaleLowerCase('fr')] || key}: ${value}`);
  const sellerIdentifiers = identifiers(profile.legal_identifiers);
  const buyerIdentifiers = identifiers(buyerCompany?.legal_identifiers);
  const buyerName = buyerCompany?.name || contactLabel(contact || {});
  const buyerAddress = buyerCompany
    ? [buyerCompany.headquarters_address, buyerCompany.headquarters_postal_code, buyerCompany.headquarters_city, buyerCompany.country]
    : [contact?.address, contact?.postal_code, contact?.city, contact?.country];
  const buyerEmail = buyerCompany?.email || contact?.email || '';
  const buyerPhone = buyerCompany
    ? [buyerCompany.phone_country_code, buyerCompany.phone_number].filter(Boolean).join(' ')
    : [contact?.phone_country_code, contact?.phone_number].filter(Boolean).join(' ');
  const hasLegacyBrandDefaults = issuerTemplate.primary_color === '#244d3c' && issuerTemplate.accent_color === '#6f806f';
  const templateColor = safeHexColor(hasLegacyBrandDefaults ? '' : issuerTemplate.primary_color, issuerBrand.primary_color);
  const accentColor = safeHexColor(hasLegacyBrandDefaults ? '' : issuerTemplate.accent_color, issuerBrand.accent_color);
  const templateLogo = templateLogoUrl
    ? `<img class="brand-logo" src="${safe(templateLogoUrl)}" alt="">`
    : `<div class="brand-mark">${safe((profile.legal_name || 'A').slice(0, 2).toLocaleUpperCase('fr'))}</div>`;
  const customHeader = issuerTemplate.header_text
    ? `<span>${safe(issuerTemplate.header_text).replaceAll('\n', '<br>')}</span>`
    : '';
  const customFooter = issuerTemplate.footer_text
    ? `<p class="custom-footer">${safe(issuerTemplate.footer_text).replaceAll('\n', '<br>')}</p>`
    : '';
  const draftNotice = documentRecord.status === 'draft'
    ? '<div class="draft-notice">BROUILLON · Document non émis</div>'
    : '';
  const exchangeLabel = exchange
    ? [
      ({ trade: 'Commerce', lead: 'Prospection', open: 'Information' })[exchange.category],
      displayDate(exchange.occurred_at, false),
      ...exchangeScenarioValues(exchange.scenario).map((scenario) => scenario.replaceAll('_', ' ')),
    ].filter(Boolean).join(' · ')
    : '';
  const lineRows = enriched.map((line) => `
    <tr>
      ${isProforma || isFinalInvoice ? `<td class="reference">${safe(line.reference || '—')}</td>` : ''}
      <td>${safe(line.description)}${line.serviceDetails.length ? `<small class="invoice-line-details">${line.serviceDetails.map((detail) => safe(detail)).join('<br>')}</small>` : ''}</td>
      <td class="number">${quantity(line.quantity)}</td>
      <td class="number">${money(line.unit_price)}</td>
      <td class="number">${line.vat_treatment === 'domestic' ? `${safe(line.vat_rate)} %` : '0 %'}</td>
      <td class="number">${money(line.base)}</td>
    </tr>
    ${taxMention(line) ? `<tr class="note"><td colspan="${isProforma || isFinalInvoice ? 6 : 5}">${safe(taxMention(line))}</td></tr>` : ''}
  `).join('');
  const tableHead = `<thead><tr>${isProforma || isFinalInvoice ? '<th>Référence</th>' : ''}<th>Désignation</th><th class="number">Qté</th><th class="number">Prix unitaire HT</th><th class="number">TVA</th><th class="number">Total HT</th></tr></thead>`;
  const vatRows = [...new Set(enriched.map((line) => `${line.vat_treatment}:${line.vat_rate}`))]
    .map((key) => {
      const linesForRate = enriched.filter((line) => `${line.vat_treatment}:${line.vat_rate}` === key);
      const base = linesForRate.reduce((sum, line) => sum + line.base, 0);
      const tax = linesForRate.reduce((sum, line) => sum + line.tax, 0);
      const representative = linesForRate[0];
      const rate = representative.vat_treatment === 'domestic' ? `${safe(representative.vat_rate)} %` : 'Exonéré';
      return `<tr><td>Base ${rate}</td><td>${money(base)}</td><td>TVA</td><td>${money(tax)}</td></tr>`;
    }).join('');
  const commonStyles = `
    *{box-sizing:border-box}
    body{margin:0;color:#29372e;font:10pt Inter,"Segoe UI",Arial,sans-serif;letter-spacing:.01em}
    .page{width:100%;max-width:184mm;min-height:260mm;margin:0 auto;padding:0;background:#fff}
    .masthead{display:flex;align-items:center;justify-content:space-between;gap:10mm;padding:9mm 10mm;color:#fff;border-radius:0 0 3mm 3mm}
    .brand{display:flex;align-items:center;gap:4mm;min-width:0}
    .brand-mark{display:grid;width:18mm;height:18mm;place-items:center;background:#fff;color:#292638;font-size:16pt;font-weight:700}
    .brand-logo{width:26mm;height:18mm;padding:1mm;background:#fff;object-fit:contain}
    .brand-copy{min-width:0}
    .brand-copy strong{display:block;font-size:13pt}
    .brand-copy span{display:block;margin-top:2mm;font-size:8pt;opacity:.9}
    .document-heading{text-align:right}
    .document-heading h1{margin:0;font-size:22pt;line-height:1.1}
    .document-heading strong{display:block;margin-top:2mm;font-size:10pt}
    .section-title{margin:5mm 0 2mm;padding:2mm 3mm;color:#fff;font-size:9pt;font-weight:700}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:6mm}
    .party{padding:4mm;border:1px solid #e5eae5;border-radius:2mm;background:#fcfdfc}
    .party h2{margin:0 0 2.5mm;color:#748176;font-size:7pt;letter-spacing:.08em;text-transform:uppercase}
    .party p{margin:1mm 0;line-height:1.35;overflow-wrap:anywhere}
    .muted{color:#777381}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}
    .meta div{padding:2.5mm;border:1px solid #e5e2e9;border-radius:2mm}
    .meta span{display:block;color:#777381;font-size:7pt;text-transform:uppercase}
    .meta strong{display:block;margin-top:1mm;font-size:9pt;overflow-wrap:anywhere}
    table{width:100%;margin-top:5mm;border-collapse:collapse}
    th,td{padding:2.8mm 2.2mm;border-bottom:1px solid #e8ece8;text-align:left;vertical-align:top}
    th{font-size:7.5pt;letter-spacing:.03em}
    td{font-size:8pt}
    tbody tr:nth-child(odd):not(.note){background:#fafbfa}
    .number{text-align:right;white-space:nowrap}
    .reference{white-space:nowrap;font-size:7pt}
    .note td{padding-top:0;color:#777381;font-size:7pt}
    .summary-wrap{display:flex;justify-content:space-between;align-items:flex-start;gap:6mm;margin-top:5mm}
    .vat-summary{width:55%;font-size:8pt}
    .vat-summary td{padding:1.7mm}
    .totals{width:40%;padding:3.5mm;border:1px solid #e4e9e4;border-radius:2mm;background:#fbfcfb}
    .totals p{display:flex;justify-content:space-between;gap:4mm;margin:0;padding:2mm 0;border-bottom:1px solid #ddd}
    .totals p:last-child{border:0}
    .totals strong{white-space:nowrap}
    .totals .grand-total{font-size:12pt;font-weight:750}
    .notice{margin-top:5mm;padding:3mm 4mm;border-left:1.5mm solid;font-size:8pt;line-height:1.4}
    .document-notes{margin-top:4mm;padding:3mm;border:1px solid #e5e2e9;line-height:1.4;overflow-wrap:anywhere}
    .footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #ddd;color:#777381;font-size:7pt;line-height:1.45}
    .custom-footer{margin:2mm 0 0;color:#53515a;font-size:8pt;line-height:1.4}
    .signature{margin-top:6mm;color:#777381;font-size:8pt}
    @page{size:A4 portrait;margin:13mm}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{max-width:none}}
    @media screen{body{padding:12mm;background:#f1f0f3}.page{padding:0;background:#fff}}
  `;
  let documentBody;
  if (isProforma) {
    documentBody = `
      <main class="page proforma">
        <header class="masthead">
          <div class="brand">${templateLogo}<div class="brand-copy"><strong>${safe(profile.legal_name)}</strong><span>${safe(profile.email)}${profile.phone ? ` · ${safe(profile.phone)}` : ''}</span>${customHeader}</div></div>
          <div class="document-heading"><h1>FACTURE PRO FORMA</h1><strong>${safe(documentRecord.document_number)}</strong></div>
        </header>
        <section class="parties">
          <div class="party"><h2>Informations de l’acheteur</h2><p><strong>${safe(buyerName)}</strong></p>${buyerAddress.filter(Boolean).length ? `<p>${buyerAddress.filter(Boolean).map(safe).join('<br>')}</p>` : ''}${buyerEmail ? `<p>${safe(buyerEmail)}</p>` : ''}${buyerPhone ? `<p>${safe(buyerPhone)}</p>` : ''}${buyerIdentifiers.map((item) => `<p>${safe(item)}</p>`).join('')}</div>
          <div class="party"><h2>Informations du vendeur</h2><p><strong>${safe(profile.legal_name)}</strong></p><p>${[profile.address, profile.postal_code, profile.city, profile.country].filter(Boolean).map(safe).join('<br>')}</p>${profile.email ? `<p>${safe(profile.email)}</p>` : ''}${profile.phone ? `<p>${safe(profile.phone)}</p>` : ''}${sellerIdentifiers.map((item) => `<p>${safe(item)}</p>`).join('')}</div>
        </section>
        <h2 class="section-title">Détails de la commande</h2>
        <section class="meta">
          <div><span>Date du document</span><strong>${safe(displayDate(documentRecord.document_date, false))}</strong></div>
          <div><span>Référence de commande</span><strong>${safe(exchangeLabel || relatedDocument?.document_number || '—')}</strong></div>
          <div><span>Document associé</span><strong>${safe(relatedDocument?.document_number || '—')}</strong></div>
        </section>
        ${documentRecord.notes ? `<div class="document-notes"><strong>Note</strong><br>${safe(documentRecord.notes)}</div>` : ''}
        <table>${tableHead}<tbody>${lineRows}</tbody></table>
        <div class="summary-wrap">
          <table class="vat-summary"><tbody>${vatRows}</tbody></table>
          <section class="totals"><p><span>Total HT</span><strong>${money(subtotal)}</strong></p><p><span>TVA</span><strong>${money(taxTotal)}</strong></p><p class="grand-total"><span>Total estimatif TTC</span><strong>${money(total)}</strong></p></section>
        </div>
        <p class="notice">Document pro forma établi à titre indicatif. Il ne constitue pas une facture définitive.</p>
        <div class="signature">Signature du vendeur : __________________________________</div>
        <footer class="footer">${safe(profile.legal_name)}${sellerIdentifiers.length ? ` · ${sellerIdentifiers.map(safe).join(' · ')}` : ''}<br>${safe(profile.address)} ${safe(profile.postal_code)} ${safe(profile.city)}${profile.email ? ` · ${safe(profile.email)}` : ''}${customFooter}</footer>
      </main>
    `;
  } else if (isFinalInvoice) {
    documentBody = `
      <main class="page final-invoice">
        <header class="masthead">
          <div class="brand">${templateLogo}<div class="brand-copy"><strong>${safe(profile.legal_name)}</strong><span>FACTURATION CLIENT</span>${customHeader}</div></div>
          <div class="document-heading"><h1>FACTURE</h1><strong>${safe(documentRecord.document_number)}</strong><span>Émise le ${safe(displayDate(documentRecord.document_date, false))}</span></div>
        </header>
        <section class="parties">
          <div class="party"><h2>Émetteur</h2><p><strong>${safe(profile.legal_name)}</strong></p><p>${[profile.address, profile.postal_code, profile.city, profile.country].filter(Boolean).map(safe).join('<br>')}</p>${profile.email ? `<p>${safe(profile.email)}</p>` : ''}${profile.phone ? `<p>${safe(profile.phone)}</p>` : ''}${sellerIdentifiers.map((item) => `<p>${safe(item)}</p>`).join('')}</div>
          <div class="party"><h2>Facturé à</h2><p><strong>${safe(buyerName)}</strong></p>${buyerAddress.filter(Boolean).length ? `<p>${buyerAddress.filter(Boolean).map(safe).join('<br>')}</p>` : ''}${buyerEmail ? `<p>${safe(buyerEmail)}</p>` : ''}${buyerPhone ? `<p>${safe(buyerPhone)}</p>` : ''}${buyerIdentifiers.map((item) => `<p>${safe(item)}</p>`).join('')}</div>
        </section>
        <section class="meta">
          <div><span>Numéro de facture</span><strong>${safe(documentRecord.document_number)}</strong></div>
          <div><span>Date d’émission</span><strong>${safe(displayDate(documentRecord.document_date, false))}</strong></div>
          <div><span>Pro forma d’origine</span><strong>${safe(relatedDocument?.document_number || '—')}</strong></div>
        </section>
        ${documentRecord.notes ? `<div class="document-notes"><strong>Note / référence</strong><br>${safe(documentRecord.notes)}</div>` : ''}
        <table>${tableHead}<tbody>${lineRows}</tbody></table>
        <div class="summary-wrap">
          <table class="vat-summary"><thead><tr><th>Traitement</th><th>Base HT</th><th>TVA</th><th>Montant TVA</th></tr></thead><tbody>${vatRows}</tbody></table>
          <section class="totals"><p><span>Total HT</span><strong>${money(subtotal)}</strong></p><p><span>Total TVA</span><strong>${money(taxTotal)}</strong></p><p><span>Total TTC</span><strong>${money(total)}</strong></p>${receivedPayments > 0 ? `<p><span>Règlements reçus</span><strong>− ${money(receivedPayments)}</strong></p>` : ''}<p class="grand-total"><span>Reste à régler</span><strong>${money(remainingBalance)}</strong></p></section>
        </div>
        <p class="notice">Facture définitive${relatedDocument ? ` établie à la suite de la pro forma ${safe(relatedDocument.document_number)}` : ''}. Les règlements affichés sont ceux enregistrés et associés à cette facture.</p>
        <footer class="footer"><strong>${safe(profile.legal_name)}</strong><br>${[profile.address, profile.postal_code, profile.city, profile.country].filter(Boolean).map(safe).join(' · ')}${sellerIdentifiers.length ? `<br>${sellerIdentifiers.map(safe).join(' · ')}` : ''}${profile.email ? `<br>${safe(profile.email)}` : ''}${profile.phone ? ` · ${safe(profile.phone)}` : ''}${customFooter}</footer>
      </main>
    `;
  } else {
    documentBody = `
      <header><div><h1>${safe(profile.legal_name)}</h1><div>${safe(profile.address)} ${safe(profile.postal_code)} ${safe(profile.city)} ${safe(profile.country)}</div><div>${sellerIdentifiers.map(safe).join(' · ')}</div></div><div><h2>${safe(label)}</h2><div>${safe(documentRecord.document_number)}</div><div>${safe(displayDate(documentRecord.document_date, false))}</div></div></header>
      <h3>${safe(buyerName)}</h3><div>${safe(contact?.email || '')}</div><p>${safe(documentRecord.notes)}</p>
      <table>${tableHead}<tbody>${lineRows}</tbody></table>
      <div class="totals"><p><span>Total HT</span><strong>${money(subtotal)}</strong></p><p><span>TVA</span><strong>${money(taxTotal)}</strong></p><p><span>Total TTC</span><strong>${money(total)}</strong></p></div>
    `;
  }
  const windowRef = window.open('', '_blank');
  if (!windowRef) throw new Error('Autorisez les fenêtres contextuelles pour générer le document.');
  const templateClass = isProforma ? 'proforma-template' : isFinalInvoice ? 'final-invoice-template' : 'generic-template';
  windowRef.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${safe(label)} ${safe(documentRecord.document_number)}</title>
    <style>${commonStyles}
       .preview-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;max-width:190mm;margin:0 auto 10mm;padding:8px;background:#fff;border:1px solid #e5e2e9;border-radius:8px}.preview-toolbar button{padding:8px 12px;border:0;border-radius:6px;background:${templateColor};color:#fff;font:600 10pt Arial,sans-serif;cursor:pointer}.draft-notice{max-width:190mm;margin:0 auto 4mm;padding:3mm;border:1px solid #b68027;border-radius:2mm;background:#fff7e5;color:#815c19;font-weight:700;text-align:center}
      header{display:flex;justify-content:space-between;gap:10mm;border-bottom:2px solid ${templateColor};padding-bottom:6mm}
      h1{font-size:22pt;color:${templateColor}}
      body.${templateClass} .masthead{background:${templateColor}}
      body.${templateClass} .section-title,body.${templateClass} th{background:${templateColor}}
      body.${templateClass} .totals{background:${accentColor}18}
      body.${templateClass} .notice{border-color:${templateColor};background:${accentColor}18}
       ${isFinalInvoice ? '.final-invoice .document-heading h1{letter-spacing:1.5pt}.final-invoice .document-heading span{display:block;margin-top:2mm;font-size:8pt}.final-invoice .meta{margin-top:5mm}' : ''}
       @media print{.preview-toolbar{display:none}}
     </style></head><body class="${templateClass}"><nav class="preview-toolbar" aria-label="Actions du document"><button type="button" onclick="window.print()">Imprimer / enregistrer en PDF</button></nav>${draftNotice}${documentBody}</body></html>`);
  windowRef.document.close();
}

export default function BusinessWorkspace({ mode, data, client, notify, onRefresh, documentRequest, onDocumentRequestHandled, onOpenContactExchange }) {
  const [dialog, setDialog] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tradeSection, setTradeSection] = useState('operations');
  const [operationSearch, setOperationSearch] = useState('');
  const [operationFilter, setOperationFilter] = useState('active');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('all');
  const [exchangeDraft, setExchangeDraft] = useState(emptyExchange);
  const [exchangeFormMode, setExchangeFormMode] = useState('create');
  const [editingExchangeId, setEditingExchangeId] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [exchangeProductDetails, setExchangeProductDetails] = useState({});
  const [selectedServices, setSelectedServices] = useState([]);
  const [transportDetails, setTransportDetails] = useState({});
  const [selectedHandlingTypes, setSelectedHandlingTypes] = useState([]);
  const [selectedStorageTypes, setSelectedStorageTypes] = useState([]);
  const [makeAction, setMakeAction] = useState(true);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [actionFilter, setActionFilter] = useState('open');
  const [actionSearch, setActionSearch] = useState('');
  const [actionRecordMode, setActionRecordMode] = useState('read');
  const [actionDraft, setActionDraft] = useState(emptyActionRecord);
  const [documentDraft, setDocumentDraft] = useState({
    contact_id: '', case_id: '', exchange_id: '', related_document_id: '', counterparty_role: 'customer', document_type: 'proforma',
    document_number: '', document_date: new Date().toISOString().slice(0, 10), status: 'draft', notes: '',
  });
  const [documentLines, setDocumentLines] = useState([emptyDocumentLine()]);
  const [documentFile, setDocumentFile] = useState(null);
  const [templateLogoFile, setTemplateLogoFile] = useState(null);
  const [documentTemplateDraft, setDocumentTemplateDraft] = useState({
    logo_path: '', primary_color: '#244d3c', accent_color: '#6f806f', header_text: '', footer_text: '',
  });
  const [paymentDraft, setPaymentDraft] = useState({ contact_id: '', case_id: '', counterparty_role: 'customer', exchange_id: '', document_id: '', payment_date: new Date().toISOString().slice(0, 10), direction: 'incoming', amount: '', payment_method: 'bank_transfer', bank_account_id: '', notes: '' });
  const [expenseDraft, setExpenseDraft] = useState({ contact_id: '', case_id: '', expense_date: new Date().toISOString().slice(0, 10), amount: '', category: '', description: '', payment_method: '', information: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [serviceEditorOpen, setServiceEditorOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);
  const [serviceFamilyFilter, setServiceFamilyFilter] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const defaultIssuer = data.business_issuers.find((issuer) => issuer.is_default) || data.business_issuers[0] || null;
  const [selectedIssuerId, setSelectedIssuerId] = useState(defaultIssuer?.id || '');
  const [issuerDraft, setIssuerDraft] = useState(() => defaultIssuer ? { ...defaultIssuer } : emptyIssuer());
  const [creatingIssuer, setCreatingIssuer] = useState(false);
  const [bankName, setBankName] = useState('');
  useEffect(() => {
    if (mode !== 'trade' || !documentRequest) return;
    const issuer = data.business_issuers.find((item) => item.is_default) || data.business_issuers[0];
    setDocumentDraft((draft) => ({ ...draft, issuer_id: issuer?.id || '', contact_id: documentRequest.contactId || '', case_id: documentRequest.caseId || '', exchange_id: documentRequest.exchangeId || '', related_document_id: documentRequest.relatedDocumentId || '', counterparty_role: documentRequest.counterpartyRole || 'customer', document_type: documentRequest.documentType || 'proforma', status: 'draft', document_number: '' }));
    const previousLines = documentRequest.relatedDocumentId
      ? data.trade_document_lines.filter((line) => line.document_id === documentRequest.relatedDocumentId).map((line) => ({ ...line }))
      : [];
    setDocumentLines(previousLines.length ? previousLines : [emptyDocumentLine()]);
    setDocumentFile(null);
    setDialog('document');
    onDocumentRequestHandled?.();
  }, [mode, documentRequest?.requestId]);
  const documentCases = data.crm_exchange_cases.filter((exchangeCase) => !documentDraft.contact_id || exchangeCase.contact_id === documentDraft.contact_id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === exchangeCase.id && link.contact_id === documentDraft.contact_id));
  const documentCase = data.crm_exchange_cases.find((exchangeCase) => exchangeCase.id === documentDraft.case_id);
  const documentContact = data.network_contacts.find((contact) => contact.id === documentDraft.contact_id);
  const documentIssuer = data.business_issuers.find((issuer) => issuer.id === documentDraft.issuer_id);
  const invoiceIssuerTemplate = data.business_issuer_templates.find((template) => template.issuer_id === documentDraft.issuer_id);
  const invoiceLogoUrl = (invoiceIssuerTemplate?.logo_path && data.mediaUrls[invoiceIssuerTemplate.logo_path])
    || (issuerBrandProfile(documentIssuer).logo ? new URL(issuerBrandProfile(documentIssuer).logo, window.location.href).href : '');
  const pricedDocument = ['proforma', 'final_invoice'].includes(documentDraft.document_type);
  const invoiceLines = documentLines.filter((line) => (line.item_type === 'product' ? line.product_id : line.service_id) && Number(line.quantity) > 0);
  const invoiceSubtotal = invoiceLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
  const invoiceTax = invoiceLines.reduce((sum, line) => sum + (line.vat_treatment === 'domestic' ? Number(line.quantity || 0) * Number(line.unit_price || 0) * Number(line.vat_rate || 0) / 100 : 0), 0);
  const invoiceTotal = invoiceSubtotal + invoiceTax;
  const savedIssuerTemplate = data.business_issuer_templates.find((template) => template.issuer_id === selectedIssuerId);
  const selectedIssuer = data.business_issuers.find((issuer) => issuer.id === selectedIssuerId);
  const selectedIssuerBrand = issuerBrandProfile(selectedIssuer);
  useEffect(() => {
    setTemplateLogoFile(null);
    if (savedIssuerTemplate) {
      const legacyColors = savedIssuerTemplate.primary_color === '#244d3c' && savedIssuerTemplate.accent_color === '#6f806f';
      setDocumentTemplateDraft({
        ...savedIssuerTemplate,
        logo_path: savedIssuerTemplate.logo_path || selectedIssuerBrand.logo,
        primary_color: legacyColors ? selectedIssuerBrand.primary_color : savedIssuerTemplate.primary_color,
        accent_color: legacyColors ? selectedIssuerBrand.accent_color : savedIssuerTemplate.accent_color,
      });
    } else {
      setDocumentTemplateDraft({ logo_path: selectedIssuerBrand.logo, primary_color: selectedIssuerBrand.primary_color, accent_color: selectedIssuerBrand.accent_color, header_text: '', footer_text: '' });
    }
  }, [selectedIssuerId, savedIssuerTemplate]);
  useEffect(() => {
    if (!creatingIssuer && !selectedIssuerId && data.business_issuers.length) {
      const nextIssuer = data.business_issuers.find((issuer) => issuer.is_default) || data.business_issuers[0];
      setSelectedIssuerId(nextIssuer.id);
      setIssuerDraft({ ...nextIssuer });
    }
  }, [creatingIssuer, data.business_issuers, selectedIssuerId]);

  const title = {
    exchanges: ['ÉCHANGES', 'Mémoire des interactions', 'Consignez les échanges, les informations et les alertes; seule une action explicitement créée devient une tâche.'],
    actions: ['ACTIONS', 'Relances des échanges', 'Retrouvez la prochaine action avec son contact, son dossier et le message qui l’a déclenchée.'],
    trade: ['TRADE', 'Documents & opérations', 'Pro-formas, factures, avoirs, paiements et dépenses enregistrés.'],
    services: ['CATALOGUE', 'Services', 'Services proposés, indépendants des fiches produit.'],
    'business-settings': ['CONFIGURATION', 'Mon entreprise', 'Identité émettrice des documents et comptes bancaires proposés pour les virements.'],
  }[mode];
  const filteredExchanges = useMemo(() => data.crm_exchanges
    .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
    .sort((first, second) => new Date(second.occurred_at) - new Date(first.occurred_at)), [categoryFilter, data.crm_exchanges]);
  const actionGroups = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const groups = new Map([
      ['today', []], ['overdue', []], ['upcoming', []], ['unscheduled', []],
      ['in_progress', []], ['done', []], ['cancelled', []],
    ]);
    data.crm_actions.forEach((action) => {
      if (action.status === 'done') groups.get('done').push(action);
      else if (action.status === 'cancelled') groups.get('cancelled').push(action);
      else if (action.status === 'in_progress' || action.status === 'waiting') groups.get('in_progress').push(action);
      else if (!action.due_at) groups.get('unscheduled').push(action);
      else {
        const due = new Date(action.due_at);
        const dueKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
        if (dueKey < todayKey) groups.get('overdue').push(action);
        else if (dueKey === todayKey) groups.get('today').push(action);
        else groups.get('upcoming').push(action);
      }
    });
    return [...groups.entries()].map(([key, items]) => [
      key,
      ({ today: 'Aujourd’hui', overdue: 'En retard', upcoming: 'À venir', unscheduled: 'Sans échéance', in_progress: 'En cours / en attente', done: 'Terminées', cancelled: 'Annulées' })[key],
      items.sort((a, b) => new Date(a.due_at || a.created_at) - new Date(b.due_at || b.created_at)),
    ]).filter(([, , items]) => items.length);
  }, [data.crm_actions]);
  const actionCounts = {
    open: data.crm_actions.filter((action) => !['done', 'cancelled'].includes(action.status)).length,
    overdue: actionGroups.find(([id]) => id === 'overdue')?.[2].length || 0,
    done: data.crm_actions.filter((action) => action.status === 'done').length,
  };
  const actionExchangeContext = (action) => {
    const exchange = data.crm_exchanges.find((item) => item.id === action.exchange_id);
    const exchangeCase = data.crm_exchange_cases.find((item) => item.id === exchange?.case_id);
    const contact = data.network_contacts.find((person) => person.id === action.contact_id);
    const products = data.crm_exchange_products.filter((item) => item.exchange_id === exchange?.id)
      .map((item) => data.products.find((product) => product.id === item.product_id)?.designation).filter(Boolean);
    return { exchange, exchangeCase, contact, products };
  };
  const visibleActionGroups = useMemo(() => actionGroups.map(([groupId, label, actions]) => {
    const visible = actions.filter((action) => {
      const matchesFilter = actionFilter === 'all' || (actionFilter === 'open' && !['done', 'cancelled'].includes(action.status)) || (actionFilter === 'overdue' && groupId === 'overdue') || (actionFilter === 'done' && action.status === 'done');
      if (!matchesFilter) return false;
      const { exchange, exchangeCase, contact, products } = actionExchangeContext(action);
      const haystack = [action.title, action.description, contact ? contactLabel(contact) : '', exchangeCase?.title, exchange?.content, ...products].join(' ').toLocaleLowerCase();
      return haystack.includes(actionSearch.trim().toLocaleLowerCase());
    });
    return [groupId, label, visible];
  }).filter(([, , actions]) => actions.length), [actionGroups, actionFilter, actionSearch, data.crm_exchanges, data.crm_exchange_cases, data.crm_exchange_products, data.network_contacts, data.products]);
  const suggestedTitle = exchangeScenarios.find(([value, , suggestion]) => exchangeDraft.scenario.includes(value) && suggestion)?.[2] || '';
  const availabilityScenarioSelected = ['availability_request', 'availability_announced']
    .some((scenario) => hasExchangeScenario(exchangeDraft.scenario, scenario));
  const actionSuggestionAllowed = Boolean(suggestedTitle) && !['information', 'observation', 'alert'].includes(exchangeDraft.entry_kind);
  const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
  const setExchangeProducts = (productIds) => {
    setSelectedProducts(productIds);
    setExchangeProductDetails((current) => Object.fromEntries(productIds.map((id) => [
      id,
      current[id] || emptyExchangeProduct(),
    ])));
  };
  const updateExchangeProduct = (productId, field, value) => setExchangeProductDetails((current) => ({
    ...current,
    [productId]: { ...emptyExchangeProduct(), ...current[productId], [field]: value },
  }));
  const updateTransport = (typeId, field, value) => setTransportDetails((current) => ({
    ...current,
    [typeId]: { ...emptyTransportDetails(), ...current[typeId], [field]: value },
  }));
  const updatePickupLocation = (typeId, index, field, value) => setTransportDetails((current) => ({
    ...current,
    [typeId]: {
      ...emptyTransportDetails(),
      ...current[typeId],
      pickup_locations: (current[typeId]?.pickup_locations || emptyTransportDetails().pickup_locations)
        .map((location, locationIndex) => locationIndex === index ? { ...location, [field]: value } : location),
    },
  }));
  const addPickupLocation = (typeId) => setTransportDetails((current) => ({
    ...current,
    [typeId]: {
      ...emptyTransportDetails(),
      ...current[typeId],
      pickup_locations: [...(current[typeId]?.pickup_locations || []), {
        country_code: current[typeId]?.country_code || 'FR',
        city: '',
        address: '',
      }],
    },
  }));
  const removePickupLocation = (typeId, index) => setTransportDetails((current) => ({
    ...current,
    [typeId]: {
      ...emptyTransportDetails(),
      ...current[typeId],
      pickup_locations: (current[typeId]?.pickup_locations || []).filter((_, locationIndex) => locationIndex !== index),
    },
  }));
  const openNewExchange = () => {
    setExchangeDraft({ ...emptyExchange, contact_id: data.network_contacts[0]?.id || '' });
    setExchangeFormMode('create');
    setEditingExchangeId(null);
    setSelectedProducts([]);
    setExchangeProductDetails({});
    setSelectedServices([]);
    setTransportDetails({});
    setSelectedHandlingTypes([]);
    setSelectedStorageTypes([]);
    setActionTitle('');
    setActionDue('');
    setMakeAction(true);
    setDialog('exchange');
  };
  const openExchangeRecord = (exchange) => {
    const linkedProducts = data.crm_exchange_products.filter((link) => link.exchange_id === exchange.id);
    const linkedServices = data.crm_exchange_services.filter((link) => link.exchange_id === exchange.id);
    const localDate = new Date(new Date(exchange.occurred_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExchangeDraft({
      ...emptyExchange,
      ...exchange,
      scenario: exchangeScenarioValues(exchange.scenario),
      availability_date: exchange.availability_date || '',
      occurred_at: localDate,
      direction: exchange.direction || 'incoming',
    });
    setSelectedProducts(linkedProducts.map((link) => link.product_id));
    setExchangeProductDetails(Object.fromEntries(linkedProducts.map((link) => [
      link.product_id,
      {
        packaging_level: link.packaging_level || 'uvc',
        quantity: link.quantity ?? '',
        uvc_unit_price: link.uvc_unit_price ?? '',
      },
    ])));
    setSelectedServices(linkedServices.map((link) => link.service_id));
    const linkedTransports = data.crm_exchange_transports.filter((item) => item.exchange_id === exchange.id);
    setTransportDetails(Object.fromEntries(linkedTransports.map((item) => [item.transport_type_id, {
      ...emptyTransportDetails(),
      ...(item.route_details || {}),
      quantity: String(item.quantity),
      unit: item.unit,
      pickup_locations: item.route_details?.pickup_locations?.length
        ? item.route_details.pickup_locations
        : emptyTransportDetails().pickup_locations,
    }])));
    setSelectedHandlingTypes(data.crm_exchange_handling_types.filter((item) => item.exchange_id === exchange.id).map((item) => item.handling_type_id));
    setSelectedStorageTypes(data.crm_exchange_storage_types.filter((item) => item.exchange_id === exchange.id).map((item) => item.storage_type_id));
    setEditingExchangeId(exchange.id);
    setExchangeFormMode('read');
    setDialog('exchange');
  };
  const openNewDocument = (request = {}) => {
    const issuer = data.business_issuers.find((item) => item.is_default) || data.business_issuers[0];
    setDocumentDraft({ ...documentDraft, issuer_id: issuer?.id || '', contact_id: request.contactId || '', case_id: request.caseId || '', exchange_id: request.exchangeId || '', related_document_id: request.relatedDocumentId || '', counterparty_role: request.counterpartyRole || 'customer', document_type: request.documentType || 'proforma', status: 'draft', document_number: '' });
    setDocumentLines([emptyDocumentLine()]);
    setDocumentFile(null);
    setDialog('document');
  };
  const saveExchange = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const action = actionSuggestionAllowed && makeAction && (actionTitle.trim() || suggestedTitle)
        ? { title: (actionTitle.trim() || suggestedTitle), due_at: actionDue || null }
        : null;
      const exchange = {
        ...exchangeDraft,
        scenario: exchangeDraft.scenario.join(','),
        availability_date: availabilityScenarioSelected ? exchangeDraft.availability_date || null : null,
        transport_details: hasService(data, selectedServices, 'Transport') ? Object.entries(transportDetails)
          .filter(([typeId]) => data.business_transport_types.some((type) => type.id === typeId))
          .map(([transport_type_id, details]) => ({
            transport_type_id,
            quantity: Number(details.quantity),
            unit: details.unit,
            route_details: {
              price: details.price === '' || details.price == null ? null : Number(details.price),
              direct: details.direct,
              country_code: details.country_code,
              origin_country_code: details.origin_country_code,
              origin_city: details.origin_city,
              origin_address: details.origin_address,
              destination_country_code: details.destination_country_code,
              destination_city: details.destination_city,
              destination_address: details.destination_address,
              pickup_locations: details.direct ? [] : details.pickup_locations,
            },
          })) : [],
        handling_type_ids: hasService(data, selectedServices, 'Manutention') ? selectedHandlingTypes : [],
        storage_type_ids: hasService(data, selectedServices, 'Stockage') ? selectedStorageTypes : [],
        occurred_at: new Date(exchangeDraft.occurred_at).toISOString(),
        product_details: selectedProducts.map((productId) => {
          const product = data.products.find((item) => item.id === productId);
          const details = exchangeProductDetails[productId] || emptyExchangeProduct();
          const rates = exchangeProductRates(product, details);
          return {
            product_id: productId,
            packaging_level: details.packaging_level || 'uvc',
            quantity: details.quantity === '' || details.quantity == null ? null : Number(details.quantity),
            uvc_unit_price: rates.uvc,
            pcb_unit_price: rates.pcb,
            palette_unit_price: rates.palette,
          };
        }),
      };
      const { error } = await client.rpc(exchangeFormMode === 'edit' ? 'update_crm_exchange_logistics' : 'save_crm_exchange_logistics', {
        ...(exchangeFormMode === 'edit' ? { p_exchange_id: editingExchangeId } : {}),
        p_exchange: exchange,
        p_product_ids: selectedProducts,
        p_service_ids: selectedServices,
        ...(exchangeFormMode === 'create' ? { p_action: action } : {}),
      });
      if (error) throw error;
      await onRefresh();
      setDialog('');
      setEditingExchangeId(null);
      setTransportDetails({});
      setSelectedHandlingTypes([]);
      setSelectedStorageTypes([]);
      notify(exchangeFormMode === 'edit' ? 'Fiche de l’échange mise à jour.' : 'Échange enregistré dans l’historique.');
    } catch (error) {
      notify(`Enregistrement de l’échange impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };
  const setActionStatus = async (action, status) => {
    const { error } = await client.from('crm_actions').update({ status, updated_at: new Date().toISOString() }).eq('id', action.id);
    if (error) notify(`Mise à jour de l’action impossible : ${error.message}`, true);
    else {
      setActionDraft((current) => ({ ...current, status }));
      await onRefresh();
    }
  };
  const openActionRecord = (action = null) => {
    setActionRecordMode(action ? 'read' : 'create');
    setActionDraft(action ? { ...action, due_at: localDateTimeValue(action.due_at) } : emptyActionRecord());
    setDialog('action-record');
  };
  const saveActionRecord = async (event) => {
    event.preventDefault();
    if (!actionDraft.contact_id || !actionDraft.exchange_id || !actionDraft.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        contact_id: actionDraft.contact_id,
        exchange_id: actionDraft.exchange_id,
        title: actionDraft.title.trim(),
        description: actionDraft.description.trim(),
        due_at: actionDraft.due_at ? new Date(actionDraft.due_at).toISOString() : null,
        priority: actionDraft.priority,
        status: actionDraft.status,
        assignee: actionDraft.assignee.trim(),
        result: actionDraft.result.trim(),
        updated_at: new Date().toISOString(),
      };
      const query = actionDraft.id
        ? client.from('crm_actions').update(payload).eq('id', actionDraft.id)
        : client.from('crm_actions').insert(payload);
      const { error } = await query;
      if (error) throw error;
      await onRefresh();
      setDialog('');
      notify(actionDraft.id ? 'Fiche action mise à jour.' : 'Action créée et liée à son échange.');
    } catch (error) {
      notify(`Enregistrement de la fiche action impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };
  const deleteActionRecord = async () => {
    if (!actionDraft.id || !window.confirm('Supprimer définitivement cette action ?')) return;
    const { error } = await client.from('crm_actions').delete().eq('id', actionDraft.id);
    if (error) { notify(`Suppression de l’action impossible : ${error.message}`, true); return; }
    setDialog('');
    await onRefresh();
    notify('Action supprimée.');
  };
  const uploadPrivateFile = async (file, folder) => {
    if (!file) return null;
    if (file.size > 20 * 1024 * 1024) throw new Error('La taille maximale d’un fichier est de 20 Mo.');
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError) throw authError;
    if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
    const name = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${auth.session.user.id}/${folder}/${createUniqueId()}-${name}`;
    const { error } = await client.storage.from('catalogue-media').upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  };
  const saveIssuerDocumentTemplate = async () => {
    const issuer = data.business_issuers.find((item) => item.id === selectedIssuerId);
    if (!issuer) { notify('Choisis une société émettrice avant de configurer son modèle. ', true); return; }
    if (templateLogoFile && !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(templateLogoFile.type)) {
      throw new Error('Le logo doit être une image JPEG, PNG, WebP ou AVIF.');
    }
    let uploadedPath = null;
    let mediaAssetSaved = false;
    let templateSaved = false;
    setSaving(true);
    try {
      uploadedPath = await uploadPrivateFile(templateLogoFile, 'trade/issuer-templates');
      if (uploadedPath) {
        const { error: mediaError } = await client.from('media_assets').insert({
          storage_path: uploadedPath,
          file_name: templateLogoFile.name,
          folder: 'Trade',
          mime_type: templateLogoFile.type,
          file_size: templateLogoFile.size,
        });
        if (mediaError) throw mediaError;
        mediaAssetSaved = true;
      }
      const { error } = await client.from('business_issuer_document_templates').upsert({
        issuer_id: selectedIssuerId,
        ...documentTemplateDraft,
        logo_path: uploadedPath || documentTemplateDraft.logo_path || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'issuer_id' });
      if (error) throw error;
      templateSaved = true;
      setTemplateLogoFile(null);
      await onRefresh();
      notify(`Modèle PDF enregistré pour ${issuer.legal_name}.`);
    } catch (error) {
      if (uploadedPath && !templateSaved) {
        if (mediaAssetSaved) {
          const { error: assetCleanupError } = await client.from('media_assets').delete().eq('storage_path', uploadedPath);
          if (assetCleanupError) notify(`Le logo envoyé n’a pas pu être retiré de la médiathèque : ${assetCleanupError.message}`, true);
        }
        const { error: storageCleanupError } = await client.storage.from('catalogue-media').remove([uploadedPath]);
        if (storageCleanupError) notify(`Le logo envoyé n’a pas pu être nettoyé du stockage : ${storageCleanupError.message}`, true);
      }
      notify(`${templateSaved ? 'Modèle enregistré, mais actualisation impossible' : 'Enregistrement du modèle impossible'} : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };
  const saveDocument = async (event) => {
    event.preventDefault();
    setSaving(true);
    let filePath = null;
    let documentSaved = false;
    try {
      filePath = await uploadPrivateFile(documentFile, 'trade/documents');
      const isPricedDocument = ['proforma', 'final_invoice', 'credit_note'].includes(documentDraft.document_type);
      const lines = (isPricedDocument ? documentLines : []).filter((line) => line.item_type === 'product' ? line.product_id : line.service_id)
        .map((line, index) => ({
          ...line, line_number: index + 1,
          product_id: line.item_type === 'product' ? line.product_id : null,
          service_id: line.item_type === 'service' ? line.service_id : null,
          description: line.description.trim() || (line.item_type === 'product'
            ? data.products.find((product) => product.id === line.product_id)?.designation
            : data.business_services.find((service) => service.id === line.service_id)?.name) || '',
          quantity: Number(line.quantity), unit_price: Number(line.unit_price), vat_rate: Number(line.vat_rate),
        }));
      const { error } = await client.rpc('save_trade_document_for_issuer', {
        p_document: {
          ...documentDraft,
          case_id: documentDraft.case_id || null,
          exchange_id: documentDraft.exchange_id || null,
          related_document_id: documentDraft.related_document_id || null,
          file_path: filePath,
        },
        p_lines: lines,
      });
      if (error) throw error;
      documentSaved = true;
      await onRefresh();
      setDialog('');
      notify('Document enregistré.');
    } catch (error) {
      let detail = error.message;
      if (filePath && !documentSaved) {
        const { error: cleanupError } = await client.storage.from('catalogue-media').remove([filePath]);
        if (cleanupError) detail += ` Le fichier joint n’a pas pu être nettoyé : ${cleanupError.message}`;
      }
      notify(`Enregistrement du document impossible : ${detail}`, true);
    } finally {
      setSaving(false);
    }
  };
  const savePayment = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { error } = await client.from('trade_payments').insert({
        ...paymentDraft,
        case_id: paymentDraft.case_id || null,
        exchange_id: paymentDraft.exchange_id || null,
        document_id: paymentDraft.document_id || null,
        counterparty_role: paymentDraft.counterparty_role || 'other',
        bank_account_id: paymentDraft.payment_method === 'bank_transfer' ? paymentDraft.bank_account_id || null : null,
        amount: Number(paymentDraft.amount),
      });
      if (error) throw error;
      await onRefresh();
      setDialog('');
      notify('Paiement réel enregistré.');
    } catch (error) {
      notify(`Enregistrement du paiement impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };
  const saveExpense = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const receiptPath = await uploadPrivateFile(receiptFile, 'trade/expenses');
      const { error } = await client.from('trade_expenses').insert({
        ...expenseDraft,
        contact_id: expenseDraft.contact_id || null,
        case_id: expenseDraft.case_id || null,
        amount: Number(expenseDraft.amount),
        receipt_path: receiptPath,
      });
      if (error) throw error;
      await onRefresh();
      setDialog('');
      setReceiptFile(null);
      notify('Dépense et justificatif enregistrés.');
    } catch (error) {
      notify(`Enregistrement de la dépense impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const setDocumentStatus = async (record, status) => {
    const { error } = await client.from('trade_documents').update({ status }).eq('id', record.id);
    if (error) notify(`Mise à jour impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const setTradeCaseStage = async (exchangeCase, trade_stage) => {
    const { error } = await client.from('crm_exchange_cases').update({ trade_stage, updated_at: new Date().toISOString() }).eq('id', exchangeCase.id);
    if (error) notify(`Mise à jour de l’étape commerciale impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const openServiceEditor = (service = null) => { setServiceToEdit(service); setServiceEditorOpen(true); };
  const saveCatalogService = async (draft) => {
    try {
      const payload = {
        name: draft.name.trim(),
        is_catalog_item: true,
        service_family: draft.service_family,
        internal_reference: draft.internal_reference.trim().toUpperCase(),
        description: (draft.description || '').trim(),
        billing_unit: 'forfait',
        request_fields: draft.request_fields || [],
        updated_at: new Date().toISOString(),
      };
      const query = draft.id
        ? client.from('business_services').update(payload).eq('id', draft.id)
        : client.from('business_services').insert(payload);
      const { error } = await query;
      if (error) throw error;
      await onRefresh();
      notify(draft.id ? 'Fiche de prestation mise à jour.' : 'Prestation ajoutée au catalogue.');
      return true;
    } catch (error) {
      notify(`Enregistrement de la prestation impossible : ${error.message}`, true);
      return false;
    }
  };
  const saveCatalogServicePrice = async (service, draft) => {
    const { error } = await client.rpc('save_business_service_price', {
      p_service_id: service.id,
      p_price_ht: Number(draft.price_ht),
      p_effective_at: draft.effective_at,
      p_note: draft.note.trim(),
      p_contact_id: draft.contact_id || null,
    });
    if (error) { notify(`Enregistrement du tarif impossible : ${error.message}`, true); return false; }
    await onRefresh();
    notify('Tarif forfaitaire ajouté à l’historique.');
    return true;
  };
  const setServiceActive = async (service, active) => {
    const { error } = await client.from('business_services').update({ active }).eq('id', service.id);
    if (error) notify(`Modification du service impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data: issuerId, error } = await client.rpc('save_business_issuer', {
        p_issuer_id: selectedIssuerId || null,
        p_issuer: { ...issuerDraft, is_default: Boolean(issuerDraft.is_default) },
      });
      if (error) throw error;
      setSelectedIssuerId(issuerId);
      setCreatingIssuer(false);
      await onRefresh();
      notify('Société émettrice enregistrée.');
    } catch (error) {
      notify(`Enregistrement de la société impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };
  const selectIssuer = (issuerId) => {
    const issuer = data.business_issuers.find((item) => item.id === issuerId);
    if (!issuer) return;
    setSelectedIssuerId(issuer.id);
    setIssuerDraft({ ...issuer, legal_identifiers: issuer.legal_identifiers || {} });
    setCreatingIssuer(false);
  };
  const createIssuer = () => {
    setSelectedIssuerId('');
    setIssuerDraft({ ...emptyIssuer(), is_default: data.business_issuers.length === 0 });
    setCreatingIssuer(true);
  };
  const deleteIssuer = async () => {
    const issuer = data.business_issuers.find((item) => item.id === selectedIssuerId);
    if (!issuer || !window.confirm(`Supprimer la société émettrice « ${issuer.legal_name} » ?`)) return;
    const { error } = await client.rpc('delete_business_issuer', { p_issuer_id: issuer.id });
    if (error) notify(`Suppression de la société impossible : ${error.message}`, true);
    else {
      setSelectedIssuerId('');
      setCreatingIssuer(false);
      await onRefresh();
      notify('Société émettrice supprimée.');
    }
  };
  const addBankAccount = async (event) => {
    event.preventDefault();
    const name = bankName.trim();
    if (!name) return;
    const { error } = await client.from('business_bank_accounts').insert({ name });
    if (error) notify(`Ajout du compte impossible : ${error.message}`, true);
    else { setBankName(''); await onRefresh(); }
  };
  const removeBankAccount = async (account) => {
    if (!window.confirm(`Supprimer le compte « ${account.name} » de la liste ?`)) return;
    const { error } = await client.from('business_bank_accounts').delete().eq('id', account.id);
    if (error) notify(`Suppression impossible : ${error.message}`, true);
    else await onRefresh();
  };
  const patchLine = (index, field, value) => setDocumentLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  const patchServiceDetail = (index, fieldKey, value) => setDocumentLines((lines) => lines.map((line, lineIndex) => lineIndex === index
    ? { ...line, service_details: { ...(line.service_details || {}), [fieldKey]: value } }
    : line));
  const selectServiceForDocumentLine = (index, serviceId) => {
    const service = data.business_services.find((item) => item.id === serviceId);
    setDocumentLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? {
      ...line,
      service_id: serviceId,
      product_id: '',
      service_details: {},
      description: service?.name || '',
      quantity: line.quantity || '1',
      unit_price: service?.default_price_ht == null ? '' : String(service.default_price_ht),
    } : line));
  };
  const tradeOperationCases = data.crm_exchange_cases.filter((exchangeCase) => ['trade', 'lead'].includes(exchangeCase.category)).map((exchangeCase) => {
    const exchanges = data.crm_exchanges.filter((item) => item.case_id === exchangeCase.id);
    const eventIds = new Set(exchanges.map((item) => item.id));
    const contactLinks = (data.crm_exchange_case_contacts || []).filter((link) => link.case_id === exchangeCase.id);
    const relatedContacts = contactLinks.map((link) => ({ contact: data.network_contacts.find((person) => person.id === link.contact_id), role: link.relationship_role || 'other' })).filter((entry) => entry.contact);
    const productIds = [...new Set(data.crm_exchange_products.filter((link) => eventIds.has(link.exchange_id)).map((link) => link.product_id))];
    const products = productIds.map((id) => data.products.find((product) => product.id === id)).filter(Boolean);
    const documents = data.trade_documents.filter((document) => document.case_id === exchangeCase.id || eventIds.has(document.exchange_id));
    const actions = data.crm_actions.filter((action) => eventIds.has(action.exchange_id) && !['done', 'cancelled'].includes(action.status));
    return { exchangeCase, exchanges, relatedContacts, products, documents, actions };
  }).filter(({ exchangeCase, relatedContacts, products }) => {
    const isClosed = ['closed_no_followup', 'converted'].includes(exchangeCase.status);
    const matchesStatus = operationFilter === 'all' || (operationFilter === 'active' && !isClosed) || (operationFilter === 'closed' && isClosed);
    return matchesStatus && [exchangeCase.title, ...relatedContacts.map(({ contact, role }) => `${contactLabel(contact)} ${role}`), ...products.map((product) => product.designation)].join(' ').toLocaleLowerCase().includes(operationSearch.trim().toLocaleLowerCase());
  }).sort((a, b) => new Date(b.exchangeCase.updated_at || b.exchangeCase.created_at) - new Date(a.exchangeCase.updated_at || a.exchangeCase.created_at));
  const tradeDocumentsFiltered = [...data.trade_documents].filter((document) => {
    const linkedExchange = data.crm_exchanges.find((exchange) => exchange.id === document.exchange_id);
    const caseRecord = data.crm_exchange_cases.find((item) => item.id === document.case_id || item.id === linkedExchange?.case_id);
    const contact = data.network_contacts.find((person) => person.id === document.contact_id);
    const haystack = [document.document_number, tradeDocumentTypes.find(([value]) => value === document.document_type)?.[1], contact ? contactLabel(contact) : '', caseRecord?.title].join(' ').toLocaleLowerCase();
    return (documentStatusFilter === 'all' || document.status === documentStatusFilter) && haystack.includes(documentSearch.trim().toLocaleLowerCase());
  }).sort((a, b) => b.document_date.localeCompare(a.document_date));
  const serviceCatalogItems = data.business_services.filter((service) => service.is_catalog_item);
  const visibleServiceCatalogItems = serviceCatalogItems.filter((service) => (serviceFamilyFilter === 'all' || service.service_family === serviceFamilyFilter)
    && `${service.name} ${service.internal_reference || ''} ${service.description || ''}`.toLocaleLowerCase().includes(serviceSearch.trim().toLocaleLowerCase()));

  return (
    <>
      <SectionHeading eyebrow={title[0]} title={title[1]} description={title[2]}
        action={mode === 'exchanges' ? <button className="button button-primary" type="button" onClick={openNewExchange}><Plus size={16} /> Nouvel échange</button>
          : mode === 'actions' ? <button className="button button-primary" type="button" onClick={() => openActionRecord()}><Plus size={16} /> Nouvelle action</button>
          : mode === 'trade' ? <div className="heading-actions"><button className="button button-quiet" type="button" onClick={() => { setPaymentDraft((draft) => ({ ...draft, contact_id: '', case_id: '', document_id: '', exchange_id: '', counterparty_role: 'customer' })); setDialog('payment'); }}><Plus size={16} /> Paiement</button><button className="button button-primary" type="button" onClick={() => openNewDocument()}><Plus size={16} /> Nouveau document</button></div>
            : null} />

      {mode === 'exchanges' && <>
        <Tabs
          label="Filtrer les échanges"
          value={categoryFilter}
          onChange={setCategoryFilter}
          tabs={[['all', 'Tous'], ['trade', 'Trade'], ['lead', 'Lead'], ['open', 'Flux / discussion']].map(([value, label]) => ({ value, label }))}
        />
        <div className="business-timeline">
          {filteredExchanges.map((item) => {
            const contact = data.network_contacts.find((person) => person.id === item.contact_id);
            const products = data.crm_exchange_products.filter((link) => link.exchange_id === item.id).map((link) => data.products.find((product) => product.id === link.product_id)).filter(Boolean);
            const services = data.crm_exchange_services.filter((link) => link.exchange_id === item.id).map((link) => data.business_services.find((service) => service.id === link.service_id)).filter(Boolean);
            const transports = data.crm_exchange_transports.filter((link) => link.exchange_id === item.id);
            const handling = data.crm_exchange_handling_types.filter((link) => link.exchange_id === item.id)
              .map((link) => data.business_handling_types.find((type) => type.id === link.handling_type_id)).filter(Boolean);
            const storage = data.crm_exchange_storage_types.filter((link) => link.exchange_id === item.id)
              .map((link) => data.business_storage_types.find((type) => type.id === link.storage_type_id)).filter(Boolean);
            const action = data.crm_actions.find((record) => record.exchange_id === item.id);
            return (
              <article className={`business-event event-${item.entry_kind}`} key={item.id}>
                <div className="business-event-meta"><strong>{displayDate(item.occurred_at)}</strong><span>{item.entry_kind === 'exchange' ? item.direction === 'incoming' ? 'Entrant' : 'Sortant' : item.entry_kind}</span><span>{item.channel}</span><span>{item.category.toUpperCase()}</span></div>
                <h3>{contact ? contactLabel(contact) : 'Contact supprimé'}</h3>
                <strong className="business-scenario">{exchangeScenarioValues(item.scenario).map((scenario) => exchangeScenarios.find(([value]) => value === scenario)?.[1] || scenario.replaceAll('_', ' ')).join(' · ')}</strong>
                {item.availability_date && <small className="business-event-subscenario">Disponibilité prévue : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${item.availability_date}T00:00:00`))}</small>}
                {item.subscenario && <small className="business-event-subscenario">{item.subscenario}</small>}
                {item.content && <p>{item.content}</p>}
                {(transports.length > 0 || handling.length > 0 || storage.length > 0) && <div className="business-chips">
                  {transports.map((transport) => <span key={transport.transport_type_id}>
                    {(() => {
                      const type = data.business_transport_types.find((item) => item.id === transport.transport_type_id);
                      const price = transport.route_details?.price !== null && transport.route_details?.price !== undefined && transport.route_details?.price !== ''
                        ? ` · ${formatExchangeCurrency(transport.route_details.price)}`
                        : '';
                      return <>{type?.name || 'Transport'} · {transport.quantity} {transport.unit.toUpperCase()}{price} · {transportRouteDescription(transport, type)}</>;
                    })()}
                  </span>)}
                  {handling.map((type) => <span key={type.id}>Manutention · {type.name}</span>)}
                  {storage.map((type) => <span key={type.id}>Stockage · {type.name}</span>)}
                </div>}
                {(products.length > 0 || services.length > 0) && <div className="business-chips">{products.map((product) => {
                  const link = data.crm_exchange_products.find((itemProduct) => itemProduct.exchange_id === item.id && itemProduct.product_id === product.id);
                  const packagingLevel = link?.packaging_level || 'uvc';
                  const packagingLabel = ({ uvc: 'UVC', pcb: 'PCB', palette: 'Palette' })[packagingLevel];
                  const amount = link?.quantity !== null && link?.quantity !== undefined ? `${link.quantity} ${packagingLabel}` : '';
                  const rates = exchangeProductStoredRates(product, link);
                  const selectedRate = rates[packagingLevel];
                  const price = selectedRate !== null ? ` · ${formatExchangeCurrency(selectedRate)} / ${packagingLabel}` : '';
                  const total = exchangeProductTotal(link, rates);
                  return <span key={product.id}>{product.designation}{amount ? ` · ${amount}` : ''}{price}{total !== null ? ` · Total ${formatExchangeCurrency(total)}` : ''}</span>;
                })}{services.map((service) => <span key={service.id}>{service.name}</span>)}</div>}
                {item.entry_kind === 'alert' && <small className="muted">Information déclarée par le contact; non vérifiée.</small>}
                {action && <div className="business-linked-action"><Check size={14} /> Action : {action.title} · {action.status}</div>}
                <button className="button button-quiet button-small business-event-open" type="button" onClick={() => openExchangeRecord(item)}>Ouvrir la fiche</button>
              </article>
            );
          })}
          {!filteredExchanges.length && <p className="muted">Aucun échange enregistré. Les informations et alertes n’entraînent jamais automatiquement la création d’une action.</p>}
        </div>
      </>}

      {mode === 'actions' && <section className="action-workspace">
        <div className="action-overview-cards">
          <button type="button" className={`action-overview-card is-overdue${actionFilter === 'overdue' ? ' is-selected' : ''}`} onClick={() => setActionFilter('overdue')}><span><AlertCircle size={17} /> En retard</span><strong>{actionCounts.overdue}</strong><small>À traiter en priorité</small></button>
          <button type="button" className={`action-overview-card is-today${actionFilter === 'open' ? ' is-selected' : ''}`} onClick={() => setActionFilter('open')}><span><CalendarDays size={17} /> À suivre</span><strong>{actionCounts.open}</strong><small>Actions ouvertes issues des échanges</small></button>
          <button type="button" className={`action-overview-card${actionFilter === 'done' ? ' is-selected' : ''}`} onClick={() => setActionFilter('done')}><span><Check size={17} /> Terminées</span><strong>{actionCounts.done}</strong><small>Suivis consignés</small></button>
        </div>
        <div className="action-toolbar"><div className="action-view-tabs" role="group" aria-label="Filtrer les actions"><button type="button" className={actionFilter === 'open' ? 'is-active' : ''} onClick={() => setActionFilter('open')}>À suivre</button><button type="button" className={actionFilter === 'overdue' ? 'is-active' : ''} onClick={() => setActionFilter('overdue')}>En retard</button><button type="button" className={actionFilter === 'done' ? 'is-active' : ''} onClick={() => setActionFilter('done')}>Terminées</button><button type="button" className={actionFilter === 'all' ? 'is-active' : ''} onClick={() => setActionFilter('all')}>Tout</button></div><label className="search-input action-search"><Search size={15} /><input type="search" value={actionSearch} onChange={(event) => setActionSearch(event.target.value)} placeholder="Action, contact ou dossier…" aria-label="Rechercher dans les actions" /></label></div>
        <div className="action-dashboard">
          {visibleActionGroups.map(([groupId, label, actions]) => <section className={`action-dashboard-group action-group-${groupId}`} key={groupId}>
            <h2>{label}<span>{actions.length}</span></h2>
            <div className="action-card-list">{actions.map((action) => {
              const { exchange, exchangeCase, contact, products } = actionExchangeContext(action);
              return <article className={`business-action-card${groupId === 'overdue' ? ' is-overdue' : ''}`} key={action.id}>
                <div className="business-action-card-main"><div className="business-action-card-title"><span className={`action-priority-dot action-priority-${groupId}`} /><h3>{action.title}</h3></div>
                  <div className="business-action-context"><strong>{exchangeCase?.title || 'Échange sans dossier'}</strong><span>{contact ? contactLabel(contact) : 'Contact'}{exchange?.occurred_at ? ` · échange du ${displayDate(exchange.occurred_at, false)}` : ''}</span></div>
                  {exchange?.content && <p className="business-action-source">« {exchange.content} »</p>}
                  {products.length > 0 && <div className="business-action-products">{products.slice(0, 4).map((product) => <span key={product}>{product}</span>)}{products.length > 4 && <small>+{products.length - 4}</small>}</div>}
                  <div className="business-action-due"><Clock3 size={13} /><span>{action.due_at ? displayDate(action.due_at) : 'Aucune échéance définie'}</span></div>
                </div>
                 <div className="business-action-card-controls"><button className="button button-primary button-small" type="button" onClick={() => openActionRecord(action)}><Pencil size={14} /> Ouvrir la fiche</button>
                  {exchangeCase && contact && <button className="button button-quiet button-small" type="button" onClick={() => onOpenContactExchange?.(contact.id, exchangeCase.id)}><FolderOpen size={14} /> Ouvrir le dossier</button>}
                  {action.status === 'done' && <button className="button button-primary button-small" type="button" onClick={() => {
                    const source = data.crm_exchanges.find((item) => item.id === action.exchange_id);
                    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setExchangeDraft({ ...emptyExchange, contact_id: action.contact_id, occurred_at: now, direction: 'outgoing', category: source?.category || 'trade', scenario: [action.title.toLowerCase().includes('pro-forma') ? 'proforma_sent' : 'other'] });
                    setExchangeFormMode('create'); setEditingExchangeId(null);
                    const linkedProducts = data.crm_exchange_products.filter((link) => link.exchange_id === action.exchange_id);
                    setExchangeProducts(linkedProducts.map((link) => link.product_id));
                    setExchangeProductDetails(Object.fromEntries(linkedProducts.map((link) => [link.product_id, { packaging_level: link.packaging_level || 'uvc', quantity: link.quantity ?? '', uvc_unit_price: link.uvc_unit_price ?? '' }])));
                    setSelectedServices(data.crm_exchange_services.filter((link) => link.exchange_id === action.exchange_id).map((link) => link.service_id));
                    setTransportDetails({}); setSelectedHandlingTypes([]); setSelectedStorageTypes([]); setActionTitle(''); setMakeAction(false); setDialog('exchange');
                  }}>Consigner la suite</button>}
                </div>
              </article>;
            })}</div>
          </section>)}
          {!visibleActionGroups.length && <div className="action-empty-state"><Check size={22} /><strong>Aucune action dans cette vue</strong><p>Les actions sont créées depuis un échange, avec un contact et un contexte de dossier.</p></div>}
        </div>
      </section>}

      {mode === 'trade' && <>
        <Tabs
          label="Rubriques Trade"
          value={tradeSection}
          onChange={setTradeSection}
          tabs={[['operations', 'Opérations'], ['documents', 'Documents'], ['payments', 'Paiements'], ['expenses', 'Dépenses']].map(([value, label]) => ({ value, label }))}
        />
        {tradeSection === 'operations' ? (
          <section className="trade-operations-workspace">
            <div className="action-toolbar"><div className="action-view-tabs" role="group" aria-label="Filtrer les opérations"><button type="button" className={operationFilter === 'active' ? 'is-active' : ''} onClick={() => setOperationFilter('active')}>En cours</button><button type="button" className={operationFilter === 'closed' ? 'is-active' : ''} onClick={() => setOperationFilter('closed')}>Clôturées</button><button type="button" className={operationFilter === 'all' ? 'is-active' : ''} onClick={() => setOperationFilter('all')}>Toutes</button></div><label className="search-input action-search"><Search size={15} /><input type="search" value={operationSearch} onChange={(event) => setOperationSearch(event.target.value)} placeholder="Dossier, contact ou produit…" aria-label="Rechercher une opération" /></label></div>
            <div className="trade-operation-list">{tradeOperationCases.map(({ exchangeCase, exchanges, relatedContacts, products, documents, actions }) => { const primaryContact = data.network_contacts.find((contact) => contact.id === exchangeCase.contact_id); return <article className="trade-operation-card" key={exchangeCase.id}>
              <div className="trade-operation-card-main"><span className="reference-label">{caseKindLabels[exchangeCase.case_kind] || 'Opération'} · {exchangeCase.category === 'lead' ? 'Demande commerciale' : 'Transaction'} · {exchanges.length} échange{exchanges.length === 1 ? '' : 's'}</span><h2>{exchangeCase.title}</h2><p>{primaryContact ? `${({ customer: 'Client', supplier: 'Fournisseur', logistics: 'Logistique', other: 'Contact' })[exchangeCase.primary_contact_role || 'other']} · ${contactLabel(primaryContact)}` : 'Contact non renseigné'}{relatedContacts.length > 0 ? ` · ${relatedContacts.map(({ contact, role }) => `${({ customer: 'Client', supplier: 'Fournisseur', logistics: 'Logistique', other: 'Autre' })[role]} · ${contactLabel(contact)}`).join(', ')}` : ''}</p><div className="trade-operation-signals">{products.length > 0 && <span>{products.slice(0, 3).map((product) => product.designation).join(' · ')}{products.length > 3 ? ` · +${products.length - 3}` : ''}</span>}<span>{documents.length} document{documents.length === 1 ? '' : 's'}</span><span>{actions.length} action{actions.length === 1 ? '' : 's'} ouverte{actions.length === 1 ? '' : 's'}</span></div></div>
              <div className="trade-operation-card-controls"><label className="field"><span>Étape</span><select aria-label={`Étape commerciale de ${exchangeCase.title}`} value={exchangeCase.trade_stage || 'qualification'} onChange={(event) => setTradeCaseStage(exchangeCase, event.target.value)}>{tradeStages.map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}</select></label><button className="button button-quiet button-small" type="button" onClick={() => onOpenContactExchange?.(exchangeCase.contact_id, exchangeCase.id)}>Ouvrir le dossier contact</button></div>
            </article>; })}{!tradeOperationCases.length && <div className="action-empty-state"><strong>{operationSearch ? 'Aucun dossier trouvé' : 'Aucune opération dans cette vue'}</strong><p>Crée un échange commercial depuis la fiche du contact pour commencer le suivi.</p></div>}</div>
          </section>
        ) : tradeSection === 'payments' ? (
          <div className="reference-list">{[...data.trade_payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).map((payment) => { const caseRecord = data.crm_exchange_cases.find((item) => item.id === payment.case_id) || data.crm_exchange_cases.find((item) => item.id === data.crm_exchanges.find((exchange) => exchange.id === payment.exchange_id)?.case_id); const contact = data.network_contacts.find((item) => item.id === payment.contact_id); const document = data.trade_documents.find((item) => item.id === payment.document_id); return <article className="business-action" key={payment.id}><div><strong>{money(payment.amount)} · {payment.direction === 'incoming' ? 'Entrant' : 'Sortant'}</strong><small>{contact ? contactLabel(contact) : 'Contact non renseigné'} · {payment.counterparty_role === 'supplier' ? 'Fournisseur' : payment.counterparty_role === 'customer' ? 'Client' : 'Autre'} · {displayDate(payment.payment_date, false)} · {({ cash: 'Espèces', bank_transfer: 'Virement', card: 'Carte bancaire' })[payment.payment_method]}{payment.bank_account_id ? ` · ${data.business_bank_accounts.find((account) => account.id === payment.bank_account_id)?.name || ''}` : ''}</small>{caseRecord && <small>Dossier · {caseRecord.title}</small>}{document && <small>Document · {document.document_number || tradeDocumentTypes.find(([value]) => value === document.document_type)?.[1]}</small>}</div></article>; })}</div>
        ) : tradeSection === 'expenses' ? (
          <><div className="heading-actions"><button className="button button-primary" type="button" onClick={() => { setExpenseDraft((draft) => ({ ...draft, contact_id: '', case_id: '' })); setDialog('expense'); }}><Plus size={16} /> Nouvelle dépense</button></div><div className="reference-list">{[...data.trade_expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)).map((expense) => { const contact = data.network_contacts.find((item) => item.id === expense.contact_id); const caseRecord = data.crm_exchange_cases.find((item) => item.id === expense.case_id); return <article className="business-action" key={expense.id}><div><strong>{expense.category} · {money(expense.amount)}</strong><small>{displayDate(expense.expense_date, false)}{contact ? ` · ${contactLabel(contact)}` : ''}{expense.description && ` · ${expense.description}`}</small>{caseRecord && <small>Dossier · {caseRecord.title}</small>}{expense.receipt_path && data.mediaUrls[expense.receipt_path] && <a href={data.mediaUrls[expense.receipt_path]} target="_blank" rel="noreferrer">Consulter le justificatif</a>}</div></article>; })}</div></>
        ) : (
          <><div className="action-toolbar"><label className="search-input action-search"><Search size={15} /><input type="search" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Numéro, contact ou dossier…" aria-label="Rechercher un document" /></label><SelectField label="Statut du document" value={documentStatusFilter} onChange={setDocumentStatusFilter} options={ [['all', 'Tous les statuts'], ['draft', 'Brouillons'], ['received', 'Reçus'], ['sent', 'Envoyés'], ['accepted', 'Acceptés'], ['refused', 'Refusés'], ['stored', 'Archivés']] } /></div><div className="reference-list">{tradeDocumentsFiltered.map((documentRecord) => {
            const lines = data.trade_document_lines.filter((line) => line.document_id === documentRecord.id);
            const label = tradeDocumentTypes.find(([value]) => value === documentRecord.document_type)?.[1] || documentRecord.document_type;
            const issuer = data.business_issuers.find((item) => item.id === documentRecord.issuer_id);
            const linkedExchange = data.crm_exchanges.find((exchange) => exchange.id === documentRecord.exchange_id);
            const caseRecord = data.crm_exchange_cases.find((item) => item.id === documentRecord.case_id || item.id === linkedExchange?.case_id);
            const mayPrint = documentRecord.counterparty_role !== 'supplier' && ['proforma', 'final_invoice', 'credit_note'].includes(documentRecord.document_type) && lines.length;
            return <article className="business-action" key={documentRecord.id}>
              <div><strong>{documentRecord.counterparty_role === 'supplier' ? `Reçu du fournisseur · ${label}` : `${label} · ${documentRecord.document_number}`}</strong><small>{issuer?.legal_name ? `${issuer.legal_name} · ` : ''}{contactLabel(data.network_contacts.find((person) => person.id === documentRecord.contact_id) || {})} · {documentRecord.counterparty_role === 'supplier' ? 'Fournisseur' : documentRecord.counterparty_role === 'customer' ? 'Client' : 'Autre'} · {displayDate(documentRecord.document_date, false)} · {documentRecord.status}</small>{caseRecord && <small>Dossier · {caseRecord.title}</small>}
                {documentRecord.file_path && data.mediaUrls[documentRecord.file_path] && <a href={data.mediaUrls[documentRecord.file_path]} target="_blank" rel="noreferrer">Ouvrir le document joint</a>}
              </div>
              <div className="heading-actions">
                {mayPrint && <button className="button button-quiet button-small" type="button" onClick={() => { try { printDocument(documentRecord, lines, data); } catch (error) { notify(error.message, true); } }}><FileDown size={14} /> Générer PDF</button>}
                <select aria-label={`Statut ${label}`} value={documentRecord.status} onChange={(event) => setDocumentStatus(documentRecord, event.target.value)}>{['draft', 'received', 'sent', 'accepted', 'refused', 'stored'].map((status) => <option key={status} value={status}>{({ draft: 'Brouillon', received: 'Reçu', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', stored: 'Archivé' })[status]}</option>)}</select>
              </div>
            </article>;
          })}
          {!tradeDocumentsFiltered.length && <p className="muted">{data.trade_documents.length ? 'Aucun document ne correspond à cette recherche.' : 'Aucun document enregistré.'}</p>}
          </div></>
        )}
        {tradeSection === 'payments' && <div className="heading-actions"><button className="button button-primary" type="button" onClick={() => { setPaymentDraft((draft) => ({ ...draft, contact_id: '', case_id: '', document_id: '', exchange_id: '', counterparty_role: 'customer' })); setDialog('payment'); }}><Plus size={16} /> Enregistrer un paiement</button></div>}
      </>}

      {mode === 'services' && <section className="service-catalog-workspace">
        <div className="service-catalog-overview"><div><span className="reference-label">CATALOGUE DE PRESTATIONS</span><h2>Transport, stockage et manutention</h2><p>Chaque prestation a sa référence, ses informations métier, son historique de prix et peut être facturée au forfait HT.</p></div><button className="button button-primary" type="button" onClick={() => openServiceEditor()}><Plus size={16} /> Nouvelle prestation</button></div>
        <div className="service-catalog-stats">{[['all', 'Toutes', serviceCatalogItems.length], ['transport', 'Transport', serviceCatalogItems.filter((service) => service.service_family === 'transport').length], ['storage', 'Stockage', serviceCatalogItems.filter((service) => service.service_family === 'storage').length], ['handling', 'Manutention', serviceCatalogItems.filter((service) => service.service_family === 'handling').length]].map(([family, label, count]) => <button type="button" key={family} className={`service-catalog-stat${serviceFamilyFilter === family ? ' is-active' : ''}`} onClick={() => setServiceFamilyFilter(family)}><span>{label}</span><strong>{count}</strong></button>)}</div>
        <div className="service-catalog-toolbar"><label className="search-input"><Search size={15} /><input type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Rechercher une prestation ou une référence…" aria-label="Rechercher dans le catalogue de prestations" /></label><span>{visibleServiceCatalogItems.filter((service) => service.default_price_ht == null).length} tarif(s) à définir</span></div>
        <div className="service-catalog-grid">{visibleServiceCatalogItems.map((service) => {
          const serviceHistory = data.business_service_price_history.filter((entry) => entry.service_id === service.id).sort((a, b) => new Date(b.effective_at) - new Date(a.effective_at));
          return <article className={`service-catalog-card${service.active ? '' : ' is-inactive'}`} key={service.id}>
             <ServiceIllustration service={service} />
            <div className="service-catalog-card-top"><span className={`service-family-badge family-${service.service_family}`}>{serviceFamilyLabels[service.service_family] || 'Prestation'}</span><code>{service.internal_reference}</code></div>
            <h3>{service.name}</h3><p>{service.description || 'Prestation de service facturable au forfait.'}</p>
            <div className="service-catalog-price"><span>Tarif actuel · forfait HT</span><strong>{service.default_price_ht == null ? 'À définir' : money(service.default_price_ht)}</strong><small>{serviceHistory.length} entrée{serviceHistory.length === 1 ? '' : 's'} dans l’historique</small></div>
            <div className="service-catalog-card-actions"><button className="button button-quiet button-small" type="button" onClick={() => openServiceEditor(service)}><Pencil size={14} /> Ouvrir la fiche</button><button className="button button-quiet button-small" type="button" onClick={() => setServiceActive(service, !service.active)}>{service.active ? 'Désactiver' : 'Réactiver'}</button></div>
          </article>;
        })}{!visibleServiceCatalogItems.length && <div className="action-empty-state"><strong>Aucune prestation trouvée</strong><p>Modifie les filtres ou ajoute une prestation au catalogue.</p></div>}</div>
        <details className="service-logistics-settings"><summary>Réglages des types opérationnels utilisés dans les échanges</summary><div className="logistics-type-managers">
          <LogisticsTypeManager title="Types de transport" table="business_transport_types" records={data.business_transport_types} client={client} notify={notify} onRefresh={onRefresh} />
          <LogisticsTypeManager title="Types de manutention" table="business_handling_types" records={data.business_handling_types} client={client} notify={notify} onRefresh={onRefresh} />
          <LogisticsTypeManager title="Types de stockage" table="business_storage_types" records={data.business_storage_types} client={client} notify={notify} onRefresh={onRefresh} />
        </div></details>
      </section>}
      {mode === 'services' && serviceEditorOpen && <ServiceCatalogEditor key={serviceToEdit?.id || 'new-service'} service={serviceToEdit} contacts={data.network_contacts} history={serviceToEdit ? data.business_service_price_history.filter((entry) => entry.service_id === serviceToEdit.id).sort((a, b) => new Date(b.effective_at) - new Date(a.effective_at)) : []} onSave={saveCatalogService} onSavePrice={saveCatalogServicePrice} onClose={() => { setServiceEditorOpen(false); setServiceToEdit(null); }} />}

      {mode === 'business-settings' && <>
        <form className="record-form" onSubmit={saveProfile}>
          <h2>Sociétés émettrices des documents Trade</h2>
          <p className="muted small">Enregistrez vos différentes sociétés une seule fois, puis choisissez l’émetteur au moment de créer chaque document. Les contacts et le réseau restent communs.</p>
          <div className="heading-actions issuer-selector">
            <SelectField label="Société à configurer" value={creatingIssuer ? '' : selectedIssuerId} onChange={selectIssuer} options={data.business_issuers.map((issuer) => [issuer.id, `${issuer.legal_name || 'Société sans nom'}${issuer.is_default ? ' · Par défaut' : ''}`])} placeholder={creatingIssuer ? 'Nouvelle société' : 'Choisir une société'} />
            <button className="button button-quiet" type="button" onClick={createIssuer}><Plus size={15} /> Nouvelle société</button>
            {selectedIssuerId && <button className="button button-quiet button-small" type="button" onClick={deleteIssuer}>Supprimer cette société</button>}
          </div>
          <div className="form-grid two-columns">
            <Field label="Nom légal" value={issuerDraft.legal_name} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, legal_name: value }))} required />
            <Field label="Pays" value={issuerDraft.country} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, country: value }))} required />
            <Field label="Adresse" value={issuerDraft.address} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, address: value }))} />
            <Field label="Code postal" value={issuerDraft.postal_code} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, postal_code: value }))} />
            <Field label="Ville" value={issuerDraft.city} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, city: value }))} />
            <Field label="E-mail" type="email" value={issuerDraft.email} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, email: value }))} />
            <Field label="Téléphone" type="tel" value={issuerDraft.phone} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, phone: value }))} />
            {['siren', 'siret', 'vat'].map((key) => <Field key={key} label={({ siren: 'SIREN', siret: 'SIRET', vat: 'N° TVA intracommunautaire' })[key]} value={issuerDraft.legal_identifiers?.[key] || ''} onChange={(value) => setIssuerDraft((previous) => ({ ...previous, legal_identifiers: { ...previous.legal_identifiers, [key]: value } }))} />)}
          </div>
          <label className="business-multi-option issuer-default-option"><input type="checkbox" checked={issuerDraft.is_default} onChange={(event) => setIssuerDraft((previous) => ({ ...previous, is_default: event.target.checked }))} /> Proposer cette société par défaut pour les nouveaux documents</label>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la société'}</button>
        </form>
        <SectionLabel>Comptes bancaires proposés pour les virements</SectionLabel>
        <form className="heading-actions" onSubmit={addBankAccount}><Field label="Nom du compte bancaire" value={bankName} onChange={setBankName} required /><button className="button button-primary" type="submit"><Plus size={15} /> Ajouter le compte</button></form>
        <div className="reference-list">{data.business_bank_accounts.map((account) => <div className="reference-row" key={account.id}><span>{account.name}</span><button className="icon-button danger-icon" type="button" aria-label={`Supprimer ${account.name}`} onClick={() => removeBankAccount(account)}><Trash2 size={15} /></button></div>)}</div>
        <section className="exchange-logistics-panel document-template-editor">
          <SectionLabel>Identité des documents émis</SectionLabel>
          <p className="muted small">Le logo et les couleurs ci-dessous appartiennent à ta société émettrice. Ils seront utilisés sur ses pro-formas et factures, quel que soit le client.</p>
          {selectedIssuerId ? <>
            <div className="document-template-preview" style={{ '--template-primary': safeHexColor(documentTemplateDraft.primary_color, '#244d3c'), '--template-accent': safeHexColor(documentTemplateDraft.accent_color, '#6f806f') }}>
              <div className="document-template-preview-brand">{documentTemplateDraft.logo_path && data.mediaUrls[documentTemplateDraft.logo_path] ? <img src={data.mediaUrls[documentTemplateDraft.logo_path]} alt="" /> : <span>{issuerDraft.legal_name?.slice(0, 2).toLocaleUpperCase('fr') || 'TB'}</span>}<strong>{issuerDraft.legal_name || 'Nom de la société émettrice'}</strong><small>APERÇU DE FACTURE</small></div>
              <div className="document-template-preview-content"><div><span>FACTURÉ À</span><strong>Nom du client</strong><small>Adresse du client · Ville</small></div><div className="document-template-preview-title"><strong>FACTURE PRO FORMA</strong><span>PRO-2026-00001</span></div><div className="document-template-preview-row"><span>Produit ou prestation</span><span>1 250,00 €</span></div><div className="document-template-preview-total"><span>Total estimatif TTC</span><strong>1 500,00 €</strong></div></div>
              <p>{documentTemplateDraft.header_text || 'Votre en-tête apparaîtra ici.'}{documentTemplateDraft.footer_text ? ` · ${documentTemplateDraft.footer_text}` : ''}</p>
            </div>
            <div className="form-grid two-columns">
              <label className="field"><span>Couleur principale</span><input type="color" value={documentTemplateDraft.primary_color} onChange={(event) => setDocumentTemplateDraft((draft) => ({ ...draft, primary_color: event.target.value }))} /></label>
              <label className="field"><span>Couleur secondaire</span><input type="color" value={documentTemplateDraft.accent_color} onChange={(event) => setDocumentTemplateDraft((draft) => ({ ...draft, accent_color: event.target.value }))} /></label>
              <label className="field"><span>Texte d’en-tête</span><textarea rows="2" maxLength="300" value={documentTemplateDraft.header_text} onChange={(event) => setDocumentTemplateDraft((draft) => ({ ...draft, header_text: event.target.value }))} /></label>
              <label className="field"><span>Texte de pied de page</span><textarea rows="2" maxLength="600" value={documentTemplateDraft.footer_text} onChange={(event) => setDocumentTemplateDraft((draft) => ({ ...draft, footer_text: event.target.value }))} /></label>
            </div>
            <label className="upload-row"><Upload size={16} /><span>{templateLogoFile?.name || (documentTemplateDraft.logo_path ? 'Logo enregistré — choisir pour remplacer' : 'Ajouter le logo de la société émettrice')}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setTemplateLogoFile(event.target.files?.[0] || null)} /></label>
            {documentTemplateDraft.logo_path && data.mediaUrls[documentTemplateDraft.logo_path] && <img className="trade-issuer-logo-preview" src={data.mediaUrls[documentTemplateDraft.logo_path]} alt="Logo de la société émettrice" />}
            {(documentTemplateDraft.logo_path || templateLogoFile) && <button className="button button-quiet button-small" type="button" onClick={() => { setDocumentTemplateDraft((draft) => ({ ...draft, logo_path: '' })); setTemplateLogoFile(null); }}>Retirer le logo du modèle</button>}
            <button className="button button-primary button-small" type="button" disabled={saving} onClick={saveIssuerDocumentTemplate}>{saving ? 'Enregistrement…' : 'Enregistrer l’identité PDF'}</button>
          </> : <p className="muted small">Enregistre d’abord une société émettrice pour configurer son identité PDF.</p>}
        </section>
        <p className="muted small">Les taux français disponibles sont proposés sans affectation automatique: vérifiez le taux applicable à chaque opération. Une prestation B2B intracommunautaire relève généralement de l’autoliquidation, et non d’une exonération automatique.</p>
      </>}

      {dialog === 'exchange' && <Modal
        title={exchangeFormMode === 'create' ? 'Consigner un échange' : exchangeFormMode === 'edit' ? 'Modifier la fiche échange / lead' : `${exchangeDraft.category === 'lead' ? 'Fiche lead' : 'Fiche échange'} · ${contactLabel(data.network_contacts.find((contact) => contact.id === exchangeDraft.contact_id) || {})}`}
        onClose={() => { setDialog(''); setEditingExchangeId(null); }}
      >
        <form className="record-form" onSubmit={saveExchange}>
          <fieldset className={`exchange-fields${exchangeFormMode === 'edit' ? ' exchange-fields-editing' : ''}`} disabled={exchangeFormMode === 'read' || saving}>
            {exchangeFormMode === 'edit' && <div className="edit-mode-notice">Mode modification — vos changements ne sont pas encore enregistrés.</div>}
          <SelectField label="Contact" value={exchangeDraft.contact_id} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, contact_id: value }))} options={data.network_contacts.map((person) => [person.id, contactLabel(person)])} placeholder="Choisir un contact" />
          <div className="form-grid two-columns">
            <Field label="Date et heure" type="datetime-local" value={exchangeDraft.occurred_at} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, occurred_at: value }))} required />
            <SelectField label="Direction" value={exchangeDraft.direction} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, direction: value }))} options={ [['incoming', 'Entrant'], ['outgoing', 'Sortant']] } />
            <SelectField label="Type de canal" value={exchangeDraft.channel_kind} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, channel_kind: value, channel: value === 'digital' ? 'whatsapp_message' : 'Café' }))} options={ [['digital', 'Digital'], ['physical', 'Physique']] } />
            <SelectField label="Canal" value={exchangeDraft.channel} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, channel: value }))} options={exchangeDraft.channel_kind === 'digital' ? digitalChannels : physicalChannels.map((value) => [value, value])} />
            <SelectField label="Catégorie" value={exchangeDraft.category} onChange={(value) => setExchangeDraft((draft) => {
              const scenarios = draft.scenario.filter((scenario) => scenariosByCategory[value].includes(scenario));
              const nextScenarios = scenarios.length
                ? scenarios
                : [value === 'open' ? 'open_discussion' : value === 'lead' ? 'price_request' : 'proforma_request'];
              const keepsAvailability = nextScenarios.some((scenario) => ['availability_request', 'availability_announced'].includes(scenario));
              return { ...draft, category: value, scenario: nextScenarios, availability_date: keepsAvailability ? draft.availability_date : '' };
            })} options={ [['trade', 'Trade'], ['lead', 'Lead'], ['open', 'Flux / discussion ouverte']] } />
            <SelectField label="Qualification" value={exchangeDraft.entry_kind} onChange={(value) => setExchangeDraft((draft) => {
              const openEntry = ['information', 'observation', 'alert'].includes(value);
              return { ...draft, entry_kind: value, category: openEntry ? 'open' : draft.category, scenario: openEntry ? ['open_discussion'] : draft.scenario, availability_date: openEntry ? '' : draft.availability_date };
            })} options={ [['exchange', 'Échange'], ['information', 'Information'], ['observation', 'Observation'], ['alert', 'Alerte']] } />
            <fieldset className="field exchange-scenario-options">
              <legend>Scénario · plusieurs choix possibles</legend>
              {exchangeScenarios.filter(([value]) => scenariosByCategory[exchangeDraft.category].includes(value)).map(([value, label]) => (
                <label className="business-multi-option" key={value}>
                  <input
                    type="checkbox"
                    checked={exchangeDraft.scenario.includes(value)}
                    onChange={() => setExchangeDraft((draft) => {
                      const scenarios = draft.scenario.includes(value)
                        ? draft.scenario.length > 1 ? draft.scenario.filter((scenario) => scenario !== value) : draft.scenario
                        : [...draft.scenario, value];
                      const keepsAvailability = scenarios.some((scenario) => ['availability_request', 'availability_announced'].includes(scenario));
                      return { ...draft, scenario: scenarios, availability_date: keepsAvailability ? draft.availability_date : '' };
                    })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {availabilityScenarioSelected && <Field
              label="Date de disponibilité souhaitée / annoncée"
              type="date"
              value={exchangeDraft.availability_date}
              onChange={(value) => setExchangeDraft((draft) => ({ ...draft, availability_date: value }))}
            />}
            <Field label="Sous-scénario" value={exchangeDraft.subscenario} onChange={(value) => setExchangeDraft((draft) => ({ ...draft, subscenario: value }))} placeholder="Précision libre" />
          </div>
          <MultiSelectField label="Produits concernés" value={selectedProducts} onChange={setExchangeProducts} options={data.products} />
          {selectedProducts.length > 0 && <section className="exchange-product-pricing">
            <SectionLabel>Conditionnement et prix des produits</SectionLabel>
            <p className="muted small">Saisissez le prix unitaire d’une UVC. Les tarifs PCB et palette sont calculés selon les quantités enregistrées sur chaque fiche produit.</p>
            {selectedProducts.map((productId) => {
              const product = data.products.find((item) => item.id === productId);
              if (!product) return null;
              const productDetails = exchangeProductDetails[productId] || emptyExchangeProduct();
              const rates = exchangeProductRates(product, productDetails);
              const total = exchangeProductTotal(productDetails, rates);
              return <article className="exchange-product-price" key={productId}>
                <h3>{product.designation}</h3>
                <div className="form-grid two-columns">
                  <SelectField label="Type de conditionnement" value={productDetails.packaging_level} onChange={(value) => updateExchangeProduct(productId, 'packaging_level', value)} options={ [['uvc', 'UVC'], ['pcb', 'PCB'], ['palette', 'Palette']] } />
                  <Field label="Quantité" type="number" min="1" step="1" value={productDetails.quantity} onChange={(value) => updateExchangeProduct(productId, 'quantity', value)} placeholder="Quantité au conditionnement choisi" />
                  <Field label="Prix unitaire UVC (€)" type="number" min="0" step="0.01" value={productDetails.uvc_unit_price} onChange={(value) => updateExchangeProduct(productId, 'uvc_unit_price', value)} placeholder="Ex. 2,50" />
                  <div className="exchange-product-total"><span>Total estimé · {productDetails.quantity || '—'} {({ uvc: 'UVC', pcb: 'PCB', palette: 'palettes' })[productDetails.packaging_level]}</span><strong>{formatExchangeCurrency(total)}</strong></div>
                </div>
                <div className="exchange-product-rates" aria-live="polite">
                  <span>Prix UVC <strong>{formatExchangeCurrency(rates.uvc)}</strong></span>
                  <span>Prix PCB <strong>{formatExchangeCurrency(rates.pcb)}</strong></span>
                  <span>Prix palette <strong>{formatExchangeCurrency(rates.palette)}</strong></span>
                </div>
                {(productDetails.packaging_level !== 'uvc' && (!Number(product.quantity_uvc_pcb) || (productDetails.packaging_level === 'palette' && !Number(product.quantity_pcb_palette)))) && <small className="muted">Renseignez les quantités de conditionnement manquantes sur la fiche produit pour calculer ce tarif.</small>}
              </article>;
            })}
          </section>}
          <MultiSelectField label="Services concernés" value={selectedServices} onChange={setSelectedServices} options={data.business_services.filter((service) => !service.is_catalog_item && (service.active || selectedServices.includes(service.id)))} />
          {hasService(data, selectedServices, 'Transport') && <section className="exchange-logistics-panel">
            <SectionLabel>Transport · quantité par type</SectionLabel>
            <p className="muted small">Pour chaque transport, indiquez la quantité et son conditionnement : PCB ou palette.</p>
            {data.business_transport_types.filter((type) => type.active || transportDetails[type.id]).map((type) => {
              const details = transportDetails[type.id];
              const international = ['intra-européenne', 'export'].includes(type.name.toLocaleLowerCase('fr'));
              return <div className="exchange-transport-row" key={type.id}>
                <label className="business-multi-option">
                  <input type="checkbox" checked={Boolean(details)} onChange={(event) => setTransportDetails((current) => {
                    if (event.target.checked) return { ...current, [type.id]: current[type.id] || emptyTransportDetails() };
                    const next = { ...current }; delete next[type.id]; return next;
                  })} />
                  <span>{type.name}</span>
                </label>
                {details && <div className="form-grid two-columns">
                  <Field label={`Quantité · ${type.name}`} type="number" min="0.01" step="0.01" required value={details.quantity} onChange={(value) => setTransportDetails((current) => ({ ...current, [type.id]: { ...current[type.id], quantity: value } }))} />
                  <Field label={`Prix du transport · ${type.name} (€)`} type="number" min="0" step="0.01" value={details.price} onChange={(value) => setTransportDetails((current) => ({ ...current, [type.id]: { ...current[type.id], price: value } }))} />
                  <SelectField label="Conditionnement transport" value={details.unit} onChange={(value) => setTransportDetails((current) => ({ ...current, [type.id]: { ...current[type.id], unit: value } }))} options={ [['pcb', 'PCB'], ['palette', 'Palette']] } />
                  {!international && <SelectField label="Pays de la navette" value={details.country_code} onChange={(value) => updateTransport(type.id, 'country_code', value)} options={countries} required />}
                  <label className="business-multi-option exchange-direct-option">
                    <input type="checkbox" checked={details.direct} onChange={(event) => {
                      const direct = event.target.checked;
                      updateTransport(type.id, 'direct', direct);
                      if (!direct && !details.pickup_locations?.length) updateTransport(type.id, 'pickup_locations', emptyTransportDetails().pickup_locations);
                    }} />
                    <span>Trajet direct (sans ramasse)</span>
                  </label>
                  {details.direct ? <>
                    <div className="exchange-route-fields">
                      <SectionLabel>Chargement</SectionLabel>
                      {international && <SelectField label="Pays de chargement" value={details.origin_country_code} onChange={(value) => updateTransport(type.id, 'origin_country_code', value)} options={countries} required />}
                      <div className="form-grid two-columns">
                        <Field label="Ville de chargement" value={details.origin_city} onChange={(value) => updateTransport(type.id, 'origin_city', value)} required />
                        <Field label="Adresse de chargement" value={details.origin_address} onChange={(value) => updateTransport(type.id, 'origin_address', value)} required />
                      </div>
                    </div>
                  </> : <div className="exchange-pickup-list">
                    <SectionLabel>Lieux de ramasse</SectionLabel>
                    {details.pickup_locations.map((location, index) => <div className="exchange-route-fields" key={`${type.id}-pickup-${index}`}>
                      <div className="exchange-route-heading">
                        <strong>Ramasse {index + 1}</strong>
                        <button className="button button-quiet button-small" type="button" disabled={details.pickup_locations.length === 1} onClick={() => removePickupLocation(type.id, index)}>Retirer</button>
                      </div>
                      {international && <SelectField label={`Pays de la ramasse ${index + 1}`} value={location.country_code} onChange={(value) => updatePickupLocation(type.id, index, 'country_code', value)} options={countries} required />}
                      {!international && <input type="hidden" value={details.country_code} readOnly />}
                      <div className="form-grid two-columns">
                        <Field label={`Ville de la ramasse ${index + 1}`} value={location.city} onChange={(value) => updatePickupLocation(type.id, index, 'city', value)} required />
                        <Field label={`Adresse de la ramasse ${index + 1}`} value={location.address} onChange={(value) => updatePickupLocation(type.id, index, 'address', value)} required />
                      </div>
                    </div>)}
                    <button className="button button-quiet button-small" type="button" onClick={() => addPickupLocation(type.id)}><Plus size={14} /> Ajouter un lieu de ramasse</button>
                  </div>}
                  <div className="exchange-route-fields">
                    <SectionLabel>Déchargement</SectionLabel>
                    {international && <SelectField label="Pays de déchargement" value={details.destination_country_code} onChange={(value) => updateTransport(type.id, 'destination_country_code', value)} options={countries} required />}
                    <div className="form-grid two-columns">
                      <Field label="Ville de déchargement" value={details.destination_city} onChange={(value) => updateTransport(type.id, 'destination_city', value)} required />
                      <Field label="Adresse de déchargement" value={details.destination_address} onChange={(value) => updateTransport(type.id, 'destination_address', value)} required />
                    </div>
                  </div>
                </div>}
              </div>;
            })}
          </section>}
          {hasService(data, selectedServices, 'Manutention') && <section className="exchange-logistics-panel">
            <SectionLabel>Types de manutention</SectionLabel>
            <div className="business-multi-results">{data.business_handling_types.filter((type) => type.active || selectedHandlingTypes.includes(type.id)).map((type) => (
              <label className="business-multi-option" key={type.id}>
                <input type="checkbox" checked={selectedHandlingTypes.includes(type.id)} onChange={() => setSelectedHandlingTypes((current) => current.includes(type.id) ? current.filter((id) => id !== type.id) : [...current, type.id])} />
                <span>{type.name}</span>
              </label>
            ))}</div>
            {!data.business_handling_types.some((type) => type.active) && <p className="muted small">Ajoutez des types dans la rubrique Services.</p>}
          </section>}
          {hasService(data, selectedServices, 'Stockage') && <section className="exchange-logistics-panel">
            <SectionLabel>Types de stockage</SectionLabel>
            <div className="business-multi-results">{data.business_storage_types.filter((type) => type.active || selectedStorageTypes.includes(type.id)).map((type) => (
              <label className="business-multi-option" key={type.id}>
                <input type="checkbox" checked={selectedStorageTypes.includes(type.id)} onChange={() => setSelectedStorageTypes((current) => current.includes(type.id) ? current.filter((id) => id !== type.id) : [...current, type.id])} />
                <span>{type.name}</span>
              </label>
            ))}</div>
            {!data.business_storage_types.some((type) => type.active) && <p className="muted small">Ajoutez des types dans la rubrique Services.</p>}
          </section>}
          <label className="field"><span>Compte rendu / information</span><textarea rows="4" value={exchangeDraft.content} onChange={(event) => setExchangeDraft((draft) => ({ ...draft, content: event.target.value }))} /></label>
          {exchangeFormMode === 'create' && actionSuggestionAllowed && <div className="action-suggestion"><label><input type="checkbox" checked={makeAction} onChange={(event) => setMakeAction(event.target.checked)} /> Créer l’action proposée « {suggestedTitle} »</label>{makeAction && <div className="form-grid two-columns"><Field label="Action" value={actionTitle || suggestedTitle} onChange={setActionTitle} /><Field label="Échéance" type="datetime-local" value={actionDue} onChange={setActionDue} /></div>}</div>}
          {['information', 'observation', 'alert'].includes(exchangeDraft.entry_kind) && <p className="muted small">Ce contenu sera conservé dans le fil; aucune action n’est créée automatiquement.</p>}
          </fieldset>
          <div className="form-actions">
            {exchangeFormMode === 'edit' && <button className="button button-quiet" type="button" disabled={saving} onClick={() => openExchangeRecord(data.crm_exchanges.find((item) => item.id === editingExchangeId))}>Annuler</button>}
            {exchangeFormMode !== 'edit' && <button className="button button-quiet" type="button" onClick={() => { setDialog(''); setEditingExchangeId(null); }}>Fermer</button>}
            <span className="form-actions-spacer" />
            {exchangeFormMode === 'read' && <button className="button button-primary" type="button" onClick={() => setExchangeFormMode('edit')}><Pencil size={15} /> Modifier</button>}
            {exchangeFormMode !== 'read' && <button className="button button-primary" disabled={saving || !exchangeDraft.contact_id} type="submit">{saving ? 'Enregistrement…' : exchangeFormMode === 'edit' ? 'Enregistrer les modifications' : 'Enregistrer l’échange'}</button>}
          </div>
        </form>
      </Modal>}

      {dialog === 'document' && <Modal title={pricedDocument ? (documentDraft.document_type === 'final_invoice' ? 'Nouvelle facture finale' : 'Nouvelle facture pro forma') : 'Nouveau document Trade'} onClose={() => setDialog('')} className={pricedDocument ? 'invoice-editor-modal' : ''}>
        <form className={pricedDocument ? 'record-form invoice-editor-form' : 'record-form'} onSubmit={saveDocument}>
          {pricedDocument && <div className="invoice-editor-intro"><div><span className="reference-label">ESPACE DE FACTURATION</span><h3>{documentDraft.document_type === 'final_invoice' ? 'Préparez votre facture finale' : 'Préparez votre facture pro forma'}</h3><p>Ajoutez les articles et vérifiez les montants avant de générer le PDF.</p></div><span className="invoice-draft-pill"><i /> Brouillon</span></div>}
          <div className={pricedDocument ? 'invoice-editor-layout' : ''}><div className={pricedDocument ? 'invoice-editor-main' : ''}>
          <div className="form-grid two-columns">
            <SelectField label="Type" value={documentDraft.document_type} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, document_type: value }))} options={tradeDocumentTypes} />
            <SelectField label="Société émettrice" value={documentDraft.issuer_id} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, issuer_id: value }))} options={data.business_issuers.map((issuer) => [issuer.id, issuer.legal_name])} placeholder="Choisir la société émettrice" required />
            <SelectField label="Client / fournisseur" value={documentDraft.contact_id} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, contact_id: value, case_id: '', exchange_id: '', related_document_id: '' }))} options={data.network_contacts.map((person) => [person.id, contactLabel(person)])} placeholder="Choisir un contact" required />
            <SelectField label="Dossier associé" value={documentDraft.case_id} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, case_id: value, exchange_id: '' }))} options={documentCases.map((exchangeCase) => [exchangeCase.id, `${exchangeCase.title} · ${({ trade: 'Transaction', lead: 'Demande', open: 'Information' })[exchangeCase.category] || 'Dossier'}`])} placeholder="Aucun dossier" />
            <SelectField label="Destinataire" value={documentDraft.counterparty_role} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, counterparty_role: value }))} options={ [['customer', 'Client — document émis'], ['supplier', 'Fournisseur — document reçu'], ['other', 'Autre interlocuteur']] } />
            <p className="muted small">Le numéro séquentiel est attribué quand le document passe à « Envoyé » ou « Accepté ». Un brouillon ne consomme pas de numéro.</p>
            <Field label="Date" type="date" value={documentDraft.document_date} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, document_date: value }))} required />
            {documentCase && <small className="muted small">Ce document sera rattaché au dossier « {documentCase.title} » et apparaîtra dans son historique.</small>}
            <SelectField label="Échange de référence (facultatif)" value={documentDraft.exchange_id} onChange={(value) => setDocumentDraft((draft) => ({ ...draft, exchange_id: value }))} options={data.crm_exchanges.filter((item) => (!documentDraft.contact_id || item.contact_id === documentDraft.contact_id) && (!documentDraft.case_id || item.case_id === documentDraft.case_id)).map((item) => [item.id, `${displayDate(item.occurred_at)} · ${exchangeScenarioValues(item.scenario).map((scenario) => scenario.replaceAll('_', ' ')).join(' · ')}`])} placeholder="Aucun" />
            {['proforma', 'final_invoice', 'credit_note'].includes(documentDraft.document_type) && <SelectField label={documentDraft.document_type === 'credit_note' ? 'Facture concernée' : documentDraft.document_type === 'final_invoice' ? 'Pro forma d’origine' : 'Pro forma précédente (facultatif)'} value={documentDraft.related_document_id} onChange={(value) => { const sourceLines = value ? data.trade_document_lines.filter((line) => line.document_id === value).map((line) => ({ ...line })) : []; setDocumentDraft((draft) => ({ ...draft, related_document_id: value })); if (sourceLines.length) setDocumentLines(sourceLines); }} options={data.trade_documents.filter((item) => {
              const validTypes = documentDraft.document_type === 'credit_note'
                ? ['final_invoice']
                : documentDraft.document_type === 'final_invoice' ? ['proforma'] : ['proforma'];
              return validTypes.includes(item.document_type) && (!documentDraft.contact_id || item.contact_id === documentDraft.contact_id);
            }).map((item) => [item.id, `${item.document_number || item.document_type} · ${displayDate(item.document_date, false)}`])} placeholder="Aucun" />}
          </div>
          <label className="field"><span>Note / motif</span><textarea rows="2" value={documentDraft.notes} onChange={(event) => setDocumentDraft((draft) => ({ ...draft, notes: event.target.value }))} /></label>
          <label className="upload-row"><Upload size={16} /><span>{documentFile?.name || 'Joindre le document (PDF ou autre fichier)'}</span><input type="file" accept=".pdf,.csv,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /></label>
          {['proforma', 'final_invoice', 'credit_note'].includes(documentDraft.document_type) && <div className="business-lines"><h3>Lignes tarifées (prix non enregistrés sur les produits)</h3>
            {documentLines.map((line, index) => { const selectedService = line.item_type === 'service' ? data.business_services.find((service) => service.id === line.service_id) : null; return <div className="business-line" key={index}>
              <SelectField label="Nature" value={line.item_type} onChange={(value) => patchLine(index, 'item_type', value)} options={ [['product', 'Produit'], ['service', 'Service']] } />
          <SelectField label={line.item_type === 'product' ? 'Produit' : 'Prestation'} value={line.item_type === 'product' ? line.product_id : line.service_id} onChange={(value) => line.item_type === 'product' ? patchLine(index, 'product_id', value) : selectServiceForDocumentLine(index, value)} options={(line.item_type === 'product' ? data.products.map((product) => [product.id, product.designation]) : data.business_services.filter((service) => service.is_catalog_item || service.id === line.service_id).map((service) => [service.id, `${service.name}${service.internal_reference ? ` · ${service.internal_reference}` : ''}`]))} placeholder="Choisir" />
              {selectedService && (selectedService.request_fields || []).length > 0 && <section className="invoice-service-fields"><strong>Informations de la prestation</strong><div>{selectedService.request_fields.map((field) => field.type === 'location'
                ? <ServiceAddressFields key={field.key} field={field} value={line.service_details?.[field.key]} onChange={(value) => patchServiceDetail(index, field.key, value)} />
                : <Field key={field.key} label={field.label} type={['number', 'date'].includes(field.type) ? field.type : 'text'} value={line.service_details?.[field.key] || ''} onChange={(value) => patchServiceDetail(index, field.key, value)} required={Boolean(field.required)} />)}</div></section>}
              <Field label="Désignation document" value={line.description} onChange={(value) => patchLine(index, 'description', value)} />
              <div className="form-grid two-columns">
                <Field label={line.item_type === 'service' ? 'Nombre de forfaits' : 'Quantité'} type="number" min="0.001" step="any" value={line.quantity} onChange={(value) => patchLine(index, 'quantity', value)} required />
                <Field label={line.item_type === 'service' ? 'Prix du forfait HT (€)' : 'Prix unitaire HT (€)'} type="number" min="0" step="0.01" value={line.unit_price} onChange={(value) => patchLine(index, 'unit_price', value)} required />
              </div>
              <SelectField label="TVA / traitement" value={line.vat_treatment === 'domestic' ? `rate:${line.vat_rate}` : line.vat_treatment} onChange={(value) => {
                if (value.startsWith('rate:')) { patchLine(index, 'vat_treatment', 'domestic'); patchLine(index, 'vat_rate', value.slice(5)); }
                else { patchLine(index, 'vat_treatment', value); patchLine(index, 'vat_rate', '0'); }
              }} options={[
                ...frenchVatRates.map(([rate, label]) => [`rate:${rate}`, label]),
                ['intra_community_goods', 'Livraison intracommunautaire de biens — exonération (art. 262 ter I CGI)'],
                ['intra_community_services', 'Service B2B intracommunautaire — autoliquidation'],
                ['other_exemption', 'Autre exonération — motif à vérifier'],
              ]} />
              {line.vat_treatment === 'intra_community_services' && <small className="muted">Le client autoliquide généralement la TVA (art. 196 directive 2006/112/CE); ce n’est pas une exonération automatique. Vérifier le statut et le lieu d’imposition.</small>}
              <button className="button button-quiet button-small" type="button" disabled={documentLines.length === 1} onClick={() => setDocumentLines((lines) => lines.filter((_, lineIndex) => index !== lineIndex))}><Trash2 size={14} /> Retirer la ligne</button>
            </div>; })}
            <button className="button button-quiet" type="button" onClick={() => setDocumentLines((lines) => [...lines, emptyDocumentLine()])}><Plus size={15} /> Ajouter une ligne</button>
          </div>}
          </div>{pricedDocument && <aside className="invoice-editor-sidebar"><div className="invoice-live-preview"><div className="invoice-preview-label"><span>Aperçu du document</span><span><i /> Temps réel</span></div><div className="invoice-preview-sheet"><div className="invoice-preview-brand"><span>{documentIssuer?.legal_name?.slice(0, 2).toLocaleUpperCase('fr') || 'TB'}</span><strong>{documentIssuer?.legal_name || 'Votre société'}</strong></div><div className="invoice-preview-type"><strong>{documentDraft.document_type === 'final_invoice' ? 'FACTURE' : 'FACTURE PRO FORMA'}</strong><span>{documentDraft.document_number || 'Brouillon'}</span></div><div className="invoice-preview-recipient"><small>FACTURÉ À</small><strong>{documentContact ? contactLabel(documentContact) : 'Sélectionnez un client'}</strong><span>{documentCase?.title || 'Aucun dossier associé'}</span></div><div className="invoice-preview-items"><div><span>ARTICLE</span><span>TOTAL HT</span></div>{invoiceLines.slice(0, 4).map((line, index) => { const item = line.item_type === 'product' ? data.products.find((product) => product.id === line.product_id) : data.business_services.find((service) => service.id === line.service_id); return <div key={index}><span>{line.description || item?.designation || item?.name || 'Article'}<small>{line.quantity || 0} × {money(Number(line.unit_price || 0))}</small></span><strong>{money(Number(line.quantity || 0) * Number(line.unit_price || 0))}</strong></div>; })}{invoiceLines.length > 4 && <small>+ {invoiceLines.length - 4} autres lignes</small>}{!invoiceLines.length && <p>Les articles ajoutés apparaîtront ici.</p>}</div><div className="invoice-preview-total"><span>Total HT<strong>{money(invoiceSubtotal)}</strong></span><span>TVA<strong>{money(invoiceTax)}</strong></span><span className="invoice-preview-grand">{documentDraft.document_type === 'final_invoice' ? 'Total TTC' : 'Total estimatif TTC'}<strong>{money(invoiceTotal)}</strong></span></div><small className="invoice-preview-date">Date du document · {displayDate(documentDraft.document_date, false)}</small></div><p className="invoice-preview-caption">Aperçu de saisie. Contrôlez le PDF avant l’envoi au client.</p></div><div className="invoice-numbering-note"><FileText size={15} /><span>Le numéro définitif est attribué à l’émission. Le brouillon ne consomme aucun numéro.</span></div><button className="button button-quiet invoice-preview-button" type="button" disabled={!documentDraft.issuer_id || !documentDraft.contact_id || !invoiceLines.length} onClick={() => { try { printDocument(documentDraft, invoiceLines, data); } catch (error) { notify(error.message, true); } }}><FileDown size={15} /> Prévisualiser le PDF</button></aside>}
          <div className="form-actions invoice-editor-actions"><button className="button button-quiet" type="button" onClick={() => setDialog('')}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || !documentDraft.contact_id || !documentDraft.issuer_id || (pricedDocument && !invoiceLines.length)}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button></div></div>
        </form>
      </Modal>}

      {dialog === 'action-record' && <Modal title={actionRecordMode === 'create' ? 'Nouvelle fiche action' : actionRecordMode === 'edit' ? 'Modifier la fiche action' : actionDraft.title || 'Fiche action'} onClose={() => setDialog('')} className="action-record-modal">
        <form className="record-form" onSubmit={saveActionRecord}>
          {actionRecordMode === 'edit' && <div className="edit-mode-notice">Modifie les informations, puis enregistre la fiche.</div>}
          <fieldset className="action-record-fields" disabled={actionRecordMode === 'read' || saving}>
            <div className="form-grid two-columns">
              <SelectField label="Contact" value={actionDraft.contact_id} onChange={(contact_id) => setActionDraft((draft) => ({ ...draft, contact_id, exchange_id: data.crm_exchanges.some((exchange) => exchange.id === draft.exchange_id && exchange.contact_id === contact_id) ? draft.exchange_id : '' }))} options={data.network_contacts.map((contact) => [contact.id, contactLabel(contact)])} placeholder="Choisir un contact" required />
              <SelectField label="Échange de référence" value={actionDraft.exchange_id} onChange={(exchange_id) => setActionDraft((draft) => ({ ...draft, exchange_id }))} options={data.crm_exchanges.filter((exchange) => exchange.contact_id === actionDraft.contact_id).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).map((exchange) => [exchange.id, `${displayDate(exchange.occurred_at, false)} · ${exchangeScenarioValues(exchange.scenario).map((scenario) => scenario.replaceAll('_', ' ')).join(', ')}`])} placeholder="Choisir l’échange lié" required />
              <Field label="Titre de l’action" value={actionDraft.title} onChange={(title) => setActionDraft((draft) => ({ ...draft, title }))} required maxLength={180} />
              <Field label="Échéance" type="datetime-local" value={actionDraft.due_at} onChange={(due_at) => setActionDraft((draft) => ({ ...draft, due_at }))} />
              <SelectField label="Priorité" value={actionDraft.priority} onChange={(priority) => setActionDraft((draft) => ({ ...draft, priority }))} options={ [['low', 'Basse'], ['normal', 'Normale'], ['high', 'Haute']] } />
              <SelectField label="Statut" value={actionDraft.status} onChange={(status) => setActionDraft((draft) => ({ ...draft, status }))} options={ [['todo', 'À faire'], ['in_progress', 'En cours'], ['waiting', 'En attente'], ['done', 'Terminée'], ['cancelled', 'Annulée']] } />
              <Field label="Responsable" value={actionDraft.assignee || ''} onChange={(assignee) => setActionDraft((draft) => ({ ...draft, assignee }))} maxLength={120} />
            </div>
            <label className="field"><span>Détails de l’action</span><textarea rows="4" value={actionDraft.description || ''} onChange={(event) => setActionDraft((draft) => ({ ...draft, description: event.target.value }))} /></label>
            <label className="field"><span>Résultat / compte rendu</span><textarea rows="3" value={actionDraft.result || ''} onChange={(event) => setActionDraft((draft) => ({ ...draft, result: event.target.value }))} /></label>
          </fieldset>
          {actionRecordMode === 'read' ? <div className="form-actions">
            <button className="button button-quiet" type="button" onClick={() => setDialog('')}>Fermer</button>
            <span className="form-actions-spacer" />
            {actionDraft.status !== 'cancelled' && <button className="button button-quiet" type="button" onClick={() => setActionStatus(actionDraft, 'cancelled')}>Annuler l’action</button>}
            <button className="button button-quiet" type="button" onClick={deleteActionRecord}><Trash2 size={14} /> Supprimer</button>
            <button className="button button-primary" type="button" onClick={() => setActionRecordMode('edit')}><Pencil size={14} /> Modifier</button>
          </div> : <div className="form-actions">
            <button className="button button-quiet" type="button" disabled={saving} onClick={() => actionDraft.id ? setActionRecordMode('read') : setDialog('')}>Annuler</button>
            <span className="form-actions-spacer" />
            <button className="button button-primary" type="submit" disabled={saving || !actionDraft.contact_id || !actionDraft.exchange_id || !actionDraft.title.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button>
          </div>}
        </form>
      </Modal>}

      {dialog === 'payment' && <Modal title="Enregistrer un paiement réel" onClose={() => setDialog('')}>
        <form className="record-form" onSubmit={savePayment}>
          <div className="form-grid two-columns">
            <SelectField label="Contact" value={paymentDraft.contact_id} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, contact_id: value, case_id: '', document_id: '', exchange_id: '' }))} options={data.network_contacts.map((person) => [person.id, contactLabel(person)])} placeholder="Choisir un contact" required />
            <SelectField label="Dossier associé" value={paymentDraft.case_id} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, case_id: value, exchange_id: '' }))} options={data.crm_exchange_cases.filter((exchangeCase) => !paymentDraft.contact_id || exchangeCase.contact_id === paymentDraft.contact_id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === exchangeCase.id && link.contact_id === paymentDraft.contact_id)).map((exchangeCase) => [exchangeCase.id, exchangeCase.title])} placeholder="Aucun" />
            <SelectField label="Rôle du contact" value={paymentDraft.counterparty_role} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, counterparty_role: value }))} options={ [['customer', 'Client'], ['supplier', 'Fournisseur'], ['other', 'Autre']] } />
            <SelectField label="Sens" value={paymentDraft.direction} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, direction: value }))} options={ [['incoming', 'Entrant'], ['outgoing', 'Sortant']] } />
            <Field label="Montant (€)" type="number" min="0.01" step="0.01" value={paymentDraft.amount} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, amount: value }))} required />
            <Field label="Date" type="date" value={paymentDraft.payment_date} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, payment_date: value }))} required />
            <SelectField label="Moyen" value={paymentDraft.payment_method} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, payment_method: value, bank_account_id: '' }))} options={ [['cash', 'Espèces'], ['bank_transfer', 'Virement'], ['card', 'Carte bancaire']] } />
            {paymentDraft.payment_method === 'bank_transfer' && <SelectField label="Compte bancaire" value={paymentDraft.bank_account_id} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, bank_account_id: value }))} options={data.business_bank_accounts.filter((account) => account.active).map((account) => [account.id, account.name])} placeholder="Choisir le compte" />}
             <SelectField label="Document associé" value={paymentDraft.document_id} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, document_id: value }))} options={data.trade_documents.filter((documentRecord) => (!paymentDraft.contact_id || documentRecord.contact_id === paymentDraft.contact_id) && (!paymentDraft.case_id || documentRecord.case_id === paymentDraft.case_id)).map((documentRecord) => [documentRecord.id, `${documentRecord.document_number || documentRecord.document_type} · ${displayDate(documentRecord.document_date, false)}`])} placeholder="Aucun" />
          </div>
          <Field label="Note" value={paymentDraft.notes} onChange={(value) => setPaymentDraft((draft) => ({ ...draft, notes: value }))} />
          <div className="form-actions"><button className="button button-quiet" type="button" onClick={() => setDialog('')}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || !paymentDraft.contact_id || (paymentDraft.payment_method === 'bank_transfer' && !paymentDraft.bank_account_id)}>Enregistrer le paiement reçu/effectué</button></div>
        </form>
      </Modal>}

      {dialog === 'expense' && <Modal title="Enregistrer une dépense" onClose={() => setDialog('')}>
        <form className="record-form" onSubmit={saveExpense}>
          <div className="form-grid two-columns">
            <Field label="Montant (€)" type="number" min="0" step="0.01" value={expenseDraft.amount} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, amount: value }))} required />
            <Field label="Date" type="date" value={expenseDraft.expense_date} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, expense_date: value }))} required />
            <Field label="Catégorie" value={expenseDraft.category} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, category: value }))} required />
             <SelectField label="Contact (facultatif)" value={expenseDraft.contact_id} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, contact_id: value, case_id: '' }))} options={data.network_contacts.map((person) => [person.id, contactLabel(person)])} placeholder="Aucun" />
             <SelectField label="Dossier associé" value={expenseDraft.case_id} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, case_id: value }))} options={data.crm_exchange_cases.filter((exchangeCase) => !expenseDraft.contact_id || exchangeCase.contact_id === expenseDraft.contact_id || (data.crm_exchange_case_contacts || []).some((link) => link.case_id === exchangeCase.id && link.contact_id === expenseDraft.contact_id)).map((exchangeCase) => [exchangeCase.id, exchangeCase.title])} placeholder="Aucun" />
            <SelectField label="Moyen de paiement" value={expenseDraft.payment_method} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, payment_method: value }))} options={ [['', 'Non précisé'], ['cash', 'Espèces'], ['bank_transfer', 'Virement'], ['card', 'Carte bancaire']] } />
          </div>
          <Field label="Description" value={expenseDraft.description} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, description: value }))} />
          <Field label="Informations utiles" value={expenseDraft.information} onChange={(value) => setExpenseDraft((draft) => ({ ...draft, information: value }))} />
          <label className="upload-row"><Upload size={16} /><span>{receiptFile?.name || 'Joindre le justificatif de cette dépense'}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} /></label>
          <div className="form-actions"><button className="button button-quiet" type="button" onClick={() => setDialog('')}>Annuler</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la dépense'}</button></div>
        </form>
      </Modal>}
    </>
  );
}
