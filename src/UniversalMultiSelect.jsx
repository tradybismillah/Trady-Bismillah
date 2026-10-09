import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';

function labelOf(item, kind) {
  if (kind === 'manufacturers') return item.legal_name;
  if (kind === 'contacts') return [item.first_name, item.last_name].filter(Boolean).join(' ');
  return item.designation || item.name || item.legal_name || item.last_name || '';
}

function searchableText(item, kind, data) {
  const base = [
    labelOf(item, kind),
    item.internal_reference,
    item.ean_gtin,
    item.email,
    item.city,
    item.country,
  ];
  if (kind === 'products') {
    base.push(
      data.brands.find((brand) => brand.id === item.brand_id)?.name,
      data.manufacturers.find((manufacturer) => manufacturer.id === item.manufacturer_id)?.legal_name,
      data.product_categories.find((category) => category.id === item.category_id)?.name,
      data.product_subcategories.find((subcategory) => subcategory.id === item.subcategory_id)?.name,
      data.product_subcategory_items.find((subcategory) => subcategory.id === item.subcategory_item_id)?.name,
    );
  }
  return base.filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function UniversalMultiSelect({
  label,
  options,
  selected,
  onChange,
  kind = 'items',
  data = { brands: [], manufacturers: [], product_categories: [], product_subcategories: [], product_subcategory_items: [] },
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [filters, setFilters] = useState({ brand: '', manufacturer: '', category: '', subcategory: '', subcategoryItem: '' });
  const [showSelected, setShowSelected] = useState(false);
  const names = useMemo(() => new Map(options.map((item) => [item.id, labelOf(item, kind)])), [kind, options]);
  const selectedItems = selected.map((id) => options.find((item) => item.id === id)).filter(Boolean);
  const filtered = useMemo(() => {
    const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return options.filter((item) => {
      if (normalizedSearch && !searchableText(item, kind, data).includes(normalizedSearch)) return false;
      if (kind === 'products') {
        if (filters.brand && item.brand_id !== filters.brand) return false;
        if (filters.manufacturer && item.manufacturer_id !== filters.manufacturer) return false;
        if (filters.category && item.category_id !== filters.category) return false;
        if (filters.subcategory && item.subcategory_id !== filters.subcategory) return false;
        if (filters.subcategoryItem && item.subcategory_item_id !== filters.subcategoryItem) return false;
      }
      return true;
    });
  }, [data, filters, kind, options, search]);
  const draftItems = draft.map((id) => options.find((item) => item.id === id)).filter(Boolean);
  const visibleOptions = showSelected ? draftItems : filtered.slice(0, visibleLimit);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const begin = () => {
    setDraft(selected);
    setSearch('');
    setVisibleLimit(100);
    setFilters({ brand: '', manufacturer: '', category: '', subcategory: '', subcategoryItem: '' });
    setShowSelected(false);
    setOpen(true);
  };
  const toggle = (id) => setDraft((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const close = () => setOpen(false);
  const remove = (id) => onChange(selected.filter((item) => item !== id));

  return (
    <div className="universal-select field">
      <span className="field-title">{label}</span>
      <button className="universal-select-trigger" type="button" disabled={disabled} onClick={begin}>
        <Search size={15} /> {selected.length ? `Modifier la sélection (${selected.length})` : `Sélectionner ${label.toLowerCase()}`}
      </button>
      {selected.length > 0 ? (
        <div className="universal-selected" aria-label={`${selected.length} éléments sélectionnés`}>
          {selectedItems.map((item) => (
            <span className="universal-chip" key={item.id}>
              <span>{labelOf(item, kind)}</span>
              <button type="button" aria-label={`Retirer ${labelOf(item, kind)}`} onClick={() => remove(item.id)}><X size={13} /></button>
            </span>
          ))}
        </div>
      ) : <small className="muted">Aucun élément sélectionné</small>}
      {open && createPortal(
        <div className="universal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className="universal-dialog" role="dialog" aria-modal="true" aria-label={`Sélectionner ${label.toLowerCase()}`}>
            <header className="universal-heading">
              <div><strong>Sélectionner {label.toLowerCase()}</strong><span>{draft.length} sélectionné{draft.length === 1 ? '' : 's'}</span></div>
              <button className="icon-button" type="button" aria-label="Fermer" onClick={close}><X size={20} /></button>
            </header>
            <div className="universal-controls">
              <label className="search-input universal-search"><Search size={17} /><input autoFocus placeholder={`Rechercher ${label.toLowerCase()}…`} value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(100); setShowSelected(false); }} /></label>
              {kind === 'products' && (
                <div className="universal-filters">
                  {[
                    ['brand', 'Toutes les marques', data.brands, 'name'],
                    ['manufacturer', 'Tous les fabricants', data.manufacturers, 'legal_name'],
                    ['category', 'Toutes les catégories', data.product_categories, 'name'],
                    ['subcategory', 'Tous les titres', data.product_subcategories, 'name'],
                    ['subcategoryItem', 'Toutes les sous-catégories', data.product_subcategory_items, 'name'],
                  ].map(([key, placeholder, items, field]) => (
                    <label className="field" key={key}>
                      <span>{placeholder}</span>
                      <select value={filters[key]} onChange={(event) => { setFilters((current) => ({ ...current, [key]: event.target.value })); setVisibleLimit(100); setShowSelected(false); }}>
                        <option value="">{placeholder}</option>
                        {items.map((item) => <option key={item.id} value={item.id}>{item[field]}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <div className="universal-toolbar">
                <span>{showSelected ? `${draftItems.length} sélectionnés` : `${filtered.length} résultat${filtered.length === 1 ? '' : 's'}${filtered.length > 100 ? ' · 100 affichés' : ''}`}</span>
                <button type="button" onClick={() => { setDraft((current) => [...new Set([...current, ...filtered.map((item) => item.id)])]); setShowSelected(false); }}>Tout sélectionner</button>
                <button type="button" onClick={() => setDraft([])}>Tout désélectionner</button>
                <button type="button" onClick={() => setShowSelected((current) => !current)}>{showSelected ? 'Voir les résultats' : 'Voir la sélection'}</button>
              </div>
            </div>
            <div className="universal-options" role="list">
              {visibleOptions.map((item) => {
                const isSelected = draft.includes(item.id);
                const subtitle = kind === 'products'
                  ? [item.internal_reference, item.ean_gtin && `EAN ${item.ean_gtin}`, data.brands.find((brand) => brand.id === item.brand_id)?.name].filter(Boolean).join(' · ')
                  : item.legal_name && kind !== 'manufacturers' ? item.legal_name : '';
                return (
                  <button className={`universal-option${isSelected ? ' universal-option-selected' : ''}`} type="button" key={item.id} onClick={() => toggle(item.id)} role="listitem" aria-pressed={isSelected}>
                    <span className="universal-checkbox">{isSelected && <Check size={14} />}</span>
                    <span className="universal-option-copy"><strong>{labelOf(item, kind)}</strong>{subtitle && <small>{subtitle}</small>}</span>
                  </button>
                );
              })}
              {!visibleOptions.length && <p className="universal-empty">Aucun résultat. Modifiez la recherche ou les filtres.</p>}
              {!showSelected && filtered.length > visibleLimit && <button className="universal-load-more" type="button" onClick={() => setVisibleLimit((current) => current + 100)}>Afficher 100 résultats supplémentaires ({filtered.length - visibleLimit} restants)</button>}
            </div>
            <footer className="universal-footer">
              <span>{draft.length} sélectionné{draft.length === 1 ? '' : 's'}</span>
              <button className="button button-quiet" type="button" onClick={close}>Annuler</button>
              <button className="button button-primary" type="button" onClick={() => { onChange(draft); close(); }}><Check size={15} /> Valider</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
      {selected.length > 0 && !selectedItems.length && <small className="muted">{[...selected].map((id) => names.get(id) || id).join(', ')}</small>}
    </div>
  );
}
