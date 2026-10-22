A weather app that feature local news of searched areas. Made by Claude Code as part of a school assignment. It has the following features:
- 7 Day forecast
- Search area, city or country
- Share your location and check local weather
- add to and remove from favorites
- Switch between celsius and fahrenheit (wind speed also switches from km/h to mph)
- 8 recent news articles mentioning the city that is being checked

The following error-handling is also implemented:
- Errors relating to shared locations, with fitting messages
- No search matches
- Errors relating to faults with the weather API, with fitting messages
- Errors relating to fault with the news API, with fitting messages

The YouTube video showcases most of these features and error-handlings
The news API required its own proxy server to run, the current link in config.js only works for my local pc. Steps to create your own server, to activate the
API are below. 
YouTube link: https://youtu.be/0q6BNg6Wn6M

# Weather

A simple weather website built with plain HTML, CSS and JavaScript. There is no build step and nothing to install.

- Search for any city, with suggestions as you type
- Current weather: temperature, feels-like, humidity, wind, chance of rain, sunrise and sunset
- 7-day forecast
- "Use my location" button
- Local news: recent headlines mentioning the city you searched
- Favourite cities, saved in your browser (localStorage)
- °C / °F switch (also saved)
- Works on phones and desktops, and follows your device's light or dark mode

Weather data comes from [Open-Meteo](https://open-meteo.com/), which is free and needs no API key. News comes from [GNews](https://gnews.io/) through a small proxy server (a Cloudflare Worker) that keeps the GNews API key secret. See [Setting up the news](#setting-up-the-news).

## Project structure

```
index.html            Page layout
css/styles.css        All styles (mobile-first, light and dark themes)
js/app.js             Entry point: app state and event listeners
js/api.js             Open-Meteo geocoding and forecast requests
js/news.js            Asks the news proxy for headlines (timeouts, caching, error messages)
js/config.js          The news proxy's address
js/ui.js              Updates the page (search results, weather, favourites, messages)
js/storage.js         Saves and loads favourites, last city and unit in localStorage
js/weatherCodes.js    Maps Open-Meteo weather codes to labels and icons
assets/icons/         Hand-made SVG weather icons
worker/news-proxy.js  Cloudflare Worker that holds the GNews key and adds CORS headers
worker/wrangler.toml  Only for deploying the Worker from the command line
```

## Running it locally

The JavaScript uses ES modules, which browsers won't load from a `file://` address. Opening `index.html` by double-clicking it won't work, so run a small local web server instead:

```bash
# from the project folder
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (The VS Code "Live Server" extension also works.)

"Use my location" only works on `https://` pages or `localhost`, which is a browser rule.

## Deploying to GitHub Pages

1. Create a new repository on GitHub and push these files to the `main` branch, with `index.html` at the top level of the repo.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, then click **Save**.
4. After a minute or so the site will be live at `https://<your-username>.github.io/<repo-name>/`.

All paths in the project are relative, so it works from a repository sub-path without changes.

## Setting up the news

The weather works without this. Until it's done, the news section says it isn't set up yet. It's a one-time job of about 10 minutes, using two free accounts.

1. **Get a GNews API key.** Sign up at [gnews.io](https://gnews.io/); your key is on the dashboard.
2. **Create the Worker.**
   1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/) (the free plan is enough).
   2. Open **Workers & Pages**, choose **Create**, and create a Worker from the "Hello World" starter. Name it `weather-news` and deploy it.
   3. Choose **Edit code**, replace everything with the contents of [`worker/news-proxy.js`](worker/news-proxy.js), and click **Deploy**.
   4. In the Worker's **Settings → Variables and Secrets**, add `GNEWS_API_KEY` as a **Secret** with your GNews key as the value.
   5. Optional: add `ALLOWED_ORIGINS` as **Text**, listing the sites that may use the Worker, e.g. `http://127.0.0.1:5500,https://<username>.github.io`.
3. **Check it works.** Open `https://weather-news.<your-subdomain>.workers.dev/?q=Oslo` in your browser. You should see JSON with a list of `articles`.
4. **Connect the app.** Put that address (without `?q=Oslo`) in [`js/config.js`](js/config.js).

Cloudflare's menus change now and then; if a button has moved, look for the same names nearby.

Command-line alternative: `cd worker`, then `npx wrangler deploy` and `npx wrangler secret put GNEWS_API_KEY`.

### Why a proxy?

GNews needs an API key, and anything in front-end code is public: visitors can read it in the page source or in the browser's network tab. A `.gitignore` doesn't help either, because GitHub Pages only serves what's in the repository, and the browser would still have to send the key with every request. So the key lives on the Worker as a secret, and the app only knows the Worker's address.

The Worker also:
- **Handles CORS:** it tells the browser which sites may read its replies.
- **Saves the daily quota:** it remembers each city's results for 30 minutes.
- **Hides provider details:** it turns GNews's error codes into plain messages.
- **Simplifies the reply:** it returns a format of its own, so the news provider could be swapped without changing the app.

The first version of this feature used the keyless [GDELT](https://www.gdeltproject.org/) API directly from the browser. It failed in practice: GDELT doesn't allow requests from web pages (no CORS header), took 15–35 seconds to answer, and quickly rate-limited requests (HTTP 429).

## Error handling

Every network request can fail, and each failure shows a clear message instead of a blank or broken page.

| Situation | What the user sees |
|---|---|
| Search finds nothing | "No places found for …" |
| Search request fails | "Search failed. Check your connection and try again." |
| Weather fails to load | Error banner with **Try again**; offline gets its own message |
| °C/°F switch fails | Numbers and toggle stay as they were, so they never disagree |
| Location permission denied, unavailable or too slow | A specific message for each, suggesting a city search instead |
| News not set up yet | Explains what to add to `js/config.js` |
| News server unreachable or too slow (15 s) | Message with **Try again**, plus a Google News link as a backup |
| GNews daily limit used up | "Today's free news limit has been used up. Try again tomorrow." |
| No news for a place | Says so, plus the Google News link |
| localStorage blocked | App works, just doesn't remember favourites |

News and weather fail independently: a news problem never hides the weather. Slow replies for a city the user has already left are ignored, so the screen never shows the wrong city's data.

## How it works

1. **Search**: typing calls the [geocoding API](https://open-meteo.com/en/docs/geocoding-api) after a 300 ms pause, which avoids a request on every keystroke. Use the arrow keys and Enter, or tap a result.
2. **Forecast**: the chosen place's latitude and longitude are sent to the [forecast API](https://open-meteo.com/en/docs) with `timezone=auto`, so all times are in the city's local time.
3. **Icons**: the API returns [WMO weather codes](https://open-meteo.com/en/docs#weathervariables), and `weatherCodes.js` maps each one to a description and an SVG icon. Clear and partly cloudy skies have separate night icons.
4. **Local news**: after the weather loads, `news.js` asks the news proxy for headlines mentioning the city. The proxy adds the secret key, asks GNews, and returns a simple list. The app removes repeated headlines and unsafe links, then shows up to 8 (see [Why a proxy?](#why-a-proxy)).
5. **Favourites**: the star button saves `{ id, name, region, country, lat, lon }` to localStorage. If storage is blocked (for example in some private-browsing modes), the app still works but won't remember anything.

## Known limitations

- Open-Meteo has no reverse geocoding, so a forecast from "Use my location" is labelled **My location** with its coordinates instead of a town name.
- Weather data needs an internet connection; there's no offline mode.
- News searches for the city's name in English-language articles, so a place that shares its name with another (Paris, France and Paris, Texas) can get mixed results. Small towns may have no results.
- GNews's free plan allows 100 requests a day and is for non-commercial use; check [their pricing page](https://gnews.io/#pricing) for current limits. The Worker's 30-minute memory makes the quota go further.
- "Use my location" can't show news, because there is no place name to search for.
- `ALLOWED_ORIGINS` only stops other *websites* from using the Worker. Anyone could still call it from a script, so a public app would also need rate limiting on the Worker.

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). News from [GNews](https://gnews.io/). Keep the footer credits.
