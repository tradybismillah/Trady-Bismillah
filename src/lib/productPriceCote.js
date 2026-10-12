const PRICE_TYPE_WEIGHT = { traded: 3, announced: 1.5, observed: 0.75 };

function priceWeight(observation, now = Date.now()) {
  const ageDays = Math.max(0, (now - new Date(`${observation.occurred_at}T00:00:00`).getTime()) / 86_400_000);
  const freshness = 1 / (1 + ageDays / 180);
  const confidence = 0.5 + Math.max(1, Math.min(5, Number(observation.confidence) || 3)) / 10;
  return (PRICE_TYPE_WEIGHT[observation.price_type] || 0) * freshness * confidence;
}

function weightedQuantile(items, quantile, now) {
  const sorted = items.map((item) => ({
    value: Number(item.eur_per_uvc),
    weight: priceWeight(item, now),
  })).filter((item) => Number.isFinite(item.value) && item.value >= 0 && item.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (!sorted.length) return null;
  const target = sorted.reduce((sum, item) => sum + item.weight, 0) * quantile;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.value;
  }
  return sorted.at(-1).value;
}

export function calculateProductPriceCote(observations, side, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const comparable = observations.filter((item) => item.status === 'validated' && item.side === side
    && item.eur_per_uvc != null && (!item.valid_until || item.valid_until >= today));
  const types = Object.fromEntries(['traded', 'announced', 'observed'].map((type) => [
    type,
    comparable.filter((item) => item.price_type === type).length,
  ]));
  const suppliers = new Set(comparable.map((item) => item.contact_id).filter(Boolean)).size;
  const latestDate = comparable.reduce((latest, item) => !latest || item.occurred_at > latest ? item.occurred_at : latest, '');
  const count = comparable.length;
  const ageDays = latestDate ? Math.max(0, (now - new Date(`${latestDate}T00:00:00`).getTime()) / 86_400_000) : Infinity;
  const confidence = count >= 5 && suppliers >= 3 && ageDays <= 180 ? 'Élevée'
    : count >= 3 && ageDays <= 365 ? 'Moyenne'
      : count ? 'Faible' : 'Pas assez de données';
  return {
    value: weightedQuantile(comparable, 0.5, now),
    low: weightedQuantile(comparable, 0.25, now),
    high: weightedQuantile(comparable, 0.75, now),
    count,
    suppliers,
    latestDate,
    confidence,
    types,
    comparable,
  };
}

export function pricePerPackaging(pricePerUvc, quantityPerUvc) {
  const price = Number(pricePerUvc);
  const quantity = Number(quantityPerUvc);
  return Number.isFinite(price) && Number.isFinite(quantity) && quantity > 0 ? price * quantity : null;
}
