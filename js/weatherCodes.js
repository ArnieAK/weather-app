// Open-Meteo uses WMO weather codes. This maps each code to a label and an icon.
// Full list: https://open-meteo.com/en/docs (scroll to "WMO Weather interpretation codes")

const CODES = {
  0: ['Clear sky', 'clear'],
  1: ['Mainly clear', 'partly-cloudy'],
  2: ['Partly cloudy', 'partly-cloudy'],
  3: ['Overcast', 'cloudy'],
  45: ['Fog', 'fog'],
  48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle'],
  55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'],
  57: ['Heavy freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Heavy freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'],
  81: ['Showers', 'rain'],
  82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'thunderstorm'],
  96: ['Thunderstorm with hail', 'thunderstorm'],
  99: ['Severe thunderstorm with hail', 'thunderstorm'],
};

// Only these icons have separate day and night versions.
const HAS_NIGHT_VERSION = new Set(['clear', 'partly-cloudy']);

/** Returns { label, icon } where icon is a path to an SVG file. */
export function describeWeather(code, isDay = true) {
  const [label, name] = CODES[code] || ['Unknown', 'cloudy'];
  const file = HAS_NIGHT_VERSION.has(name) ? `${name}-${isDay ? 'day' : 'night'}` : name;
  return { label, icon: `assets/icons/${file}.svg` };
}
