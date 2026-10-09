export function exchangeProductRates(product, details) {
  const parsedUnitPrice = details?.uvc_unit_price === '' || details?.uvc_unit_price == null
    ? null
    : Number(details.uvc_unit_price);
  const unitPrice = Number.isFinite(parsedUnitPrice) && parsedUnitPrice >= 0 ? parsedUnitPrice : null;
  const uvcPerPcb = Number(product?.quantity_uvc_pcb);
  const pcbPerPalette = Number(product?.quantity_pcb_palette);
  const pcbPrice = Number.isFinite(unitPrice) && Number.isFinite(uvcPerPcb) && uvcPerPcb > 0
    ? unitPrice * uvcPerPcb
    : null;
  const palettePrice = Number.isFinite(pcbPrice) && Number.isFinite(pcbPerPalette) && pcbPerPalette > 0
    ? pcbPrice * pcbPerPalette
    : null;
  return { uvc: unitPrice, pcb: pcbPrice, palette: palettePrice };
}

export function exchangeProductTotal(details, rates) {
  const parsedQuantity = details?.quantity === '' || details?.quantity == null
    ? null
    : Number(details.quantity);
  const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : null;
  const rate = rates[details?.packaging_level || 'uvc'];
  return Number.isFinite(quantity) && Number.isFinite(rate) ? quantity * rate : null;
}

export function exchangeProductStoredRates(product, details) {
  const calculatedRates = exchangeProductRates(product, details);
  return {
    uvc: calculatedRates.uvc,
    pcb: details?.pcb_unit_price == null ? calculatedRates.pcb : Number(details.pcb_unit_price),
    palette: details?.palette_unit_price == null ? calculatedRates.palette : Number(details.palette_unit_price),
  };
}

export function formatExchangeCurrency(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value));
}
