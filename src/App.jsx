import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import Country from 'country-state-city/lib/country';
import UniversalMultiSelect from './UniversalMultiSelect.jsx';
import { numberFromSource, parseTabularProducts, sourceSubunit } from './lib/productImport.js';
import { exchangeProductStoredRates, exchangeProductTotal, formatExchangeCurrency } from './lib/exchangePricing.js';
import { exchangeScenarioValues, hasExchangeScenario } from './lib/exchangeScenarios.js';
import CatalogDirectory from './CatalogDirectories.jsx';
import MediaLibrary, { MediaPicker } from './MediaLibrary.jsx';
import NetworkWorkspace from './NetworkWorkspace.jsx';
import ModalBackdrop from './ModalA11y.jsx';
import Tabs from './Tabs.jsx';

import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Building2, Check, ChevronDown, CircleHelp, ContactRound, Database, Factory,
  BriefcaseBusiness, CheckSquare, FileDown, FileText, Grid2X2, ImagePlus, Images, Leaf, List, LoaderCircle, LogOut, Menu, Package, Plus,
  Pencil, Search, Settings2, Share2, Tags, Trash2, Upload, X,
} from 'lucide-react';

const ProductPdfExport = lazy(() => import('./ProductPdfExport.jsx'));
const BusinessWorkspace = lazy(() => import('./BusinessWorkspace.jsx'));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey && !supabaseUrl.includes('VOTRE-NOUVEAU-PROJET')
    ? createClient(supabaseUrl, supabaseKey)
    : null;
const authorizedEmail = 'tradybismillah@gmail.com';

// Empty states
const emptyProduct = {
  designation: '', ean_gtin: '', brand_id: '', manufacturer_id: '', product_origin: '',
  category_id: '', subcategory_id: '', subcategory_item_id: '', uvc_type_id: '', sub_uvc_type_id: '',
  quantity_sub_uvc: '', quantity_sub_uvc_unit: 'unité', uvc_length_cm: '', uvc_width_cm: '', uvc_height_cm: '',
  uvc_gross_weight_kg: '', pcb_type_id: '', quantity_uvc_pcb: '', pcb_length_cm: '',
  pcb_width_cm: '', pcb_height_cm: '', pcb_gross_weight_kg: '', palette_type_id: '',
  quantity_pcb_palette: '', palette_length_cm: '', palette_width_cm: '',
  palette_height_cm: '', palette_gross_weight_kg: '',
};

const emptyBrand = {
  name: '', description: '', country_of_origin: '', creation_year: '',
  owner_manufacturer_id: '', email: '', website: '',
};

const emptyManufacturer = {
  legal_name: '', country: '', region: '', city: '', address: '', postal_code: '',
  website: '', phone_country_code: '', phone_number: '', email: '',
};

