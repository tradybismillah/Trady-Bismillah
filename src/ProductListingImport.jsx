import { useMemo, useState } from 'react';
import { Check, FileSpreadsheet, FileText, Link2, Search, Upload, X } from 'lucide-react';
import ModalBackdrop from './ModalA11y.jsx';
import { MediaPicker } from './MediaLibrary.jsx';

const fieldLabels = {
  designation: 'Désignation', ean_gtin: 'EAN / GTIN', source_reference: 'Référence fournisseur',
  brand_name: 'Marque', manufacturer_name: 'Fabricant', category_name: 'Catégorie',
  uvc: 'Unité de vente (UVC)', quantity_uvc_pcb: 'UVC par colis (PCB)',
  quantity_pcb_palette: 'Colis par palette', source_price: 'Prix du listing',
};
const numberValue = (value) => {
  let raw = String(value ?? '').trim().replace(/[\s€¢$£]/g, '');
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.includes(',')) raw = raw.replace(',', '.');
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const normalizeHeader = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
const headerHints = {
  designation: ['designation', 'produit', 'article', 'product', 'item', 'nom'],
  ean_gtin: ['ean', 'gtin', 'codebarre', 'barcode'],
  source_reference: ['referencefournisseur', 'reference', 'ref', 'sku', 'codearticle'],
  brand_name: ['marque', 'brand'],
  manufacturer_name: ['fabricant', 'manufacturer', 'fournisseur'],
  category_name: ['categorie', 'category', 'famille'],
  uvc: ['uvc', 'unitevente', 'conditionnementunitaire', 'format'],
  quantity_uvc_pcb: ['unitesparcolis', 'uvcparpcb', 'uvcpcb', 'unitesparcarton', 'piecesparcarton'],
  quantity_pcb_palette: ['colisparpalette', 'pcbparpalette', 'cartonsparpalette'],
  source_price: ['prixuvc', 'prixunitaire', 'prixparunite', 'priceperunit', 'prix', 'price'],
};

function inferMapping(headers) {
  return Object.fromEntries(Object.keys(fieldLabels).map((field) => [field, headers.find((header) => {
    const normalized = normalizeHeader(header);
    if (field === 'designation' && /(reference|ref|sku|ean|gtin|code)/.test(normalized)) return false;
    return headerHints[field].some((hint) => normalized.includes(hint));
  }) || '']));
}

function displayContact(contact) {
  return contact?.nickname || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || contact?.email || 'Contact';
}

function contactLabelForBatch(batch, data) {
  const contact = data.network_contacts.find((item) => item.id === batch.contact_id);
  const company = data.network_companies.find((item) => item.id === contact?.company_id)?.name;
  return company ? `${displayContact(contact)} · ${company}` : displayContact(contact);
}

function exactProductMatch(row, products) {
  const ean = String(row.ean_gtin || '').trim().toLocaleLowerCase();
  const designation = String(row.designation || '').trim().toLocaleLowerCase();
  return products.find((product) => ean && product.ean_gtin?.toLocaleLowerCase() === ean)
    || products.find((product) => designation && product.designation?.trim().toLocaleLowerCase() === designation)
    || null;
}

