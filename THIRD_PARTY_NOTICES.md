# Third-party software and data

## Leaflet 1.9.4

The unchanged JavaScript and CSS distribution is bundled in `vendor/leaflet/`.
Leaflet is copyright Vladimir Agafonkin, CloudMade and contributors, distributed
under the BSD 2-Clause licence. See `vendor/leaflet/LICENSE`.

Source: https://leafletjs.com/ and https://github.com/Leaflet/Leaflet/tree/v1.9.4

## External data services

- Weather / geocoding delivery: [Open-Meteo](https://open-meteo.com/) (data under CC BY 4.0; API access subject to provider terms).
- Map weather model: [DWD ICON through Open-Meteo](https://open-meteo.com/en/docs/dwd-api). Selected-point forecasts use the provider's best-match models instead.
- Air quality: [Copernicus Atmosphere Monitoring Service](https://atmosphere.copernicus.eu/) forecasts through Open-Meteo.
- Place names: [GeoNames](https://www.geonames.org/).
- Light, dark and street maps: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Satellite context: Esri World Imagery; Esri, Vantor, Earthstar Geographics and the GIS User Community.
- Topography: [OpenTopoMap](https://opentopomap.org/about), OpenStreetMap and SRTM (CC BY-SA).
- Typefaces: DM Sans and Space Grotesk, requested from Google Fonts; system fonts are used if unavailable.

Provider attribution remains visible on the map, in the footer and in the
methodology dialog. Each basemap is subject to its provider's terms. There is no
bulk tile downloading, offline tile cache or background map prefetching.

The original project report is preserved unmodified.
The external [Zoom Earth](https://zoom.earth/) comparison links open its own
website. WEX uses its own interpolation and colour rendering, not Zoom Earth
tiles, imagery, source code or an unofficial API. No affiliation is implied.
Light and dark presentation styles are applied only to the OpenStreetMap tile
pane. Attribution and indicator colours are not filtered. Use complies with the
[OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/);
there is no API key, guaranteed service level or offline download feature.
