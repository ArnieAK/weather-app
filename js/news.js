// Local headlines, fetched through our own news proxy (the Cloudflare Worker in /worker).
//
// The app never talks to the news provider (GNews) directly: that needs a secret API key,
// and anything in browser code is public. The Worker holds the key and adds it for us.

import { NEWS_PROXY_URL } from './config.js';

const TIMEOUT_MS = 15000;
const CACHE_MS = 15 * 60 * 1000; // reuse results for 15 minutes
const MAX_ARTICLES = 8;

const cache = new Map(); // city id -> { time, articles }

/** An error whose message is fine to show on the page. */
export class NewsError extends Error {}

/** True once the proxy address in config.js has been filled in. */
export function isNewsSetUp() {
  return NEWS_PROXY_URL.startsWith('https://') && !NEWS_PROXY_URL.includes('YOUR-');
}

/** Returns up to 8 recent articles mentioning the city: { title, url, source, time, image }. */
export async function getLocalNews(city, signal) {
  const cached = cache.get(city.id);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.articles;

  const res = await fetchWithTimeout(`${NEWS_PROXY_URL}?q=${encodeURIComponent(city.name)}`, signal);

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON: handled below.
  }

  if (!res.ok) {
    // The proxy sends a readable { error } message for every failure it knows about.
    throw new NewsError(data?.error || `The news server had a problem (error ${res.status}).`);
  }
  if (!Array.isArray(data?.articles)) {
    throw new NewsError('The news server sent a reply the app could not read.');
  }

  const articles = tidy(data.articles);
  cache.set(city.id, { time: Date.now(), articles });
  return articles;
}

async function fetchWithTimeout(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (signal?.aborted) throw err; // the user moved on to another city; not an error
    if (err.name === 'AbortError') throw new NewsError('The news server took too long to answer.');
    // fetch only throws like this when there's no reply at all: offline, wrong address,
    // or the browser blocked it (e.g. this site isn't in the proxy's ALLOWED_ORIGINS).
    throw new NewsError("Couldn't reach the news server. Check your connection.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/* ---------- Cleaning up results ---------- */

const isWebLink = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function tidy(rawArticles) {
  const seen = new Set();
  const articles = [];

  for (const a of rawArticles) {
    const title = String(a.title || '').replace(/\s+/g, ' ').trim();
    // Only keep real web links, so a bad entry can't become a javascript: link.
    if (!title || !isWebLink(a.url)) continue;

    // The same story is often syndicated to many sites, so drop repeated titles.
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const time = new Date(a.publishedAt);
    articles.push({
      title,
      url: a.url,
      source: String(a.source || new URL(a.url).hostname),
      time: Number.isNaN(time.getTime()) ? null : time,
      image: String(a.image || '').startsWith('https://') ? a.image : '',
    });
    if (articles.length === MAX_ARTICLES) break;
  }
  return articles;
}
