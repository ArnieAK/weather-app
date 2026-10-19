// Saves favourites, the last city viewed and the unit choice in localStorage.
// Every read and write is wrapped in try/catch: storage can be blocked
// (e.g. some private-browsing modes) and the app should still work without it.

const KEYS = {
  favourites: 'weatherApp.favourites',
  lastCity: 'weatherApp.lastCity',
  unit: 'weatherApp.unit',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: nothing useful we can do, so carry on.
  }
}

// Guards against old or hand-edited data that doesn't have the fields we need.
function isValidCity(city) {
  return Boolean(
    city && typeof city.id === 'string' && typeof city.name === 'string'
      && Number.isFinite(city.lat) && Number.isFinite(city.lon),
  );
}

// Store only the fields we need.
function toStored({ id, name, region = '', country = '', lat, lon }) {
  return { id, name, region, country, lat, lon };
}

export function getFavourites() {
  const list = read(KEYS.favourites, []);
  return Array.isArray(list) ? list.filter(isValidCity) : [];
}

export function isFavourite(id) {
  return getFavourites().some((city) => city.id === id);
}

/** Adds the city if it isn't saved, removes it if it is. Returns true if it's now a favourite. */
export function toggleFavourite(city) {
  const list = getFavourites();
  const exists = list.some((c) => c.id === city.id);
  const next = exists ? list.filter((c) => c.id !== city.id) : [...list, toStored(city)];
  write(KEYS.favourites, next);
  return !exists;
}

export function removeFavourite(id) {
  write(KEYS.favourites, getFavourites().filter((c) => c.id !== id));
}

export function getLastCity() {
  const city = read(KEYS.lastCity, null);
  return isValidCity(city) ? city : null;
}

export function setLastCity(city) {
  write(KEYS.lastCity, toStored(city));
}

export function getUnit() {
  return read(KEYS.unit, 'C') === 'F' ? 'F' : 'C';
}

export function setUnit(unit) {
  write(KEYS.unit, unit);
}
