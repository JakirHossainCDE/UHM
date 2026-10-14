import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../modules/core.js';
import { weatherFixture, airFixture, NOW, HOUR } from './fixtures.js';

test('missing readings are never coerced to zero', () => {
  for (const value of [null, undefined, '', false, NaN, Infinity, '12']) assert.equal(c.numeric(value), null);
  assert.equal(c.numeric(0), 0);
  assert.equal(c.formatNumber(null), '—');
  assert.equal(c.formatNumber(-2.6), '-3');
});
test('coordinates validate boundaries and normalise wrapped longitude', () => {
  assert(c.validCoordinates(90, 180));
  assert(!c.validCoordinates(91, 0));
  assert(!c.validCoordinates(null, 0));
  assert.equal(c.normalizeLongitude(540), -180);
  assert.equal(c.normalizeLongitude(-190), 170);
  assert.match(c.coordinateLabel(-1.234, -2.345), /S.*W/);
});
test('coordinate search accepts signed decimal pairs and rejects out-of-range input', () => {
  assert.equal(c.parseCoordinates(' 23.81, 90.412 ')?.lat, 23.81);
  assert.equal(c.parseCoordinates('-33.8, +151.2')?.lon, 151.2);
  for (const input of ['Dhaka', '91, 0', '0, 181', '1e2,2', ',']) assert.equal(c.parseCoordinates(input), null);
});
test('shared views validate all URL-controlled state', () => {
  const defaultView = c.parseView(''); assert.deepEqual(defaultView.place, c.PRESETS[0]);
  assert.deepEqual(c.parseView('?lat=&lon=').place, c.PRESETS[0]);
  assert.deepEqual(c.parseView('?lat=999&lon=0').place, c.PRESETS[0]);
  const shared = c.parseView('?lat=41&lon=12&zoom=99&metric=__proto__&base=invalid&place=Rome');
  assert.equal(shared.zoom, 18); assert.equal(shared.metric, 'temperature'); assert.equal(shared.basemap, 'light');
  const safe = c.parseView('?lat=1&lon=2&place=' + 'x'.repeat(1000)); assert.equal(safe.place.name.length, 80);
});
test('share URL preserves the GitHub Pages subpath, encodes names and strips unrelated parameters', () => {
  const url = c.shareURL('https://jakirhossaincde.github.io/UHM/?junk=private#fragment', { ...c.PRESETS[0], name: 'A & B <city>' }, { metric: 'aqi', basemap: 'satellite', zoom: 9 });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/UHM/'); assert.equal(parsed.hash, ''); assert(!parsed.searchParams.has('junk'));
  const view = c.parseView(parsed.search); assert.equal(view.place.name, 'A & B <city>'); assert.equal(view.metric, 'aqi'); assert.equal(view.basemap, 'satellite');
});
test('timestamps use the selected place, not the browser timezone', () => {
  assert.equal(c.localTime(HOUR, 'Asia/Dhaka'), '18:00');
  assert.equal(c.localTime(HOUR, 'Europe/Rome'), '14:00');
  assert.equal(c.localTime(HOUR, 'America/New_York'), '08:00');
  assert.equal(c.localTime(null, 'Europe/Rome'), '—');
  assert.equal(c.localTime(HOUR, 'Invalid/Zone'), '12:00');
});
test('hourly dates follow DST and daily calendar buckets use the API offset', () => {
  const before = Date.parse('2026-10-25T00:30:00Z') / 1000, after = Date.parse('2026-10-25T01:30:00Z') / 1000;
  assert.equal(c.localTime(before, 'Europe/Rome'), '02:30');
  assert.equal(c.localTime(after, 'Europe/Rome'), '02:30');
  assert.notEqual(c.localTime(before, 'Europe/Rome', { timeZoneName: 'short' }), c.localTime(after, 'Europe/Rome', { timeZoneName: 'short' }));
  assert.equal(c.forecastDate(Date.parse('2026-10-13T18:00:00Z') / 1000, 21600), '2026-10-14');
  assert.equal(c.dayLabel('2026-10-14'), 'Wed 14');
});
test('WMO weather categories cover clear nights, fog, frozen precipitation and storms', () => {
  assert.equal(c.condition(0, 0).icon, 'moon');
  assert.equal(c.condition(0).icon, 'sun');
  for (const code of [45, 48]) assert.equal(c.condition(code).icon, 'fog');
  for (const code of [56, 57, 66, 67, 71, 73, 75, 77, 85, 86]) assert.equal(c.condition(code).icon, 'snow');
  for (const code of [95, 96, 99]) assert.equal(c.condition(code).icon, 'storm');
  assert.match(c.condition(null).label, /unavailable/);
});
test('U.S. AQI categories handle every boundary and missing values', () => {
  for (const [value, label] of [[0, 'Good'], [50, 'Good'], [51, 'Moderate'], [100, 'Moderate'], [101, 'Unhealthy for sensitive groups'], [150, 'Unhealthy for sensitive groups'], [151, 'Unhealthy'], [200, 'Unhealthy'], [201, 'Very unhealthy'], [300, 'Very unhealthy'], [301, 'Hazardous'], [500, 'Hazardous'], [null, 'Unavailable'], [-1, 'Unavailable']]) assert.equal(c.aqiCategory(value).label, label);
});
test('wind directions wrap safely', () => {
  assert.equal(c.windDirection(0), 'N'); assert.equal(c.windDirection(45), 'NE');
  assert.equal(c.windDirection(360), 'N'); assert.equal(c.windDirection(-45), 'NW'); assert.equal(c.windDirection(null), '—');
});
test('colour scales clamp extremes and show missing values separately', () => {
  assert.equal(c.metricColor(-100), c.metricColor(-10));
  assert.equal(c.metricColor(100), c.metricColor(40));
  assert.notEqual(c.metricColor(null), c.metricColor(0));
  assert.match(c.metricColor(25), /^rgb\(/);
});
test('view samples are a discrete nine-point grid strictly inside bounds', () => {
  const grid = c.sampleGrid({ south: 20, north: 26, west: 88, east: 94 });
  assert.equal(grid.length, 9); assert.equal(new Set(grid.map(c.locationKey)).size, 9);
  assert(grid.every(p => p.lat > 20 && p.lat < 26 && p.lon > 88 && p.lon < 94));
  assert.equal(grid[4].lat, 23); assert.equal(grid[4].lon, 91);
});
test('view samples handle the antimeridian, polar bounds and repeated worlds', () => {
  for (const bounds of [{ south: -95, north: 95, west: -540, east: 540 }, { south: -10, north: 10, west: 170, east: -170 }]) {
    const grid = c.sampleGrid(bounds); assert.equal(new Set(grid.map(c.locationKey)).size, 9); assert(grid.every(p => c.validCoordinates(p.lat, p.lon)));
  }
  assert.throws(() => c.sampleGrid({ south: 10, north: 0, west: 0, east: 1 }));
  assert.throws(() => c.sampleGrid({ south: 0, north: 10, west: 0, east: 1 }, 99));
});
test('normalisation preserves actual zero, missing AQI, current-hour rainfall and model provenance', () => {
  const raw = weatherFixture({ temp: 0 }); raw.current.relative_humidity_2m = null;
  raw.hourly.precipitation_probability[12] = 0;
  const data = c.normalizeWeather(raw, null, NOW);
  assert.equal(data.current.temperature, 0); assert.equal(data.current.humidity, null); assert.equal(data.current.aqi, null);
  assert.equal(data.current.rain, 0); assert.equal(data.airAvailable, false); assert.equal(data.daily[0].date, '2026-10-14');
  assert.equal(data.modelLat, raw.latitude); assert.equal(data.retrievedAt, NOW);
});
test('weather normalisation accepts missing optional fields, rejects malformed payloads', () => {
  const raw = weatherFixture(); delete raw.current.wind_speed_10m; delete raw.daily;
  const data = c.normalizeWeather(raw, airFixture(0)); assert.equal(data.current.wind, null); assert.equal(data.current.aqi, 0); assert(data.airAvailable); assert.deepEqual(data.daily, []);
  for (const invalid of [null, {}, { current: { time: 12 } }]) assert.throws(() => c.normalizeWeather(invalid));
});
test('24-hour outlook starts at the current model hour, not midnight', () => {
  const rows = c.nextHours(c.normalizeWeather(weatherFixture())); assert.equal(rows.length, 24); assert.equal(rows[0].time, HOUR); assert.equal(rows.at(-1).time, HOUR + 23 * 3600);
});
test('chart data breaks lines at missing readings without zero-filling or bridging gaps', () => {
  const chart = c.chartGeometry([{ temperature: 20 }, { temperature: null }, { temperature: 21 }, { temperature: 21 }]);
  assert.equal(chart.segments.length, 2); assert.equal(chart.points[1].y, null); assert(chart.max > chart.min);
  assert.deepEqual(c.chartGeometry([{ temperature: null }]).points, []);
});
test('CSV exports include coordinates, source, UTC and local time, and neutralise formula text', () => {
  const csv = c.forecastCSV({ ...c.PRESETS[0], name: '=HYPERLINK("evil")' }, c.normalizeWeather(weatherFixture(), null, NOW));
  assert(csv.startsWith('\ufeff')); assert.match(csv, /model_latitude/); assert.match(csv, /Open-Meteo/); assert.match(csv, /2026-10-14T/);
  assert.match(csv, /'=HYPERLINK/); assert.equal(csv.split('\r\n').length, 169);
  assert.equal(c.csvCell(null), '""'); assert.equal(c.csvCell(-12), '"-12"'); assert.equal(c.csvCell('a,b"c'), '"a,b""c"');
});
test('latest-request guard aborts stale work and handles explicit cancellation', () => {
  const gate = new c.LatestRequest(), first = gate.begin(), second = gate.begin();
  assert(first.signal.aborted); assert(!gate.isCurrent(first)); assert(gate.isCurrent(second));
  gate.cancel(); assert(second.signal.aborted); assert(!gate.isCurrent(second));
});

test('display cells cover the selected area without gaps and retain dateline coordinates', () => {
  const cells = c.sampleCells({ south: 20, north: 28, west: 88, east: 96 });
  assert.equal(cells.length, 16);
  assert.deepEqual(cells[0].bounds, [[20,88],[22,90]]);
  assert.deepEqual(cells[15].bounds, [[26,94],[28,96]]);
  for (const cell of cells) {
    assert(cell.lat > cell.bounds[0][0] && cell.lat < cell.bounds[1][0]);
    assert(cell.displayLon > cell.bounds[0][1] && cell.displayLon < cell.bounds[1][1]);
  }
  const wrapped = c.sampleCells({ south: -10, north: 10, west: 170, east: -170 });
  assert.equal(wrapped[3].bounds[1][1], 190);
  assert.equal(wrapped[3].lon, -172.5);
  assert.equal(wrapped[3].displayLon, 187.5);
  assert.equal(wrapped[3].bounds[0][1], wrapped[2].bounds[1][1]);
});
test('precipitation amounts and rain probability remain distinct', () => {
  const raw = weatherFixture();
  raw.hourly.precipitation = raw.hourly.time.map(() => 2.7);
  raw.hourly.precipitation_probability = raw.hourly.time.map(() => 80);
  const result = c.normalizeWeather(raw);
  assert.equal(result.current.rainfall, 2.7); assert.equal(result.current.rain, 80);
  assert.equal(c.METRICS.rain.unit, 'mm');
  raw.hourly.precipitation = raw.hourly.time.map(() => null);
  assert.equal(c.normalizeWeather(raw).current.rainfall, null);
});
test('shared light and dark maps are restored, including legacy atlas links', () => {
  for (const base of ['light','dark']) assert.equal(c.parseView(`?base=${base}`).basemap, base);
  assert.equal(c.parseView('?base=atlas').basemap, 'light');
});
test('air-quality layer colours follow U.S. AQI category boundaries', () => {
  for (const [low,high,index] of [[0,50,0],[51,100,1],[101,150,2],[151,200,3],[201,300,4],[301,500,5]]) {
    assert.equal(c.metricColor(low,'aqi'), c.METRICS.aqi.colors[index]);
    assert.equal(c.metricColor(high,'aqi'), c.METRICS.aqi.colors[index]);
  }
  assert.equal(c.metricColor(-1,'aqi'), c.metricColor(null,'aqi'));
});
