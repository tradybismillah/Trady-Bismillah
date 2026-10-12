import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Check, Copy, FolderOpen, Images, ImagePlus, Search, Upload, X, List, LayoutGrid, ArrowUpDown, FileText } from 'lucide-react';
import ModalBackdrop from './ModalA11y.jsx';

const defaultFolders = ['Produits', 'Marques', 'Fabricants', 'Contacts', 'Clients', 'Trade', 'Autres'];

function safeName(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function safeFolder(value) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'Autres';
}

function imageUrl(data, path) {
  return data.mediaUrls?.[path] || (String(path || '').startsWith('http') ? path : '');
}

function formatSize(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function MediaPicker({ data, onSelect, onClose, documents = false, assetIds = null }) {
  const [search, setSearch] = useState('');
  const entries = useMemo(() => data.media_assets.filter((asset) => {
    const isImage = String(asset.mime_type || '').startsWith('image/');
    const isPdf = String(asset.mime_type || '').includes('pdf') || /\.pdf$/i.test(asset.file_name || '');
    return (!assetIds || assetIds.includes(asset.id)) && (documents ? isImage || isPdf : isImage) && asset.file_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [data.media_assets, search, documents, assetIds]);
  return <ModalBackdrop onClose={onClose}>
    <section className="modal-card modal-wide media-picker" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
        <div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon"><Images size={18} /></span><h2 id="media-picker-title">{documents ? 'Choisir un fichier de la médiathèque' : 'Choisir une image de la médiathèque'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={17} /></button></div>
      <label className="search-input media-picker-search"><Search size={16} /><input autoFocus type="search" placeholder="Rechercher une image…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {entries.length ? <div className="media-picker-grid">{entries.map((asset) => <button type="button" className="media-picker-item" key={asset.id} onClick={() => onSelect(asset)}>{String(asset.mime_type || '').startsWith('image/') ? <img src={imageUrl(data, asset.storage_path)} alt="" /> : <span className="media-picker-file-icon"><FileText size={26} /></span>}<span>{asset.file_name}</span><small>{asset.folder}</small></button>)}</div> : <div className="empty-state media-picker-empty"><span className="empty-icon"><ImagePlus size={21} /></span><h2>Aucun fichier trouvé</h2><p>Les pièces jointes disponibles apparaîtront ici.</p></div>}
    </section>
  </ModalBackdrop>;
}

export default function MediaLibrary({ data, client, onRefresh, notify }) {
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [mediaType, setMediaType] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [uploadFolder, setUploadFolder] = useState('Produits');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [movingId, setMovingId] = useState('');
  const folders = useMemo(() => [...new Set([...defaultFolders, ...data.media_assets.map((asset) => asset.folder).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'fr')), [data.media_assets]);
  const visibleAssets = useMemo(() => data.media_assets.filter((asset) => {
    const matchesFolder = folder === 'all' || asset.folder === folder;
    const matchesSearch = `${asset.file_name} ${asset.folder}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const isImage = String(asset.mime_type || '').startsWith('image/');
    const matchesType = mediaType === 'all' || (mediaType === 'images' && isImage) || (mediaType === 'documents' && !isImage);
    return matchesFolder && matchesSearch && matchesType;
  }).sort((a, b) => sort === 'name' ? String(a.file_name || '').localeCompare(String(b.file_name || ''), 'fr') : sort === 'size' ? Number(b.file_size || 0) - Number(a.file_size || 0) : new Date(b.created_at || 0) - new Date(a.created_at || 0)), [data.media_assets, folder, search, mediaType, sort]);
  useEffect(() => setVisibleLimit(60), [folder, search, mediaType, sort]);
  const displayedAssets = visibleAssets.slice(0, visibleLimit);

  const upload = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    setUploading(true);
    const uploadedPaths = [];
    let successCount = 0;
    try {
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError) throw authError;
      if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
      const destination = safeFolder(uploadFolder);
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress(`${index + 1} / ${files.length}`);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(file.type)) throw new Error(`${file.name} n’est pas un format d’image accepté.`);
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} dépasse la limite de 20 Mo.`);
        const path = `${auth.session.user.id}/${destination.toLowerCase().replace(/[^a-z0-9-]/g, '-')}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: uploadError } = await client.storage.from('catalogue-media').upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { error: assetError } = await client.from('media_assets').insert({ storage_path: path, file_name: file.name, folder: destination, mime_type: file.type, file_size: file.size });
        if (assetError) throw assetError;
        successCount += 1;
      }
      await onRefresh();
      notify(`${successCount} image${successCount > 1 ? 's importées' : ' importée'} dans la médiathèque.`);
    } catch (error) {
      for (const path of uploadedPaths) {
        await client.from('media_assets').delete().eq('storage_path', path);
        await client.storage.from('catalogue-media').remove([path]);
      }
      notify(`Import interrompu : ${error.message}`, true);
      if (successCount) await onRefresh();
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const move = async (asset, destination) => {
    const nextFolder = safeFolder(destination);
    if (!nextFolder || nextFolder === asset.folder) return;
    setMovingId(asset.id);
    const { error } = await client.from('media_assets').update({ folder: nextFolder }).eq('id', asset.id);
    if (error) notify(`Déplacement impossible : ${error.message}`, true);
    else { notify(`Image déplacée dans « ${nextFolder} ».`); await onRefresh(); }
    setMovingId('');
  };

  const copyPath = async (asset) => {
    try {
      await navigator.clipboard.writeText(asset.storage_path);
      setCopiedId(asset.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } catch {
      notify('Le navigateur ne permet pas de copier le chemin.');
    }
  };

  return <section className="media-library-page">
    <div className="section-header"><div><p className="eyebrow">CATALOGUE</p><h1>Médiathèque</h1><p className="muted">Photos privées partagées entre les produits, les marques et les fabricants.</p></div><div className="media-library-total"><Images size={17} /><strong>{data.media_assets.length}</strong><span>image{data.media_assets.length > 1 ? 's' : ''}</span></div></div>

    <div className="media-upload-panel"><div className="media-upload-copy"><span className="directory-modal-icon"><Upload size={18} /></span><div><strong>Importer des images</strong><span>JPEG, PNG, WebP, AVIF ou GIF · 20 Mo maximum par fichier</span></div></div><div className="media-upload-controls"><label className="field"><span>Dossier de destination</span><input value={uploadFolder} onChange={(event) => setUploadFolder(event.target.value)} list="media-folder-options" maxLength={60} /><datalist id="media-folder-options">{folders.map((item) => <option value={item} key={item} />)}</datalist></label><label className={`button button-primary media-file-button${uploading ? ' is-disabled' : ''}`}><Upload size={15} />{uploading ? `Importation ${uploadProgress}` : 'Choisir des images'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple disabled={uploading} onChange={upload} /></label></div></div>

    <div className="media-library-tools"><label className="search-input"><Search size={16} /><input type="search" placeholder="Rechercher un fichier ou un dossier…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="field media-folder-filter"><span>Dossier</span><select value={folder} onChange={(event) => setFolder(event.target.value)}><option value="all">Tous les dossiers</option>{folders.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="field media-type-filter"><span>Type</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value)}><option value="all">Tous les fichiers</option><option value="images">Images</option><option value="documents">Documents</option></select></label><label className="field media-sort-filter"><span>Trier par</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Plus récents</option><option value="name">Nom A à Z</option><option value="size">Taille décroissante</option></select></label><div className="media-view-toggle" role="group" aria-label="Affichage"><button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-label="Affichage en vignettes"><LayoutGrid size={16} /></button><button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-label="Affichage en liste"><List size={16} /></button></div><span className="result-count">{visibleAssets.length} résultat{visibleAssets.length > 1 ? 's' : ''} sur {data.media_assets.length}</span></div>

    {visibleAssets.length ? <><div className={view === 'grid' ? 'media-library-grid' : 'media-library-list'}>{displayedAssets.map((asset) => { const isImage = String(asset.mime_type || '').startsWith('image/'); const preview = isImage && imageUrl(data, asset.storage_path); return <article className={view === 'grid' ? 'media-library-card' : 'media-library-list-row'} key={asset.id}>{view === 'grid' ? <div className="media-library-image">{preview ? <img src={preview} alt={asset.file_name} loading="lazy" /> : <FileText size={25} />}</div> : <span className="media-library-list-preview">{preview ? <img src={preview} alt="" loading="lazy" /> : <FileText size={19} />}</span>}<div className="media-library-card-body"><strong title={asset.file_name}>{asset.file_name}</strong><small><FolderOpen size={12} /> {asset.folder} · {isImage ? 'Image' : 'Document'} · {formatSize(asset.file_size)}</small><div className="media-library-card-actions"><button type="button" className="button button-quiet button-small" onClick={() => copyPath(asset)}><Copy size={13} />{copiedId === asset.id ? 'Copié' : 'Chemin'}</button><label className="media-move-folder"><FolderOpen size={13} /><select aria-label={`Déplacer ${asset.file_name}`} value={asset.folder} disabled={movingId === asset.id} onChange={(event) => move(asset, event.target.value)}>{folders.map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div></div></article>; })}</div>{displayedAssets.length < visibleAssets.length && <button type="button" className="button button-quiet media-load-more" onClick={() => setVisibleLimit((limit) => limit + 60)}>Afficher 60 fichiers de plus ({visibleAssets.length - displayedAssets.length} restants)</button>}</> : <div className="empty-state media-library-empty"><span className="empty-icon"><Images size={22} /></span><h2>{data.media_assets.length ? 'Aucun fichier trouvé' : 'La médiathèque est vide'}</h2><p>Importe des images et documents pour les réutiliser dans l’application.</p></div>}
  </section>;
}
