# WEX — Weather & Environment Explorer

An interactive map for exploring weather, air quality and location forecasts.
WEX combines five environmental layers with clear legends, compact markers,
light and dark themes, and one panel for all map controls.

**[Open the dashboard](https://jakirhossaincde.github.io/UHM/)** ·
**[Report an issue](https://github.com/JakirHossainCDE/UHM/issues)**

Maintained by **Md Jakir Hossain**.

The dashboard is now named WEX. The existing `UHM` repository and GitHub Pages
address are retained so that published links continue to work.

## Explore the dashboard

1. **Choose a location.** Search for a city, enter latitude and longitude, select
   Dhaka, Rome or Salzburg, click the map, or use **My location** with permission.
2. **Select a layer.** Switch between Temperature, Humidity, Wind, Rain and Air
   quality. The legend updates with each indicator; moving the pointer over the
   map reveals an interpolated estimate.
3. **Adjust the display.** Open **Settings** for smooth shading, fine cells or
   source points, display detail, opacity, sample values and automatic updates.
   Close Settings with the button or press Escape while inside the controls.
4. **Change the map.** The same panel contains Light map, Dark map, OpenStreetMap,
   Satellite imagery and Topographic options, plus location, sharing and comparison
   tools. The theme button updates the light/dark basemap when selected.
5. **Inspect and compare.** The selected-point card shows conditions and local
   timestamps. Explore the 24-hour chart or seven-day outlook, add up to three
   places to a comparison, or download the seven-day hourly forecast as CSV.
6. **Animate the wind.** Select **Play wind** to switch to the Wind layer and
   animate its arrows. **Pause wind** stops the motion. Arrow direction and relative
   speed come from the loaded model samples; the animation is illustrative, not
   a forecast timeline. It needs no additional requests.

Small markers identify selected and sampled locations without obscuring the map.
Tooltips provide units and context. The panel toggle in the header hides the
weather and forecast cards when more map space is needed. Controls and forecast
information support keyboard navigation; narrow screens use a scrollable layout.
Wind motion starts only on request, pauses when the page is hidden, and stops
when changing layers, showing sample labels or hiding/clearing the layer.
Reduced-motion preferences keep the arrows static.

## Layers and sources

| Layer | Measure | Map source |
| --- | --- | --- |
| Temperature | Air temperature at 2 m, °C | DWD ICON via Open-Meteo |
| Humidity | Relative humidity at 2 m, % | DWD ICON via Open-Meteo |
| Wind | Speed at 10 m, km/h; arrows show air movement | DWD ICON via Open-Meteo |
| Rain | Total precipitation over the preceding hour, mm | DWD ICON via Open-Meteo |
| Air quality | U.S. Air Quality Index | CAMS via Open-Meteo |

Selected-point cards and forecasts use Open-Meteo's **best-match weather models**,
so readings can differ from the ICON map. The point card also includes feels-like
temperature and PM₂.₅ when available. Precipitation amount and forecast rain
probability are presented separately.

Weather, air-quality and retrieval timestamps are kept distinct. Location
forecasts use the selected place's timezone; map-layer times are shown in UTC.
Source links, attribution and methodology are available in **About this project**.

### What the smooth map represents

WEX requests **81 source estimates in a 9 × 9 lattice** across the visible area.
It uses bilinear interpolation and draws a Web Mercator canvas aligned with the
basemap. Smooth surface blends display pixels; Fine cells keeps their edges
visible; Sample points shows source estimates. Wind arrows remain source vectors
rather than interpolated directions.

Display detail can be as fine as **one screen pixel**, with an automatic pixel
budget on large screens. This is display detail, not additional weather
information. ICON's approximate native resolution is 11 km globally, 7 km in
Europe and 2 km in parts of Central Europe through this provider. CAMS grids are
approximately 11 km in Europe and 45 km globally. Sampling can be coarser when
viewing a large region, and nearby requests can resolve to the same model cell.

Missing values, conflicting model times and areas outside the loaded samples
remain unfilled. AQI colours follow the category of the rounded interpolated
index. The layers are model estimates, not street-level sensors, satellite
land-surface temperature or a validated urban heat-island assessment. They
should not be treated as official warnings.

The **Zoom Earth** link opens its separate ICON map for the selected place and
supported indicator. No Zoom Earth tiles, imagery or code are embedded, and no
matching air-quality link is shown. Satellite basemaps provide geographical
context; they are not live imagery.

## Privacy and reliability

- No account, API key or database is required for this research-oriented deployment.
- GPS is requested only after selecting **My location** and granting permission.
  Coordinates go to weather providers; searches go to Open-Meteo / GeoNames;
  map providers receive tile requests.
- **Share** creates a link containing the selected coordinates, zoom, layer and
  basemap. Selecting a location alone does not put GPS coordinates in browser history.
- Only the theme preference is stored locally. Earlier preferences remain
  compatible. Comparison places and data caches stay in memory.
- Layer requests use one ICON batch and one CAMS batch. Automatic updates follow
  map movement after a short debounce, with at least 20 seconds between batches.
  Cached areas and point forecasts are reused for ten minutes. Refresh bypasses
  the cache; display controls reuse data without additional requests.
- Superseded requests are cancelled. Provider failures, offline state, timeouts,
  partial responses and retained data from a previous area are labelled.

Multi-location queries count toward provider limits per location. Public API and
tile services may be unavailable or rate-limited. Review provider terms and plans
before a high-traffic or commercial deployment. No offline tile downloading or
background polling is implemented.

## Run locally

The production site uses plain HTML, CSS and JavaScript modules. No build is needed.
With Python 3 installed, run:

```sh
python3 app.py
```

Open `http://127.0.0.1:8000`. Use `python3 app.py --port 8080` for another port.
The server binds to loopback and is intended for local development. Serve files
over HTTP; JavaScript modules will not work reliably from a `file://` URL.

### Development checks

Use Node.js 24.15+ or a compatible newer release:

```sh
npm ci --ignore-scripts
npm run check
npm test
```

Development dependencies support unit tests, DOM-level interaction checks with
Leaflet, and HTML/CSS validation. They are not required by the deployed site.
Tests use synthetic fixtures and make no external requests. They cover data gaps,
timestamps, interpolation, projection, pixel budgets, requests, map controls,
forecasts, comparison, keyboard interactions, sharing and exports.

These checks do not replace visual browser testing. Check desktop and mobile
layouts, native location permission and touch interactions in real browsers
when that environment is available.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Dashboard structure, controls and methodology |
| `style.css` | Responsive layout, themes, typography and map styling |
| `script.js` | Application state, Leaflet map and user interactions |
| `modules/core.js` | Validation, time, colour, charts, CSV and request helpers |
| `modules/api.js` | Provider requests, batching, caching and normalisation |
| `modules/surface.js` | Sampling, interpolation and projected raster rendering |
| `modules/surface-layer.js` | Leaflet canvas overlay and display modes |
| `assets/mark.svg` | WEX favicon |
| `vendor/leaflet/` | Bundled Leaflet 1.9.4 and its licence |
| `tests/` | Unit and DOM integration checks |
| `scripts/check-site.js` | Asset, accessibility-reference and CSS checks |
| `app.py` | Optional local development server |

## Publish on GitHub Pages

This repository deploys from the **root of `main`** using its existing GitHub Pages
configuration. Run the checks, commit and push to `main`, then confirm that the
Pages deployment succeeds. Relative paths preserve the `/UHM/` project address.
Update asset version strings when releasing changed CSS or JavaScript.

There is no production Python backend or separate database to configure. Do not
commit private credentials. Restore an earlier release by reverting its commit
instead of rewriting repository history.

## Research and acknowledgements

The dashboard developed from the original Urban Heat Mapping research concept.
The [original report](Report%20Urban%20Heat%20Mapping%20(UHM).pdf) remains available
as historical documentation; its proposed methods are not all implemented here.

The original project's **GNU GPL v3.0** distribution declaration is retained.
See [third-party notices](THIRD_PARTY_NOTICES.md) for software, data and map
attribution. Those resources remain subject to their providers' licences.
WEX is not affiliated with Zoom Earth or its data providers.
