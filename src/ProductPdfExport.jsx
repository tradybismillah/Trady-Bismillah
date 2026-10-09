import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Country from 'country-state-city/lib/country';
import { ArrowRight, Box, Building2, Layers3, Package, Tag } from 'lucide-react';

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function formatValue(value, suffix = '') {
  if (!hasValue(value)) return null;
  const numericValue = Number(value);
  const text = Number.isFinite(numericValue) ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(numericValue) : value;
  return `${text}${suffix}`;
}

function filenamePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
}

function productPdfFilename(products = []) {
  if (!Array.isArray(products)) products = [];
  const date = new Date();
  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (products.length === 1) {
    return `${filenamePart(products[0].designation) || 'Produit'}-${datePart}`;
  }
  const designations = products.map((product) => filenamePart(product.designation)).filter(Boolean).join(' - ');
  const selectionName = designations.slice(0, 120).replace(/[. ]+$/g, '') || `${products.length}-produits`;
  return `FP-${selectionName}-${datePart}`;
}

function volumeOf(product, prefix) {
  const dimensions = ['length', 'width', 'height'].map((axis) => product[`${prefix}_${axis}_cm`]);
  if (!dimensions.every(hasValue)) return null;
  const volume = dimensions.map(Number).reduce((total, value) => total * value, 1) / 1_000_000;
  return Number.isFinite(volume) ? volume : null;
}

function dimensionsOf(product, prefix) {
  const dimensions = [
    product[`${prefix}_length_cm`],
    product[`${prefix}_width_cm`],
    product[`${prefix}_height_cm`],
  ];
  if (!dimensions.some(hasValue)) return null;
  return `${dimensions.map((value) => formatValue(value) ?? '—').join(' × ')} cm`;
}

function packagingType(product, field, types) {
  return types.find((item) => item.id === product[field])?.name || null;
}

function categoryOf(product, data) {
  return data.product_categories.find((item) => item.id === product.category_id)?.name || '';
}

function categoryPath(product, data) {
  return [
    categoryOf(product, data),
    data.product_subcategories.find((item) => item.id === product.subcategory_id)?.name,
    data.product_subcategory_items.find((item) => item.id === product.subcategory_item_id)?.name,
  ].filter(Boolean);
}

function productDetails(product, data) {
  const calculatedCount = hasValue(product.quantity_uvc_pcb) && hasValue(product.quantity_pcb_palette)
    ? Number(product.quantity_uvc_pcb) * Number(product.quantity_pcb_palette)
    : null;
  const countPerPalette = Number.isFinite(calculatedCount) ? calculatedCount : null;
  const brandRecord = data.brands.find((item) => item.id === product.brand_id);
  const manufacturerRecord = data.manufacturers.find((item) => item.id === product.manufacturer_id);
  const category = categoryPath(product, data);
  return {
    brand: brandRecord?.name,
    brandRecord,
    manufacturer: manufacturerRecord?.legal_name,
    manufacturerRecord,
    category,
    countPerPalette,
  };
}