// Products Section Component
function ProductsSection({ data, loadData, onPdfExport, notify, supabase }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');
  const [layout, setLayout] = useState('table');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingPhotos, setEditingPhotos] = useState(null);
  const [openedProduct, setOpenedProduct] = useState(null);

  const filteredProducts = data.products.filter(product => {
    const query = searchTerm.toLocaleLowerCase();
    const matchesSearch = [product.designation, product.internal_reference, product.ean_gtin]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesBrand = selectedBrand === 'all' || product.brand_id === selectedBrand;
    const matchesManufacturer = selectedManufacturer === 'all' || product.manufacturer_id === selectedManufacturer;
    return matchesSearch && matchesCategory && matchesBrand && matchesManufacturer;
  });
  const allSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));
  const toggleProduct = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => allSelected
    ? current.filter((id) => !filteredProducts.some((product) => product.id === id))
    : [...new Set([...current, ...filteredProducts.map((product) => product.id)])]);
  const imageFor = (path) => data.mediaUrls?.[path] || (String(path || '').startsWith('http') ? path : '');
  const brandName = (product) => data.brands.find((brand) => brand.id === product.brand_id)?.name || '—';
  const manufacturerName = (product) => data.manufacturers.find((manufacturer) => manufacturer.id === product.manufacturer_id)?.legal_name || '—';
  const categoryName = (product) => data.product_categories.find((category) => category.id === product.category_id)?.name || '—';

  return (
    <div className="products-section">
      <div className="section-header">
        <div><p className="eyebrow">CATALOGUE</p><h1>Produits</h1><p className="muted">{filteredProducts.length} fiche{filteredProducts.length > 1 ? 's' : ''} produit{filteredProducts.length !== data.products.length ? ` sur ${data.products.length}` : ''}</p></div>
        <div className="section-actions">
          <div className="product-layout-toggle" aria-label="Mode d’affichage">
            <button type="button" className={`button button-small ${layout === 'table' ? 'button-primary' : 'button-quiet'}`} onClick={() => setLayout('table')} aria-pressed={layout === 'table'}><List size={15} /> Tableau</button>
            <button type="button" className={`button button-small ${layout === 'cards' ? 'button-primary' : 'button-quiet'}`} onClick={() => setLayout('cards')} aria-pressed={layout === 'cards'}><Grid2X2 size={15} /> Cartes</button>
          </div>
          <button className="button button-quiet" type="button" onClick={() => loadData()}><LoaderCircle size={16} /> Actualiser</button>
        </div>
      </div>

      <div className="catalogue-filters">
        <label className="search-input"><Search size={16} /><input type="search" placeholder="Rechercher un produit, une référence ou un EAN…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
        <select aria-label="Filtrer par catégorie" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">Toutes les catégories</option>{data.product_categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="Filtrer par marque" value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}><option value="all">Toutes les marques</option>{data.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
        <select aria-label="Filtrer par fabricant" value={selectedManufacturer} onChange={(event) => setSelectedManufacturer(event.target.value)}><option value="all">Tous les fabricants</option>{data.manufacturers.map((manufacturer) => <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.legal_name}</option>)}</select>
      </div>

      <div className="pdf-selection-toolbar">
        <button type="button" className={`button button-small ${selectionMode ? 'button-primary' : 'button-quiet'}`} onClick={() => { setSelectionMode((current) => !current); setSelectedIds([]); }} aria-pressed={selectionMode}><CheckSquare size={15} /> Sélectionner des produits</button>
        {selectionMode && <><button type="button" className="button button-small button-quiet" onClick={toggleVisible}>{allSelected ? 'Désélectionner les résultats' : 'Tout sélectionner'}</button><span className="pdf-selection-count">{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</span><button type="button" className="button button-small button-primary" disabled={!selectedIds.length} onClick={() => onPdfExport(data.products.filter((product) => selectedIds.includes(product.id)), true)}><FileDown size={15} /> Exporter en PDF</button></>}
      </div>

      {filteredProducts.length === 0 ? <div className="empty-state"><Package size={22} /><h2>Aucun produit trouvé</h2><p>Modifie la recherche ou les filtres pour afficher des produits.</p></div> : layout === 'table' ? <div className="product-table-scroll"><table className="product-table"><thead><tr>{selectionMode && <th><input type="checkbox" aria-label="Sélectionner les résultats visibles" checked={allSelected} onChange={toggleVisible} /></th>}<th>Photo</th><th>Référence</th><th>Produit</th><th>Marque</th><th>Fabricant</th><th>Catégorie</th><th>Origine</th><th>Actions</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}>{selectionMode && <td><input type="checkbox" aria-label={`Sélectionner ${product.designation}`} checked={selectedIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /></td>}<td>{imageFor(product.main_photo_url) ? <img className="catalogue-thumb" src={imageFor(product.main_photo_url)} alt={`Photo de ${product.designation}`} /> : <span className="catalogue-thumb catalogue-thumb-empty"><ImagePlus size={16} /></span>}</td><td>{product.internal_reference || '—'}</td><td><button type="button" className="table-product-link" onClick={() => setOpenedProduct(product)}>{product.designation || 'Produit sans nom'}</button><small className="directory-description">EAN : {product.ean_gtin || '—'}</small></td><td>{brandName(product)}</td><td>{manufacturerName(product)}</td><td>{categoryName(product)}</td><td>{product.product_origin || '—'}</td><td><div className="product-table-actions"><button type="button" className="icon-button" title="Gérer les photos" aria-label={`Gérer les photos de ${product.designation}`} onClick={() => setEditingPhotos(product)}><ImagePlus size={16} /></button><button type="button" className="icon-button" title={`Exporter ${product.designation} en PDF`} aria-label={`Exporter ${product.designation} en PDF`} onClick={() => onPdfExport([product], false)}><FileDown size={16} /></button></div></td></tr>)}</tbody></table></div> : <div className="record-grid">{filteredProducts.map((product) => <article className="record-card directory-card" key={product.id}>{imageFor(product.main_photo_url) ? <img className="record-thumb" src={imageFor(product.main_photo_url)} alt={`Photo de ${product.designation}`} /> : <span className="record-thumb record-thumb-empty"><ImagePlus size={18} /></span>}{selectionMode && <button type="button" className={`pdf-card-select${selectedIds.includes(product.id) ? ' pdf-card-select-active' : ''}`} aria-label={`${selectedIds.includes(product.id) ? 'Désélectionner' : 'Sélectionner'} ${product.designation}`} aria-pressed={selectedIds.includes(product.id)} onClick={() => toggleProduct(product.id)}>{selectedIds.includes(product.id) && <Check size={15} />}</button>}<div className="record-card-body"><span className="reference-label">{product.internal_reference || 'SANS RÉFÉRENCE'}</span><h3><button type="button" className="product-name-button" onClick={() => setOpenedProduct(product)}>{product.designation || 'Produit sans nom'}</button></h3><p>{brandName(product)} · {manufacturerName(product)}</p><div className="card-meta"><span>{categoryName(product)}</span><span>{product.product_origin || 'Origine non précisée'}</span></div></div>{!selectionMode && <div className="product-card-actions"><button type="button" className="product-pdf-button" title="Gérer les photos" aria-label={`Gérer les photos de ${product.designation}`} onClick={() => setEditingPhotos(product)}><ImagePlus size={16} /></button><button type="button" className="product-pdf-button" title="Exporter en PDF" aria-label={`Exporter ${product.designation} en PDF`} onClick={() => onPdfExport([product], false)}><FileDown size={16} /></button></div>}</article>)}</div>}
      {editingPhotos && <ProductPhotoEditor product={editingPhotos} data={data} client={supabase} onClose={() => setEditingPhotos(null)} onRefresh={loadData} notify={notify} />}
      {openedProduct && <ProductRecord product={openedProduct} data={data} onClose={() => setOpenedProduct(null)} onPhotos={() => { setEditingPhotos(openedProduct); setOpenedProduct(null); }} onPdf={() => onPdfExport([openedProduct], false)} />}
    </div>
  );
}

