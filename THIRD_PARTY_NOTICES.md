# Third-party software and data

## Leaflet 1.9.4

The unchanged JavaScript and CSS distribution is bundled in `vendor/leaflet/`.
Leaflet is copyright Vladimir Agafonkin, CloudMade and contributors, distributed
under the BSD 2-Clause licence. See `vendor/leaflet/LICENSE`.

Source: https://leafletjs.com/ and https://github.com/Leaflet/Leaflet/tree/v1.9.4

## External data services

- Weather / geocoding delivery: [Open-Meteo](https://open-meteo.com/) (data under CC BY 4.0; API access subject to provider terms).
- Air quality: [Copernicus Atmosphere Monitoring Service](https://atmosphere.copernicus.eu/) forecasts through Open-Meteo.
- Place names: [GeoNames](https://www.geonames.org/).
- Atlas basemap: [CARTO](https://carto.com/attributions), based on OpenStreetMap.
- Streets: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Satellite context: Esri World Imagery; Esri, Vantor, Earthstar Geographics and the GIS User Community.
- Topography: [OpenTopoMap](https://opentopomap.org/about), OpenStreetMap and SRTM (CC BY-SA).
- Typefaces: Manrope and IBM Plex Mono, requested from Google Fonts; system fonts are used if unavailable.

Provider attribution remains visible on the map, in the footer and in the
methodology dialog. Each basemap is subject to its provider's terms. There is no
bulk tile downloading, offline tile cache or background map prefetching.

The original project report is preserved unmodified. The external
GlobalBuildingAtlas viewer remains a separate research resource, not an embedded
or redistributed dataset.