function PackageCard({ number, title, icon: Icon, photo, quantity, quantityUnit, details }) {
  return (
    <section className="pdf-package-card">
      <div className="pdf-package-title"><span>{number}</span><Icon size={12} /><h3>{title}</h3></div>
      <div className="pdf-package-quantity">
        <strong>{hasValue(quantity) ? quantity : '—'}</strong>
        <span>{quantityUnit}</span>
      </div>
      {photo && <img className="pdf-package-photo" src={photo} alt={`Conditionnement ${title}`} />}
      <div className="pdf-package-details">
        {details.map((item) => (
          <div className="pdf-package-detail" key={item.label}>
            <span>{item.label}</span><strong>{hasValue(item.value) ? item.value : '—'}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeCountryName(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const countryFlags = new Map(Country.getAllCountries().map((item) => [
  normalizeCountryName(item.name),
  [...item.isoCode].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join(''),
]));
countryFlags.set('ue', '🇪🇺');
countryFlags.set('eu', '🇪🇺');
countryFlags.set('union europeenne', '🇪🇺');
countryFlags.set('european union', '🇪🇺');

function countryFlag(value) {
  return countryFlags.get(normalizeCountryName(value)) || null;
}

function ProductMeta({ label, value, icon: Icon, image, flag }) {
  return (
    <div className="pdf-meta-cell">
      <span>{label}</span>
      <div className="pdf-meta-value">
        {image ? <img src={image} alt="" /> : Icon && <Icon size={11} strokeWidth={1.8} aria-hidden="true" />}
        {flag && <span className="pdf-origin-flag" aria-label={`Drapeau ${value}`}>{flag}</span>}
        <strong>{hasValue(value) ? value : '—'}</strong>
      </div>
    </div>
  );
}

function KeyFigure({ value, label, unit }) {
  return (
    <div className="pdf-key-figure">
      <strong>{hasValue(value) ? value : '—'}</strong>
      <span><b>{label}</b><small>{unit}</small></span>
    </div>
  );
}

function ProductPage({ product, data, pageNumber, pageTotal, screen = false }) {
  const details = productDetails(product, data);
  const categoryLabel = details.category.join(' / ');
  const originFlag = countryFlag(product.product_origin);
  const uvcVolume = volumeOf(product, 'uvc');
  const pcbVolume = volumeOf(product, 'pcb');
  const paletteVolume = volumeOf(product, 'palette');
  const uvcDimensions = dimensionsOf(product, 'uvc');
  const pcbDimensions = dimensionsOf(product, 'pcb');
  const paletteDimensions = dimensionsOf(product, 'palette');
  const uvcType = packagingType(product, 'uvc_type_id', data.packaging_types);
  const subUvcType = packagingType(product, 'sub_uvc_type_id', data.packaging_types);
  const pcbType = packagingType(product, 'pcb_type_id', data.packaging_types);
  const paletteType = packagingType(product, 'palette_type_id', data.packaging_types);
  const countPerPalette = details.countPerPalette;
  const uvcQuantity = hasValue(product.quantity_sub_uvc)
    ? `${formatValue(product.quantity_sub_uvc)} ${product.quantity_sub_uvc_unit || ''}`.trim()
    : null;

  return (
    <article className={`pdf-page pdf-product-page${screen ? ' pdf-screen-page' : ''}`}>
      <header className="pdf-page-header"><span>ATELIER · PRODUCT PASSPORT</span><span>{String(pageNumber).padStart(2, '0')} / {String(pageTotal).padStart(2, '0')}</span></header>
      <section className="pdf-hero">
        <div className={`pdf-hero-image${data.mediaUrls[product.main_photo_url] ? '' : ' pdf-hero-image-empty'}`}>
          {data.mediaUrls[product.main_photo_url] && <img src={data.mediaUrls[product.main_photo_url]} alt={product.designation || ''} />}
        </div>
        <div className="pdf-hero-copy">
          <h1>{product.designation || 'Produit sans désignation'}</h1>
          {categoryLabel && <p className="pdf-category"><Tag size={11} strokeWidth={1.8} aria-hidden="true" />{categoryLabel}</p>}
          <div className="pdf-meta-grid">
            <ProductMeta label="RÉFÉRENCE" value={product.internal_reference} />
            <ProductMeta label="EAN / GTIN" value={product.ean_gtin} />
            <ProductMeta label="MARQUE" value={details.brand} image={data.mediaUrls[details.brandRecord?.logo_url]} icon={Tag} />
            <ProductMeta label="FABRICANT" value={details.manufacturer} image={data.mediaUrls[details.manufacturerRecord?.logo_url]} icon={Building2} />
            <ProductMeta label="ORIGINE" value={product.product_origin} flag={originFlag} />
            <ProductMeta label="CONDITIONNEMENT" value={[uvcType, uvcQuantity].filter(Boolean).join(' · ')} icon={Package} />
          </div>
        </div>
      </section>
      <div className="pdf-logistics-heading"><span>CONDITIONNEMENT & LOGISTIQUE</span><i /><small>Du pack à la palette</small></div>
      <section className="pdf-package-chain">
        <PackageCard
          number="01"
          title="UVC"
          icon={Package}
          photo={data.mediaUrls[product.uvc_photo_url]}
          quantity={formatValue(product.quantity_sub_uvc)}
          quantityUnit={product.quantity_sub_uvc_unit || 'unités / UVC'}
          details={[
            { label: 'Type UVC', value: uvcType },
            { label: 'Type sous-UVC', value: subUvcType },
            { label: 'Quantité sous-UVC', value: uvcQuantity },
            { label: 'Dimensions', value: uvcDimensions },
            { label: 'Volume', value: formatValue(uvcVolume, ' m³') },
            { label: 'Poids brut', value: formatValue(product.uvc_gross_weight_kg, ' kg') },
          ]}
        />
        <PackageCard
          number="02"
          title="PCB"
          icon={Box}
          photo={data.mediaUrls[product.pcb_photo_url]}
          quantity={formatValue(product.quantity_uvc_pcb)}
          quantityUnit="UVC / PCB"
          details={[
            { label: 'Type PCB', value: pcbType },
            { label: 'Quantité UVC / PCB', value: formatValue(product.quantity_uvc_pcb) },
            { label: 'Dimensions', value: pcbDimensions },
            { label: 'Volume', value: formatValue(pcbVolume, ' m³') },
            { label: 'Poids brut', value: formatValue(product.pcb_gross_weight_kg, ' kg') },
          ]}
        />
        <PackageCard
          number="03"
          title="PALETTE"
          icon={Layers3}
          photo={data.mediaUrls[product.palette_photo_url]}
          quantity={formatValue(product.quantity_pcb_palette)}
          quantityUnit="PCB / palette"
          details={[
            { label: 'Type palette', value: paletteType },
            { label: 'Quantité PCB / palette', value: formatValue(product.quantity_pcb_palette) },
            { label: 'Quantité UVC / palette', value: formatValue(countPerPalette) },
            { label: 'Dimensions', value: paletteDimensions },
            { label: 'Volume', value: formatValue(paletteVolume, ' m³') },
            { label: 'Poids brut', value: formatValue(product.palette_gross_weight_kg, ' kg') },
          ]}
        />
      </section>
      <div className="pdf-packaging-flow">
        <strong>{uvcType || 'UVC'} <span>× {hasValue(product.quantity_uvc_pcb) ? formatValue(product.quantity_uvc_pcb) : '—'}</span></strong>
        <ArrowRight size={12} />
        <strong>{pcbType || 'PCB'} <span>× {hasValue(product.quantity_pcb_palette) ? formatValue(product.quantity_pcb_palette) : '—'}</span></strong>
        <ArrowRight size={12} />
        <strong>{paletteType || 'PALETTE'} <span>{formatValue(countPerPalette) || '—'} UVC</span></strong>
      </div>
      <section className="pdf-key-figures">
        <div className="pdf-key-heading"><span>CHIFFRES CLÉS</span><i /></div>
        <div className="pdf-key-grid">
          <KeyFigure value={formatValue(product.quantity_sub_uvc)} label="Unités" unit="par UVC" />
          <KeyFigure value={formatValue(product.quantity_uvc_pcb)} label="UVC" unit="par PCB" />
          <KeyFigure value={formatValue(product.quantity_pcb_palette)} label="PCB" unit="par palette" />
        </div>
      </section>
      <footer className="pdf-page-footer">
        <span>{product.designation || ''}{product.internal_reference ? ` · ${product.internal_reference}` : ''}</span>
        <span>{details.manufacturer ? `FABRICANT · ${details.manufacturer}` : 'FICHE PRODUIT'}</span>
      </footer>
    </article>
  );
}

export function ProductPassport({ product, data }) {
  return <ProductPage product={product} data={data} pageNumber={1} pageTotal={1} screen />;
}

function categoryGroups(products, data) {
  const groups = new Map();
  products.forEach((product) => {
    const category = categoryOf(product, data) || 'Sans catégorie';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(product);
  });
  return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second, 'fr'));
}

function CoverPage({ products, data }) {
  return (
    <article className="pdf-page pdf-cover-page">
      <div className="pdf-cover-topline"><span>SÉLECTION PRODUITS</span><span>{String(products.length).padStart(2, '0')}</span></div>
      <div className="pdf-cover-title"><span>CATALOGUE</span><h1>Sélection produits</h1></div>
      <div className={`pdf-cover-mosaic pdf-cover-mosaic-${Math.min(products.length, 4)}`}>
        {products.slice(0, 4).map((product) => (
          <figure key={product.id} className="pdf-cover-tile">
            {data.mediaUrls[product.main_photo_url] && <img src={data.mediaUrls[product.main_photo_url]} alt="" />}
            <figcaption>
              {data.brands.find((brand) => brand.id === product.brand_id)?.name && <span>{data.brands.find((brand) => brand.id === product.brand_id)?.name}</span>}
              <strong>{product.designation}</strong>
              {categoryOf(product, data) && <small>{categoryOf(product, data)}</small>}
            </figcaption>
          </figure>
        ))}
      </div>
      <footer className="pdf-cover-footer">Sélection produits</footer>
    </article>
  );
}

function ContentsPage({ products, data }) {
  return (
    <article className="pdf-page pdf-contents-page">
      <header className="pdf-page-header"><span>SÉLECTION PRODUITS</span><span>CONTENU</span></header>
      <h1>Sommaire</h1>
      {categoryGroups(products, data).map(([category, items]) => (
        <section className="pdf-contents-group" key={category}>
          <h2>{category}</h2>
          {items.map((product) => (
            <div className="pdf-contents-row" key={product.id}>
              <span>{product.designation}</span><i />
              {data.brands.find((brand) => brand.id === product.brand_id)?.name && <strong>{data.brands.find((brand) => brand.id === product.brand_id)?.name}</strong>}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

function SummaryValues({ items }) {
  return (
    <dl className="pdf-summary-values">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt><dd>{hasValue(value) ? value : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryPhoto({ src, label }) {
  return src ? <img className="pdf-summary-photo" src={src} alt={label} /> : <span className="pdf-summary-no-photo">—</span>;
}

function SummaryTablePage({ products, data }) {
  return (
    <article className="pdf-summary-page">
      <header className="pdf-summary-heading">
        <span>ANNEXE · TABLEAU DE SYNTHÈSE</span>
        <h1>Vue d’ensemble des produits</h1>
        <p>{products.length} produit{products.length === 1 ? '' : 's'} · identité et données logistiques</p>
      </header>
      <table className="pdf-summary-table">
        <thead>
          <tr>
            <th scope="col">Produit & identité</th>
            <th scope="col">UVC</th>
            <th scope="col">PCB</th>
            <th scope="col">Palette</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const details = productDetails(product, data);
            return (
              <tr key={product.id}>
                <td className="pdf-summary-identity">
                  <SummaryPhoto src={data.mediaUrls[product.main_photo_url]} label={product.designation || 'Photo produit'} />
                  <strong className="pdf-summary-designation">{product.designation || '—'}</strong>
                  <SummaryValues items={[
                    ['Réf. interne', product.internal_reference],
                    ['EAN / GTIN', product.ean_gtin],
                    ['Marque', details.brand],
                    ['Fabricant', details.manufacturer],
                    ['Origine', product.product_origin],
                    ['Catégorie', details.category[0]],
                    ['Titre sous-catégorie', details.category[1]],
                    ['Sous-catégorie', details.category[2]],
                  ]} />
                </td>
                <td>
                  <SummaryPhoto src={data.mediaUrls[product.uvc_photo_url]} label={`Photo UVC ${product.designation || ''}`} />
                  <SummaryValues items={[
                    ['Type UVC', packagingType(product, 'uvc_type_id', data.packaging_types)],
                    ['Type sous-UVC', packagingType(product, 'sub_uvc_type_id', data.packaging_types)],
                    ['Quantité sous-UVC', formatValue(product.quantity_sub_uvc)],
                    ['Unité', product.quantity_sub_uvc_unit],
                    ['Longueur (cm)', formatValue(product.uvc_length_cm)],
                    ['Largeur (cm)', formatValue(product.uvc_width_cm)],
                    ['Hauteur (cm)', formatValue(product.uvc_height_cm)],
                    ['Volume (m³)', formatValue(volumeOf(product, 'uvc'))],
                    ['Poids brut (kg)', formatValue(product.uvc_gross_weight_kg)],
                  ]} />
                </td>
                <td>
                  <SummaryPhoto src={data.mediaUrls[product.pcb_photo_url]} label={`Photo PCB ${product.designation || ''}`} />
                  <SummaryValues items={[
                    ['Type PCB', packagingType(product, 'pcb_type_id', data.packaging_types)],
                    ['Quantité UVC / PCB', formatValue(product.quantity_uvc_pcb)],
                    ['Longueur (cm)', formatValue(product.pcb_length_cm)],
                    ['Largeur (cm)', formatValue(product.pcb_width_cm)],
                    ['Hauteur (cm)', formatValue(product.pcb_height_cm)],
                    ['Volume (m³)', formatValue(volumeOf(product, 'pcb'))],
                    ['Poids brut calculé (kg)', formatValue(product.pcb_gross_weight_kg)],
                  ]} />
                </td>
                <td>
                  <SummaryPhoto src={data.mediaUrls[product.palette_photo_url]} label={`Photo palette ${product.designation || ''}`} />
                  <SummaryValues items={[
                    ['Type palette', packagingType(product, 'palette_type_id', data.packaging_types)],
                    ['Quantité PCB / palette', formatValue(product.quantity_pcb_palette)],
                    ['Quantité UVC / palette', formatValue(details.countPerPalette)],
                    ['Longueur (cm)', formatValue(product.palette_length_cm)],
                    ['Largeur (cm)', formatValue(product.palette_width_cm)],
                    ['Hauteur (cm)', formatValue(product.palette_height_cm)],
                    ['Volume (m³)', formatValue(volumeOf(product, 'palette'))],
                    ['Poids brut calculé (kg)', formatValue(product.palette_gross_weight_kg)],
                  ]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}

const noop = () => {};

export default function ProductPdfExport({ products = [], data, multiple = false, onComplete = noop } = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const includeCataloguePages = multiple && safeProducts.length > 1;
  const filename = productPdfFilename(safeProducts);
  useEffect(() => {
    if (safeProducts.length === 0) return undefined;
    let active = true;
    const originalTitle = document.title;
    const print = async () => {
      await document.fonts?.ready;
      const images = [...document.querySelectorAll('.pdf-export-root img')];
      await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
      window.setTimeout(() => {
        if (active) {
          document.title = filename;
          window.print();
        }
      }, 180);
    };
    const afterPrint = () => {
      document.title = originalTitle;
      onComplete();
    };
    window.addEventListener('afterprint', afterPrint, { once: true });
    print();
    return () => {
      active = false;
      if (document.title === filename) document.title = originalTitle;
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [filename, onComplete, safeProducts]);

  const pages = (
    <div className="pdf-export-root">
      {includeCataloguePages && <CoverPage products={safeProducts} data={data} />}
      {includeCataloguePages && <ContentsPage products={safeProducts} data={data} />}
      {safeProducts.map((product, index) => <ProductPage key={product.id} product={product} data={data} pageNumber={index + 1} pageTotal={safeProducts.length} />)}
      {includeCataloguePages && <SummaryTablePage products={safeProducts} data={data} />}
    </div>
  );
  return safeProducts.length ? createPortal(pages, document.body) : null;
}
