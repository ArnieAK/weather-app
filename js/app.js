// Entry point: holds the app state and wires up all the event listeners.

import { searchCities, getForecast } from './api.js';
import { getLocalNews, isNewsSetUp, NewsError } from './news.js';
import * as store from './storage.js';
import * as ui from './ui.js';

const { els } = ui;

const state = {
  city: null, // the city currently shown
  unit: store.getUnit(), // 'C' or 'F'
  results: [], // current search results
  activeIndex: -1, // highlighted search result (keyboard navigation)
};

let debounceTimer = null;
let searchController = null; // lets us cancel an older search when the user keeps typing
let loadCount = 0; // used to ignore slow responses for a city the user has moved away from
let newsController = null; // cancels news for a city the user has moved away from
let newsCityId = null; // the city the news section is showing (or loading)

/* ---------- Loading weather ---------- */

// The unit only changes once the new data has arrived, so the °C/°F toggle
// never disagrees with the numbers on screen if a request fails.
async function loadCity(city, unit = state.unit) {
  const thisLoad = ++loadCount;
  state.city = city;
  ui.showLoading(`Loading weather for ${city.name}…`);

  try {
    const data = await getForecast(city.lat, city.lon, unit);
    if (thisLoad !== loadCount) return; // a newer request has started since
    setUnit(unit);
    ui.renderWeather(city, data, unit, store.isFavourite(city.id));
    ui.clearStatus();
    store.setLastCity(city);
    refreshFavourites();
    loadNews(city);
  } catch (err) {
    if (thisLoad !== loadCount) return;
    console.error(err);
    const message = navigator.onLine
      ? `Couldn't load the weather for ${city.name}.`
      : 'You seem to be offline. Check your connection.';
    ui.showError(message, () => loadCity(city, unit));
  }
}

/* ---------- Local news ---------- */

// News loads after the weather, and never blocks it: if news fails, the weather still shows.
async function loadNews(city, { retry = false } = {}) {
  // Switching °C/°F reloads the weather for the same city; the news doesn't need reloading.
  if (city.id === newsCityId && !retry) return;
  newsController?.abort();
  newsCityId = city.id;

  if (!isNewsSetUp()) {
    ui.showNewsMessage(
      `Headlines mentioning ${city.name}`,
      'Local news isn\'t set up yet: add your news proxy address in js/config.js (see the README).',
      city,
    );
    return;
  }

  // "My location" has no place name to search the news for.
  if (city.id.startsWith('loc:')) {
    ui.showNewsMessage('Headlines for your area', 'Local news needs a place name. Search for a city to see its headlines.');
    return;
  }

  const controller = new AbortController();
  newsController = controller;
  ui.showNewsLoading(city);

  try {
    const articles = await getLocalNews(city, controller.signal);
    if (controller.signal.aborted) return;
    ui.renderNews(city, articles);
  } catch (err) {
    if (controller.signal.aborted || err.name === 'AbortError') return;
    console.error(err);
    const message = err instanceof NewsError ? err.message : "Couldn't load the news.";
    ui.showNewsError(city, message, () => loadNews(city, { retry: true }));
  }
}

/* ---------- Search ---------- */

async function runSearch(query) {
  searchController?.abort();
  searchController = new AbortController();

  try {
    const results = await searchCities(query, searchController.signal);
    state.results = results;
    state.activeIndex = -1;
    if (results.length) ui.renderResults(results, -1);
    else ui.renderResultsMessage(`No places found for “${query}”`);
    return results;
  } catch (err) {
    if (err.name === 'AbortError') return null; // replaced by a newer search
    console.error(err);
    state.results = [];
    ui.renderResultsMessage('Search failed. Check your connection and try again.');
    return null;
  }
}

function closeSearch() {
  clearTimeout(debounceTimer);
  searchController?.abort();
  state.results = [];
  state.activeIndex = -1;
  ui.hideResults();
}

