import {
  PRESETS, METRICS, isNumber, numeric, clamp, normalizeLongitude, formatNumber, locationKey,
  coordinateLabel, parseCoordinates, parseView, shareURL, localTime, dayLabel, condition,
  aqiCategory, windDirection, metricColor, nextHours, chartGeometry, forecastCSV, LatestRequest,
} from './modules/core.js?v=2.2.0';
import { createClient } from './modules/api.js?v=2.2.0';
import { surfaceSampleGrid, createField, interpolateField, zoomEarthURL, AUTO_LAYER_INTERVAL } from './modules/surface.js?v=2.2.0';
import { createSurfaceLayer } from './modules/surface-layer.js?v=2.2.0';

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const element = (tag, className = '', text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgElement = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};
const icon = name => {
  const svg = svgElement('svg', { class: 'icon', 'aria-hidden': 'true' });
  svg.append(svgElement('use', { href: `#i-${name}` }));
  return svg;
};
const unitText = (value, unit = '', digits = 0) => isNumber(value) ? `${formatNumber(value, digits)}${unit}` : '—';
const initial = parseView(window.location.search);
const client = createClient();
const pointRequest = new LatestRequest(), searchRequest = new LatestRequest(), sampleRequest = new LatestRequest();
const state = {
  place: initial.place, data: null, metric: initial.metric, basemap: initial.basemap,
  range: 'hourly', map: null, tileLayer: null, selectedMarker: null, samplesLayer: null,
  samples: null, field: null, surfaceLayer: null, renderMode: 'smooth', pixelSize: 1, sampleViewport: '', layerVisible: true, opacity: .62, showValues: false, autoUpdate: true, comparisons: new Map(), searchResults: [], activeResult: -1,
};
let toastTimer, searchTimer, sampleTimer, lastSampleStart = 0, selectionRevision = 0;
let explicitTheme = false;
try { explicitTheme = ['light', 'dark'].includes(localStorage.getItem('uhm-theme')); } catch { /* Optional preference. */ }

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
}

function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('themeToggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  $('themeToggle').title = `Switch to ${dark ? 'light' : 'dark'} mode`;
  $('themeIcon').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111d27' : '#dbe8e8';
  if (state.map && ['light', 'dark'].includes(state.basemap)) setBasemap(dark ? 'dark' : 'light');
}

function setBasemap(name) {
  if (!state.map) return;
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  const maps = {
    light: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: osm, maxNativeZoom: 19 },
    dark: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: osm, maxNativeZoom: 19 },
    streets: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: osm, maxNativeZoom: 19 },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri</a>, Vantor, Earthstar Geographics, GIS User Community', maxNativeZoom: 18 },
    terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: `${osm}, SRTM | <a href="https://opentopomap.org/about" target="_blank" rel="noopener">OpenTopoMap</a> (CC BY-SA)`, maxNativeZoom: 17 },
  };
  const spec = maps[name] || maps.light;
  const previous = state.basemap;
  state.basemap = maps[name] ? name : 'light';
  $('map').dataset.basemap = state.basemap;
  $('basemapSelect').value = state.basemap;
  if (state.tileLayer && ['light', 'dark', 'streets'].includes(previous) && ['light', 'dark', 'streets'].includes(state.basemap)) return;
  if (state.tileLayer) state.map.removeLayer(state.tileLayer);
  $('basemapSelect').value = state.basemap;
  $('tileNotice').hidden = true;
  let failed = 0;
  const layer = window.L.tileLayer(spec.url, { attribution: spec.attribution, maxZoom: 18, maxNativeZoom: spec.maxNativeZoom, subdomains: 'abc', keepBuffer: 2 });
  layer.on('tileerror', () => {
    if (state.tileLayer === layer && ++failed >= 3) {
      $('tileNotice').textContent = 'Some map tiles could not load. Try another basemap; weather data is independent.';
      $('tileNotice').hidden = false;
    }
  });
  state.tileLayer = layer;
  layer.addTo(state.map);
}

function viewportKey() {
  if (!state.map) return '';
  const b = state.map.getBounds();
  return [b.getSouth(), b.getNorth(), b.getWest(), b.getEast()].map(v => v.toFixed(3)).join(',');
}