const productPhotoFields = [
  ['main_photo_url', 'Photo principale'],
  ['uvc_photo_url', 'Photo UVC'],
  ['pcb_photo_url', 'Photo PCB'],
  ['palette_photo_url', 'Photo palette'],
];

function ProductRecord({ product, data, onClose, onPhotos, onPdf }) {
  const [tab, setTab] = useState('Infos');
  const brand = data.brands.find((row) => row.id === product.brand_id);
  const manufacturer = data.manufacturers.find((row) => row.id === product.manufacturer_id);
  const category = data.product_categories.find((row) => row.id === product.category_id);
  const typeName = (id) => data.packaging_types.find((row) => row.id === id)?.name || '—';
  const linked = (data.crm_exchange_products || []).filter((row) => row.product_id === product.id).map((row) => ({ row, exchange: (data.crm_exchanges || []).find((exchange) => exchange.id === row.exchange_id) })).filter((entry) => entry.exchange).sort((a, b) => new Date(b.exchange.occurred_at || 0) - new Date(a.exchange.occurred_at || 0));
  const availability = linked.filter(({ exchange }) => {
    const exchangeCase = (data.crm_exchange_cases || []).find((item) => item.id === exchange.case_id);
    return `${exchange.scenario || ''} ${exchange.subscenario || ''}`.toLocaleLowerCase().includes('disponib') || ['availability', 'offer'].includes(exchangeCase?.case_kind);
  });
  const prices = linked.filter(({ row }) => row.uvc_unit_price != null || row.pcb_unit_price != null || row.palette_unit_price != null);
  const image = data.mediaUrls?.[product.main_photo_url] || '';
  const infoGroups = [
    ['Identification', [['Référence interne', product.internal_reference], ['EAN / GTIN', product.ean_gtin], ['Marque', brand?.name], ['Fabricant', manufacturer?.legal_name], ['Catégorie', category?.name], ['Origine', product.product_origin]]],
    ['UVC', [['Type', typeName(product.uvc_type_id)], ['Code UVC', product.uvc], ['Sous-UVC', typeName(product.sub_uvc_type_id)], ['Quantité sous-UVC', product.quantity_sub_uvc && `${product.quantity_sub_uvc} ${product.quantity_sub_uvc_unit || ''}`], ['Dimensions (cm)', [product.uvc_length_cm, product.uvc_width_cm, product.uvc_height_cm].filter(Boolean).join(' × ')], ['Poids brut (kg)', product.uvc_gross_weight_kg], ['Volume (m³)', product.uvc_volume_m3]]],
    ['PCB', [['Type', typeName(product.pcb_type_id)], ['UVC par PCB', product.quantity_uvc_pcb], ['Dimensions (cm)', [product.pcb_length_cm, product.pcb_width_cm, product.pcb_height_cm].filter(Boolean).join(' × ')], ['Poids brut (kg)', product.pcb_gross_weight_kg], ['Volume (m³)', product.pcb_volume_m3]]],
    ['Palette', [['Type', typeName(product.palette_type_id)], ['PCB par palette', product.quantity_pcb_palette], ['UVC par palette', product.quantity_uvc_palette], ['Dimensions (cm)', [product.palette_length_cm, product.palette_width_cm, product.palette_height_cm].filter(Boolean).join(' × ')], ['Poids brut (kg)', product.palette_gross_weight_kg], ['Volume (m³)', product.palette_volume_m3]]],
  ];
  const contactName = (exchange) => { const contact = (data.network_contacts || []).find((item) => item.id === exchange.contact_id); return contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : ''; };
  const caseTitle = (exchange) => (data.crm_exchange_cases || []).find((item) => item.id === exchange.case_id)?.title || '';
  const eventCard = ({ row, exchange }) => <article className="product-history-entry" key={exchange.id}><div className="product-history-entry-heading"><div><strong>{exchange.scenario || exchange.category || 'Échange'}</strong>{caseTitle(exchange) && <small>{caseTitle(exchange)}</small>}</div><span>{exchange.occurred_at ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(exchange.occurred_at)) : 'Date non renseignée'}</span></div>{contactName(exchange) && <span className="product-history-contact">Contact · {contactName(exchange)}</span>}<div className="product-history-prices"><span>Quantité<strong>{row.quantity ?? '—'} {row.packaging_level || ''}</strong></span>{row.uvc_unit_price != null && <span>Prix UVC<strong>{row.uvc_unit_price} €</strong></span>}{row.pcb_unit_price != null && <span>Prix PCB<strong>{row.pcb_unit_price} €</strong></span>}{row.palette_unit_price != null && <span>Prix palette<strong>{row.palette_unit_price} €</strong></span>}</div>{exchange.content && <p>{exchange.content}</p>}</article>;
  const visibleInfoGroups = infoGroups.map(([heading, fields]) => [heading, fields.filter(([, value]) => value != null && String(value).trim() !== '')]).filter(([, fields]) => fields.length);
  return <ModalBackdrop onClose={onClose}><section className="modal-card modal-wide product-record-modal" role="dialog" aria-modal="true" aria-labelledby="product-record-title">
    <div className="product-record-hero"><button type="button" className="icon-button product-record-close" onClick={onClose} aria-label="Fermer"><X size={17} /></button><div className="product-record-image">{image ? <img src={image} alt={`Photo de ${product.designation}`} /> : <Package size={30} />}</div><div className="product-record-summary"><span className="reference-label">FICHE PRODUIT · {category?.name || 'CATÉGORIE NON RENSEIGNÉE'}</span><h2 id="product-record-title">{product.designation || 'Produit sans nom'}</h2><div className="product-record-tags">{brand?.name && <span>{brand.name}</span>}{manufacturer?.legal_name && <span>{manufacturer.legal_name}</span>}{product.product_origin && <span>{product.product_origin}</span>}</div><div className="product-record-codes"><span><small>Référence</small><strong>{product.internal_reference || '—'}</strong></span><span><small>EAN / GTIN</small><strong>{product.ean_gtin || '—'}</strong></span></div></div><div className="product-record-hero-actions"><button type="button" className="button button-quiet button-small" onClick={onPhotos}><ImagePlus size={15} /> Gérer les photos</button><button type="button" className="button button-primary button-small" onClick={onPdf}><FileDown size={15} /> Exporter en PDF</button></div></div>
    <Tabs className="product-detail-tabs" activeClassName="product-detail-tab-active" label="Sections de la fiche produit" value={tab} onChange={setTab} tabs={[{ value: 'Infos', label: 'Caractéristiques' }, { value: 'Prix', label: `Historique des prix · ${prices.length}` }, { value: 'Disponibilité', label: `Disponibilités · ${availability.length}` }]} />
    {tab === 'Infos' ? <div className="product-record-info">{visibleInfoGroups.length ? visibleInfoGroups.map(([heading, fields]) => <section className={`product-record-info-group${heading === 'Identification' ? ' is-identification' : ''}`} key={heading}><h3>{heading}</h3><div className="network-detail-grid">{fields.map(([label, value]) => <div className="network-detail-item" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></section>) : <p className="product-history-empty">Aucune caractéristique n’a encore été renseignée.</p>}</div> : <div className="product-history-panel">{(tab === 'Prix' ? prices : availability).length ? (tab === 'Prix' ? prices : availability).map(eventCard) : <p className="product-history-empty">Aucune annonce de {tab === 'Prix' ? 'prix' : 'disponibilité'} liée à ce produit.</p>}</div>}
    <div className="product-record-footer"><span>Fiche produit · {product.internal_reference || product.designation}</span><button type="button" className="button button-quiet button-small" onClick={onClose}>Fermer</button></div>
  </section></ModalBackdrop>;
}

function ProductPhotoEditor({ product, data, client, onClose, onRefresh, notify }) {
  const [files, setFiles] = useState({});
  const [cleared, setCleared] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickFor, setPickFor] = useState('');
  const [selectedPaths, setSelectedPaths] = useState({});
  const previews = useMemo(() => Object.fromEntries(Object.entries(files).filter(([, file]) => file).map(([field, file]) => [field, URL.createObjectURL(file)])), [files]);
  useEffect(() => () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const changes = { ...selectedPaths };
    const uploadedPaths = [];
    try {
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError) throw authError;
      if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
      for (const [field] of productPhotoFields) {
        if (cleared[field]) changes[field] = null;
        const file = files[field];
        if (!file) continue;
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Utilise une image JPEG, PNG, WebP ou AVIF.');
        if (file.size > 20 * 1024 * 1024) throw new Error('Chaque image doit faire au maximum 20 Mo.');
        const name = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${auth.session.user.id}/products/${crypto.randomUUID()}-${name}`;
        const { error: uploadError } = await client.storage.from('catalogue-media').upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { error: assetError } = await client.from('media_assets').insert({ storage_path: path, file_name: file.name, folder: 'Produits', mime_type: file.type, file_size: file.size });
        if (assetError) throw assetError;
        changes[field] = path;
      }
      if (changes.main_photo_url && !files.uvc_photo_url && !cleared.uvc_photo_url && (!product.uvc_photo_url || product.uvc_photo_url === product.main_photo_url)) {
        changes.uvc_photo_url = changes.main_photo_url;
      }
      if (!Object.keys(changes).length) { onClose(); return; }
      const { error } = await client.from('products').update(changes).eq('id', product.id);
      if (error) throw error;
      await onRefresh();
      notify('Photos du produit enregistrées.');
      onClose();
    } catch (error) {
      for (const path of uploadedPaths) {
        await client.from('media_assets').delete().eq('storage_path', path);
        await client.storage.from('catalogue-media').remove([path]);
      }
      notify(`Enregistrement des photos impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const imageFor = (path) => data.mediaUrls?.[path] || (String(path || '').startsWith('http') ? path : '');
  return <ModalBackdrop onClose={() => { if (!saving) onClose(); }}>
    <section className="modal-card modal-wide directory-modal" role="dialog" aria-modal="true" aria-labelledby="product-photo-title">
      <div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon"><ImagePlus size={18} /></span><h2 id="product-photo-title">Photos · {product.designation}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={17} /></button></div>
      <form className="record-form" onSubmit={save}>
        <div className="product-photo-grid">{productPhotoFields.map(([field, label]) => {
          const src = previews[field] || (cleared[field] ? '' : imageFor(selectedPaths[field] || product[field]));
          return <div className="photo-field product-photo-field" key={field}><label><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; setFiles((current) => ({ ...current, [field]: file })); setSelectedPaths((current) => ({ ...current, [field]: undefined })); setCleared((current) => ({ ...current, [field]: false })); }} />{src ? <img src={src} alt={label} /> : <ImagePlus size={22} />}<strong>{label}</strong><small>{files[field]?.name || (selectedPaths[field] ? 'Image de la médiathèque' : (product[field] && !cleared[field] ? 'Photo enregistrée' : 'Aucune photo'))}</small></label><button className="button button-quiet button-small" type="button" onClick={() => setPickFor(field)}>Choisir dans la médiathèque</button>{product[field] && !cleared[field] && <button className="button button-quiet button-small" type="button" onClick={() => { setCleared((current) => ({ ...current, [field]: true })); setFiles((current) => ({ ...current, [field]: null })); setSelectedPaths((current) => ({ ...current, [field]: undefined })); }}>Retirer</button>}</div>;
        })}</div>
        <div className="modal-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={onClose}>Annuler</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les photos'}</button></div>
      </form>
    </section>
    {pickFor && <MediaPicker data={data} onClose={() => setPickFor('')} onSelect={(asset) => { const field = pickFor; setSelectedPaths((current) => ({ ...current, [field]: asset.storage_path })); setFiles((current) => ({ ...current, [field]: null })); setCleared((current) => ({ ...current, [field]: false })); setPickFor(''); }} />}
  </ModalBackdrop>;
}

