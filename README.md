# UHM — Urban Climate Atlas

**Your city. A closer look.** An interactive, open-data explorer of modelled
weather and air quality, developed from the Urban Heat Mapping project by
**Amna Azeem and Md Jakir Hossain**.

**[Open the atlas →](https://jakirhossaincde.github.io/UHM/)**

## Explore

- **Find a place:** search cities worldwide, enter `latitude, longitude`, select
  Dhaka / Rome / Salzburg, click the map, or inspect its centre using the keyboard.
- **Choose your context:** theme-aware CARTO atlas, OpenStreetMap streets, Esri
  satellite imagery, or OpenTopoMap terrain. Light and dark themes remember your
  preference.
- **Inspect conditions:** modelled air temperature, feels-like temperature,
  humidity, wind, rain probability, U.S. AQI and PM₂.₅. Model timestamps and
  retrieval times are separate; each place uses its own timezone.
- **Sample the view:** request a discrete 3 × 3 grid of model estimates. Switch
  between temperature, humidity, wind, rain probability and AQI. No interpolation
  or synthetic continuous heat surface is drawn.
- **Look ahead:** an interactive 24-hour temperature / rain chart, an accessible
  hourly data table and seven-day forecasts.
- **Compare places:** add up to three locations, inspect their snapshots, refresh
  individual cards, or remove them. Comparison does not imply a heat-island ranking.
- **Take the data with you:** download a seven-day hourly CSV with timestamps,
  requested and model-grid coordinates, units and attribution. Copy a link to
  the selected location, zoom level, metric and basemap.
- **Read the research:** methodology, limitations, sources, the original report
  and the separate GlobalBuildingAtlas viewer are available from the About panel.

No login, API key, database or build step is required for the deployed website.
Internet access is required for weather, place search, map tiles and web fonts.

## What the data means

This website is **not** a street-level sensor network, a satellite thermal map,
or a validated urban heat-island analysis. Air temperature is modelled at 2 m,
wind at 10 m; rain probability refers to the current forecast hour. Satellite
imagery is a contextual basemap, not live imagery or land-surface temperature.
Nearby requested points can resolve to the same weather model cell. Zooming the
map does not increase meteorological resolution.

Weather comes from [Open-Meteo](https://open-meteo.com/en/docs). Air quality uses
[CAMS forecasts through Open-Meteo](https://open-meteo.com/en/docs/air-quality-api)
(approximately 11 km in Europe and 45 km globally). Values are estimates, may be
delayed, and are not official warnings or safety-critical guidance.

The [original project report](Report%20Urban%20Heat%20Mapping%20(UHM).pdf) documents
the early concept. Its descriptions of proposed satellite analysis or a Python
processing backend should not be read as features of the current static website.

## Privacy and reliability

- GPS is requested **only** when someone chooses **My location** and grants
  browser permission. Coordinates are sent to the weather providers; searches
  are sent to Open-Meteo / GeoNames. Map providers receive tile requests.
- Sharing explicitly puts the selected coordinates in a URL. Selecting a place
  alone does not put GPS coordinates in browser history.
- Only the colour-theme preference is stored in local storage. Comparisons and
  weather caches are in memory, not a server or persistent location history.
- Point requests are cached for ten minutes, with an explicit refresh button.
  Sample requests batch nine locations and are only made on request, never on
  every map movement. There is no automatic background polling.
- Superseded requests are aborted and guarded against stale responses.
  Network timeouts, offline state, provider errors and partial air-quality
  outages are handled explicitly. Missing values remain missing, not zero.
- Forecasts use UTC epoch timestamps and the selected place's IANA timezone.
  Daily date buckets retain the calendar dates defined by the API.

Public providers impose usage limits and may be unavailable. High-traffic or
commercial deployments should review the current provider plans and terms before
launching; this research-oriented version does not guarantee a service level.

## Run locally

Use Python 3's standard library; Flask is not needed:

```sh
python3 app.py
```

Then open `http://127.0.0.1:8000`. Use `python3 app.py --port 8080` to select
another port. The server binds to loopback only. Because the site uses JavaScript
modules, serve it over HTTP rather than opening `index.html` as a `file://` URL.
GitHub Pages serves these same root files directly; `app.py` is not a production
backend.

## Development checks

Use Node.js 24.15+ (24 LTS) or a compatible newer version:

```sh
npm ci --ignore-scripts
npm run check
npm test
```

There are no browser runtime npm dependencies. Pinned development dependencies
are used only for DOM-level integration tests and HTML / CSS checks. Tests use
explicit synthetic fixtures in `tests/`; the website never imports those files
or shows fixture data. Tests make no external requests.

Coverage includes null handling, timezones and DST, AQI boundaries, coordinate
validation, dateline sampling, CSV injection protection, cancellation, caching,
provider failures, search, themes, basemaps, comparison, forecast navigation,
GPS permission failures, sharing and CSV download. These are **not visual browser
tests**. Before significant future releases, also inspect desktop and mobile
layouts in real browsers, test keyboard navigation, native GPS permission and
touch gestures on a device, and check external-provider availability.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Semantic explorer, dialogs, data-source and research information |
| `style.css` | Responsive layouts, light / dark tokens, map and chart styling |
| `script.js` | DOM, Leaflet map and interaction orchestration |
| `modules/core.js` | Pure validation, time, chart, colour, CSV and request-guard helpers |
| `modules/api.js` | Provider requests, timeouts, batching, caching and normalisation |
| `assets/mark.svg` | Original UHM contour-style mark |
| `vendor/leaflet/` | Pinned local Leaflet 1.9.4 distribution and licence |
| `tests/` | Deterministic unit and DOM integration tests |
| `scripts/check-site.js` | Local asset, ID, accessibility-reference and CSS syntax checks |
| `app.py` | Optional Python standard-library local server |

## Publishing and maintenance

The website uses the existing GitHub Pages deployment from the `main` branch
root. Keep its current Pages settings; there is no separate hosting service to
configure. Relative paths support the `/UHM/` project subdirectory. `.nojekyll`
marks the content as a plain static site.

After a change, run the checks above, commit the changed source, push `main`, and
wait for the Pages deployment to succeed. Update the asset version strings in
`index.html` when releasing new CSS or application code. Never add service-role
keys or private API credentials to this public repository. A previous version
can be restored by reverting the relevant commit, without rewriting history.

## Credits and licence

© 2025 — Concept by **Amna Azeem** and **Md Jakir Hossain**.
The original project declares distribution under the **GNU General Public
License v3.0**; that declaration is retained. See
[third-party notices](THIRD_PARTY_NOTICES.md) for Leaflet and external data sources.
Data, maps and imagery remain subject to their respective providers' licences.
