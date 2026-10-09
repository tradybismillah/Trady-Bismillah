const windows1252Decoder = new TextDecoder('windows-1252');
const windows1252Encoder = new Map(
  Array.from({ length: 256 }, (_, byte) => [
    windows1252Decoder.decode(Uint8Array.of(byte)),
    byte,
  ]),
);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function repairMojibakeToken(token) {
  let value = token;
  for (let attempt = 0; attempt < 3 && /[ÃÂâ]/u.test(value); attempt += 1) {
    const bytes = [];
    for (const character of value) {
      const byte = windows1252Encoder.get(character);
      if (byte === undefined) return value;
      bytes.push(byte);
    }
    try {
      const repaired = utf8Decoder.decode(Uint8Array.from(bytes));
      if (repaired === value) return value;
      value = repaired;
    } catch {
      return value;
    }
  }
  return value;
}

function repairMojibake(value) {
  return value.split(/(\s+)/u).map(repairMojibakeToken).join('');
}

export function parseTabularProducts(text) {
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === '\t' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) records.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('Le fichier comporte un champ entre guillemets qui ne se termine pas.');
  row.push(cell);
  if (row.some((value) => value.trim())) records.push(row);
  if (records.length < 2) throw new Error('Le fichier ne contient aucune ligne de produit.');

  const headers = records[0].map((header) => repairMojibake(header.trim()));
  const required = ['Désignation', 'EAN', 'Marque', 'Catégorie', 'Fabricant', 'Unités par colis', 'Colis par palette'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(', ')}.`);
  return records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`La ligne ${index + 2} contient ${values.length} colonnes au lieu de ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, repairMojibake(values[column].trim())]));
  });
}

export function numberFromSource(value, label, rowIndex, optional = false) {
  const cleaned = (value || '').trim().replace(',', '.');
  if (!cleaned && optional) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new Error(`Valeur « ${value} » invalide pour ${label}, ligne ${rowIndex}.`);
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) throw new Error(`Valeur hors limite pour ${label}, ligne ${rowIndex}.`);
  return parsed;
}

export function sourceSubunit(value) {
  const match = value?.trim().match(/^(\d+(?:[,.]\d+)?)\s*([a-zA-Z]*)/);
  if (!match) return { quantity: null, unit: 'unité' };
  const quantity = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  if (unit === 'g') return { quantity: quantity / 1000, unit: 'kg' };
  if (unit === 'kg') return { quantity, unit: 'kg' };
  if (unit === 'ml') return { quantity: quantity / 1000, unit: 'L' };
  if (unit === 'l') return { quantity, unit: 'L' };
  return { quantity, unit: 'unité' };
}
