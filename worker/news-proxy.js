// Cloudflare Worker: a small proxy between the weather app and the GNews API.
//
// Why it exists: GNews needs a secret API key. Code that runs in the browser can't keep a
// secret, because anyone can read it in the browser's developer tools. So the app asks this
// Worker for news, and the Worker adds the key on the server, where visitors can't see it.
// It also solves CORS: the Worker tells the browser which sites may read its replies.
//
//   Request:  GET https://<your-worker>.workers.dev/?q=Oslo
//   Reply:    { "articles": [{ "title", "url", "source", "publishedAt", "image" }] }
//   or error: { "error": "A message that is safe to show on the page" } with a 4xx/5xx status
//
// Settings (Cloudflare dashboard -> your Worker -> Settings -> Variables and Secrets):
//   GNEWS_API_KEY    secret, required. Your key from https://gnews.io
//   ALLOWED_ORIGINS  text, optional. Comma-separated sites allowed to use this Worker, e.g.
//                    "http://127.0.0.1:5500,https://yourname.github.io". If empty, any site may.

const GNEWS_URL = 'https://gnews.io/api/v4/search';
const TIMEOUT_MS = 10000;
const CACHE_MINUTES = 30;

// Recent answers, kept while this Worker instance is running. Searching the same city
// twice then costs one GNews request instead of two, which matters on the free plan's
// 100 requests a day.
const cache = new Map(); // "oslo" -> { expires, body }

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return reply({ error: 'This website is not allowed to use the news proxy.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return reply({ error: 'Only GET requests are supported.' }, 405, cors);

    const place = (new URL(request.url).searchParams.get('q') || '').trim();
    if (place.length < 2 || place.length > 80) {
      return reply({ error: 'Add a place name of 2 to 80 characters, for example ?q=Oslo' }, 400, cors);
    }
    if (!env.GNEWS_API_KEY) {
      return reply({ error: 'The news proxy has no API key set up yet.' }, 500, cors);
    }

    const cacheKey = place.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return reply(cached.body, 200, cors);

    // Ask GNews for recent English articles containing the exact place name.
    const params = new URLSearchParams({
      q: `"${place.replace(/"/g, '')}"`,
      lang: 'en',
      max: '10',
      sortby: 'publishedAt',
      apikey: env.GNEWS_API_KEY,
    });

    let res;
    try {
      res = await fetch(`${GNEWS_URL}?${params}`, {
        // Some APIs refuse requests that don't say what's calling them.
        headers: { 'User-Agent': 'weather-app-news-proxy/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return reply({ error: 'The news provider took too long to answer.' }, 504, cors);
    }

    if (!res.ok) {
      const text = await res.text();
      // Full details go to the Worker's logs (Cloudflare dashboard -> your Worker -> Logs).
      console.log('GNews error', res.status, text.slice(0, 300));
      // GNews explains most errors in { "errors": [...] }. Pass that on as "detail", which
      // helps when testing the Worker's address directly; the app shows only "error".
      const detail = gnewsReason(text).split(env.GNEWS_API_KEY).join('[key]'); // never echo the key
      return reply({ error: friendlyError(res.status, detail), detail }, res.status === 429 || isQuota(res.status, detail) ? 429 : 502, cors);
    }

    const data = await res.json();
    // Send the app a simple format of our own, so the provider could be swapped later
    // without changing the app.
    const body = {
      articles: (data.articles || []).map((a) => ({
        title: a.title || '',
        url: a.url || '',
        source: a.source?.name || '',
        publishedAt: a.publishedAt || '',
        image: a.image || '',
      })),
    };

    cache.set(cacheKey, { expires: Date.now() + CACHE_MINUTES * 60000, body });
    if (cache.size > 200) cache.delete(cache.keys().next().value); // drop the oldest entry
    return reply(body, 200, cors);
  },
};

// GNews's error codes, worded for the person using the app.
// 403 usually means the daily quota is used up, but GNews also uses it for other refusals
// (e.g. an account that isn't activated), so only say "limit" when GNews's reason says so.
const isQuota = (status, detail) => status === 403 && /quota|limit|exceed/i.test(detail);

function friendlyError(status, detail) {
  if (isQuota(status, detail)) return "Today's free news limit has been used up. Try again tomorrow.";
  if (status === 400) return 'The news search was not understood.';
  if (status === 401) return "The news proxy's API key was rejected.";
  if (status === 403) return 'The news provider refused the request.';
  if (status === 429) return 'Too many news searches at once. Try again in a moment.';
  return 'The news provider had a problem.';
}

// Pulls GNews's own explanation out of an error reply. Returns '' if there isn't one
// (for example an HTML error page).
function gnewsReason(text) {
  try {
    const errors = JSON.parse(text).errors;
    const parts = Array.isArray(errors) ? errors : Object.values(errors || {});
    return parts.map(String).join(' ').slice(0, 300);
  } catch {
    return '';
  }
}

// Decides whether the website asking may read the reply (CORS).
// Returns the headers to send, or null if that website isn't allowed.
function corsHeaders(request, env) {
  const headers = { 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' };
  const origin = request.headers.get('Origin');
  // No Origin means it wasn't a web page asking (e.g. opening the URL directly to test it).
  if (!origin) return headers;

  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((site) => site.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!allowed.length) return { ...headers, 'Access-Control-Allow-Origin': '*' };
  return allowed.includes(origin) ? { ...headers, 'Access-Control-Allow-Origin': origin } : null;
}

function reply(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      // Let the browser reuse a good answer for 10 minutes; never reuse errors.
      'Cache-Control': status === 200 ? 'public, max-age=600' : 'no-store',
    },
  });
}
