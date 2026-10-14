/** Pure, dependency-free data and presentation helpers. All temperatures are °C. */
export const PRESETS = [
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lon: 90.4125 },
  { name: 'Rome', country: 'Italy', lat: 41.8919, lon: 12.5113 },
  { name: 'Salzburg', country: 'Austria', lat: 47.7994, lon: 13.0439 },
];

export const METRICS = {
  temperature: { label: 'Air temperature', short: 'Temperature', unit: '°C', min: -10, max: 40, colors: ['#6f9ac6', '#91c5c6', '#d6dfae', '#edba77', '#d77462'], ticks: ['−10°', '15°', '40°+'] },
  humidity: { label: 'Relative humidity', short: 'Humidity', unit: '%', min: 0, max: 100, colors: ['#efe1b1', '#c6d8ad', '#95c9b5', '#6baea9', '#6692ad'], ticks: ['0%', '50%', '100%'] },
  wind: { label: 'Wind at 10 m', short: 'Wind', unit: 'km/h', min: 0, max: 60, colors: ['#cfe0ce', '#aad0ce', '#83b6c9', '#8b9fca', '#aa8cba'], ticks: ['0', '30', '60+'] },
  rain: { label: 'Rain probability · current hour', short: 'Rain chance', unit: '%', min: 0, max: 100, colors: ['#e1e8dd', '#bcd8cd', '#8dbfc7', '#80a5ce', '#7c8eb5'], ticks: ['0%', '50%', '100%'] },
  aqi: { label: 'U.S. Air Quality Index', short: 'Air quality', unit: 'AQI', min: 0, max: 300, colors: ['#a8c99b', '#e2d183', '#e6aa76', '#d98179', '#b396bb'], ticks: ['0', '150', '300+'] },
};

export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
export const numeric = value => isNumber(value) ? value : null;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const normalizeLongitude = lon => ((lon + 180) % 360 + 360) % 360 - 180;
export const formatNumber = (value, digits = 0) => isNumber(value)
  ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
  : '—';
export const locationKey = place => `${place.lat.toFixed(4)},${normalizeLongitude(place.lon).toFixed(4)}`;

export function validCoordinates(lat, lon) {
  return isNumber(lat) && isNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function coordinateLabel(lat, lon) {
  return `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}`;
}

export function parseCoordinates(text) {
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]);
  return validCoordinates(lat, lon) ? { lat, lon, name: 'Selected coordinates', country: '' } : null;
}

export function parseView(search) {
  const params = new URLSearchParams(search);
  const lat = params.has('lat') && params.get('lat').trim() !== '' ? Number(params.get('lat')) : NaN;
  const lon = params.has('lon') && params.get('lon').trim() !== '' ? Number(params.get('lon')) : NaN;
  const place = validCoordinates(lat, lon)
    ? { lat, lon, name: (params.get('place') || 'Shared location').slice(0, 80), country: '' }
    : { ...PRESETS[0] };
  const zoom = Number(params.get('zoom'));
  return {
    place,
    zoom: params.has('zoom') && Number.isFinite(zoom) ? clamp(zoom, 2, 18) : 10,
    metric: Object.hasOwn(METRICS, params.get('metric')) ? params.get('metric') : 'temperature',
    basemap: ['atlas', 'streets', 'satellite', 'terrain'].includes(params.get('base')) ? params.get('base') : 'atlas',
  };
}

export function shareURL(base, place, { zoom = 10, metric = 'temperature', basemap = 'atlas' } = {}) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  for (const [key, value] of Object.entries({ lat: place.lat.toFixed(4), lon: normalizeLongitude(place.lon).toFixed(4), place: place.name.slice(0, 80), zoom: Math.round(zoom), metric, base: basemap })) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

export function localTime(timestamp, timezone = 'UTC', options = {}) {
  if (!isNumber(timestamp)) return '—';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', ...options }).format(date);
  }
}