export default function ProductListingImport({ data, client, onRefresh, notify, onClose }) {
  const [tab, setTab] = useState('pending');
  const [file, setFile] = useState(null);
  const [sourceAsset, setSourceAsset] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [contactId, setContactId] = useState('');
  const [exchangeId, setExchangeId] = useState('');
  const [sourceRole, setSourceRole] = useState('supplier');
  const [priceSide, setPriceSide] = useState('purchase');
  const [priceBasis, setPriceBasis] = useState('uvc');
  const [currency, setCurrency] = useState('EUR');
  const [eurRate, setEurRate] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [rowDrafts, setRowDrafts] = useState({});
  const [rowSearch, setRowSearch] = useState('');
  const activeBatches = data.product_import_batches.filter((batch) => ['review', 'partial'].includes(batch.status));
  const allBatches = data.product_import_batches;
  const pendingTotal = data.product_import_rows.filter((row) => ['pending', 'matched'].includes(row.status)).length;
  const selectedBatch = allBatches.find((batch) => batch.id === selectedBatchId) || activeBatches[0] || allBatches[0];
  const batchRows = useMemo(() => selectedBatch
    ? data.product_import_rows.filter((row) => row.batch_id === selectedBatch.id).sort((a, b) => a.row_number - b.row_number)
    : [], [data.product_import_rows, selectedBatch?.id]);
  const remainingRows = batchRows.filter((row) => ['pending', 'matched'].includes(row.status));
  const exchanges = data.crm_exchanges.filter((exchange) => exchange.contact_id === contactId)
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
  const linkedAssetIds = useMemo(() => {
    const selectedExchange = exchanges.find((exchange) => exchange.id === exchangeId);
    if (!selectedExchange?.case_id) return null;
    return (data.crm_exchange_case_media || []).filter((link) => link.case_id === selectedExchange.case_id).map((link) => link.media_asset_id);
  }, [exchanges, exchangeId, data.crm_exchange_case_media]);

  const rowsFromText = (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 2);
    const cleanCell = (cell) => String(cell || '').replace(/[\[\]_]/g, ' ').replace(/\s+/g, ' ').trim();
    const priceCellValue = (cell) => {
      const match = cleanCell(cell).match(/([0-9oOsS][0-9oOsS.,]*)\s*(?:€|¢|\$|£|EUR)/i);
      if (!match) return null;
      let value = match[1].replace(/[sS]/g, '5').replace(/[oO]/g, '0');
      if (!/[,.]/.test(value)) {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 3) value = `${digits.slice(0, -2)},${digits.slice(-2)}`;
        else if (digits.length === 4) value = `${digits.slice(0, -3)},${digits.slice(-3)}`;
      }
      return numberValue(value);
    };
    const tableRows = lines.map((line) => line.includes('|') ? line.split('|').map(cleanCell) : null).filter((cells) => {
      if (!cells || cells.length < 6) return false;
      const code = cleanCell(cells[0]).replace(/[^a-z0-9]/gi, '');
      return /^[a-z0-9]{3,12}$/i.test(code) && cleanCell(cells[1]).length > 4 && cells.some((cell) => (priceCellValue(cell) || 0) > 0);
    });
    if (tableRows.length >= 2) {
      const outputHeaders = ['Référence fournisseur', 'Désignation', 'UVC par PCB', 'Colis par palette', 'Prix'];
      const rows = tableRows.map((cells) => {
        const priceCell = cells.map(priceCellValue).find((value) => value > 0) ?? '';
        return {
          [outputHeaders[0]]: cleanCell(cells[0]).replace(/[^a-z0-9]/gi, ''),
          [outputHeaders[1]]: cleanCell(cells[1]),
          [outputHeaders[2]]: cleanCell(cells[3] || ''),
          [outputHeaders[3]]: cleanCell(cells.at(-1) || ''),
          [outputHeaders[4]]: priceCell,
        };
      });
      return { headers: outputHeaders, rows };
    }
    const headerLine = lines.find((line) => /produit|designation|article|product/i.test(line) && /prix|price|ean|reference|ref/i.test(line));
    const parseLine = (line) => {
      const cells = line.includes('\t') ? line.split('\t') : line.includes('|') ? line.split('|') : line.includes(';') ? line.split(';') : line.split(/\s{2,}/);
      if (cells.length > 1) return cells.map((cell) => cell.trim());
      const price = line.match(/(?:^|\s)(\d+[,.]\d{1,4})\s*(?:€|EUR)?\s*$/i);
      return price ? [line.slice(0, price.index).trim(), price[1]] : [line];
    };
    const headersText = headerLine ? parseLine(headerLine) : ['Désignation', 'Prix'];
    const start = headerLine ? lines.indexOf(headerLine) + 1 : 0;
    const outputHeaders = headersText.map((value, index) => value || `Colonne ${index + 1}`);
    const rows = lines.slice(start).map(parseLine).filter((cells) => cells.some(Boolean)).map((cells) => Object.fromEntries(outputHeaders.map((header, index) => [header, cells[index] || ''])));
    return { headers: outputHeaders, rows };
  };

  const readDocument = async (selectedFile) => {
    const type = selectedFile.type || '';
    if (type.startsWith('image/')) {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('fra+eng');
      try {
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const bitmap = await createImageBitmap(selectedFile);
        const scale = Math.min(2.5, 3200 / bitmap.width, 3200 / bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.filter = 'grayscale(1) contrast(1.2)';
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const { data: result } = await worker.recognize(canvas);
        return rowsFromText(result.text);
      } finally { await worker.terminate(); }
    }
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await selectedFile.arrayBuffer() }).promise;
    if (pdf.numPages > 20) throw new Error('Le PDF dépasse 20 pages. Sépare-le pour faciliter la vérification.');
    const textLines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let previousY = null;
      let line = '';
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        if (previousY != null && Math.abs(y - previousY) > 3) { if (line.trim()) textLines.push(line.trim()); line = ''; }
        line += `${line ? ' ' : ''}${item.str}`;
        previousY = y;
      }
      if (line.trim()) textLines.push(line.trim());
    }
    let parsed = rowsFromText(textLines.join('\n'));
    if (parsed.rows.length < 2) {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('fra+eng');
      try {
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const ocrLines = [];
        for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          const { data: result } = await worker.recognize(canvas);
          ocrLines.push(result.text);
        }
        parsed = rowsFromText(ocrLines.join('\n'));
      } finally { await worker.terminate(); }
    }
    return parsed;
  };

  const onFile = async (selectedFile) => {
    setFile(selectedFile || null);
    setSourceAsset(null);
    setParsedRows([]);
    if (!selectedFile) return;
    setReadingFile(true);
    try {
      if (selectedFile.size > 20 * 1024 * 1024) throw new Error('Le fichier doit faire au maximum 20 Mo.');
      const isSpreadsheet = /\.(xlsx?|csv)$/i.test(selectedFile.name);
      let rows; let columns;
      if (isSpreadsheet) {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        columns = Object.keys(rows[0] || {});
      } else {
        const extracted = await readDocument(selectedFile);
        rows = extracted.rows; columns = extracted.headers;
      }
      if (!rows.length) throw new Error('Aucune ligne de données trouvée dans la première feuille.');
      if (rows.length > 1000) throw new Error('Ce listing contient plus de 1 000 lignes. Découpe-le en plusieurs fichiers pour vérifier chaque import.');
      if (!columns.length) throw new Error('Les en-têtes de colonnes n’ont pas été reconnus.');
      setHeaders(columns);
      setMapping(inferMapping(columns));
      setParsedRows(rows);
    } catch (error) {
      setFile(null);
      notify(`Lecture du listing impossible : ${error.message}`, true);
    } finally { setReadingFile(false); }
  };

  const onSelectMediaAsset = async (asset) => {
    setShowMediaPicker(false);
    setSourceAsset(asset);
    setFile(null);
    setReadingFile(true);
    try {
      const { data: blob, error } = await client.storage.from('catalogue-media').download(asset.storage_path);
      if (error) throw error;
      const selectedFile = new File([blob], asset.file_name, { type: asset.mime_type || blob.type });
      setFile(selectedFile);
      await onFile(selectedFile);
      setSourceAsset(asset);
    } catch (error) { setSourceAsset(null); notify(`Lecture du fichier impossible : ${error.message}`, true); }
    finally { setReadingFile(false); }
  };

  const mappedRow = (raw) => {
    const value = (field) => mapping[field] ? String(raw[mapping[field]] ?? '').trim() : '';
    const sourcePrice = numberValue(value('source_price'));
    const perPcb = numberValue(value('quantity_uvc_pcb'));
    const perPalette = numberValue(value('quantity_pcb_palette'));
    const sourcePricePerUvc = priceBasis === 'uvc' ? sourcePrice
      : priceBasis === 'pcb' && perPcb ? sourcePrice / perPcb
        : priceBasis === 'palette' && perPcb && perPalette ? sourcePrice / (perPcb * perPalette) : null;
    return {
      raw_data: raw,
      designation: value('designation'), ean_gtin: value('ean_gtin'), source_reference: value('source_reference'),
      brand_name: value('brand_name'), manufacturer_name: value('manufacturer_name'), category_name: value('category_name'),
      uvc: value('uvc'), quantity_uvc_pcb: perPcb, quantity_pcb_palette: perPalette,
      source_price: sourcePrice, source_price_basis: priceBasis, price_per_uvc: sourcePricePerUvc,
    };
  };

  const saveImport = async (event) => {
    event.preventDefault();
    if (!file || !contactId || !parsedRows.length) return;
    setSaving(true);
    let uploadedPath = '';
    let batchId = '';
    try {
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError) throw authError;
      if (!auth.session?.user?.id) throw new Error('Session utilisateur introuvable.');
      if (sourceAsset) uploadedPath = sourceAsset.storage_path;
      else {
        const safeName = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
        uploadedPath = `${auth.session.user.id}/product-listings/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await client.storage.from('catalogue-media').upload(uploadedPath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const { data: batch, error: batchError } = await client.from('product_import_batches').insert({
        contact_id: contactId, exchange_id: exchangeId || null, file_name: file.name, storage_path: uploadedPath,
        source_role: sourceRole, price_side: priceSide, currency,
        eur_per_currency_unit: currency === 'EUR' ? 1 : (Number(eurRate) || null),
        source_location: sourceLocation.trim(), status: 'review', row_count: parsedRows.length,
      }).select('id').single();
      if (batchError) throw batchError;
      batchId = batch.id;
      const rows = parsedRows.map((raw, index) => ({ batch_id: batch.id, row_number: index + 2, ...mappedRow(raw) }));
      for (let start = 0; start < rows.length; start += 250) {
        const { error: rowsError } = await client.from('product_import_rows').insert(rows.slice(start, start + 250));
        if (rowsError) throw rowsError;
      }
      if (!sourceAsset) {
        const { error: mediaError } = await client.from('media_assets').insert({ storage_path: uploadedPath, file_name: file.name, folder: 'Listings produits', mime_type: file.type || 'application/octet-stream', file_size: file.size });
        if (mediaError) throw mediaError;
      }
      await onRefresh();
      setSelectedBatchId(batch.id);
      setTab('pending');
      setFile(null);
      setParsedRows([]);
      notify('Listing conservé en attente de vérification.');
    } catch (error) {
      if (batchId) await client.from('product_import_batches').delete().eq('id', batchId);
      if (uploadedPath && !sourceAsset) {
        await client.from('media_assets').delete().eq('storage_path', uploadedPath);
        await client.storage.from('catalogue-media').remove([uploadedPath]);
      }
      notify(`Enregistrement du listing impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const updateRow = async (row, draft) => {
    const sourcePrice = draft.source_price === '' ? null : (draft.source_price == null ? null : Number(draft.source_price));
    const perPcb = Number(draft.quantity_uvc_pcb) || 0;
    const perPalette = perPcb * (Number(draft.quantity_pcb_palette) || 0);
    const unitPrice = sourcePrice == null ? null : draft.source_price_basis === 'uvc' ? sourcePrice
      : draft.source_price_basis === 'pcb' && perPcb > 0 ? sourcePrice / perPcb
        : draft.source_price_basis === 'palette' && perPalette > 0 ? sourcePrice / perPalette : null;
    const suggested = exactProductMatch(draft, data.products);
    const { error } = await client.from('product_import_rows').update({
      designation: draft.designation.trim(), ean_gtin: draft.ean_gtin.trim(), source_reference: draft.source_reference.trim(),
      brand_name: draft.brand_name.trim(), manufacturer_name: draft.manufacturer_name.trim(), category_name: draft.category_name.trim(),
      uvc: draft.uvc.trim(), quantity_uvc_pcb: draft.quantity_uvc_pcb || null, quantity_pcb_palette: draft.quantity_pcb_palette || null,
      source_price: sourcePrice, source_price_basis: draft.source_price_basis || 'uvc',
      price_per_uvc: unitPrice, matched_product_id: draft.matched_product_id || suggested?.id || null,
      status: draft.matched_product_id || suggested ? 'matched' : 'pending', updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (error) throw error;
  };

  const validateRow = async (row) => {
    const draft = rowDrafts[row.id] || row;
    setSaving(true);
    try {
      await updateRow(row, draft);
      const matchedProduct = data.products.find((product) => product.id === draft.matched_product_id) || exactProductMatch(draft, data.products);
      const category = data.product_categories.find((item) => item.name.trim().toLocaleLowerCase() === draft.category_name.trim().toLocaleLowerCase());
      const brand = data.brands.find((item) => item.name.trim().toLocaleLowerCase() === draft.brand_name.trim().toLocaleLowerCase());
      const manufacturer = data.manufacturers.find((item) => item.legal_name.trim().toLocaleLowerCase() === draft.manufacturer_name.trim().toLocaleLowerCase());
      if (!matchedProduct && ((draft.category_name && !category) || (draft.brand_name && !brand) || (draft.manufacturer_name && !manufacturer))) {
        throw new Error('Une marque, un fabricant ou une catégorie du fichier ne correspond pas au catalogue. Choisis une référence existante ou efface ce champ avant de créer la fiche.');
      }
      const productData = matchedProduct ? null : {
        designation: draft.designation, ean_gtin: draft.ean_gtin, category_id: category?.id || '', brand_id: brand?.id || '', manufacturer_id: manufacturer?.id || '',
        uvc: draft.uvc, quantity_uvc_pcb: draft.quantity_uvc_pcb || '', quantity_pcb_palette: draft.quantity_pcb_palette || '',
      };
      const { error } = await client.rpc('validate_product_import_row', {
        p_row_id: row.id, p_matched_product_id: matchedProduct?.id || null, p_product: productData,
      });
      if (error) throw error;
      setRowDrafts((current) => { const next = { ...current }; delete next[row.id]; return next; });
      await onRefresh();
      notify(matchedProduct ? 'Ligne rapprochée du produit existant.' : 'Produit créé et ligne validée.');
    } catch (error) {
      notify(`Validation impossible : ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const rejectRow = async (row) => {
    const reason = window.prompt('Pourquoi cette ligne est-elle écartée ?');
    if (reason === null) return;
    const { error } = await client.from('product_import_rows').update({ status: 'rejected', review_note: reason.trim(), updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) notify(`Écartement impossible : ${error.message}`, true);
    else {
      const { data: remaining } = await client.from('product_import_rows').select('status').eq('batch_id', row.batch_id);
      const pending = (remaining || []).filter((item) => ['pending', 'matched'].includes(item.status)).length;
      const validated = (remaining || []).filter((item) => item.status === 'validated').length;
      if (!pending) await client.from('product_import_batches').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', row.batch_id);
      else if (validated) await client.from('product_import_batches').update({ status: 'partial', updated_at: new Date().toISOString() }).eq('id', row.batch_id);
      await onRefresh(); notify('Ligne écartée. Le fichier source reste conservé.');
    }
  };

  const productSuggestion = (draft) => exactProductMatch(draft, data.products);
  const setRowDraft = (row, key, value) => setRowDrafts((current) => ({ ...current, [row.id]: { ...(current[row.id] || row), [key]: value } }));
  const filteredRows = remainingRows.filter((row) => {
    const draft = rowDrafts[row.id] || row;
    const text = [draft.designation, draft.ean_gtin, draft.source_reference, draft.brand_name, draft.category_name].join(' ').toLocaleLowerCase();
    return text.includes(rowSearch.trim().toLocaleLowerCase());
  });

  return <ModalBackdrop onClose={() => { if (!saving) onClose(); }}><section className="modal-card modal-wide product-import-modal" role="dialog" aria-modal="true" aria-labelledby="product-import-title">
    <div className="modal-heading"><div className="modal-heading-start"><span className="directory-modal-icon"><FileSpreadsheet size={18} /></span><div><h2 id="product-import-title">Listings produits</h2><small>Les lignes restent en attente jusqu’à ta validation.</small></div></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={17} /></button></div>
    <div className="product-import-tabs" role="tablist" aria-label="Importations produits"><button type="button" role="tab" aria-selected={tab === 'pending'} className={tab === 'pending' ? 'is-active' : ''} onClick={() => setTab('pending')}>Listings <span>{pendingTotal}</span></button><button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'is-active' : ''} onClick={() => setTab('new')}>Importer un fichier</button></div>
    {tab === 'new' ? <form className="product-import-new" onSubmit={saveImport}>
      <div className="form-grid two-columns"><label className="field"><span>Contact qui a transmis le listing *</span><select required value={contactId} onChange={(event) => { setContactId(event.target.value); setExchangeId(''); }}><option value="">Choisir un contact</option>{data.network_contacts.map((contact) => <option key={contact.id} value={contact.id}>{displayContact(contact)}{data.network_companies.find((company) => company.id === contact.company_id)?.name ? ' · ' + data.network_companies.find((company) => company.id === contact.company_id).name : ''}</option>)}</select></label><label className="field"><span>Échange lié (facultatif)</span><select value={exchangeId} onChange={(event) => setExchangeId(event.target.value)} disabled={!contactId}><option value="">Aucun échange sélectionné</option>{exchanges.map((exchange) => <option key={exchange.id} value={exchange.id}>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(exchange.occurred_at))} · {exchange.content.slice(0, 70) || 'Échange'}</option>)}</select></label><label className="field"><span>Le listing vient d’un…</span><select value={sourceRole} onChange={(event) => { setSourceRole(event.target.value); setPriceSide(event.target.value === 'supplier' ? 'purchase' : 'sale'); }}><option value="supplier">Fournisseur</option><option value="customer">Client</option><option value="other">Autre contact</option></select></label><label className="field"><span>Prix du listing côté…</span><select value={priceSide} onChange={(event) => setPriceSide(event.target.value)}><option value="purchase">Achat</option><option value="sale">Vente</option></select></label><label className="field"><span>Devise</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}>{['EUR', 'USD', 'GBP', 'DZD', 'MAD', 'CHF'].map((code) => <option key={code}>{code}</option>)}</select></label>{currency !== 'EUR' && <label className="field"><span>1 {currency} en EUR (taux saisi)</span><input type="number" min="0.000001" step="any" value={eurRate} onChange={(event) => setEurRate(event.target.value)} placeholder="Facultatif pour la cote EUR" /></label>}<label className="field"><span>Lieu ou zone de prix</span><input value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)} placeholder="Ex. départ entrepôt, Marseille" /></label><label className="field"><span>Le prix du fichier est exprimé par…</span><select value={priceBasis} onChange={(event) => setPriceBasis(event.target.value)}><option value="uvc">UVC</option><option value="pcb">PCB / colis</option><option value="palette">Palette</option></select></label></div>
      <label className="product-import-drop"><Upload size={20} /><strong>{readingFile ? 'Lecture et extraction en cours…' : file?.name || 'Importer un listing depuis votre appareil'}</strong><small>Excel, CSV, PDF ou image JPEG/PNG · 20 Mo maximum{file && /\.pdf$/i.test(file.name) ? ' · PDF limité à 20 pages' : ''}</small><input type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" disabled={readingFile} onChange={(event) => onFile(event.target.files?.[0])} /></label>
      <div className="product-import-library-source"><FileText size={15} /><span>{exchangeId ? 'Choisis une pièce jointe de cet échange ou un fichier de la médiathèque.' : 'Tu peux aussi choisir un fichier déjà présent dans la médiathèque.'}</span><button type="button" className="button button-quiet button-small" disabled={readingFile} onClick={() => setShowMediaPicker(true)}>Choisir dans la médiathèque</button></div>
      {parsedRows.length > 0 && file && !/\.(xlsx?|csv)$/i.test(file.name) && <p className="muted product-import-ocr-note">Extraction automatique à vérifier : les documents scannés ou les photos peuvent contenir des erreurs de lecture.</p>}
      {headers.length > 0 && <section className="product-import-mapping"><div><h3>Vérifier les colonnes reconnues</h3><p className="muted">Contrôle les correspondances avant de conserver les lignes en attente.</p></div><div className="product-import-mapping-grid">{Object.entries(fieldLabels).map(([field, label]) => <label className="field" key={field}><span>{label}</span><select value={mapping[field] || ''} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}><option value="">Non présent</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="product-import-preview"><strong>Aperçu · {parsedRows.length} lignes détectées</strong><div className="product-import-preview-scroll"><table><thead><tr><th>Ligne</th><th>Désignation extraite</th><th>Référence / EAN</th><th>Prix source</th></tr></thead><tbody>{parsedRows.slice(0, 8).map((raw, index) => { const row = mappedRow(raw); return <tr key={index}><td>{index + 2}</td><td>{row.designation || 'À mapper'}</td><td>{row.source_reference || row.ean_gtin || '—'}</td><td>{row.source_price == null ? '—' : `${row.source_price} ${currency} / ${priceBasis}`}</td></tr>; })}</tbody></table></div></div></section>}
      <div className="form-actions"><button className="button button-quiet" type="button" disabled={saving} onClick={onClose}>Annuler</button><button className="button button-primary" type="submit" disabled={saving || readingFile || !file || !contactId || !parsedRows.length}>{saving ? 'Enregistrement…' : 'Conserver en attente'}</button></div>
    </form> : <div className="product-import-review">
      {!allBatches.length ? <div className="empty-state"><FileSpreadsheet size={22} /><h3>Aucun listing importé</h3><p>Les fichiers importés apparaîtront ici pendant leur vérification et resteront consultables après validation.</p><button className="button button-primary" type="button" onClick={() => setTab('new')}>Importer un listing</button></div> : <>
        <div className="product-import-batch-bar"><label className="field"><span>Listing à consulter</span><select value={selectedBatch?.id || ''} onChange={(event) => { setSelectedBatchId(event.target.value); setRowDrafts({}); }}><option value="">Choisir une importation</option>{allBatches.map((batch) => { const contact = data.network_contacts.find((item) => item.id === batch.contact_id); return <option key={batch.id} value={batch.id}>{batch.file_name} · {displayContact(contact)} · {({ review: 'À vérifier', partial: 'Partiel', completed: 'Terminé', cancelled: 'Annulé' })[batch.status]}</option>; })}</select></label>{selectedBatch && <div className="product-import-batch-info"><strong>{remainingRows.length} ligne{remainingRows.length === 1 ? '' : 's'} à vérifier · {selectedBatch.row_count} au total</strong><span>{contactLabelForBatch(selectedBatch, data)} · {selectedBatch.source_location || 'Lieu non précisé'} · {selectedBatch.price_side === 'purchase' ? 'Côté achat' : 'Côté vente'}</span>{data.mediaUrls?.[selectedBatch.storage_path] && <a href={data.mediaUrls[selectedBatch.storage_path]} target="_blank" rel="noreferrer"><Link2 size={13} /> Ouvrir le fichier source</a>}</div>}</div>
        {selectedBatch && <><label className="search-input product-import-search"><Search size={15} /><input type="search" value={rowSearch} onChange={(event) => setRowSearch(event.target.value)} placeholder="Filtrer les lignes…" /></label>{batchRows.length > 0 && remainingRows.length === 0 && <div className="product-import-complete"><Check size={17} /> Toutes les lignes de cette importation ont été traitées.</div>}
          {batchRows.filter((row) => row.status === 'validated' || row.status === 'rejected').length > 0 && <div className="product-import-processed">{batchRows.filter((row) => row.status === 'validated' || row.status === 'rejected').map((row) => <div key={row.id}><span className={row.status === 'validated' ? 'is-validated' : 'is-rejected'}>{row.status === 'validated' ? 'Validé' : 'Écarté'}</span><strong>{row.designation || `Ligne ${row.row_number}`}</strong>{row.product_id && <small>{data.products.find((product) => product.id === row.product_id)?.internal_reference}</small>}{row.review_note && <small>{row.review_note}</small>}</div>)}</div>}
          <div className="product-import-rows">{filteredRows.map((row) => {
            const draft = rowDrafts[row.id] || row;
            const suggestion = productSuggestion(draft);
            const matching = data.products.filter((product) => [product.designation, product.ean_gtin, product.internal_reference].some((value) => String(value || '').toLocaleLowerCase().includes(String(draft.designation || draft.ean_gtin || draft.source_reference || '').toLocaleLowerCase()))).slice(0, 60);
            const category = data.product_categories.find((item) => item.name.trim().toLocaleLowerCase() === String(draft.category_name || '').trim().toLocaleLowerCase());
            const brand = data.brands.find((item) => item.name.trim().toLocaleLowerCase() === String(draft.brand_name || '').trim().toLocaleLowerCase());
            const manufacturer = data.manufacturers.find((item) => item.legal_name.trim().toLocaleLowerCase() === String(draft.manufacturer_name || '').trim().toLocaleLowerCase());
            return <article className="product-import-row" key={row.id}><header><div><span className="reference-label">LIGNE SOURCE {row.row_number}</span><strong>{draft.designation || 'Produit sans désignation'}</strong></div><span className={`product-import-row-status ${suggestion ? 'has-match' : ''}`}>{draft.matched_product_id ? 'Rapproché' : suggestion ? 'Correspondance suggérée' : 'Nouveau produit'}</span></header>
              <div className="product-import-row-fields"><label className="field"><span>Désignation *</span><input value={draft.designation || ''} onChange={(event) => setRowDraft(row, 'designation', event.target.value)} /></label><label className="field"><span>EAN / GTIN</span><input value={draft.ean_gtin || ''} onChange={(event) => setRowDraft(row, 'ean_gtin', event.target.value)} /></label><label className="field"><span>Réf. fournisseur</span><input value={draft.source_reference || ''} onChange={(event) => setRowDraft(row, 'source_reference', event.target.value)} /></label><label className="field"><span>Marque existante</span><select value={brand?.id || ''} onChange={(event) => { const item = data.brands.find((entry) => entry.id === event.target.value); setRowDraft(row, 'brand_name', item?.name || ''); }}><option value="">{draft.brand_name ? `Non rapprochée : ${draft.brand_name}` : 'Aucune'}</option>{data.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Catégorie</span><select value={category?.id || ''} onChange={(event) => { const item = data.product_categories.find((entry) => entry.id === event.target.value); setRowDraft(row, 'category_name', item?.name || ''); }}><option value="">{draft.category_name ? `À rapprocher : ${draft.category_name}` : 'Choisir'}</option>{data.product_categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Fabricant existant</span><select value={manufacturer?.id || ''} onChange={(event) => { const item = data.manufacturers.find((entry) => entry.id === event.target.value); setRowDraft(row, 'manufacturer_name', item?.legal_name || ''); }}><option value="">{draft.manufacturer_name ? `Non rapproché : ${draft.manufacturer_name}` : 'Aucun'}</option>{data.manufacturers.map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}</select></label><label className="field"><span>UVC / format</span><input value={draft.uvc || ''} onChange={(event) => setRowDraft(row, 'uvc', event.target.value)} /></label><label className="field"><span>UVC par PCB</span><input type="number" min="0" step="any" value={draft.quantity_uvc_pcb || ''} onChange={(event) => setRowDraft(row, 'quantity_uvc_pcb', event.target.value)} /></label><label className="field"><span>PCB par palette</span><input type="number" min="0" step="any" value={draft.quantity_pcb_palette || ''} onChange={(event) => setRowDraft(row, 'quantity_pcb_palette', event.target.value)} /></label><label className="field"><span>Prix source · {draft.source_price_basis?.toUpperCase() || 'UVC'} ({selectedBatch.currency})</span><input type="number" min="0" step="any" value={draft.source_price ?? ''} onChange={(event) => setRowDraft(row, 'source_price', event.target.value === '' ? null : Number(event.target.value))} /></label><label className="field"><span>Unité du prix source</span><select value={draft.source_price_basis || 'uvc'} onChange={(event) => setRowDraft(row, 'source_price_basis', event.target.value)}><option value="uvc">UVC</option><option value="pcb">PCB / colis</option><option value="palette">Palette</option></select></label><label className="field"><span>Produit catalogue associé</span><select value={draft.matched_product_id || suggestion?.id || ''} onChange={(event) => setRowDraft(row, 'matched_product_id', event.target.value)}><option value="">Créer une nouvelle fiche</option>{suggestion && <option value={suggestion.id}>Suggestion · {suggestion.designation} · {suggestion.internal_reference}</option>}{matching.filter((item) => item.id !== suggestion?.id).map((item) => <option key={item.id} value={item.id}>{item.designation} · {item.internal_reference}</option>)}</select></label></div>
              {(draft.brand_name && !brand || draft.manufacturer_name && !manufacturer || draft.category_name && !category) && <p className="product-import-review-hint">Certaines valeurs du fichier ne correspondent pas à tes référentiels. Rapproche-les ou complète ces références dans le catalogue avant validation.</p>}
              {draft.source_price != null && <small className="product-import-conversion">Prix ramené à l’UVC : {draft.source_price_basis === 'uvc' ? draft.source_price : draft.source_price_basis === 'pcb' && Number(draft.quantity_uvc_pcb) > 0 ? (draft.source_price / Number(draft.quantity_uvc_pcb)).toFixed(4) : draft.source_price_basis === 'palette' && Number(draft.quantity_uvc_pcb) * Number(draft.quantity_pcb_palette) > 0 ? (draft.source_price / (Number(draft.quantity_uvc_pcb) * Number(draft.quantity_pcb_palette))).toFixed(4) : 'quantités de conditionnement nécessaires'} {selectedBatch.currency} / UVC</small>}
              <details className="product-import-source-row"><summary>Voir la ligne d’origine</summary><pre>{JSON.stringify(row.raw_data, null, 2)}</pre></details>
              <footer><button type="button" className="button button-quiet button-small" disabled={saving} onClick={() => updateRow(row, draft).then(() => { setRowDrafts((current) => { const next = { ...current }; delete next[row.id]; return next; }); onRefresh(); notify('Ligne enregistrée en attente.'); }).catch((error) => notify(`Enregistrement impossible : ${error.message}`, true))}>Enregistrer</button><button type="button" className="button button-danger-ghost button-small" disabled={saving} onClick={() => rejectRow(row)}>Écarter cette ligne</button><button type="button" className="button button-primary button-small" disabled={saving || !draft.designation?.trim()} onClick={() => validateRow(row)}><Check size={14} /> Valider la ligne</button></footer>
            </article>;
          })}{!filteredRows.length && remainingRows.length > 0 && <p className="muted">Aucune ligne ne correspond au filtre.</p>}</div></>}
      </>}
    </div>}
  </section>{showMediaPicker && <MediaPicker data={data} documents assetIds={linkedAssetIds} onClose={() => setShowMediaPicker(false)} onSelect={onSelectMediaAsset} />}</ModalBackdrop>;
}
