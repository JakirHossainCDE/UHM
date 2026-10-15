# UHM — Urban Climate Explorer

A full-screen map with the original frosted weather and forecast panels.
An interactive, open-data explorer of modelled
weather and air quality, developed from the Urban Heat Mapping project by
**Amna Azeem and Md Jakir Hossain**.

**[Open the explorer →](https://jakirhossaincde.github.io/UHM/)**

## Explore

- **Find a place:** search cities worldwide, enter `latitude, longitude`, select
  Dhaka / Rome / Salzburg, click the map, or inspect its centre using the keyboard.
- **Choose your context:** free OpenStreetMap light and dark maps, regular
  OpenStreetMap, Esri satellite imagery, or OpenTopoMap terrain. Light/dark
  display styling affects only basemap tiles, never indicator colours. No map
  API key is required. Theme preferences are remembered.
- **Inspect conditions:** modelled air temperature, feels-like temperature,
  humidity, wind, rain probability, U.S. AQI and PM₂.₅. Model timestamps and
  retrieval times are separate; each place uses its own timezone.
- **Explore five indicator layers:** temperature (°C), humidity (%), wind
  (km/h with direction arrows), hourly precipitation (mm), and U.S. AQI. An
  edge-to-edge 9 × 9 set of 81 model samples replaces the old large blocks.
  Smooth surface and Fine cells interpolate between the samples; Sample points
  displays the source estimates. Display detail ranges from 1 to 12 pixels,
  with an automatic performance limit on large screens.
- **Control the map:** adjust layer opacity, show sample values, hide the overlay,
  pause automatic updates, refresh the layer, and hide the weather/forecast panels.
  Hover the map for an interpolated value, inspect source markers for all five
  readings, or click a location for its point forecast. Style and detail controls
  reuse downloaded data. Compare the selected place in Zoom Earth's external
  ICON map using the matching temperature, humidity, wind or precipitation link.
- **Look ahead:** an interactive 24-hour temperature / rain chart, an accessible
  hourly data table and seven-day forecasts.
- **Compare places:** add up to three locations, inspect their snapshots, refresh
  individual cards, or remove them. Comparison does not imply a heat-island ranking.
- **Take the data with you:** download a seven-day hourly CSV with timestamps,
  requested and model-grid coordinates, units and attribution. Copy a link to
  the selected location, zoom level, metric and basemap.
- **Read the research:** methodology, limitations, sources, the original report
  are available from the About panel. The Atlas basemap and external 3D atlas
  option have been removed.

No login, API key, database or build step is required for the deployed website.
Internet access is required for weather, place search, map tiles and web fonts.

## What the data means

This website is **not** a street-level sensor network, a satellite thermal map,
or a validated urban heat-island analysis. Air temperature is modelled at 2 m,
wind at 10 m. The Rain layer is the total precipitation over the preceding
hour, including rain, showers and snow water equivalent; charts retain rain
probability as a separate percentage. Wind arrows point toward the direction
the air moves (weather-service direction describes where it comes from). Satellite
imagery is a contextual basemap, not live imagery or land-surface temperature.
Nearby requested points can resolve to the same weather model cell. Zooming the
map or selecting a smaller display pixel does not increase meteorological resolution.
The raster uses bilinear interpolation in geographic coordinates and is drawn
in Web Mercator to align with the basemap. It leaves missing source values,
conflicting timestamps and areas outside the loaded samples unfilled. Wind arrows
show source vectors; only wind speed is interpolated. AQI category colours apply
to the rounded interpolated index. Opacity can be reduced to see map labels.

Map weather comes from [DWD ICON through Open-Meteo](https://open-meteo.com/en/docs/dwd-api),
with approximate native resolutions of 11 km globally, 7 km in Europe and 2 km
in parts of Central Europe. Sampling can be much coarser when viewing a large
region. Selected-point cards and forecasts use Open-Meteo's best-match models,
so their values can differ from the ICON map. Air quality uses
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
  Layer requests batch 81 locations into one ICON and one CAMS request, load
  initially, and update after map movements settle (850 ms debounce, at least
  20 seconds between automatic batches). Each area is cached for ten minutes.
  Multi-location requests count toward provider usage limits per location.
  Each batch requests only one weather hour and current AQI. Indicator switches reuse all
  five loaded values; Refresh layer bypasses the cache. Auto-update can be
  paused. No background time-based polling or tile prefetching is used.
- The layer uses the viewport at request time; panning cancels that request.
  A retained layer from another area is dimmed and labelled until updated.
  Cached data is paired with the current display geometry when wrapping the world.
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
GPS permission failures, sharing, CSV download, display-cell boundaries,
bilinear interpolation, Mercator projection, missing-data masks, AQI raster
boundaries, pixel budgets, layer visibility and opacity, all five metrics,
wind direction, precipitation units, automatic updates and stale viewport
cancellation. These are **not visual browser
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
| `modules/surface.js` | Source lattice, interpolation, Mercator raster and comparison URLs |
| `modules/surface-layer.js` | Leaflet canvas overlay, display modes and raster reuse |
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
Zoom Earth is linked for comparison only. Its tiles, images and code are not
embedded or redistributed, and UHM is not affiliated with Zoom Earth.
