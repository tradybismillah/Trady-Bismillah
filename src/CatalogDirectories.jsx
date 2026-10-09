import { useEffect, useMemo, useState } from 'react';
import { Building2, ImagePlus, Pencil, Plus, Search, Tags, Trash2, Upload, X } from 'lucide-react';
import { MediaPicker } from './MediaLibrary.jsx';
import ModalBackdrop from './ModalA11y.jsx';

const brandDefaults = {
  name: '', description: '', country_of_origin: '', creation_year: '',
  owner_manufacturer_id: '', email: '', website: '', logo_url: '',
};

const manufacturerDefaults = {
  legal_name: '', country: '', region: '', city: '', address: '', postal_code: '',
  website: '', phone_country_code: '', phone_number: '', email: '', logo_url: '',
};

function safeImageName(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function uploadLogo(client, file, folder) {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError) throw authError;
  if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
  const path = `${auth.session.user.id}/${folder}/${crypto.randomUUID()}-${safeImageName(file.name)}`;
  const { error } = await client.storage.from('catalogue-media').upload(path, file, { upsert: false });
  if (error) throw error;
  const { error: mediaError } = await client.from('media_assets').insert({
    storage_path: path,
    file_name: file.name,
    folder: folder === 'brands' ? 'Marques' : 'Fabricants',
    mime_type: file.type,
    file_size: file.size,
  });
  if (mediaError) {
    await client.storage.from('catalogue-media').remove([path]);
    throw mediaError;
  }
  return path;
}

function Logo({ src, alt, small = false }) {
  if (src) return <img className={small ? 'brand-logo' : 'directory-logo'} src={src} alt={alt} />;
  return <span className={`brand-logo-empty${small ? '' : ' directory-logo-empty'}`} aria-label={`Pas de photo pour ${alt}`}>
    {alt ? alt.slice(0, 1).toUpperCase() : <ImagePlus size={18} />}
  </span>;
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} /></label>;
}

