import { useMemo, useState } from 'react';
import { Building2, ContactRound, ImagePlus, MapPin, Plus, Search, Upload, X } from 'lucide-react';
import { MediaPicker } from './MediaLibrary.jsx';
import ModalBackdrop from './ModalA11y.jsx';
import Tabs from './Tabs.jsx';

const contactDefaults = { profile: 'individual', first_name: '', last_name: '', job_role: '', country: '', region: '', city: '', postal_code: '', address: '', phone_country_code: '', phone_number: '', mobile_country_code: '', mobile_number: '', whatsapp_country_code: '', whatsapp_number: '', facebook_messenger_url: '', linkedin_messenger_url: '', email: '', contact_source: '', company_id: '' };
const companyDefaults = { name: '', country: '', legal_identifiers: {}, headquarters_region: '', headquarters_city: '', headquarters_postal_code: '', headquarters_address: '', phone_country_code: '', phone_number: '', email: '', website: '', main_activity: '', secondary_activities: '', purchase_sales_zones: [] };
const contactFields = [['first_name', 'Prénom'], ['last_name', 'Nom'], ['job_role', 'Fonction'], ['email', 'E-mail'], ['phone_number', 'Téléphone'], ['mobile_number', 'Mobile'], ['whatsapp_number', 'WhatsApp'], ['country', 'Pays'], ['region', 'Région'], ['city', 'Ville'], ['postal_code', 'Code postal'], ['address', 'Adresse'], ['contact_source', 'Origine du contact']];
const companyFields = [['name', 'Nom de la société'], ['country', 'Pays'], ['headquarters_region', 'Région du siège'], ['headquarters_city', 'Ville du siège'], ['headquarters_postal_code', 'Code postal'], ['headquarters_address', 'Adresse du siège'], ['phone_number', 'Téléphone'], ['email', 'E-mail'], ['website', 'Site web'], ['main_activity', 'Activité principale'], ['secondary_activities', 'Activités secondaires']];

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

