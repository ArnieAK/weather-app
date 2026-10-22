// Everything that changes the page. app.js decides *what* to show; this file decides *how*.
// Text from the API is always set with textContent (never innerHTML) so it can't inject HTML.

import { describeWeather } from './weatherCodes.js';

const $ = (selector) => document.querySelector(selector);

export const els = {
  form: $('#search-form'),
  input: $('#search-input'),
  results: $('#search-results'),
  locateBtn: $('#locate-btn'),
  unitToggle: $('#unit-toggle'),
  favSection: $('#favourites'),
  favList: $('#favourites-list'),
  status: $('#status'),
  welcome: $('#welcome'),
  current: $('#current'),
  favBtn: $('#fav-btn'),
  forecast: $('#forecast'),
  forecastList: $('#forecast-list'),
  news: $('#news'),
  newsSubtitle: $('#news-subtitle'),
  newsBody: $('#news-body'),
};

/** Small helper to build an element: el('li', { class: 'x', text: 'hi' }, [children]) */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

/** "West Yorkshire, United Kingdom", or coordinates when we have no place names. */
export function placeLabel(city) {
  const parts = [city.region, city.country].filter((p) => p && p !== city.name);
  return parts.length ? parts.join(', ') : `${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°`;
}

// "2026-10-19T07:24" -> "07:24". Times are already in the city's local time.
const timeOf = (isoString) => (isoString ? isoString.slice(11, 16) : '–');
// Rounds a number and uses a real minus sign (−) rather than a hyphen for negatives.
const round = (n) => (Number.isFinite(n) ? String(Math.round(n) || 0).replace('-', '−') : '–');

function dayName(dateString, index) {
  if (index === 0) return 'Today';
  // Build the date from its parts so it isn't shifted by the viewer's time zone.
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' });
}

/* ---------- Search results ---------- */

export function renderResults(results, activeIndex) {
  const items = results.map((city, i) => el('li', {
    id: `result-${i}`,
    class: 'result',
    role: 'option',
    'aria-selected': String(i === activeIndex),
    'data-index': i,
  }, [
    el('span', { class: 'result-name', text: city.name }),
    el('span', { class: 'result-place', text: placeLabel(city) }),
  ]));
  els.results.replaceChildren(...items);
  openResults();

  if (activeIndex >= 0) {
    els.input.setAttribute('aria-activedescendant', `result-${activeIndex}`);
    els.results.children[activeIndex].scrollIntoView({ block: 'nearest' });
  } else {
    els.input.removeAttribute('aria-activedescendant');
  }
}

export function renderResultsMessage(message) {
  els.results.replaceChildren(el('li', { class: 'result-message', text: message }));
  els.input.removeAttribute('aria-activedescendant');
  openResults();
}

function openResults() {
  els.results.hidden = false;
  els.input.setAttribute('aria-expanded', 'true');
}

export function hideResults() {
  els.results.hidden = true;
  els.results.replaceChildren();
  els.input.setAttribute('aria-expanded', 'false');
  els.input.removeAttribute('aria-activedescendant');
}

/* ---------- Favourites ---------- */

export function renderFavourites(favourites, currentId) {
  els.favSection.hidden = favourites.length === 0;
  els.favList.replaceChildren(...favourites.map((city) => el('li', {
    class: city.id === currentId ? 'chip is-current' : 'chip',
  }, [
    el('button', {
      type: 'button',
      class: 'chip-open',
      'data-id': city.id,
      title: placeLabel(city),
      text: city.name,
    }),
    el('button', {
      type: 'button',
      class: 'chip-remove',
      'data-remove-id': city.id,
      'aria-label': `Remove ${city.name} from favourites`,
      text: '×',
    }),
  ])));
}

export function setFavouriteButton(isFav) {
  els.favBtn.classList.toggle('is-fav', isFav);
  els.favBtn.setAttribute('aria-pressed', String(isFav));
  const label = isFav ? 'Remove from favourites' : 'Add to favourites';
  els.favBtn.setAttribute('aria-label', label);
  els.favBtn.title = label;
}

/* ---------- Unit toggle ---------- */

export function setUnitToggle(unit) {
  els.unitToggle.dataset.active = unit;
  els.unitToggle.setAttribute('aria-label', `Temperature in °${unit}. Switch to °${unit === 'C' ? 'F' : 'C'}`);
}

/* ---------- Status messages ---------- */

export function showLoading(message) {
  els.welcome.hidden = true;
  els.status.className = 'status is-loading';
  els.status.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), message);
  els.current.setAttribute('aria-busy', 'true');
}

export function showError(message, onRetry) {
  els.status.className = 'status is-error';
  const children = [el('span', { text: message })];
  if (onRetry) {
    const retry = el('button', { type: 'button', class: 'retry-btn', text: 'Try again' });
    retry.addEventListener('click', onRetry);
    children.push(retry);
  }
  els.status.replaceChildren(...children);
  els.current.removeAttribute('aria-busy');
  // If nothing has loaded yet, bring the welcome card back so the page isn't empty.
  if (els.current.hidden) els.welcome.hidden = false;
}

export function clearStatus() {
  els.status.className = 'status';
  els.status.replaceChildren();
  els.current.removeAttribute('aria-busy');
}

/* ---------- Weather ---------- */