// Network Section Component
function NetworkSection({ data, setData, supabase, loadData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const filteredContacts = data.network_contacts.filter(contact => {
    const matchesSearch = contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || (selectedType === 'company' && contact.company_id) || 
                       (selectedType === 'individual' && !contact.company_id);
    return matchesSearch && matchesType;
  });

  return (
    <div className="network-section">
      <div className="section-header">
        <h2>Réseau de Contacts</h2>
        <div className="section-actions">
          <button className="button button-primary" onClick={() => loadData()}>
            <LoaderCircle size={16} className="spin" /> Rafraîchir
          </button>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Rechercher un contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="all">Tous les types</option>
          <option value="company">Sociétés</option>
          <option value="individual">Individus</option>
        </select>
      </div>

      <div className="contacts-grid">
        {filteredContacts.length === 0 ? (
          <p>Aucun contact trouvé.</p>
        ) : (
          filteredContacts.map(contact => (
            <div key={contact.id} className="contact-card">
              <h3>{contact.first_name} {contact.last_name}</h3>
              <p className="email">{contact.email}</p>
              {contact.company_id && (
                <p className="company">
                  {data.network_companies.find(c => c.id === contact.company_id)?.name || 'Société inconnue'}
                </p>
              )}
              <p className="phone">{contact.phone_number}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState('network');
  const [data, setData] = useState({
    manufacturers: [], brands: [], products: [], network_contacts: [], network_companies: [],
    product_categories: [], product_subcategories: [], product_subcategory_items: [],
    packaging_types: [], trade_documents: [], crm_exchanges: [], crm_exchange_cases: [], crm_exchange_case_contacts: [], crm_exchange_case_media: [], business_bank_accounts: [],
    business_profile: null, business_issuers: [], business_services: [],
    business_transport_types: [], business_handling_types: [], business_storage_types: [],
    crm_actions: [], crm_exchange_products: [], crm_exchange_services: [],
    crm_exchange_transports: [], crm_exchange_handling_types: [], crm_exchange_storage_types: [],
    trade_payments: [], trade_expenses: [], trade_document_lines: [],
    media_assets: [], mediaUrls: {}, templates: [], trade_document_templates: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfRequest, setPdfRequest] = useState(null);
  const [documentRequest, setDocumentRequest] = useState(null);
  const [contactExchangeRequest, setContactExchangeRequest] = useState(null);
  
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState(authorizedEmail);
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState(null);
  const mediaPathsRef = useRef([]);
  const completePdfExport = useCallback(() => setPdfRequest(null), []);
  const startDocumentFromCase = (request) => {
    setDocumentRequest({ ...request, requestId: crypto.randomUUID() });
    setActivePage('trade');
  };
  const openContactExchange = (contactId, caseId) => {
    setContactExchangeRequest({ contactId, caseId, requestId: crypto.randomUUID() });
    setActivePage('network');
  };

  const refreshMediaUrls = useCallback(async () => {
    if (!supabase || mediaPathsRef.current.length === 0) return;
    const mediaUrls = {};
    const paths = mediaPathsRef.current;
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { data: signedFiles, error: signingError } = await supabase.storage
        .from('catalogue-media')
        .createSignedUrls(batch, 3600);
      if (signingError) throw signingError;
      for (const file of signedFiles || []) {
        if (file.path && file.signedUrl) mediaUrls[file.path] = file.signedUrl;
      }
    }
    setData((current) => ({ ...current, mediaUrls: { ...current.mediaUrls, ...mediaUrls } }));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let refreshing = false;
    const refresh = () => {
      if (refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      refreshMediaUrls()
        .catch((refreshError) => console.error('Error refreshing media URLs:', refreshError))
        .finally(() => { refreshing = false; });
    };
    const interval = window.setInterval(refresh, 45 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user, refreshMediaUrls]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user || null);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setAuthError(sessionError.message);
      setUser(data.session?.user || null);
      setAuthReady(true);
    }).catch((sessionError) => {
      if (!active) return;
      setAuthError(sessionError.message || 'Impossible de vérifier la session.');
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setSigningIn(true);
    setAuthError('');
    if (loginEmail.trim().toLowerCase() !== authorizedEmail) {
      setAuthError('Ce compte n’est pas autorisé à accéder à cet espace.');
      setSigningIn(false);
      return;
    }
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (signInError) setAuthError('Connexion impossible. Vérifiez votre adresse et votre mot de passe.');
    } catch {
      setAuthError('Connexion impossible. Vérifiez votre connexion Internet puis réessayez.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setNotice({ message: 'Déconnexion impossible : ' + signOutError.message, isError: true });
  };
  // Load data from Supabase
  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const fetchAll = async (query) => {
        const rows = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data: page, error: queryError } = await query.range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          rows.push(...(page || []));
          if (!page || page.length < pageSize) return rows;
        }
      };
      const [manufacturers, brands, products, networkContacts, networkCompanies,
        productCategories, productSubcategories, productSubcategoryItems,
        packagingTypes, tradeDocuments, crmExchanges, crmExchangeCases, crmExchangeCaseContacts, crmExchangeCaseMedia, businessBankAccounts,
        businessProfileResult, mediaAssets, templates, businessIssuers, businessServices,
        businessTransportTypes, businessHandlingTypes, businessStorageTypes, crmActions,
        crmExchangeProducts, crmExchangeServices, crmExchangeTransports,
        crmExchangeHandlingTypes, crmExchangeStorageTypes, tradePayments, tradeExpenses,
        tradeDocumentLines, networkContactSocialLinks, networkCompanySocialLinks,
        networkCompanyAddresses, networkCompanyBrands, networkCompanyCategories] = await Promise.all([
        fetchAll(supabase.from('manufacturers').select('*')),
        fetchAll(supabase.from('brands').select('*')),
        fetchAll(supabase.from('products').select('*').order('designation', { ascending: true })),
        fetchAll(supabase.from('network_contacts').select('*').order('first_name', { ascending: true })),
        fetchAll(supabase.from('network_companies').select('*').order('name', { ascending: true })),
        fetchAll(supabase.from('product_categories').select('*')),
        fetchAll(supabase.from('product_subcategories').select('*')),
        fetchAll(supabase.from('product_subcategory_items').select('*')),
        fetchAll(supabase.from('packaging_types').select('*')),
        fetchAll(supabase.from('trade_documents').select('*').order('created_at', { ascending: false })),
        fetchAll(supabase.from('crm_exchanges').select('*').order('occurred_at', { ascending: false })),
        fetchAll(supabase.from('crm_exchange_cases').select('*').order('updated_at', { ascending: false })),
        fetchAll(supabase.from('crm_exchange_case_contacts').select('*')),
        fetchAll(supabase.from('crm_exchange_case_media').select('*')),
        fetchAll(supabase.from('business_bank_accounts').select('*')),
        supabase.from('business_profile').select('*').maybeSingle(),
        fetchAll(supabase.from('media_assets').select('*')),
        fetchAll(supabase.from('trade_document_templates').select('*')),
        fetchAll(supabase.from('business_issuers').select('*')),
        fetchAll(supabase.from('business_services').select('*')),
        fetchAll(supabase.from('business_transport_types').select('*')),
        fetchAll(supabase.from('business_handling_types').select('*')),
        fetchAll(supabase.from('business_storage_types').select('*')),
        fetchAll(supabase.from('crm_actions').select('*')),
        fetchAll(supabase.from('crm_exchange_products').select('*')),
        fetchAll(supabase.from('crm_exchange_services').select('*')),
        fetchAll(supabase.from('crm_exchange_transports').select('*')),
        fetchAll(supabase.from('crm_exchange_handling_types').select('*')),
        fetchAll(supabase.from('crm_exchange_storage_types').select('*')),
        fetchAll(supabase.from('trade_payments').select('*')),
        fetchAll(supabase.from('trade_expenses').select('*')),
        fetchAll(supabase.from('trade_document_lines').select('*')),
        fetchAll(supabase.from('network_contact_social_links').select('*')),
        fetchAll(supabase.from('network_company_social_links').select('*')),
        fetchAll(supabase.from('network_company_addresses').select('*')),
        fetchAll(supabase.from('network_company_brands').select('*')),
        fetchAll(supabase.from('network_company_categories').select('*')),
      ]);
      if (businessProfileResult.error) throw businessProfileResult.error;
      const paths = [...new Set([
        ...mediaAssets.map((asset) => asset.storage_path),
        ...brands.map((brand) => brand.logo_url),
        ...manufacturers.map((manufacturer) => manufacturer.logo_url),
        ...products.flatMap((product) => [product.main_photo_url, product.uvc_photo_url, product.pcb_photo_url, product.palette_photo_url]),
        ...networkContacts.map((contact) => contact.contact_photo_path),
        ...templates.map((template) => template.logo_path),
        ...tradeDocuments.map((document) => document.file_path),
        ...tradeExpenses.map((expense) => expense.receipt_path),
      ].filter(Boolean))];
      mediaPathsRef.current = paths.filter((path) => !/^https?:\/\//i.test(path));
      const mediaUrls = Object.fromEntries(paths.filter((path) => /^https?:\/\//i.test(path)).map((path) => [path, path]));
      const storagePaths = paths.filter((path) => !/^https?:\/\//i.test(path));
      for (let index = 0; index < storagePaths.length; index += 100) {
        const batch = storagePaths.slice(index, index + 100);
        const { data: signedFiles } = await supabase.storage.from('catalogue-media').createSignedUrls(batch, 3600);
        for (const file of signedFiles || []) {
          if (file.path && file.signedUrl) mediaUrls[file.path] = file.signedUrl;
        }
      }
      setData({
        manufacturers, brands, products, network_contacts: networkContacts,
        network_companies: networkCompanies, network_contact_social_links: networkContactSocialLinks,
        network_company_social_links: networkCompanySocialLinks, network_company_addresses: networkCompanyAddresses,
        network_company_brands: networkCompanyBrands, network_company_categories: networkCompanyCategories,
        product_categories: productCategories,
        product_subcategories: productSubcategories, product_subcategory_items: productSubcategoryItems,
        packaging_types: packagingTypes, trade_documents: tradeDocuments, crm_exchanges: crmExchanges,
        crm_exchange_cases: crmExchangeCases, crm_exchange_case_contacts: crmExchangeCaseContacts,
        crm_exchange_case_media: crmExchangeCaseMedia,
        business_bank_accounts: businessBankAccounts, business_profile: businessProfileResult.data,
        business_issuers: businessIssuers, business_services: businessServices,
        business_transport_types: businessTransportTypes,
        business_handling_types: businessHandlingTypes,
        business_storage_types: businessStorageTypes,
        crm_actions: crmActions, crm_exchange_products: crmExchangeProducts,
        crm_exchange_services: crmExchangeServices,
        crm_exchange_transports: crmExchangeTransports,
        crm_exchange_handling_types: crmExchangeHandlingTypes,
        crm_exchange_storage_types: crmExchangeStorageTypes,
        trade_payments: tradePayments, trade_expenses: tradeExpenses,
        trade_document_lines: tradeDocumentLines,
        media_assets: mediaAssets, mediaUrls, templates,
        trade_document_templates: templates,
      });
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      const missingTable = ['42P01', 'PGRST205'].includes(err?.code);
      setError(missingTable
        ? 'Certaines tables Supabase sont absentes. Appliquez les migrations du dossier supabase/migrations dans l’ordre indiqué dans le README.'
        : 'Chargement impossible : ' + (err?.message || 'erreur Supabase inconnue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.email?.toLowerCase() === authorizedEmail) {
      loadData();
    } else if (authReady) {
      setLoading(false);
      setError(null);
      setData({
        manufacturers: [], brands: [], products: [], network_contacts: [], network_companies: [],
        product_categories: [], product_subcategories: [], product_subcategory_items: [],
        packaging_types: [], trade_documents: [], crm_exchanges: [], crm_exchange_cases: [], crm_exchange_case_contacts: [], crm_exchange_case_media: [], business_bank_accounts: [],
        business_profile: null, business_issuers: [], business_services: [],
        business_transport_types: [], business_handling_types: [], business_storage_types: [],
        crm_actions: [], crm_exchange_products: [], crm_exchange_services: [],
        crm_exchange_transports: [], crm_exchange_handling_types: [], crm_exchange_storage_types: [],
        trade_payments: [], trade_expenses: [], trade_document_lines: [],
        media_assets: [], mediaUrls: {}, templates: [], trade_document_templates: [],
      });
    }
  }, [user, authReady, loadData]);

  const navItems = [
    { id: 'products', label: 'Produits', icon: <Package size={18} /> },
    { id: 'brands', label: 'Marques', icon: <Tags size={18} /> },
    { id: 'manufacturers', label: 'Fabricants', icon: <Factory size={18} /> },
    { id: 'media', label: 'Médiathèque', icon: <Images size={18} /> },
    { id: 'network', label: 'Contacts', icon: <ContactRound size={18} /> },
    { id: 'actions', label: 'Actions', icon: <CheckSquare size={18} /> },
    { id: 'trade', label: 'Trade', icon: <FileText size={18} /> },
    { id: 'services', label: 'Services', icon: <BriefcaseBusiness size={18} /> },
    { id: 'business-settings', label: 'Paramètres Entreprise', icon: <Settings2 size={18} /> },
  ];

  // Authentication is required before any workspace data is rendered.
  if (!supabase) {
    return <div className="auth-screen"><aside className="auth-aside"><div className="brand-mark"><Database size={24} /><strong>Catalogue ERP/CRM</strong></div><div className="auth-quote"><h1>Configuration requise</h1><p>Ajoutez l’URL Supabase et la clé publique dans .env.local.</p></div></aside><main className="auth-main"><p>Supabase n’est pas configuré. Consultez .env.example.</p></main></div>;
  }
  if (!authReady) return <div className="loading-screen"><LoaderCircle size={28} className="spin" /><p>Vérification de la session…</p></div>;
  if (!user) {
    return <div className="auth-screen"><aside className="auth-aside"><div className="brand-mark"><Database size={24} /><strong>Catalogue ERP/CRM</strong></div><div className="auth-quote"><h1>Votre espace commercial, au même endroit.</h1><p>Connectez-vous avec le compte créé dans Supabase Authentication. Les inscriptions publiques restent désactivées.</p></div></aside><main className="auth-main"><form className="auth-form" onSubmit={handleSignIn}><h2>Connexion</h2><p className="muted">Utilisez l’adresse e-mail et le mot de passe de votre compte.</p><label className="field"><span>Adresse e-mail</span><input type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /></label><label className="field"><span>Mot de passe</span><input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>{authError && <p className="form-error" role="alert">{authError}</p>}<button className="button button-primary button-full" type="submit" disabled={signingIn}>{signingIn ? 'Connexion…' : 'Se connecter'}</button></form></main></div>;
  }
  if (user.email?.toLowerCase() !== authorizedEmail) {
    return <div className="error-page"><h2>Accès refusé</h2><p>Seul le compte {authorizedEmail} est autorisé.</p><button className="button button-primary" onClick={handleSignOut}>Se déconnecter</button></div>;
  }
  if (error) {
    return (
      <div className="error-page">
        <h2>Erreur</h2>
        <p>{error}</p>
        <button className="button button-primary" onClick={loadData}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Navigation */}
      <nav className="main-nav">
        <div className="nav-brand">
          <Database size={24} />
          <span>Catalogue ERP/CRM</span>
        </div>
        <div className="nav-items">
          {navItems.map((item) => (
            <button 
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-status">
          {loading && <LoaderCircle size={18} className="spin" />}
          <span className="account-email">{user.email}</span>
          <button className="button button-quiet button-small" type="button" onClick={handleSignOut} aria-label="Se déconnecter"><LogOut size={15} /> Déconnexion</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Suspense fallback={
          <div className="loading-screen">
            <LoaderCircle size={32} className="spin" />
            <p>Chargement du workspace...</p>
          </div>
        }>
          {activePage === 'products' && (
            <ProductsSection 
              data={data}
              loadData={loadData}
              supabase={supabase}
              notify={(message, isError = false) => setNotice({ message, isError })}
              onPdfExport={(products, multiple) => setPdfRequest({ products, multiple })}
            />
          )}
          {(activePage === 'brands' || activePage === 'manufacturers') && <CatalogDirectory kind={activePage} data={data} client={supabase} onRefresh={loadData} notify={(message, isError = false) => setNotice({ message, isError })} />}
          {activePage === 'media' && <MediaLibrary data={data} client={supabase} onRefresh={loadData} notify={(message, isError = false) => setNotice({ message, isError })} />}
          {activePage === 'network' && <NetworkWorkspace data={data} client={supabase} onRefresh={loadData} notify={(message, isError = false) => setNotice({ message, isError })} onCreateProforma={startDocumentFromCase} contactExchangeRequest={contactExchangeRequest} onContactExchangeRequestHandled={() => setContactExchangeRequest(null)} onGenerateProductPdf={(ids) => { const productsForPdf = data.products.filter((product) => ids.includes(product.id)); if (productsForPdf.length) setPdfRequest({ products: productsForPdf, multiple: true }); }} />}
          {(activePage === 'exchanges' || activePage === 'actions' || activePage === 'trade' || activePage === 'services' || activePage === 'business-settings') && (
            <BusinessWorkspace 
              mode={activePage} 
              data={data} 
              client={supabase} 
              notify={(message, isError = false) => setNotice({ message, isError })}
              onRefresh={loadData}
              onOpenContactExchange={openContactExchange}
              documentRequest={documentRequest}
              onDocumentRequestHandled={() => setDocumentRequest(null)}
            />
          )}
        </Suspense>
      </main>

      {notice && <div className={`app-toast ${notice.isError ? 'app-toast-error' : ''}`} role="status"><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Fermer">×</button></div>}

      {pdfRequest?.products?.length > 0 && createPortal(
        <Suspense fallback={null}>
          <ProductPdfExport
            products={pdfRequest.products}
            data={data}
            multiple={pdfRequest.multiple}
            onComplete={completePdfExport}
          />
        </Suspense>,
        document.body
      )}
    </div>
  );
}

export default App;
