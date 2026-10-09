export function exchangeScenarioValues(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((scenario) => String(scenario).trim()).filter(Boolean))];
}

export function hasExchangeScenario(value, scenario) {
  return exchangeScenarioValues(value).includes(scenario);
}