function setupMap() {
  try {
    if (!window.L) throw new Error('Leaflet unavailable');
    state.map = window.L.map('map', { zoomControl: false, minZoom: 2, maxZoom: 18, worldCopyJump: true, scrollWheelZoom: true })
      .setView([state.place.lat, state.place.lon], initial.zoom);
    window.L.control.zoom({ position: 'bottomright' }).addTo(state.map);
    window.L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(state.map);
    state.samplesLayer = window.L.layerGroup().addTo(state.map);
    state.surfaceLayer = createSurfaceLayer(window.L).addTo(state.map);
    state.map.on('mousemove', event => {
      if (!state.layerVisible || !state.field) return;
      const value = interpolateField(state.field, event.latlng.lat, event.latlng.lng, state.metric);
      $('mapReadout').textContent = isNumber(value)
        ? `${METRICS[state.metric].short} ${unitText(value, ` ${METRICS[state.metric].unit}`, state.metric === 'aqi' ? 0 : 1)} · interpolated estimate`
        : 'No layer estimate at this location';
    });
    state.map.on('mouseout', () => { $('mapReadout').textContent = 'Move over the map to inspect · click for a point forecast'; });
    const requestedBase = new URLSearchParams(window.location.search).get('base');
    setBasemap(!requestedBase && document.documentElement.dataset.theme === 'dark' ? 'dark' : initial.basemap);
    state.map.on('click', event => selectPlace({ lat: event.latlng.lat, lon: normalizeLongitude(event.latlng.lng), name: 'Selected point', country: 'Map coordinates' }, { pan: false }));
    state.map.on('moveend', () => {
      // An old response must never become the layer for a newly viewed area.
      sampleRequest.cancel();
      $('sampleButton').disabled = false;
      $('sampleButtonLabel').textContent = 'Refresh layer';
      if (state.samples) renderSamples();
      scheduleLayerUpdate();
      updateZoomEarthLink();
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => state.map.invalidateSize({ pan: false })).observe($('map'));
  } catch {
    state.map = null;
    $('mapFallback').hidden = false;
    for (const id of ['sampleButton', 'centreButton', 'basemapSelect']) $(id).disabled = true;
  }
}

function markerContent(value, selected = false, direction = null) {
  const node = element('div', `marker-value${selected ? ' selected' : ''}${!isNumber(value) ? ' missing' : ''}`, formatNumber(value, state.metric === 'rain' ? 1 : 0));
  if (state.metric === 'wind' && isNumber(direction) && isNumber(value) && value > 0) {
    const arrow = svgElement('svg', { viewBox: '0 0 14 18', class: 'wind-arrow', 'aria-hidden': 'true' });
    arrow.style.setProperty('--wind-rotation', `${direction + 180}deg`);
    arrow.append(svgElement('path', { d: 'M7 1 L13 9 L8.5 8 L8.5 17 L5.5 17 L5.5 8 L1 9 Z', fill: 'currentColor' }));
    node.prepend(arrow);
  }
  node.style.setProperty('--marker-color', metricColor(value, state.metric));
  if (isNumber(value)) node.append(element('small', '', state.metric === 'temperature' ? '°' : state.metric === 'humidity' ? '%' : state.metric === 'rain' ? 'mm' : ''));
  return node;
}

function selectedValue() { return numeric(state.data?.current?.[state.metric === 'rain' ? 'rainfall' : state.metric]); }

function updateSelectedMarker() {
  if (!state.map) return;
  const value = selectedValue();
  const markerIcon = window.L.divIcon({ html: markerContent(value, true, state.data?.current?.direction), className: 'climate-marker', iconSize: [68, 46], iconAnchor: [34, 23], tooltipAnchor: [0, -30] });
  if (!state.selectedMarker) state.selectedMarker = window.L.marker([state.place.lat, state.place.lon], { icon: markerIcon, keyboard: true, zIndexOffset: 1000 }).addTo(state.map);
  else state.selectedMarker.setLatLng([state.place.lat, state.place.lon]).setIcon(markerIcon);
  const label = `${state.place.name} · Point forecast (best match) · ${METRICS[state.metric].label}: ${unitText(value, ` ${METRICS[state.metric].unit}`)}`;
  state.selectedMarker.unbindTooltip().bindTooltip(element('span', '', label), { direction: 'top' });
  const node = state.selectedMarker.getElement();
  if (node) { node.setAttribute('aria-label', label); node.title = label; }
}

function sampleTooltip(point) {
  const content = element('div', 'sample-tooltip');
  content.append(element('strong', '', 'Model estimate · sampled location'));
  const list = element('dl');
  for (const [key, spec] of Object.entries(METRICS)) {
    list.append(element('dt', '', spec.short), element('dd', '', unitText(point.values[key], ` ${spec.unit}`, key === 'rain' ? 1 : 0)));
  }
  content.append(list);
  if (isNumber(point.direction)) content.append(element('small', '', `Wind from ${windDirection(point.direction)} · arrows show movement`));
  content.append(element('small', '', coordinateLabel(point.lat, point.lon)));
  const stamp = state.metric === 'aqi' ? point.airTime : state.metric === 'rain' ? point.rainTime : point.time;
  content.append(element('small', '', `Model ${localTime(stamp, 'UTC', { day: 'numeric', month: 'short' })} UTC`));
  if (state.metric === 'aqi') content.append(element('small', '', aqiCategory(point.values.aqi).label));
  if (state.metric === 'rain') content.append(element('small', '', 'Total precipitation over preceding hour, including snow water equivalent.'));
  content.append(element('small', '', 'Source sample, not an interpolated value. Click for a point forecast.'));
  return content;
}

function updateZoomEarthLink() {
  $('zoomEarthLink').href = zoomEarthURL(state.place, state.map?.getZoom() ?? initial.zoom, state.metric);
  $('zoomEarthLink').hidden = state.metric === 'aqi';
}

function renderSamples() {
  if (!state.samplesLayer) return;
  $('mapReadout').textContent = 'Move over the map to inspect · click for a point forecast';
  state.samplesLayer.clearLayers();
  if (!state.layerVisible || !state.samples) {
    state.surfaceLayer?.setField(null);
    if (!state.layerVisible) {
      $('sampleSummary').textContent = 'Indicator layer hidden';
      $('sampleDetail').textContent = 'Turn on Show layer to display the model estimates.';
    }
    return;
  }
  const previousView = state.sampleViewport !== viewportKey();
  state.surfaceLayer?.setField(state.field, { metric: state.metric, mode: state.renderMode, cellSize: state.pixelSize,
    opacity: state.opacity * (previousView ? .45 : 1) });
  const canvasAvailable = state.surfaceLayer?.available();
  const size = state.map.getSize(), side = state.field?.size ?? 9;
  const strideX = Math.max(1, Math.ceil((side - 1) * 96 / Math.max(size.x, 1)));
  const strideY = Math.max(1, Math.ceil((side - 1) * 60 / Math.max(size.y, 1)));
  let available = 0;
  for (const point of state.samples.points) {
    const value = point.values[state.metric];
    if (isNumber(value)) available++;
    const pointsOnly = state.renderMode === 'samples' || !canvasAvailable;
    if (!state.showValues && state.metric !== 'wind' && !pointsOnly) continue;
    if (point.col % strideX || point.row % strideY) continue;
    let content;
    if (state.showValues) content = markerContent(value, false, point.direction);
    else if (state.metric === 'wind' && isNumber(value) && value > 0 && isNumber(point.direction)) {
      content = markerContent(value, false, point.direction);
      content.className = 'wind-vector';
      const arrow = content.querySelector('.wind-arrow'); content.replaceChildren(arrow);
    } else {
      content = element('div', 'sample-dot'); content.style.backgroundColor = metricColor(value, state.metric);
    }
    const label = `${METRICS[state.metric].label}: ${unitText(value, ` ${METRICS[state.metric].unit}`, state.metric === 'rain' ? 1 : 0)} · source sample · ${coordinateLabel(point.lat, point.lon)}`;
    const marker = window.L.marker([point.lat, point.displayLon ?? point.lon], {
      icon: window.L.divIcon({ html: content, className: 'climate-marker sample-marker', iconSize: state.showValues ? [64, 38] : [24, 24], iconAnchor: state.showValues ? [32, 19] : [12, 12] }),
      keyboard: true, title: label, alt: label, opacity: previousView ? .55 : 1,
    }).bindTooltip(sampleTooltip(point), { direction: 'top' }).addTo(state.samplesLayer);
    marker.on('click', () => selectPlace(point, { pan: false }));
  }
  $('clearSamples').hidden = false;
  const source = state.metric === 'aqi' ? 'CAMS' : 'DWD ICON';
  const stamps = state.samples.points.map(point => state.metric === 'aqi' ? point.airTime : point.time).filter(isNumber);
  const modelTime = stamps.length ? `${localTime(Math.min(...stamps), 'UTC', { day: 'numeric', month: 'short' })} UTC` : 'unavailable';
  const displayedPixel = document.querySelector('.weather-surface')?.dataset.pixelSize || state.pixelSize;
  $('surfaceResolution').textContent = state.renderMode === 'samples' || !canvasAvailable
    ? 'Source samples · labels spaced for clarity'
    : `${displayedPixel} px display · interpolated, not native model resolution`;
  $('sampleSummary').textContent = previousView ? 'Previous area · refresh to update' : `${available} of ${state.samples.points.length} source estimates · ${source}`;
  $('sampleDetail').textContent = previousView
    ? (state.autoUpdate ? 'Waiting to update this view…' : 'Auto-update is paused. Choose Refresh layer.')
    : `${source} valid ${modelTime}${canvasAvailable ? '' : ' · raster unavailable; sample points shown'}`;
}

function scheduleLayerUpdate() {
  clearTimeout(sampleTimer);
  if (!state.map || !state.autoUpdate || !state.layerVisible) return;
  const remaining = Math.max(850, AUTO_LAYER_INTERVAL - (Date.now() - lastSampleStart));
  if (remaining > 1000 && state.samples) $('sampleDetail').textContent = `Updating this area in about ${Math.ceil(remaining / 1000)} seconds…`;
  sampleTimer = setTimeout(() => sampleView(), remaining);
}

function setMetric(metric) {
  if (!Object.hasOwn(METRICS, metric)) return;
  state.metric = metric;
  const spec = METRICS[metric];
  all('[data-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
  $('legendTitle').textContent = spec.label;
  $('legendUnit').textContent = spec.unit;
  $('legendGradient').style.background = spec.gradient || `linear-gradient(to right, ${spec.colors.join(',')})`;
  $('legendTicks').replaceChildren(...spec.ticks.map(tick => element('span', '', tick)));
  $('legendNote').textContent = metric === 'rain' ? 'Preceding hour · rain, showers + snow' : metric === 'wind' ? 'Arrows show air movement · at 10 m' : metric === 'aqi' ? 'CAMS · interpolated AQI' : 'DWD ICON · interpolated display';
  updateSelectedMarker();
  renderSamples();
  updateZoomEarthLink();
}

async function sampleView({ force = false } = {}) {
  if (!state.map || !state.layerVisible) return;
  clearTimeout(sampleTimer);
  lastSampleStart = Date.now();
  const ticket = sampleRequest.begin(), bounds = state.map.getBounds();
  const sampledViewport = viewportKey();
  $('sampleButton').disabled = true;
  $('sampleButtonLabel').textContent = 'Loading…';
  $('sampleSummary').textContent = 'Loading the indicator layer';
  $('sampleDetail').textContent = 'Fetching 81 source estimates for a finer surface.';
  try {
    const points = surfaceSampleGrid({ south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast() });
    const result = await client.samples(points, { signal: ticket.signal, force });
    if (!sampleRequest.isCurrent(ticket) || sampledViewport !== viewportKey()) return;
    state.samples = result;
    state.field = createField(result.points);
    state.sampleViewport = sampledViewport;
    renderSamples();
    if (result.partial) toast('Some indicator data is unavailable. Missing values are left unfilled.');
    $('announcer').textContent = 'Fine weather surface loaded. Choose Smooth, Fine cells or Sample points; change display detail without more downloads.';
  } catch (error) {
    if (!sampleRequest.isCurrent(ticket)) return;
    $('sampleSummary').textContent = state.samples ? 'Previous layer retained' : 'Layer could not load';
    $('sampleDetail').textContent = error.message;
  } finally {
    if (sampleRequest.isCurrent(ticket)) {
      $('sampleButton').disabled = false;
      $('sampleButtonLabel').textContent = 'Refresh layer';
    }
  }
}

function metricReading(id, value, unit) {
  const node = $(id);
  node.replaceChildren(document.createTextNode(formatNumber(value)));
  if (isNumber(value) && unit) node.append(element('small', '', unit));
}

function updateComparisonButtons() {
  const exists = state.comparisons.has(locationKey(state.place));
  const full = state.comparisons.size >= 3;
  $('compareButton').disabled = !state.data || exists || full;
  $('compareButtonLabel').textContent = exists ? 'Added to comparison' : full ? 'Comparison is full' : 'Add to comparison';
  $('compareStarter').disabled = !state.data;
  all('[data-compare-preset]').forEach(button => {
    button.hidden = state.comparisons.has(locationKey(PRESETS[Number(button.dataset.comparePreset)]));
    button.disabled = full;
  });
}

function clearConditions() {
  $('conditions').classList.add('is-loading');
  $('conditions').setAttribute('aria-busy', 'true');
  $('locationName').textContent = state.place.name;
  $('locationCountry').textContent = state.place.country || 'Selected location';
  $('coordinates').textContent = coordinateLabel(state.place.lat, state.place.lon);
  for (const id of ['temperature', 'feelsLike', 'todayHigh', 'todayLow', 'humidity', 'wind', 'rain', 'aqi']) $(id).textContent = '—';
  $('weatherDescription').textContent = 'Fetching modelled conditions…';
  $('weatherSymbol').setAttribute('href', '#i-partly');
  $('windDetail').textContent = 'At 10 m above ground';
  $('rainDetail').textContent = 'Hourly total · mm';
  $('aqiCategory').textContent = 'Modelled air quality';
  $('aqiCategory').style.borderColor = 'transparent';
  $('weatherError').hidden = true;
  $('airNote').hidden = true;
  $('dataState').dataset.state = 'loading';
  $('dataStateLabel').textContent = 'Loading';
  $('modelTime').textContent = 'Model time will appear here';
  $('retrievedTime').textContent = 'Times are local to the selected place.';
  $('forecastPlace').textContent = state.place.name;
  $('forecastEmpty').hidden = false;
  $('forecastEmpty').textContent = 'Your forecast is on its way…';
  $('hourlyPanel').hidden = true;
  $('dailyPanel').hidden = true;
  $('exportButton').disabled = true;
  $('refreshButton').disabled = true;
  updateComparisonButtons();
}

function renderConditions() {
  const data = state.data, c = data.current;
  const description = condition(c.code, c.isDay);
  $('temperature').textContent = formatNumber(c.temperature);
  $('feelsLike').textContent = unitText(c.feels, '°');
  $('todayHigh').textContent = unitText(data.daily[0]?.max, '°');
  $('todayLow').textContent = unitText(data.daily[0]?.min, '°');
  $('weatherDescription').textContent = description.label;
  $('weatherSymbol').setAttribute('href', `#i-${description.icon}`);
  metricReading('humidity', c.humidity, '%');
  metricReading('wind', c.wind, 'km/h');
  metricReading('rain', c.rainfall, 'mm');
  $('rainDetail').textContent = `Hourly total · ${unitText(c.rain, '%')} probability`;
  metricReading('aqi', c.aqi, '');
  $('windDetail').textContent = `${windDirection(c.direction)} · at 10 m`;
  const category = aqiCategory(c.aqi);
  $('aqiCategory').textContent = category.label;
  $('aqiCategory').style.borderColor = category.color;
  $('airNote').hidden = false;
  $('airNote').textContent = data.airAvailable
    ? `PM₂.₅ ${unitText(c.pm25, ' µg/m³', 1)} · Air model ${localTime(c.airTime, data.timezone, { timeZoneName: 'short' })}`
    : 'Air-quality data is currently unavailable. Weather and forecasts are still shown.';
  const old = Date.now() - c.time * 1000 > 3 * 60 * 60 * 1000;
  $('dataState').dataset.state = old ? 'error' : 'ready';
  $('dataStateLabel').textContent = old ? 'Older estimate' : 'Model estimate';
  $('modelTime').textContent = `Weather model · ${localTime(c.time, data.timezone, { day: 'numeric', month: 'short', timeZoneName: 'short' })}`;
  $('retrievedTime').textContent = `Retrieved ${localTime(data.retrievedAt / 1000, data.timezone, { timeZoneName: 'short' })} · Open-Meteo / CAMS`;
  $('forecastPlace').textContent = `${state.place.name} · ${data.timezone.replaceAll('_', ' ')}`;
  $('exportButton').disabled = data.hourly.length === 0;
  updateComparisonButtons();
}

async function selectPlace(place, { pan = true, force = false } = {}) {
  selectionRevision++;
  $('locateButton').disabled = false;
  const ticket = pointRequest.begin();
  state.place = { ...place, lat: Number(place.lat.toFixed(4)), lon: Number(normalizeLongitude(place.lon).toFixed(4)), name: String(place.name || 'Selected point').slice(0, 80) };
  state.data = null;
  updateZoomEarthLink();
  clearConditions();
  closeSearch();
  if (pan && state.map) state.map.setView([state.place.lat, state.place.lon], Math.max(state.map.getZoom(), 9), { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
  all('[data-preset]').forEach(button => button.classList.toggle('is-current', locationKey(PRESETS[Number(button.dataset.preset)]) === locationKey(state.place)));
  updateSelectedMarker();
  try {
    const data = await client.point(state.place, { signal: ticket.signal, force });
    if (!pointRequest.isCurrent(ticket)) return;
    state.data = data;
    renderConditions();
    renderForecast();
    updateSelectedMarker();
    $('announcer').textContent = `${state.place.name} loaded. Modelled temperature ${unitText(data.current.temperature, ' degrees Celsius')}.`;
  } catch (error) {
    if (!pointRequest.isCurrent(ticket)) return;
    $('weatherError').textContent = `${error.message} Use the refresh button to try again.`;
    $('weatherError').hidden = false;
    $('weatherDescription').textContent = 'Conditions unavailable';
    $('dataState').dataset.state = 'error';
    $('dataStateLabel').textContent = 'Unavailable';
    $('forecastEmpty').textContent = 'The forecast could not load. Refresh the selected place to retry.';
    $('announcer').textContent = `Weather for ${state.place.name} could not load.`;
  } finally {
    if (pointRequest.isCurrent(ticket)) {
      $('conditions').classList.remove('is-loading');
      $('conditions').setAttribute('aria-busy', 'false');
      $('refreshButton').disabled = false;
    }
  }
}

function setForecastRange(range) {
  state.range = range;
  for (const button of all('[data-forecast]')) {
    const selected = button.dataset.forecast === range;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  $('forecastTitle').textContent = range === 'daily' ? 'The week ahead' : 'The next 24 hours';
  $('hourlyPanel').hidden = !state.data || range !== 'hourly';
  $('dailyPanel').hidden = !state.data || range !== 'daily';
}

function renderForecast() {
  const data = state.data, rows = nextHours(data);
  $('forecastEmpty').hidden = true;
  setForecastRange(state.range);
  renderHourly(rows, data.timezone);
  renderDaily(data.daily);
}

function renderHourly(rows, timezone) {
  const geometry = chartGeometry(rows, 720, 150, 25);
  const chart = svgElement('svg', { viewBox: '0 0 720 220', role: 'group', 'aria-label': 'Hourly air temperature in Celsius and rain probability from zero to 100 percent. Use arrow keys on a chart point, or read the data table below.' });
  if (geometry.points.length) {
    for (const [y, value] of [[25, geometry.max], [75, (geometry.min + geometry.max) / 2], [125, geometry.min]]) {
      chart.append(svgElement('line', { x1: 25, y1: y, x2: 695, y2: y, class: 'chart-grid' }));
      chart.append(svgElement('text', { x: 0, y: y + 4, class: 'chart-label' }, `${formatNumber(value)}°`));
    }
    for (const segment of geometry.segments) {
      const path = segment.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
      chart.append(svgElement('path', { d: `${path} L${segment.at(-1).x},130 L${segment[0].x},130 Z`, class: 'chart-area' }));
      chart.append(svgElement('path', { d: path, class: 'chart-line' }));
    }
    chart.append(svgElement('text', { x: 0, y: 163, class: 'chart-label' }, '%'));
    const pointNodes = [];
    const readout = row => {
      $('chartReadout').textContent = `${localTime(row.time, timezone, { weekday: 'short', timeZoneName: 'short' })} · ${unitText(row.temperature, '°C')} · Rain ${unitText(row.rain, '%')} · Wind ${unitText(row.wind, ' km/h')}`;
    };
    geometry.points.forEach((point, i) => {
      if (isNumber(point.rain)) {
        const height = clamp(point.rain, 0, 100) / 100 * 28;
        const bar = svgElement('rect', { x: point.x - 5, y: 178 - height, width: 10, height: Math.max(height, .8), rx: 2, class: 'chart-rain' });
        bar.append(svgElement('title', {}, `${localTime(point.time, timezone)} · ${formatNumber(point.rain)}% rain probability`));
        bar.addEventListener('pointerenter', () => readout(point));
        chart.append(bar);
      }
      if (i % 4 === 0 || i === geometry.points.length - 1) chart.append(svgElement('text', { x: point.x, y: 207, class: 'chart-label', 'text-anchor': 'middle' }, localTime(point.time, timezone)));
      if (point.y === null) return;
      const circle = svgElement('circle', { cx: point.x, cy: point.y, r: 3.5, class: 'chart-point', tabindex: pointNodes.length === 0 ? 0 : -1, role: 'button', 'aria-label': `${localTime(point.time, timezone, { weekday: 'short', timeZoneName: 'short' })}, ${unitText(point.temperature, ' degrees Celsius')}, rain ${unitText(point.rain, ' percent')}` });
      for (const event of ['pointerenter', 'focus', 'click']) circle.addEventListener(event, () => readout(point));
      circle.addEventListener('keydown', event => {
        const current = pointNodes.indexOf(circle);
        let target;
        if (event.key === 'ArrowRight') target = Math.min(current + 1, pointNodes.length - 1);
        if (event.key === 'ArrowLeft') target = Math.max(current - 1, 0);
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = pointNodes.length - 1;
        if (target !== undefined) {
          event.preventDefault();
          pointNodes.forEach((node, index) => node.setAttribute('tabindex', index === target ? '0' : '-1'));
          pointNodes[target].focus();
        } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); readout(point); }
      });
      pointNodes.push(circle);
      chart.append(circle);
    });
    if (rows.length) readout(rows[0]);
  } else {
    chart.append(svgElement('text', { x: 360, y: 90, class: 'chart-label', 'text-anchor': 'middle' }, 'Hourly temperatures are unavailable.'));
    $('chartReadout').textContent = 'Any available values are listed in the data table.';
  }
  $('hourlyChart').replaceChildren(chart);
  $('hourlyCaption').textContent = `${state.place.name} · next 24 hours · ${timezone.replaceAll('_', ' ')}`;
  $('hourlyRows').replaceChildren(...rows.map(row => {
    const tr = element('tr');
    const time = element('th', '', localTime(row.time, timezone, { weekday: 'short', timeZoneName: 'short' }));
    time.scope = 'row';
    tr.append(time, element('td', '', unitText(row.temperature, '°C')), element('td', '', unitText(row.rain, '%')), element('td', '', unitText(row.wind, ' km/h')));
    return tr;
  }));
  const warmest = rows.filter(row => isNumber(row.temperature)).sort((a, b) => b.temperature - a.temperature)[0];
  const wettest = rows.filter(row => isNumber(row.rain)).sort((a, b) => b.rain - a.rain)[0];
  $('forecastHighlights').replaceChildren(...[
    ['Warmest forecast hour', warmest, 'temperature', '°C'], ['Peak rain probability', wettest, 'rain', '%'],
  ].map(([label, row, key, unit]) => {
    const box = element('div', 'forecast-highlight');
    const value = element('strong', '', unitText(row?.[key], unit));
    if (row) value.append(element('small', '', localTime(row.time, timezone, { weekday: 'short' })));
    box.append(element('span', '', label), value);
    return box;
  }));
}

function renderDaily(rows) {
  if (!rows.length) { $('dailyRows').replaceChildren(element('p', 'forecast-empty', 'Daily forecasts are unavailable.')); return; }
  const lows = rows.map(row => row.min).filter(isNumber), highs = rows.map(row => row.max).filter(isNumber);
  const min = lows.length ? Math.min(...lows) : 0, max = highs.length ? Math.max(...highs) : 1;
  $('dailyRows').replaceChildren(...rows.map(row => {
    const item = element('div', 'daily-row'), weather = condition(row.code);
    const name = element('div', 'daily-name'), description = element('span');
    description.append(element('strong', '', dayLabel(row.date)), element('small', '', weather.label));
    name.append(icon(weather.icon), description);
    const range = element('div', 'daily-range'), track = element('div', 'range-track');
    track.setAttribute('aria-hidden', 'true');
    if (isNumber(row.min) && isNumber(row.max)) {
      const fill = element('div', 'range-fill');
      fill.style.left = `${clamp((row.min - min) / Math.max(max - min, 1), 0, 1) * 100}%`;
      fill.style.width = `${clamp((row.max - row.min) / Math.max(max - min, 1), 0, 1) * 100}%`;
      track.append(fill);
    }
    range.append(element('span', '', unitText(row.min, '°')), track, element('span', '', unitText(row.max, '°')));
    item.append(name, range, element('div', 'daily-rain', unitText(row.rain, '%')));
    return item;
  }));
}

function renderComparisons() {
  $('comparisonEmpty').hidden = state.comparisons.size > 0;
  $('compareCount').textContent = `${state.comparisons.size} / 3`;
  $('comparisonSuggestions').hidden = state.comparisons.size === 0 || state.comparisons.size >= 3;
  $('comparisonList').replaceChildren(...[...state.comparisons.entries()].map(([key, entry]) => {
    const { place, data, loading, error } = entry;
    const card = element('article', 'compare-place');
    card.setAttribute('aria-label', `Comparison: ${place.name}`);
    card.setAttribute('aria-busy', String(loading));
    const head = element('div', 'compare-place-header');
    const name = element('button', 'compare-place-name'); name.type = 'button';
    name.title = `Explore ${place.name} on the map`;
    name.append(element('strong', '', place.name), element('span', '', place.country || coordinateLabel(place.lat, place.lon)));
    name.addEventListener('click', () => { $('comparisonDialog').close(); selectPlace(place); });
    const actions = element('div', 'compare-place-actions');
    const refresh = element('button', 'icon-button'); refresh.type = 'button';
    refresh.setAttribute('aria-label', `Refresh ${place.name} comparison`); refresh.title = `Refresh ${place.name}`;
    refresh.disabled = loading; refresh.append(icon('refresh'));
    refresh.addEventListener('click', () => loadComparison(key, true));
    const remove = element('button', 'icon-button'); remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${place.name} from comparison`); remove.title = 'Remove comparison'; remove.append(icon('close'));
    remove.addEventListener('click', () => {
      entry.controller?.abort();
      state.comparisons.delete(key);
      renderComparisons();
      (document.querySelector('.compare-place-name') || $('compareStarter')).focus();
      $('announcer').textContent = `${place.name} removed from comparison.`;
    });
    actions.append(refresh, remove); head.append(name, actions); card.append(head);
    if (data) {
      const values = element('div', 'compare-place-data');
      const temp = element('div', 'compare-temp', formatNumber(data.current.temperature));
      if (isNumber(data.current.temperature)) temp.append(element('small', '', '°C'));
      const feels = element('div', 'compare-stat', 'Feels like'); feels.append(element('strong', '', unitText(data.current.feels, '°C')));
      const humidity = element('div', 'compare-stat', 'Humidity'); humidity.append(element('strong', '', unitText(data.current.humidity, '%')));
      values.append(temp, feels, humidity); card.append(values);
      card.append(element('p', 'compare-place-time', `Model · ${localTime(data.current.time, data.timezone, { day: 'numeric', month: 'short', timeZoneName: 'short' })}`));
    }
    if (loading) card.append(element('p', 'compare-place-time', data ? 'Refreshing snapshot…' : 'Loading conditions…'));
    if (error) card.append(element('p', 'compare-error', `${data ? 'Previous snapshot. ' : ''}${error} Use refresh to retry.`));
    return card;
  }));
  updateComparisonButtons();
}

async function loadComparison(key, force = false) {
  const entry = state.comparisons.get(key);
  if (!entry) return;
  entry.controller?.abort();
  const controller = new AbortController(); entry.controller = controller;
  entry.loading = true; entry.error = '';
  renderComparisons();
  try {
    const data = await client.point(entry.place, { signal: controller.signal, force });
    if (state.comparisons.get(key) !== entry || controller.signal.aborted) return;
    entry.data = data;
  } catch (error) {
    if (state.comparisons.get(key) !== entry || controller.signal.aborted) return;
    entry.error = error.message;
  } finally {
    if (state.comparisons.get(key) === entry && !controller.signal.aborted) { entry.loading = false; renderComparisons(); }
  }
}

function addComparison(place = state.place, data = null) {
  const key = locationKey(place);
  if (state.comparisons.has(key)) { toast('This place is already in your comparison.'); return; }
  if (state.comparisons.size >= 3) { toast('Remove a place before adding another. You can compare three at a time.'); return; }
  state.comparisons.set(key, { place: { ...place }, data, loading: !data, error: '' });
  renderComparisons();
  if (!data) loadComparison(key);
  toast(`${place.name} added to comparison.`);
}

function closeSearch() {
  clearTimeout(searchTimer);
  searchRequest.cancel();
  $('searchMenu').hidden = true;
  $('placeSearch').setAttribute('aria-expanded', 'false');
  $('placeSearch').removeAttribute('aria-activedescendant');
}

function setActiveResult(index) {
  state.activeResult = index;
  const nodes = all('#searchResults [role="option"]');
  nodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === index)));
  if (nodes[index]) $('placeSearch').setAttribute('aria-activedescendant', nodes[index].id);
  else $('placeSearch').removeAttribute('aria-activedescendant');
}

function chooseResult(index) {
  const place = state.searchResults[index];
  if (!place) return;
  $('placeSearch').value = place.name;
  selectPlace(place);
}

async function runSearch() {
  clearTimeout(searchTimer);
  const query = $('placeSearch').value.trim();
  if (query.length < 2) { closeSearch(); return; }
  const ticket = searchRequest.begin();
  state.searchResults = []; state.activeResult = -1;
  $('searchResults').replaceChildren();
  $('placeSearch').removeAttribute('aria-activedescendant');
  $('searchMenu').hidden = false;
  $('placeSearch').setAttribute('aria-expanded', 'true');
  $('searchMessage').textContent = 'Searching places…';
  try {
    const coordinates = parseCoordinates(query);
    const places = coordinates ? [coordinates] : await client.search(query, { signal: ticket.signal });
    if (!searchRequest.isCurrent(ticket)) return;
    state.searchResults = places;
    $('searchResults').replaceChildren(...places.map((place, i) => {
      const row = element('div', 'search-result');
      row.id = `place-result-${i}`; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false');
      const label = element('div');
      label.append(element('strong', '', place.name), element('span', '', [place.admin, place.country].filter(Boolean).join(', ') || coordinateLabel(place.lat, place.lon)));
      row.append(label, icon('arrow'));
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('click', () => chooseResult(i));
      $('searchMessage').textContent = '';
      return row;
    }));
    if (!places.length) $('searchMessage').textContent = 'No places found. Try a city and country, or latitude, longitude.';
    setActiveResult(places.length ? 0 : -1);
  } catch (error) {
    if (searchRequest.isCurrent(ticket)) $('searchMessage').textContent = `${error.message} You can still click the map or use a featured city.`;
  }
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.body.style.overflow = 'hidden';
}

function setupInteractions() {
  $('themeToggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    explicitTheme = true;
    try { localStorage.setItem('uhm-theme', theme); } catch { /* Theme still works without storage. */ }
    syncTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (!explicitTheme) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; syncTheme(); }
  });
  all('[data-preset]').forEach(button => button.addEventListener('click', () => selectPlace(PRESETS[Number(button.dataset.preset)])));
  all('[data-metric]').forEach(button => button.addEventListener('click', () => setMetric(button.dataset.metric)));
  $('basemapSelect').addEventListener('change', event => setBasemap(event.target.value));
  $('centreButton').addEventListener('click', () => {
    if (!state.map) return;
    const centre = state.map.getCenter();
    selectPlace({ lat: centre.lat, lon: normalizeLongitude(centre.lng), name: 'Map centre', country: 'Selected coordinates' }, { pan: false });
  });
  $('sampleButton').addEventListener('click', () => {
    state.layerVisible = true; $('layerVisible').checked = true;
    sampleView({ force: true });
  });
  $('surfaceMode').addEventListener('change', event => {
    state.renderMode = ['smooth', 'grid', 'samples'].includes(event.target.value) ? event.target.value : 'smooth';
    $('pixelSize').disabled = state.renderMode === 'samples';
    renderSamples();
  });
  $('pixelSize').addEventListener('change', event => {
    state.pixelSize = [1, 2, 4, 8, 12].includes(Number(event.target.value)) ? Number(event.target.value) : 2;
    renderSamples();
  });
  $('layerOpacity').addEventListener('input', event => {
    state.opacity = clamp(Number(event.target.value) / 100, .1, .85);
    $('opacityValue').textContent = `${Math.round(state.opacity * 100)}%`;
    renderSamples();
  });
  $('showValues').addEventListener('change', event => { state.showValues = event.target.checked; renderSamples(); });
  $('layerVisible').addEventListener('change', event => {
    state.layerVisible = event.target.checked;
    if (!state.layerVisible) {
      clearTimeout(sampleTimer); sampleRequest.cancel();
      $('sampleButton').disabled = false; $('sampleButtonLabel').textContent = 'Refresh layer';
    }
    renderSamples();
    if (state.layerVisible && (!state.samples || state.sampleViewport !== viewportKey())) sampleView();
  });
  $('autoUpdate').addEventListener('change', event => {
    state.autoUpdate = event.target.checked; clearTimeout(sampleTimer);
    if (state.autoUpdate && (!state.samples || state.sampleViewport !== viewportKey())) scheduleLayerUpdate();
    if (state.samples) renderSamples();
  });
  $('clearSamples').addEventListener('click', () => {
    clearTimeout(sampleTimer); sampleRequest.cancel(); state.samples = null; state.field = null; state.samplesLayer?.clearLayers(); state.surfaceLayer?.setField(null);
    $('mapReadout').textContent = 'Move over the map to inspect · click for a point forecast';
    state.autoUpdate = false; $('autoUpdate').checked = false;
    $('clearSamples').hidden = true; $('sampleButton').disabled = !state.map;
    $('sampleButtonLabel').textContent = 'Refresh layer'; $('sampleSummary').textContent = 'Layer cleared';
    $('sampleDetail').textContent = 'Choose Refresh layer or enable Auto-update to load this area.';
    $('sampleButton').focus();
  });
  $('panelsToggle').addEventListener('click', () => {
    const hidden = $('explorer').classList.toggle('panels-hidden');
    $('panelsToggle').setAttribute('aria-pressed', String(hidden));
    $('panelsToggle').setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} weather and forecast panels`);
    state.map?.invalidateSize({ pan: false });
  });
  $('openComparison').addEventListener('click', () => openDialog($('comparisonDialog')));
  $('closeComparison').addEventListener('click', () => $('comparisonDialog').close());
  $('refreshButton').addEventListener('click', () => selectPlace(state.place, { pan: false, force: true }));
  $('compareButton').addEventListener('click', () => { if (state.data) { addComparison(state.place, state.data); openDialog($('comparisonDialog')); } });
  $('compareStarter').addEventListener('click', () => { if (state.data) { addComparison(state.place, state.data); openDialog($('comparisonDialog')); } });
  all('[data-compare-preset]').forEach(button => button.addEventListener('click', () => addComparison(PRESETS[Number(button.dataset.comparePreset)])));
  all('[data-forecast]').forEach(button => {
    button.addEventListener('click', () => setForecastRange(button.dataset.forecast));
    button.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const range = event.key === 'Home' ? 'hourly' : event.key === 'End' ? 'daily' : state.range === 'hourly' ? 'daily' : 'hourly';
        setForecastRange(range); $(`${range}Tab`).focus();
      }
    });
  });
  $('placeSearch').addEventListener('input', () => {
    closeSearch(); state.searchResults = []; state.activeResult = -1;
    if ($('placeSearch').value.trim().length >= 2) searchTimer = setTimeout(runSearch, 350);
  });
  $('placeSearch').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeSearch(); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && !$('searchMenu').hidden && state.searchResults.length) {
      event.preventDefault();
      setActiveResult((state.activeResult + (event.key === 'ArrowDown' ? 1 : -1) + state.searchResults.length) % state.searchResults.length);
    }
  });
  $('searchForm').addEventListener('submit', event => {
    event.preventDefault();
    const coords = parseCoordinates($('placeSearch').value);
    if (coords) { selectPlace(coords); return; }
    if (!$('searchMenu').hidden && state.activeResult >= 0) chooseResult(state.activeResult);
    else runSearch();
  });
  document.addEventListener('pointerdown', event => { if (!$('searchForm').contains(event.target)) closeSearch(); });
  document.addEventListener('focusin', event => { if (!$('searchForm').contains(event.target)) closeSearch(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable="true"],dialog')) {
      event.preventDefault(); $('placeSearch').focus();
    }
  });
  $('locateButton').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Your browser does not support location. Search for a city instead.'); return; }
    const revision = ++selectionRevision;
    $('locateButton').disabled = true;
    toast('Allow location access to explore your current area.');
    navigator.geolocation.getCurrentPosition(position => {
      if (revision !== selectionRevision) return;
      $('locateButton').disabled = false;
      selectPlace({ lat: position.coords.latitude, lon: position.coords.longitude, name: 'My location', country: 'Browser location · not stored' });
    }, error => {
      if (revision !== selectionRevision) return;
      $('locateButton').disabled = false;
      toast(error.code === 1 ? 'Location permission was not granted. You can search for a city or choose a point on the map.' : 'Your location could not be found. Please retry or use search.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  });
  $('shareButton').addEventListener('click', async () => {
    const url = shareURL(window.location.href, state.place, { zoom: state.map?.getZoom() ?? initial.zoom, metric: state.metric, basemap: state.basemap });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast('Link copied. It includes the selected location’s coordinates.');
    } catch {
      $('shareLink').value = url; openDialog($('shareDialog')); $('shareLink').focus(); $('shareLink').select();
    }
  });
  $('exportButton').addEventListener('click', () => {
    if (!state.data) return;
    const csv = forecastCSV(state.place, state.data);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = element('a'); link.href = url;
    const name = state.place.name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'selected-place';
    link.download = `uhm-${name.toLowerCase()}-hourly-forecast.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Forecast CSV downloaded with timestamps, coordinates and source attribution.');
  });
  all('[data-open-about]').forEach(button => button.addEventListener('click', () => openDialog($('aboutDialog'))));
  $('closeAbout').addEventListener('click', () => $('aboutDialog').close());
  for (const dialog of [$('aboutDialog'), $('shareDialog'), $('comparisonDialog')]) {
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
  }
  const connectivity = () => {
    $('connectionNotice').hidden = navigator.onLine !== false;
    $('connectionNotice').textContent = 'You appear to be offline. Previously loaded readings may be out of date; reconnect and refresh for updated data.';
  };
  window.addEventListener('offline', connectivity); window.addEventListener('online', connectivity); connectivity();
}

syncTheme();
setupMap();
setupInteractions();
setMetric(initial.metric);
selectPlace(initial.place, { pan: false });
if (state.map) sampleView();
