/** DOM-level integration tests. No browser, rendering engine, server or external network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { fixtureFetch, jsonResponse, weatherFixture, airFixture } from './fixtures.js';

test('application interaction flows with real Leaflet and a simulated DOM', async t => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const console = new VirtualConsole(), runtimeErrors = [];
  console.on('jsdomError', error => runtimeErrors.push(error));
  const dom = new JSDOM(html, { url: 'https://jakirhossaincde.github.io/UHM/', runScripts: 'outside-only', virtualConsole: console });
  const { window } = dom, { document } = window;
  const saved = new Map();
  const install = (key, value) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const timers = new Set(), originalTimeout = globalThis.setTimeout;
  install('setTimeout', (callback, milliseconds, ...args) => {
    const timer = originalTimeout(callback, milliseconds, ...args);
    timers.add(timer);
    return timer;
  });
  const media = query => ({ matches: query.includes('reduced-motion'), addEventListener() {}, removeEventListener() {} });
  Object.defineProperties(document.getElementById('map'), { clientWidth: { value: 780 }, clientHeight: { value: 460 } });
  window.matchMedia = media;
  window.eval(await readFile(new URL('../vendor/leaflet/leaflet.js', import.meta.url), 'utf8'));
  let rasterWrites = 0, lastRaster;
  // DOM simulation does not include a renderer. Capture the actual raster bytes
  // passed to canvas; the interpolation and projection are separately unit tested.
  window.HTMLCanvasElement.prototype.getContext = function () { return {
    createImageData: (width,height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: pixels => { rasterWrites++; lastRaster = pixels; },
  }; };
  let map;
  const leafletMap = window.L.map;
  window.L.map = (...args) => { map = leafletMap(...args); return map; };
  let mode = 'normal', calls = [], holdSamples = false, pendingSamples = [], resolveSlow, geoCalls = 0, geoSuccess, geoFailure, download;
  const fetcher = async (url, options) => {
    calls.push(String(url));
    const u = new URL(url), weather = u.hostname === 'api.open-meteo.com';
    if (holdSamples && u.searchParams.get('latitude')?.includes(',')) return new Promise(resolve => pendingSamples.push(() => resolve(fixtureFetch(url, options))));
    if (mode === 'weather-failure' && weather) return jsonResponse({}, 503);
    if (mode === 'air-failure' && u.hostname.startsWith('air-quality')) return jsonResponse({}, 503);
    if (mode === 'search-html' && u.hostname.startsWith('geocoding')) return jsonResponse({ results: [{ name: '<img src=x onerror=alert(1)>', country: '<script>bad</script>', latitude: 51, longitude: 1 }] });
    if (u.searchParams.get('latitude') === '44.0000' && weather) return new Promise(resolve => { resolveSlow = () => resolve(jsonResponse(weatherFixture({ temp: 99, lat: 44, lon: 12 }))); });
    if (mode === 'missing' && weather) return jsonResponse(weatherFixture({ temp: null }));
    if (mode === 'missing' && u.hostname.startsWith('air-quality')) return jsonResponse(airFixture(null));
    return fixtureFetch(url, options);
  };
  Object.defineProperty(window.navigator, 'geolocation', { value: { getCurrentPosition(success, failure) { geoCalls++; geoSuccess = success; geoFailure = failure; } }, configurable: true });
  for (const [key, value] of Object.entries({ window, document, navigator: window.navigator, localStorage: window.localStorage, matchMedia: media, fetch: fetcher })) install(key, value);
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { download = { blob }; return 'blob:test-download'; };
  URL.revokeObjectURL = () => {};
  const anchorClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) download.filename = this.download; else anchorClick.call(this); };
  if (!window.HTMLDialogElement.prototype.showModal) window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  if (!window.HTMLDialogElement.prototype.close) window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  const $ = id => document.getElementById(id);
  const click = selector => document.querySelector(selector).click();
  const settle = async (predicate = () => $('conditions').getAttribute('aria-busy') === 'false') => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(5); }
    assert.fail('DOM state did not settle');
  };
  const coordinates = text => { $('placeSearch').value = text; $('searchForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); };
  try {
    await import('../script.js?dom-tests');
    await settle();
    await t.test('startup loads Dhaka without requesting GPS or an account', () => {
      assert.equal($('locationName').textContent, 'Dhaka'); assert.equal($('temperature').textContent, '28'); assert.equal(geoCalls, 0);
      assert.equal($('weatherError').hidden, true); assert.equal(document.querySelectorAll('input[type=password]').length, 0); assert(map);
      assert.equal($('hourlyRows').children.length, 24); assert.equal($('dailyRows').children.length, 7);
    });
    await t.test('keyboard forecast tabs and accessible chart points respond', () => {
      $('hourlyTab').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal($('dailyTab').getAttribute('aria-selected'), 'true'); assert.equal($('dailyPanel').hidden, false);
      $('hourlyTab').click(); const points = document.querySelectorAll('.chart-point'); assert.equal(points.length, 24);
      points[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal(points[1].getAttribute('tabindex'), '0'); assert.match($('chartReadout').textContent, /Rain/);
    });
    await t.test('theme preference switches between free light and dark maps', () => {
      $('themeToggle').click(); assert.equal(document.documentElement.dataset.theme, 'dark'); assert.equal(localStorage.getItem('uhm-theme'), 'dark');
      assert.match($('themeToggle').getAttribute('aria-label'), /light/);
      assert.equal($('map').dataset.basemap, 'dark');
      assert.equal($('basemapSelect').value, 'dark');
      assert(document.querySelector('.leaflet-tile[src*="tile.openstreetmap.org"]'));
      assert.equal(document.querySelector('#basemapSelect option[value=atlas]'), null);
      $('themeToggle').click(); assert.equal(document.documentElement.dataset.theme, 'light');
    });
    await t.test('satellite and street basemaps are genuinely selectable', () => {
      for (const [base, fragment] of [['satellite', 'World_Imagery'], ['streets', 'tile.openstreetmap.org'], ['dark', 'tile.openstreetmap.org'], ['light', 'tile.openstreetmap.org']]) {
        $('basemapSelect').value = base; $('basemapSelect').dispatchEvent(new window.Event('change'));
        assert(document.querySelector(`.leaflet-tile[src*="${fragment}"]`));
      }
    });
    await t.test('switching map metrics updates the legend without requesting data again', () => {
      const count = calls.length; click('[data-metric=wind]'); assert.equal($('legendTitle').textContent, 'Wind at 10 m');
      assert.equal($('legendUnit').textContent, 'km/h'); assert.equal(calls.length, count);
      click('[data-metric=temperature]');
    });
    await t.test('fine surfaces render all metrics with working style, density and opacity controls', async () => {
      $('sampleButton').click(); await settle(() => !$('sampleButton').disabled);
      const canvas = document.querySelector('.weather-surface');
      assert.equal(canvas.hidden, false); assert.equal(canvas.dataset.pixelSize, '1');
      assert.equal(document.querySelectorAll('.layer-cell').length, 0, 'Large rectangle grid removed');
      assert.equal(document.querySelectorAll('.sample-marker').length, 0, 'Labels hidden initially to keep the map clear');
      assert.match($('sampleSummary').textContent, /81 of 81/);
      assert(lastRaster.data.some((value,i) => i % 4 === 3 && value > 0), 'Canvas receives nonempty, model-driven pixels');
      const callsBefore = calls.length;
      for (const [metric, unit] of [['temperature','°C'], ['humidity','%'], ['wind','km/h'], ['rain','mm'], ['aqi','AQI']]) {
        click(`[data-metric=${metric}]`); assert.equal($('legendUnit').textContent, unit);
        assert.equal(canvas.dataset.surfaceMetric, metric); assert.equal(canvas.hidden, false);
        if (metric === 'wind') {
          assert(document.querySelectorAll('.wind-vector .wind-arrow').length > 0);
          assert.equal(document.querySelector('.wind-vector .wind-arrow').style.getPropertyValue('--wind-rotation'), '225deg');
        }
      }
      click('[data-metric=rain]'); $('showValues').checked = true; $('showValues').dispatchEvent(new window.Event('change'));
      assert.match(document.querySelector('.sample-marker').textContent, /1\.2mm/);
      assert.equal(calls.length, callsBefore, 'Switching indicators must reuse loaded data');
      $('pixelSize').value = '4'; $('pixelSize').dispatchEvent(new window.Event('change'));
      assert.equal(canvas.width, 195); assert.equal(canvas.height, 115);
      $('surfaceMode').value = 'grid'; $('surfaceMode').dispatchEvent(new window.Event('change'));
      assert.equal(canvas.style.imageRendering, 'pixelated');
      const paints = rasterWrites;
      $('layerOpacity').value = '75'; $('layerOpacity').dispatchEvent(new window.Event('input'));
      assert.equal(canvas.style.opacity, '0.75'); assert.equal(rasterWrites, paints, 'Opacity should not recompute the raster');
      assert.equal(calls.length, callsBefore);
      $('surfaceMode').value = 'samples'; $('surfaceMode').dispatchEvent(new window.Event('change'));
      assert.equal(canvas.hidden, true); assert.equal($('pixelSize').disabled, true);
      $('surfaceMode').value = 'smooth'; $('surfaceMode').dispatchEvent(new window.Event('change'));
      $('showValues').checked = false; $('showValues').dispatchEvent(new window.Event('change'));
      assert.equal(canvas.hidden, false); assert.equal(document.querySelectorAll('.sample-marker').length, 0);
      $('layerVisible').checked = false; $('layerVisible').dispatchEvent(new window.Event('change')); assert.equal(canvas.hidden, true);
      $('layerVisible').checked = true; $('layerVisible').dispatchEvent(new window.Event('change')); assert.equal(canvas.hidden, false);
      $('clearSamples').click(); assert.equal(canvas.hidden, true); assert.equal($('autoUpdate').checked, false);
      click('[data-metric=temperature]');
    });
    await t.test('hover inspection and Zoom Earth links use the selected place and layer', async () => {
      $('sampleButton').click(); await settle(() => !$('sampleButton').disabled);
      map.fire('mousemove', { latlng: map.getCenter() }); assert.match($('mapReadout').textContent, /interpolated/);
      click('[data-metric=humidity]'); assert.match($('zoomEarthLink').href, /zoom\.earth\/maps\/humidity/);
      assert.match($('zoomEarthLink').href, /23\.810,90\.413/);
      click('[data-metric=aqi]'); assert.equal($('zoomEarthLink').hidden, true);
      click('[data-metric=temperature]'); assert.equal($('zoomEarthLink').hidden, false);
      $('clearSamples').click();
    });
    await t.test('moving the map aborts stale layer loads; auto-update refreshes only the latest view', async () => {
      holdSamples = true; $('sampleButton').click();
      await settle(() => pendingSamples.length === 2);
      map.setView([35, 105], 7);
      holdSamples = false; pendingSamples.splice(0).forEach(resolve => resolve());
      await delay(15);
      assert.equal(document.querySelector('.weather-surface').hidden, true, 'Old viewport response must not draw');
      assert.equal($('sampleButton').disabled, false);
      const count = calls.length;
      map.setView([36, 106], 7);
      await delay(30); assert.equal(calls.length, count, 'Paused auto-update must not request');
      const now = Date.now; Date.now = () => now() + 21000;
      try {
        $('autoUpdate').checked = true; $('autoUpdate').dispatchEvent(new window.Event('change'));
        map.setView([37, 107], 7); map.setView([38, 108], 7);
        await delay(1000);
        await settle(() => !document.querySelector('.weather-surface').hidden);
        assert.equal(calls.length, count + 2, 'Rapid pans should produce one batched weather/air pair');
        assert.match($('sampleSummary').textContent, /81 of 81/);
      } finally { Date.now = now; }
      $('clearSamples').click();
    });
    await t.test('the original map layout supports hiding panels and opening comparisons', () => {
      assert(document.querySelector('.topbar')); assert(document.querySelector('.weather-panel'));
      assert.equal(document.querySelector('.intro'), null);
      $('panelsToggle').click(); assert($('explorer').classList.contains('panels-hidden'));
      $('panelsToggle').click(); assert(!$('explorer').classList.contains('panels-hidden'));
      $('openComparison').click(); assert.equal($('comparisonDialog').open, true);
      $('closeComparison').click(); assert.equal($('comparisonDialog').open, false);
    });
    await t.test('comparisons add, load and remove places with a three-place limit', async () => {
      $('compareButton').click(); assert.equal($('compareCount').textContent, '1 / 3'); assert.equal($('compareButton').disabled, true);
      click('[data-compare-preset="1"]'); click('[data-compare-preset="2"]');
      await settle(() => document.querySelectorAll('.compare-place[aria-busy=true]').length === 0);
      assert.equal($('compareCount').textContent, '3 / 3'); assert.equal(document.querySelectorAll('.compare-place').length, 3);
      assert.equal($('comparisonSuggestions').hidden, true);
      click('[aria-label="Remove Rome from comparison"]'); assert.equal($('compareCount').textContent, '2 / 3');
      $('closeComparison').click();
    });
    await t.test('failed comparison refresh retains and clearly labels the previous snapshot', async () => {
      mode = 'weather-failure'; click('[aria-label="Refresh Dhaka comparison"]');
      await settle(() => document.querySelectorAll('.compare-place[aria-busy=true]').length === 0);
      assert.match(document.querySelector('.compare-error').textContent, /Previous snapshot/); mode = 'normal';
    });
    await t.test('city search supports keyboard selection and correct local timezone', async () => {
      $('placeSearch').value = 'Rome'; $('searchForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await settle(() => document.querySelectorAll('#searchResults [role=option]').length > 0);
      assert.equal($('placeSearch').getAttribute('aria-expanded'), 'true');
      $('searchForm').dispatchEvent(new window.Event('submit', { cancelable: true })); await settle();
      assert.equal($('locationName').textContent, 'Rome'); assert.match($('forecastPlace').textContent, /Europe\/Rome/);
      assert.equal($('searchMenu').hidden, true);
    });
    await t.test('untrusted search names are text, never HTML', async () => {
      mode = 'search-html'; $('placeSearch').value = 'unsafe'; $('searchForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await settle(() => $('searchResults').textContent.includes('<img'));
      assert.equal($('searchResults').querySelectorAll('img,script').length, 0);
      click('#searchResults [role=option]'); await settle();
      assert.match($('locationName').textContent, /^<img/); assert.equal($('locationName').children.length, 0); mode = 'normal';
    });
    await t.test('slow old location responses cannot overwrite a newer selection', async () => {
      coordinates('44,12'); await settle(() => Boolean(resolveSlow));
      click('[data-preset="2"]'); await settle(); assert.equal($('locationName').textContent, 'Salzburg');
      resolveSlow(); await delay(15); assert.equal($('locationName').textContent, 'Salzburg'); assert.notEqual($('temperature').textContent, '99');
    });
    await t.test('weather failure clears stale values, then refresh recovers', async () => {
      mode = 'weather-failure'; $('refreshButton').click(); await settle();
      assert.equal($('temperature').textContent, '—'); assert.equal($('weatherError').hidden, false); assert.equal($('exportButton').disabled, true);
      mode = 'normal'; $('refreshButton').click(); await settle(); assert.equal($('weatherError').hidden, true); assert.equal($('temperature').textContent, '18');
    });
    await t.test('partial air-quality failures and missing readings never become zero', async () => {
      mode = 'air-failure'; $('refreshButton').click(); await settle(); assert.equal($('aqi').textContent, '—'); assert.equal($('temperature').textContent, '18'); assert.match($('airNote').textContent, /unavailable/);
      mode = 'missing'; $('refreshButton').click(); await settle(); assert.equal($('temperature').textContent, '—'); assert.equal($('aqi').textContent, '—');
      mode = 'normal'; $('refreshButton').click(); await settle();
    });
    await t.test('GPS is opt-in, permission failure is actionable, and late GPS cannot hijack navigation', async () => {
      $('locateButton').click(); assert.equal(geoCalls, 1); geoFailure({ code: 1 }); assert.equal($('locateButton').disabled, false); assert.match($('toast').textContent, /permission/);
      $('locateButton').click(); click('[data-preset="1"]'); await settle(); geoSuccess({ coords: { latitude: 1, longitude: 2 } }); await delay(10);
      assert.equal($('locationName').textContent, 'Rome');
    });
    await t.test('map clicks and keyboard-centre inspection select coordinates', async () => {
      map.fire('click', { latlng: window.L.latLng(12, 15) }); await settle(); assert.match($('coordinates').textContent, /12.000.*15.000/);
      map.setView([10, 20], 10); $('centreButton').click(); await settle(); assert.equal($('locationName').textContent, 'Map centre'); assert.match($('coordinates').textContent, /10.000.*20.000/);
    });
    await t.test('sharing falls back to a selectable coordinate-bearing URL without clipboard permission', async () => {
      $('shareButton').click(); await settle(() => $('shareDialog').open);
      const url = new URL($('shareLink').value); assert.equal(url.pathname, '/UHM/'); assert.equal(url.searchParams.get('lat'), '10.0000');
      $('shareDialog').close(); assert.equal(document.body.style.overflow, '');
    });
    await t.test('CSV export contains actual loaded forecast rows and attribution', async () => {
      $('exportButton').click(); assert.match(download.filename, /^uhm-map-centre-hourly-forecast\.csv$/);
      const csv = await download.blob.text(); assert.match(csv, /Open-Meteo/); assert.match(csv, /model_latitude/); assert.equal(csv.split('\r\n').length, 169);
    });
    await t.test('methodology dialog opens and closes, and retains both authors', () => {
      click('[data-open-about]'); assert($('aboutDialog').open); assert.match($('aboutDialog').textContent, /Amna Azeem and Md Jakir Hossain/);
      $('closeAbout').click(); assert(!$('aboutDialog').open); assert.equal(document.body.style.overflow, '');
    });
    await t.test('offline state is explicit and clears on reconnect', () => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true }); window.dispatchEvent(new window.Event('offline')); assert.equal($('connectionNotice').hidden, false);
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true }); window.dispatchEvent(new window.Event('online')); assert.equal($('connectionNotice').hidden, true);
    });
    await t.test('no unhandled DOM runtime errors occurred', () => assert.deepEqual(runtimeErrors, []));
  } finally {
    for (const timer of timers) clearTimeout(timer);
    map?.remove(); window.close();
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
