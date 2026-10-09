import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function countryCitiesPlugin() {
  const cityFile = fileURLToPath(new URL('./node_modules/country-state-city/lib/assets/city.json', import.meta.url));
  const regionFile = fileURLToPath(new URL('./node_modules/country-state-city/lib/assets/state.json', import.meta.url));
  let cities;
  let regions;
  const getCities = () => {
    if (!cities) cities = JSON.parse(readFileSync(cityFile, 'utf8'));
    return cities;
  };
  const getRegions = () => {
    if (!regions) regions = JSON.parse(readFileSync(regionFile, 'utf8'));
    return regions;
  };

  return {
    name: 'country-scoped-city-data',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = new URL(request.url || '/', 'http://localhost').pathname.match(/(?:^|\/)(geo-cities|geo-regions)\/([A-Z]{2})\.json$/);
        if (!match) {
          next();
          return;
        }
        const [collection, countryCode] = match.slice(1);
        const data = collection === 'geo-cities'
          ? getCities().filter((city) => city[1] === countryCode).map(([name, , stateCode]) => [name, stateCode])
          : getRegions().filter((region) => region.countryCode === countryCode).map(({ name, isoCode }) => [name, isoCode]);
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(data));
      });
    },
    generateBundle() {
      const emitByCountry = (directory, groupedData) => {
        for (const [countryCode, rows] of groupedData) {
          this.emitFile({
            type: 'asset',
            fileName: `${directory}/${countryCode}.json`,
            source: JSON.stringify(rows),
          });
        }
      };
      const citiesByCountry = new Map();
      for (const [name, countryCode, stateCode] of getCities()) {
        if (!/^[A-Z]{2}$/.test(countryCode || '')) continue;
        if (!citiesByCountry.has(countryCode)) citiesByCountry.set(countryCode, []);
        citiesByCountry.get(countryCode).push([name, stateCode]);
      }
      const regionsByCountry = new Map();
      for (const { name, countryCode, isoCode } of getRegions()) {
        if (!/^[A-Z]{2}$/.test(countryCode || '')) continue;
        if (!regionsByCountry.has(countryCode)) regionsByCountry.set(countryCode, []);
        regionsByCountry.get(countryCode).push([name, isoCode]);
      }
      emitByCountry('geo-cities', citiesByCountry);
      emitByCountry('geo-regions', regionsByCountry);
    },
  };
}

export default defineConfig({
  plugins: [react(), countryCitiesPlugin()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'supabase-vendor', test: /node_modules[\\/](?:@supabase|@supabase-js)[\\/]/ },
            { name: 'icons-vendor', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
});
