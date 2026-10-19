# Weather

A simple weather website built with plain HTML, CSS and JavaScript. There is no build step and nothing to install.

- Search for any city, with suggestions as you type
- Current weather: temperature, feels-like, humidity, wind, chance of rain, sunrise and sunset
- 7-day forecast
- "Use my location" button
- Favourite cities, saved in your browser (localStorage)
- °C / °F switch (also saved)
- Works on phones and desktops, and follows your device's light or dark mode

Weather data comes from [Open-Meteo](https://open-meteo.com/), which is free and needs no API key.

## Project structure

```
index.html            Page layout
css/styles.css        All styles (mobile-first, light and dark themes)
js/app.js             Entry point: app state and event listeners
js/api.js             Open-Meteo geocoding and forecast requests
js/ui.js              Updates the page (search results, weather, favourites, messages)
js/storage.js         Saves and loads favourites, last city and unit in localStorage
js/weatherCodes.js    Maps Open-Meteo weather codes to labels and icons
assets/icons/         Hand-made SVG weather icons
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

## How it works

1. **Search**: typing calls the [geocoding API](https://open-meteo.com/en/docs/geocoding-api) after a 300 ms pause, which avoids a request on every keystroke. Use the arrow keys and Enter, or tap a result.
2. **Forecast**: the chosen place's latitude and longitude are sent to the [forecast API](https://open-meteo.com/en/docs) with `timezone=auto`, so all times are in the city's local time.
3. **Icons**: the API returns [WMO weather codes](https://open-meteo.com/en/docs#weathervariables), and `weatherCodes.js` maps each one to a description and an SVG icon. Clear and partly cloudy skies have separate night icons.
4. **Favourites**: the star button saves `{ id, name, region, country, lat, lon }` to localStorage. If storage is blocked (for example in some private-browsing modes), the app still works but won't remember anything.

## Known limitations

- Open-Meteo has no reverse geocoding, so a forecast from "Use my location" is labelled **My location** with its coordinates instead of a town name.
- Weather data needs an internet connection; there's no offline mode.

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The footer credit must stay to meet that licence.