function selectResult(index) {
  const city = state.results[index];
  if (!city) return;
  closeSearch();
  els.input.value = '';
  els.input.blur(); // closes the on-screen keyboard on phones
  loadCity(city);
}

function moveHighlight(step) {
  const count = state.results.length;
  if (!count || els.results.hidden) return;
  state.activeIndex = (state.activeIndex + step + count) % count;
  ui.renderResults(state.results, state.activeIndex);
}

els.input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = els.input.value.trim();
  if (query.length < 2) {
    closeSearch();
    return;
  }
  // Wait until the user pauses typing before calling the API.
  debounceTimer = setTimeout(() => runSearch(query), 300);
});

els.input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlight(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlight(-1);
  } else if (event.key === 'Escape') {
    closeSearch();
  }
});

// Enter: pick the highlighted result, or search right away and take the top match.
els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.activeIndex >= 0) {
    selectResult(state.activeIndex);
    return;
  }
  const query = els.input.value.trim();
  if (!query) return;
  clearTimeout(debounceTimer);
  const results = await runSearch(query);
  if (results?.length) selectResult(0);
});

els.results.addEventListener('click', (event) => {
  const item = event.target.closest('[data-index]');
  if (item) selectResult(Number(item.dataset.index));
});

// Close the result list when clicking anywhere else on the page.
document.addEventListener('click', (event) => {
  if (!els.form.contains(event.target)) closeSearch();
});

/* ---------- Use my location ---------- */

const LOCATION_ERRORS = {
  1: 'Location permission was denied. You can search for a city instead.',
  2: "Your location couldn't be found. Try searching for a city.",
  3: 'Finding your location took too long. Please try again.',
};

els.locateBtn.addEventListener('click', () => {
  closeSearch();
  if (!('geolocation' in navigator)) {
    ui.showError("Your browser doesn't support location. Search for a city instead.");
    return;
  }

  els.locateBtn.disabled = true;
  ui.showLoading('Finding your location…');

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      els.locateBtn.disabled = false;
      // Open-Meteo has no reverse geocoding, so we label it "My location" and show coordinates.
      const lat = Number(coords.latitude.toFixed(4));
      const lon = Number(coords.longitude.toFixed(4));
      loadCity({ id: `loc:${lat.toFixed(2)},${lon.toFixed(2)}`, name: 'My location', region: '', country: '', lat, lon });
    },
    (error) => {
      els.locateBtn.disabled = false;
      ui.showError(LOCATION_ERRORS[error.code] || LOCATION_ERRORS[2]);
    },
    { timeout: 10000, maximumAge: 10 * 60 * 1000 },
  );
});

/* ---------- Favourites ---------- */

function refreshFavourites() {
  ui.renderFavourites(store.getFavourites(), state.city?.id);
}

els.favBtn.addEventListener('click', () => {
  if (!state.city) return;
  ui.setFavouriteButton(store.toggleFavourite(state.city));
  refreshFavourites();
});

els.favList.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('[data-remove-id]');
  if (removeBtn) {
    const id = removeBtn.dataset.removeId;
    store.removeFavourite(id);
    if (state.city?.id === id) ui.setFavouriteButton(false);
    refreshFavourites();
    return;
  }
  const openBtn = event.target.closest('[data-id]');
  if (openBtn) {
    const city = store.getFavourites().find((c) => c.id === openBtn.dataset.id);
    if (city) loadCity(city);
  }
});

/* ---------- °C / °F ---------- */

function setUnit(unit) {
  state.unit = unit;
  store.setUnit(unit);
  ui.setUnitToggle(unit);
}

els.unitToggle.addEventListener('click', () => {
  const nextUnit = state.unit === 'C' ? 'F' : 'C';
  if (state.city) loadCity(state.city, nextUnit);
  else setUnit(nextUnit);
});

/* ---------- Start ---------- */

ui.setUnitToggle(state.unit);
refreshFavourites();
const lastCity = store.getLastCity();
if (lastCity) loadCity(lastCity);
