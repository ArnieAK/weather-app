// Calls to the Open-Meteo APIs (free, no API key needed).
// Docs: https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/geocoding-api

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/**
 * Find places matching a name.
 * Returns a list of { id, name, region, country, lat, lon }.
 */
export async function searchCities(query, signal) {
  const params = new URLSearchParams({ name: query, count: 6, language: 'en', format: 'json' });
  const data = await getJson(`${GEOCODING_URL}?${params}`, signal);

  // The API leaves out "results" entirely when nothing matches.
  return (data.results || []).map((place) => ({
    id: String(place.id),
    name: place.name,
    region: place.admin1 || '',
    country: place.country || '',
    lat: place.latitude,
    lon: place.longitude,
  }));
}

/**
 * Get current conditions and a 7-day daily forecast for a location.
 * unit is 'C' or 'F'. Imperial also switches wind speed to mph.
 */
export async function getForecast(lat, lon, unit = 'C') {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'weather_code',
      'is_day',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
    ].join(','),
    timezone: 'auto', // times come back in the city's local time
    forecast_days: 7,
    temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: unit === 'F' ? 'mph' : 'kmh',
  });
  return getJson(`${FORECAST_URL}?${params}`);
}