export function renderWeather(city, data, unit, isFav) {
  const { current, daily } = data;
  const windUnit = unit === 'F' ? 'mph' : 'km/h';
  const isDay = current.is_day === 1;
  const now = describeWeather(current.weather_code, isDay);

  // Current conditions
  els.welcome.hidden = true;
  els.current.hidden = false;
  els.current.dataset.daytime = isDay ? 'day' : 'night';
  $('#current-name').textContent = city.name;
  $('#current-place').textContent = placeLabel(city);
  $('#current-icon').src = now.icon;
  $('#current-icon').alt = now.label;
  $('#current-temp').textContent = `${round(current.temperature_2m)}°${unit}`;
  $('#current-desc').textContent = now.label;
  $('#current-feels').textContent = `${round(current.apparent_temperature)}°`;
  $('#current-humidity').textContent = `${round(current.relative_humidity_2m)}%`;
  $('#current-wind').textContent = `${round(current.wind_speed_10m)} ${windUnit}`;
  $('#current-rain').textContent = `${round(daily.precipitation_probability_max?.[0])}%`;
  $('#current-sunrise').textContent = timeOf(daily.sunrise?.[0]);
  $('#current-sunset').textContent = timeOf(daily.sunset?.[0]);
  $('#current-time').textContent = `Updated ${timeOf(current.time)} local time`;
  setFavouriteButton(isFav);
  document.title = `${round(current.temperature_2m)}° ${city.name} – Weather`;

  renderForecast(daily);
}

function renderForecast(daily) {
  // The coldest and warmest temperatures of the week set the scale for the range bars.
  const lows = daily.temperature_2m_min.filter(Number.isFinite);
  const highs = daily.temperature_2m_max.filter(Number.isFinite);
  const weekMin = Math.min(...lows);
  const span = Math.max(...highs) - weekMin || 1;

  const days = daily.time.map((date, i) => {
    const { label, icon } = describeWeather(daily.weather_code[i], true);
    const min = daily.temperature_2m_min[i];
    const max = daily.temperature_2m_max[i];
    const rain = daily.precipitation_probability_max?.[i];

    const bar = el('span', { class: 'range-fill' });
    bar.style.setProperty('--start', `${((min - weekMin) / span) * 100}%`);
    bar.style.setProperty('--width', `${((max - min) / span) * 100}%`);

    return el('li', { class: 'day' }, [
      el('span', { class: 'day-name', text: dayName(date, i) }),
      el('img', { class: 'day-icon', src: icon, alt: label, title: label, width: 40, height: 40 }),
      el('span', {
        class: 'day-rain',
        title: 'Chance of rain',
        text: Number.isFinite(rain) ? `${rain}%` : '–',
      }),
      el('span', { class: 'day-temps' }, [
        el('span', { class: 'day-min', 'aria-label': `Low ${round(min)}°`, text: `${round(min)}°` }),
        el('span', { class: 'range', 'aria-hidden': 'true' }, [bar]),
        el('span', { class: 'day-max', 'aria-label': `High ${round(max)}°`, text: `${round(max)}°` }),
      ]),
    ]);
  });

  els.forecast.hidden = false;
  els.forecastList.replaceChildren(...days);
}

/* ---------- Local news ---------- */

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// Date -> "3 hours ago", "yesterday", "4 days ago"
function timeAgo(date) {
  if (!date) return '';
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (minutes > -60) return relativeTime.format(Math.min(minutes, -1), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relativeTime.format(hours, 'hour');
  return relativeTime.format(Math.round(hours / 24), 'day');
}

let slowNewsTimer = null;

function showNews(subtitle, ...content) {
  clearTimeout(slowNewsTimer);
  els.news.hidden = false;
  els.newsSubtitle.textContent = subtitle;
  els.newsBody.replaceChildren(...content);
}

// A backup that always works: a link to Google News for the same place.
function googleNewsLink(city) {
  return el('a', {
    class: 'news-fallback',
    href: `https://news.google.com/search?q=${encodeURIComponent(city.name)}`,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: `Search Google News for ${city.name} →`,
  });
}

export function showNewsLoading(city) {
  const text = el('span', { text: 'Loading local news…' });
  showNews(
    `Headlines mentioning ${city.name}`,
    el('p', { class: 'news-message' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), text]),
  );
  slowNewsTimer = setTimeout(() => {
    text.textContent = 'Still loading the news…';
  }, 5000);
}

/** A plain message, plus the Google News link when there's a city to search for. */
export function showNewsMessage(subtitle, message, city = null) {
  const content = [el('p', { class: 'news-message', text: message })];
  if (city) content.push(googleNewsLink(city));
  showNews(subtitle, ...content);
}

export function showNewsError(city, message, onRetry) {
  const retry = el('button', { type: 'button', class: 'retry-btn', text: 'Try again' });
  retry.addEventListener('click', onRetry);
  showNews(
    `Headlines mentioning ${city.name}`,
    el('p', { class: 'news-message is-error' }, [el('span', { text: message }), retry]),
    googleNewsLink(city),
  );
}

export function renderNews(city, articles) {
  const subtitle = `Headlines mentioning ${city.name}`;
  if (!articles.length) {
    showNewsMessage(subtitle, `No recent English-language news mentioning ${city.name}.`, city);
    return;
  }

  const items = articles.map((article) => {
    const meta = [article.source, timeAgo(article.time)].filter(Boolean).join(' · ');
    const children = [];

    if (article.image) {
      const img = el('img', {
        class: 'article-thumb',
        src: article.image,
        alt: '',
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
        width: 72,
        height: 72,
      });
      // Many news images block other sites from showing them; drop any that fail.
      img.addEventListener('error', () => img.remove());
      children.push(img);
    }
    children.push(el('span', { class: 'article-text' }, [
      el('span', { class: 'article-title', text: article.title }),
      el('span', { class: 'article-meta', text: meta }),
    ]));

    return el('li', { class: 'article' }, [
      el('a', { class: 'article-link', href: article.url, target: '_blank', rel: 'noopener noreferrer' }, children),
    ]);
  });

  showNews(subtitle, el('ul', { class: 'article-list' }, items));
}
