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
  let map;
  const leafletMap = window.L.map;
  window.L.map = (...args) => { map = leafletMap(...args); return map; };
  let mode = 'normal', calls = [], resolveSlow, geoCalls = 0, geoSuccess, geoFailure, download;
  const fetcher = async (url, options) => {
    calls.push(String(url));
    const u = new URL(url), weather = u.hostname === 'api.open-meteo.com';
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
    await t.test('theme preference and atlas basemap change together', () => {
      $('themeToggle').click(); assert.equal(document.documentElement.dataset.theme, 'dark'); assert.equal(localStorage.getItem('uhm-theme'), 'dark');
      assert.match($('themeToggle').getAttribute('aria-label'), /light/);
      assert(document.querySelector('.leaflet-tile[src*="dark_all"]'));
      $('themeToggle').click(); assert.equal(document.documentElement.dataset.theme, 'light');
    });
    await t.test('satellite and street basemaps are genuinely selectable', () => {
      for (const [base, fragment] of [['satellite', 'World_Imagery'], ['streets', 'tile.openstreetmap.org'], ['atlas', 'light_all']]) {
        $('basemapSelect').value = base; $('basemapSelect').dispatchEvent(new window.Event('change'));
        assert(document.querySelector(`.leaflet-tile[src*="${fragment}"]`));
      }
    });
    await t.test('switching map metrics updates the legend without requesting data again', () => {
      const count = calls.length; click('[data-metric=wind]'); assert.equal($('legendTitle').textContent, 'Wind at 10 m');
      assert.equal($('legendUnit').textContent, 'km/h'); assert.equal(calls.length, count);
      click('[data-metric=temperature]');
    });
    await t.test('view sampling adds nine real-data markers and clearing removes them', async () => {
      $('sampleButton').click(); await settle(() => !$('sampleButton').disabled);
      assert.equal(document.querySelectorAll('.climate-marker').length, 10);
      assert.match($('sampleSummary').textContent, /9 of 9/);
      const count = calls.length; click('[data-metric=aqi]'); assert.equal(calls.length, count);
      $('clearSamples').click(); assert.equal(document.querySelectorAll('.climate-marker').length, 1);
      click('[data-metric=temperature]');
    });
    await t.test('comparisons add, load and remove places with a three-place limit', async () => {
      $('compareButton').click(); assert.equal($('compareCount').textContent, '1 / 3'); assert.equal($('compareButton').disabled, true);
      click('[data-compare-preset="1"]'); click('[data-compare-preset="2"]');
      await settle(() => document.querySelectorAll('.compare-place[aria-busy=true]').length === 0);
      assert.equal($('compareCount').textContent, '3 / 3'); assert.equal(document.querySelectorAll('.compare-place').length, 3);
      assert.equal($('comparisonSuggestions').hidden, true);
      click('[aria-label="Remove Rome from comparison"]'); assert.equal($('compareCount').textContent, '2 / 3');
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
