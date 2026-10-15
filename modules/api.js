import { numeric, normalizeWeather, locationKey, validCoordinates } from './core.js?v=2.2.0';

const WEATHER = 'https://api.open-meteo.com/v1/forecast';
const ICON = 'https://api.open-meteo.com/v1/dwd-icon';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const TTL = 10 * 60 * 1000;

export async function requestJSON(url, { signal, timeout = 18000, fetcher = fetch } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'The data service is busy. Please wait a minute and retry.' : 'The data service is unavailable. Please retry.');
    const data = await response.json();
    if (!data || data.error) throw new Error('The data service could not process this request. Please retry.');
    return data;
  } catch (error) {
    if (timedOut) throw new Error('The request timed out. Please check your connection and retry.');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof TypeError) throw new Error('Could not connect to the data service. Please check your internet connection.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function weatherURL(place) {
  const url = new URL(WEATHER);
  url.search = new URLSearchParams({ latitude: place.lat.toFixed(4), longitude: place.lon.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,precipitation',
    hourly: 'temperature_2m,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto', timeformat: 'unixtime', forecast_days: '7', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
  });
  return url.href;
}

export function createClient({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(), sampleCache = new Map();
  const get = (url, signal) => requestJSON(url, { fetcher, signal });
  const put = (store, key, value) => {
    if (store.size >= 40) store.delete(store.keys().next().value);
    store.set(key, { value, at: now() });
  };
  const cached = (store, key) => {
    const item = store.get(key);
    return item && now() - item.at < TTL ? item.value : null;
  };
  return {
    async point(place, { signal, force = false } = {}) {
      if (!validCoordinates(place.lat, place.lon)) throw new Error('Choose a valid latitude and longitude.');
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const key = locationKey(place), hit = cached(cache, key);
      if (!force && hit) return hit;
      const airURL = new URL(AIR);
      airURL.search = new URLSearchParams({ latitude: place.lat.toFixed(4), longitude: place.lon.toFixed(4), current: 'us_aqi,pm2_5', timezone: 'auto', timeformat: 'unixtime' });
      const [weather, air] = await Promise.allSettled([get(weatherURL(place), signal), get(airURL.href, signal)]);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (weather.status === 'rejected') throw weather.reason;
      const result = normalizeWeather(weather.value, air.status === 'fulfilled' ? air.value : null, now());
      put(cache, key, result);
      return result;
    },
    async search(query, { signal } = {}) {
      const name = query.trim();
      if (name.length < 2) return [];
      const url = new URL(GEO);
      url.search = new URLSearchParams({ name: name.slice(0, 120), count: '6', language: 'en', format: 'json' });
      const result = await get(url.href, signal);
      return (result.results || []).filter(row => validCoordinates(row.latitude, row.longitude)).map(row => ({
        lat: row.latitude, lon: row.longitude, name: String(row.name || 'Unnamed place').slice(0, 80),
        country: String(row.country || '').slice(0, 80), admin: String(row.admin1 || '').slice(0, 80),
      }));
    },
    async samples(points, { signal, force = false } = {}) {
      if (!points.length || points.length > 81 || points.some(p => !validCoordinates(p.lat, p.lon))) throw new Error('Invalid sample locations');
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const key = points.map(locationKey).join(';'), hit = cached(sampleCache, key);
      if (!force && hit) return { ...hit, points: hit.points.map((point, i) => ({ ...point, ...points[i] })) };
      const coordinates = { latitude: points.map(p => p.lat).join(','), longitude: points.map(p => p.lon).join(','), timeformat: 'unixtime', timezone: 'GMT' };
      const weatherURL = new URL(ICON), airURL = new URL(AIR);
      weatherURL.search = new URLSearchParams({ ...coordinates, hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation', forecast_hours: '1', wind_speed_unit: 'kmh', precipitation_unit: 'mm' });
      airURL.search = new URLSearchParams({ ...coordinates, current: 'us_aqi' });
      const [weather, air] = await Promise.allSettled([get(weatherURL.href, signal), get(airURL.href, signal)]);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (weather.status === 'rejected' && air.status === 'rejected') throw weather.reason;
      const list = result => result.status === 'fulfilled' ? (Array.isArray(result.value) ? result.value : [result.value]) : [];
      const ws = list(weather), as = list(air);
      const result = {
        retrievedAt: now(), source: 'DWD ICON / Open-Meteo', partial: weather.status === 'rejected' || air.status === 'rejected' || ws.length !== points.length || as.length !== points.length,
        points: points.map((place, i) => ({ ...place,
          time: numeric(ws[i]?.hourly?.time?.[0]), airTime: numeric(as[i]?.current?.time), rainTime: numeric(ws[i]?.hourly?.time?.[0]), direction: numeric(ws[i]?.hourly?.wind_direction_10m?.[0]),
          modelLat: numeric(ws[i]?.latitude), modelLon: numeric(ws[i]?.longitude),
          values: { temperature: numeric(ws[i]?.hourly?.temperature_2m?.[0]), humidity: numeric(ws[i]?.hourly?.relative_humidity_2m?.[0]), wind: numeric(ws[i]?.hourly?.wind_speed_10m?.[0]), rain: numeric(ws[i]?.hourly?.precipitation?.[0]), aqi: numeric(as[i]?.current?.us_aqi) },
        })),
      };
      result.partial ||= result.points.some(point => point.time === null || point.airTime === null || Object.values(point.values).some(value => value === null));
      put(sampleCache, key, result);
      return result;
    },
  };
}