export default function NetworkWorkspace({ data, client, onRefresh, notify }) {
  const [tab, setTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPath, setPhotoPath] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const companies = data.network_companies || [];
  const contacts = data.network_contacts || [];
  const rows = useMemo(() => (tab === 'contacts' ? contacts : companies).filter((row) => {
    const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id)?.name : '';
    return `${tab === 'contacts' ? `${row.first_name} ${row.last_name} ${row.job_role}` : row.name} ${company || ''} ${row.email || ''} ${row.city || row.headquarters_city || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [tab, contacts, companies, search]);
  const contactsFor = (company) => contacts.filter((contact) => contact.company_id === company.id);
  const startNew = (kind) => { setSelected(null); setEditing(kind); setDraft({ ...(kind === 'company' ? companyDefaults : contactDefaults) }); setPhotoFile(null); setPhotoPath(''); };
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
  const detailKind = selected?.kind;
  const detail = selected?.row;

  return <section className="directory-section network-directory">
    <div className="section-header"><div><p className="eyebrow">CRM</p><h1>Réseau</h1><p className="muted">Fiches contacts et sociétés, consultables et modifiables.</p></div><button className="button button-primary" type="button" onClick={() => startNew(tab === 'contacts' ? 'contact' : 'company')}><Plus size={16} /> Ajouter {tab === 'contacts' ? 'un contact' : 'une société'}</button></div>
    <Tabs className="network-tabs" label="Type de fiche" value={tab} onChange={setTab} tabs={[{ value: 'contacts', label: 'Contacts', count: contacts.length, icon: <ContactRound size={15} /> }, { value: 'companies', label: 'Sociétés', count: companies.length, icon: <Building2 size={15} /> }]} />
    <div className="table-tools"><label className="search-input"><Search size={16} /><input type="search" placeholder={`Rechercher ${tab === 'contacts' ? 'un contact, une société' : 'une société'}…`} value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="result-count">{rows.length} fiche{rows.length > 1 ? 's' : ''} sur {(tab === 'contacts' ? contacts : companies).length}</span></div>
    {!rows.length ? <div className="empty-state"><span className="empty-icon">{tab === 'contacts' ? <ContactRound size={22} /> : <Building2 size={22} />}</span><h2>Aucune fiche trouvée</h2><p>Ajoute une fiche pour commencer à organiser ton réseau.</p><button className="button button-primary" type="button" onClick={() => startNew(tab === 'contacts' ? 'contact' : 'company')}><Plus size={15} /> Ajouter une fiche</button></div> : <div className="record-grid">{rows.map((row) => {
      const company = tab === 'contacts' ? companies.find((entry) => entry.id === row.company_id) : null;
      const name = tab === 'contacts' ? `${row.first_name || ''} ${row.last_name || ''}`.trim() : row.name;
      const count = tab === 'contacts' ? null : contactsFor(row).length;
      const photo = tab === 'contacts' && row.contact_photo_path ? data.mediaUrls?.[row.contact_photo_path] : '';
      return <article className="record-card network-record-card" key={row.id} role="button" tabIndex={0} onClick={() => setSelected({ kind: tab === 'contacts' ? 'contact' : 'company', row })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected({ kind: tab === 'contacts' ? 'contact' : 'company', row }); } }}>{photo ? <img className="network-avatar network-avatar-photo" src={photo} alt="" /> : <span className="network-avatar">{tab === 'contacts' ? <ContactRound size={19} /> : <Building2 size={19} />}</span>}<div className="record-card-body"><span className="reference-label">{tab === 'contacts' ? (row.profile === 'professional' ? 'PROFESSIONNEL' : 'PARTICULIER') : 'SOCIÉTÉ'}</span><h3>{name || 'Sans nom'}</h3><p>{tab === 'contacts' ? [row.job_role, company?.name].filter(Boolean).join(' · ') || row.email || 'Contact' : row.main_activity || row.email || 'Société du réseau'}</p><div className="card-meta"><span>{tab === 'contacts' ? [row.city, row.country].filter(Boolean).join(', ') || 'Coordonnées à renseigner' : `${count} contact${count > 1 ? 's' : ''}`}</span><span>{row.email || ''}</span></div></div></article>;
    })}</div>}

    {detail && <ModalBackdrop onClose={() => setSelected(null)}><section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="network-detail-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{detailKind === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-detail-title">{detailKind === 'company' ? detail.name : `${detail.first_name} ${detail.last_name}`}</h2></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><X size={17} /></button></div><p className="eyebrow">FICHE {detailKind === 'company' ? 'SOCIÉTÉ' : detail.profile === 'professional' ? 'PROFESSIONNEL' : 'CONTACT'}</p><div className="network-detail-grid">{(detailKind === 'company' ? companyFields : contactFields).map(([key, label]) => <div className="network-detail-item" key={key}><small>{label}</small><strong>{valueFor(detail, key)}</strong></div>)}</div>{detailKind === 'contact' && detail.company_id && <p className="network-detail-company"><Building2 size={15} /> {companies.find((entry) => entry.id === detail.company_id)?.name || 'Société associée'}</p>}<NetworkAssociations kind={detailKind} row={detail} data={data} />{detailKind === 'company' && <div className="network-related-contacts"><h3>Contacts associés</h3>{contactsFor(detail).length ? contactsFor(detail).map((contact) => <button type="button" key={contact.id} onClick={() => setSelected({ kind: 'contact', row: contact })}>{contact.first_name} {contact.last_name}<small>{contact.job_role || contact.email}</small></button>) : <p>Aucun contact associé. Une société peut exister sans contact nominatif.</p>}</div>}<div className="modal-actions"><button className="button button-danger-ghost" type="button" onClick={() => remove(detail, detailKind)}>Supprimer</button><button className="button button-quiet" type="button" onClick={() => setSelected(null)}>Fermer</button><button className="button button-primary" type="button" onClick={() => startEdit(detail, detailKind)}>Modifier la fiche</button></div></section></ModalBackdrop>}

    {editing && draft && <ModalBackdrop onClose={() => { if (!saving) { setEditing(null); setDraft(null); } }}><section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="network-form-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{editing === 'company' ? <Building2 size={18} /> : <ContactRound size={18} />}</span><h2 id="network-form-title">{draft.id ? 'Modifier la fiche' : `Nouvelle fiche ${editing === 'company' ? 'société' : 'contact'}`}</h2></div><button type="button" className="icon-button" onClick={() => { setEditing(null); setDraft(null); }} aria-label="Fermer"><X size={17} /></button></div><form className="record-form" onSubmit={save}>{editing === "contact" && <div className="contact-photo-tools">{photoPath && data.mediaUrls?.[photoPath] ? <img src={data.mediaUrls[photoPath]} alt="Portrait du contact" /> : <span><ImagePlus size={20} /></span>}<label className="button button-quiet button-small"><Upload size={13} /> Importer une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setPhotoFile(event.target.files?.[0] || null); }} /></label><button type="button" className="button button-quiet button-small" onClick={() => setShowMediaPicker(true)}>Choisir dans la médiathèque</button>{photoFile && <small>{photoFile.name}</small>}</div>}{editing === 'contact' && <label className="field"><span>Type de contact</span><select value={draft.company_id ? 'professional' : draft.profile} onChange={(event) => setDraft((current) => ({ ...current, profile: event.target.value, company_id: event.target.value === 'individual' ? '' : current.company_id }))}><option value="individual">Particulier</option><option value="professional">Professionnel</option></select></label>}{editing === 'contact' && <div className="form-grid two-columns"><Field label="Prénom" value={draft.first_name} onChange={(value) => setDraft((d) => ({ ...d, first_name: value }))} /><Field label="Nom" value={draft.last_name} onChange={(value) => setDraft((d) => ({ ...d, last_name: value }))} /></div>}{editing === 'contact' && draft.profile === 'professional' && <label className="field"><span>Société</span><select value={draft.company_id || ''} onChange={(event) => setDraft((d) => ({ ...d, company_id: event.target.value }))}><option value="">Aucune société</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>}<div className="form-grid two-columns">{(editing === 'contact' ? contactFields.filter(([key]) => !['first_name', 'last_name'].includes(key)) : companyFields).map(([key, label]) => <Field key={key} label={label} type={key === 'email' ? 'email' : 'text'} multiline={key === 'address' || key === 'headquarters_address'} value={draft[key]} onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} />)}</div><div className="modal-actions"><button className="button button-quiet" type="button" disabled={saving} onClick={() => { setEditing(null); setDraft(null); }}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || (editing === 'contact' && !draft.last_name) || (editing === 'company' && !draft.name)}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div></form></section></ModalBackdrop>}
    {showMediaPicker && <MediaPicker data={data} onClose={() => setShowMediaPicker(false)} onSelect={(asset) => { setPhotoFile(null); setPhotoPath(asset.storage_path); setShowMediaPicker(false); }} />}
  </section>;
}