export default function CatalogDirectory({ kind, data, client, onRefresh, notify }) {
  const isBrand = kind === 'brands';
  const rows = isBrand ? data.brands : data.manufacturers;
  const title = isBrand ? 'Marques' : 'Fabricants';
  const table = isBrand ? 'brands' : 'manufacturers';
  const displayName = (row) => isBrand ? row.name : row.legal_name;
  const defaults = isBrand ? brandDefaults : manufacturerDefaults;
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(defaults);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(data.mediaUrls?.[(editing || draft).logo_url] || '');
      return undefined;
    }
    const preview = URL.createObjectURL(photo);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo, editing, draft.logo_url, data.mediaUrls]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const text = [displayName(row), row.country, row.country_of_origin, row.city, row.email, row.website]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase());
  }).sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr')), [rows, search]);

  const openNew = () => {
    setEditing(null);
    setDraft({ ...defaults });
    setPhoto(null);
    setIsOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDraft({ ...defaults, ...row, creation_year: row.creation_year ?? '' });
    setPhoto(null);
    setIsOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    let uploadedPath = null;
    try {
      if (photo && photo.size > 20 * 1024 * 1024) throw new Error('Le logo ne peut pas dépasser 20 Mo.');
      const values = { ...draft };
      if (isBrand) {
        values.creation_year = values.creation_year ? Number(values.creation_year) : null;
        values.owner_manufacturer_id = values.owner_manufacturer_id || null;
      }
      if (photo) {
        uploadedPath = await uploadLogo(client, photo, isBrand ? 'brands' : 'manufacturers');
        values.logo_url = uploadedPath;
      }
      const result = editing
        ? await client.from(table).update(values).eq('id', editing.id)
        : await client.from(table).insert(values);
      if (result.error) throw result.error;
      setEditing(null);
      setPhoto(null);
      setIsOpen(false);
      await onRefresh();
      notify(`${title.slice(0, -1)} ${editing ? 'modifié' : 'ajouté'}${isBrand ? 'e' : ''}.`);
    } catch (error) {
      if (uploadedPath) {
        await client.from('media_assets').delete().eq('storage_path', uploadedPath);
        await client.storage.from('catalogue-media').remove([uploadedPath]);
      }
      notify(`Enregistrement impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Supprimer ${displayName(row)} ?`)) return;
    const { error } = await client.from(table).delete().eq('id', row.id);
    if (error) notify(`Suppression impossible : ${error.message}`, true);
    else {
      notify(`${title.slice(0, -1)} supprimé${isBrand ? 'e' : ''}.`);
      await onRefresh();
    }
  };

  const getImage = (row) => data.mediaUrls?.[row.logo_url] || (String(row.logo_url || '').startsWith('http') ? row.logo_url : '');
  const getProductCount = (row) => data.products.filter((product) => isBrand
    ? product.brand_id === row.id
    : product.manufacturer_id === row.id).length;
  return <section className="directory-section">
    <div className="section-header">
      <div><p className="eyebrow">CATALOGUE</p><h1>{title}</h1><p className="muted">Fiches, photos et produits associés.</p></div>
      <button className="button button-primary" type="button" onClick={openNew}><Plus size={16} /> Ajouter {isBrand ? 'une marque' : 'un fabricant'}</button>
    </div>

    <div className="table-tools">
      <label className="search-input"><Search size={16} /><input aria-label={`Rechercher ${title.toLocaleLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Rechercher ${title.toLocaleLowerCase()}…`} /></label>
      <span className="result-count">{filteredRows.length} résultat{filteredRows.length > 1 ? 's' : ''} sur {rows.length}</span>
    </div>

    {filteredRows.length === 0 ? <div className="empty-state"><span className="empty-icon">{isBrand ? <Tags size={22} /> : <Building2 size={22} />}</span><h2>{rows.length ? 'Aucun résultat' : `Aucun${isBrand ? 'e' : ''} ${title.slice(0, -1).toLocaleLowerCase()} enregistré${isBrand ? 'e' : ''}`}</h2><p>Les fiches que tu ajoutes ici sont enregistrées dans le catalogue.</p>{!rows.length && <button type="button" className="button button-primary" onClick={openNew}><Plus size={15} /> Créer une fiche</button>}</div> : <div className="product-table-scroll directory-table-scroll"><table className="product-table directory-table"><thead><tr>
      <th>Photo</th><th>{isBrand ? 'Marque' : 'Fabricant'}</th>{isBrand ? <><th>Pays d’origine</th><th>Maison mère</th></> : <><th>Pays</th><th>Ville</th></>}<th>Produits</th><th>Contact</th><th>Site web</th><th>Actions</th>
    </tr></thead><tbody>{filteredRows.map((row) => {
      const owner = data.manufacturers.find((manufacturer) => manufacturer.id === row.owner_manufacturer_id);
      return <tr key={row.id}>
        <td><Logo src={getImage(row)} alt={displayName(row)} small /></td>
        <td><button type="button" className="table-product-link" onClick={() => setSelectedRow(row)}>{displayName(row)}</button>{isBrand && row.description && <small className="directory-description">{row.description}</small>}</td>
        {isBrand ? <><td>{row.country_of_origin || '—'}</td><td>{owner?.legal_name || '—'}</td></> : <><td>{row.country || '—'}</td><td>{[row.city, row.region].filter(Boolean).join(', ') || '—'}</td></>}
        <td>{getProductCount(row)}</td>
        <td>{row.email || row.phone_number || '—'}</td>
        <td>{row.website ? <a href={row.website.startsWith('http') ? row.website : `https://${row.website}`} target="_blank" rel="noreferrer">{row.website}</a> : '—'}</td>
        <td><div className="product-table-actions"><button type="button" className="icon-button" onClick={() => openEdit(row)} aria-label={`Modifier ${displayName(row)}`} title="Modifier"><Pencil size={15} /></button><button type="button" className="icon-button danger-icon" onClick={() => remove(row)} aria-label={`Supprimer ${displayName(row)}`} title="Supprimer"><Trash2 size={15} /></button></div></td>
      </tr>;
    })}</tbody></table></div>}

    {selectedRow && <ModalBackdrop onClose={() => setSelectedRow(null)}><section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="directory-detail-title"><div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{isBrand ? <Tags size={18} /> : <Building2 size={18} />}</span><h2 id="directory-detail-title">{displayName(selectedRow)}</h2></div><button type="button" className="icon-button" onClick={() => setSelectedRow(null)} aria-label="Fermer"><X size={17} /></button></div><div className="directory-detail-layout"><Logo src={getImage(selectedRow)} alt={displayName(selectedRow)} /><div className="network-detail-grid">{(isBrand ? [['Pays d’origine', selectedRow.country_of_origin], ['Année de création', selectedRow.creation_year], ['Maison mère', data.manufacturers.find((manufacturer) => manufacturer.id === selectedRow.owner_manufacturer_id)?.legal_name], ['E-mail', selectedRow.email], ['Site web', selectedRow.website], ['Description', selectedRow.description]] : [['Pays', selectedRow.country], ['Région', selectedRow.region], ['Ville', selectedRow.city], ['Adresse', selectedRow.address], ['Code postal', selectedRow.postal_code], ['Téléphone', [selectedRow.phone_country_code, selectedRow.phone_number].filter(Boolean).join(' ')], ['E-mail', selectedRow.email], ['Site web', selectedRow.website]]).map(([label, value]) => <div className="network-detail-item" key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div></div><div className="network-related-contacts"><h3>Produits associés <span className="result-count">{getProductCount(selectedRow)}</span></h3>{data.products.filter((product) => isBrand ? product.brand_id === selectedRow.id : product.manufacturer_id === selectedRow.id).slice(0, 12).map((product) => <p key={product.id}>{product.designation} <small>{product.internal_reference || ''}</small></p>)}</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setSelectedRow(null)}>Fermer</button><button type="button" className="button button-primary" onClick={() => { const row = selectedRow; setSelectedRow(null); openEdit(row); }}>Modifier la fiche</button></div></section></ModalBackdrop>}
    {isOpen && <ModalBackdrop onClose={() => { if (!saving) { setIsOpen(false); setEditing(null); setDraft({ ...defaults }); setPhoto(null); } }}>
      <section className="modal-card modal-wide directory-modal" role="dialog" aria-modal="true" aria-labelledby="directory-form-title">
        <div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon">{isBrand ? <Tags size={18} /> : <Building2 size={18} />}</span><h2 id="directory-form-title">{editing ? 'Modifier la fiche' : `Nouvelle fiche ${isBrand ? 'marque' : 'fabricant'}`}</h2></div><button className="icon-button" type="button" onClick={() => { setIsOpen(false); setEditing(null); setDraft({ ...defaults }); setPhoto(null); }} aria-label="Fermer"><X size={17} /></button></div>
        <form className="record-form" onSubmit={save}>
          <div className="directory-form-layout">
            <div className="directory-photo-control"><label className="photo-field directory-photo-field"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setPhoto(event.target.files?.[0] || null); setDraft((current) => ({ ...current, logo_url: '' })); }} /><span className="photo-file-label">{photoPreview ? <img src={photoPreview} alt="Aperçu du logo" /> : <ImagePlus size={22} />}<strong>{photo ? photo.name : 'Ajouter un logo'}</strong><small>JPEG, PNG, WebP ou AVIF, max. 20 Mo</small></span><span className="button button-quiet"><Upload size={14} /> Choisir une image</span></label><button type="button" className="button button-quiet button-small" onClick={() => setShowMediaPicker(true)}><ImagePlus size={14} /> Choisir dans la médiathèque</button></div>
            <div className="directory-form-fields">
              {isBrand ? <>
                <Field label="Nom de la marque" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} required />
                <div className="form-grid two-columns"><Field label="Pays d’origine" value={draft.country_of_origin} onChange={(value) => setDraft({ ...draft, country_of_origin: value })} /><Field label="Année de création" type="number" value={draft.creation_year} onChange={(value) => setDraft({ ...draft, creation_year: value })} /></div>
                <label className="field"><span>Fabricant propriétaire</span><select value={draft.owner_manufacturer_id || ''} onChange={(event) => setDraft({ ...draft, owner_manufacturer_id: event.target.value })}><option value="">Aucun fabricant renseigné</option>{data.manufacturers.map((manufacturer) => <option value={manufacturer.id} key={manufacturer.id}>{manufacturer.legal_name}</option>)}</select></label>
                <label className="field"><span>Description</span><textarea rows="3" value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
                <div className="form-grid two-columns"><Field label="E-mail" type="email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} /><Field label="Site web" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} /></div>
              </> : <>
                <Field label="Nom légal du fabricant" value={draft.legal_name} onChange={(value) => setDraft({ ...draft, legal_name: value })} required />
                <div className="form-grid three-columns"><Field label="Pays" value={draft.country} onChange={(value) => setDraft({ ...draft, country: value })} /><Field label="Région" value={draft.region} onChange={(value) => setDraft({ ...draft, region: value })} /><Field label="Ville" value={draft.city} onChange={(value) => setDraft({ ...draft, city: value })} /></div>
                <div className="form-grid two-columns"><Field label="Adresse" value={draft.address} onChange={(value) => setDraft({ ...draft, address: value })} /><Field label="Code postal" value={draft.postal_code} onChange={(value) => setDraft({ ...draft, postal_code: value })} /></div>
                <div className="form-grid two-columns"><Field label="E-mail" type="email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} /><Field label="Site web" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} /></div>
                <div className="form-grid two-columns"><Field label="Indicatif" value={draft.phone_country_code} onChange={(value) => setDraft({ ...draft, phone_country_code: value })} placeholder="+33" /><Field label="Téléphone" type="tel" value={draft.phone_number} onChange={(value) => setDraft({ ...draft, phone_number: value })} /></div>
              </>}
            </div>
          </div>
          <div className="modal-actions"><button className="button button-quiet" type="button" disabled={saving} onClick={() => { setIsOpen(false); setEditing(null); setDraft({ ...defaults }); setPhoto(null); }}>Annuler</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer la fiche'}</button></div>
        </form>
      </section>
    </ModalBackdrop>}
    {showMediaPicker && <MediaPicker data={data} onClose={() => setShowMediaPicker(false)} onSelect={(asset) => { setDraft((current) => ({ ...current, logo_url: asset.storage_path })); setPhoto(null); setShowMediaPicker(false); }} />}
  </section>;
}
