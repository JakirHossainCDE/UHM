import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, requestJSON, weatherURL } from '../modules/api.js';
import { PRESETS, sampleGrid } from '../modules/core.js';
import { weatherFixture, jsonResponse, fixtureFetch, NOW } from './fixtures.js';

test('weather requests use auto timezone, UTC epoch times, explicit units and seven days', () => {
  const url = new URL(weatherURL(PRESETS[0]));
  for (const [key, value] of Object.entries({ timezone: 'auto', timeformat: 'unixtime', forecast_days: '7', temperature_unit: 'celsius', wind_speed_unit: 'kmh' })) assert.equal(url.searchParams.get(key), value);
  assert.equal(url.searchParams.get('latitude'), '23.8103');
});
test('point data is cached by coordinates and force refresh bypasses cache', async () => {
  let requests = 0;
  const client = createClient({ fetcher: (...args) => { requests++; return fixtureFetch(...args); }, now: () => NOW });
  const first = await client.point(PRESETS[0]); const second = await client.point({ ...PRESETS[0], name: 'Alias' });
  assert.equal(first, second); assert.equal(requests, 2);
  await client.point(PRESETS[0], { force: true }); assert.equal(requests, 4);
});
test('cached readings expire after ten minutes', async () => {
  let time = NOW, requests = 0;
  const client = createClient({ fetcher: (...args) => { requests++; return fixtureFetch(...args); }, now: () => time });
  await client.point(PRESETS[0]); time += 601000; await client.point(PRESETS[0]); assert.equal(requests, 4);
});
test('air-quality outage preserves weather without inventing an AQI', async () => {
  const client = createClient({ fetcher: url => new URL(url).hostname.startsWith('air-quality') ? Promise.reject(new TypeError('offline')) : Promise.resolve(jsonResponse(weatherFixture())) });
  const data = await client.point(PRESETS[0]); assert.equal(data.current.aqi, null); assert.equal(data.airAvailable, false); assert.equal(data.current.temperature, 28);
});
test('weather outage rejects the selected-place request even if AQI is available', async () => {
  const client = createClient({ fetcher: url => new URL(url).hostname.startsWith('api.') ? Promise.resolve(jsonResponse({}, 503)) : fixtureFetch(url) });
  await assert.rejects(client.point(PRESETS[0]), /unavailable/);
});
test('invalid coordinates are rejected before any request', async () => {
  const client = createClient({ fetcher: () => { throw new Error('Should not fetch'); } });
  await assert.rejects(client.point({ lat: null, lon: 0 }), /valid/);
});
test('aborted requests do not return even cached data', async () => {
  const client = createClient({ fetcher: fixtureFetch }); await client.point(PRESETS[0]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.point(PRESETS[0], { signal: controller.signal }), { name: 'AbortError' });
});
test('request errors cover throttling, network failure and invalid API responses', async () => {
  await assert.rejects(requestJSON('https://example.test', { fetcher: async () => jsonResponse({}, 429) }), /wait a minute/);
  await assert.rejects(requestJSON('https://example.test', { fetcher: async () => { throw new TypeError('Network'); } }), /connection/);
  await assert.rejects(requestJSON('https://example.test', { fetcher: async () => jsonResponse({ error: true, reason: '<unsafe>' }) }), /could not process/);
});
test('network timeouts terminate requests and produce a useful message', async () => {
  await assert.rejects(requestJSON('https://example.test', { timeout: 5, fetcher: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }), /timed out/);
});
test('external cancellation propagates without becoming a timeout error', async () => {
  const controller = new AbortController();
  const promise = requestJSON('https://example.test', { signal: controller.signal, fetcher: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) });
  controller.abort(); await assert.rejects(promise, { name: 'AbortError' });
});
test('short searches do not call the provider, normal searches use the geocoding endpoint', async () => {
  let calls = 0;
  const client = createClient({ fetcher: (...args) => { calls++; return fixtureFetch(...args); } });
  assert.deepEqual(await client.search('a'), []); assert.equal(calls, 0);
  const result = await client.search('Rome'); assert.equal(result[0].name, 'Rome'); assert.equal(result[0].country, 'Italy'); assert.equal(calls, 1);
});
test('search results reject invalid coordinates and limit untrusted text', async () => {
  const client = createClient({ fetcher: async () => jsonResponse({ results: [{ name: 'bad', latitude: 999, longitude: 0 }, { name: 'x'.repeat(500), latitude: 40, longitude: 12 }] }) });
  const result = await client.search('xx'); assert.equal(result.length, 1); assert.equal(result[0].name.length, 80);
});
test('sample requests batch nine locations and cache the entire view', async () => {
  let calls = 0;
  const client = createClient({ fetcher: (...args) => { calls++; return fixtureFetch(...args); } });
  const points = sampleGrid({ south: 20, north: 26, west: 88, east: 94 });
  const first = await client.samples(points), second = await client.samples(points);
  assert.equal(first.points.length, 9); assert.equal(first.partial, false); assert.equal(first, second); assert.equal(calls, 2);
  assert.equal(first.points[0].values.aqi, 72);
});
test('partial sample outages stay explicit, with missing fields preserved as null', async () => {
  const client = createClient({ fetcher: url => new URL(url).hostname.startsWith('api.') ? Promise.reject(new TypeError('offline')) : fixtureFetch(url) });
  const result = await client.samples([PRESETS[0]]); assert(result.partial); assert.equal(result.points[0].values.temperature, null); assert.equal(result.points[0].values.aqi, 72);
});
test('sample size is bounded to avoid accidental bulk requests', async () => {
  const client = createClient({ fetcher: fixtureFetch });
  await assert.rejects(client.samples([]), /Invalid/); await assert.rejects(client.samples(Array(26).fill(PRESETS[0])), /Invalid/);
});