export function forecastDate(timestamp, offset = 0) {
  // Daily buckets follow the API's fixed-offset calendar, not a browser's timezone.
  if (!isNumber(timestamp)) return '';
  return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10);
}

export function dayLabel(isoDate, options = { weekday: 'short', day: 'numeric' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function condition(code, isDay = 1) {
  if (code === 0) return { label: isDay === 0 ? 'Clear night' : 'Clear sky', icon: isDay === 0 ? 'moon' : 'sun' };
  if ([1, 2].includes(code)) return { label: code === 1 ? 'Mainly clear' : 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if ([45, 48].includes(code)) return { label: 'Fog', icon: 'fog' };
  if ([51, 53, 55].includes(code)) return { label: 'Drizzle', icon: 'rain' };
  if ([56, 57, 66, 67].includes(code)) return { label: 'Freezing rain / drizzle', icon: 'snow' };
  if ([61, 63, 65].includes(code)) return { label: 'Rain', icon: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: 'snow' };
  if ([80, 81, 82].includes(code)) return { label: 'Rain showers', icon: 'rain' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Conditions unavailable', icon: 'cloud' };
}

export function aqiCategory(value) {
  if (!isNumber(value) || value < 0) return { label: 'Unavailable', color: 'var(--muted)' };
  const index = Math.round(value);
  if (index <= 50) return { label: 'Good', color: '#408649' };
  if (index <= 100) return { label: 'Moderate', color: '#9b791c' };
  if (index <= 150) return { label: 'Unhealthy for sensitive groups', color: '#bc6829' };
  if (index <= 200) return { label: 'Unhealthy', color: '#c34b4b' };
  if (index <= 300) return { label: 'Very unhealthy', color: '#95639e' };
  return { label: 'Hazardous', color: '#963c66' };
}

export function windDirection(degrees) {
  if (!isNumber(degrees)) return '—';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function metricColor(value, metric = 'temperature') {
  const spec = METRICS[metric] || METRICS.temperature;
  if (!isNumber(value)) return '#b4bcb6';
  const position = clamp((value - spec.min) / (spec.max - spec.min), 0, 1) * (spec.colors.length - 1);
  const index = Math.min(Math.floor(position), spec.colors.length - 2);
  const fraction = position - index;
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(spec.colors[index]), b = rgb(spec.colors[index + 1]);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * fraction)).join(', ')})`;
}

export function sampleGrid({ south, north, west, east }, size = 3) {
  if (![south, north, west, east].every(isNumber) || !Number.isInteger(size) || size < 1 || size > 5) throw new Error('Invalid sampling bounds');
  south = clamp(south, -85, 85); north = clamp(north, -85, 85);
  if (north <= south) throw new Error('Invalid latitude bounds');
  if (east < west) east += Math.ceil((west - east) / 360) * 360;
  if (east <= west) throw new Error('Invalid longitude bounds');
  const mid = (east + west) / 2, span = Math.min(east - west, 360);
  west = mid - span / 2;
  return Array.from({ length: size * size }, (_, i) => ({
    lat: Number((south + (Math.floor(i / size) + 0.5) / size * (north - south)).toFixed(4)),
    lon: Number(normalizeLongitude(west + (i % size + 0.5) / size * span).toFixed(4)),
    name: 'Map sample', country: '',
  }));
}

export function normalizeWeather(weather, air = null, retrievedAt = Date.now()) {
  if (!weather || !isNumber(weather.current?.time) || !Array.isArray(weather.hourly?.time)) throw new Error('The weather service returned incomplete data. Please retry.');
  const c = weather.current;
  const hourly = weather.hourly.time.map((time, i) => ({
    time: numeric(time), temperature: numeric(weather.hourly.temperature_2m?.[i]),
    rain: numeric(weather.hourly.precipitation_probability?.[i]), humidity: numeric(weather.hourly.relative_humidity_2m?.[i]),
    wind: numeric(weather.hourly.wind_speed_10m?.[i]), code: numeric(weather.hourly.weather_code?.[i]),
  })).filter(row => row.time !== null);
  const nearHour = hourly.find(row => row.time >= Math.floor(c.time / 3600) * 3600);
  return {
    timezone: weather.timezone || 'UTC', retrievedAt,
    modelLat: numeric(weather.latitude), modelLon: numeric(weather.longitude), elevation: numeric(weather.elevation),
    current: {
      time: c.time, temperature: numeric(c.temperature_2m), feels: numeric(c.apparent_temperature),
      humidity: numeric(c.relative_humidity_2m), wind: numeric(c.wind_speed_10m), direction: numeric(c.wind_direction_10m),
      precipitation: numeric(c.precipitation), rain: nearHour?.rain ?? null, code: numeric(c.weather_code), isDay: numeric(c.is_day),
      aqi: numeric(air?.current?.us_aqi), pm25: numeric(air?.current?.pm2_5), airTime: numeric(air?.current?.time),
    },
    hourly,
    daily: (weather.daily?.time || []).map((time, i) => ({
      date: forecastDate(time, numeric(weather.utc_offset_seconds) ?? 0),
      min: numeric(weather.daily.temperature_2m_min?.[i]), max: numeric(weather.daily.temperature_2m_max?.[i]),
      rain: numeric(weather.daily.precipitation_probability_max?.[i]), code: numeric(weather.daily.weather_code?.[i]),
    })),
    airAvailable: isNumber(air?.current?.us_aqi),
  };
}

export const nextHours = (data, count = 24) => data.hourly.filter(row => row.time >= Math.floor(data.current.time / 3600) * 3600).slice(0, count);

export function chartGeometry(rows, width = 720, height = 180, padding = 24) {
  const values = rows.map(row => row.temperature).filter(isNumber);
  if (!values.length) return { points: [], segments: [], min: null, max: null };
  const min = Math.floor(Math.min(...values) - 2), max = Math.ceil(Math.max(...values) + 2);
  const points = rows.map((row, i) => ({
    ...row, x: padding + i / Math.max(rows.length - 1, 1) * (width - 2 * padding),
    y: isNumber(row.temperature) ? height - padding - (row.temperature - min) / (max - min) * (height - padding * 2) : null,
  }));
  const segments = []; let segment = [];
  for (const point of points) {
    if (point.y === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  return { points, segments, min, max };
}

export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Treat untrusted text as text in spreadsheets, while preserving numeric negatives.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function forecastCSV(place, data) {
  const headers = ['location', 'requested_latitude', 'requested_longitude', 'model_latitude', 'model_longitude', 'timezone', 'time_utc', 'local_date_time', 'temperature_c', 'rain_probability_percent', 'relative_humidity_percent', 'wind_kmh', 'weather_code', 'retrieved_at_utc', 'source'];
  const rows = data.hourly.map(row => [place.name, place.lat, place.lon, data.modelLat, data.modelLon, data.timezone,
    new Date(row.time * 1000).toISOString(), localTime(row.time, data.timezone, { year: 'numeric', month: '2-digit', day: '2-digit', timeZoneName: 'short' }),
    row.temperature, row.rain, row.humidity, row.wind, row.code, new Date(data.retrievedAt).toISOString(), 'Open-Meteo (modelled forecast); https://open-meteo.com/']);
  return '\ufeff' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

/** Guards against a slower old response replacing the most recently selected place. */
export class LatestRequest {
  #id = 0;
  #controller;
  begin() {
    this.#controller?.abort();
    this.#controller = new AbortController();
    return { id: ++this.#id, signal: this.#controller.signal };
  }
  isCurrent(ticket) { return ticket.id === this.#id && !ticket.signal.aborted; }
  cancel() { this.#controller?.abort(); this.#id++; }
}
